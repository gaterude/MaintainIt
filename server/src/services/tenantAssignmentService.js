const tenantAssignmentRepository = require("../repositories/tenantAssignmentRepository");
const userRepository = require("../repositories/userRepository");
const emailService = require("./emailService");

async function getAllTenants() {
  return tenantAssignmentRepository.findAllTenants();
}

async function getAllRooms() {
  return tenantAssignmentRepository.findAllRooms();
}

async function assignTenantToRoom({ userId, roomId }) {
  if (!userId || !roomId) {
    throw new Error("Tenant and room are required.");
  }

  const tenant = await userRepository.findUserById(userId);

  if (!tenant || tenant.role !== "tenant") {
    throw new Error("The selected tenant does not exist.");
  }

  const room = await tenantAssignmentRepository.findAllRooms();
  const selectedRoom = room.find(
    (item) => String(item.room_id) === String(roomId)
  );

  if (!selectedRoom) {
    throw new Error("The selected room does not exist.");
  }

  // The repository re-checks capacity inside a transaction with the room locked,
  // so a full room is refused here even if two admins click at the same time.
  const assignment = await tenantAssignmentRepository.assignTenantToRoom(
    userId,
    roomId
  );

  emailService
    .sendRoomAssignmentNotification(tenant, selectedRoom)
    .catch((error) => {
      console.error("Room assignment email failed:", error.message);
    });

  return assignment;
}

// The tenant moves out: they keep their account and past requests but have no
// room until the admin assigns one again.
async function vacateTenant({ userId }) {
  if (!userId) {
    throw new Error("Tenant is required.");
  }

  const tenant = await userRepository.findUserById(userId);

  if (!tenant || tenant.role !== "tenant") {
    throw new Error("The selected tenant does not exist.");
  }

  return tenantAssignmentRepository.vacateTenant(userId);
}

module.exports = {
  getAllTenants,
  getAllRooms,
  assignTenantToRoom,
  vacateTenant,
};