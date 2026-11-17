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
