import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestEnvironment, clearDatabase, destroyTestEnvironment } from "./helpers/testEnvironment.js";

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
