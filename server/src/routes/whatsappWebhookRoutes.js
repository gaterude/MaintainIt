const express = require("express");
const router = express.Router();

const controller = require("../controllers/whatsappWebhookController");

router.get("/", controller.verifyWebhook);
router.post("/", controller.receiveWebhook);

module.exports = router;