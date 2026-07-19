function write(level, event, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export function logInfo(event, fields) {
  write("info", event, fields);
}

export function logWarn(event, fields) {
  write("warn", event, fields);
}

export function logError(event, fields) {
  write("error", event, fields);
}

export function errorDetails(error) {
  return {
    errorName: error?.name || "Error",
    errorMessage: error?.message || "Unknown error",
    ...(error?.stack && process.env.NODE_ENV !== "production" ? { errorStack: error.stack } : {}),
  };
}
