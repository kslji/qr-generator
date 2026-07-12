const QRCode = require('qrcode');
const sharp = require('sharp');
const { getDb } = require('../config/db');

/**
 * Renders a PNG buffer of a QR code encoding the given text.
 * Optionally styles the code with custom colors and overlays a center logo.
 */
async function generateQrPng(text, { size = 400, colorDark = '#000000', colorLight = '#FFFFFF', logoBuffer = null } = {}) {
  const qrBuffer = await QRCode.toBuffer(text, {
    type: 'png',
    errorCorrectionLevel: logoBuffer ? 'H' : 'M', // High correction level for logo overlay
    margin: 2,
    width: size,
    color: { dark: colorDark, light: colorLight }
  });

  if (!logoBuffer) {
    return qrBuffer;
  }

  // Composite the logo in the center of the QR code using sharp
  const qrImage = sharp(qrBuffer);
  const qrMetadata = await qrImage.metadata();

  const logoSize = Math.floor(qrMetadata.width * 0.2); // 20% size
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoSize, logoSize)
    .toBuffer();

  return qrImage
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .toBuffer();
}

/**
 * Logs a QR code generation event in upload_history.
 */
async function logGeneration(userId) {
  const db = getDb();
  await db.collection('upload_history').insertOne({
    user_id: userId,
    created_at: new Date()
  });
}

/**
 * Gets the number of generated QR codes in the last 24 hours for a user.
 */
async function getGenerationCount24h(userId) {
  const db = getDb();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return await db.collection('upload_history').countDocuments({
    user_id: userId,
    created_at: { $gte: twentyFourHoursAgo }
  });
}

module.exports = {
  generateQrPng,
  logGeneration,
  getGenerationCount24h
};

