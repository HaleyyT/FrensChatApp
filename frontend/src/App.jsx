import { useState } from "react";
import "./App.css";
import Home from "./pages/home/home";
import Login from "./pages/login/login";

const views = [
  { id: "workspace", label: "Workspace" },
  { id: "login", label: "Login" },
];

function App() {
  const [activeView, setActiveView] = useState("workspace");

  return (
    <main className="app-shell">
      <div className="pointer-events-none fixed inset-x-0 top-4 z-20 flex justify-center px-4">
        <div className="pointer-events-auto inline-flex rounded-full border border-white/12 bg-slate-950/55 p-1.5 shadow-[0_18px_40px_rgba(2,6,23,0.35)] backdrop-blur-xl">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveView(view.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition duration-300 ease-in-out sm:px-5 ${
                activeView === view.id
                  ? "bg-cyan-300 text-slate-950 shadow-[0_0_30px_rgba(0,229,255,0.28)]"
                  : "text-slate-200 hover:bg-white/8 hover:text-white"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {activeView === "workspace" ? <Home /> : <Login />}
    </main>
  );
}

export default App;
