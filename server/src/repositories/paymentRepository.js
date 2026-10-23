const pool = require("../config/database");

async function createPayment({
  maintenanceRequestId,
  payerId,
  amountCents,
  paymentMethod = "mpesa",
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `SELECT id
       FROM maintenance_requests
       WHERE id = $1
       FOR UPDATE`,
      [maintenanceRequestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error("Maintenance request not found");
    }

    if (!["mpesa", "cash"].includes(paymentMethod)) {
      throw new Error("Unsupported payment method");
    }

    const activePaymentResult = await client.query(
      `SELECT id, status
       FROM payments
       WHERE maintenance_request_id = $1
         AND status IN ('pending', 'processing')
       LIMIT 1`,
      [maintenanceRequestId]
    );

    if (activePaymentResult.rows.length > 0) {
      const error = new Error(
        "A payment attempt already exists for this maintenance request. " +
          "Resolve its current status before trying again."
      );

      error.code = "PAYMENT_ATTEMPT_IN_PROGRESS";
      throw error;
    }

    const insertResult = await client.query(
      `INSERT INTO payments (
        maintenance_request_id,
        payer_id,
        amount_cents,
        status,
        payment_method
      )
      VALUES ($1, $2, $3, 'pending', $4)
      RETURNING *`,
      [
        maintenanceRequestId,
        payerId,
        amountCents,
        paymentMethod,
      ]
    );

    await client.query("COMMIT");

    return insertResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function attachCheckoutRequestId(
  paymentId,
  checkoutRequestId
) {
  const result = await pool.query(
    `UPDATE payments
     SET checkout_request_id = $1,
         status = 'processing',
         updated_at = NOW()
     WHERE id = $2
       AND status = 'pending'
       AND payment_method = 'mpesa'
     RETURNING *`,
    [checkoutRequestId, paymentId]
  );

  return result.rows[0] || null;
}

async function findPaymentByCheckoutRequestId(
  checkoutRequestId
) {
  const result = await pool.query(
    `SELECT *
     FROM payments
     WHERE checkout_request_id = $1`,
    [checkoutRequestId]
  );

  return result.rows[0] || null;
}

async function findUnresolvedPayments(limit = 100) {
  const safeLimit =
    Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 500)
      : 100;

  const result = await pool.query(
    `SELECT
       id,
       maintenance_request_id,
       payer_id,
       amount_cents,
       status,
       payment_method,
       checkout_request_id,
       created_at,
       updated_at
     FROM payments
     WHERE status IN ('pending', 'processing')
     ORDER BY created_at ASC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows;
}

async function markPaymentPaid({
  paymentId,
  transactionReference,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const paymentResult = await client.query(
      `UPDATE payments
       SET status = 'paid',
           transaction_reference = $1,
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
         AND status = 'processing'
         AND payment_method = 'mpesa'
       RETURNING *`,
      [transactionReference, paymentId]
    );

    if (paymentResult.rows.length === 0) {
      const existing = await client.query(
        `SELECT *
         FROM payments
         WHERE id = $1
         FOR UPDATE`,
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
  const result = await pool.query(
    `UPDATE payments
     SET status = 'failed',
         updated_at = NOW()
     WHERE id = $1
       AND status IN ('pending', 'processing')
     RETURNING *`,
    [paymentId]
  );

  return result.rows[0] || null;
}
async function confirmCashPayment({ paymentId, fundiId }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const paymentResult = await client.query(
      `SELECT
         p.id,
         p.maintenance_request_id,
         p.status,
         p.payment_method,
         mr.status AS request_status
       FROM payments p
       JOIN maintenance_requests mr
         ON mr.id = p.maintenance_request_id
       JOIN maintenance_assignments ma
         ON ma.maintenance_request_id = p.maintenance_request_id
       WHERE p.id = $1
         AND ma.fundi_id = $2
       FOR UPDATE OF p`,
      [paymentId, fundiId]
    );

    if (paymentResult.rows.length === 0) {
      throw new Error(
        "Payment not found or you are not assigned to this request"
      );
    }

    const payment = paymentResult.rows[0];

    if (payment.payment_method !== "cash") {
      throw new Error("This is not a cash payment");
    }

    if (payment.status !== "pending") {
      throw new Error("This payment has already been processed");
    }

    if (payment.request_status !== "completed") {
      throw new Error(
        "The maintenance request must be completed first"
      );
    }

    const transactionReference = `CASH-${payment.id}`;

    const updateResult = await client.query(
      `UPDATE payments
       SET status = 'paid',
           transaction_reference = $1,
           paid_at = NOW(),
           confirmed_by = $2,
           updated_at = NOW()
       WHERE id = $3
         AND status = 'pending'
         AND payment_method = 'cash'
       RETURNING *`,
      [transactionReference, fundiId, paymentId]
    );

    if (updateResult.rows.length === 0) {
      throw new Error("Cash payment could not be confirmed");
    }

    await client.query("COMMIT");

    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createPayment,
  attachCheckoutRequestId,
  findPaymentByCheckoutRequestId,
  findUnresolvedPayments,
  markPaymentPaid,
  markPaymentFailed,
  confirmCashPayment,
};