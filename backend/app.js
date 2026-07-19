import express from "express";
import http from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.routes.js";
import messageRoutes from "./routes/message.routes.js";
import userRoutes from "./routes/user.routes.js";
import { attachSocketServer } from "./socket/socket.js";
import { errorHandler, notFoundHandler } from "./middleWare/errorHandler.js";
import { requestLogger } from "./middleWare/requestLogger.js";

export function createApp({
  allowedOrigins = ["http://localhost:5173"],
  disableRateLimit = false,
} = {}) {
  const app = express();
  const server = http.createServer(app);

  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => disableRateLimit,
  });

  const messageLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => disableRateLimit,
  });

  app.use("/api/auth", authLimiter);
  app.use("/api/message", messageLimiter);

  app.use("/api/auth", authRoutes);
  app.use("/api/message", messageRoutes);
  app.use("/api/user", userRoutes);

  // Load balancers and release tooling can use this unauthenticated route to confirm the API is ready.
  app.get("/healthz", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/", (req, res) => {
    res.send("Hello World!");
  });

  attachSocketServer(server, allowedOrigins);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, server };
}
