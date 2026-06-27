import { createHttpError } from "../utils/httpError.js";

export function notFoundHandler(req, res, next) {
  next(createHttpError(404, "NOT_FOUND", `Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(error, req, res, next) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = error?.code || (status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR");
  const message = status >= 500 ? "Internal server error" : error.message || "Request failed";

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
  }

  const payload = {
    error: {
      code,
      message,
    },
  };

  if (error?.details) {
    payload.error.details = error.details;
  }

  res.status(status).json(payload);
}

