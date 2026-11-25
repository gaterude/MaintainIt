const repo = require('../repositories/enhancementRepository');
async function getAnalytics(_req, res) {
  try { return res.json({ analytics: await repo.getAnalytics() }); }
  catch (error) { console.error('Property analytics failed:', error); return res.status(500).json({ message: 'Unable to load property analytics.' }); }
}
async function getAnalyticsDetails(_req, res) {
  try { return res.json({ details: await repo.getAnalyticsDetails() }); }
  catch (error) { console.error('Analytics details failed:', error); return res.status(500).json({ message: 'Unable to load analytics details.' }); }
}
module.exports = { getAnalytics, getAnalyticsDetails };