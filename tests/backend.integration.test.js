import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../backend/models/user.models.js";
import Message from "../backend/models/message.model.js";
import { createTestEnvironment, clearDatabase, destroyTestEnvironment } from "./helpers/testEnvironment.js";
import { setServiceReady } from "../backend/utils/readiness.js";

let environment;

before(async () => {
  environment = await createTestEnvironment();
});

beforeEach(async () => {
  await clearDatabase();
});

after(async () => {
  await destroyTestEnvironment(environment);
});

test("health check reports readiness without authentication", async () => {
  setServiceReady(false);
  const unavailableResponse = await request(environment.app).get("/healthz").expect(503);
  assert.deepEqual(unavailableResponse.body, { status: "unavailable" });

  setServiceReady(true);
  const response = await request(environment.app).get("/healthz").expect(200);

  assert.deepEqual(response.body, { status: "ok" });
});

test("CORS exposes credentialed responses only to configured origins and unknown routes are structured", async () => {
  const allowed = await request(environment.app).get("/").set("Origin", "http://localhost:5173").expect(200);
  assert.equal(allowed.headers["access-control-allow-origin"], "http://localhost:5173");
  assert.equal(allowed.headers["access-control-allow-credentials"], "true");
  const denied = await request(environment.app).get("/").set("Origin", "https://other.invalid").expect(200);
  assert.equal(denied.headers["access-control-allow-origin"], undefined);
  const missing = await request(environment.app).get("/api/unknown").expect(404);
  assert.equal(missing.body.error.code, "NOT_FOUND");
  assert.ok(missing.headers["x-request-id"]);
  assert.equal(missing.body.error.requestId, missing.headers["x-request-id"]);
});

test("signup, restore session, logout, and reject protected route after logout", async () => {
  const agent = request.agent(environment.app);

  const signupResponse = await agent
    .post("/api/auth/signup")
    .send({
      fullName: "Haley Tran",
      username: "haleytran_test",
      password: "secret12",
      confirmPassword: "secret12",
      gender: "female",
    })
    .expect(201);

  assert.equal(signupResponse.body.username, "haleytran_test");

  const sessionResponse = await agent.get("/api/auth/me").expect(200);
  assert.equal(sessionResponse.body.username, "haleytran_test");

  await agent.post("/api/auth/logout").expect(200);

  const postLogoutResponse = await agent.get("/api/auth/me").expect(401);
  assert.equal(postLogoutResponse.body.error.code, "AUTH_REQUIRED");
});

test("login rejects invalid credentials with a stable error payload", async () => {
  const agent = request.agent(environment.app);

  await agent
    .post("/api/auth/signup")
    .send({
      fullName: "Haley Tran",
      username: "haleytran_valid",
      password: "secret12",
      confirmPassword: "secret12",
      gender: "female",
    })
    .expect(201);

  const response = await request(environment.app)
    .post("/api/auth/login")
    .send({
      username: "haleytran_valid",
      password: "wrong-password",
    })
    .expect(400);

  assert.equal(response.body.error.code, "INVALID_CREDENTIALS");
  assert.equal(response.body.error.message, "Invalid username or password");
});

test("send message, paginate history, mark read, and expose sidebar metadata", async () => {
  const firstUser = request.agent(environment.app);
  const secondUser = request.agent(environment.app);

  const firstSignup = await firstUser
    .post("/api/auth/signup")
    .send({
      fullName: "User One",
      username: "userone",
      password: "secret12",
      confirmPassword: "secret12",
      gender: "female",
    })
    .expect(201);

  const secondSignup = await secondUser
    .post("/api/auth/signup")
    .send({
      fullName: "User Two",
      username: "usertwo",
      password: "secret12",
      confirmPassword: "secret12",
      gender: "male",
    })
    .expect(201);

  const secondUserId = secondSignup.body._id;
  const firstUserId = firstSignup.body._id;

  await firstUser
    .post(`/api/message/send/${secondUserId}`)
    .send({ message: "First message" })
    .expect(201);

  const secondMessage = await firstUser
    .post(`/api/message/send/${secondUserId}`)
    .send({ message: "Second message" })
    .expect(201);

  const sidebarResponse = await secondUser.get("/api/user/").expect(200);
  const firstUserSidebarCard = sidebarResponse.body.filterUsers.find((user) => user._id === firstUserId);

  assert.ok(firstUserSidebarCard, "Expected sender to appear in the sidebar");
  assert.equal(firstUserSidebarCard.unreadCount, 2);
  assert.equal(firstUserSidebarCard.lastMessage.message, "Second message");

  const historyResponse = await secondUser
    .get(`/api/message/${firstUserId}`)
    .query({ limit: 1 })
    .expect(200);

  assert.equal(historyResponse.body.messages.length, 1);
  assert.equal(historyResponse.body.paging.hasMore, true);
  assert.equal(historyResponse.body.messages[0].message, "Second message");

  const olderHistoryResponse = await secondUser
    .get(`/api/message/${firstUserId}`)
    .query({ limit: 1, before: historyResponse.body.paging.nextCursor })
    .expect(200);

  assert.equal(olderHistoryResponse.body.messages.length, 1);
  assert.equal(olderHistoryResponse.body.messages[0].message, "First message");

  const markReadResponse = await secondUser
    .patch(`/api/message/read/${firstUserId}`)
    .expect(200);

  assert.equal(markReadResponse.body.readMessageIds.length, 2);

  const senderHistoryResponse = await firstUser
    .get(`/api/message/${secondUserId}`)
    .query({ limit: 5 })
    .expect(200);

  const readSecondMessage = senderHistoryResponse.body.messages.find((message) => message._id === secondMessage.body._id);
  assert.ok(readSecondMessage.readAt, "Expected sender history to include read timestamp after mark-as-read");
});

test("protected message routes reject malformed ids and self-messaging", async () => {
  const agent = request.agent(environment.app);

  const signupResponse = await agent
    .post("/api/auth/signup")
    .send({
      fullName: "User One",
      username: "selfcheck",
      password: "secret12",
      confirmPassword: "secret12",
      gender: "female",
    })
    .expect(201);

  const malformedIdResponse = await agent
    .get("/api/message/not-a-real-id")
    .query({ limit: 10 })
    .expect(400);

  assert.equal(malformedIdResponse.body.error.code, "INVALID_ID");

  const selfMessageResponse = await agent
    .post(`/api/message/send/${signupResponse.body._id}`)
    .send({ message: "Hello self" })
    .expect(400);

  assert.equal(selfMessageResponse.body.error.code, "SELF_MESSAGE_FORBIDDEN");
});

const credentials = (username) => ({
  fullName: "Coverage Test", username, password: "secret12", confirmPassword: "secret12", gender: "female",
});

test("login normalizes usernames, protects credentials, and rejects duplicate accounts", async () => {
  const user = credentials("coverage_login");
  const agent = request.agent(environment.app);
  await agent.post("/api/auth/signup").send(user).expect(201);
  const duplicate = await agent.post("/api/auth/signup").send(user).expect(400);
  assert.equal(duplicate.body.error.code, "USERNAME_TAKEN");
  assert.equal(await User.countDocuments({ username: user.username }), 1);
  const response = await agent.post("/api/auth/login")
    .send({ username: " COVERAGE_LOGIN ", password: user.password }).expect(200);
  assert.equal(response.body.username, user.username);
  assert.equal(response.body.password, undefined);
  assert.match(response.headers["set-cookie"][0], /HttpOnly/i);
  assert.notEqual((await User.findOne({ username: user.username })).password, user.password);
});

test("invalid, expired, and orphaned sessions never grant protected access", async () => {
  const secret = process.env.JWT_SECRET;
  const userId = new mongoose.Types.ObjectId().toString();
  for (const [token, code] of [
    ["invalid", "UNAUTHORIZED"],
    [jwt.sign({}, secret), "INVALID_TOKEN"],
    [jwt.sign({ userId }, secret, { expiresIn: -1 }), "UNAUTHORIZED"],
    [jwt.sign({ userId }, secret), "USER_NOT_FOUND"],
  ]) {
    const response = await request(environment.app).get("/api/auth/me").set("Cookie", `jwt=${token}`).expect(401);
    assert.equal(response.body.error.code, code);
  }
});

test("malformed inputs return stable codes and cannot create messages", async () => {
  const agent = request.agent(environment.app);
  const payload = credentials("validation");
  for (const [change, code] of [
    [{ fullName: "" }, "MISSING_REQUIRED_FIELDS"],
    [{ username: "bad name" }, "INVALID_USERNAME"],
    [{ gender: "unknown" }, "INVALID_GENDER"],
    [{ password: "short" }, "INVALID_PASSWORD"],
    [{ confirmPassword: "different" }, "PASSWORD_MISMATCH"],
  ]) {
    const response = await agent.post("/api/auth/signup").send({ ...payload, ...change }).expect(400);
    assert.equal(response.body.error.code, code);
  }
  const missing = await agent.post("/api/auth/login").send({}).expect(400);
  assert.equal(missing.body.error.code, "MISSING_CREDENTIALS");
  await agent.post("/api/auth/signup").send(payload).expect(201);
  const other = new mongoose.Types.ObjectId().toString();
  for (const [message, status, code] of [
    [" ", 400, "INVALID_MESSAGE"], ["x".repeat(2001), 400, "MESSAGE_TOO_LONG"], ["ok", 404, "RECEIVER_NOT_FOUND"],
  ]) {
    const response = await agent.post(`/api/message/send/${other}`).send({ message }).expect(status);
    assert.equal(response.body.error.code, code);
  }
  for (const [query, code] of [[{ limit: 101 }, "INVALID_LIMIT"], [{ before: "invalid" }, "INVALID_CURSOR"]]) {
    const response = await agent.get(`/api/message/${other}`).query(query).expect(400);
    assert.equal(response.body.error.code, code);
  }
  assert.equal(await Message.countDocuments(), 0);
});

test("third parties cannot read or mark a conversation between two other accounts", async () => {
  const agents = Array.from({ length: 3 }, () => request.agent(environment.app));
  const ids = [];
  for (const [index, agent] of agents.entries()) {
    ids.push((await agent.post("/api/auth/signup").send(credentials(`isolated_${index}`)).expect(201)).body._id);
  }
  const [sender, receiver, thirdParty] = agents;
  const sent = await sender.post(`/api/message/send/${ids[1]}`).send({ message: "Participant-only message" }).expect(201);
  const history = await thirdParty.get(`/api/message/${ids[0]}`).expect(200);
  assert.deepEqual(history.body.messages, []);
  const read = await thirdParty.patch(`/api/message/read/${ids[0]}`).expect(200);
  assert.deepEqual(read.body.readMessageIds, []);
  assert.equal((await Message.findById(sent.body._id)).readAt, null);
  assert.deepEqual((await receiver.patch(`/api/message/read/${ids[0]}`).expect(200)).body.readMessageIds, [sent.body._id]);
  assert.deepEqual((await receiver.patch(`/api/message/read/${ids[0]}`).expect(200)).body.readMessageIds, []);
});
