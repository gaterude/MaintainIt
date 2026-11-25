const express = require('express');
const authenticateToken = require('../middleware/authMiddleware');
const authorizeRole = require('../middleware/authorizeRole');
const controller = require('../controllers/maintenanceAiController');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();

// 10 assessments per hour PER LOGGED-IN TENANT (not per IP, so users on shared
// Wi-Fi or behind a proxy do not use each other's allowance).
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `ai:${req.user.id}`,
  message: { message: 'AI assessment limit reached. Please try again later.' },
});

router.post('/assess', authenticateToken, authorizeRole('tenant'), aiLimiter, controller.assess);
module.exports = router;
