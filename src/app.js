import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session"; // 1. Import express-session
import RedisStore from "connect-redis"; // 2. Import connect-redis
import redisClient from "./db/redis.js"; // 3. Import your configured Redis client

const app = express();

// --- Middleware Setup ---

// 4. Initialize Redis store for sessions
const redisStore = new RedisStore({
  client: redisClient,
  prefix: "linkly-session:", // A prefix to keep session keys organized in Redis
});

// Use CORS - This should come before routes and session middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// Standard middleware for parsing JSON, URL-encoded data, and cookies
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// 5. Configure and use session middleware with Redis
app.use(
  session({
    store: redisStore,
    secret: process.env.SESSION_SECRET, // A strong secret for signing the session ID cookie
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something is stored
    cookie: {
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production (HTTPS)
      httpOnly: true, // Prevents client-side JS from reading the cookie
      maxAge: 1000 * 60 * 60 * 24 * 7, // Session TTL: 7 days
    },
  })
);

// --- Route Imports ---
import authRouter from "./routers/authentication.router.js";
import redirectRouter from "./routers/redirect.router.js";
import collectionRouter from "./routers/collection.router.js";
import subscriptionRouter from "./routers/subscription.router.js";
import paymentRouter from "./routers/payment.router.js";

// --- Route Declarations ---
app.use("/api/v1/users", authRouter);
app.use("/api/v1/url", redirectRouter);
app.use("/api/v1/collections", collectionRouter);
app.use("/api/v1/subscription", subscriptionRouter);
app.use("/api/v1/payment", paymentRouter);

export { app };
