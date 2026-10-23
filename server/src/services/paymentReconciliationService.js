const paymentRepository = require("../repositories/paymentRepository");
const paymentService = require("./paymentService");

function sleep(milliseconds) {
return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function reconcileUnresolvedPayments(limit = 100) {
const payments =
await paymentRepository.findUnresolvedPayments(limit);

const results = [];

for (let index = 0; index < payments.length; index++) {
const payment = payments[index];


if (!payment.checkout_request_id) {
  results.push({
    paymentId: payment.id,
    status: payment.status,
    outcome: "requires_investigation",
    message:
      "No checkout request ID is available for a Safaricom status query.",
  });

  continue;
}

// Space out Safaricom API requests to reduce rate-limit errors.
if (index > 0) {
  await sleep(3000);
}

try {
  const queryResult =
    await paymentService.querySTKPushStatus(
      payment.checkout_request_id
    );

  const result = {
    paymentId: payment.id,
    checkoutRequestId: payment.checkout_request_id,
    currentStatus: payment.status,
  };

  if (queryResult.httpStatus === 429) {
    results.push({
      ...result,
      outcome: "rate_limited",
      message:
        "Safaricom rate-limited the query. Stop and try again later.",
    });

    // Do not send more requests after a rate-limit response.
    break;
  }

  if (
    queryResult.httpStatus < 200 ||
    queryResult.httpStatus >= 300
  ) {
    results.push({
      ...result,
      outcome: "query_inconclusive",
      httpStatus: queryResult.httpStatus,
      response: queryResult.data,
      message:
        "Safaricom did not return a successful query response. Payment status was not changed.",
    });

    continue;
  }

  results.push({
    ...result,
    outcome: "query_completed",
    response: queryResult.data,
    message:
      "Query response received. Verify its transaction result before changing the payment status.",
  });
} catch (error) {
  console.error("Payment reconciliation query failed:", {
    paymentId: payment.id,
    reason: error.message,
  });

  results.push({
    paymentId: payment.id,
    checkoutRequestId: payment.checkout_request_id,
    currentStatus: payment.status,
    outcome: "query_error",
    message: error.message,
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
