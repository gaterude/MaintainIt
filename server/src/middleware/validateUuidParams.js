// Rejects malformed IDs early so PostgreSQL never sees an invalid UUID
// (which would otherwise surface as a confusing server error).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuidParams(...names) {
  return (req, res, next) => {
    const valid = names.every((name) => UUID_PATTERN.test(String(req.params[name] || '')));
    if (!valid) return res.status(400).json({ message: 'Invalid identifier.' });
    return next();
  };
}

module.exports = validateUuidParams;
