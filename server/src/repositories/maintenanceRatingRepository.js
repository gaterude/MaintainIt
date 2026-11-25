const pool = require("../config/database");

async function findEligibleRequests(tenantUserId) {
  const result = await pool.query(
    `
    SELECT
      mr.id AS maintenance_request_id,
      mr.title,
      mr.description,
      ma.completed_at,
      ma.fundi_id,
      u.name AS fundi_name
    FROM maintenance_requests mr
    JOIN tenants t
      ON t.id = mr.tenant_id
    JOIN maintenance_assignments ma
      ON ma.maintenance_request_id = mr.id
    JOIN users u
      ON u.id = ma.fundi_id
    LEFT JOIN maintenance_ratings rating
      ON rating.maintenance_request_id = mr.id
    WHERE t.user_id = $1
      AND mr.status = 'completed'
      AND ma.completed_at IS NOT NULL
      AND rating.id IS NULL
    ORDER BY mr.updated_at DESC
    `,
    [tenantUserId]
  );

  return result.rows;
}

async function createRating({
  requestId,
  tenantUserId,
  score,
  comment,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `
      SELECT
        mr.id,
        mr.status,
        t.user_id
      FROM maintenance_requests mr
      JOIN tenants t
        ON t.id = mr.tenant_id
      WHERE mr.id = $1
        AND t.user_id = $2
      FOR UPDATE OF mr
      `,
      [requestId, tenantUserId]
    );

    if (requestResult.rows.length === 0) {
      const error = new Error(
        "Maintenance request not found"
      );
      error.code = "NOT_FOUND";
      throw error;
    }

    if (requestResult.rows[0].status !== "completed") {
      const error = new Error(
        "Only completed maintenance jobs can be rated"
      );
      error.code = "NOT_COMPLETED";
      throw error;
    }

    const assignmentResult = await client.query(
      `
      SELECT fundi_id, completed_at
      FROM maintenance_assignments
      WHERE maintenance_request_id = $1
        AND completed_at IS NOT NULL
      FOR UPDATE
      `,
      [requestId]
    );

    if (assignmentResult.rows.length === 0) {
      const error = new Error(
        "No completed fundi assignment exists for this request"
      );
      error.code = "INVALID_ASSIGNMENT";
      throw error;
    }

    const ratingResult = await client.query(
      `
      INSERT INTO maintenance_ratings (
        maintenance_request_id,
        score,
        comment
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        maintenance_request_id,
        score,
        comment,
        created_at
      `,
      [requestId, score, comment]
    );

    await client.query("COMMIT");

    return ratingResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findFeedbackByFundi(fundiId) {
  const result = await pool.query(
    `
    SELECT
      rating.id,
      rating.maintenance_request_id,
      rating.score,
      rating.comment,
      rating.created_at,
      mr.title,
      mr.room_id,
      r.room_number,
      p.name AS property_name
    FROM maintenance_ratings rating
    JOIN maintenance_requests mr
      ON mr.id = rating.maintenance_request_id
    JOIN maintenance_assignments ma
      ON ma.maintenance_request_id = mr.id
    JOIN rooms r
      ON r.id = mr.room_id
    JOIN properties p
      ON p.id = r.property_id
    WHERE ma.fundi_id = $1
      AND ma.completed_at IS NOT NULL
    ORDER BY rating.created_at DESC
    `,
    [fundiId]
  );

  return result.rows;
}

async function findFundiRatingSummary(fundiId) {
  const result = await pool.query(
    `
    SELECT
      COUNT(rating.id)::INTEGER AS total_ratings,
      ROUND(AVG(rating.score)::NUMERIC, 2) AS average_rating
    FROM maintenance_assignments ma
    LEFT JOIN maintenance_ratings rating
      ON rating.maintenance_request_id =
         ma.maintenance_request_id
    WHERE ma.fundi_id = $1
      AND ma.completed_at IS NOT NULL
    `,
    [fundiId]
  );

  return result.rows[0];
}

module.exports = {
  findEligibleRequests,
  createRating,
  findFeedbackByFundi,
  findFundiRatingSummary,
};
