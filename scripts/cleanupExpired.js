require('dotenv').config();
const { connectDb, client } = require('../src/config/db');
const logger = require('../src/utils/logger');

async function main() {
  const db = await connectDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Use bulkWrite operation to clean up documents:
  // - Either they are expired (expires_at in the past)
  // - Or they are older than 30 days (created_at < thirtyDaysAgo)
  const result = await db.collection('documents').bulkWrite([
    {
      deleteMany: {
        filter: {
          $or: [
            { expires_at: { $ne: null, $lt: new Date() } },
            { created_at: { $lt: thirtyDaysAgo } }
          ]
        }
      }
    }
  ]);

  logger.info(`Cleanup completed using bulkWrite. Removed ${result.deletedCount || 0} document(s).`);
  await client.close();
}

main().catch(err => {
  logger.error('Cleanup failed', { error: err.message });
  process.exit(1);
});
