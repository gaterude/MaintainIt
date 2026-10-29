const pool = require("../config/database");

async function getWhatsAppPreference(userId) {
  const result = await pool.query(
    `
    SELECT
      whatsapp_opt_in,
      whatsapp_opted_in_at,
      whatsapp_opted_out_at
    FROM tenants
    WHERE user_id = $1
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Tenant profile not found.");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

async function updateWhatsAppPreference(userId, optedIn) {
  const result = await pool.query(
    `
    UPDATE tenants
    SET
      whatsapp_opt_in = $2,
      whatsapp_opted_in_at = CASE
        WHEN $2 = TRUE THEN NOW()
        ELSE whatsapp_opted_in_at
      END,
      whatsapp_opted_out_at = CASE
        WHEN $2 = FALSE THEN NOW()
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE user_id = $1
    RETURNING
      whatsapp_opt_in,
      whatsapp_opted_in_at,
      whatsapp_opted_out_at
    `,
    [userId, optedIn]
  );

  if (result.rows.length === 0) {
    const error = new Error("Tenant profile not found.");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

module.exports = {
  getWhatsAppPreference,
  updateWhatsAppPreference,
};