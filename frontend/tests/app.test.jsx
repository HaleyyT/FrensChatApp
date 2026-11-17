import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

const socket = vi.hoisted(() => {
  const listeners = new Map();
  return {
    on: vi.fn((event, listener) => listeners.set(event, listener)),
    off: vi.fn((event) => listeners.delete(event)),
    disconnect: vi.fn(),
    emit: vi.fn(),
    receive: (event, payload) => listeners.get(event)?.(payload),
  };
});
vi.mock("socket.io-client", () => ({ io: vi.fn(() => socket) }));

const me = { _id: "me", username: "me", fullName: "Me" };
const peer = { _id: "peer", username: "peer", fullName: "Avery Peer" };
const other = { _id: "other", username: "other", fullName: "Jamie Other", unreadCount: 2 };
const timestamp = "2026-11-18T00:00:00.000Z";
const message = (id, text, senderId = "me", receiverId = "peer") => ({
  _id: id, message: text, senderId, receiverId, createdAt: timestamp,
});
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const unauthenticated = () => json({ error: { code: "AUTH_REQUIRED", message: "No token provided" } }, 401);
let fetchMock;

function api({ session = () => json(me), custom = () => undefined } = {}) {
  fetchMock.mockImplementation(async (url, options) => {
    const path = new URL(url).pathname;
    const override = await custom(path, options, new URL(url));
    if (override) return override;
    if (path === "/api/auth/me") return session();
    if (path === "/api/auth/logout") return json({});
    if (path === "/api/user/") return json({ filterUsers: [peer, other] });
    if (path.startsWith("/api/message/read/")) return json({ readMessageIds: [] });
    if (path === "/api/message/other") return json({ messages: [] });
    if (path === "/api/message/peer") return json({ messages: [message("initial", "Initial chat message")] });
    throw new Error(`Unexpected request: ${path}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  fetchMock = globalThis.fetch;
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("signed-out visitors can preview the workspace without a false deployment error", async () => {
  api({ session: unauthenticated });
  render(<App />);
  expect(screen.getByText(/restoring session/i)).toBeTruthy();
  await screen.findByPlaceholderText("Enter your password");
  fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
  expect(screen.getByRole("textbox", { name: "Message" }).disabled).toBe(true);
  expect(screen.queryByText(/No token provided|Retry session check/i)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
  expect(screen.getByPlaceholderText("Enter your password")).toBeTruthy();
});

test("a backend outage shows a retry action that restores a valid session", async () => {
  api({ session: () => { throw new TypeError("offline"); } });
  render(<App />);
  const retry = await screen.findByRole("button", { name: "Retry session check" });
  expect(screen.getByText(/Could not reach the backend/i)).toBeTruthy();
  api();
  fireEvent.click(retry);
  expect(await screen.findByText("Initial chat message")).toBeTruthy();
  expect(screen.queryByText(/Could not reach the backend/i)).toBeNull();
});

test("login reports rejected credentials, then updates the workspace after successful retry", async () => {
  let tries = 0;
  api({ session: unauthenticated, custom: (path, options) => {
    if (path !== "/api/auth/login") return;
    expect(JSON.parse(options.body)).toEqual({ username: "tester", password: "secret12" });
    expect(options.credentials).toBe("include");
    return ++tries === 1 ? json({ error: { message: "Invalid credentials" } }, 400) : json(me);
  } });
  render(<App />);
  fireEvent.change(await screen.findByPlaceholderText("Enter your password"), { target: { value: "secret12" } });
  fireEvent.change(screen.getByPlaceholderText("haleytran"), { target: { value: "tester" } });
  const form = screen.getByPlaceholderText("Enter your password").closest("form");
  fireEvent.submit(form);
  expect(await screen.findByText("Invalid credentials")).toBeTruthy();
  fireEvent.submit(form);
  expect(await screen.findByText("Initial chat message")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
  await screen.findByPlaceholderText("Enter your password");
  expect(socket.disconnect).toHaveBeenCalled();
});

test("history pagination and a queued send preserve the visible conversation", async () => {
  api({ custom: (path, options, url) => {
    if (path === "/api/message/send/peer") {
      expect(JSON.parse(options.body)).toEqual({ message: "Pending text" });
      return json({ _id: "pending", moderationStatus: "pending" }, 202);
    }
    if (path === "/api/message/peer") {
      return url.searchParams.has("before")
        ? json({ messages: [message("older", "Older conversation text")], paging: { hasMore: false } })
        : json({ messages: [message("initial", "Initial chat message")], paging: { hasMore: true, nextCursor: timestamp } });
    }
  } });
  render(<App />);
  await screen.findByText("Initial chat message");
  fireEvent.click(screen.getByRole("button", { name: /load earlier/i }));
  expect(await screen.findByText("Older conversation text")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "Pending text" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Message" }));
  expect((await screen.findByText("Message queued for review.")).getAttribute("role")).toBe("status");
  expect(screen.queryByText("Pending text")).toBeNull();
  expect(screen.getByRole("textbox", { name: "Message" }).value).toBe("");
});

test("realtime events update the active conversation and a receipt updates the sent state", async () => {
  api();
  render(<App />);
  await screen.findByText("Initial chat message");
  act(() => {
    socket.receive("onlineUsers", ["peer"]);
    socket.receive("typing", { senderId: "peer" });
  });
  expect(screen.getByText(/Online now with @peer/i)).toBeTruthy();
  act(() => {
    socket.receive("stopTyping", { senderId: "peer" });
    socket.receive("newMessage", message("socket", "Live inbound text", "peer", "me"));
    socket.receive("newMessage", message("socket", "Live inbound text", "peer", "me"));
    socket.receive("messagesRead", { readerId: "peer", messageIds: ["initial"], readAt: timestamp });
  });
  await waitFor(() => expect(screen.getAllByText("Live inbound text").length).toBeGreaterThan(0));
  expect(screen.getByText("Read")).toBeTruthy();
  expect(screen.getAllByText("Live inbound text").filter((entry) => entry.tagName === "P")).toHaveLength(2);
});

test("signup preserves the form after a rejection and starts a session after retry", async () => {
  const user = userEvent.setup();
  let tries = 0;
  api({ session: unauthenticated, custom: (path, options) => {
    if (path !== "/api/auth/signup") return;
    expect(JSON.parse(options.body)).toEqual({
      fullName: "Test Member", username: "tester", password: "secret12", confirmPassword: "secret12", gender: "male",
    });
    return ++tries === 1 ? json({ error: { message: "Username already exists" } }, 400) : json(me, 201);
  } });
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /create one/i }));
  await user.type(screen.getByPlaceholderText("Haley Tran"), "Test Member");
  await user.type(screen.getByPlaceholderText("haleytran"), "tester");
  await user.type(screen.getByPlaceholderText("At least 6 characters"), "secret12");
  await user.type(screen.getByPlaceholderText("Repeat password"), "secret12");
  await user.selectOptions(screen.getByRole("combobox"), "male");
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByText("Username already exists")).toBeTruthy();
  expect(screen.getByPlaceholderText("haleytran").value).toBe("tester");
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByText("Initial chat message")).toBeTruthy();
});

test("rejected sends keep the draft, Enter retries, and successful sends update the chat", async () => {
  let tries = 0;
  api({ custom: (path, options) => {
    if (path !== "/api/message/send/peer") return;
    expect(JSON.parse(options.body)).toEqual({ message: "Retryable text" });
    return ++tries === 1
      ? json({ error: { code: "MESSAGE_QUOTA_EXCEEDED", message: "Message send limit reached" } }, 429)
      : json({ ...message("sent", "Retryable text"), deliveredAt: timestamp }, 201);
  } });
  vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(<App />);
    await screen.findByText("Initial chat message");
    const draft = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(draft, { target: { value: "Retryable text" } });
    expect(socket.emit).toHaveBeenCalledWith("typing", { receiverId: "peer" });
    fireEvent.keyDown(draft, { key: "Enter", shiftKey: true });
    expect(tries).toBe(0);
    fireEvent.keyDown(draft, { key: "Enter" });
    expect(await screen.findByText("Message send limit reached")).toBeTruthy();
    expect(draft.value).toBe("Retryable text");
    fireEvent.keyDown(draft, { key: "Enter" });
    expect(await screen.findByText("Delivered")).toBeTruthy();
    expect(draft.value).toBe("");
    expect(screen.queryByText("Message send limit reached")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByPlaceholderText("Enter your password")).toBeTruthy();
  } finally {
    vi.restoreAllMocks();
  }
});

test("an inactive chat receives an unread badge without inserting the message into the active chat", async () => {
  api();
  render(<App />);
  await screen.findByText("Initial chat message");
  act(() => socket.receive("newMessage", message("unread", "Other chat preview", "other", "me")));
  const inactive = screen.getByRole("button", { name: /Jamie Other.*3.*Other chat preview/i });
  expect(screen.getAllByText("Other chat preview")).toHaveLength(1);
  fireEvent.click(inactive);
  await waitFor(() => expect(screen.queryByText("Initial chat message")).toBeNull());
  expect(screen.getByRole("button", { name: /Jamie Other.*Offline/i }).textContent).not.toMatch(/Jamie Other3/);
});

test("a late history response cannot replace the conversation selected afterward", async () => {
  let finishFirstHistory;
  const firstHistory = new Promise((resolve) => { finishFirstHistory = resolve; });
  api({ custom: (path) => {
    if (path === "/api/message/peer") return firstHistory;
    if (path === "/api/message/other") return json({ messages: [message("latest", "Current conversation text", "other", "me")] });
  } });
  render(<App />);
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === "/api/message/peer")).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: /Jamie Other/i }));
  expect(await screen.findByText("Current conversation text")).toBeTruthy();
  await act(async () => { finishFirstHistory(json({ messages: [message("stale", "Previous conversation text")] })); });
  expect(screen.queryByText("Previous conversation text")).toBeNull();
  expect(screen.getByText("Current conversation text")).toBeTruthy();
  expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === "/api/message/read/peer")).toBe(false);
});

test("a send blocked by an expired session returns to login without retrying the write", async () => {
  let sessionChecks = 0;
  api({ session: () => ++sessionChecks === 1 ? json(me) : unauthenticated() });
  render(<App />);
  await screen.findByText("Initial chat message");
  fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "Draft text" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Message" }));
  expect(await screen.findByPlaceholderText("Enter your password")).toBeTruthy();
  expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname.startsWith("/api/message/send/"))).toBe(false);
});

test("a delayed older page cannot add messages to a different conversation", async () => {
  let finishPage;
  const delayedPage = new Promise((resolve) => { finishPage = resolve; });
  api({ custom: (path, _options, url) => {
    if (path === "/api/message/peer") {
      return url.searchParams.has("before") ? delayedPage :
        json({ messages: [message("initial", "Initial chat message")], paging: { hasMore: true, nextCursor: timestamp } });
    }
    if (path === "/api/message/other") return json({ messages: [message("new", "Current conversation text", "other", "me")] });
  } });
  render(<App />);
  await screen.findByText("Initial chat message");
  fireEvent.click(screen.getByRole("button", { name: /load earlier/i }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => new URL(url).searchParams.has("before"))).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: /Jamie Other/i }));
  await screen.findByText("Current conversation text");
  await act(async () => { finishPage(json({ messages: [message("older", "Other conversation page")] })); });
  expect(screen.queryByText("Other conversation page")).toBeNull();
  expect(screen.getByText("Current conversation text")).toBeTruthy();
});
