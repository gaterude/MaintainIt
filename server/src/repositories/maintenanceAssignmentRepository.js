const pool = require("../config/database");

async function createAssignment({
  requestId,
  fundiId,
  assignedBy,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestCheck = await client.query(
      `
      SELECT status
      FROM maintenance_requests
      WHERE id = $1
      FOR UPDATE
      `,
      [requestId]
    );

    if (requestCheck.rows.length === 0) {
      throw new Error(
        "Maintenance request not found"
      );
    }

    const currentStatus =
      requestCheck.rows[0].status;

    if (currentStatus !== "approved") {
      throw new Error(
        "Only approved maintenance requests can be assigned"
      );
    }

    const assignmentResult = await client.query(
      `
      INSERT INTO maintenance_assignments (
        maintenance_request_id,
        fundi_id,
        assigned_by
      )
      VALUES ($1, $2, $3)
      RETURNING *;
      `,
      [
        requestId,
        fundiId,
        assignedBy,
      ]
    );

    const requestResult = await client.query(
      `
      UPDATE maintenance_requests
      SET
        status = 'assigned',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
      `,
      [requestId]
    );

    await client.query(
      `
      INSERT INTO maintenance_request_history (
        maintenance_request_id,
        changed_by,
        old_status,
        new_status,
        note
      )
      VALUES ($1, $2, $3, $4, $5);
      `,
      [
        requestId,
        assignedBy,
        "approved",
        "assigned",
        "Maintenance request assigned to fundi",
      ]
    );

    await client.query("COMMIT");

    return {
      assignment: assignmentResult.rows[0],
      request: requestResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findAssignmentsByFundi(fundiId) {
  const query = `
    SELECT
      ma.id AS assignment_id,
      ma.maintenance_request_id,
      ma.assigned_at,
      ma.accepted_at,
      ma.completed_at,
      mr.title,
      mr.description,
      mr.status,
      r.room_number,
      p.name AS property_name,
      p.address AS property_address,
      latest_payment.id AS payment_id,
      latest_payment.status AS payment_status,
      latest_payment.payment_method AS payment_method
    FROM maintenance_assignments ma
    JOIN maintenance_requests mr
      ON mr.id = ma.maintenance_request_id
    JOIN rooms r
      ON r.id = mr.room_id
    JOIN properties p
      ON p.id = r.property_id
    LEFT JOIN LATERAL (
      SELECT
        pay.id,
        pay.status,
        pay.payment_method
      FROM payments pay
      WHERE pay.maintenance_request_id = mr.id
      ORDER BY pay.created_at DESC
      LIMIT 1
    ) latest_payment ON TRUE
    WHERE ma.fundi_id = $1
    ORDER BY ma.assigned_at DESC;
  `;

  const result = await pool.query(query, [fundiId]);

  return result.rows;
}



async function findAssignmentByRequestAndFundi(
  requestId,
  fundiId
) {
  const query = `
    SELECT *
    FROM maintenance_assignments
    WHERE maintenance_request_id = $1
      AND fundi_id = $2
  `;

  const result = await pool.query(query, [
    requestId,
    fundiId,
  ]);

  return result.rows[0] || null;
}

async function acceptAssignment(
  requestId,
  fundiId
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const assignmentResult = await client.query(
      `
      UPDATE maintenance_assignments
      SET accepted_at = NOW()
      WHERE maintenance_request_id = $1
        AND fundi_id = $2
        AND accepted_at IS NULL
      RETURNING *;
      `,
      [
        requestId,
        fundiId,
      ]
    );

    if (assignmentResult.rows.length === 0) {
      throw new Error(
        "Assignment not found or job has already been accepted"
      );
    }

    const requestResult = await client.query(
      `
      UPDATE maintenance_requests
      SET
        status = 'in_progress',
        updated_at = NOW()
      WHERE id = $1
        AND status = 'assigned'
      RETURNING *;
      `,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error(
        "Maintenance request is not available for acceptance"
      );
    }

    await client.query(
      `
      INSERT INTO maintenance_request_history (
        maintenance_request_id,
        changed_by,
        old_status,
        new_status,
        note
      )
      VALUES ($1, $2, $3, $4, $5);
      `,
      [
        requestId,
        fundiId,
        "assigned",
        "in_progress",
        "Fundi accepted the maintenance job",
      ]
    );

    await client.query("COMMIT");

    return requestResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function completeAssignment(
  requestId,
  fundiId
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const assignmentResult = await client.query(
      `
      UPDATE maintenance_assignments
      SET completed_at = NOW()
      WHERE maintenance_request_id = $1
        AND fundi_id = $2
        AND accepted_at IS NOT NULL
        AND completed_at IS NULL
      RETURNING *;
      `,
      [
        requestId,
        fundiId,
      ]
    );

    if (assignmentResult.rows.length === 0) {
      throw new Error(
        "Assignment not found or job has not been accepted"
      );
    }

    const requestResult = await client.query(
      `
      UPDATE maintenance_requests
      SET
        status = 'completed',
        updated_at = NOW()
      WHERE id = $1
        AND status = 'in_progress'
      RETURNING *;
      `,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error(
        "Maintenance request is not in progress"
      );
    }

    await client.query(
      `
      INSERT INTO maintenance_request_history (
        maintenance_request_id,
        changed_by,
        old_status,
        new_status,
        note
      )
      VALUES ($1, $2, $3, $4, $5);
      `,
      [
        requestId,
        fundiId,
        "in_progress",
        "completed",
        "Fundi marked the maintenance job as completed",
      ]
    );

    await client.query("COMMIT");

    return requestResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createAssignment,
  findAssignmentsByFundi,
  findAssignmentByRequestAndFundi,
  acceptAssignment,
  completeAssignment,
};