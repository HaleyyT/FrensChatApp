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

// Load environment variables before reading config such as PORT or CLIENT_URL.
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const server = http.createServer(app);

app.use(express.json()); 
app.use(cookieParser());

app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));

app.use("/api/auth", authRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/user", userRoutes);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Attach Socket.IO to the same HTTP server so REST and realtime events share one backend entry point.
attachSocketServer(server, CLIENT_URL);

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
