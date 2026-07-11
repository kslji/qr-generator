const express = require('express');
const controller = require('../controllers/documentController');
const { documentUpload } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, uploadLimiter, documentUpload(), controller.uploadDocument);
router.get('/', auth, controller.listDocuments);
router.get('/:id', auth, controller.getDocumentMeta);
router.get('/:id/qrcode', controller.getQrCode);
router.get('/:id/barcode', controller.getBarcode);
router.get('/:id/file', controller.downloadFile);
router.delete('/:id', auth, controller.deleteDocument);

module.exports = router;
