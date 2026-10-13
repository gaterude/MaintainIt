
const express = require("express");

const maintenanceRequestController = require("../controllers/maintenanceRequestController");

const authenticateToken = require("../middleware/authMiddleware");

const authorizeRole = require("../middleware/authorizeRole");

const validateMaintenanceRequest = require("../middleware/validateMaintenanceRequest");

const router = express.Router();

// Create a maintenance request
router.post(
  "/",
  authenticateToken,
  authorizeRole("tenant"),
  validateMaintenanceRequest,
  maintenanceRequestController.createMaintenanceRequest
);

// Get the logged-in tenant's room and property details
router.get(
  "/my-room",
  authenticateToken,
  authorizeRole("tenant"),
  maintenanceRequestController.getTenantRoomDetails
);

// Get the logged-in tenant's maintenance requests
router.get(
  "/my-requests",
  authenticateToken,
  authorizeRole("tenant"),
  maintenanceRequestController.getTenantRequests
);

// Get pending maintenance requests (admin only)
router.get(
  "/pending",
  authenticateToken,
  authorizeRole("admin"),
  maintenanceRequestController.getPendingRequests
);
// Get all maintenance requests (admin only)

router.get(
  "/all",
  authenticateToken,
  authorizeRole("admin"),
  maintenanceRequestController.getAllRequests
);

// Get maintenance request details
router.get(
  "/:id",
  authenticateToken,
  maintenanceRequestController.getRequestDetails
);

module.exports = router;
