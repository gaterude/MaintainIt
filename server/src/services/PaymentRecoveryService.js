const pool = require("../config/database");
const paymentService = require("./paymentService");
const paymentRepository = require("../repositories/paymentRepository");

// Safaricom result codes that mean the customer will not pay this attempt.
const FINAL_FAILURE_CODES = new Set([1, 1032, 1037, 2001]);

// An STK prompt expires within about 90 seconds. Waiting 3 minutes before
// a manual cancel keeps a late customer payment very unlikely.
const MIN_AGE_MINUTES = 3;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function findActiveMpesaPayment(requestId) {
  const result = await pool.query(
    `SELECT id, payer_id, status, checkout_request_id,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60)::integer AS age_minutes
     FROM payments
     WHERE maintenance_request_id = $1
       AND payment_method = 'mpesa'
       AND status IN ('pending', 'processing')
     ORDER BY created_at DESC
     LIMIT 1`,
    [requestId]
  );
  return result.rows[0] || null;
}

// Returns Safaricom's result code, or null if the answer is not trustworthy.
async function askSafaricom(checkoutRequestId) {
  if (!checkoutRequestId) return null;

  try {
    const { httpStatus, data } = await paymentService.querySTKPushStatus(checkoutRequestId);

    const valid =
      httpStatus >= 200 &&
      httpStatus < 300 &&
      data &&
      String(data.ResponseCode) === "0" &&
      String(data.CheckoutRequestID || "") === checkoutRequestId &&
      data.ResultCode !== undefined &&
      Number.isInteger(Number(data.ResultCode));

    return valid ? Number(data.ResultCode) : null;
  } catch (error) {
    console.error("Payment recovery query failed:", error.message);
    return null;
  }
}

async function resolveMpesaPayment({ requestId, user, cancel }) {
  const payment = await findActiveMpesaPayment(requestId);

  if (!payment) {
    throw fail("No M-Pesa payment is waiting for this request.", 404);
  }

  if (payment.payer_id !== user.id && user.role !== "admin") {
    throw fail("You cannot manage this payment.", 403);
  }

  const code = await askSafaricom(payment.checkout_request_id);

  // Safaricom itself confirms this exact checkout succeeded. The status query
  // has no receipt number (only the callback does), so record a verified
  // reference. Never cancel in this case: the money has moved.
  if (code === 0) {
    const paid = await paymentRepository.markPaymentPaid({
      paymentId: payment.id,
      transactionReference: `MPESA-VERIFIED-${payment.checkout_request_id}`.slice(0, 100),
    });

    return {
      outcome: "paid",
      message:
        paid && paid.status === "paid"
          ? "Payment confirmed. Thank you."
          : "Safaricom reports this payment succeeded. Do not pay again.",
    };
  }

  if (code !== null && FINAL_FAILURE_CODES.has(code)) {
    await paymentRepository.markPaymentFailed(payment.id);
    return {
      outcome: "failed",
      message: "The M-Pesa attempt did not complete. You can try again or pay with cash.",
    };
  }

  if (!cancel) {
    return {
      outcome: "still_waiting",
      message: `Still waiting for M-Pesa (${payment.age_minutes} min). If no prompt arrives, you can cancel the attempt after ${MIN_AGE_MINUTES} minutes.`,
    };
  }

  if (payment.age_minutes < MIN_AGE_MINUTES) {
    const left = MIN_AGE_MINUTES - payment.age_minutes;
    throw fail(`Please wait ${left} more minute(s) before cancelling this attempt.`, 409);
  }

  await paymentRepository.markPaymentFailed(payment.id);
  return {
    outcome: "cancelled",
    message: "The M-Pesa attempt was cancelled. You can try again or pay with cash.",
  };
}

module.exports = { resolveMpesaPayment };