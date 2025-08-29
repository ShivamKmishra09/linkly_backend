// src/jobs/queue.js

import { Queue } from "bullmq";
import "dotenv/config";
import { URL } from "url"; // Import the URL parser

let redisConnectionOptions;

// Check if the REDIS_URL environment variable is available (for production)
if (process.env.REDIS_URL) {
  const redisUrl = new URL(process.env.REDIS_URL);
  redisConnectionOptions = {
    host: redisUrl.hostname,
    port: redisUrl.port,
    password: redisUrl.password,
    // For Upstash, TLS is required
    tls: {
      rejectUnauthorized: false,
    },
  };
} else {
  // Fallback for local development
  redisConnectionOptions = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
  };
}

export const analysisQueue = new Queue("link-analysis", {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: "exponential",
      delay: 5000, // wait 5s before first retry
    },
  },
});
