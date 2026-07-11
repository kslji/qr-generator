const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.rateLimit.uploadPer15Min,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many uploads. Please try again later.' } }
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.rateLimit.generalPer15Min,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } }
});

module.exports = { uploadLimiter, generalLimiter };
