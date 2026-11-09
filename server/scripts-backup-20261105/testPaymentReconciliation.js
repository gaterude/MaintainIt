const assert = require("node:assert/strict");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});

const paymentRepository = require("../src/repositories/paymentRepository");
const paymentService = require("../src/services/paymentService");

const {
  reconcileUnresolvedPayments,
} = require("../src/services/paymentReconciliationService");

const originalFindUnresolved =
  paymentRepository.findUnresolvedPayments;

const originalMarkFailed =
  paymentRepository.markPaymentFailed;

const originalQuery =
  paymentService.querySTKPushStatus;

const CHECKOUT_ID = "TEST-CHECKOUT-123";
const PAYMENT_ID = "TEST-PAYMENT-123";

let testState = {};

function resetState(overrides = {}) {
  testState = {
    payment: {
      id: PAYMENT_ID,
      maintenance_request_id: "TEST-REQUEST-123",
      payer_id: "TEST-PAYER-123",
      amount_cents: 10000,
      status: "processing",
      payment_method: "mpesa",
      checkout_request_id: CHECKOUT_ID,
    },
    queryResultCode: 0,
    queryHttpStatus: 200,
    queryCalls: 0,
    failedCalls: 0,
    shouldRateLimit: false,
    ...overrides,
  };
}

paymentRepository.findUnresolvedPayments =
  async (limit) => {
    assert.equal(limit, 10);

    return [testState.payment];
  };

paymentRepository.markPaymentFailed =
  async (paymentId) => {
    testState.failedCalls++;

    assert.equal(paymentId, PAYMENT_ID);

    return {
      id: paymentId,
      status: "failed",
    };
  };

paymentService.querySTKPushStatus =
  async (checkoutRequestId) => {
    testState.queryCalls++;

    assert.equal(checkoutRequestId, CHECKOUT_ID);

    if (testState.shouldRateLimit) {
      const error = new Error("Simulated rate limit");
      error.httpStatus = 429;
      throw error;
    }

    return {
      httpStatus: testState.queryHttpStatus,
      data: {
        ResponseCode: "0",
        CheckoutRequestID: CHECKOUT_ID,
        ResultCode: String(testState.queryResultCode),
        ResultDesc: "Simulated Safaricom result",
      },
    };
  };

async function runTests() {
  // TEST 1: Safaricom confirms success.
  resetState({
    queryResultCode: 0,
  });

  let result = await reconcileUnresolvedPayments(10);

  assert.equal(result.checked, 1);
  assert.equal(
    result.results[0].outcome,
    "success_awaiting_receipt"
  );
  assert.equal(testState.failedCalls, 0);

  console.log(
    "PASS: Successful payment awaits receipt confirmation."
  );

  // TEST 2: Recognised Safaricom failure.
  resetState({
    queryResultCode: 1032,
  });

  result = await reconcileUnresolvedPayments(10);

  assert.equal(result.results[0].outcome, "failed");
  assert.equal(testState.failedCalls, 1);

  console.log(
    "PASS: Recognised failed payment marked failed."
  );

  // TEST 3: Unknown result code.
  resetState({
    queryResultCode: 9999,
  });

  result = await reconcileUnresolvedPayments(10);

  assert.equal(
    result.results[0].outcome,
    "failure_requires_verification"
  );
  assert.equal(testState.failedCalls, 0);

  console.log(
    "PASS: Unknown payment result preserved for review."
  );

  // TEST 4: Missing checkout reference.
  resetState({
    payment: {
      id: PAYMENT_ID,
      maintenance_request_id: "TEST-REQUEST-123",
      status: "pending",
      payment_method: "mpesa",
      checkout_request_id: null,
    },
  });

  result = await reconcileUnresolvedPayments(10);

  assert.equal(
    result.results[0].outcome,
    "requires_investigation"
  );
  assert.equal(testState.queryCalls, 0);
  assert.equal(testState.failedCalls, 0);

  console.log(
    "PASS: Missing checkout reference flagged for investigation."
  );

  // TEST 5: Safaricom rate limit.
  resetState({
    shouldRateLimit: true,
  });

  result = await reconcileUnresolvedPayments(10);

  assert.equal(
    result.results[0].outcome,
    "rate_limited"
  );
  assert.equal(testState.failedCalls, 0);

  console.log(
    "PASS: Rate-limited reconciliation handled safely."
  );

  console.log(
    "\nAll five payment reconciliation tests passed."
  );
}

runTests()
  .catch((error) => {
    console.error("\nTEST FAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    paymentRepository.findUnresolvedPayments =
      originalFindUnresolved;

    paymentRepository.markPaymentFailed =
      originalMarkFailed;

    paymentService.querySTKPushStatus =
      originalQuery;
  });