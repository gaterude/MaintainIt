const express = require("express");

const tenantAssignmentController = require("../controllers/tenantAssignmentController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/authorizeRole");

const router = express.Router();

// All routes require an authenticated administrator.
router.use(authenticateToken);
router.use(authorizeRole("admin"));

// Get all registered tenants and their current room assignments.
router.get(
"/tenants",
tenantAssignmentController.getAllTenants
);

// Get rooms with their current tenant counts.
router.get(
"/rooms",
tenantAssignmentController.getAllRooms
);

// Assign a tenant to a room or change their room assignment.
router.post(
"/assign",
tenantAssignmentController.assignTenantToRoom
);

module.exports = router;
