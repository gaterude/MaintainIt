const assert = require("node:assert/strict");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});

// Test-only credentials. No real M-Pesa credentials are used.
process.env.MPESA_ENV = "sandbox";
process.env.MPESA_CONSUMER_KEY = "test-only-key";
process.env.MPESA_CONSUMER_SECRET = "test-only-secret";

const paymentRepository = require("../src/repositories/paymentRepository");
const paymentService = require("../src/services/paymentService");

const originalFetch = global.fetch;

const originalFindPayment =
  paymentRepository.findPaymentByCheckoutRequestId;

const originalMarkPaymentPaid =
  paymentRepository.markPaymentPaid;

const checkoutRequestId = "TEST-CHECKOUT-123";
const merchantRequestId = "TEST-MERCHANT-123";

const fakePayment = {
  id: "00000000-0000-4000-8000-000000000001",
  payment_method: "mpesa",
  status: "processing",
  amount_cents: 10000,
};

let markPaymentPaidCalls = 0;

function mockResponse(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  };
}

// Mock all network requests. No request reaches Safaricom.
global.fetch = async (url) => {
  const address = String(url);

  if (address.includes("/oauth/v1/generate")) {
    return mockResponse({
      access_token: "TEST-ONLY-ACCESS-TOKEN",
      expires_in: "3600",
    });
  }

  if (address.includes("/mpesa/stkpushquery/v1/query")) {
    return mockResponse({
      ResponseCode: "0",
      CheckoutRequestID: checkoutRequestId,
      MerchantRequestID: merchantRequestId,
      ResultCode: "0",
      ResultDesc: "Test payment successful",
    });
  }

  throw new Error(
    "Blocked unexpected network request during testing."
  );
};

// Mock database reads and writes.
paymentRepository.findPaymentByCheckoutRequestId =
  async (id) => {
    assert.equal(id, checkoutRequestId);
    return { ...fakePayment };
  };

paymentRepository.markPaymentPaid =
  async ({ paymentId, transactionReference }) => {
    markPaymentPaidCalls++;

    return {
      ...fakePayment,
      id: paymentId,
      status: "paid",
      transaction_reference: transactionReference,
    };
  };

function makeCallback({
  merchantId = merchantRequestId,
  resultCode = 0,
  amount = 100,
  includeReceipt = true,
} = {}) {
  const items = [
    {
      Name: "Amount",
      Value: amount,
    },
  ];

  if (includeReceipt) {
    items.push({
      Name: "MpesaReceiptNumber",
      Value: "TEST-RECEIPT-123",
    });
  }

  return {
    Body: {
      stkCallback: {
        MerchantRequestID: merchantId,
        CheckoutRequestID: checkoutRequestId,
        ResultCode: resultCode,
        CallbackMetadata: {
          Item: items,
        },
      },
    },
  };
}

async function runTests() {
  // TEST 1: A verified successful payment is accepted.
  const result = await paymentService.handleCallback(
    makeCallback()
  );

  assert.equal(result.status, "paid");
  assert.equal(markPaymentPaidCalls, 1);

  console.log(
    "PASS: Verified successful callback accepted."
  );

  // TEST 2: A mismatched result code is rejected.
  await assert.rejects(
    () =>
      paymentService.handleCallback(
        makeCallback({ resultCode: 1032 })
      ),
    /result does not match/
  );

  assert.equal(markPaymentPaidCalls, 1);

  console.log(
    "PASS: Mismatched result code rejected."
  );

  // TEST 3: A mismatched merchant request ID is rejected.
  await assert.rejects(
    () =>
      paymentService.handleCallback(
        makeCallback({
          merchantId: "DIFFERENT-MERCHANT-ID",
        })
      ),
    /merchant request ID does not match/
  );

  assert.equal(markPaymentPaidCalls, 1);

  console.log(
    "PASS: Mismatched merchant request ID rejected."
  );

  // TEST 4: An incorrect payment amount is rejected.
  await assert.rejects(
    () =>
      paymentService.handleCallback(
        makeCallback({ amount: 99 })
      ),
    /amount does not match/
  );

  assert.equal(markPaymentPaidCalls, 1);

  console.log(
    "PASS: Incorrect payment amount rejected."
  );

  // TEST 5: A missing M-Pesa receipt number is rejected.
  await assert.rejects(
    () =>
      paymentService.handleCallback(
        makeCallback({ includeReceipt: false })
      ),
    /transaction reference/
  );

  assert.equal(markPaymentPaidCalls, 1);

  console.log(
    "PASS: Missing M-Pesa receipt number rejected."
  );

  console.log(
    "PASS: No real payment records were modified."
  );
}

runTests()
  .catch((error) => {
    console.error("TEST FAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    paymentRepository.findPaymentByCheckoutRequestId =
      originalFindPayment;

    paymentRepository.markPaymentPaid =
      originalMarkPaymentPaid;

    global.fetch = originalFetch;
  });