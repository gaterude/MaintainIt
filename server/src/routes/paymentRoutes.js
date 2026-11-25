const express = require("express");

const paymentController = require("../controllers/paymentController");
const adminPaymentController = require("../controllers/adminPaymentController");
const paymentRecoveryController = require("../controllers/paymentRecoveryController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/authorizeRole");
const { rateLimit } = require("express-rate-limit");

// Each status check calls Safaricom, so cap how often one address can do it.
const paymentCheckLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many status checks. Please wait a few minutes." },
});

const router = express.Router();

// Administrator-only unresolved M-Pesa payment review.
router.get(
  "/admin/unresolved",
  authenticateToken,
  authorizeRole("admin"),
  adminPaymentController.listUnresolvedMpesaPayments
);

// Existing M-Pesa payment initiation.
router.post(
  "/initiate",
  authenticateToken,
  authorizeRole("tenant", "admin"),
  paymentController.initiatePayment
);

// Check a waiting M-Pesa payment with Safaricom (payer or admin).
router.post(
  "/mpesa/:requestId/check",
  authenticateToken,
  paymentCheckLimiter,
  authorizeRole("tenant", "admin"),
  paymentRecoveryController.checkMpesaStatus
);

// Cancel a stuck M-Pesa attempt after 3 minutes (payer or admin).
router.post(
  "/mpesa/:requestId/cancel",
  authenticateToken,
  paymentCheckLimiter,
  authorizeRole("tenant", "admin"),
  paymentRecoveryController.cancelMpesaAttempt
);

// Initiate a cash payment.
router.post(
  "/cash/initiate",
  authenticateToken,
  authorizeRole("tenant", "admin"),
  paymentController.initiateCashPayment
);

// Confirm cash received (assigned fundi only).
router.post(
  "/cash/:paymentId/confirm",
  authenticateToken,
  authorizeRole("fundi"),
  paymentController.confirmCashPayment
);

// Existing public M-Pesa callback.
router.post(
  "/callback",
  paymentController.handleCallback
);

module.exports = router;