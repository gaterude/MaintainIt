
const maintenanceRequestService = require("../services/maintenanceRequestService");

async function createMaintenanceRequest(req, res) {
  try {
    const {
      roomId,
      title,
      description,
    } = req.body;

    const request =
      await maintenanceRequestService.createMaintenanceRequest({
        userId: req.user.id,
        roomId,
        title,
        description,
      });

    res.status(201).json({
      message: "Maintenance request created successfully",
      request,
    });
  } catch (error) {
    console.error(
      "Create maintenance request error:",
      error
    );

    res.status(400).json({
      message: error.message,
    });
  }
}

async function getTenantRequests(req, res) {
  try {
    const requests =
      await maintenanceRequestService.getTenantRequests(
        req.user.id
      );

    res.status(200).json({
      requests,
    });
  } catch (error) {
    console.error(
      "Get tenant requests error:",
      error
    );

    res.status(400).json({
      message: error.message,
    });
  }
}

async function getTenantRoomDetails(req, res) {
  try {
    const roomDetails =
      await maintenanceRequestService.getTenantRoomDetails(
        req.user.id
      );

    res.status(200).json({
      room: roomDetails,
    });
  } catch (error) {
    console.error(
      "Get tenant room details error:",
      error
    );

    const statusCode =
      error.message === "Tenant profile not found"
        ? 404
        : 500;

    res.status(statusCode).json({
      message: error.message,
    });
  }
}

async function getPendingRequests(req, res) {
  try {
    const requests =
      await maintenanceRequestService.getPendingRequests();

    res.status(200).json({
      requests,
    });
  } catch (error) {
    console.error(
      "Get pending requests error:",
      error
    );

    res.status(500).json({
      message: "Failed to retrieve pending requests",
    });
  }
}
async function getAllRequests(req, res) {
  try {
    const requests =
      await maintenanceRequestService.getAllRequests();

    return res.status(200).json({
      requests,
    });
  } catch (error) {
    console.error("Get all maintenance requests error:", error);

    return res.status(500).json({
      message: "Failed to retrieve maintenance requests",
    });
  }
}
async function getRequestDetails(req, res) {
  try {
    const request =
      await maintenanceRequestService.getRequestDetails(
        req.params.id
      );

    if (!request) {
      return res.status(404).json({
        message: "Maintenance request not found",
      });
    }

    res.status(200).json({
      request,
    });
  } catch (error) {
    console.error(
      "Get request details error:",
      error
    );

    res.status(500).json({
      message: "Failed to retrieve maintenance request",
    });
  }
}

module.exports = {
  createMaintenanceRequest,
  getTenantRequests,
  getTenantRoomDetails,
  getPendingRequests,
  getAllRequests,
  getRequestDetails,
};