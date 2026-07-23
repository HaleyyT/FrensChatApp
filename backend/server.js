import dotenv from "dotenv";
import mongoose from "mongoose";
import connectToMongoDB from "./db/connectToMongoDB.js";
import { loadConfig } from "./utils/config.js";
import { createApp } from "./app.js";
import { logError, logInfo } from "./utils/logger.js";
import { setServiceReady } from "./utils/readiness.js";
import { resetSocketState } from "./socket/socket.js";

// Load environment variables before reading config such as PORT or CLIENT_URL.
dotenv.config();

const config = loadConfig();
const { PORT, allowedOrigins } = config;
const { server } = createApp({ allowedOrigins });
let isShuttingDown = false;

async function start() {
  try {
    await connectToMongoDB();
    setServiceReady(true);
    server.listen(PORT, () => {
      logInfo("server_started", { port: PORT });
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        logError("server_start_failed", { code: err.code, port: PORT });
        process.exit(1);
      }
      logError("server_error", { errorName: err.name, errorMessage: err.message });
      process.exit(1);
    });
  } catch (err) {
    setServiceReady(false);
    logError("server_start_failed", { errorName: err.name, errorMessage: err.message });
    process.exit(1);
  }
}

start();

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  setServiceReady(false);
  logInfo("server_shutdown_started", { signal });

  const forceExitTimeout = setTimeout(() => {
    logError("server_shutdown_timed_out", { timeoutMs: 10000 });
    process.exit(1);
  }, 10000);

  try {
    resetSocketState();

    if (server.listening) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }

    await mongoose.disconnect();
    logInfo("server_shutdown_completed", { signal });
    clearTimeout(forceExitTimeout);
    process.exit(0);
  } catch (error) {
    logError("server_shutdown_failed", { errorName: error.name, errorMessage: error.message });
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
