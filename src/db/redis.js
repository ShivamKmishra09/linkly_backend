// src/db/redis.js

import { createClient } from "redis";
import "dotenv/config";

let redisClient;

try {
  // Check if REDIS_URL is provided (for production environments like Railway)
  if (process.env.REDIS_URL) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      // For cloud providers that use TLS
      socket: {
        tls: true,
        rejectUnauthorized: false,
      },
    });
  } else {
    // Fallback for local development
    redisClient = createClient({
      url: "redis://127.0.0.1:6379",
    });
  }

  redisClient.on("error", (err) => {
    console.error("Redis Client Connection Error", err);
  });

  redisClient.on("connect", () => {
    console.log("Connected to Redis successfully!");
  });

  // Connect the client
  (async () => {
    await redisClient.connect();
  })();
} catch (err) {
  console.error("Failed to create Redis client:", err);
}

export default redisClient;
