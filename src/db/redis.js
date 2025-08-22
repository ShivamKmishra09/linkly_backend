import Redis from "ioredis";
import "dotenv/config";

// Add your Render Redis URL or other production URL here
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const redisClient = new Redis(redisUrl);

redisClient.on("connect", () => console.log("✅ Redis Client Connected"));
redisClient.on("error", (err) =>
  console.error("Redis Client Connection Error", err)
);

export default redisClient;
