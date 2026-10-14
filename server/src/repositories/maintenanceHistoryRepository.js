const pool = require("../config/database");

async function findHistoryByRequestId(requestId) {
const query = `     SELECT
      h.*,
      u.name AS changed_by_name,
      u.role AS changed_by_role
    FROM maintenance_request_history h
    JOIN users u
      ON u.id = h.changed_by
    WHERE h.maintenance_request_id = $1
    ORDER BY h.created_at ASC;
  `;

const result = await pool.query(query, [requestId]);

return result.rows;
}

async function canUserAccessRequest(requestId, userId, role) {
if (role === "admin") {
const result = await pool.query(
`       SELECT id
      FROM maintenance_requests
      WHERE id = $1
      LIMIT 1;
      `,
[requestId]
);


return result.rows.length > 0;


}

if (role === "tenant") {
const result = await pool.query(
`       SELECT mr.id
      FROM maintenance_requests mr
      JOIN tenants t
        ON t.id = mr.tenant_id
      WHERE mr.id = $1
        AND t.user_id = $2
      LIMIT 1;
      `,
[requestId, userId]
);


return result.rows.length > 0;


}

if (role === "fundi") {
const result = await pool.query(
`       SELECT mr.id
      FROM maintenance_requests mr
      JOIN maintenance_assignments ma
        ON ma.maintenance_request_id = mr.id
      WHERE mr.id = $1
        AND ma.fundi_id = $2
      LIMIT 1;
      `,
[requestId, userId]
);


return result.rows.length > 0;

}

return false;
}

module.exports = {
findHistoryByRequestId,
canUserAccessRequest,
};
