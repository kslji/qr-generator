require('dotenv').config();
const { connectDb, client } = require('../src/config/db');
const logger = require('../src/utils/logger');

async function main() {
  const db = await connectDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Clean up upload history older than 30 days
  const result = await db.collection('upload_history').deleteMany({
    created_at: { $lt: thirtyDaysAgo }
  });

  logger.info(`Cleanup completed. Removed ${result.deletedCount || 0} upload history record(s) older than 30 days.`);
  await client.close();
}

main().catch(err => {
  logger.error('Cleanup failed', { error: err.message });
  process.exit(1);
});
