const API_BASE_URL = process.env.SMOKE_API_BASE_URL || "http://127.0.0.1:5000/api";
const RUN_ID = Date.now().toString(36);

class SessionClient {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }

  buildCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  storeSetCookie(response) {
    const setCookieHeader = response.headers.get("set-cookie");

    if (!setCookieHeader) {
      return;
    }

    const [cookiePair] = setCookieHeader.split(";");
    const separatorIndex = cookiePair.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const name = cookiePair.slice(0, separatorIndex).trim();
    const value = cookiePair.slice(separatorIndex + 1).trim();

    if (!value) {
      this.cookies.delete(name);
      return;
    }

    this.cookies.set(name, value);
  }

  async request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const hasBody = options.body !== undefined;

    if (hasBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const cookieHeader = this.buildCookieHeader();

    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    this.storeSetCookie(response);

    const body = await response.json().catch(() => ({}));

    return { response, body };
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function printStep(message) {
  console.log(`- ${message}`);
}

async function run() {
  const userA = new SessionClient("User A");
  const userB = new SessionClient("User B");
  const usernameA = `smoke_a_${RUN_ID}`;
  const usernameB = `smoke_b_${RUN_ID}`;

  printStep(`Signing up ${usernameA}`);
  let result = await userA.request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Smoke User A",
      username: usernameA,
      password: "secret12",
      confirmPassword: "secret12",
      gender: "female",
    }),
  });
  assert(result.response.status === 201, `Expected signup for ${usernameA} to return 201`);
  const userARecord = result.body;

  printStep(`Signing up ${usernameB}`);
  result = await userB.request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Smoke User B",
      username: usernameB,
      password: "secret12",
      confirmPassword: "secret12",
      gender: "male",
    }),
  });
  assert(result.response.status === 201, `Expected signup for ${usernameB} to return 201`);
  const userBRecord = result.body;

  printStep("Checking authenticated session for User A");
  result = await userA.request("/auth/me");
  assert(result.response.status === 200, "Expected /auth/me for User A to return 200");
  assert(result.body.username === usernameA, "User A session did not match the signed-in user");

  printStep("Checking authenticated session for User B");
  result = await userB.request("/auth/me");
  assert(result.response.status === 200, "Expected /auth/me for User B to return 200");
  assert(result.body.username === usernameB, "User B session did not match the signed-in user");

  printStep("Loading sidebar for both users");
  const [sidebarA, sidebarB] = await Promise.all([
    userA.request("/user/"),
    userB.request("/user/"),
  ]);
  assert(sidebarA.response.status === 200, "Expected User A sidebar to return 200");
  assert(sidebarB.response.status === 200, "Expected User B sidebar to return 200");
  assert(
    sidebarA.body.filterUsers?.some((user) => user.username === usernameB),
    "User A sidebar did not include User B"
  );
  assert(
    sidebarB.body.filterUsers?.some((user) => user.username === usernameA),
    "User B sidebar did not include User A"
  );

  printStep("Sending a message from User A to User B");
  result = await userA.request(`/message/send/${userBRecord._id}`, {
    method: "POST",
    body: JSON.stringify({ message: "Smoke test hello from User A" }),
  });
  assert(result.response.status === 201, "Expected message send to return 201");
  const sentMessage = result.body;

  printStep("Loading the conversation for User B");
  result = await userB.request(`/message/${userARecord._id}?limit=10`);
  assert(result.response.status === 200, "Expected User B conversation load to return 200");
  const userBMessages = result.body.messages || [];
  assert(userBMessages.some((message) => message._id === sentMessage._id), "User B did not receive the sent message");

  printStep("Marking the message as read");
  result = await userB.request(`/message/read/${userARecord._id}`, {
    method: "PATCH",
  });
  assert(result.response.status === 200, "Expected mark-as-read to return 200");

  printStep("Verifying read state from User A's conversation view");
  result = await userA.request(`/message/${userBRecord._id}?limit=10`);
  assert(result.response.status === 200, "Expected User A conversation load to return 200");
  const updatedMessage = (result.body.messages || []).find((message) => message._id === sentMessage._id);
  assert(updatedMessage?.readAt, "Expected sent message to include a readAt timestamp after mark-as-read");

  printStep("Logging out both users");
  const [logoutA, logoutB] = await Promise.all([
    userA.request("/auth/logout", { method: "POST" }),
    userB.request("/auth/logout", { method: "POST" }),
  ]);
  assert(logoutA.response.status === 200, "Expected User A logout to return 200");
  assert(logoutB.response.status === 200, "Expected User B logout to return 200");

  printStep("Checking that the sessions are cleared");
  const [authAfterLogoutA, authAfterLogoutB] = await Promise.all([
    userA.request("/auth/me"),
    userB.request("/auth/me"),
  ]);
  assert(authAfterLogoutA.response.status === 401, "Expected User A /auth/me after logout to return 401");
  assert(authAfterLogoutB.response.status === 401, "Expected User B /auth/me after logout to return 401");

  console.log(`PASS: release smoke test succeeded against ${API_BASE_URL}`);
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});

