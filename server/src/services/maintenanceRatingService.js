const repository = require("../repositories/maintenanceRatingRepository");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getEligibleRequests(tenantUserId) {
  return repository.findEligibleRequests(tenantUserId);
}

async function submitRating({
  requestId,
  tenantUserId,
  score,
  comment,
}) {
  if (
    typeof requestId !== "string" ||
    !UUID_REGEX.test(requestId)
  ) {
    const error = new Error("A valid maintenance request ID is required");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    const error = new Error("Rating must be a whole number between 1 and 5");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (
    comment !== undefined &&
    comment !== null &&
    typeof comment !== "string"
  ) {
    const error = new Error("Comment must be text");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const cleanedComment =
    typeof comment === "string" ? comment.trim() : null;

  if (cleanedComment && cleanedComment.length > 500) {
    const error = new Error("Comment cannot exceed 500 characters");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  return repository.createRating({
    requestId,
    tenantUserId,
    score,
    comment: cleanedComment || null,
  });
}

async function getFundiFeedback(fundiId) {
  const [feedback, summary] = await Promise.all([
    repository.findFeedbackByFundi(fundiId),
    repository.findFundiRatingSummary(fundiId),
  ]);

  return {
    feedback,
    summary,
  };
}

module.exports = {
  getEligibleRequests,
  submitRating,
  getFundiFeedback,
};