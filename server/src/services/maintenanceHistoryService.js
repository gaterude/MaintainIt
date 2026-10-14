const maintenanceHistoryRepository = require("../repositories/maintenanceHistoryRepository");

async function getRequestHistory(requestId, userId, role) {
const canAccess =
await maintenanceHistoryRepository.canUserAccessRequest(
requestId,
userId,
role
);

if (!canAccess) {
const error = new Error(
"You are not authorized to view this maintenance history"
);


error.statusCode = 403;

throw error;


}

return maintenanceHistoryRepository.findHistoryByRequestId(
requestId
);
}

module.exports = {
getRequestHistory,
};
