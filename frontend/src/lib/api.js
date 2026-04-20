const API_BASE_URL = "http://localhost:5000/api";

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
    throw new Error(data.error || data.message || "Request failed");
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

export function getMessages(userId) {
  return apiRequest(`/message/${userId}`);
}

export function sendMessage(userId, message) {
  return apiRequest(`/message/send/${userId}`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function logout() {
  return apiRequest("/auth/logout", {
    method: "POST",
  });
}
