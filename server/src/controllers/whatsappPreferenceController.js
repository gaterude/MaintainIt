const service = require("../services/whatsappPreferenceService");

function handleError(res, error) {
  console.error("WhatsApp preference request failed:", error.message);

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    message:
      statusCode === 500
        ? "Unable to update WhatsApp notification preferences."
        : error.message,
  });
}

async function getPreference(req, res) {
  try {
    const preference = await service.getPreference(req.user.id);

    return res.status(200).json({
      preference,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updatePreference(req, res) {
  try {
    const preference = await service.updatePreference(
      req.user.id,
      req.body.whatsappOptIn
    );

    return res.status(200).json({
      message: preference.whatsapp_opt_in
        ? "WhatsApp appointment notifications enabled."
        : "WhatsApp appointment notifications disabled.",
      preference,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  getPreference,
  updatePreference,
};