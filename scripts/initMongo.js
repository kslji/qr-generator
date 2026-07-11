require('dotenv').config();
const { connectDb, client } = require('../src/config/db');
const logger = require('../src/utils/logger');

async function main() {
  logger.info('Initializing MongoDB...');
  await connectDb();
  logger.info('MongoDB setup and index configuration complete.');
  await client.close();
}

main().catch(err => {
  logger.error('Failed to initialize MongoDB', { error: err.message });
  process.exit(1);
});
