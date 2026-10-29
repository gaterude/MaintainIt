const express = require("express");

const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/authorizeRole");

const appointmentController = require("../controllers/appointmentController");

// Fundis propose and view appointments.
router.post(
  "/",
  authenticateToken,
  authorizeRole("fundi"),
  appointmentController.proposeAppointment
);

router.get(
  "/my-jobs",
  authenticateToken,
  authorizeRole("fundi"),
  appointmentController.getFundiAppointments
);

// Tenants view, confirm, or request rescheduling of appointments.
router.get(
  "/my-requests",
  authenticateToken,
  authorizeRole("tenant"),
  appointmentController.getTenantAppointments
);

router.post(
  "/:id/respond",
  authenticateToken,
  authorizeRole("tenant"),
  appointmentController.respondToAppointment
);

// Fundis propose a replacement time.
router.post(
  "/:id/reschedule",
  authenticateToken,
  authorizeRole("fundi"),
  appointmentController.rescheduleAppointment
);

module.exports = router;
