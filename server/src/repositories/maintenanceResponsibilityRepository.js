const pool = require("../config/database");

async function createResponsibility({
  requestId,
  responsibleParty,
  reason,
  repairCostCents,
  decidedBy,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `SELECT status
       FROM maintenance_requests
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error("Maintenance request not found");
    }

    if (requestResult.rows[0].status !== "pending") {
      throw new Error("Only pending requests can be reviewed");
    }

    const responsibilityResult = await client.query(
      `INSERT INTO maintenance_responsibilities (
        maintenance_request_id,
        responsible_party,
        reason,
        repair_cost_cents,
        decided_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        requestId,
        responsibleParty,
        reason,
        repairCostCents,
        decidedBy,
      ]
    );

    const updatedRequest = await client.query(
      `UPDATE maintenance_requests
       SET status = 'approved',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [requestId]
    );

    await client.query(
      `INSERT INTO maintenance_request_history (
        maintenance_request_id,
        changed_by,
        old_status,
        new_status,
        note
      )
      VALUES ($1, $2, $3, $4, $5)`,
      [
        requestId,
        decidedBy,
        "pending",
        "approved",
        `Responsibility assigned to ${responsibleParty}. Repair cost: ${repairCostCents / 100} KES. Reason: ${reason}`,
      ]
    );

    await client.query("COMMIT");

    return {
      responsibility: responsibilityResult.rows[0],
      request: updatedRequest.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function findResponsibilityByRequestId(requestId) {
  const result = await pool.query(
    `SELECT *
     FROM maintenance_responsibilities
     WHERE maintenance_request_id = $1`,
    [requestId]
  );

  return result.rows[0] || null;
}
module.exports = {
  createResponsibility,
  findResponsibilityByRequestId,
};
