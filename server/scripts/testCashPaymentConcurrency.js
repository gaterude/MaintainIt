const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});

// Force the test database before importing the database pool.
process.env.DB_NAME = "maintainit_migration_test";

const pool = require("../src/config/database");
const paymentRepository = require("../src/repositories/paymentRepository");

const ADMIN_ID = "cc340f24-84f1-47f9-9756-4e0ee79db9db";

async function runTest() {
  assert.equal(
    pool.options.database,
    "maintainit_migration_test",
    "Safety check failed: refusing to run against a different database."
  );

  const suffix = crypto.randomUUID().replace(/-/g, "");
  const tenantEmail = `cash-test-tenant-${suffix}@example.invalid`;
  const fundiEmail = `cash-test-fundi-${suffix}@example.invalid`;

  const tenantPhone = `+2547${suffix.slice(0, 8)}`;
  const fundiPhone = `+2547${suffix.slice(8, 16)}`;

  let tenantUserId;
  let fundiId;
  let propertyId;
  let roomId;
  let tenantId;
  let requestId;
  let paymentId;

  const setupClient = await pool.connect();

  try {
    await setupClient.query("BEGIN");

    const adminResult = await setupClient.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'admin'",
      [ADMIN_ID]
    );

    assert.equal(
      adminResult.rows.length,
      1,
      "Expected test admin account was not found."
    );

    const tenantUserResult = await setupClient.query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'tenant')
       RETURNING id`,
      ["Concurrency Test Tenant", tenantEmail, tenantPhone, "test-only-hash"]
    );

    tenantUserId = tenantUserResult.rows[0].id;

    const fundiResult = await setupClient.query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'fundi')
       RETURNING id`,
      ["Concurrency Test Fundi", fundiEmail, fundiPhone, "test-only-hash"]
    );

    fundiId = fundiResult.rows[0].id;

    const propertyResult = await setupClient.query(
      `INSERT INTO properties (name, address)
       VALUES ($1, $2)
       RETURNING id`,
      [`Concurrency Test Property ${suffix}`, "Test-only address"]
    );

    propertyId = propertyResult.rows[0].id;

    const roomResult = await setupClient.query(
      `INSERT INTO rooms (property_id, room_number)
       VALUES ($1, $2)
       RETURNING id`,
      [propertyId, `TEST-${suffix.slice(0, 8)}`]
    );

    roomId = roomResult.rows[0].id;

    const tenantResult = await setupClient.query(
      `INSERT INTO tenants (user_id, room_id)
       VALUES ($1, $2)
       RETURNING id`,
      [tenantUserId, roomId]
    );

    tenantId = tenantResult.rows[0].id;

    const requestResult = await setupClient.query(
      `INSERT INTO maintenance_requests
         (tenant_id, room_id, description, status, category, priority)
       VALUES ($1, $2, $3, 'completed', 'other', 'medium')
       RETURNING id`,
      [tenantId, roomId, "Temporary cash confirmation concurrency test"]
    );

    requestId = requestResult.rows[0].id;

    await setupClient.query(
      `INSERT INTO maintenance_assignments
         (maintenance_request_id, fundi_id, assigned_by)
       VALUES ($1, $2, $3)`,
      [requestId, fundiId, ADMIN_ID]
    );

    const paymentResult = await setupClient.query(
      `INSERT INTO payments
         (maintenance_request_id, payer_id, amount_cents, status, payment_method)
       VALUES ($1, $2, $3, 'pending', 'cash')
       RETURNING id`,
      [requestId, tenantUserId, 150000]
    );

    paymentId = paymentResult.rows[0].id;

    await setupClient.query("COMMIT");

    console.log("Temporary test records created.");
    console.log("Starting two simultaneous cash confirmations...");

    const results = await Promise.allSettled([
      paymentRepository.confirmCashPayment({
        paymentId,
        fundiId,
      }),
      paymentRepository.confirmCashPayment({
        paymentId,
        fundiId,
      }),
    ]);

    const successful = results.filter(
      (result) => result.status === "fulfilled"
    );

    const rejected = results.filter(
      (result) => result.status === "rejected"
    );

    assert.equal(
      successful.length,
      1,
      "Expected exactly one confirmation to succeed."
    );

    assert.equal(
      rejected.length,
      1,
      "Expected the second confirmation to be rejected."
    );

    const finalPaymentResult = await pool.query(
      `SELECT status, payment_method, transaction_reference, confirmed_by
       FROM payments
       WHERE id = $1`,
      [paymentId]
    );

    assert.equal(finalPaymentResult.rows.length, 1);

    const finalPayment = finalPaymentResult.rows[0];

    assert.equal(finalPayment.status, "paid");
    assert.equal(finalPayment.payment_method, "cash");
    assert.equal(finalPayment.transaction_reference, `CASH-${paymentId}`);
    assert.equal(finalPayment.confirmed_by, fundiId);

    console.log("\nPASS: Exactly one simultaneous confirmation succeeded.");
    console.log("PASS: The other confirmation was rejected.");
    console.log("PASS: The payment is recorded as paid only once.");
    console.log("PASS: The assigned fundi is recorded as the confirmer.");
    console.log("\nConcurrency test passed.");

  } catch (error) {
    try {
      await setupClient.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Setup rollback failed:", rollbackError.message);
    }

    throw error;

  } finally {
    setupClient.release();

    try {
      if (paymentId) {
        await pool.query("DELETE FROM payments WHERE id = $1", [paymentId]);
      }

      if (requestId) {
        await pool.query(
          "DELETE FROM maintenance_requests WHERE id = $1",
          [requestId]
        );
      }

      if (tenantId) {
        await pool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      }

      if (roomId) {
        await pool.query("DELETE FROM rooms WHERE id = $1", [roomId]);
      }

      if (propertyId) {
        await pool.query("DELETE FROM properties WHERE id = $1", [propertyId]);
      }

      if (tenantUserId) {
        await pool.query("DELETE FROM users WHERE id = $1", [tenantUserId]);
      }

      if (fundiId) {
        await pool.query("DELETE FROM users WHERE id = $1", [fundiId]);
      }

      console.log("Temporary test records cleaned up.");
    } catch (cleanupError) {
      console.error("WARNING: Test cleanup needs attention:");
      console.error(cleanupError.message);
    }

    await pool.end();
  }
}

runTest().catch((error) => {
  console.error("\nConcurrency test failed:");
  console.error(error.message);
  process.exitCode = 1;
});
