import { createHmac, randomUUID } from "node:crypto";
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
  return {1, math.max(1, math.ceil((tonumber(oldest[2]) + window - now) / 1000))}
end

if KEYS[2] then
  local count = redis.call("GET", KEYS[2])
  if count == "blocked" then
    return {2, math.max(1, math.ceil(redis.call("PTTL", KEYS[2]) / 1000))}
  end
  if count and tonumber(count) >= tonumber(ARGV[4]) then
    redis.call("SET", KEYS[2], "blocked", "PX", ARGV[5])
    return {2, math.ceil(tonumber(ARGV[5]) / 1000)}
  end
  if redis.call("INCR", KEYS[2]) == 1 then
    redis.call("PEXPIRE", KEYS[2], ARGV[5])
  end
end

redis.call("ZADD", KEYS[1], now, ARGV[3])
redis.call("PEXPIRE", KEYS[1], window)
return {0, 0}
`;

export function createMessageQuota({ url, limit, windowMs, repeat }) {
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

    async check(senderId, message) {
      if (!client.isReady) throw new Error("Message quota store unavailable");

      // Preserve the Day 1 quota key. Both keys hash to the sender's slot when repeat checks are enabled.
      const quotaKey = `frenschat:message-quota:v1:${senderId}`;
      const keys = [quotaKey];
      const args = [String(limit), String(windowMs), randomUUID()];
      if (repeat) {
        const normalized = message.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
        const fingerprint = createHmac("sha256", repeat.secret)
          .update(`frenschat-repeat-v1\0${normalized}`)
          .digest("hex");
        keys.push(`{${quotaKey}}:repeat:${fingerprint}`);
        args.push(String(repeat.limit), String(repeat.windowMs));
      }

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
        const [reason, retryAfter] = await Promise.race([
          client.withCommandOptions({ abortSignal: abort.signal }).eval(SLIDING_WINDOW, {
            keys,
            arguments: args,
          }),
          deadline,
        ]);
        return { retryAfter, repeated: reason === 2 };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
