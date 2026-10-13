const express = require("express");

const paymentController = require("../controllers/paymentController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/authorizeRole");

const router = express.Router();

router.post(
  "/initiate",
  authenticateToken,
  authorizeRole("tenant", "admin"),
  paymentController.initiatePayment
);

router.post(
  "/callback",
  paymentController.handleCallback
);

module.exports = router;