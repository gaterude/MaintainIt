const pool = require("../config/database");

async function createAppointment({
  requestId,
  fundiId,
  proposedVisitAt,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const assignmentResult = await client.query(
      `
      SELECT
        ma.maintenance_request_id,
        mr.tenant_id,
        mr.status AS request_status
      FROM maintenance_assignments ma
      JOIN maintenance_requests mr
        ON mr.id = ma.maintenance_request_id
      WHERE ma.maintenance_request_id = $1
        AND ma.fundi_id = $2
        AND ma.accepted_at IS NOT NULL
        AND ma.completed_at IS NULL
      FOR UPDATE OF ma, mr
      `,
      [requestId, fundiId]
    );

    if (assignmentResult.rows.length === 0) {
      throw new Error(
        "You can only schedule a visit for a job you have accepted and not completed"
      );
    }

    const assignment = assignmentResult.rows[0];

    if (assignment.request_status !== "in_progress") {
      throw new Error(
        "The maintenance request is not currently in progress"
      );
    }

    const result = await client.query(
      `
      INSERT INTO maintenance_appointments (
        maintenance_request_id,
        tenant_id,
        fundi_id,
        proposed_visit_at
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        requestId,
        assignment.tenant_id,
        fundiId,
        proposedVisitAt,
      ]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findAppointmentsByFundi(fundiId) {
  const result = await pool.query(
    `
    SELECT
      a.*,
      mr.title,
      mr.description,
      mr.status AS request_status,
      u.name AS tenant_name,
      u.phone AS tenant_phone,
      r.room_number,
      p.name AS property_name,
      p.address AS property_address
    FROM maintenance_appointments a
    JOIN maintenance_requests mr
      ON mr.id = a.maintenance_request_id
    JOIN tenants t
      ON t.id = a.tenant_id
    JOIN users u
      ON u.id = t.user_id
    JOIN rooms r
      ON r.id = mr.room_id
    JOIN properties p
      ON p.id = r.property_id
    WHERE a.fundi_id = $1
    ORDER BY a.proposed_visit_at ASC
    `,
    [fundiId]
  );

  return result.rows;
}

async function findAppointmentsByTenant(userId) {
  const result = await pool.query(
    `
    SELECT
      a.*,
      mr.title,
      mr.description,
      mr.status AS request_status,
      u.name AS fundi_name,
      r.room_number,
      p.name AS property_name,
      p.address AS property_address
    FROM maintenance_appointments a
    JOIN tenants t
      ON t.id = a.tenant_id
    JOIN users tenant_user
      ON tenant_user.id = t.user_id
    JOIN users u
      ON u.id = a.fundi_id
    JOIN maintenance_requests mr
      ON mr.id = a.maintenance_request_id
    JOIN rooms r
      ON r.id = mr.room_id
    JOIN properties p
      ON p.id = r.property_id
    WHERE tenant_user.id = $1
    ORDER BY a.proposed_visit_at ASC
    `,
    [userId]
  );

  return result.rows;
}

async function respondToAppointment({
  appointmentId,
  tenantUserId,
  response,
  note,
  expectedProposedVisitAt = null,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const appointmentResult = await client.query(
      `
      SELECT a.*
      FROM maintenance_appointments a
      JOIN tenants t
        ON t.id = a.tenant_id
      WHERE a.id = $1
        AND t.user_id = $2
        AND (
          $3::timestamptz IS NULL
          OR a.proposed_visit_at = $3::timestamptz
        )
      FOR UPDATE OF a
      `,
      [appointmentId, tenantUserId, expectedProposedVisitAt]
    );

    if (appointmentResult.rows.length === 0) {
      throw new Error("Appointment not found");
    }

    const appointment = appointmentResult.rows[0];

    if (
      !["pending_confirmation", "rescheduled"].includes(
        appointment.status
      )
    ) {
      throw new Error(
        "This appointment is not awaiting a tenant response"
      );
    }

    const status =
      response === "confirm"
        ? "confirmed"
        : "reschedule_requested";

    const result = await client.query(
      `
      UPDATE maintenance_appointments
      SET
        status = $1,
        tenant_response_at = NOW(),
        tenant_response_note = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [
        status,
        note || null,
        appointmentId,
      ]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function rescheduleAppointment({
  appointmentId,
  fundiId,
  proposedVisitAt,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const appointmentResult = await client.query(
      `
      SELECT *
      FROM maintenance_appointments
      WHERE id = $1
        AND fundi_id = $2
      FOR UPDATE
      `,
      [appointmentId, fundiId]
    );

    if (appointmentResult.rows.length === 0) {
      throw new Error("Appointment not found");
    }

    const appointment = appointmentResult.rows[0];

    if (
      !["reschedule_requested", "pending_confirmation"].includes(
        appointment.status
      )
    ) {
      throw new Error(
        "This appointment cannot currently be rescheduled"
      );
    }

    const result = await client.query(
      `
      UPDATE maintenance_appointments
      SET
        proposed_visit_at = $1,
        status = 'rescheduled',
        tenant_response_at = NULL,
        tenant_response_note = NULL,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [proposedVisitAt, appointmentId]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findAppointmentNotificationDetails(appointmentId) {
  const result = await pool.query(
    `
    SELECT
      a.id,
      a.maintenance_request_id,
      a.tenant_id,
      a.fundi_id,
      a.proposed_visit_at,
      a.status,
      t.whatsapp_opt_in,
      t.user_id AS tenant_user_id,
      u.name AS tenant_name,
      u.phone AS tenant_phone
    FROM maintenance_appointments a
    JOIN tenants t
      ON t.id = a.tenant_id
    JOIN users u
      ON u.id = t.user_id
    WHERE a.id = $1
    LIMIT 1
    `,
    [appointmentId]
  );

  return result.rows[0] || null;
}

async function findAppointmentForWhatsAppAction({
  appointmentId,
  senderPhones,
}) {
  if (!Array.isArray(senderPhones) || senderPhones.length === 0) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT
      a.*,
      t.user_id AS tenant_user_id,
      t.whatsapp_opt_in,
      u.phone AS tenant_phone
    FROM maintenance_appointments a
    JOIN tenants t
      ON t.id = a.tenant_id
    JOIN users u
      ON u.id = t.user_id
    WHERE a.id = $1
      AND t.whatsapp_opt_in = TRUE
      AND regexp_replace(
        COALESCE(u.phone, ''),
        '[^0-9]',
        '',
        'g'
      ) = ANY($2::text[])
    LIMIT 1
    `,
    [appointmentId, senderPhones]
  );

  return result.rows[0] || null;
}
module.exports = {
  findAppointmentNotificationDetails,
  findAppointmentForWhatsAppAction,createAppointment,
  findAppointmentsByFundi,
  findAppointmentsByTenant,
  respondToAppointment,
  rescheduleAppointment,
};
