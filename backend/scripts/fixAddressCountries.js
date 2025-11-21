import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sunandvemavarapu_db_user:f0bvswyEV5YiTbup@custom-tees.2oo4bft.mongodb.net/';

async function fixAddressCountries() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all users with addresses that have empty or missing country fields
    const users = await User.find({
      'addresses.country': { $in: [null, '', undefined] }
    });

    console.log(`📋 Found ${users.length} users with addresses missing country fields`);

    let totalFixed = 0;

    for (const user of users) {
      let userFixed = false;
      
      for (const address of user.addresses) {
        if (!address.country || address.country.trim() === '') {
          address.country = 'US';
          userFixed = true;
          totalFixed++;
          console.log(`  ✓ Fixed address for user: ${user.email} (${user.name})`);
        }
      }

      if (userFixed) {
        await user.save();
      }
    }

    console.log(`\n✅ Migration complete! Fixed ${totalFixed} address(es)`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAddressCountries();

