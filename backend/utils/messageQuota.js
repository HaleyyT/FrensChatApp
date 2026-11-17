import { randomUUID } from "node:crypto";
import { createClient } from "redis";
import { logWarn } from "./logger.js";

// Use Redis's clock so replicas agree on which entries have expired.
const SLIDING_WINDOW = `
local clock = redis.call("TIME")
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now - window)
if redis.call("ZCARD", KEYS[1]) >= limit then
  local oldest = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
  return math.max(1, math.ceil((tonumber(oldest[2]) + window - now) / 1000))
end

redis.call("ZADD", KEYS[1], now, ARGV[3])
redis.call("PEXPIRE", KEYS[1], window)
return 0
`;

export function createMessageQuota({ url, limit, windowMs }) {
  const client = createClient({
    url,
    disableOfflineQueue: true,
    commandsQueueMaxLength: 256,
    socket: { connectTimeout: 1000 },
  });

  client.on("error", () => {
    logWarn("message_quota_redis_connection_error");
  });

  return {
    async connect() {
      await client.connect();
    },

    close() {
      if (client.isOpen) client.destroy();
    },

    // Zero indicates admission. A positive result is the retry delay in seconds.
    async retryAfterSeconds(senderId) {
      if (!client.isReady) throw new Error("Message quota store unavailable");

      const abort = new AbortController();
      let timer;
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          abort.abort();
          reject(new Error("Message quota check timed out"));
        }, 500);
      });

      try {
        // The abort signal cancels queued work. The deadline also bounds an in-flight wait.
        return await Promise.race([
          client.withCommandOptions({ abortSignal: abort.signal }).eval(SLIDING_WINDOW, {
            keys: [`frenschat:message-quota:v1:${senderId}`],
            arguments: [String(limit), String(windowMs), randomUUID()],
          }),
          deadline,
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
