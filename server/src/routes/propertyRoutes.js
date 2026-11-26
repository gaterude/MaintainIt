const express = require("express");

const propertyController = require("../controllers/propertyController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/authorizeRole");

const router = express.Router();

// Every route here is for administrators only.
router.use(authenticateToken, authorizeRole("admin"));

router.get("/", propertyController.listProperties);
router.post("/", propertyController.createProperty);
router.post("/:propertyId/rooms", propertyController.createRooms);
router.patch("/rooms/:roomId", propertyController.updateRoomCapacity);

module.exports = router;