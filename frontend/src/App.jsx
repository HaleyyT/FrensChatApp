import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  const login = async () => {
    setAuthMsg("");
    setUsersError("");

    const username = "knaka";
    const password = "333666";

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Login failed (HTTP ${res.status}): ${text}`);
    }

    setAuthMsg("Login successful!!!");
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError("");

    try {
      const res = await fetch("/api/user", {
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Users request failed (HTTP ${res.status}): ${text}`);
      }

      const data = await res.json();
      setUsers(data.filterUsers ?? data);
    } catch (err) {
      setUsersError(err?.message || "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginAndLoad = async () => {
    try {
      await login();
      await loadUsers();
    } catch (err) {
      setUsersError(err?.message || "Login failed");
    }
  };

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <h1>Vite + React</h1>

      <div className="card">
        <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>

        <hr style={{ margin: "16px 0" }} />

        {/* Tailwind test */}
        <h1 className="text-4xl font-bold text-blue-500">Tailwind works</h1>

        <h2>Auth</h2>
        <div className="flex gap-2 flex-wrap justify-center mt-2">
          <button
            onClick={handleLoginAndLoad}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Login + Load Users
          </button>

          <button
            onClick={loadUsers}
            className="px-4 py-2 rounded-lg border border-gray-400 hover:bg-gray-100"
          >
            Load Users
          </button>
        </div>

        {authMsg && <p className="mt-2">{authMsg}</p>}

        <hr style={{ margin: "16px 0" }} />

        <h2>Users</h2>
        {loadingUsers && <p>Loading users…</p>}
        {usersError && <p className="text-red-500">{usersError}</p>}

        {!loadingUsers && !usersError && users.length > 0 && (
          <ul className="text-left mt-2 space-y-1">
            {users.map((u) => (
              <li key={u._id}>
                {u.fullName} (@{u.username})
              </li>
            ))}
          </ul>
        )}

        {!loadingUsers && !usersError && users.length === 0 && (
          <p>No users returned (or you’re not logged in yet).</p>
        )}
      </div>

      <p className="read-the-docs">
        Tip: Click <b>Login + Load Users</b> to set the JWT cookie in your browser, then fetch
        the protected users route.
      </p>
    </>
  );
}

export default App;