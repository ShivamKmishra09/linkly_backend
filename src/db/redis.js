import { createClient } from "redis";

// The REDIS_URL will be provided by Render in production
// or fall back to a local connection for development.
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const redisClient = createClient({
  url: redisUrl,
});

redisClient.on("error", (err) => {
  console.error("Redis Client Connection Error", err);
});

redisClient.on("connect", () => {
  console.log("Connected to Redis successfully!");
});

// You must connect the client
(async () => {
  await redisClient.connect();
})();

export default redisClient;
