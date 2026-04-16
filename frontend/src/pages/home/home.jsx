const conversations = [
  {
    name: "Design Review",
    preview: "The dark theme feels polished. Let’s keep this direction.",
    time: "2m ago",
    active: true,
  },
  {
    name: "Product Team",
    preview: "Can we make the composer feel lighter on mobile?",
    time: "18m ago",
  },
  {
    name: "Client Feedback",
    preview: "This now feels premium and much easier to scan.",
    time: "1h ago",
  },
];

const messages = [
  {
    sender: "Ava",
    role: "Creative Lead",
    text: "We kept the mountain background, then built a darker UI around it so the product feels calm, high-end, and focused.",
  },
  {
    sender: "You",
    role: "Project Owner",
    text: "Perfect. I want it to feel professional, smooth, and genuinely pleasant to use.",
    isUser: true,
  },
  {
    sender: "Ava",
    role: "Creative Lead",
    text: "That’s the direction here: clearer hierarchy, softer glass surfaces, stronger spacing, and a composer that invites action without clutter.",
  },
];

const quickActions = ["New message", "Schedule call", "Share deck"];

function Home() {
  return (
    <div className="min-h-screen w-full px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-[32px] border border-white/12 bg-slate-950/45 shadow-[0_30px_120px_rgba(2,6,23,0.6)] backdrop-blur-xl">
        <aside className="hidden w-[320px] flex-col border-r border-white/10 bg-slate-950/55 p-6 lg:flex">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/70">
                Alpine Chat
              </p>
              <h1 className="mt-2 font-serif text-3xl text-white">
                Evening Edition
              </h1>
            </div>
            <button className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/14">
              Upgrade
            </button>
          </div>

          <div className="mb-6 rounded-[24px] border border-white/10 bg-white/6 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
              Workspace
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/18 text-lg font-semibold text-cyan-100">
                HT
              </div>
              <div>
                <p className="font-medium text-white">Haley Tran</p>
                <p className="text-sm text-slate-400">Creative collaboration</p>
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-300">Recent chats</p>
            <button className="text-sm text-cyan-200 transition hover:text-cyan-100">
              View all
            </button>
          </div>

          <div className="space-y-3">
            {conversations.map((conversation) => (
              <button
                key={conversation.name}
                className={`w-full rounded-[22px] border p-4 text-left transition duration-300 ${
                  conversation.active
                    ? "border-cyan-300/30 bg-cyan-300/14 shadow-[0_18px_40px_rgba(34,211,238,0.08)]"
                    : "border-white/8 bg-white/5 hover:bg-white/8"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{conversation.name}</p>
                  <span className="text-xs text-slate-400">{conversation.time}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300/85">
                  {conversation.preview}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-auto rounded-[24px] border border-white/10 bg-gradient-to-br from-cyan-300/18 via-slate-900/40 to-white/6 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/70">
              Performance
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">98%</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Faster visual scanning with calmer contrast and more deliberate spacing.
            </p>
          </div>
        </aside>

        <section className="flex min-h-[calc(100vh-2rem)] flex-1 flex-col bg-gradient-to-b from-slate-950/28 via-slate-950/18 to-slate-950/38">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-8">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">
                Active conversation
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                Design Review
              </h2>
            </div>

            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              {quickActions.map((action) => (
                <button
                  key={action}
                  className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/14"
                >
                  {action}
                </button>
              ))}
            </div>
          </header>

          <div className="grid flex-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
            <div className="flex min-h-[420px] flex-col rounded-[28px] border border-white/10 bg-slate-950/38 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-6">
              <div className="mb-5 flex items-center gap-3 lg:hidden">
                <div className="h-11 w-11 rounded-2xl bg-cyan-300/20" />
                <div>
                  <p className="font-medium text-white">Haley Tran</p>
                  <p className="text-sm text-slate-400">Luxury dark workspace</p>
                </div>
              </div>

              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={`${message.sender}-${message.text}`}
                    className={`max-w-2xl rounded-[24px] border px-4 py-4 sm:px-5 ${
                      message.isUser
                        ? "ml-auto border-cyan-300/25 bg-cyan-300/14 text-slate-50"
                        : "border-white/10 bg-white/6 text-slate-100"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <p className="font-medium">{message.sender}</p>
                      <span className="text-xs uppercase tracking-[0.25em] text-slate-400">
                        {message.role}
                      </span>
                    </div>
                    <p className="text-sm leading-7 text-slate-200/90">{message.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-6">
                <div className="rounded-[28px] border border-white/12 bg-slate-950/70 p-3 shadow-[0_24px_50px_rgba(15,23,42,0.35)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex-1">
                      <span className="sr-only">Message</span>
                      <textarea
                        className="min-h-[112px] w-full resize-none rounded-[22px] border border-white/10 bg-white/6 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/8"
                        placeholder="Draft a refined response, gather client notes, or start a new conversation..."
                      />
                    </label>
                    <button className="rounded-[22px] bg-cyan-300 px-5 py-4 font-medium text-slate-950 transition duration-300 hover:-translate-y-0.5 hover:bg-cyan-200">
                      Send Message
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-2">
                    <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        Smooth motion
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        Easy scanning
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        Premium finish
                      </span>
                    </div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Live draft
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <aside className="rounded-[28px] border border-white/10 bg-slate-950/42 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">
                Session details
              </p>
              <h3 className="mt-3 text-xl font-semibold text-white">
                Professional and calm by default
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                The layout uses strong spacing, softened borders, and restrained highlights so the interface feels premium without becoming noisy.
              </p>

              <div className="mt-6 space-y-3">
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Focus mode</p>
                  <p className="mt-2 font-medium text-white">Reduced clutter, clearer actions</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Visual system</p>
                  <p className="mt-2 font-medium text-white">Dark glass layers with subtle cyan accents</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Usability</p>
                  <p className="mt-2 font-medium text-white">Comfortable inputs and responsive stacking</p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Home;
