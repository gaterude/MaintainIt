const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const directory = path.resolve(__dirname, '../../storage/maintenance-photos');
fs.mkdirSync(directory, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, directory),
  filename: (_req, _file, callback) => callback(null, `${crypto.randomUUID()}.upload`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/jpeg','image/png','image/webp'];
    if (!allowed.includes(file.mimetype)) return callback(Object.assign(new Error('Only JPEG, PNG and WebP images are accepted.'), { statusCode: 400 }));
    callback(null, true);
  }
});
function detectImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') return 'image/webp';
  return null;
}
module.exports = { upload, detectImage, directory };
