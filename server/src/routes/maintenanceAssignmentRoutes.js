const express = require("express");

const maintenanceAssignmentController = require("../controllers/maintenanceAssignmentController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/authorizeRole");

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  maintenanceAssignmentController.assignFundi
);

router.get(
  "/my-jobs",
  authenticateToken,
  authorizeRole("fundi"),
  maintenanceAssignmentController.getFundiAssignments
);

router.post(
  "/accept",
  authenticateToken,
  authorizeRole("fundi"),
  maintenanceAssignmentController.acceptJob
);

router.post(
  "/complete",
  authenticateToken,
  authorizeRole("fundi"),
  maintenanceAssignmentController.completeJob
);

module.exports = router;