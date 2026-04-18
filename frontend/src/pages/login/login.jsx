import { useState } from "react";
import PropTypes from "prop-types";
import { login } from "../../lib/api";

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    // Reset the last attempt so the current submission can show fresh feedback.
    setError("");
    setIsSubmitting(true);

    try {
      const user = await login({ username, password });
      onLoginSuccess(user);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full px-4 pb-6 pt-24 text-slate-100 sm:px-6 sm:pb-8 lg:px-8 lg:pb-10">
      <div className="mx-auto grid min-h-[calc(100vh-8.5rem)] max-w-[1000px] overflow-hidden rounded-[32px] border border-white/14 bg-slate-950/42 shadow-[0_36px_120px_rgba(2,6,23,0.55)] backdrop-blur-2xl lg:grid-cols-[1.2fr_0.88fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 lg:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/35 via-transparent to-slate-950/60" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%)]" />

          <div className="relative z-10 flex h-full w-full flex-col justify-between p-8 xl:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.42em] text-cyan-100/85">
                Alpine Chat
              </p>
              <h1 className="mt-4 max-w-lg font-serif text-5xl leading-[0.95] text-white xl:text-6xl">
                Evening
                <br />
                Edition
              </h1>
              <p className="mt-6 max-w-md text-[15px] font-medium leading-7 text-slate-200">
                A cinematic workspace for focused conversations, crafted with a darker palette, softer glass layers, and premium clarity.
              </p>
            </div>

            <div className="max-w-md rounded-[24px] border border-white/12 bg-slate-950/36 p-5 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-100/80">
                Experience highlights
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-[18px] border border-white/10 bg-white/5 p-3.5">
                  <p className="text-sm font-semibold text-white">Focused workspace</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-300">
                    Cleaner structure and calmer spacing keep conversations easy to scan.
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/5 p-3.5">
                  <p className="text-sm font-semibold text-white">Luxury dark styling</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-300">
                    Frosted glass surfaces and bright cyan accents give the UI a polished feel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-slate-950/48 p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-[380px] rounded-[28px] border border-white/12 bg-[rgba(8,15,32,0.55)] p-5 shadow-[0_28px_80px_rgba(2,6,23,0.45)] backdrop-blur-[20px] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-cyan-100/80">
              Welcome back
            </p>
            <h2 className="mt-3 text-[2rem] font-semibold text-white sm:text-4xl">
              Sign in to continue
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-200">
              Keep the atmosphere, clarity, and polish consistent from the first screen to the workspace itself.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">
                  Username
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="haleytran"
                  autoComplete="username"
                  className="w-full rounded-[18px] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-medium text-white outline-none transition duration-300 ease-in-out placeholder:text-slate-500 focus:border-cyan-300/55 focus:shadow-[0_0_0_1px_rgba(0,229,255,0.18)]"
                />
              </label>

              <label className="block">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-200">Password</span>
                  <button
                    type="button"
                    className="text-sm font-semibold text-cyan-100 transition duration-300 ease-in-out hover:text-cyan-50"
                  >
                    Forgot?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-[18px] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-medium text-white outline-none transition duration-300 ease-in-out placeholder:text-slate-500 focus:border-cyan-300/55 focus:shadow-[0_0_0_1px_rgba(0,229,255,0.18)]"
                />
              </label>

              {error ? (
                <div className="rounded-[18px] border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-medium text-rose-100">
                  {error}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300"
                  />
                  Keep me signed in
                </label>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-50">
                  Secure
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-[18px] bg-[#00E5FF] px-5 py-3.5 text-sm font-semibold text-slate-950 transition duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-[0_0_30px_rgba(0,229,255,0.32)]"
              >
                {isSubmitting ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <div className="mt-5 rounded-[20px] border border-white/10 bg-white/6 p-4">
              <p className="text-sm font-semibold text-white">Professional dark system</p>
              <p className="mt-2 text-sm font-medium leading-7 text-slate-300">
                Centered on mobile, split-screen on desktop, with softened glass and higher-contrast copy for easier reading.
              </p>
            </div>

            <p className="mt-6 text-center text-sm font-medium text-slate-300">
              Need an account?{" "}
              <button
                type="button"
                className="font-semibold text-cyan-100 transition duration-300 ease-in-out hover:text-cyan-50"
              >
                Create one soon
              </button>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

Login.propTypes = {
  onLoginSuccess: PropTypes.func.isRequired,
};

export default Login;
