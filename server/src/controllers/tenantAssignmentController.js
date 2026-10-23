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


const clientErrorMessages = [
  "Tenant and room are required.",
  "The selected tenant does not exist.",
  "The selected room does not exist.",
  "This tenant is already assigned to that room.",
];

const status = clientErrorMessages.includes(error.message)
  ? 400
  : 500;

return res.status(status).json({
  message:
    status === 400
      ? error.message
      : "Unable to assign tenant to room.",
});


}
}

module.exports = {
getAllTenants,
getAllRooms,
assignTenantToRoom,
};
