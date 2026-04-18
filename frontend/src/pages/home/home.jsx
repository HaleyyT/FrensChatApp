import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { getMessages, getUsers, logout } from "../../lib/api";

const conversations = [
  {
    name: "Design Review",
    preview: "The wider frame feels more useful now. The message area finally has room to breathe.",
    time: "2m ago",
    active: true,
    unread: 3,
  },
  {
    name: "Product Team",
    preview: "The brighter cyan works much better for actions and active states.",
    time: "18m ago",
    unread: 1,
  },
  {
    name: "Client Feedback",
    preview: "Readability is much stronger and the right panel adds practical depth.",
    time: "1h ago",
  },
];

const messages = [
  {
    sender: "Ava",
    role: "Creative Lead",
    text: "We opened up the frame so the workspace feels premium instead of compressed. The extra width supports focus without making the reading line too long.",
  },
  {
    sender: "You",
    role: "Project Owner",
    text: "That balance feels right. It still looks cinematic, but now it reads like a real professional product.",
    isUser: true,
  },
  {
    sender: "Ava",
    role: "Creative Lead",
    text: "I also raised secondary text contrast, expanded the message cards, and gave the side panels stronger hierarchy so long sessions feel easier on the eyes.",
  },
];

const quickActions = ["New message", "Invite team", "Share deck"];
const sharedFiles = [
  { name: "Launch deck.pdf", type: "Presentation", size: "12 MB" },
  { name: "Brand notes.fig", type: "Design file", size: "4 MB" },
  { name: "Client recap.docx", type: "Document", size: "1 MB" },
];

function Home({ currentUser, onLogout }) {
  const displayUser = currentUser || {
    fullName: "Haley Tran",
    username: "haleytran",
  };
  const isPreviewMode = !currentUser;
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [liveMessages, setLiveMessages] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    if (isPreviewMode) {
      return;
    }

    async function loadUsers() {
      setIsLoadingUsers(true);

      try {
        const data = await getUsers();
        const sidebarUsers = data.filterUsers || [];

        // Store the real sidebar users so the workspace can stop relying on the mock list after login.
        setUsers(sidebarUsers);

        if (sidebarUsers.length > 0) {
          setSelectedUserId(sidebarUsers[0]._id);
        }
      } catch (error) {
        console.error("Error loading users", error);
      } finally {
        setIsLoadingUsers(false);
      }
    }

    loadUsers();
  }, [isPreviewMode]);

  useEffect(() => {
    if (isPreviewMode || !selectedUserId) {
      return;
    }

    async function loadMessages() {
      setIsLoadingMessages(true);

      try {
        const data = await getMessages(selectedUserId);
        setLiveMessages(data);
      } catch (error) {
        console.error("Error loading messages", error);
      } finally {
        setIsLoadingMessages(false);
      }
    }

    // Reload the conversation every time a different sidebar user is selected.
    loadMessages();
  }, [isPreviewMode, selectedUserId]);

  const selectedUser = users.find((user) => user._id === selectedUserId) || null;
  const sidebarItems = isPreviewMode
    ? conversations
    : users.map((user) => ({
        id: user._id,
        name: user.fullName,
        preview: `@${user.username}`,
        time: "",
        active: user._id === selectedUserId,
      }));
  const activeConversationTitle = isPreviewMode
    ? "Design Review"
    : selectedUser?.fullName || "Select a conversation";
  const activeConversationSubtitle = isPreviewMode
    ? "Cinematic dark mode with better usability for longer working sessions."
    : selectedUser
      ? `Conversation with @${selectedUser.username}`
      : "Choose someone from the sidebar to load real messages.";
  const renderedMessages = isPreviewMode
    ? messages
    : liveMessages.map((message) => ({
        id: message._id,
        sender: message.senderId === currentUser?._id ? "You" : selectedUser?.fullName || "Teammate",
        role: message.senderId === currentUser?._id ? "Project Owner" : "Conversation",
        text: message.message,
        isUser: message.senderId === currentUser?._id,
      }));

  async function handleLogout() {
    try {
      await logout();
      onLogout();
    } catch (error) {
      console.error("Error logging out", error);
    }
  }

  return (
    <div className="min-h-screen w-full px-4 pb-6 pt-24 text-slate-100 sm:px-6 sm:pb-8 lg:px-8 lg:pb-10">
      <div className="mx-auto flex min-h-[calc(100vh-8.5rem)] max-w-[1000px] overflow-hidden rounded-[32px] border border-white/14 bg-slate-950/48 shadow-[0_36px_120px_rgba(2,6,23,0.58)] backdrop-blur-2xl">
        <aside className="hidden w-[280px] flex-col border-r border-white/12 bg-slate-950/64 p-5 xl:flex">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.42em] text-cyan-100/80">
                Alpine Chat
              </p>
              <h1 className="mt-2 font-serif text-[2.5rem] leading-none text-white">
                Evening Edition
              </h1>
              <p className="mt-3 max-w-xs text-sm font-medium leading-6 text-slate-300">
                A calmer, wider workspace built for polished collaboration.
              </p>
            </div>
            {currentUser ? (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-cyan-300/25 bg-cyan-300/12 px-4 py-2 text-sm font-semibold text-cyan-100 transition duration-300 ease-in-out hover:border-cyan-200/40 hover:bg-cyan-300/18 hover:shadow-[0_0_24px_rgba(0,229,255,0.18)]"
              >
                Log out
              </button>
            ) : (
              <button className="rounded-full border border-cyan-300/25 bg-cyan-300/12 px-4 py-2 text-sm font-semibold text-cyan-100 transition duration-300 ease-in-out hover:border-cyan-200/40 hover:bg-cyan-300/18 hover:shadow-[0_0_24px_rgba(0,229,255,0.18)]">
                Upgrade
              </button>
            )}
          </div>

          <div className="mb-5 rounded-[24px] border border-white/12 bg-white/7 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-300">
              Workspace
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-cyan-300/18 text-base font-bold text-cyan-100">
                {displayUser.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-white">{displayUser.fullName}</p>
                <p className="text-sm font-medium text-slate-300">@{displayUser.username}</p>
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">Recent chats</p>
            <button className="text-sm font-semibold text-cyan-100 transition hover:text-cyan-50">
              View all
            </button>
          </div>

          <div className="space-y-3">
            {isLoadingUsers && !isPreviewMode ? (
              <div className="rounded-[20px] border border-white/10 bg-white/6 p-4 text-sm font-medium text-slate-300">
                Loading conversations...
              </div>
            ) : (
              sidebarItems.map((conversation) => (
                <button
                  key={conversation.id || conversation.name}
                  type="button"
                  onClick={() => {
                    if (!isPreviewMode && conversation.id) {
                      setSelectedUserId(conversation.id);
                    }
                  }}
                  className={`w-full rounded-[20px] border p-3.5 text-left transition duration-300 ease-in-out ${
                    conversation.active
                      ? "border-cyan-300/34 bg-cyan-300/16 shadow-[0_20px_45px_rgba(0,229,255,0.11)]"
                      : "border-white/10 bg-white/6 hover:bg-white/9"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{conversation.name}</p>
                    <div className="flex items-center gap-2">
                      {conversation.unread ? (
                        <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-[11px] font-bold text-slate-950">
                          {conversation.unread}
                        </span>
                      ) : null}
                      {conversation.time ? (
                        <span className="text-xs font-medium text-slate-300">{conversation.time}</span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-200">
                    {conversation.preview}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="mt-auto rounded-[24px] border border-cyan-300/18 bg-gradient-to-br from-cyan-300/18 via-slate-900/55 to-white/7 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-50/85">
              Performance
            </p>
            <p className="mt-3 text-3xl font-bold text-white">98%</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-200">
              Faster scanning, stronger contrast, and more room for primary content.
            </p>
          </div>
        </aside>

        <section className="flex min-h-[calc(100vh-8.5rem)] flex-1 flex-col bg-gradient-to-b from-slate-950/32 via-slate-950/20 to-slate-950/42">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/12 px-4 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-100/80">
                Active conversation
              </p>
              <h2 className="mt-2 text-[2rem] font-semibold text-white">
                {activeConversationTitle}
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-300">
                {activeConversationSubtitle}
              </p>
            </div>

            <div className="flex w-full flex-wrap gap-3 md:w-auto">
              {quickActions.map((action) => (
                <button
                  key={action}
                  className="rounded-full border border-white/12 bg-white/8 px-3.5 py-2 text-sm font-semibold text-slate-100 transition duration-300 ease-in-out hover:-translate-y-0.5 hover:border-cyan-300/24 hover:bg-white/12 hover:shadow-[0_0_24px_rgba(0,229,255,0.12)]"
                >
                  {action}
                </button>
              ))}
            </div>
          </header>

          <div className="grid flex-1 gap-4 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1.2fr)_256px] xl:px-6">
            <div className="flex min-h-[400px] flex-col rounded-[24px] border border-white/12 bg-slate-950/42 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5 lg:p-6">
              <div className="mb-6 flex items-center justify-between gap-4 xl:hidden">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/20 text-sm font-bold text-cyan-50">
                    HT
                  </div>
                  <div>
                    <p className="font-semibold text-white">Haley Tran</p>
                    <p className="text-sm font-medium text-slate-300">Luxury dark workspace</p>
                  </div>
                </div>
                <span className="rounded-full border border-cyan-300/24 bg-cyan-300/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-50">
                  Focus mode
                </span>
              </div>

              <div className="space-y-5">
                {isLoadingMessages && !isPreviewMode ? (
                  <div className="rounded-[22px] border border-white/12 bg-white/7 px-4 py-4 text-sm font-medium text-slate-300">
                    Loading messages...
                  </div>
                ) : renderedMessages.length > 0 ? (
                  renderedMessages.map((message) => (
                    <div
                      key={message.id || `${message.sender}-${message.text}`}
                      className={`w-full rounded-[22px] border px-4 py-4 transition duration-300 ease-in-out lg:px-5 ${
                        message.isUser
                          ? "ml-auto max-w-2xl border-cyan-300/30 bg-cyan-300/15 text-slate-50 shadow-[0_18px_40px_rgba(0,229,255,0.08)]"
                          : "max-w-3xl border-white/12 bg-white/7 text-slate-100"
                      }`}
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <p className="font-semibold text-white">{message.sender}</p>
                        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                          {message.role}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-7 text-slate-100/95">
                        {message.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <div
                    className="w-full rounded-[22px] border border-white/12 bg-white/7 px-4 py-4 text-sm font-medium leading-7 text-slate-300 lg:px-5"
                  >
                    No messages yet. Start the conversation to populate this panel with live chat history.
                  </div>
                )}
              </div>

              <div className="mt-auto pt-7">
                <div className="rounded-[24px] border border-white/12 bg-slate-950/78 p-3 shadow-[0_28px_60px_rgba(15,23,42,0.4)]">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <label className="flex-1">
                      <span className="sr-only">Message</span>
                      <textarea
                        className="min-h-[108px] w-full resize-none rounded-[20px] border border-white/12 bg-white/7 px-4 py-3.5 text-sm font-medium text-white outline-none transition duration-300 ease-in-out placeholder:text-slate-400 focus:border-cyan-300/50 focus:bg-white/10 focus:shadow-[0_0_0_1px_rgba(0,229,255,0.12)]"
                        placeholder="Draft a refined response, gather client notes, or start a new conversation..."
                      />
                    </label>
                    <button className="rounded-[20px] bg-[#00E5FF] px-5 py-3.5 font-semibold text-slate-950 transition duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-[0_0_28px_rgba(0,229,255,0.3)]">
                      Send Message
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-2">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                      <span className="rounded-full border border-white/12 px-3 py-1">
                        Smooth motion
                      </span>
                      <span className="rounded-full border border-white/12 px-3 py-1">
                        Easy scanning
                      </span>
                      <span className="rounded-full border border-white/12 px-3 py-1">
                        Premium finish
                      </span>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                      Live draft
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <aside className="rounded-[24px] border border-white/12 bg-slate-950/48 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-100/80">
                Media and files
              </p>
              <h3 className="mt-3 text-lg font-semibold text-white">
                Supporting context, without clutter
              </h3>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-200">
                The right rail uses the extra width for practical context, which makes the overall frame feel intentional rather than empty.
              </p>

              <div className="mt-5 rounded-[20px] border border-white/12 bg-gradient-to-br from-white/10 to-white/5 p-4">
                <p className="text-sm font-semibold text-slate-200">Shared this week</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-[20px] border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-2xl font-bold text-white">24</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                      Assets
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-cyan-300/18 bg-cyan-300/12 p-4">
                    <p className="text-2xl font-bold text-white">8</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-50">
                      Reviews
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {sharedFiles.map((file) => (
                  <div
                    key={file.name}
                    className="rounded-[18px] border border-white/12 bg-white/6 p-3.5 transition duration-300 ease-in-out hover:border-cyan-300/24 hover:bg-white/8"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{file.name}</p>
                        <p className="mt-1 text-sm font-medium text-slate-300">{file.type}</p>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {file.size}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[20px] border border-white/12 bg-white/6 p-4">
                <p className="text-sm font-semibold text-slate-200">Design direction</p>
                <p className="mt-2 text-sm font-medium leading-7 text-slate-300">
                  Wider framing, brighter accents, and stronger type contrast push the concept closer to a truly usable luxury product.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}

Home.propTypes = {
  currentUser: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    fullName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }),
  onLogout: PropTypes.func,
};

export default Home;
