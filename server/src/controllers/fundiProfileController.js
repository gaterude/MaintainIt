const repo = require('../repositories/enhancementRepository');

// Clean a list typed by the user: trim, de-duplicate, max 20 items, max 50 characters each.
const cleanList = (value) => Array.isArray(value)
  ? [...new Set(value.map((x) => String(x).trim().slice(0, 50)).filter(Boolean))].slice(0, 20)
  : [];

// Flow: admin sees any fundi (with contact details); a fundi sees only themself;
// a tenant sees only a fundi assigned to one of their own requests (no contact details).
async function getProfile(req, res) {
  const { fundiId } = req.params;
  const { id: userId, role } = req.user;
  let includeContact = false;

  if (role === 'admin') {
    includeContact = true;
  } else if (role === 'fundi') {
    if (fundiId !== userId) return res.status(404).json({ message: 'Fundi profile not found.' });
    includeContact = true;
  } else if (role === 'tenant') {
    if (!(await repo.tenantCanViewFundi(userId, fundiId))) {
      return res.status(404).json({ message: 'Fundi profile not found.' });
    }
  }

  const profile = await repo.getFundiProfile(fundiId, { includeContact });
  if (!profile) return res.status(404).json({ message: 'Fundi profile not found.' });
  return res.json({ profile });
}

async function getMine(req, res) {
  const profile = await repo.getFundiProfile(req.user.id, { includeContact: true });
  return res.json({ profile });
}

async function saveMine(req, res) {
  const { bio = '', skills = [], specialisations = [] } = req.body;
  if (typeof bio !== 'string' || bio.length > 1000) return res.status(400).json({ message: 'Bio must be 1,000 characters or fewer.' });
  if (!Array.isArray(skills) || !Array.isArray(specialisations)) return res.status(400).json({ message: 'Skills and specialisations must be lists.' });
  const profile = await repo.saveFundiProfile(req.user.id, { bio: bio.trim(), skills: cleanList(skills), specialisations: cleanList(specialisations) });
  return res.json({ message: 'Profile updated.', profile });
}

// Admin-only. Verification is an administrative record of a real-world check.
async function setVerification(req, res) {
  const allowed = ['pending', 'verified', 'rejected', 'unverified'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Invalid verification status.' });
  const profile = await repo.updateVerification(req.params.fundiId, req.body.status);
  if (!profile) return res.status(404).json({ message: 'Fundi not found.' });
  return res.json({ profile });
}

module.exports = { getProfile, getMine, saveMine, setVerification };
