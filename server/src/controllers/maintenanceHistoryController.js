const maintenanceHistoryService = require("../services/maintenanceHistoryService");

async function getRequestHistory(req, res) {
  try {
    const history =
      await maintenanceHistoryService.getRequestHistory(
        req.params.id
      );

    res.status(200).json({
      history,
    });
  } catch (error) {
    console.error(
      "Get request history error:",
      error
    );

    res.status(500).json({
      message: "Failed to retrieve request history",
    });
  }
}

module.exports = {
  getRequestHistory,
};