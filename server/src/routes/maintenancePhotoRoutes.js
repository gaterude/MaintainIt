const express = require('express');
const multer = require('multer');
const authenticateToken = require('../middleware/authMiddleware');
const validateUuidParams = require('../middleware/validateUuidParams');
const { upload } = require('../middleware/maintenancePhotoUpload');
const controller = require('../controllers/maintenancePhotoController');
const repo = require('../repositories/enhancementRepository');

// Flow: check the caller may touch this request BEFORE any file is accepted.
async function checkRequestAccess(req, res, next) {
  try {
    const allowed = await repo.getRequestAccess(req.params.requestId, req.user.id, req.user.role);
    if (!allowed) return res.status(404).json({ message: 'Maintenance request not found.' });
    return next();
  } catch (error) { return next(error); }
}

const router = express.Router();
router.use(authenticateToken);
router.post('/:requestId', validateUuidParams('requestId'), checkRequestAccess, upload.array('photos', 5), controller.uploadPhotos);
router.get('/file/:photoId', validateUuidParams('photoId'), controller.viewPhoto);
router.get('/:requestId', validateUuidParams('requestId'), controller.listPhotos);

// Only upload problems become 400s. Anything else (database errors etc.)
// goes to the app-level handler, which logs it and returns a generic 500.
router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5 MB or smaller.' : 'Invalid image upload.' });
  }
  if (error && error.statusCode === 400) return res.status(400).json({ message: error.message });
  return next(error);
});

module.exports = router;
