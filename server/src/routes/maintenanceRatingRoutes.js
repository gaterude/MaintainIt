const express = require("express");

const controller = require("../controllers/maintenanceRatingController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/authorizeRole");

const router = express.Router();

router.get(
  "/eligible",
  authenticateToken,
  authorizeRole("tenant"),
  controller.getEligibleRequests
);

router.post(
  "/",
  authenticateToken,
  authorizeRole("tenant"),
  controller.submitRating
);

router.get(
  "/my-feedback",
  authenticateToken,
  authorizeRole("fundi"),
  controller.getFundiFeedback
);

module.exports = router;
