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
         AND status IN ('pending', 'processing', 'paid')
       LIMIT 1`,
      [maintenanceRequestId]
    );

    if (activePaymentResult.rows.length > 0) {
      const existingPayment = activePaymentResult.rows[0];

      const error = new Error(
        existingPayment.status === "paid"
          ? "This maintenance request has already been paid."
          : "A payment attempt already exists for this maintenance request. " +
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
       AND payment_method = 'mpesa'
     ORDER BY created_at ASC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows;
}
async function findUnresolvedMpesaPaymentsForAdmin(limit = 100) {
  const safeLimit =
    Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 500)
      : 100;

  const result = await pool.query(
    `SELECT
       p.id AS payment_id,
       p.maintenance_request_id,
       p.amount_cents,
       p.status AS payment_status,
       p.payment_method,
       p.checkout_request_id,
       p.transaction_reference,
       p.created_at,
       p.updated_at,

       FLOOR(
         EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 60
       )::integer AS age_minutes,

       mr.title AS request_title,
       mr.category AS request_category,
       mr.description AS request_description,
       mr.status AS request_status,

       tenant_user.name AS tenant_name,
       tenant_user.email AS tenant_email,
       tenant_user.phone AS tenant_phone,

       payer_user.name AS payer_name,

       r.room_number,
       prop.name AS property_name

     FROM payments p

     JOIN maintenance_requests mr
       ON mr.id = p.maintenance_request_id

     LEFT JOIN tenants t
       ON t.id = mr.tenant_id

     LEFT JOIN users tenant_user
       ON tenant_user.id = t.user_id

     LEFT JOIN users payer_user
       ON payer_user.id = p.payer_id

     LEFT JOIN rooms r
       ON r.id = mr.room_id

     LEFT JOIN properties prop
       ON prop.id = r.property_id

     WHERE p.payment_method = 'mpesa'
       AND p.status IN ('pending', 'processing')

     ORDER BY p.created_at ASC
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
       AND payment_method = 'mpesa'
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
  findUnresolvedMpesaPaymentsForAdmin,
  markPaymentPaid,
  markPaymentFailed,
  confirmCashPayment,
};

