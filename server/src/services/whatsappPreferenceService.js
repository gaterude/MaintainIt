const repository = require("../repositories/whatsappPreferenceRepository");

async function getPreference(userId) {
  if (!userId) {
    const error = new Error("Authenticated user ID is required.");
    error.statusCode = 401;
    throw error;
  }

  return repository.getWhatsAppPreference(userId);
}

async function updatePreference(userId, optedIn) {
  if (!userId) {
    const error = new Error("Authenticated user ID is required.");
    error.statusCode = 401;
    throw error;
  }

  if (typeof optedIn !== "boolean") {
    const error = new Error(
      "whatsappOptIn must be true or false."
    );
    error.statusCode = 400;
    throw error;
  }

  return repository.updateWhatsAppPreference(userId, optedIn);
}

module.exports = {
  getPreference,
  updatePreference,
};