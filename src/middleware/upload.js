const multer = require('multer');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (file.fieldname === 'logo') {
    const allowedLogoMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedLogoMimeTypes.includes(file.mimetype)) {
      cb(new AppError(
        `Unsupported logo file type "${file.mimetype}". Allowed logo types: png, jpeg, webp`,
        415,
        'UNSUPPORTED_MEDIA_TYPE'
      ));
      return;
    }
  } else {
    if (!env.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(new AppError(
        `Unsupported file type "${file.mimetype}". Allowed types: ${env.upload.allowedMimeTypes.join(', ')}`,
        415,
        'UNSUPPORTED_MEDIA_TYPE'
      ));
      return;
    }
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.upload.maxFileSizeBytes, files: 2 }
});

// Supports uploading a document file and an optional QR code logo in parallel
function documentUpload() {
  const handler = upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'logo', maxCount: 1 }
  ]);
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError(
            `File exceeds the ${env.upload.maxFileSizeBytes / (1024 * 1024)}MB limit`,
            413,
            'FILE_TOO_LARGE'
          ));
        }
        return next(new AppError(err.message, 400, 'UPLOAD_ERROR'));
      }
      if (err) return next(err);
      next();
    });
  };
}

module.exports = { documentUpload };
