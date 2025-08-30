import { Queue } from "bullmq";
import "dotenv/config";

const connection = process.env.REDIS_URL || {
  host: "127.0.0.1",
  port: 6379,
};

export const analysisQueue = new Queue("link-analysis", {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: "exponential",
      delay: 5000, // wait 5s before first retry
    },
  },
});
