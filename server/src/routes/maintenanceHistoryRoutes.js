const express = require("express");

const maintenanceHistoryController = require("../controllers/maintenanceHistoryController");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/:id",
  authenticateToken,
  maintenanceHistoryController.getRequestHistory
);

module.exports = router;