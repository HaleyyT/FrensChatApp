import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../backend/app.js";
import { resetSocketState } from "../../backend/socket/socket.js";
import { setServiceReady } from "../../backend/utils/readiness.js";

export async function createTestEnvironment() {
  process.env.NODE_ENV = "test";
  process.env.PORT = "5000";
  process.env.CLIENT_URL = "http://localhost:5173";
  process.env.JWT_SECRET = "1234567890abcdef";

  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "alpine-chat-test",
  });
  setServiceReady(true);

  const { app, server } = createApp({
    allowedOrigins: ["http://localhost:5173"],
    disableRateLimit: true,
  });

  return {
    app,
    server,
    mongoServer,
  };
}

export async function listenTestServer(server) {
  await new Promise((resolve, reject) => {
    server.listen(0, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Test server did not expose a TCP port");
  }

  return `http://127.0.0.1:${address.port}`;
}

export async function clearDatabase() {
  const collections = mongoose.connection.collections;

  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
}

export async function destroyTestEnvironment({ server, mongoServer }) {
  if (!server || !mongoServer) {
    resetSocketState();
    return;
  }

  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  resetSocketState();
  setServiceReady(false);
  await mongoose.disconnect();
  await mongoServer.stop();
}
