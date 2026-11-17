const VALID_NODE_ENVS = new Set(["development", "production", "test"]);
const PLACEHOLDER_PATTERNS = [
  "your_generated_secret",
  "your_secret",
  "changeme",
  "replace-me",
  "your_mongodb_connection_string",
  "example.com",
];

function isPlaceholderValue(value) {
  return PLACEHOLDER_PATTERNS.some((pattern) => value.toLowerCase().includes(pattern));
}

function parsePort(rawValue) {
  const port = Number(rawValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid integer between 1 and 65535");
  }

  return port;
}

function parseAllowedOrigins(rawValue) {
  const origins = rawValue
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("CLIENT_URL must include at least one allowed origin");
  }

  for (const origin of origins) {
    let parsedOrigin;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`CLIENT_URL contains an invalid URL: ${origin}`);
    }

    if (!["http:", "https:"].includes(parsedOrigin.protocol)) {
      throw new Error(`CLIENT_URL contains an unsupported protocol: ${origin}`);
    }
  }

  return origins;
}

export function loadConfig(env = process.env) {
  const NODE_ENV = env.NODE_ENV || "development";
  const PORT = env.PORT || "5000";
  const CLIENT_URL = env.CLIENT_URL || "http://localhost:5173";
  const MONGO_URI = env.MONGO_URI || "";
  const JWT_SECRET = env.JWT_SECRET || "";
  const redisUrl = env.REDIS_URL;

  if (!VALID_NODE_ENVS.has(NODE_ENV)) {
    throw new Error("NODE_ENV must be one of development, production, or test");
  }

  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  if (JWT_SECRET.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters long");
  }

  if (NODE_ENV === "production") {
    if (isPlaceholderValue(MONGO_URI)) {
      throw new Error("MONGO_URI cannot use a placeholder value in production");
    }

    if (isPlaceholderValue(JWT_SECRET)) {
      throw new Error("JWT_SECRET cannot use a placeholder value in production");
    }

    if (isPlaceholderValue(CLIENT_URL)) {
      throw new Error("CLIENT_URL cannot use a placeholder value in production");
    }
  }

  return {
    NODE_ENV,
    PORT: parsePort(PORT),
    CLIENT_URL,
    allowedOrigins: parseAllowedOrigins(CLIENT_URL),
    MONGO_URI,
    JWT_SECRET,
    messageQuota: redisUrl ? parseMessageQuota(redisUrl, env) : null,
  };
}

function parseMessageQuota(url, env) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("REDIS_URL must be a valid Redis URL");
  }
  if (!["redis:", "rediss:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error("REDIS_URL must use redis:// or rediss:// and include a hostname");
  }

  const limit = Number(env.MESSAGE_QUOTA_LIMIT ?? 10);
  const windowMs = Number(env.MESSAGE_QUOTA_WINDOW_MS ?? 10000);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error("MESSAGE_QUOTA_LIMIT must be an integer between 1 and 1000");
  }
  if (!Number.isInteger(windowMs) || windowMs < 1000 || windowMs > 3600000) {
    throw new Error("MESSAGE_QUOTA_WINDOW_MS must be an integer between 1000 and 3600000");
  }
  return { url, limit, windowMs };
}
