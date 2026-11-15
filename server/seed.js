const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');

const seedDemoUser = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/routex';
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('[Seed] Connected to MongoDB.');

    const demoEmail = 'traveler@routex.io';
    const existing = await User.findOne({ email: demoEmail });

    if (!existing) {
      const demoUser = await User.create({
        name: 'Alex Morgan',
        email: demoEmail,
        password: 'RouteX2026!',
        savedRoutes: [
          {
            origin: {
              name: 'Central Park, Manhattan, New York, NY, USA',
              lat: 40.785091,
              lon: -73.968285,
            },
            destination: {
              name: 'Brooklyn Bridge, New York, NY 10038, USA',
              lat: 40.706086,
              lon: -73.996864,
            },
            distance: 11200,
            duration: 1560,
            mode: 'driving',
            createdAt: new Date(),
          },
        ],
      });
      console.log(`[Seed] Demo user created: ${demoUser.email} / RouteX2026!`);
    } else {
      console.log(`[Seed] Demo user ${demoEmail} already exists.`);
    }

    await mongoose.disconnect();
    console.log('[Seed] Done.');
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
  }
};

seedDemoUser();

