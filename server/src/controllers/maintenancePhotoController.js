const fs = require('fs/promises');
const path = require('path');
const repo = require('../repositories/enhancementRepository');
const { detectImage, directory } = require('../middleware/maintenancePhotoUpload');

async function uploadPhotos(req, res) {
  const files = req.files || [];
  const finalFiles = [];
  try {
    if (!files.length) return res.status(400).json({ message: 'Select at least one image.' });
    const prepared = [];
    for (const file of files) {
      const buffer = await fs.readFile(file.path);
      const detected = detectImage(buffer);
      if (!detected || detected !== file.mimetype) throw Object.assign(new Error('An uploaded file is not a valid supported image.'), { statusCode: 400 });
      const ext = detected === 'image/jpeg' ? '.jpg' : detected === 'image/png' ? '.png' : '.webp';
      const storageName = `${path.basename(file.filename, '.upload')}${ext}`;
      prepared.push({ file, buffer, detected, storageName, finalPath: path.join(directory, storageName), ext });
    }
    for (const item of prepared) {
      await fs.rename(item.file.path, item.finalPath);
      finalFiles.push(item.finalPath);
    }
    const photos = await repo.insertPhotos(prepared.map(item => ({
      requestId: req.params.requestId,
      userId: req.user.id,
      storageName: item.storageName,
      originalName: path.basename(item.file.originalname).slice(0,255),
      mimeType: item.detected,
      sizeBytes: item.buffer.length
    })));
    return res.status(201).json({ photos });
  } catch (error) {
    await Promise.all([...files.map(file => fs.unlink(file.path).catch(() => {})), ...finalFiles.map(filePath => fs.unlink(filePath).catch(() => {}))]);
    console.error('Maintenance photo upload failed:', error);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to save maintenance photos.' });
  }
}
async function listPhotos(req, res) {
  const allowed = await repo.getRequestAccess(req.params.requestId, req.user.id, req.user.role);
  if (!allowed) return res.status(404).json({ message: 'Maintenance request not found.' });
  return res.json({ photos: await repo.listPhotos(req.params.requestId) });
}
async function viewPhoto(req, res) {
  const photo = await repo.getPhoto(req.params.photoId);
  if (!photo) return res.status(404).json({ message: 'Photo not found.' });
  const allowed = await repo.getRequestAccess(photo.maintenance_request_id, req.user.id, req.user.role);
  if (!allowed) return res.status(404).json({ message: 'Photo not found.' });
  const ext = photo.mime_type === 'image/jpeg' ? '.jpg' : photo.mime_type === 'image/png' ? '.png' : '.webp';
  const filePath = path.join(directory, `${path.basename(photo.storage_name, path.extname(photo.storage_name))}${ext}`);
  res.setHeader('Content-Type', photo.mime_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(filePath, error => { if (error && !res.headersSent) res.status(404).json({ message: 'Photo file not found.' }); });
}
module.exports = { uploadPhotos, listPhotos, viewPhoto };
