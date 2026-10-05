require('dotenv').config();
const connectDB = require('../db');
const { DEMO_EMAIL, ensureDemoAccount } = require('../services/demoAccount');

async function main() {
  await connectDB(process.env.MONGO_URI || 'mongodb://localhost:27017/jdhub');
  const { user, seeded } = await ensureDemoAccount();
  console.log(`Demo account ready: ${DEMO_EMAIL} (${user._id})`);
  console.log(JSON.stringify(seeded));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
