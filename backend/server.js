import dotenv from "dotenv";
import connectToMongoDB from "./db/connectToMongoDB.js";
import { loadConfig } from "./utils/config.js";
import { createApp } from "./app.js";

// Load environment variables before reading config such as PORT or CLIENT_URL.
dotenv.config();

const config = loadConfig();
const { PORT, allowedOrigins } = config;
const { server } = createApp({ allowedOrigins });

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
