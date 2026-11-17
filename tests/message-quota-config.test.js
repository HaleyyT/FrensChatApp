import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../backend/utils/config.js";

const env = {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://localhost/frenschat-test",
  JWT_SECRET: "test-secret-not-for-deployment",
};

test("the deployment can keep its existing behavior without Redis", () => {
  assert.equal(loadConfig(env).messageQuota, null);
});

test("Redis quotas use bounded defaults and accept TLS configuration", () => {
  const REDIS_URL = "rediss://redis.test:6379";
  assert.deepEqual(loadConfig({ ...env, REDIS_URL }).messageQuota, {
    url: REDIS_URL,
    limit: 10,
    windowMs: 10000,
  });
  const config = loadConfig({
    ...env, REDIS_URL, MESSAGE_QUOTA_LIMIT: "3", MESSAGE_QUOTA_WINDOW_MS: "1500",
  });
  assert.equal(config.messageQuota.limit, 3);
  assert.equal(config.messageQuota.windowMs, 1500);
});

test("invalid quota settings are rejected without leaking connection credentials", () => {
  assert.throws(
    () => loadConfig({ ...env, REDIS_URL: "https://user:private-value@redis.test" }),
    { message: "REDIS_URL must use redis:// or rediss:// and include a hostname" }
  );
  const REDIS_URL = "redis://redis.test";
  assert.throws(() => loadConfig({ ...env, REDIS_URL, MESSAGE_QUOTA_LIMIT: "0" }), /MESSAGE_QUOTA_LIMIT/);
  assert.throws(() => loadConfig({ ...env, REDIS_URL, MESSAGE_QUOTA_WINDOW_MS: "999" }), /MESSAGE_QUOTA_WINDOW_MS/);
});

test("repeat policy is opt-in and bounded by the sender quota", () => {
  const REDIS_URL = "redis://localhost";
  assert.equal(loadConfig({ ...env, REDIS_URL, MESSAGE_REPEAT_LIMIT: "" }).messageQuota.repeat, undefined);
  assert.equal(loadConfig({ ...env, REDIS_URL, MESSAGE_REPEAT_LIMIT: "2" }).messageQuota.repeat.limit, 2);
  assert.throws(() => loadConfig({ ...env, REDIS_URL, MESSAGE_REPEAT_LIMIT: "11" }), /MESSAGE_REPEAT_LIMIT/);
});

test("startup rejects invalid deployment settings and unsafe fallback credentials", () => {
  for (const [overrides, message] of [
    [{ NODE_ENV: "unknown" }, /NODE_ENV/],
    [{ PORT: "65536" }, /PORT/],
    [{ MONGO_URI: "" }, /MONGO_URI is required/],
    [{ JWT_SECRET: "" }, /JWT_SECRET is required/],
    [{ JWT_SECRET: "short" }, /at least 16/],
    [{ CLIENT_URL: " , " }, /at least one allowed origin/],
    [{ CLIENT_URL: "invalid origin" }, /invalid URL/],
    [{ CLIENT_URL: "ftp://localhost" }, /unsupported protocol/],
    [{ REDIS_URL: "invalid redis" }, /valid Redis URL/],
    [{ REDIS_URL: "redis://localhost", MESSAGE_REPEAT_LIMIT: "2", MESSAGE_REPEAT_WINDOW_MS: "60001" }, /MESSAGE_REPEAT_WINDOW_MS/],
    [{ NODE_ENV: "production", MONGO_URI: "your_mongodb_connection_string" }, /MONGO_URI cannot/],
    [{ NODE_ENV: "production", JWT_SECRET: "replace-me-with-a-secret" }, /JWT_SECRET cannot/],
    [{ NODE_ENV: "production", CLIENT_URL: "https://example.com" }, /CLIENT_URL cannot/],
  ]) {
    assert.throws(() => loadConfig({ ...env, ...overrides }), message);
  }
  assert.deepEqual(loadConfig({ ...env, CLIENT_URL: " https://chat.invalid, http://localhost:5173 " }).allowedOrigins,
    ["https://chat.invalid", "http://localhost:5173"]);
});
