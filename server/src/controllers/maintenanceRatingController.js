const service = require("../services/maintenanceRatingService");

function handleError(res, error) {
  if (error.code === "VALIDATION_ERROR") {
    return res.status(400).json({
      message: error.message,
    });
  }

  if (error.code === "NOT_FOUND") {
    return res.status(404).json({
      message: error.message,
    });
  }

  if (
    error.code === "NOT_COMPLETED" ||
    error.code === "INVALID_ASSIGNMENT"
  ) {
    return res.status(409).json({
      message: error.message,
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({
      message: "This maintenance request has already been rated",
    });
  }

  console.error("Maintenance rating error:", error);

  return res.status(500).json({
    message: "Unable to process maintenance rating",
  });
}

async function getEligibleRequests(req, res) {
  try {
    const requests = await service.getEligibleRequests(
      req.user.id
    );

    return res.status(200).json({ requests });
  } catch (error) {
    return handleError(res, error);
  }
}

async function submitRating(req, res) {
  try {
    const { requestId, score, comment } = req.body;

    const rating = await service.submitRating({
      requestId,
      tenantUserId: req.user.id,
      score,
      comment,
    });

    return res.status(201).json({
      message: "Rating submitted successfully",
      rating,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getFundiFeedback(req, res) {
  try {
    const result = await service.getFundiFeedback(
      req.user.id
    );

    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  getEligibleRequests,
  submitRating,
  getFundiFeedback,
};
