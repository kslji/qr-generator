const { getDb } = require('../config/db');
const { generateId } = require('../utils/idGenerator');
const AppError = require('../utils/AppError');
const { Binary } = require('mongodb');

const MAX_ID_RETRIES = 5;

function mapDoc(doc) {
  if (!doc) return null;
  return {
    id: doc._id,
    user_id: doc.user_id || null,
    original_name: doc.original_name,
    mime_type: doc.mime_type,
    size_bytes: doc.size_bytes,
    file_data: doc.file_data ? Buffer.from(doc.file_data.buffer || doc.file_data) : null,
    scan_count: doc.scan_count,
    last_scanned_at: doc.last_scanned_at,
    expires_at: doc.expires_at,
    created_at: doc.created_at,
    redirect_url: doc.redirect_url,
    qr_color_dark: doc.qr_color_dark || '#000000',
    qr_color_light: doc.qr_color_light || '#FFFFFF',
    qr_logo: doc.qr_logo ? Buffer.from(doc.qr_logo.buffer || doc.qr_logo) : null
  };
}

/**
 * Inserts a new document, retrying with a fresh ID on collision.
 */
async function createDocument({ originalName, mimeType, sizeBytes, buffer, expiresAt, redirectUrl, userId, qrColorDark, qrColorLight, logoBuffer }) {
  const db = getDb();
  const col = db.collection('documents');

  let lastErr;
  for (let attempt = 0; attempt < MAX_ID_RETRIES; attempt++) {
    const id = generateId();
    try {
      const doc = {
        _id: id,
        user_id: userId || null,
        original_name: originalName || null,
        mime_type: mimeType || null,
        size_bytes: sizeBytes !== undefined ? sizeBytes : null,
        file_data: buffer ? new Binary(buffer) : null,
        expires_at: expiresAt || null,
        redirect_url: redirectUrl || null,
        scan_count: 0,
        last_scanned_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        qr_color_dark: qrColorDark || '#000000',
        qr_color_light: qrColorLight || '#FFFFFF',
        qr_logo: logoBuffer ? new Binary(logoBuffer) : null
      };

      await col.insertOne(doc);
      return mapDoc(doc);
    } catch (err) {
      if (err.code === 11000) { // MongoDB duplicate key
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw new AppError('Could not allocate a unique document ID, please retry', 500, 'ID_ALLOCATION_FAILED');
}

/** Metadata only — never pulls file_data or qr_logo off disk unless actually needed. */
async function getDocumentMeta(id, userId = null) {
  const db = getDb();
  const query = { _id: id };
  if (userId) {
    query.user_id = userId;
  }
  const doc = await db.collection('documents').findOne(
    query,
    { projection: { file_data: 0, qr_logo: 0 } }
  );
  return mapDoc(doc);
}

/** Full row including the file bytes, for the actual download/serve endpoint. */
async function getDocumentWithFile(id, userId = null) {
  const db = getDb();
  const query = { _id: id };
  if (userId) {
    query.user_id = userId;
  }
  const doc = await db.collection('documents').findOne(query);
  return mapDoc(doc);
}

/** Fetches styling config and logo bytes, but excludes main file_data */
async function getDocumentQrConfig(id) {
  const db = getDb();
  const doc = await db.collection('documents').findOne(
    { _id: id },
    { projection: { file_data: 0 } }
  );
  return mapDoc(doc);
}

async function documentExists(id) {
  const db = getDb();
  const count = await db.collection('documents').countDocuments({ _id: id }, { limit: 1 });
  return count > 0;
}

async function recordScan(id) {
  const db = getDb();
  await db.collection('documents').updateOne(
    { _id: id },
    {
      $inc: { scan_count: 1 },
      $set: { last_scanned_at: new Date() }
    }
  );
}

async function deleteDocument(id, userId = null) {
  const db = getDb();
  const query = { _id: id };
  if (userId) {
    query.user_id = userId;
  }
  const result = await db.collection('documents').deleteOne(query);
  return result.deletedCount > 0;
}

async function listDocuments({ limit = 50, offset = 0, userId = null } = {}) {
  const db = getDb();
  const query = {};
  if (userId) {
    query.user_id = userId;
  }
  const docs = await db.collection('documents')
    .find(query, { projection: { file_data: 0, qr_logo: 0 } })
    .sort({ created_at: -1 })
    .skip(offset)
    .limit(limit)
    .toArray();
  return docs.map(mapDoc);
}

function isExpired(doc) {
  return !!doc.expires_at && new Date(doc.expires_at).getTime() < Date.now();
}

async function getDocumentCount(userId = null) {
  const db = getDb();
  const query = {};
  if (userId) {
    query.user_id = userId;
  }
  return await db.collection('documents').countDocuments(query);
}

async function logUpload(userId) {
  const db = getDb();
  await db.collection('upload_history').insertOne({
    user_id: userId,
    created_at: new Date()
  });
}

async function getUploadCount24h(userId) {
  const db = getDb();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return await db.collection('upload_history').countDocuments({
    user_id: userId,
    created_at: { $gte: twentyFourHoursAgo }
  });
}

module.exports = {
  createDocument,
  getDocumentMeta,
  getDocumentWithFile,
  getDocumentQrConfig,
  documentExists,
  recordScan,
  deleteDocument,
  listDocuments,
  isExpired,
  getDocumentCount,
  logUpload,
  getUploadCount24h
};
