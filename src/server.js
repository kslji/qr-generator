const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDb, client } = require('./config/db');

let server;

async function start() {
  try {
    await connectDb();
    server = app.listen(env.port, () => {
      logger.info(`qr-barcode-backend listening on port ${env.port}`, { baseUrl: env.baseUrl });
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      try {
        await client.close();
        logger.info('MongoDB connection closed. Bye.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', { error: err.message });
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }

  // Force-exit if something hangs.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || reason });
});

start();
