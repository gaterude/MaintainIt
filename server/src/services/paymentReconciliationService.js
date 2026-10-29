
const paymentRepository = require("../repositories/paymentRepository");
const paymentService = require("./paymentService");

const FINAL_FAILURE_CODES = new Set([
  1,    // Insufficient funds
  1032, // User cancelled the request
  1037, // STK timeout / customer unreachable
  2001, // Incorrect M-Pesa PIN
]);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function reconcileUnresolvedPayments(limit = 100) {
  const payments =
    await paymentRepository.findUnresolvedPayments(limit);

  const results = [];
  let queriesAttempted = 0;

  for (const payment of payments) {
    const checkoutRequestId = payment.checkout_request_id;

    const baseResult = {
      paymentId: payment.id,
      checkoutRequestId: checkoutRequestId || null,
      currentStatus: payment.status,
    };

    if (
      typeof checkoutRequestId !== "string" ||
      !checkoutRequestId.trim()
    ) {
      results.push({
        ...baseResult,
        outcome: "requires_investigation",
        message:
          "No checkout request ID is available. Payment status remains unchanged.",
      });

      continue;
    }

    if (queriesAttempted > 0) {
      await sleep(3000);
    }

    queriesAttempted += 1;

    try {
      const queryResult =
        await paymentService.querySTKPushStatus(
          checkoutRequestId
        );

      const data = queryResult?.data;

      if (queryResult.httpStatus === 429) {
        results.push({
          ...baseResult,
          outcome: "rate_limited",
          message:
            "Safaricom rate-limited the query. Remaining payments will be checked later.",
        });

        break;
      }

      const validResponse =
        Number.isInteger(queryResult.httpStatus) &&
        queryResult.httpStatus >= 200 &&
        queryResult.httpStatus < 300 &&
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        String(data.ResponseCode) === "0" &&
        String(data.CheckoutRequestID || "") ===
          checkoutRequestId &&
        data.ResultCode !== undefined &&
        data.ResultCode !== null &&
        String(data.ResultCode).trim() !== "" &&
        Number.isInteger(Number(data.ResultCode));

      if (!validResponse) {
        results.push({
          ...baseResult,
          outcome: "query_inconclusive",
          message:
            "Safaricom did not provide a valid, matching result. Payment status remains unchanged.",
        });

        continue;
      }

      const resultCode = Number(data.ResultCode);

      if (resultCode === 0) {
        results.push({
          ...baseResult,
          outcome: "success_awaiting_receipt",
          resultCode,
          message:
            "Safaricom reports success, but a verified receipt is required before marking the payment paid.",
        });

        continue;
      }

      if (!FINAL_FAILURE_CODES.has(resultCode)) {
        results.push({
          ...baseResult,
          outcome: "failure_requires_verification",
          resultCode,
          resultDescription: data.ResultDesc,
          message:
            "The result code is not in the recognized failure list. Payment status remains unchanged.",
        });

        continue;
      }

      const updatedPayment =
        await paymentRepository.markPaymentFailed(payment.id);

      if (updatedPayment) {
        results.push({
          ...baseResult,
          outcome: "failed",
          resultCode,
          resultDescription: data.ResultDesc,
          message:
            "Safaricom returned a recognized failure result. The payment has been marked failed.",
        });
      } else {
        results.push({
          ...baseResult,
          outcome: "status_unchanged",
          resultCode,
          message:
            "The payment was not updated. Its current database status may have changed since reconciliation began.",
        });
      }
    } catch (error) {
      console.error("Payment reconciliation query failed:", {
        paymentId: payment.id,
        reason: error.message,
        httpStatus: error.httpStatus || null,
      });

      if (error.httpStatus === 429) {
        results.push({
          ...baseResult,
          outcome: "rate_limited",
          message:
            "Safaricom rate-limited the query. Remaining payments will be checked later.",
        });

        break;
      }

      results.push({
        ...baseResult,
        outcome: "query_error",
        message:
          "The transaction could not be reconciled. Payment status remains unchanged.",
      });
    }
  }

  return {
    checked: results.length,
    results,
  };
}

module.exports = {
  reconcileUnresolvedPayments,
};