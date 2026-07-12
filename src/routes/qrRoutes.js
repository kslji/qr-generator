const express = require('express');
const controller = require('../controllers/qrController');
const { documentUpload } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/generate', auth, uploadLimiter, documentUpload(), controller.generateQrCode);

module.exports = router;
