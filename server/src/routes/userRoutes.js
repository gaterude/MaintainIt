const express = require("express");

const userController = require("../controllers/userController");
const validateUser = require("../middleware/validateUser");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/authorizeRole");
const { rateLimit } = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

// Stops one address from mass-creating accounts
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many sign-ups from this address. Please try again later.",
  },
});

const router = express.Router();

// Public registration: tenants only
router.post(
  "/",
  signupLimiter,
  validateUser("tenant"),
  userController.createUser
);

// Public login
router.post("/login", loginLimiter, userController.loginUser);

// Protected registration: admins only
// Admins can register other admins and fundis
router.post(
  "/staff",
  authenticateToken,
  authorizeRole("admin"),
  validateUser("admin", "fundi"),
  userController.createStaffUser
);

// Only administrators can view fundis
router.get(
  "/fundis",
  authenticateToken,
  authorizeRole("admin"),
  userController.getFundis
);

module.exports = router;