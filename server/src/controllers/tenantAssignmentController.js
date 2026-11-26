const tenantAssignmentService = require("../services/tenantAssignmentService");

async function getAllTenants(req, res) {
  try {
    const tenants = await tenantAssignmentService.getAllTenants();

    return res.status(200).json({ tenants });
  } catch (error) {
    console.error("Get tenants error:", error);

    return res.status(500).json({
      message: "Unable to retrieve tenants.",
    });
  }
}

async function getAllRooms(req, res) {
  try {
    const rooms = await tenantAssignmentService.getAllRooms();

    return res.status(200).json({ rooms });
  } catch (error) {
    console.error("Get rooms error:", error);

    return res.status(500).json({
      message: "Unable to retrieve rooms.",
    });
  }
}

const clientErrorMessages = [
  "Tenant and room are required.",
  "Tenant is required.",
  "The selected tenant does not exist.",
  "The selected room does not exist.",
  "This tenant is already assigned to that room.",
];

// Errors with a `status` come from the repository (room full = 409, not found
// = 404). Known messages are 400. Anything else is a generic 500.
function sendError(res, error, fallbackMessage) {
  const status = error.status
    ? error.status
    : clientErrorMessages.includes(error.message)
      ? 400
      : 500;

  return res.status(status).json({
    message: status === 500 ? fallbackMessage : error.message,
  });
}

async function assignTenantToRoom(req, res) {
  try {
    const { userId, roomId } = req.body;

    const tenant = await tenantAssignmentService.assignTenantToRoom({
      userId,
      roomId,
    });

    return res.status(200).json({
      message: "Tenant assigned to room successfully.",
      tenant,
    });
  } catch (error) {
    console.error("Assign tenant to room error:", error);

    return sendError(res, error, "Unable to assign tenant to room.");
  }
}

async function vacateTenant(req, res) {
  try {
    const { userId } = req.body;

    await tenantAssignmentService.vacateTenant({ userId });

    return res.status(200).json({
      message: "Tenant vacated. They are now waiting for a room.",
    });
  } catch (error) {
    console.error("Vacate tenant error:", error);

    return sendError(res, error, "Unable to vacate the tenant.");
  }
}

module.exports = {
  getAllTenants,
  getAllRooms,
  assignTenantToRoom,
  vacateTenant,
};