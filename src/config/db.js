const { MongoClient } = require('mongodb');
const env = require('./env');
const logger = require('../utils/logger');

const client = new MongoClient(env.mongoUrl);
let db = null;

async function connectDb() {
  if (db) return db;
  await client.connect();
  db = client.db(env.mongoDbName);
  logger.info('Connected to MongoDB');

  // Ensure indexes
  try {
    const col = db.collection('documents');
    await col.createIndex({ created_at: -1 });
    await col.createIndex({ expires_at: 1 }, { sparse: true });
    await col.createIndex({ user_id: 1 });

    const historyCol = db.collection('upload_history');
    await historyCol.createIndex({ user_id: 1, created_at: -1 });

    logger.info('MongoDB indexes verified');
  } catch (err) {
    logger.error('Failed to create indexes in MongoDB', { error: err.message });
  }

  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not connected. Please call connectDb first.');
  }
  return db;
}

async function healthCheck() {
  try {
    const database = await connectDb();
    const res = await database.command({ ping: 1 });
    return res.ok === 1;
  } catch (err) {
    logger.error('MongoDB health check failed', { error: err.message });
    return false;
  }
}

module.exports = {
  client,
  connectDb,
  getDb,
  healthCheck
};
