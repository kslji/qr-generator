const qrService = require('../services/qrService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * POST /api/qr/generate
 * Accepts multipart/form-data or JSON.
 * Fields:
 *  - "url" or "text": String (required)
 *  - "logo": File upload (optional)
 *  - "qrColorDark": Hex color string (optional)
 *  - "qrColorLight": Hex color string (optional)
 */
async function generateQrCode(req, res, next) {
  try {
    const file = req.files && req.files.file ? req.files.file[0] : null;
    const logo = req.files && req.files.logo ? req.files.logo[0] : null;
    const url = req.body.url;
    const text = req.body.text;

    // 1. Check if user is trying to upload a document file
    if (file) {
      throw new AppError(
        'File uploads are no longer supported because documents are not stored in the database. Please provide a URL directly in the "url" or "text" field to generate a static QR code.',
        400,
        'FILE_UPLOAD_UNSUPPORTED'
      );
    }

    const contentToEncode = (url || text || '').trim();
    if (!contentToEncode) {
      throw new AppError(
        'Either "url" or "text" must be provided to generate a static QR code.',
        400,
        'INPUT_REQUIRED'
      );
    }

    // 2. Validate URL if it looks like one, or check format
    if (url) {
      try {
        new URL(contentToEncode);
      } catch (err) {
        throw new AppError(
          'Invalid URL format. Must be a valid absolute URL (e.g., starting with http:// or https://)',
          400,
          'INVALID_URL'
        );
      }
    }

    // 3. Enforce strict limit of 5 generations per 24 hours
    const generations24h = await qrService.getGenerationCount24h(req.user.id);
    if (generations24h >= 5) {
      throw new AppError(
        'Daily generation limit reached. You can only create 5 QR codes per 24 hours.',
        429,
        'DAILY_LIMIT_EXCEEDED'
      );
    }

    // 4. Validate colors
    const hexColorRegex = /^#([0-9a-fA-F]{3}){1,2}$/;
    const qrColorDark = req.body.qrColorDark;
    const qrColorLight = req.body.qrColorLight;

    if (qrColorDark && !hexColorRegex.test(qrColorDark)) {
      throw new AppError('qrColorDark must be a valid hex color code (e.g. #000000)', 400, 'INVALID_COLOR');
    }
    if (qrColorLight && !hexColorRegex.test(qrColorLight)) {
      throw new AppError('qrColorLight must be a valid hex color code (e.g. #FFFFFF)', 400, 'INVALID_COLOR');
    }

    // 5. Generate QR code in memory
    const qrBuffer = await qrService.generateQrPng(contentToEncode, {
      colorDark: qrColorDark,
      colorLight: qrColorLight,
      logoBuffer: logo ? logo.buffer : null
    });

    // 6. Log the generation event in DB to count against rate limit
    await qrService.logGeneration(req.user.id);
    logger.info('Static QR Code generated', { userId: req.user.id, contentLen: contentToEncode.length });

    // 7. Return base64 encoded QR code
    const base64Qr = 'data:image/png;base64,' + qrBuffer.toString('base64');
    res.status(201).json({
      success: true,
      qrCode: base64Qr
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateQrCode
};
