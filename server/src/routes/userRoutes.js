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

const router = express.Router();

// Public registration: tenants only
router.post(
"/",
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
userController.createUser
);

// Only administrators can view fundis
router.get(
"/fundis",
authenticateToken,
authorizeRole("admin"),
userController.getFundis
);

module.exports = router;
