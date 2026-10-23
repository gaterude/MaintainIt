const express = require("express");

const paymentController = require("../controllers/paymentController");

const authenticateToken = require("../middleware/authMiddleware");

const authorizeRole = require("../middleware/authorizeRole");

const router = express.Router();

// Existing M-Pesa payment initiation
router.post(
  "/initiate",
  authenticateToken,
  authorizeRole("tenant", "admin"),
  paymentController.initiatePayment
);

// Initiate a cash payment
router.post(
  "/cash/initiate",
  authenticateToken,
  authorizeRole("tenant", "admin"),
  paymentController.initiateCashPayment
);

// Confirm cash received (assigned fundi only)
router.post(
  "/cash/:paymentId/confirm",
  authenticateToken,
  authorizeRole("fundi"),
  paymentController.confirmCashPayment
);

// Existing public M-Pesa callback
router.post(
  "/callback",
  paymentController.handleCallback
);

module.exports = router;
