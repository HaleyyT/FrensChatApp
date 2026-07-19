import { randomUUID } from "crypto";
import { logInfo, logWarn } from "../utils/logger.js";

export function requestLogger(req, res, next) {
  const requestId = req.get("x-request-id") || randomUUID();
  const startedAt = process.hrtime.bigint();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const fields = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      ...(req.user?._id ? { userId: req.user._id.toString() } : {}),
    };

    if (res.statusCode >= 400) {
      logWarn("http_request_completed", fields);
    } else {
      logInfo("http_request_completed", fields);
    }
  });

  next();
}
