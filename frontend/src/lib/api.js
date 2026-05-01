export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
export const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || "http://localhost:5000";

const AUTH_TOKEN_STORAGE_KEY = "alpine-chat-auth-token";

export function getStoredAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

function setStoredAuthToken(token) {
  if (!token) {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export async function apiRequest(path, options = {}) {
  const token = getStoredAuthToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    // Cookie auth only works when the browser is allowed to send the JWT cookie back to the API.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      setStoredAuthToken("");
    }

    throw new Error(data.error || data.message || "Request failed");
  }

  return data;
}

export async function login(payload) {
  const user = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  setStoredAuthToken(user.token);
  return user;
}

export async function signup(payload) {
  const user = await apiRequest("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  setStoredAuthToken(user.token);
  return user;
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

export async function logout() {
  try {
    return await apiRequest("/auth/logout", {
      method: "POST",
    });
  } finally {
    setStoredAuthToken("");
  }
}

export function clearStoredAuthToken() {
  setStoredAuthToken("");
}
