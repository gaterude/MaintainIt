const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});

const pool = require("../src/config/database");
const paymentRepository = require("../src/repositories/paymentRepository");

async function verifyDuplicatePaymentProtection() {
  if (process.env.DB_NAME !== "maintainit") {
    throw new Error("Safety check failed: wrong database.");
  }

  const existingPayment = await pool.query(`
    SELECT maintenance_request_id, payer_id, amount_cents
    FROM payments
    WHERE status = 'paid'
    LIMIT 1
  `);

  if (existingPayment.rows.length === 0) {
    throw new Error("No paid payment found for this test.");
  }

  const payment = existingPayment.rows[0];

  const before = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM payments
     WHERE maintenance_request_id = $1`,
    [payment.maintenance_request_id]
  );

  try {
    await paymentRepository.createPayment({
      maintenanceRequestId: payment.maintenance_request_id,
      payerId: payment.payer_id,
      amountCents: payment.amount_cents,
      paymentMethod: "mpesa",
    });

    throw new Error("TEST FAILED: duplicate payment was accepted.");
  } catch (error) {
    if (error.code !== "PAYMENT_ATTEMPT_IN_PROGRESS") {
      throw error;
    }

    console.log("PASS: Application rejected the duplicate payment.");
    console.log(error.message);
  }

  const after = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM payments
     WHERE maintenance_request_id = $1`,
    [payment.maintenance_request_id]
  );

  if (before.rows[0].total !== after.rows[0].total) {
    throw new Error("TEST FAILED: payment record count changed.");
  }

  console.log("PASS: No additional payment record was created.");
}

verifyDuplicatePaymentProtection()
  .catch((error) => {
    console.error("Verification failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });