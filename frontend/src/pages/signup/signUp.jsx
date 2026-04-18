import { useState } from "react";
import PropTypes from "prop-types";
import { signup } from "../../lib/api";

function SignUp({ onSignupSuccess, onShowLogin }) {
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    password: "",
    confirmPassword: "",
    gender: "female",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    // Clear the last error so the next request can show exactly what happened this time.
    setError("");
    setIsSubmitting(true);

    try {
      const user = await signup(formData);
      onSignupSuccess(user);
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
                Join
                <br />
                the studio
              </h1>
              <p className="mt-6 max-w-md text-[15px] font-medium leading-7 text-slate-200">
                Create an account to turn the polished shell into a real workspace with persistent identity and backend-backed auth.
              </p>
            </div>

            <div className="max-w-md rounded-[24px] border border-white/12 bg-slate-950/36 p-5 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-100/80">
                Account setup
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-[18px] border border-white/10 bg-white/5 p-3.5">
                  <p className="text-sm font-semibold text-white">Cookie-based auth</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-300">
                    Signup creates the user and signs the session in immediately through the backend.
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/5 p-3.5">
                  <p className="text-sm font-semibold text-white">Same visual language</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-300">
                    The signup screen keeps the same dark-system atmosphere while adding real product flow.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-slate-950/48 p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-[420px] rounded-[28px] border border-white/12 bg-[rgba(8,15,32,0.55)] p-5 shadow-[0_28px_80px_rgba(2,6,23,0.45)] backdrop-blur-[20px] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-cyan-100/80">
              New account
            </p>
            <h2 className="mt-3 text-[2rem] font-semibold text-white sm:text-4xl">
              Create the account
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-200">
              This step collects the same fields the backend signup controller expects, so the form can create the user and enter the app in one flow.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">
                  Full name
                </span>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Haley Tran"
                  className="w-full rounded-[18px] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-medium text-white outline-none transition duration-300 ease-in-out placeholder:text-slate-500 focus:border-cyan-300/55 focus:shadow-[0_0_0_1px_rgba(0,229,255,0.18)]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">
                  Username
                </span>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="haleytran"
                  autoComplete="username"
                  className="w-full rounded-[18px] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-medium text-white outline-none transition duration-300 ease-in-out placeholder:text-slate-500 focus:border-cyan-300/55 focus:shadow-[0_0_0_1px_rgba(0,229,255,0.18)]"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">
                    Password
                  </span>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    className="w-full rounded-[18px] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-medium text-white outline-none transition duration-300 ease-in-out placeholder:text-slate-500 focus:border-cyan-300/55 focus:shadow-[0_0_0_1px_rgba(0,229,255,0.18)]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">
                    Confirm password
                  </span>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    className="w-full rounded-[18px] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-medium text-white outline-none transition duration-300 ease-in-out placeholder:text-slate-500 focus:border-cyan-300/55 focus:shadow-[0_0_0_1px_rgba(0,229,255,0.18)]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">
                  Gender
                </span>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full rounded-[18px] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-medium text-white outline-none transition duration-300 ease-in-out focus:border-cyan-300/55 focus:shadow-[0_0_0_1px_rgba(0,229,255,0.18)]"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>

              {error ? (
                <div className="rounded-[18px] border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-medium text-rose-100">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-[18px] bg-[#00E5FF] px-5 py-3.5 text-sm font-semibold text-slate-950 transition duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-[0_0_30px_rgba(0,229,255,0.32)]"
              >
                {isSubmitting ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm font-medium text-slate-300">
              Already have an account?{" "}
              <button
                type="button"
                onClick={onShowLogin}
                className="font-semibold text-cyan-100 transition duration-300 ease-in-out hover:text-cyan-50"
              >
                Sign in
              </button>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

SignUp.propTypes = {
  onSignupSuccess: PropTypes.func.isRequired,
  onShowLogin: PropTypes.func.isRequired,
};

export default SignUp;
