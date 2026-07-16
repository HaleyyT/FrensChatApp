import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { io as createSocketClient } from "socket.io-client";
import {
  clearDatabase,
  createTestEnvironment,
  destroyTestEnvironment,
  listenTestServer,
} from "./helpers/testEnvironment.js";

let environment;
let baseUrl;

before(async () => {
  environment = await createTestEnvironment();
  baseUrl = await listenTestServer(environment.server);
});

beforeEach(async () => {
  await clearDatabase();
});

after(async () => {
  await destroyTestEnvironment(environment);
});

function extractCookie(response) {
  return (response.headers["set-cookie"] || [])
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

function createAuthedSocket(cookie) {
  return createSocketClient(baseUrl, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    extraHeaders: {
      Cookie: cookie,
    },
  });
}

function waitForEvent(socket, eventName, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.off(eventName, handleEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    function handleEvent(payload) {
      clearTimeout(timeoutId);
      socket.off(eventName, handleEvent);
      resolve(payload);
    }

    socket.on(eventName, handleEvent);
  });
}

function waitForMatchingEvent(socket, eventName, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.off(eventName, handleEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    function handleEvent(payload) {
      if (!predicate(payload)) {
        return;
      }

      clearTimeout(timeoutId);
      socket.off(eventName, handleEvent);
      resolve(payload);
    }

    socket.on(eventName, handleEvent);
  });
}

function expectNoEvent(socket, eventName, timeoutMs = 500) {
  return new Promise((resolve, reject) => {
    function handleEvent(payload) {
      clearTimeout(timeoutId);
      socket.off(eventName, handleEvent);
      reject(new Error(`Did not expect ${eventName}: ${JSON.stringify(payload)}`));
    }

    const timeoutId = setTimeout(() => {
      socket.off(eventName, handleEvent);
      resolve();
    }, timeoutMs);

    socket.on(eventName, handleEvent);
  });
}

async function signUpUser({ fullName, username, gender }) {
  const response = await request(environment.server)
    .post("/api/auth/signup")
    .send({
      fullName,
      username,
      password: "secret12",
      confirmPassword: "secret12",
      gender,
    })
    .expect(201);

  return {
    user: response.body,
    cookie: extractCookie(response),
  };
}

test("socket middleware rejects unauthenticated connections", async () => {
  const socket = createSocketClient(baseUrl, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });

  const error = await waitForEvent(socket, "connect_error");
  assert.match(error.message, /Unauthorized socket connection/);
  socket.close();
});

test("typing events go only to the intended receiver", async () => {
  const sender = await signUpUser({
    fullName: "Sender User",
    username: "senderuser",
    gender: "female",
  });
  const intendedReceiver = await signUpUser({
    fullName: "Receiver User",
    username: "receiveruser",
    gender: "male",
  });
  const bystander = await signUpUser({
    fullName: "Bystander User",
    username: "bystanderuser",
    gender: "female",
  });

  const senderSocket = createAuthedSocket(sender.cookie);
  const receiverSocket = createAuthedSocket(intendedReceiver.cookie);
  const bystanderSocket = createAuthedSocket(bystander.cookie);

  await Promise.all([
    waitForEvent(senderSocket, "onlineUsers"),
    waitForEvent(receiverSocket, "onlineUsers"),
    waitForEvent(bystanderSocket, "onlineUsers"),
  ]);

  const receiverTypingPromise = waitForEvent(receiverSocket, "typing");
  const bystanderTypingPromise = expectNoEvent(bystanderSocket, "typing");

  senderSocket.emit("typing", { receiverId: intendedReceiver.user._id });

  const typingPayload = await receiverTypingPromise;
  await bystanderTypingPromise;

  assert.equal(typingPayload.senderId, sender.user._id);

  senderSocket.close();
  receiverSocket.close();
  bystanderSocket.close();
});

test("message and read receipt events stay scoped to the right user room", async () => {
  const sender = await signUpUser({
    fullName: "Message Sender",
    username: "messagesender",
    gender: "female",
  });
  const receiver = await signUpUser({
    fullName: "Message Receiver",
    username: "messagereceiver",
    gender: "male",
  });
  const outsider = await signUpUser({
    fullName: "Outsider User",
    username: "outsideruser",
    gender: "female",
  });

  const senderSocket = createAuthedSocket(sender.cookie);
  const receiverSocket = createAuthedSocket(receiver.cookie);
  const outsiderSocket = createAuthedSocket(outsider.cookie);

  await Promise.all([
    waitForEvent(senderSocket, "onlineUsers"),
    waitForEvent(receiverSocket, "onlineUsers"),
    waitForEvent(outsiderSocket, "onlineUsers"),
  ]);

  const newMessagePromise = waitForEvent(receiverSocket, "newMessage");
  const outsiderNewMessagePromise = expectNoEvent(outsiderSocket, "newMessage");

  const messageResponse = await request(environment.server)
    .post(`/api/message/send/${receiver.user._id}`)
    .set("Cookie", sender.cookie)
    .send({ message: "Realtime hello" })
    .expect(201);

  const realtimeMessage = await newMessagePromise;
  await outsiderNewMessagePromise;

  assert.equal(realtimeMessage._id, messageResponse.body._id);

  const senderReadPromise = waitForEvent(senderSocket, "messagesRead");
  const outsiderReadPromise = expectNoEvent(outsiderSocket, "messagesRead");

  await request(environment.server)
    .patch(`/api/message/read/${sender.user._id}`)
    .set("Cookie", receiver.cookie)
    .expect(200);

  const readReceiptPayload = await senderReadPromise;
  await outsiderReadPromise;

  assert.equal(readReceiptPayload.readerId, receiver.user._id);
  assert.equal(readReceiptPayload.messageIds.length, 1);

  senderSocket.close();
  receiverSocket.close();
  outsiderSocket.close();
});

test("onlineUsers updates after disconnects", async () => {
  const firstUser = await signUpUser({
    fullName: "Presence One",
    username: "presenceone",
    gender: "female",
  });
  const secondUser = await signUpUser({
    fullName: "Presence Two",
    username: "presencetwo",
    gender: "male",
  });

  const firstSocket = createAuthedSocket(firstUser.cookie);
  const secondSocket = createAuthedSocket(secondUser.cookie);

  const initialOnlineUsersPromise = waitForMatchingEvent(
    secondSocket,
    "onlineUsers",
    (onlineUsers) =>
      onlineUsers.includes(firstUser.user._id) && onlineUsers.includes(secondUser.user._id),
  );
  const firstSocketConnectedPromise = waitForEvent(firstSocket, "connect");
  const secondSocketConnectedPromise = waitForEvent(secondSocket, "connect");

  const [initialOnlineUsers] = await Promise.all([
    initialOnlineUsersPromise,
    firstSocketConnectedPromise,
    secondSocketConnectedPromise,
  ]);

  assert.ok(initialOnlineUsers.includes(firstUser.user._id));

  const disconnectUpdatePromise = waitForEvent(secondSocket, "onlineUsers");
  firstSocket.close();

  const updatedOnlineUsers = await disconnectUpdatePromise;
  assert.ok(!updatedOnlineUsers.includes(firstUser.user._id));
  assert.ok(updatedOnlineUsers.includes(secondUser.user._id));

  secondSocket.close();
});
