import { createHttpError } from "../utils/httpError.js";
import { errorDetails, logError, logWarn } from "../utils/logger.js";

export function notFoundHandler(req, res, next) {
  next(createHttpError(404, "NOT_FOUND", `Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(error, req, res, next) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = error?.code || (status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR");
  const message = status >= 500 ? "Internal server error" : error.message || "Request failed";

  const logFields = {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    ...errorDetails(error),
  };

  if (status >= 500) {
    logError("http_request_failed", logFields);
  } else {
    logWarn("http_request_rejected", logFields);
  }

  const payload = {
    error: {
      code,
      message,
      requestId: req.requestId,
    },
  };

  if (error?.details) {
    payload.error.details = error.details;
  }

  res.status(status).json(payload);
}
