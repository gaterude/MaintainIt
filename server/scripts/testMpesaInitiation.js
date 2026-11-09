const assert = require("node:assert/strict");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});

// Test-only credentials.
process.env.MPESA_ENV = "sandbox";
process.env.MPESA_CONSUMER_KEY = "test-only-key";
process.env.MPESA_CONSUMER_SECRET = "test-only-secret";
process.env.MPESA_SHORTCODE = "174379";
process.env.MPESA_PASSKEY = "TEST-ONLY-PASSKEY";
process.env.MPESA_CALLBACK_URL =
  "https://example.invalid/api/payments/callback";

const pool = require("../src/config/database");

const paymentRepository = require("../src/repositories/paymentRepository");
const requestRepository = require("../src/repositories/maintenanceRequestRepository");
const responsibilityRepository = require("../src/repositories/maintenanceResponsibilityRepository");
const paymentService = require("../src/services/paymentService");

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const TENANT_ID = "00000000-0000-4000-8000-000000000002";
const PAYER_ID = "00000000-0000-4000-8000-000000000003";
const PAYMENT_ID = "00000000-0000-4000-8000-000000000004";

const PHONE_NUMBER = "254712345678";
const REPAIR_COST_CENTS = 250000;

const originalFetch = global.fetch;
const originalPoolQuery = pool.query;

const originalFindRequest =
  requestRepository.findRequestById;

const originalFindResponsibility =
  responsibilityRepository.findResponsibilityByRequestId;

const originalCreatePayment =
  paymentRepository.createPayment;

const originalAttachCheckout =
  paymentRepository.attachCheckoutRequestId;

const originalMarkFailed =
  paymentRepository.markPaymentFailed;

const state = {};

function resetState(overrides = {}) {
  Object.assign(
    state,
    {
      requestStatus: "completed",
      responsibleParty: "tenant",
      repairCostCents: REPAIR_COST_CENTS,
      tenantExists: true,
      stkMode: "success",
      attachMode: "success",

      createCalls: 0,
      attachCalls: 0,
      failedCalls: 0,
      stkCalls: 0,

      createArguments: null,
      attachArguments: null,
      stkRequestBody: null,
    },
    overrides
  );
}

function mockResponse({
  data,
  ok = true,
  status = 200,
}) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

// Mock all network requests.
global.fetch = async (url, options = {}) => {
  const address = String(url);

  if (address.includes("/oauth/v1/generate")) {
    return mockResponse({
      data: {
        access_token: "TEST-ONLY-ACCESS-TOKEN",
        expires_in: "3600",
      },
    });
  }

  if (address.includes("/mpesa/stkpush/v1/processrequest")) {
    state.stkCalls++;
    state.stkRequestBody = JSON.parse(options.body);

    if (state.stkMode === "network_error") {
      throw new Error("Simulated network timeout");
    }

    if (state.stkMode === "rejected") {
      return mockResponse({
        ok: false,
        status: 400,
        data: {
          ResponseCode: "1",
          ResponseDescription: "Simulated STK rejection",
        },
      });
    }

    if (state.stkMode === "missing_checkout") {
      return mockResponse({
        data: {
          ResponseCode: "0",
          ResponseDescription: "Accepted",
        },
      });
    }

    return mockResponse({
      data: {
        ResponseCode: "0",
        ResponseDescription: "Success",
        MerchantRequestID: "TEST-MERCHANT-123",
        CheckoutRequestID: "TEST-CHECKOUT-123",
        CustomerMessage: "Test payment request accepted",
      },
    });
  }

  throw new Error(
    "Blocked unexpected network request during testing."
  );
};

// Mock maintenance request lookup.
requestRepository.findRequestById = async (requestId) => {
  assert.equal(requestId, REQUEST_ID);

  return {
    id: REQUEST_ID,
    tenant_id: TENANT_ID,
    status: state.requestStatus,
  };
};

// Mock responsibility lookup.
responsibilityRepository.findResponsibilityByRequestId =
  async (requestId) => {
    assert.equal(requestId, REQUEST_ID);

    return {
      responsible_party: state.responsibleParty,
      repair_cost_cents: state.repairCostCents,
    };
  };

// Mock database permission checks.
pool.query = async (sql) => {
  if (sql.includes("FROM tenants")) {
    return {
      rows: state.tenantExists
        ? [{ id: TENANT_ID }]
        : [],
    };
  }

  throw new Error(
    "Unexpected database query during test: " + sql
  );
};

// Mock payment creation.
paymentRepository.createPayment = async (arguments_) => {
  state.createCalls++;
  state.createArguments = arguments_;

  return {
    id: PAYMENT_ID,
    maintenance_request_id: REQUEST_ID,
    payer_id: PAYER_ID,
    amount_cents: REPAIR_COST_CENTS,
    status: "pending",
    payment_method: "mpesa",
  };
};

// Mock checkout reference attachment.
paymentRepository.attachCheckoutRequestId =
  async (paymentId, checkoutRequestId) => {
    state.attachCalls++;

    state.attachArguments = {
      paymentId,
      checkoutRequestId,
    };

    // Simulate a database update that returns no payment row.
    if (state.attachMode === "missing_update") {
      return null;
    }

    return {
      id: paymentId,
      maintenance_request_id: REQUEST_ID,
      amount_cents: REPAIR_COST_CENTS,
      status: "processing",
      payment_method: "mpesa",
      checkout_request_id: checkoutRequestId,
    };
  };

// Mock failure recording.
paymentRepository.markPaymentFailed = async (paymentId) => {
  state.failedCalls++;

  return {
    id: paymentId,
    status: "failed",
  };
};

async function initiateTestPayment() {
  return paymentService.initiatePayment({
    requestId: REQUEST_ID,
    payerId: PAYER_ID,
    phoneNumber: PHONE_NUMBER,
  });
}

async function runTests() {
  // TEST 1: Successful payment initiation.
  resetState();

  const result = await initiateTestPayment();

  assert.equal(result.payment.status, "processing");
  assert.equal(
    result.payment.checkout_request_id,
    "TEST-CHECKOUT-123"
  );

  assert.equal(state.createCalls, 1);
  assert.equal(state.attachCalls, 1);
  assert.equal(state.failedCalls, 0);

  assert.equal(
    state.createArguments.amountCents,
    REPAIR_COST_CENTS
  );

  assert.equal(
    state.stkRequestBody.Amount,
    REPAIR_COST_CENTS / 100
  );

  assert.equal(
    state.stkRequestBody.PhoneNumber,
    PHONE_NUMBER
  );

  assert.equal(
    state.attachArguments.checkoutRequestId,
    "TEST-CHECKOUT-123"
  );

  console.log(
    "PASS: Successful M-Pesa initiation recorded."
  );

  // TEST 2: An incomplete maintenance request is rejected.
  resetState({
    requestStatus: "in_progress",
  });

  await assert.rejects(
    () => initiateTestPayment(),
    /Payment can only be initiated after the repair is completed/
  );

  assert.equal(state.createCalls, 0);
  assert.equal(state.stkCalls, 0);

  console.log(
    "PASS: Payment rejected for an incomplete repair."
  );

  // TEST 3: An unrelated tenant cannot initiate payment.
  resetState({
    tenantExists: false,
  });

  await assert.rejects(
    () => initiateTestPayment(),
    /Only the tenant responsible for this repair can initiate its payment/
  );

  assert.equal(state.createCalls, 0);
  assert.equal(state.stkCalls, 0);

  console.log(
    "PASS: Unauthorised tenant payment rejected."
  );

  // TEST 4: Safaricom rejects the STK request.
  resetState({
    stkMode: "rejected",
  });

  await assert.rejects(
    () => initiateTestPayment(),
    /Simulated STK rejection/
  );

  assert.equal(state.createCalls, 1);
  assert.equal(state.failedCalls, 1);

  console.log(
    "PASS: Rejected STK request marked failed."
  );

  // TEST 5: Network timeout creates an uncertain outcome.
  resetState({
    stkMode: "network_error",
  });

  await assert.rejects(
    () => initiateTestPayment(),
    (error) => error.paymentOutcomeUncertain === true
  );

  assert.equal(state.createCalls, 1);
  assert.equal(state.failedCalls, 0);
  assert.equal(state.attachCalls, 0);

  console.log(
    "PASS: Uncertain network outcome preserved for reconciliation."
  );

  // TEST 6: Accepted request without a checkout ID.
  resetState({
    stkMode: "missing_checkout",
  });

  await assert.rejects(
    () => initiateTestPayment(),
    (error) => error.paymentOutcomeUncertain === true
  );

  assert.equal(state.createCalls, 1);
  assert.equal(state.failedCalls, 0);
  assert.equal(state.attachCalls, 0);

  console.log(
    "PASS: Missing checkout ID preserved for investigation."
  );

  // TEST 7: Safaricom accepts the request, but the
  // database does not return the updated payment record.
  resetState({
    attachMode: "missing_update",
  });

  await assert.rejects(
    () => initiateTestPayment(),
    (error) =>
      error.paymentOutcomeUncertain === true &&
      error.code === "PAYMENT_OUTCOME_UNCERTAIN"
  );

  assert.equal(state.createCalls, 1);
  assert.equal(state.stkCalls, 1);
  assert.equal(state.attachCalls, 1);
  assert.equal(state.failedCalls, 0);

  console.log(
    "PASS: Missing checkout-reference update preserved as uncertain."
  );

  console.log("\nAll seven M-Pesa initiation tests passed.");
  console.log(
    "PASS: No real Safaricom payments or database records were created."
  );
}

runTests()
  .catch((error) => {
    console.error("\nTEST FAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    requestRepository.findRequestById =
      originalFindRequest;

    responsibilityRepository.findResponsibilityByRequestId =
      originalFindResponsibility;

    paymentRepository.createPayment =
      originalCreatePayment;

    paymentRepository.attachCheckoutRequestId =
      originalAttachCheckout;

    paymentRepository.markPaymentFailed =
      originalMarkFailed;

    pool.query = originalPoolQuery;
    global.fetch = originalFetch;

    await pool.end().catch(() => {});
  });