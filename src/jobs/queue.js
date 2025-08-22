import { Queue } from "bullmq";
import "dotenv/config";

// Redis connection options
const redisConnectionOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
};

export const analysisQueue = new Queue("link-analysis", {
  connection: redisConnectionOptions, // Pass the options object
});
