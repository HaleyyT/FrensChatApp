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
      credentials: "include", // IMPORTANT: allow browser to store jwt cookie
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
        credentials: "include", // IMPORTANT: send jwt cookie
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
    // On page load, try fetching users.
    // If not logged in yet, you'll see 401. Click "Login" then "Load Users".
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

        <h2>Auth</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handleLoginAndLoad}>Login + Load Users</button>
          <button onClick={loadUsers}>Load Users</button>
        </div>
        {authMsg && <p style={{ marginTop: 8 }}>{authMsg}</p>}

        <hr style={{ margin: "16px 0" }} />

        <h2>Users</h2>
        {loadingUsers && <p>Loading users…</p>}
        {usersError && <p style={{ color: "crimson" }}>{usersError}</p>}

        {!loadingUsers && !usersError && users.length > 0 && (
          <ul style={{ textAlign: "left" }}>
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
