const mongoose = require('mongoose');
require('dotenv').config();
const FinanceForecast = require('../models/FinanceForecast');
const fixture = require('../fixtures/financeForecast');

async function run() {
  const userId = process.env.FORECAST_USER_ID;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new Error('Set FORECAST_USER_ID to a disposable test account for the synthetic forecast.');
  }
  if (!process.env.MONGO_URI) {
    throw new Error('Set MONGO_URI explicitly to a disposable development database before seeding.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const forecast = await FinanceForecast.findOneAndUpdate(
    { user_id: new mongoose.Types.ObjectId(userId), name: fixture.name },
    {
      $set: fixture,
      $unset: { archived_at: '' },
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );

  console.log(`Synthetic finance forecast ready: ${forecast._id}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}

module.exports = { run };
