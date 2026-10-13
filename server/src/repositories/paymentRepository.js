const pool = require("../config/database");

async function createPayment({
  maintenanceRequestId,
  payerId,
  amountCents,
}) {
  const query = `
    INSERT INTO payments (
      maintenance_request_id,
      payer_id,
      amount_cents,
      status,
      payment_method
    )
    VALUES ($1, $2, $3, 'pending', 'mpesa')
    RETURNING *;
  `;

  const result = await pool.query(query, [
    maintenanceRequestId,
    payerId,
    amountCents,
  ]);

  return result.rows[0];
}

async function attachCheckoutRequestId(
  paymentId,
  checkoutRequestId
) {
  const query = `
    UPDATE payments
    SET
      checkout_request_id = $1,
      status = 'processing',
      updated_at = NOW()
    WHERE id = $2
      AND status = 'pending'
    RETURNING *;
  `;

  const result = await pool.query(query, [
    checkoutRequestId,
    paymentId,
  ]);

  return result.rows[0] || null;
}

async function findPaymentByCheckoutRequestId(
  checkoutRequestId
) {
  const query = `
    SELECT *
    FROM payments
    WHERE checkout_request_id = $1;
  `;

  const result = await pool.query(query, [
    checkoutRequestId,
  ]);

  return result.rows[0] || null;
}

async function markPaymentPaid({
  paymentId,
  transactionReference,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const paymentResult = await client.query(
      `
      UPDATE payments
      SET
        status = 'paid',
        transaction_reference = $1,
        paid_at = NOW(),
        updated_at = NOW()
      WHERE id = $2
        AND status = 'processing'
      RETURNING *;
      `,
      [transactionReference, paymentId]
    );

    if (paymentResult.rows.length === 0) {
      const existing = await client.query(
        `
        SELECT *
        FROM payments
        WHERE id = $1
        FOR UPDATE;
        `,
        [paymentId]
      );

      await client.query("COMMIT");

      return existing.rows[0] || null;
    }

    await client.query("COMMIT");

    return paymentResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function markPaymentFailed(paymentId) {
  const query = `
    UPDATE payments
    SET
      status = 'failed',
      updated_at = NOW()
    WHERE id = $1
      AND status IN ('pending', 'processing')
    RETURNING *;
  `;

  const result = await pool.query(query, [paymentId]);

  return result.rows[0] || null;
}

module.exports = {
  createPayment,
  attachCheckoutRequestId,
  findPaymentByCheckoutRequestId,
  markPaymentPaid,
  markPaymentFailed,
};
