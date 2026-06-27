import { createHttpError } from "../utils/httpError.js";

export function validateRequest({ body, params, query } = {}) {
  return (req, res, next) => {
    try {
      if (body) {
        req.body = body(req.body);
      }

      if (params) {
        req.params = params(req.params);
      }

      if (query) {
        req.query = query(req.query);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createHttpError(400, "INVALID_PAYLOAD", `${label} must be a JSON object`);
  }

  return value;
}

