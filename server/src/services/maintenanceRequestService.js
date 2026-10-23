const maintenanceRequestRepository = require("../repositories/maintenanceRequestRepository");
const userRepository = require("../repositories/userRepository");
const { sendSms } = require("./smsService");

async function createMaintenanceRequest({
userId,
roomId,
description,
category,
priority = "medium",
}) {
const tenant =
await maintenanceRequestRepository.findTenantByUserAndRoom(
userId,
roomId
);

if (!tenant) {
throw new Error("Tenant is not assigned to this room");
}

const maintenanceRequest =
await maintenanceRequestRepository.createMaintenanceRequest({
tenantId: tenant.id,
roomId,
description,
category,
priority,
});

let requestDetails = null;

try {
requestDetails =
await maintenanceRequestRepository.findRequestDetails(
maintenanceRequest.id
);
} catch (error) {
console.error(
"Could not retrieve maintenance request details for SMS:",
error.message
);
}

const tenantName = requestDetails?.tenant_name || "A tenant";
const propertyName = requestDetails?.property_name || "Property";
const roomNumber = requestDetails?.room_number || roomId;
const requestCategory = requestDetails?.category || category;
const requestPriority = requestDetails?.priority || priority;
const issueDescription =
requestDetails?.description || description;

try {
const admins = await userRepository.findAdminUsers();

const message =
  `MaintainIt: New maintenance request. ` +
  `Priority: ${requestPriority.toUpperCase()}. ` +
  `Tenant: ${tenantName}. ` +
  `Property: ${propertyName}. ` +
  `Room: ${roomNumber}. ` +
  `Category: ${requestCategory}. ` +
  `Description: ${issueDescription}. Please review.`;

for (const admin of admins) {
  if (!admin.phone) {
    console.warn(
      `Admin ${admin.id} has no phone number; SMS skipped.`
    );
    continue;
  }

  try {
    await sendSms({
      phoneNumber: admin.phone,
      message,
    });
  } catch (error) {
    console.error(
      `Could not notify admin ${admin.id} by SMS:`,
      error.message
    );
  }
}

} catch (error) {
console.error(
"Could not retrieve admins for SMS notification:",
error.message
);
}

return maintenanceRequest;
}

async function getTenantRequests(userId) {
const tenant =
await maintenanceRequestRepository.findTenantByUserId(
userId
);

if (!tenant) {
return [];
}

return maintenanceRequestRepository.findRequestsByTenant(
tenant.id
);
}

async function getTenantRoomDetails(userId) {
const tenant =
await maintenanceRequestRepository.findTenantByUserId(
userId
);

if (!tenant) {
return null;
}

return {
tenantId: tenant.id,
roomId: tenant.room_id,
roomNumber: tenant.room_number,
propertyName: tenant.property_name,
propertyAddress: tenant.property_address,
};
}

async function getRequestById(requestId) {
return maintenanceRequestRepository.findRequestById(
requestId
);
}

async function getPendingRequests() {
return maintenanceRequestRepository.findPendingRequests();
}

async function getAllRequests() {
return maintenanceRequestRepository.findAllRequests();
}

async function getRequestDetails(
requestId,
userId,
userRole
) {
if (userRole === "admin") {
return maintenanceRequestRepository.findRequestDetails(
requestId
);
}

if (userRole === "tenant") {
const tenant =
await maintenanceRequestRepository.findTenantByUserId(
userId
);

```
if (!tenant) {
  return null;
}

const request =
  await maintenanceRequestRepository.findRequestDetails(
    requestId
  );

if (!request || request.tenant_id !== tenant.id) {
  return null;
}

return request;
```

}

const error = new Error(
"You are not authorized to view this request"
);

error.statusCode = 403;

throw error;
}

module.exports = {
createMaintenanceRequest,
getTenantRequests,
getTenantRoomDetails,
getRequestById,
getPendingRequests,
getAllRequests,
getRequestDetails,
};
