const pool = require("../config/database");

async function createMaintenanceRequest({
tenantId,
roomId,
description,
category,
priority = "medium",
}) {
const result = await pool.query(
`     INSERT INTO maintenance_requests (
      tenant_id,
      room_id,
      description,
      category,
      priority
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
[
tenantId,
roomId,
description,
category,
priority,
]
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
latest_payment.status AS payment_status,
latest_payment.payment_method AS payment_method
FROM maintenance_requests mr


LEFT JOIN maintenance_responsibilities resp
  ON resp.maintenance_request_id = mr.id

LEFT JOIN LATERAL (
  SELECT
    p.status,
    p.payment_method
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
`     SELECT *
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

ORDER BY
  CASE mr.priority
    WHEN 'urgent' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
    ELSE 4
  END,
  mr.created_at DESC
`


);

return result.rows;
}

async function findAllRequests() {
const result = await pool.query(
`
WITH request_deadlines AS (
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
latest_payment.status AS payment_status,
latest_payment.payment_method AS payment_method,
ma.assigned_at,
ma.accepted_at,


    CASE
      WHEN mr.status = 'approved'
        THEN mr.created_at

      WHEN mr.status = 'assigned'
        THEN COALESCE(ma.assigned_at, mr.updated_at)

      WHEN mr.status = 'in_progress'
        THEN COALESCE(
          ma.accepted_at,
          ma.assigned_at,
          mr.updated_at
        )

      ELSE NULL
    END AS deadline_reference

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

  LEFT JOIN maintenance_assignments ma
    ON ma.maintenance_request_id = mr.id

  LEFT JOIN LATERAL (
    SELECT
      pay.status,
      pay.payment_method
    FROM payments pay
    WHERE pay.maintenance_request_id = mr.id
    ORDER BY pay.created_at DESC
    LIMIT 1
  ) latest_payment ON TRUE
)

SELECT
  *,

  CASE
    WHEN priority = 'urgent' THEN
      deadline_reference + INTERVAL '24 hours'

    WHEN priority = 'low' THEN
      deadline_reference + INTERVAL '7 days'

    ELSE
      deadline_reference + INTERVAL '3 days'
  END AS deadline_at,

  CASE
    WHEN status IN ('approved', 'assigned', 'in_progress')
      AND deadline_reference IS NOT NULL
      AND NOW() >= deadline_reference +
        CASE
          WHEN priority = 'urgent' THEN INTERVAL '24 hours'
          WHEN priority = 'low' THEN INTERVAL '7 days'
          ELSE INTERVAL '3 days'
        END
    THEN TRUE
    ELSE FALSE
  END AS is_overdue,

  CASE
    WHEN status IN ('approved', 'assigned', 'in_progress')
      AND deadline_reference IS NOT NULL
      AND NOW() >= deadline_reference +
        CASE
          WHEN priority = 'urgent' THEN INTERVAL '24 hours'
          WHEN priority = 'low' THEN INTERVAL '7 days'
          ELSE INTERVAL '3 days'
        END
    THEN deadline_reference +
      CASE
        WHEN priority = 'urgent' THEN INTERVAL '24 hours'
        WHEN priority = 'low' THEN INTERVAL '7 days'
        ELSE INTERVAL '3 days'
      END
    ELSE NULL
  END AS overdue_since

FROM request_deadlines

ORDER BY
  CASE priority
    WHEN 'urgent' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
    ELSE 4
  END,
  created_at DESC
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
