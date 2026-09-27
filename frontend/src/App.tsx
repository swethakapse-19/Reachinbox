import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  createSender,
  disconnectSlack,
  getCurrentUser,
  getEmails,
  getSenders,
  getSlackStatus,
  logout,
  scheduleBulkEmails,
  searchEmails,
  toggleSender,
  type Email,
  type Sender,
  type SlackStatus,
  type User,
} from "./services/api";

type Tab = "scheduled" | "sent";

/* =========================================================
   PRODUCTION API
   ========================================================= */

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "https://reachinbox-backend-tmec.onrender.com/api";

const BACKEND_BASE = API_BASE.replace(/\/api\/?$/, "");

/* =========================================================
   HELPERS
   ========================================================= */

function getMinimumDateTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 1);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function parseRecipients(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/* =========================================================
   APP
   ========================================================= */

function App() {
  const [user, setUser] = useState<User | null>(null);

  const [emails, setEmails] = useState<Email[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);

  const [slack, setSlack] = useState<SlackStatus>({
    connected: false,
    team: null,
    channelId: null,
    connectedAt: null,
  });

  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [error, setError] = useState("");

  const [activeTab, setActiveTab] =
    useState<Tab>("scheduled");

  const [searchQuery, setSearchQuery] = useState("");

  const [showCompose, setShowCompose] =
    useState(false);

  const [showSenderModal, setShowSenderModal] =
    useState(false);

  const [showSenderManager, setShowSenderManager] =
    useState(false);

  const [composeLoading, setComposeLoading] =
    useState(false);

  const [senderLoading, setSenderLoading] =
    useState(false);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [slackLoading, setSlackLoading] =
    useState(false);

  const [composeError, setComposeError] =
    useState("");

  const [senderError, setSenderError] =
    useState("");

  /* =========================================================
     COMPOSE FORM
     ========================================================= */

  const [recipients, setRecipients] =
    useState("");

  const [subject, setSubject] =
    useState("");

  const [body, setBody] =
    useState("");

  const [scheduledAt, setScheduledAt] =
    useState(getMinimumDateTime());

  const [delayBetweenEmailsMs, setDelayBetweenEmailsMs] =
    useState("1000");

  const [selectedSenderId, setSelectedSenderId] =
    useState("");

  /* =========================================================
     SENDER FORM
     ========================================================= */

  const [senderName, setSenderName] =
    useState("");

  const [senderEmail, setSenderEmail] =
    useState("");

  const [senderHost, setSenderHost] =
    useState("smtp.ethereal.email");

  const [senderPort, setSenderPort] =
    useState("587");

  const [senderSecure, setSenderSecure] =
    useState(false);

  const [senderUsername, setSenderUsername] =
    useState("");

  const [senderPassword, setSenderPassword] =
    useState("");

  const [uploadCount, setUploadCount] =
    useState(0);

  /* =========================================================
     DERIVED DATA
     ========================================================= */

  const activeSenders = useMemo(
    () =>
      senders.filter(
        (sender) => sender.isActive
      ),
    [senders]
  );

  const scheduledEmails = useMemo(
    () =>
      emails.filter(
        (email) =>
          email.status === "SCHEDULED" ||
          email.status === "PROCESSING"
      ),
    [emails]
  );

  const sentEmails = useMemo(
    () =>
      emails.filter(
        (email) =>
          email.status === "SENT" ||
          email.status === "FAILED"
      ),
    [emails]
  );

  const visibleEmails =
    activeTab === "scheduled"
      ? scheduledEmails
      : sentEmails;

  const stats = useMemo(() => {
    return {
      total: emails.length,

      scheduled: emails.filter(
        (email) =>
          email.status === "SCHEDULED"
      ).length,

      processing: emails.filter(
        (email) =>
          email.status === "PROCESSING"
      ).length,

      sent: emails.filter(
        (email) =>
          email.status === "SENT"
      ).length,

      failed: emails.filter(
        (email) =>
          email.status === "FAILED"
      ).length,
    };
  }, [emails]);

  /* =========================================================
     LOAD DASHBOARD
     ========================================================= */

  async function loadDashboard(
    currentUser: User
  ) {
    setDashboardLoading(true);
    setError("");

    try {
      const [
        emailData,
        senderData,
        slackData,
      ] = await Promise.all([
        getEmails(currentUser.id),
        getSenders(currentUser.id),
        getSlackStatus(currentUser.id),
      ]);

      setEmails(emailData);
      setSenders(senderData);
      setSlack(slackData);

      if (
        !selectedSenderId &&
        senderData.length > 0
      ) {
        const firstActive =
          senderData.find(
            (sender) => sender.isActive
          );

        if (firstActive) {
          setSelectedSenderId(
            firstActive.id
          );
        }
      }
    } catch (err) {
      console.error(
        "Dashboard loading error:",
        err
      );

      setError(
        "Unable to load dashboard data. Please check the backend connection."
      );
    } finally {
      setDashboardLoading(false);
    }
  }

  /* =========================================================
     INITIAL AUTH
     ========================================================= */

  useEffect(() => {
    async function initialize() {
      try {
        const currentUser =
          await getCurrentUser();

        setUser(currentUser);

        await loadDashboard(
          currentUser
        );
      } catch (err) {
        console.error(
          "Authentication error:",
          err
        );

        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  /* =========================================================
     AUTO REFRESH
     ========================================================= */

  useEffect(() => {
    if (!user) return;

    const interval = window.setInterval(
      async () => {
        try {
          const emailData =
            await getEmails(user.id);

          setEmails(emailData);
        } catch (err) {
          console.error(
            "Auto refresh error:",
            err
          );
        }
      },
      10000
    );

    return () =>
      window.clearInterval(interval);
  }, [user]);

  /* =========================================================
     REFRESH
     ========================================================= */

  async function handleRefresh() {
    if (!user) return;

    await loadDashboard(user);
  }

  /* =========================================================
     LOGOUT
     ========================================================= */

  async function handleLogout() {
    try {
      await logout();
    } catch (err) {
      console.error(
        "Logout error:",
        err
      );
    } finally {
      setUser(null);
      window.location.href = "/";
    }
  }

  /* =========================================================
     SEARCH
     ========================================================= */

  async function handleSearch() {
    if (!user) return;

    const query =
      searchQuery.trim();

    if (!query) {
      await loadDashboard(user);
      return;
    }

    setSearchLoading(true);
    setError("");

    try {
      const results =
        await searchEmails(
          user.id,
          query
        );

      setEmails(results);
    } catch (err) {
      console.error(
        "Search error:",
        err
      );

      setError(
        "Search failed. Please try again."
      );
    } finally {
      setSearchLoading(false);
    }
  }

  /* =========================================================
     CSV / TXT UPLOAD
     ========================================================= */

  function handleFileUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = () => {
      const content = String(
        reader.result || ""
      );

      const parsed =
        parseRecipients(content);

      const valid =
        parsed.filter(
          isValidEmail
        );

      setRecipients(
        valid.join("\n")
      );

      setUploadCount(
        valid.length
      );
    };

    reader.readAsText(file);

    event.target.value = "";
  }

  /* =========================================================
     SCHEDULE EMAILS
     ========================================================= */

  async function handleSchedule(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user) return;

    setComposeError("");

    const recipientList =
      parseRecipients(
        recipients
      );

    if (
      recipientList.length === 0
    ) {
      setComposeError(
        "Add at least one recipient."
      );

      return;
    }

    const invalidRecipients =
      recipientList.filter(
        (email) =>
          !isValidEmail(email)
      );

    if (
      invalidRecipients.length > 0
    ) {
      setComposeError(
        "Please check the recipient email addresses."
      );

      return;
    }

    if (!subject.trim()) {
      setComposeError(
        "Subject is required."
      );

      return;
    }

    if (!body.trim()) {
      setComposeError(
        "Email body is required."
      );

      return;
    }

    if (
      activeSenders.length > 0 &&
      !selectedSenderId
    ) {
      setComposeError(
        "Please select a sender."
      );

      return;
    }

    const date =
      new Date(scheduledAt);

    if (
      Number.isNaN(date.getTime())
    ) {
      setComposeError(
        "Please select a valid start time."
      );

      return;
    }

    setComposeLoading(true);

    try {
      await scheduleBulkEmails({
        userId: user.id,

        recipients:
          recipientList,

        subject:
          subject.trim(),

        body:
          body.trim(),

        scheduledAt:
          date.toISOString(),

        delayBetweenEmailsMs:
          Number(
            delayBetweenEmailsMs
          ) || 0,

        senderId:
          selectedSenderId ||
          undefined,
      });

      setShowCompose(false);

      setRecipients("");
      setSubject("");
      setBody("");

      setUploadCount(0);

      setScheduledAt(
        getMinimumDateTime()
      );

      await loadDashboard(
        user
      );
    } catch (err: any) {
      console.error(
        "Schedule error:",
        err
      );

      setComposeError(
        err?.response?.data
          ?.message ||
          "Failed to schedule emails."
      );
    } finally {
      setComposeLoading(false);
    }
  }

  /* =========================================================
     CREATE SENDER
     ========================================================= */

  async function handleCreateSender(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user) return;

    setSenderError("");

    if (
      !senderName.trim() ||
      !senderEmail.trim() ||
      !senderHost.trim() ||
      !senderUsername.trim() ||
      !senderPassword
    ) {
      setSenderError(
        "Please fill in all sender fields."
      );

      return;
    }

    if (
      !isValidEmail(
        senderEmail.trim()
      )
    ) {
      setSenderError(
        "Enter a valid sender email."
      );

      return;
    }

    setSenderLoading(true);

    try {
      const sender =
        await createSender({
          userId: user.id,

          name:
            senderName.trim(),

          email:
            senderEmail.trim(),

          host:
            senderHost.trim(),

          port:
            Number(senderPort) || 587,

          secure:
            senderSecure,

          username:
            senderUsername.trim(),

          password:
            senderPassword,
        });

      setSenders(
        (current) => [
          ...current,
          sender,
        ]
      );

      setSelectedSenderId(
        sender.id
      );

      setSenderName("");
      setSenderEmail("");
      setSenderHost(
        "smtp.ethereal.email"
      );
      setSenderPort("587");
      setSenderSecure(false);
      setSenderUsername("");
      setSenderPassword("");

      setShowSenderModal(false);

      await loadDashboard(user);
    } catch (err: any) {
      console.error(
        "Create sender error:",
        err
      );

      setSenderError(
        err?.response?.data
          ?.message ||
          "Failed to create sender."
      );
    } finally {
      setSenderLoading(false);
    }
  }

  /* =========================================================
     TOGGLE SENDER
     ========================================================= */

  async function handleToggleSender(
    sender: Sender
  ) {
    if (!user) return;

    try {
      const updated =
        await toggleSender(
          sender.id,
          !sender.isActive
        );

      setSenders(
        (current) =>
          current.map(
            (item) =>
              item.id === updated.id
                ? updated
                : item
          )
      );
    } catch (err) {
      console.error(
        "Toggle sender error:",
        err
      );

      setError(
        "Unable to update sender."
      );
    }
  }

  /* =========================================================
     SLACK
     ========================================================= */

  function handleConnectSlack() {
    if (!user) return;

    window.location.href =
      `${BACKEND_BASE}/api/slack/oauth/start?userId=${encodeURIComponent(
        user.id
      )}`;
  }

  async function handleDisconnectSlack() {
    if (!user) return;

    setSlackLoading(true);

    try {
      await disconnectSlack(
        user.id
      );

      const status =
        await getSlackStatus(
          user.id
        );

      setSlack(status);
    } catch (err) {
      console.error(
        "Slack disconnect error:",
        err
      );

      setError(
        "Unable to disconnect Slack."
      );
    } finally {
      setSlackLoading(false);
    }
  }

  /* =========================================================
     LOADING SCREEN
     ========================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold mb-3">
            ReachInbox
          </div>

          <div className="text-slate-400">
            Loading dashboard...
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     LOGIN SCREEN
     ========================================================= */

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <div className="text-center">
              <div className="text-4xl mb-4">
                ✉️
              </div>

              <h1 className="text-3xl font-bold">
                ReachInbox
              </h1>

              <p className="text-slate-400 mt-2">
                Email scheduling dashboard
              </p>

              <button
                onClick={() => {
                  window.location.href =
                    `${API_BASE}/auth/google`;
                }}
                className="w-full mt-8 bg-white text-slate-900 hover:bg-slate-100 rounded-xl py-3 font-semibold transition"
              >
                Continue with Google
              </button>

              <p className="text-xs text-slate-500 mt-5">
                Secure authentication powered
                by Google OAuth.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     DASHBOARD
     ========================================================= */

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* HEADER */}

      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              ReachInbox
            </h1>

            <p className="text-sm text-slate-400">
              Email Scheduler Dashboard
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">
                {user.name ||
                  user.email}
              </p>

              <p className="text-xs text-slate-500">
                {user.email}
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-red-300">
            {error}
          </div>
        )}

        {/* TOP ACTIONS */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold">
              Dashboard
            </h2>

            <p className="text-slate-400 mt-1">
              Manage scheduled and sent emails.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRefresh}
              disabled={dashboardLoading}
              className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-50"
            >
              {dashboardLoading
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              onClick={() => {
                setComposeError("");
                setShowCompose(true);
              }}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold"
            >
              + Schedule Emails
            </button>
          </div>
        </div>

        {/* STATS */}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-slate-400 text-sm">
              Total
            </p>

            <p className="text-3xl font-bold mt-2">
              {stats.total}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-slate-400 text-sm">
              Scheduled
            </p>

            <p className="text-3xl font-bold mt-2 text-yellow-400">
              {stats.scheduled}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-slate-400 text-sm">
              Processing
            </p>

            <p className="text-3xl font-bold mt-2 text-blue-400">
              {stats.processing}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-slate-400 text-sm">
              Sent
            </p>

            <p className="text-3xl font-bold mt-2 text-green-400">
              {stats.sent}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-slate-400 text-sm">
              Failed
            </p>

            <p className="text-3xl font-bold mt-2 text-red-400">
              {stats.failed}
            </p>
          </div>
        </div>

        {/* SENDERS + SLACK */}

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* SENDERS */}

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold">
                  Email Senders
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  {activeSenders.length} active sender
                  {activeSenders.length === 1
                    ? ""
                    : "s"}
                </p>
              </div>

              <button
                onClick={() => {
                  setSenderError("");
                  setShowSenderModal(true);
                }}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
              >
                + Add Sender
              </button>
            </div>

            {senders.length === 0 ? (
              <div className="text-slate-500 text-sm">
                No senders added yet.
              </div>
            ) : (
              <div className="space-y-3">
                {senders.map(
                  (sender) => (
                    <div
                      key={sender.id}
                      className="flex items-center justify-between border border-slate-800 rounded-lg p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {sender.name}
                        </p>

                        <p className="text-xs text-slate-500 truncate">
                          {sender.email}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          handleToggleSender(
                            sender
                          )
                        }
                        className={`ml-4 px-3 py-1 rounded-full text-xs ${
                          sender.isActive
                            ? "bg-green-500/20 text-green-400"
                            : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {sender.isActive
                          ? "Active"
                          : "Inactive"}
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            <button
              onClick={() =>
                setShowSenderManager(
                  !showSenderManager
                )
              }
              className="mt-4 text-sm text-indigo-400 hover:text-indigo-300"
            >
              {showSenderManager
                ? "Hide sender manager"
                : "Manage senders"}
            </button>

            {showSenderManager &&
              senders.length > 0 && (
                <div className="mt-4 border-t border-slate-800 pt-4 space-y-2">
                  {senders.map(
                    (sender) => (
                      <div
                        key={sender.id}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-slate-300">
                          {sender.email}
                        </span>

                        <button
                          onClick={() =>
                            handleToggleSender(
                              sender
                            )
                          }
                          className="text-indigo-400"
                        >
                          Toggle
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
          </div>

          {/* SLACK */}

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  Slack
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  Notifications integration
                </p>
              </div>

              <div
                className={`w-3 h-3 rounded-full ${
                  slack.connected
                    ? "bg-green-400"
                    : "bg-slate-600"
                }`}
              />
            </div>

            <div className="mt-6">
              {slack.connected ? (
                <>
                  <p className="text-green-400 font-medium">
                    Connected
                  </p>

                  {slack.team && (
                    <p className="text-sm text-slate-400 mt-1">
                      Team: {slack.team}
                    </p>
                  )}

                  <button
                    onClick={
                      handleDisconnectSlack
                    }
                    disabled={slackLoading}
                    className="mt-4 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm"
                  >
                    {slackLoading
                      ? "Disconnecting..."
                      : "Disconnect Slack"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-slate-400">
                    Slack is not connected.
                  </p>

                  <button
                    onClick={
                      handleConnectSlack
                    }
                    className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold"
                  >
                    Connect Slack
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* EMAIL SECTION */}

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {/* TABS + SEARCH */}

          <div className="p-5 border-b border-slate-800">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setActiveTab(
                      "scheduled"
                    )
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    activeTab ===
                    "scheduled"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  Scheduled (
                  {scheduledEmails.length})
                </button>

                <button
                  onClick={() =>
                    setActiveTab("sent")
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    activeTab === "sent"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  Sent (
                  {sentEmails.length})
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      handleSearch();
                    }
                  }}
                  placeholder="Search emails..."
                  className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:border-indigo-500 w-full lg:w-72"
                />

                <button
                  onClick={handleSearch}
                  disabled={searchLoading}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
                >
                  {searchLoading
                    ? "..."
                    : "Search"}
                </button>
              </div>
            </div>
          </div>

          {/* EMAIL TABLE */}

          {dashboardLoading ? (
            <div className="p-12 text-center text-slate-500">
              Loading emails...
            </div>
          ) : visibleEmails.length ===
            0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">
                ✉️
              </div>

              <h3 className="font-semibold">
                No emails found
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                {activeTab ===
                "scheduled"
                  ? "Schedule your first email to see it here."
                  : "Sent emails will appear here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-950">
                  <tr>
                    <th className="px-5 py-3 text-xs uppercase text-slate-500">
                      Recipient
                    </th>

                    <th className="px-5 py-3 text-xs uppercase text-slate-500">
                      Subject
                    </th>

                    <th className="px-5 py-3 text-xs uppercase text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-xs uppercase text-slate-500">
                      Scheduled
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleEmails.map(
                    (email) => (
                      <tr
                        key={email.id}
                        className="border-t border-slate-800"
                      >
                        <td className="px-5 py-4 text-sm">
                          {email.to}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-300 max-w-xs truncate">
                          {email.subject}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                              email.status ===
                              "SENT"
                                ? "bg-green-500/20 text-green-400"
                                : email.status ===
                                  "FAILED"
                                ? "bg-red-500/20 text-red-400"
                                : email.status ===
                                  "PROCESSING"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                            {email.status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-400">
                          {formatDate(
                            email.scheduledAt
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* =====================================================
          COMPOSE MODAL
          ===================================================== */}

      {showCompose && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Schedule Emails
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Schedule bulk emails for delivery.
                </p>
              </div>

              <button
                onClick={() =>
                  setShowCompose(false)
                }
                className="text-slate-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSchedule}
              className="p-6 space-y-5"
            >
              {composeError && (
                <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
                  {composeError}
                </div>
              )}

              <div>
                <label className="block text-sm mb-2">
                  Recipients
                </label>

                <textarea
                  value={recipients}
                  onChange={(event) =>
                    setRecipients(
                      event.target.value
                    )
                  }
                  placeholder="one@email.com&#10;two@email.com"
                  rows={5}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-indigo-500"
                />

                <div className="flex items-center justify-between mt-2">
                  <label className="text-sm text-indigo-400 cursor-pointer">
                    Upload CSV/TXT
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={
                        handleFileUpload
                      }
                      className="hidden"
                    />
                  </label>

                  {uploadCount > 0 && (
                    <span className="text-xs text-green-400">
                      {uploadCount} valid recipients
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2">
                  Subject
                </label>

                <input
                  value={subject}
                  onChange={(event) =>
                    setSubject(
                      event.target.value
                    )
                  }
                  placeholder="Email subject"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm mb-2">
                  Body
                </label>

                <textarea
                  value={body}
                  onChange={(event) =>
                    setBody(
                      event.target.value
                    )
                  }
                  placeholder="Email body..."
                  rows={7}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2">
                    Start time
                  </label>

                  <input
                    type="datetime-local"
                    min={getMinimumDateTime()}
                    value={scheduledAt}
                    onChange={(event) =>
                      setScheduledAt(
                        event.target.value
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">
                    Delay between emails (ms)
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={
                      delayBetweenEmailsMs
                    }
                    onChange={(event) =>
                      setDelayBetweenEmailsMs(
                        event.target.value
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none"
                  />
                </div>
              </div>

              {senders.length > 0 && (
                <div>
                  <label className="block text-sm mb-2">
                    Sender
                  </label>

                  <select
                    value={
                      selectedSenderId
                    }
                    onChange={(event) =>
                      setSelectedSenderId(
                        event.target.value
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none"
                  >
                    <option value="">
                      Select sender
                    </option>

                    {activeSenders.map(
                      (sender) => (
                        <option
                          key={sender.id}
                          value={
                            sender.id
                          }
                        >
                          {sender.name} -{" "}
                          {sender.email}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setShowCompose(false)
                  }
                  className="px-5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={composeLoading}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-50"
                >
                  {composeLoading
                    ? "Scheduling..."
                    : "Schedule Emails"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          ADD SENDER MODAL
          ===================================================== */}

      {showSenderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Add Email Sender
              </h2>

              <button
                onClick={() =>
                  setShowSenderModal(false)
                }
                className="text-slate-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleCreateSender
              }
              className="p-6 space-y-4"
            >
              {senderError && (
                <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
                  {senderError}
                </div>
              )}

              <div>
                <label className="block text-sm mb-2">
                  Sender name
                </label>

                <input
                  value={senderName}
                  onChange={(event) =>
                    setSenderName(
                      event.target.value
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm mb-2">
                  Email
                </label>

                <input
                  type="email"
                  value={senderEmail}
                  onChange={(event) =>
                    setSenderEmail(
                      event.target.value
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2">
                    SMTP Host
                  </label>

                  <input
                    value={senderHost}
                    onChange={(event) =>
                      setSenderHost(
                        event.target.value
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">
                    Port
                  </label>

                  <input
                    value={senderPort}
                    onChange={(event) =>
                      setSenderPort(
                        event.target.value
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={senderSecure}
                  onChange={(event) =>
                    setSenderSecure(
                      event.target.checked
                    )
                  }
                />

                Use secure SMTP
              </label>

              <div>
                <label className="block text-sm mb-2">
                  SMTP username
                </label>

                <input
                  value={senderUsername}
                  onChange={(event) =>
                    setSenderUsername(
                      event.target.value
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm mb-2">
                  SMTP password
                </label>

                <input
                  type="password"
                  value={senderPassword}
                  onChange={(event) =>
                    setSenderPassword(
                      event.target.value
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowSenderModal(
                      false
                    )
                  }
                  className="px-5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={senderLoading}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-50"
                >
                  {senderLoading
                    ? "Saving..."
                    : "Add Sender"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;