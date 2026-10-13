const maintenanceHistoryRepository = require("../repositories/maintenanceHistoryRepository");

async function getRequestHistory(requestId) {
  return maintenanceHistoryRepository.findHistoryByRequestId(
    requestId
  );
}

module.exports = {
  getRequestHistory,
};