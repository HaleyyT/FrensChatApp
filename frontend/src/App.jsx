import { useEffect, useState } from "react";
import "./App.css";
import Home from "./pages/home/home";
import Login from "./pages/login/login";
import SignUp from "./pages/signup/signUp";
import { getCurrentUser, logout } from "./lib/api";

function App() {
  // Keep the authenticated user at the app level so every screen can react to login/logout.
  const [currentUser, setCurrentUser] = useState(null);
  const [authView, setAuthView] = useState("login");
  const [showWorkspacePreview, setShowWorkspacePreview] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch {
        setCurrentUser(null);
      } finally {
        setIsCheckingSession(false);
      }
    }

    // Ask the backend if the browser still has a valid auth cookie after refresh.
    restoreSession();
  }, []);

  async function handleAuthToggle(nextView) {
    if (nextView === "workspace") {
      // Allow the workspace button to keep acting like a visual preview when no session exists yet.
      setShowWorkspacePreview(true);
      return;
    }

    if (currentUser) {
      try {
        await logout();
      } catch (error) {
        console.error("Error logging out", error);
      } finally {
        setCurrentUser(null);
        setAuthView("login");
        setShowWorkspacePreview(false);
      }
      return;
    }

    setAuthView("login");
    setShowWorkspacePreview(false);
  }

  if (isCheckingSession) {
    return (
      <main className="app-shell">
        <div className="flex min-h-screen items-center justify-center px-6 text-slate-100">
          <div className="rounded-[24px] border border-white/12 bg-slate-950/55 px-6 py-5 text-sm font-medium text-slate-200 shadow-[0_24px_80px_rgba(2,6,23,0.4)] backdrop-blur-xl">
            Restoring session...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="pointer-events-none fixed inset-x-0 top-5 z-20 flex justify-center px-4">
        <div className="pointer-events-auto inline-flex rounded-full border border-white/12 bg-slate-950/55 p-1.5 shadow-[0_18px_40px_rgba(2,6,23,0.35)] backdrop-blur-xl">
            <button
              type="button"
              onClick={() => handleAuthToggle("workspace")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition duration-300 ease-in-out sm:px-4 ${
              currentUser || showWorkspacePreview
                ? "bg-cyan-300 text-slate-950 shadow-[0_0_30px_rgba(0,229,255,0.28)]"
                : "text-slate-200 hover:bg-white/8 hover:text-white"
            }`}
          >
            Workspace
          </button>
            <button
              type="button"
              onClick={() => handleAuthToggle("login")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition duration-300 ease-in-out sm:px-4 ${
              currentUser || showWorkspacePreview
                ? "text-slate-200 hover:bg-white/8 hover:text-white"
                : "bg-cyan-300 text-slate-950 shadow-[0_0_30px_rgba(0,229,255,0.28)]"
            }`}
          >
            Login
          </button>
        </div>
      </div>

      {currentUser ? (
        <Home currentUser={currentUser} onLogout={() => setCurrentUser(null)} />
      ) : showWorkspacePreview ? (
        <Home />
      ) : (
        <>
          {authView === "login" ? (
            <Login
              onLoginSuccess={setCurrentUser}
              onShowSignUp={() => setAuthView("signup")}
            />
          ) : (
            <SignUp
              onSignupSuccess={setCurrentUser}
              onShowLogin={() => setAuthView("login")}
            />
          )}
        </>
      )}
    </main>
  );
}

export default App;
