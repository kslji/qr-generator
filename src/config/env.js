require('dotenv').config();

function required(name, fallback) {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  baseUrl: (required('BASE_URL', 'http://localhost:3000')).replace(/\/+$/, ''),

  mongoUrl: required('MONGO_URL'),
  mongoDbName: process.env.MONGO_DB_NAME || 'qr_barcode',

  upload: {
    maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024,
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES ||
      'application/pdf,image/png,image/jpeg').split(',').map(s => s.trim())
  },

  rateLimit: {
    uploadPer15Min: Number(process.env.UPLOAD_RATE_LIMIT_PER_15MIN || 30),
    generalPer15Min: Number(process.env.GENERAL_RATE_LIMIT_PER_15MIN || 300)
  },

  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim()),

  jwtSecret: required('JWT_SECRET', 'supersecret_change_me_in_production'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d'
};

module.exports = env;
