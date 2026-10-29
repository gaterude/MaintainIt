const express = require("express");

const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/authorizeRole");

const controller = require("../controllers/whatsappPreferenceController");

router.get(
  "/",
  authenticateToken,
  authorizeRole("tenant"),
  controller.getPreference
);

router.put(
  "/",
  authenticateToken,
  authorizeRole("tenant"),
  controller.updatePreference
);

module.exports = router;