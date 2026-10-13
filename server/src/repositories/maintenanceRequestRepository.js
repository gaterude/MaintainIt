const pool = require("../config/database");

async function createMaintenanceRequest({
  tenantId,
  roomId,
  title,
  description,
}) {
  const result = await pool.query(
    `
    INSERT INTO maintenance_requests (
      tenant_id,
      room_id,
      title,
      description
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [tenantId, roomId, title, description]
  );

  return result.rows[0];
}

async function findRequestsByTenant(tenantId) {
  const result = await pool.query(
    `
    SELECT
      mr.*,
      resp.responsible_party,
      resp.repair_cost_cents,
      latest_payment.status AS payment_status
    FROM maintenance_requests mr

    LEFT JOIN maintenance_responsibilities resp
      ON resp.maintenance_request_id = mr.id

    LEFT JOIN LATERAL (
      SELECT p.status
      FROM payments p
      WHERE p.maintenance_request_id = mr.id
      ORDER BY p.created_at DESC
      LIMIT 1
    ) latest_payment ON TRUE

    WHERE mr.tenant_id = $1
    ORDER BY mr.created_at DESC
    `,
    [tenantId]
  );

  return result.rows;
}

async function findRequestById(requestId) {
  const result = await pool.query(
    `
    SELECT *
    FROM maintenance_requests
    WHERE id = $1
    LIMIT 1
    `,
    [requestId]
  );

  return result.rows[0] || null;
}

async function findTenantByUserAndRoom(userId, roomId) {
  const result = await pool.query(
    `
    SELECT
      t.*,
      r.room_number,
      r.property_id,
      p.name AS property_name,
      p.address AS property_address
    FROM tenants t
    JOIN rooms r
      ON r.id = t.room_id
    JOIN properties p
      ON p.id = r.property_id
    WHERE t.user_id = $1
      AND t.room_id = $2
    LIMIT 1
    `,
    [userId, roomId]
  );

  return result.rows[0] || null;
}

async function findTenantByUserId(userId) {
  const result = await pool.query(
    `
    SELECT
      t.*,
      r.room_number,
      r.property_id,
      p.name AS property_name,
      p.address AS property_address
    FROM tenants t
    JOIN rooms r
      ON r.id = t.room_id
    JOIN properties p
      ON p.id = r.property_id
    WHERE t.user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function findPendingRequests() {
  const result = await pool.query(
    `
    SELECT
      mr.*,
      u.name AS tenant_name,
      u.email AS tenant_email,
      u.phone AS tenant_phone,
      r.room_number,
      p.name AS property_name,
      p.address AS property_address
    FROM maintenance_requests mr
    JOIN tenants t
      ON t.id = mr.tenant_id
    JOIN users u
      ON u.id = t.user_id
    JOIN rooms r
      ON r.id = mr.room_id
    JOIN properties p
      ON p.id = r.property_id
    WHERE mr.status = 'pending'
    ORDER BY mr.created_at DESC
    `
  );

  return result.rows;
}

// NEW: Retrieve all maintenance requests for the admin dashboard.
async function findAllRequests() {
  const result = await pool.query(
    `
    SELECT
      mr.*,
      u.name AS tenant_name,
      u.email AS tenant_email,
      u.phone AS tenant_phone,
      r.room_number,
      p.name AS property_name,
      p.address AS property_address,
      resp.responsible_party,
      resp.repair_cost_cents,
      latest_payment.status AS payment_status
    FROM maintenance_requests mr

    JOIN tenants t
      ON t.id = mr.tenant_id

    JOIN users u
      ON u.id = t.user_id

    JOIN rooms r
      ON r.id = mr.room_id

    JOIN properties p
      ON p.id = r.property_id

    LEFT JOIN maintenance_responsibilities resp
      ON resp.maintenance_request_id = mr.id

    LEFT JOIN LATERAL (
      SELECT pay.status
      FROM payments pay
      WHERE pay.maintenance_request_id = mr.id
      ORDER BY pay.created_at DESC
      LIMIT 1
    ) latest_payment ON TRUE

    ORDER BY mr.created_at DESC
    `
  );

  return result.rows;
}

async function findRequestDetails(requestId) {
  const result = await pool.query(
    `
    SELECT
      mr.*,
      u.name AS tenant_name,
      u.email AS tenant_email,
      u.phone AS tenant_phone,
      r.room_number,
      p.name AS property_name,
      p.address AS property_address
    FROM maintenance_requests mr
    JOIN tenants t
      ON t.id = mr.tenant_id
    JOIN users u
      ON u.id = t.user_id
    JOIN rooms r
      ON r.id = mr.room_id
    JOIN properties p
      ON p.id = r.property_id
    WHERE mr.id = $1
    LIMIT 1
    `,
    [requestId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createMaintenanceRequest,
  findRequestsByTenant,
  findRequestById,
  findTenantByUserAndRoom,
  findTenantByUserId,
  findPendingRequests,
  findAllRequests,
  findRequestDetails,
};