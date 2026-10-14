const maintenanceHistoryService = require("../services/maintenanceHistoryService");

async function getRequestHistory(req, res) {
try {
const history =
await maintenanceHistoryService.getRequestHistory(
req.params.id,
req.user.id,
req.user.role
);


return res.status(200).json({
  history,
});


} catch (error) {
console.error("Get request history error:", error);


if (error.statusCode === 403) {
  return res.status(403).json({
    message: error.message,
  });
}

return res.status(500).json({
  message: "Failed to retrieve request history",
});


}
}

module.exports = {
getRequestHistory,
};
