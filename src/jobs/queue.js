import { Queue } from "bullmq";
import "dotenv/config";
import { URL } from "url";

const redisUrl = new URL(process.env.REDIS_URL);

const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port),
  password: redisUrl.password,
  tls: {}, // 👈 required for rediss://
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
