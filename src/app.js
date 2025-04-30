import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from 'body-parser';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(bodyParser.json({ limit: '5mb' }));
app.get("/", (req, res) => res.send("Hello"));

// Improved CORS configuration
app.use(
  cors({
    origin: process.env.REACT_APP_FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "X-Requested-With",
      "Accept",
      "Accept-Version",
      "Content-Length",
      "Content-MD5",
      "Date",
      "X-Api-Version"
    ],
    exposedHeaders: ["Content-Range", "X-Content-Range"]
  })
);

app.use(cookieParser());

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  }
}));

import authenticationRouter from "./routers/authentication.router.js";
import SubscriptionRouter from "./routers/subscription.router.js";
import paymentRouter from "./routers/payment.router.js";
import redirectRouter from "./routers/redirect.router.js"

app.use('/', SubscriptionRouter);
app.use('/', authenticationRouter);
app.use('/', paymentRouter);
app.use('/',redirectRouter);

export default app;
