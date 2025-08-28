import { connectDB } from "../db/index.js";
import { User } from "../models/User.js";
import { Collection } from "../models/Collection.js";
import { createSystemCollections } from "../services/systemCollectionService.js";
import "dotenv/config";

const createSystemCollectionsForExistingUsers = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      // Check if user already has system collections
      const existingSystemCollections = await Collection.find({
        owner: user._id,
        isSystem: true
      });

      if (existingSystemCollections.length === 0) {
        try {
          await createSystemCollections(user._id);
          console.log(`✅ Created system collections for user: ${user.username} (${user._id})`);
          createdCount++;
        } catch (error) {
          console.error(`❌ Failed to create system collections for user ${user.username}:`, error.message);
        }
      } else {
        console.log(`⏭️  User ${user.username} already has ${existingSystemCollections.length} system collections`);
        skippedCount++;
      }
    }

    console.log(`\n🎉 Summary:`);
    console.log(`Created system collections for: ${createdCount} users`);
    console.log(`Skipped (already exist): ${skippedCount} users`);
    console.log(`Total processed: ${users.length} users`);

    process.exit(0);
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
};

createSystemCollectionsForExistingUsers(); 