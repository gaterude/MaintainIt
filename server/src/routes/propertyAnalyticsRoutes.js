const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/authorizeRole');
const controller = require('../controllers/propertyAnalyticsController');
const router = express.Router();
router.get('/', auth, role('admin'), controller.getAnalytics);
router.get('/details', auth, role('admin'), controller.getAnalyticsDetails);
module.exports = router;