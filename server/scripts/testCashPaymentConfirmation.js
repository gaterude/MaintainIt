const assert = require("node:assert/strict");
const pool = require("../src/config/database");
const paymentRepository = require("../src/repositories/paymentRepository");

const originalConnect = pool.connect;

const PAYMENT_ID = "TEST-CASH-PAYMENT-123";
const FUNDI_ID = "TEST-FUNDI-123";

let state;

function resetState(overrides = {}) {
  state = {
    payment: {
      id: PAYMENT_ID,
      maintenance_request_id: "TEST-REQUEST-123",
      status: "pending",
      payment_method: "cash",
      request_status: "completed",
    },
    assigned: true,
    updateSucceeds: true,
    committed: false,
    rolledBack: false,
    released: false,
    queries: [],
    ...overrides,
  };
}

function createMockClient() {
  return {
    async query(sql, params = []) {
      const normalizedSql = sql.replace(/\s+/g, " ").trim();

      state.queries.push({
        sql: normalizedSql,
        params,
      });

      if (normalizedSql === "BEGIN") {
        return { rows: [] };
      }

      if (normalizedSql === "COMMIT") {
        state.committed = true;
        return { rows: [] };
      }

      if (normalizedSql === "ROLLBACK") {
        state.rolledBack = true;
        return { rows: [] };
      }

      if (normalizedSql.includes("FROM payments p")) {
        return {
          rows: state.assigned ? [state.payment] : [],
        };
      }

      if (normalizedSql.includes("UPDATE payments")) {
        if (!state.updateSucceeds) {
          return { rows: [] };
        }

        return {
          rows: [{
            ...state.payment,
            status: "paid",
            transaction_reference: `CASH-${PAYMENT_ID}`,
            confirmed_by: FUNDI_ID,
          }],
        };
      }

      throw new Error(`Unexpected SQL query: ${normalizedSql}`);
    },

    release() {
      state.released = true;
    },
  };
}

pool.connect = async () => createMockClient();

async function expectRejected(callback, expectedMessage) {
  await assert.rejects(
    callback,
    new RegExp(expectedMessage)
  );

  assert.equal(state.committed, false);
  assert.equal(state.rolledBack, true);
  assert.equal(state.released, true);
}

async function runTests() {
  // TEST 1: Assigned fundi confirms a completed cash payment.
  resetState();

  const result = await paymentRepository.confirmCashPayment({
    paymentId: PAYMENT_ID,
    fundiId: FUNDI_ID,
  });

  assert.equal(result.status, "paid");
  assert.equal(result.confirmed_by, FUNDI_ID);
  assert.equal(state.committed, true);
  assert.equal(state.rolledBack, false);
  assert.equal(state.released, true);

  console.log("PASS: Assigned fundi can confirm a cash payment.");

  // TEST 2: Unassigned fundi cannot confirm.
  resetState({
    assigned: false,
  });

  await expectRejected(
    () => paymentRepository.confirmCashPayment({
      paymentId: PAYMENT_ID,
      fundiId: FUNDI_ID,
    }),
    "Payment not found or you are not assigned"
  );

  console.log("PASS: Unassigned fundi cannot confirm payment.");

  // TEST 3: M-Pesa payment cannot be confirmed as cash.
  resetState({
    payment: {
      id: PAYMENT_ID,
      maintenance_request_id: "TEST-REQUEST-123",
      status: "pending",
      payment_method: "mpesa",
      request_status: "completed",
    },
  });

  await expectRejected(
    () => paymentRepository.confirmCashPayment({
      paymentId: PAYMENT_ID,
      fundiId: FUNDI_ID,
    }),
    "This is not a cash payment"
  );

  console.log("PASS: M-Pesa payment cannot be confirmed as cash.");

  // TEST 4: Previously processed payment cannot be confirmed again.
  resetState({
    payment: {
      id: PAYMENT_ID,
      maintenance_request_id: "TEST-REQUEST-123",
      status: "paid",
      payment_method: "cash",
      request_status: "completed",
    },
  });

  await expectRejected(
    () => paymentRepository.confirmCashPayment({
      paymentId: PAYMENT_ID,
      fundiId: FUNDI_ID,
    }),
    "This payment has already been processed"
  );

  console.log("PASS: Previously processed payment cannot be confirmed again.");

  // TEST 5: Incomplete maintenance request blocks confirmation.
  resetState({
    payment: {
      id: PAYMENT_ID,
      maintenance_request_id: "TEST-REQUEST-123",
      status: "pending",
      payment_method: "cash",
      request_status: "in_progress",
    },
  });

  await expectRejected(
    () => paymentRepository.confirmCashPayment({
      paymentId: PAYMENT_ID,
      fundiId: FUNDI_ID,
    }),
    "maintenance request must be completed"
  );

  console.log("PASS: Incomplete maintenance request blocks confirmation.");

  // TEST 6: Failed conditional update is rolled back.
  resetState({
    updateSucceeds: false,
  });

  await expectRejected(
    () => paymentRepository.confirmCashPayment({
      paymentId: PAYMENT_ID,
      fundiId: FUNDI_ID,
    }),
    "Cash payment could not be confirmed"
  );

  console.log("PASS: Failed payment update is rolled back.");

  console.log("\nAll six cash confirmation tests passed.");
}

runTests()
  .catch((error) => {
    console.error("\nTEST FAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.connect = originalConnect;
  });