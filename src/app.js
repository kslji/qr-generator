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

const documentRoutes = require('./routes/documentRoutes');
const scanRoutes = require('./routes/scanRoutes');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: env.corsOrigins.includes('*') ? '*' : env.corsOrigins
}));
app.use(compression());
app.use(express.json());
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

// This is the short, stable URL encoded inside every QR code.
app.use('/scan', scanRoutes);

// Full CRUD + image generation API for whatever frontend calls this service.
app.use('/api/documents', documentRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
