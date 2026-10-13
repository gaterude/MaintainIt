function validateMaintenanceRequest(req, res, next) {
  const {
    roomId,
    title,
    description,
  } = req.body;

  if (!roomId || !title || !description) {
    return res.status(400).json({
      message: "Room ID, title and description are required",
    });
  }

  if (title.length > 150) {
    return res.status(400).json({
      message: "Title must not exceed 150 characters",
    });
  }

  next();
}

module.exports = validateMaintenanceRequest;