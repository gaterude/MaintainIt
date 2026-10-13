const express = require("express");

const maintenanceResponsibilityController = require("../controllers/maintenanceResponsibilityController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/authorizeRole");

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  maintenanceResponsibilityController.decideResponsibility
);

module.exports = router;