const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const env = require('./config/env');
const logger = require('./utils/logger');
const { healthCheck } = require('./config/db');
const { generalLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const qrRoutes = require('./routes/qrRoutes');

const { centralLoggerMiddleware, centralErrorLoggerMiddleware } = require('./utils/logHelper');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: env.corsOrigins.includes('*') ? '*' : env.corsOrigins
}));
app.use(compression());
app.use(express.json());
app.use(centralLoggerMiddleware('qr-barcode-backend'));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));
app.use(generalLimiter);

app.get('/health', async (req, res) => {
  try {
    const dbOk = await healthCheck();
    res.json({ status: 'ok', db: dbOk ? 'connected' : 'unreachable' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'unreachable' });
  }
});

// API endpoint for generating static QR codes.
app.use('/api/qr', qrRoutes);

app.use(notFoundHandler);
app.use(centralErrorLoggerMiddleware('qr-barcode-backend'));
app.use(errorHandler);

module.exports = app;
