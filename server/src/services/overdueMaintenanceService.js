const pool = require("../config/database");
const { sendSms } = require("./smsService");

let isRunning = false;

const MAX_ATTEMPTS = 3;

// Deadlines are based on priority.
const PRIORITY_DEADLINES = {
  urgent: "24 hours",
  medium: "3 days",
  low: "7 days",
};

async function findOverdueRequests() {
  const query = `
    SELECT
      mr.id,
      mr.title,
      mr.status,
      mr.priority,
      mr.created_at,

      ma.assigned_at,
      ma.accepted_at,

      CASE
        WHEN mr.status = 'approved'
          THEN mr.created_at

        WHEN mr.status = 'assigned'
          THEN COALESCE(
            ma.assigned_at,
            mr.updated_at
          )

        WHEN mr.status = 'in_progress'
          THEN COALESCE(
            ma.accepted_at,
            ma.assigned_at,
            mr.updated_at
          )
      END AS deadline_reference,

      CASE
        WHEN mr.status = 'approved'
          THEN 'unassigned_overdue'

        WHEN mr.status = 'assigned'
          THEN 'unaccepted_overdue'

        WHEN mr.status = 'in_progress'
          THEN 'in_progress_overdue'
      END AS alert_type

    FROM maintenance_requests mr

    LEFT JOIN maintenance_assignments ma
      ON ma.maintenance_request_id = mr.id

    WHERE mr.status IN (
      'approved',
      'assigned',
      'in_progress'
    )

    AND (
      CASE
        WHEN mr.priority = 'urgent'
          THEN INTERVAL '24 hours'

        WHEN mr.priority = 'low'
          THEN INTERVAL '7 days'

        ELSE INTERVAL '3 days'
      END
    ) <= (
      NOW() - CASE
        WHEN mr.status = 'approved'
          THEN mr.created_at

        WHEN mr.status = 'assigned'
          THEN COALESCE(
            ma.assigned_at,
            mr.updated_at
          )

        WHEN mr.status = 'in_progress'
          THEN COALESCE(
            ma.accepted_at,
            ma.assigned_at,
            mr.updated_at
          )
      END
    )

    ORDER BY mr.created_at ASC;
  `;

  const result = await pool.query(query);

  return result.rows;
}

async function getAdmins() {
  const query = `
    SELECT id, name, phone
    FROM users
    WHERE role = 'admin'
      AND phone IS NOT NULL
      AND phone <> ''
  `;

  const result = await pool.query(query);

  return result.rows;
}

async function createOrGetAlert({
  requestId,
  adminId,
  adminPhone,
  alertType,
}) {
  const query = `
    INSERT INTO maintenance_overdue_alerts (
      maintenance_request_id,
      recipient_user_id,
      recipient_phone,
      alert_type,
      status
    )
    VALUES ($1, $2, $3, $4, 'pending')

    ON CONFLICT (
      maintenance_request_id,
      recipient_user_id,
      alert_type
    )
    DO NOTHING;
  `;

  await pool.query(query, [
    requestId,
    adminId,
    adminPhone,
    alertType,
  ]);

  const result = await pool.query(
    `
      SELECT *
      FROM maintenance_overdue_alerts
      WHERE maintenance_request_id = $1
        AND recipient_user_id = $2
        AND alert_type = $3
      LIMIT 1
    `,
    [requestId, adminId, alertType]
  );

  return result.rows[0] || null;
}

async function markAttempt(alertId) {
  await pool.query(
    `
      UPDATE maintenance_overdue_alerts
      SET attempts = attempts + 1,
          last_attempt_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [alertId]
  );
}

async function markSent(alertId) {
  await pool.query(
    `
      UPDATE maintenance_overdue_alerts
      SET status = 'sent',
          sent_at = NOW(),
          last_error = NULL,
          updated_at = NOW()
      WHERE id = $1
    `,
    [alertId]
  );
}

async function markFailed(alertId, error) {
  await pool.query(
    `
      UPDATE maintenance_overdue_alerts
      SET status = 'failed',
          last_error = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [alertId, String(error.message || error).slice(0, 2000)]
  );
}

function buildAlertMessage(request) {
  const title =
    request.title && request.title.trim()
      ? request.title.trim()
      : "Maintenance request";

  const priority = request.priority || "medium";

  return (
    `MaintainIt Alert: ${title} is overdue. ` +
    `Status: ${request.status}. ` +
    `Priority: ${priority}. ` +
    `Please log in to MaintainIt to review this request.`
  );
}

async function processAlert(request, admin) {
  const alert = await createOrGetAlert({
    requestId: request.id,
    adminId: admin.id,
    adminPhone: admin.phone,
    alertType: request.alert_type,
  });

  if (!alert) {
    console.error(
      `Could not create or retrieve alert for request ${request.id}.`
    );

    return;
  }

  // Do not resend successful alerts or exceed the retry limit.
  if (
    alert.status === "sent" ||
    alert.attempts >= MAX_ATTEMPTS
  ) {
    return;
  }

  await markAttempt(alert.id);

  try {
    const response = await sendSms({
      phoneNumber: admin.phone,
      message: buildAlertMessage(request),
    });

    // Africa's Talking may return HTTP success even when an
    // individual recipient's SMS was not accepted.
    const recipients =
      response?.SMSMessageData?.Recipients;

    if (
      Array.isArray(recipients) &&
      (
        recipients.length === 0 ||
        recipients.some(
          (recipient) =>
            Number(recipient.statusCode) !== 101
        )
      )
    ) {
      throw new Error(
        "Africa's Talking did not confirm successful SMS delivery."
      );
    }

    await markSent(alert.id);

    console.log(
      JSON.stringify({
        event: "overdue_alert_sent",
        requestId: request.id,
        adminId: admin.id,
        alertType: request.alert_type,
      })
    );
  } catch (error) {
    await markFailed(alert.id, error);

    console.error(
      JSON.stringify({
        event: "overdue_alert_failed",
        requestId: request.id,
        adminId: admin.id,
        alertType: request.alert_type,
        error: error.message,
      })
    );
  }
}

async function checkOverdueMaintenance() {
  if (isRunning) {
    console.log(
      "Overdue maintenance check skipped: previous run is still active."
    );

    return;
  }

  isRunning = true;

  const startedAt = Date.now();

  try {
    console.log(
      JSON.stringify({
        event: "overdue_check_started",
        timestamp: new Date().toISOString(),
      })
    );

    const [requests, admins] = await Promise.all([
      findOverdueRequests(),
      getAdmins(),
    ]);

    if (requests.length === 0) {
      console.log(
        "Overdue maintenance check completed: no overdue requests."
      );

      return;
    }

    if (admins.length === 0) {
      console.warn(
        "Overdue maintenance check found requests, but no admin has a phone number."
      );

      return;
    }

    let alertsProcessed = 0;

    for (const request of requests) {
      for (const admin of admins) {
        await processAlert(request, admin);
        alertsProcessed++;
      }
    }

    console.log(
      JSON.stringify({
        event: "overdue_check_completed",
        overdueRequests: requests.length,
        alertsProcessed,
        durationMs: Date.now() - startedAt,
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "overdue_check_error",
        error: error.message,
        durationMs: Date.now() - startedAt,
      })
    );
  } finally {
    isRunning = false;
  }
}

module.exports = {
  checkOverdueMaintenance,
};