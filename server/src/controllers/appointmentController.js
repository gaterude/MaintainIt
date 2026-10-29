const appointmentService = require("../services/appointmentService");

function handleError(res, error, operation) {
  console.error(`${operation}:`, error.message);

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    message:
      statusCode === 500
        ? "An unexpected error occurred while processing the appointment."
        : error.message,
  });
}

async function proposeAppointment(req, res) {
  try {
    const appointment = await appointmentService.proposeAppointment({
      requestId: req.body.requestId,
      fundiId: req.user.id,
      proposedVisitAt: req.body.proposedVisitAt,
    });

    return res.status(201).json({
      message: "Appointment proposed successfully.",
      appointment,
    });
  } catch (error) {
    return handleError(res, error, "Propose appointment failed");
  }
}

async function getFundiAppointments(req, res) {
  try {
    const appointments =
      await appointmentService.getFundiAppointments(req.user.id);

    return res.status(200).json({ appointments });
  } catch (error) {
    return handleError(res, error, "Load fundi appointments failed");
  }
}

async function getTenantAppointments(req, res) {
  try {
    const appointments =
      await appointmentService.getTenantAppointments(req.user.id);

    return res.status(200).json({ appointments });
  } catch (error) {
    return handleError(res, error, "Load tenant appointments failed");
  }
}

async function respondToAppointment(req, res) {
  try {
    const appointment =
      await appointmentService.respondToAppointment({
        appointmentId: req.params.id,
        tenantUserId: req.user.id,
        response: req.body.response,
        note: req.body.note,
      });

    return res.status(200).json({
      message:
        req.body.response === "confirm"
          ? "Appointment confirmed successfully."
          : "Reschedule requested successfully.",
      appointment,
    });
  } catch (error) {
    return handleError(res, error, "Appointment response failed");
  }
}

async function rescheduleAppointment(req, res) {
  try {
    const appointment =
      await appointmentService.rescheduleAppointment({
        appointmentId: req.params.id,
        fundiId: req.user.id,
        proposedVisitAt: req.body.proposedVisitAt,
      });

    return res.status(200).json({
      message: "New appointment time proposed successfully.",
      appointment,
    });
  } catch (error) {
    return handleError(res, error, "Reschedule appointment failed");
  }
}

module.exports = {
  proposeAppointment,
  getFundiAppointments,
  getTenantAppointments,
  respondToAppointment,
  rescheduleAppointment,
};
