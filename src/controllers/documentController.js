const env = require('../config/env');
const documentService = require('../services/documentService');
const qrService = require('../services/qrService');
const barcodeService = require('../services/barcodeService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

function buildLinks(id) {
  return {
    scanUrl: `${env.baseUrl}/scan/${id}`,
    downloadUrl: `${env.baseUrl}/api/documents/${id}/file`,
    qrCodeUrl: `${env.baseUrl}/api/documents/${id}/qrcode`,
    barcodeUrl: `${env.baseUrl}/api/documents/${id}/barcode`
  };
}

function serializeDoc(doc) {
  return {
    id: doc.id,
    originalName: doc.original_name,
    mimeType: doc.mime_type,
    sizeBytes: doc.size_bytes !== null && doc.size_bytes !== undefined ? Number(doc.size_bytes) : null,
    scanCount: doc.scan_count ?? 0,
    lastScannedAt: doc.last_scanned_at,
    expiresAt: doc.expires_at,
    createdAt: doc.created_at,
    redirectUrl: doc.redirect_url || null,
    qrColorDark: doc.qr_color_dark || '#000000',
    qrColorLight: doc.qr_color_light || '#FFFFFF',
    hasQrLogo: !!doc.qr_logo,
    ...buildLinks(doc.id)
  };
}

/**
 * POST /api/documents
 * Can accept multipart/form-data with fields "file" and optional "logo", or JSON with "url".
 * Optional field "expiresInDays" (integer), "qrColorDark" (hex), "qrColorLight" (hex).
 */
async function uploadDocument(req, res, next) {
  try {
    const file = req.files && req.files.file ? req.files.file[0] : null;
    const logo = req.files && req.files.logo ? req.files.logo[0] : null;
    const url = req.body.url;

    if (!file && !url) {
      throw new AppError('Either a file must be provided (as multipart/form-data field "file") or a redirect url must be provided (as field "url").', 400, 'INPUT_REQUIRED');
    }
    if (file && url) {
      throw new AppError('Cannot provide both a file and a redirect url. Please provide only one.', 400, 'AMBIGUOUS_INPUT');
    }

    const uploads24h = await documentService.getUploadCount24h(req.user.id);
    if (uploads24h >= 5) {
      throw new AppError('Daily creation limit reached. You can only create 5 documents/links per 24 hours.', 429, 'DAILY_LIMIT_EXCEEDED');
    }

    const count = await documentService.getDocumentCount(req.user.id);
    if (count >= 5) {
      throw new AppError('Storage limit reached. You can only have a maximum of 5 active documents. Please delete an existing document to upload a new one.', 400, 'STORAGE_LIMIT_REACHED');
    }

    const hexColorRegex = /^#([0-9a-fA-F]{3}){1,2}$/;
    const qrColorDark = req.body.qrColorDark;
    const qrColorLight = req.body.qrColorLight;

    if (qrColorDark && !hexColorRegex.test(qrColorDark)) {
      throw new AppError('qrColorDark must be a valid hex color code (e.g. #FF0000)', 400, 'INVALID_COLOR');
    }
    if (qrColorLight && !hexColorRegex.test(qrColorLight)) {
      throw new AppError('qrColorLight must be a valid hex color code (e.g. #FFFFFF)', 400, 'INVALID_COLOR');
    }

    let expiresAt;
    const daysInput = req.body.expiresInDays;
    if (daysInput !== undefined && daysInput !== null && daysInput !== '') {
      const days = Number(daysInput);
      if (!Number.isFinite(days) || days <= 0 || days > 30) {
        throw new AppError('expiresInDays must be a positive number and cannot exceed 30 days', 400, 'INVALID_EXPIRY');
      }
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    } else {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    let doc;
    if (file) {
      doc = await documentService.createDocument({
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        buffer: file.buffer,
        expiresAt,
        userId: req.user.id,
        qrColorDark,
        qrColorLight,
        logoBuffer: logo ? logo.buffer : null
      });
      logger.info('Document created (file)', { id: doc.id, mimeType: doc.mime_type, sizeBytes: doc.size_bytes, userId: req.user.id });
    } else {
      const urlStr = url.trim();
      try {
        new URL(urlStr);
      } catch (err) {
        throw new AppError('Invalid redirect URL format. Must be a valid absolute URL (e.g., starting with http:// or https://)', 400, 'INVALID_URL');
      }

      doc = await documentService.createDocument({
        expiresAt,
        redirectUrl: urlStr,
        userId: req.user.id,
        qrColorDark,
        qrColorLight,
        logoBuffer: logo ? logo.buffer : null
      });
      logger.info('Document created (link)', { id: doc.id, redirectUrl: doc.redirect_url, userId: req.user.id });
    }

    await documentService.logUpload(req.user.id);

    res.status(201).json({ document: serializeDoc(doc) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/documents/:id */
async function getDocumentMeta(req, res, next) {
  try {
    const doc = await documentService.getDocumentMeta(req.params.id, req.user.id);
    if (!doc) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    res.json({ document: serializeDoc(doc) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/documents (list, paginated) */
async function listDocuments(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const docs = await documentService.listDocuments({ limit, offset, userId: req.user.id });
    res.json({ documents: docs.map(serializeDoc), limit, offset });
  } catch (err) {
    next(err);
  }
}

/** GET /api/documents/:id/qrcode -> image/png, encodes the /scan/:id URL */
async function getQrCode(req, res, next) {
  try {
    const doc = await documentService.getDocumentQrConfig(req.params.id);
    if (!doc) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');

    const size = req.query.size ? Number(req.query.size) : undefined;
    const scanUrl = buildLinks(req.params.id).scanUrl;
    const png = await qrService.generateQrPng(scanUrl, {
      size,
      colorDark: doc.qr_color_dark,
      colorLight: doc.qr_color_light,
      logoBuffer: doc.qr_logo
    });

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');

    if (req.query.download === 'true') {
      res.set('Content-Disposition', `attachment; filename="qrcode-${req.params.id}.png"`);
    }

    res.send(png);
  } catch (err) {
    next(err);
  }
}

/** GET /api/documents/:id/barcode -> image/png, CODE128 of the document ID */
async function getBarcode(req, res, next) {
  try {
    const exists = await documentService.documentExists(req.params.id);
    if (!exists) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');

    const png = await barcodeService.generateBarcodePng(req.params.id);

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');

    if (req.query.download === 'true') {
      res.set('Content-Disposition', `attachment; filename="barcode-${req.params.id}.png"`);
    }

    res.send(png);
  } catch (err) {
    next(err);
  }
}

/** GET /api/documents/:id/file -> streams the original file back out (or redirects if link) */
async function downloadFile(req, res, next) {
  try {
    const doc = await documentService.getDocumentWithFile(req.params.id);
    if (!doc) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    if (documentService.isExpired(doc)) {
      throw new AppError('This document has expired and is no longer available', 410, 'DOCUMENT_EXPIRED');
    }

    if (doc.redirect_url) {
      return res.redirect(302, doc.redirect_url);
    }

    const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
    res.set('Content-Type', doc.mime_type);
    res.set('Content-Length', doc.size_bytes);
    res.set('Content-Disposition', `${disposition}; filename="${encodeURIComponent(doc.original_name)}"`);
    res.send(doc.file_data);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/documents/:id */
async function deleteDocument(req, res, next) {
  try {
    const deleted = await documentService.deleteDocument(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /scan/:id
 * This is the URL actually encoded in the QR image. It records the scan
 * for analytics, then redirects to the file download endpoint so a phone
 * camera opens the document directly.
 */
async function resolveScan(req, res, next) {
  try {
    const doc = await documentService.getDocumentMeta(req.params.id);
    if (!doc) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    if (documentService.isExpired(doc)) {
      throw new AppError('This document has expired and is no longer available', 410, 'DOCUMENT_EXPIRED');
    }

    await documentService.recordScan(req.params.id);

    if (doc.redirect_url) {
      res.redirect(302, doc.redirect_url);
    } else {
      res.redirect(302, buildLinks(req.params.id).downloadUrl + '?inline=true');
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadDocument,
  getDocumentMeta,
  listDocuments,
  getQrCode,
  getBarcode,
  downloadFile,
  deleteDocument,
  resolveScan
};
