const { assessIssue } = require('../services/maintenanceAiService');
async function assess(req, res) {
  try { return res.json({ assessment: await assessIssue(req.body.description) }); }
  catch (error) { return res.status(error.statusCode || 500).json({ message: error.message || 'Unable to assess this issue.' }); }
}
module.exports = { assess };
