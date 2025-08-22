import { Worker } from "bullmq";
import "dotenv/config";
import { Link } from "../models/Link.js";
import { analyzeUrlContent } from "../services/aiService.js";
// --- 1. IMPORT YOUR DATABASE CONNECTION FUNCTION ---
import { connectDB } from "../db/index.js";

// --- 2. DEFINE THE REDIS CONNECTION OPTIONS ---
const redisConnectionOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  // Add this line to prevent the error from the previous step
  maxRetriesPerRequest: null,
};

// --- 3. CREATE AN ASYNC FUNCTION TO START THE WORKER ---
const startWorker = async () => {
  // --- 4. CONNECT TO MONGODB FIRST ---
  try {
    await connectDB();
    console.log("MongoDB connection established for AI worker.");
  } catch (error) {
    console.error(
      "Failed to connect to MongoDB for AI worker. Exiting.",
      error
    );
    process.exit(1); // Exit if DB connection fails
  }

  // --- 5. INITIALIZE THE WORKER ONLY AFTER DB IS CONNECTED ---
  const worker = new Worker(
    "link-analysis",
    async (job) => {
      const { linkId } = job.data;
      console.log(`Processing job for linkId: ${linkId}`);

      try {
        // Now this database call will work because we are connected
        const link = await Link.findById(linkId);
        if (!link) throw new Error("Link not found");

        const analysisResult = await analyzeUrlContent(link.longUrl);
        console.log(analysisResult);

        link.aiSummary = analysisResult.summary;
        link.aiTags = analysisResult.tags;
        link.aiSafetyRating = analysisResult.safety.safety_rating;
        link.aiSafetyJustification = analysisResult.safety.explanation;
        link.aiClassification = {
          category: analysisResult.classification.category,
          confidence: analysisResult.classification.confidence,
          reason: analysisResult.classification.reason,
        };
        link.analysisStatus = "COMPLETED";

        await link.save();
      } catch (error) {
        console.error(`Job failed for linkId: ${linkId}`, error);
        await Link.findByIdAndUpdate(linkId, { analysisStatus: "FAILED" });
      }
    },
    { connection: redisConnectionOptions }
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} has completed!`);
  });

  worker.on("failed", (job, err) => {
    console.log(`Job ${job.id} has failed with ${err.message}`);
  });

  console.log("AI Worker started and listening for jobs...");
};

// --- 6. RUN THE START FUNCTION ---
startWorker();
