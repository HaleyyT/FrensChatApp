export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
export const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || "http://localhost:5000";

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    // Cookie auth only works when the browser is allowed to send the JWT cookie back to the API.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
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
