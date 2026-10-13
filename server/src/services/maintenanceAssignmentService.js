const pool = require("../config/database");

const maintenanceAssignmentRepository =
  require("../repositories/maintenanceAssignmentRepository");

const userRepository =
  require("../repositories/userRepository");

const maintenanceRequestRepository =
  require("../repositories/maintenanceRequestRepository");

const { sendSms } = require("./smsService");

async function verifyFundi(fundiId) {
  const query = `
    SELECT id
    FROM users
    WHERE id = $1
      AND role = 'fundi'
  `;

  const result = await pool.query(query, [fundiId]);

  return result.rows[0] || null;
}

async function assignFundi({
  requestId,
  fundiId,
  assignedBy,
}) {
  if (!requestId || !fundiId || !assignedBy) {
    throw new Error(
      "Request ID, fundi ID and admin ID are required"
    );
  }

  const fundi = await verifyFundi(fundiId);

  if (!fundi) {
    throw new Error(
      "Selected user is not a registered fundi"
    );
  }

  // Complete the assignment first.
  const result =
    await maintenanceAssignmentRepository.createAssignment({
      requestId,
      fundiId,
      assignedBy,
    });

  // Notify the fundi after the assignment succeeds.
  try {
    const [fundis, requestDetails] = await Promise.all([
      userRepository.findFundis(),
      maintenanceRequestRepository.findRequestDetails(
        requestId
      ),
    ]);

    const assignedFundi = fundis.find(
      (user) => user.id === fundiId
    );

    if (!assignedFundi || !assignedFundi.phone) {
      console.warn(
        `Fundi ${fundiId} has no phone number; SMS skipped.`
      );

      return result;
    }

    const issueTitle =
      requestDetails?.title || "Maintenance request";

    const roomNumber =
      requestDetails?.room_number || "Not specified";

    const propertyName =
      requestDetails?.property_name || "Property";

    const message =
      `MaintainIt: You have been assigned a maintenance job. ` +
      `Issue: ${issueTitle}. ` +
      `Property: ${propertyName}. ` +
      `Room: ${roomNumber}. Please log in to view the job details.`;

    await sendSms({
      phoneNumber: assignedFundi.phone,
      message,
    });

    console.log(
      `Assignment SMS notification processed for fundi ${fundiId}.`
    );
  } catch (error) {
    console.error(
      `Could not send assignment SMS to fundi ${fundiId}:`,
      error.message
    );
  }

  return result;
}

async function getFundiAssignments(fundiId) {
  return maintenanceAssignmentRepository.findAssignmentsByFundi(
    fundiId
  );
}

async function acceptJob({
  requestId,
  fundiId,
}) {
  return maintenanceAssignmentRepository.acceptAssignment(
    requestId,
    fundiId
  );
}

async function completeJob({
  requestId,
  fundiId,
}) {
  return maintenanceAssignmentRepository.completeAssignment(
    requestId,
    fundiId
  );
}

module.exports = {
  assignFundi,
  getFundiAssignments,
  acceptJob,
  completeJob,
};