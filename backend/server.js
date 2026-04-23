import express from "express";
import http from "http";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import messageRoutes from "./routes/message.routes.js";
import connectToMongoDB from "./db/connectToMongoDB.js";
import userRoutes from "./routes/user.routes.js";
import cors from "cors";
import { attachSocketServer } from "./socket/socket.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Load environment variables before reading config such as PORT or CLIENT_URL.
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const allowedOrigins = CLIENT_URL.split(",").map((origin) => origin.trim());
const server = http.createServer(app);

app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json()); 
app.use(cookieParser());

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Keep public endpoints responsive while slowing brute-force login and message spam attempts.
app.use("/api/auth", authLimiter);
app.use("/api/message", messageLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/user", userRoutes);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Attach Socket.IO to the same HTTP server so REST and realtime events share one backend entry point.
attachSocketServer(server, allowedOrigins);

async function start() {
  try {
    await connectToMongoDB(); 
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use.`);
        process.exit(1);
      }
      throw err;
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();

function shutdown() {
  console.log("Shutting down...");
  if (server.listening) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
