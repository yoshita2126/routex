const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/routex';
  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully to: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.warn(`[MongoDB] Initial connection error (${mongoUri}): ${error.message}`);
    // If localhost failed due to IPv6, retry with 127.0.0.1
    if (mongoUri.includes('localhost')) {
      const fallbackUri = mongoUri.replace('localhost', '127.0.0.1');
      try {
        const conn = await mongoose.connect(fallbackUri, {
          serverSelectionTimeoutMS: 5000,
        });
        console.log(`[MongoDB] Connected via fallback to: ${conn.connection.host}/${conn.connection.name}`);
        return;
      } catch (fallbackError) {
        console.error(`[MongoDB] Fallback connection failed: ${fallbackError.message}`);
      }
    }
    process.exit(1);
  }
};

module.exports = connectDB;
