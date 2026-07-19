const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:5000/api";
const DEFAULT_LOCAL_SOCKET_SERVER_URL = "http://localhost:5000";
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

function isLocalBrowserEnvironment() {
  if (typeof window === "undefined") {
    return false;
  }

  return LOCAL_HOSTNAMES.has(window.location.hostname);
}

function resolveRuntimeUrl(envValue, localFallback) {
  if (envValue) {
    return envValue;
  }

  if (isLocalBrowserEnvironment()) {
    return localFallback;
  }

  return "";
}

export const API_BASE_URL = resolveRuntimeUrl(
  import.meta.env.VITE_API_BASE_URL,
  DEFAULT_LOCAL_API_BASE_URL
);
export const SOCKET_SERVER_URL = resolveRuntimeUrl(
  import.meta.env.VITE_SOCKET_SERVER_URL,
  DEFAULT_LOCAL_SOCKET_SERVER_URL
);

export function getFrontendConfigError() {
  if (API_BASE_URL) {
    return "";
  }

  return "This frontend is missing VITE_API_BASE_URL. Set the deployed backend URL in your frontend environment variables.";
}

export async function apiRequest(path, options = {}) {
  const configError = getFrontendConfigError();

  if (configError) {
    const error = new Error(configError);
    error.code = "FRONTEND_CONFIG_ERROR";
    throw error;
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      // Cookie auth only works when the browser is allowed to send the JWT cookie back to the API.
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        (typeof data.error === "object" && data.error?.message) ||
        data.error ||
        data.message ||
        "Request failed";
      const error = new Error(errorMessage);
      error.status = response.status;
      error.code = typeof data.error === "object" ? data.error?.code : undefined;
      error.details = typeof data.error === "object" ? data.error?.details : undefined;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("The backend took too long to respond. Check that the deployed API is awake and reachable.");
      timeoutError.code = "REQUEST_TIMEOUT";
      throw timeoutError;
    }

    if (error instanceof TypeError) {
      const networkError = new Error("Could not reach the backend. Check your deployed frontend environment variables and backend URL.");
      networkError.code = "NETWORK_ERROR";
      throw networkError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function login(payload) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function signup(payload) {
  return apiRequest("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCurrentUser() {
  return apiRequest("/auth/me");
}

export function getUsers() {
  return apiRequest("/user/");
}

export function getMessages(userId, options = {}) {
  const searchParams = new URLSearchParams();

  if (options.limit) {
    searchParams.set("limit", String(options.limit));
  }

  if (options.before) {
    searchParams.set("before", options.before);
  }

  const query = searchParams.toString();

  return apiRequest(`/message/${userId}${query ? `?${query}` : ""}`);
}

export function sendMessage(userId, message) {
  return apiRequest(`/message/send/${userId}`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function markMessagesRead(userId) {
  return apiRequest(`/message/read/${userId}`, {
    method: "PATCH",
  });
}

export function logout() {
  return apiRequest("/auth/logout", {
    method: "POST",
  });
}
