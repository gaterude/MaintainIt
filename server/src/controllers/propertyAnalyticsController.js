const repo = require('../repositories/enhancementRepository');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Optional ?property=<id>. Missing means "all properties". A malformed id is a
// client mistake (400), never passed to the database.
function readProperty(req) {
  const value = req.query.property;
  if (value === undefined || value === '' || value === 'all') return { propertyId: null };
  if (typeof value !== 'string' || !UUID.test(value)) return { error: true };
  return { propertyId: value };
}

async function getAnalytics(req, res) {
  const { propertyId, error } = readProperty(req);
  if (error) return res.status(400).json({ message: 'Invalid property.' });
  try { return res.json({ analytics: await repo.getAnalytics(propertyId) }); }
  catch (err) { console.error('Property analytics failed:', err); return res.status(500).json({ message: 'Unable to load property analytics.' }); }
}

async function getAnalyticsDetails(req, res) {
  const { propertyId, error } = readProperty(req);
  if (error) return res.status(400).json({ message: 'Invalid property.' });
  try { return res.json({ details: await repo.getAnalyticsDetails(propertyId) }); }
  catch (err) { console.error('Analytics details failed:', err); return res.status(500).json({ message: 'Unable to load analytics details.' }); }
}

module.exports = { getAnalytics, getAnalyticsDetails };