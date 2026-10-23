const maintenanceRequestService = require("../services/maintenanceRequestService");

async function createMaintenanceRequest(req, res) {
try {
const {
roomId,
description,
category,
priority,
} = req.body;


const request =
  await maintenanceRequestService.createMaintenanceRequest({
    userId: req.user.id,
    roomId,
    description,
    category,
    priority,
  });

return res.status(201).json({
  message: "Maintenance request created successfully",
  request,
});


} catch (error) {
console.error("Create maintenance request error:", error);


return res.status(400).json({
  message: error.message,
});


}
}

async function getTenantRequests(req, res) {
try {
const requests =
await maintenanceRequestService.getTenantRequests(req.user.id);


return res.status(200).json({
  requests,
});


} catch (error) {
console.error("Get tenant requests error:", error);


return res.status(400).json({
  message: error.message,
});


}
}

async function getTenantRoomDetails(req, res) {
try {
const roomDetails =
await maintenanceRequestService.getTenantRoomDetails(req.user.id);
console.log("Tenant room lookup user:", {
  userId: req.user?.id,
  role: req.user?.role,
});

if (!roomDetails) {
  return res.status(200).json({
    room: null,
  });
}

return res.status(200).json({
  room: roomDetails,
});


} catch (error) {
console.error("Get tenant room details error:", error);


return res.status(500).json({
  message: error.message,
});


}
}

async function getPendingRequests(req, res) {
try {
const requests =
await maintenanceRequestService.getPendingRequests();


return res.status(200).json({
  requests,
});


} catch (error) {
console.error("Get pending requests error:", error);


return res.status(500).json({
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
req.params.id,
req.user.id,
req.user.role
);


if (!request) {
  return res.status(404).json({
    message: "Maintenance request not found",
  });
}

return res.status(200).json({
  request,
});


} catch (error) {
console.error("Get request details error:", error);


if (error.statusCode === 403) {
  return res.status(403).json({
    message: "You are not authorized to view this request",
  });
}

return res.status(500).json({
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
