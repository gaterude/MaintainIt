const pool = require("../config/database");

async function findHistoryByRequestId(requestId) {
  const query = `
    SELECT
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

module.exports = {
  findHistoryByRequestId,
};