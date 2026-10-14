const VALID_CATEGORIES = [
  "plumbing",
  "electrical",
  "cleaning",
  "appliance",
  "structural",
  "other",
];

const VALID_PRIORITIES = [
  "urgent",
  "medium",
  "low",
];

function validateMaintenanceRequest(req, res, next) {
  const {
    roomId,
    description,
    category,
    priority = "medium",
  } = req.body;

  if (!roomId || !description || !category) {
    return res.status(400).json({
      message: "Room ID, description and category are required",
    });
  }

  if (
    typeof description !== "string" ||
    !description.trim()
  ) {
    return res.status(400).json({
      message: "Description must be a non-empty string",
    });
  }

  if (
    typeof category !== "string" ||
    !VALID_CATEGORIES.includes(category)
  ) {
    return res.status(400).json({
      message: "Please select a valid maintenance category",
    });
  }

  if (
    typeof priority !== "string" ||
    !VALID_PRIORITIES.includes(priority)
  ) {
    return res.status(400).json({
      message: "Priority must be urgent, medium, or low",
    });
  }

  req.body.priority = priority;

  next();
}

module.exports = validateMaintenanceRequest;