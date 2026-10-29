const appointmentRepository = require("../repositories/appointmentRepository");
const whatsappService = require("./whatsappService");

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireId(value, fieldName) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw createError(`${fieldName} is required`);
  }

  return value.trim();
}

function validateFutureVisit(value) {
  if (
    typeof value !== "string" &&
    !(value instanceof Date)
  ) {
    throw createError("A proposed visit date and time are required");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError("The proposed visit date and time are invalid");
  }

  if (date.getTime() <= Date.now()) {
    throw createError("The proposed visit date and time must be in the future");
  }

  return date.toISOString();
}

function normalizeRepositoryError(error) {
  if (error.statusCode) {
    return error;
  }

  const message = error.message || "";

  if (message.includes("not found")) {
    return createError(message, 404);
  }

  if (
    message.includes("only schedule") ||
    message.includes("not available for this fundi")
  ) {
    return createError(message, 403);
  }

  if (
    message.includes("confirmed appointment is required") ||
    message.includes("not currently in progress") ||
    message.includes("not awaiting a tenant response") ||
    message.includes("cannot currently be rescheduled") ||
    message.includes("already been accepted")
  ) {
    return createError(message, 409);
  }

  return error;
}


async function notifyAppointment(appointmentId) {
  try {
    const appointment =
      await appointmentRepository.findAppointmentNotificationDetails(
        appointmentId
      );

    if (!appointment || appointment.whatsapp_opt_in !== true) {
      return;
    }

    const result = await whatsappService.sendAppointmentProposal({
      phoneNumber: appointment.tenant_phone,
      tenantName: appointment.tenant_name,
      appointmentId: appointment.id,
      proposedVisitAt: appointment.proposed_visit_at,
      optedIn: appointment.whatsapp_opt_in === true,
    });

    if (!result.sent) {
      console.info(
        "WhatsApp appointment notification skipped:",
        result.reason
      );
    }
  } catch (error) {
    // Notification failures must not undo a saved appointment.
    console.error(
      "WhatsApp appointment notification failed:",
      error.message
    );
  }
}
async function proposeAppointment({
  requestId,
  fundiId,
  proposedVisitAt,
}) {
  const validatedRequestId = requireId(requestId, "Request ID");
  const validatedFundiId = requireId(fundiId, "Fundi ID");
  const validatedVisitAt = validateFutureVisit(proposedVisitAt);

  try {
    const appointment = await appointmentRepository.createAppointment({
      requestId: validatedRequestId,
      fundiId: validatedFundiId,
      proposedVisitAt: validatedVisitAt,
    });

    await notifyAppointment(appointment.id);

    return appointment;
  } catch (error) {
    throw normalizeRepositoryError(error);
  }
}

async function getFundiAppointments(fundiId) {
  const validatedFundiId = requireId(fundiId, "Fundi ID");

  return appointmentRepository.findAppointmentsByFundi(
    validatedFundiId
  );
}

async function getTenantAppointments(userId) {
  const validatedUserId = requireId(userId, "User ID");

  return appointmentRepository.findAppointmentsByTenant(
    validatedUserId
  );
}

function validateExpectedVisit(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError("The expected appointment date is invalid.");
  }

  return date.toISOString();
}
async function respondToAppointment({
  appointmentId,
  tenantUserId,
  response,
  note,
  expectedProposedVisitAt = null,
}) {
  const validatedAppointmentId = requireId(
    appointmentId,
    "Appointment ID"
  );

  const validatedTenantUserId = requireId(
    tenantUserId,
    "Tenant user ID"
  );

  if (!["confirm", "reschedule"].includes(response)) {
    throw createError(
      'Response must be either "confirm" or "reschedule"'
    );
  }

  if (note !== undefined && note !== null && typeof note !== "string") {
    throw createError("The response note must be text");
  }

  const trimmedNote = typeof note === "string" ? note.trim() : "";

  if (trimmedNote.length > 1000) {
    throw createError("The response note cannot exceed 1000 characters");
  }

  try {
    return await appointmentRepository.respondToAppointment({
      appointmentId: validatedAppointmentId,
      tenantUserId: validatedTenantUserId,
      response,
      note: trimmedNote || null,
      expectedProposedVisitAt:
        expectedProposedVisitAt === null ||
        expectedProposedVisitAt === undefined
          ? null
          : validateExpectedVisit(expectedProposedVisitAt),
    });
  } catch (error) {
    throw normalizeRepositoryError(error);
  }
}

async function rescheduleAppointment({
  appointmentId,
  fundiId,
  proposedVisitAt,
}) {
  const validatedAppointmentId = requireId(
    appointmentId,
    "Appointment ID"
  );

  const validatedFundiId = requireId(fundiId, "Fundi ID");
  const validatedVisitAt = validateFutureVisit(proposedVisitAt);

  try {
    const appointment = await appointmentRepository.rescheduleAppointment({
      appointmentId: validatedAppointmentId,
      fundiId: validatedFundiId,
      proposedVisitAt: validatedVisitAt,
    });

    await notifyAppointment(appointment.id);

    return appointment;
  } catch (error) {
    throw normalizeRepositoryError(error);
  }
}

module.exports = {
  proposeAppointment,
  getFundiAppointments,
  getTenantAppointments,
  respondToAppointment,
  rescheduleAppointment,
};
