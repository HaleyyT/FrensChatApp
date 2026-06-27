import mongoose from "mongoose";
import { createHttpError } from "../utils/httpError.js";
import { requireObject } from "../middleWare/validateRequest.js";

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
const ALLOWED_GENDERS = new Set(["male", "female"]);
const DEFAULT_MESSAGE_PAGE_SIZE = 50;
const MAX_MESSAGE_PAGE_SIZE = 100;

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateObjectId(value, label) {
  const normalizedValue = asTrimmedString(value);

  if (!mongoose.Types.ObjectId.isValid(normalizedValue)) {
    throw createHttpError(400, "INVALID_ID", `${label} must be a valid Mongo ObjectId`);
  }

  return normalizedValue;
}

function validateBeforeCursor(value) {
  const normalizedValue = asTrimmedString(value);

  if (!normalizedValue) {
    return null;
  }

  const timestamp = new Date(normalizedValue);

  if (Number.isNaN(timestamp.getTime())) {
    throw createHttpError(400, "INVALID_CURSOR", "before must be a valid ISO date string");
  }

  return timestamp.toISOString();
}

export function validateSignupBody(payload) {
  const body = requireObject(payload, "Request body");
  const fullName = asTrimmedString(body.fullName);
  const username = asTrimmedString(body.username).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const gender = asTrimmedString(body.gender).toLowerCase();

  if (!fullName || !username || !password || !confirmPassword || !gender) {
    throw createHttpError(400, "MISSING_REQUIRED_FIELDS", "Missing required fields");
  }

  if (!USERNAME_PATTERN.test(username)) {
    throw createHttpError(
      400,
      "INVALID_USERNAME",
      "Username must be 3-30 characters and only use letters, numbers, or underscores"
    );
  }

  if (!ALLOWED_GENDERS.has(gender)) {
    throw createHttpError(400, "INVALID_GENDER", "Gender must be either male or female");
  }

  if (password.length < 6) {
    throw createHttpError(400, "INVALID_PASSWORD", "Password must be at least 6 characters");
  }

  if (password !== confirmPassword) {
    throw createHttpError(400, "PASSWORD_MISMATCH", "Passwords don't match");
  }

  return {
    fullName,
    username,
    password,
    confirmPassword,
    gender,
  };
}

export function validateLoginBody(payload) {
  const body = requireObject(payload, "Request body");
  const username = asTrimmedString(body.username).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    throw createHttpError(400, "MISSING_CREDENTIALS", "Username and password are required");
  }

  return {
    username,
    password,
  };
}

export function validateMessageBody(payload) {
  const body = requireObject(payload, "Request body");
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    throw createHttpError(400, "INVALID_MESSAGE", "Message is required");
  }

  if (message.length > 2000) {
    throw createHttpError(400, "MESSAGE_TOO_LONG", "Message must be 2000 characters or fewer");
  }

  return { message };
}

export function validateUserIdParams(params) {
  const source = requireObject(params, "Route params");

  return {
    ...source,
    id: validateObjectId(source.id, "id"),
  };
}

export function validateMessageQuery(query) {
  const source = requireObject(query || {}, "Query params");
  const normalizedLimit = source.limit === undefined ? DEFAULT_MESSAGE_PAGE_SIZE : Number(source.limit);

  if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > MAX_MESSAGE_PAGE_SIZE) {
    throw createHttpError(
      400,
      "INVALID_LIMIT",
      `limit must be an integer between 1 and ${MAX_MESSAGE_PAGE_SIZE}`
    );
  }

  return {
    limit: normalizedLimit,
    before: validateBeforeCursor(source.before),
  };
}

