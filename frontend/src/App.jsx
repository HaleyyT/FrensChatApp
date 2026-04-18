import { useState } from "react";
import "./App.css";
import Home from "./pages/home/home";
import Login from "./pages/login/login";

function App() {
  // Keep the authenticated user at the app level so every screen can react to login/logout.
  const [currentUser, setCurrentUser] = useState(null);

  return (
    <main className="app-shell">
      <div className="pointer-events-none fixed inset-x-0 top-5 z-20 flex justify-center px-4">
        <div className="pointer-events-auto inline-flex rounded-full border border-white/12 bg-slate-950/55 p-1.5 shadow-[0_18px_40px_rgba(2,6,23,0.35)] backdrop-blur-xl">
          <div
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold sm:px-4 ${
              currentUser
                ? "bg-cyan-300 text-slate-950 shadow-[0_0_30px_rgba(0,229,255,0.28)]"
                : "text-slate-200"
            }`}
          >
            {currentUser ? `Workspace: ${currentUser.username}` : "Login"}
          </div>
        </div>
      </div>

      {currentUser ? (
        <Home currentUser={currentUser} onLogout={() => setCurrentUser(null)} />
      ) : (
        <Login onLoginSuccess={setCurrentUser} />
      )}
    </main>
  );
}

export default App;
