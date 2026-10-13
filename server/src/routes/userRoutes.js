const express = require("express");

const userController = require("../controllers/userController");
const validateUser = require("../middleware/validateUser");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/authorizeRole");

const router = express.Router();

router.post("/", validateUser, userController.createUser);

router.post("/login", userController.loginUser);

router.get(
  "/fundis",
  authenticateToken,
  authorizeRole("admin"),
  userController.getFundis
);

module.exports = router;
