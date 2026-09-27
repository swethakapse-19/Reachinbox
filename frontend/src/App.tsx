import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
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

const API_BASE = "/api";

function getMinimumDateTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 1);

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");
  const hours = String(
    date.getHours()
  ).padStart(2, "0");
  const minutes = String(
    date.getMinutes()
  ).padStart(2, "0");

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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );
}

function App() {
  const [user, setUser] =
    useState<User | null>(null);

  const [emails, setEmails] =
    useState<Email[]>([]);

  const [senders, setSenders] =
    useState<Sender[]>([]);

  const [slack, setSlack] =
    useState<SlackStatus>({
      connected: false,
      team: null,
      channelId: null,
      connectedAt: null,
    });

  const [loading, setLoading] =
    useState(true);

  const [dashboardLoading, setDashboardLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [activeTab, setActiveTab] =
    useState<Tab>("scheduled");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [showCompose, setShowCompose] =
    useState(false);

  const [showSenderModal, setShowSenderModal] =
    useState(false);

  const [
    showSenderManager,
    setShowSenderManager,
  ] = useState(false);

  const [
    composeLoading,
    setComposeLoading,
  ] = useState(false);

  const [
    senderLoading,
    setSenderLoading,
  ] = useState(false);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [
    slackLoading,
    setSlackLoading,
  ] = useState(false);

  const [composeError, setComposeError] =
    useState("");

  const [senderError, setSenderError] =
    useState("");

  const [recipients, setRecipients] =
    useState("");

  const [subject, setSubject] =
    useState("");

  const [body, setBody] =
    useState("");

  const [scheduledAt, setScheduledAt] =
    useState(getMinimumDateTime());

  const [
    delayBetweenEmailsMs,
    setDelayBetweenEmailsMs,
  ] = useState("1000");

  const [
    selectedSenderId,
    setSelectedSenderId,
  ] = useState("");

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
        (email) => email.status === "SENT"
      ).length,
      failed: emails.filter(
        (email) => email.status === "FAILED"
      ).length,
    };
  }, [emails]);

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
        "Unable to load dashboard data. Make sure the backend is running."
      );
    } finally {
      setDashboardLoading(false);
    }
  }

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

  async function handleRefresh() {
    if (!user) return;

    await loadDashboard(user);
  }

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

  function handleFileUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = () => {
      const content =
        String(
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

    if (recipientList.length === 0) {
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

    if (invalidRecipients.length > 0) {
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
          sender,
          ...current,
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

  async function handleToggleSender(
    sender: Sender
  ) {
    try {
      const updated =
        await toggleSender(
          sender.id,
          !sender.isActive
        );

      setSenders(
        (current) =>
          current.map((item) =>
            item.id === sender.id
              ? updated
              : item
          )
      );

      if (
        !updated.isActive &&
        selectedSenderId ===
          updated.id
      ) {
        const next =
          senders.find(
            (item) =>
              item.id !==
                updated.id &&
              item.isActive
          );

        setSelectedSenderId(
          next?.id || ""
        );
      }
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

  function handleConnectSlack() {
    if (!user) return;

    setSlackLoading(true);

    window.location.href =
      `${API_BASE}/slack/oauth/start?userId=${encodeURIComponent(
        user.id
      )}`;
  }

  async function handleDisconnectSlack() {
    if (!user) return;

    const confirmed =
      window.confirm(
        "Disconnect Slack from ReachInbox?"
      );

    if (!confirmed) return;

    setSlackLoading(true);

    try {
      await disconnectSlack(
        user.id
      );

      setSlack({
        connected: false,
        team: null,
        channelId: null,
        connectedAt: null,
      });
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080b12] flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
          <p className="text-sm text-slate-400">
            Loading ReachInbox...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen />
    );
  }

  return (
    <div className="min-h-screen bg-[#080b12] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#080b12]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-lg shadow-blue-900/30">
              R
            </div>

            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                ReachInbox
              </h1>
              <p className="text-xs text-slate-500">
                Email Scheduler
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-200">
                {user.name}
              </p>
              <p className="text-xs text-slate-500">
                {user.email}
              </p>
            </div>

            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-10 w-10 rounded-full border border-slate-700"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 font-semibold">
                {user.name
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}

            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <span>{error}</span>
            <button
              onClick={() =>
                setError("")
              }
              className="ml-4 text-red-300 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage scheduled email campaigns,
              senders and Slack notifications.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                window.open(
                  "http://localhost:5000/admin/queues",
                  "_blank"
                )
              }
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
            >
              Queue Monitor
            </button>

            <button
              onClick={handleRefresh}
              disabled={dashboardLoading}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
            >
              + Compose
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard
            label="Total"
            value={stats.total}
          />
          <StatCard
            label="Scheduled"
            value={stats.scheduled}
          />
          <StatCard
            label="Processing"
            value={stats.processing}
          />
          <StatCard
            label="Sent"
            value={stats.sent}
          />
          <StatCard
            label="Failed"
            value={stats.failed}
          />
        </div>

        <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-slate-800 bg-[#0d111a]">
            <div className="border-b border-slate-800 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold">
                    Email Activity
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Monitor scheduled and sent emails.
                  </p>
                </div>

                <div className="flex rounded-lg border border-slate-800 bg-[#080b12] p-1">
                  <button
                    onClick={() =>
                      setActiveTab(
                        "scheduled"
                      )
                    }
                    className={`rounded-md px-4 py-2 text-sm ${
                      activeTab ===
                      "scheduled"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Scheduled
                  </button>

                  <button
                    onClick={() =>
                      setActiveTab("sent")
                    }
                    className={`rounded-md px-4 py-2 text-sm ${
                      activeTab === "sent"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Sent
                  </button>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
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
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#080b12] px-4 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500"
                />

                <button
                  onClick={handleSearch}
                  disabled={searchLoading}
                  className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  {searchLoading
                    ? "..."
                    : "Search"}
                </button>
              </div>
            </div>

            {visibleEmails.length ===
            0 ? (
              <EmptyState
                title={
                  activeTab ===
                  "scheduled"
                    ? "No scheduled emails"
                    : "No sent emails"
                }
                description={
                  activeTab ===
                  "scheduled"
                    ? "Create your first email campaign to see scheduled jobs here."
                    : "Sent email activity will appear here."
                }
                action={
                  activeTab ===
                  "scheduled" ? (
                    <button
                      onClick={() => {
                        setComposeError(
                          ""
                        );
                        setShowCompose(
                          true
                        );
                      }}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                    >
                      Create Campaign
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3">
                        Recipient
                      </th>
                      <th className="px-5 py-3">
                        Subject
                      </th>
                      <th className="px-5 py-3">
                        Status
                      </th>
                      <th className="px-5 py-3">
                        Scheduled
                      </th>
                      <th className="px-5 py-3">
                        Sent
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleEmails.map(
                      (email) => (
                        <tr
                          key={email.id}
                          className="border-b border-slate-800/70 last:border-0 hover:bg-slate-800/20"
                        >
                          <td className="px-5 py-4 font-medium text-slate-200">
                            {email.to}
                          </td>

                          <td className="max-w-[280px] truncate px-5 py-4 text-slate-400">
                            {email.subject}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              status={
                                email.status
                              }
                            />
                          </td>

                          <td className="px-5 py-4 text-xs text-slate-500">
                            {formatDate(
                              email.scheduledAt
                            )}
                          </td>

                          <td className="px-5 py-4 text-xs text-slate-500">
                            {formatDate(
                              email.sentAt
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="space-y-5">
            <SlackCard
              slack={slack}
              loading={slackLoading}
              onConnect={
                handleConnectSlack
              }
              onDisconnect={
                handleDisconnectSlack
              }
            />

            <SenderCard
              senders={senders}
              onManage={() =>
                setShowSenderManager(
                  true
                )
              }
              onAdd={() => {
                setSenderError("");
                setShowSenderModal(
                  true
                );
              }}
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <InfoCard
            title="Reliable scheduling"
            description="BullMQ delayed jobs keep scheduled emails persistent across server restarts."
          />

          <InfoCard
            title="Rate limiting"
            description="Email throughput is controlled with a configurable hourly limit and minimum delay."
          />

          <InfoCard
            title="Scalable workers"
            description="Worker concurrency can process large batches without relying on cron jobs."
          />
        </div>
      </main>

      {showCompose && (
        <Modal
          title="Create Email Campaign"
          onClose={() =>
            setShowCompose(false)
          }
        >
          <form
            onSubmit={handleSchedule}
            className="space-y-5"
          >
            {composeError && (
              <Alert
                message={composeError}
              />
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Sender
              </label>

              {activeSenders.length >
              0 ? (
                <div className="flex gap-2">
                  <select
                    value={
                      selectedSenderId
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedSenderId(
                        event.target
                          .value
                      )
                    }
                    className="flex-1 rounded-lg border border-slate-700 bg-[#080b12] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="">
                      Select sender
                    </option>

                    {activeSenders.map(
                      (sender) => (
                        <option
                          key={
                            sender.id
                          }
                          value={
                            sender.id
                          }
                        >
                          {sender.name}{" "}
                          —{" "}
                          {sender.email}
                        </option>
                      )
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      setShowSenderModal(
                        true
                      )
                    }
                    className="rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    +
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-300">
                  No active sender configured.
                  Add a sender before scheduling.
                  <button
                    type="button"
                    onClick={() =>
                      setShowSenderModal(
                        true
                      )
                    }
                    className="ml-2 font-semibold underline"
                  >
                    Add sender
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Recipients
              </label>

              <textarea
                value={recipients}
                onChange={(event) => {
                  setRecipients(
                    event.target.value
                  );
                  setUploadCount(0);
                }}
                placeholder={`Enter email addresses separated by commas or new lines`}
                rows={5}
                className="w-full resize-none rounded-lg border border-slate-700 bg-[#080b12] px-3 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500"
              />

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {parseRecipients(
                    recipients
                  ).length}{" "}
                  recipient(s)
                </span>

                <label className="cursor-pointer rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800">
                  Upload CSV/TXT
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={
                      handleFileUpload
                    }
                  />
                </label>
              </div>

              {uploadCount > 0 && (
                <p className="mt-1 text-xs text-green-400">
                  {uploadCount} valid email
                  address(es) loaded from file.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
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
                className="w-full rounded-lg border border-slate-700 bg-[#080b12] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Email Body
              </label>

              <textarea
                value={body}
                onChange={(event) =>
                  setBody(
                    event.target.value
                  )
                }
                placeholder="Write your email..."
                rows={7}
                className="w-full resize-none rounded-lg border border-slate-700 bg-[#080b12] px-3 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Start Time
                </label>

                <input
                  type="datetime-local"
                  min={getMinimumDateTime()}
                  value={scheduledAt}
                  onChange={(event) =>
                    setScheduledAt(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-lg border border-slate-700 bg-[#080b12] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Delay Between Emails
                </label>

                <select
                  value={
                    delayBetweenEmailsMs
                  }
                  onChange={(event) =>
                    setDelayBetweenEmailsMs(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-lg border border-slate-700 bg-[#080b12] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="0">
                    No delay
                  </option>
                  <option value="500">
                    0.5 second
                  </option>
                  <option value="1000">
                    1 second
                  </option>
                  <option value="2000">
                    2 seconds
                  </option>
                  <option value="5000">
                    5 seconds
                  </option>
                  <option value="10000">
                    10 seconds
                  </option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
              <button
                type="button"
                onClick={() =>
                  setShowCompose(false)
                }
                className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  composeLoading ||
                  activeSenders.length ===
                    0
                }
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {composeLoading
                  ? "Scheduling..."
                  : "Schedule Emails"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showSenderModal && (
        <Modal
          title="Add Email Sender"
          onClose={() =>
            setShowSenderModal(
              false
            )
          }
        >
          <form
            onSubmit={
              handleCreateSender
            }
            className="space-y-4"
          >
            {senderError && (
              <Alert
                message={senderError}
              />
            )}

            <Field
              label="Sender Name"
              value={senderName}
              onChange={
                setSenderName
              }
              placeholder="ReachInbox Sender"
            />

            <Field
              label="Sender Email"
              value={senderEmail}
              onChange={
                setSenderEmail
              }
              placeholder="sender@example.com"
              type="email"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="SMTP Host"
                value={senderHost}
                onChange={
                  setSenderHost
                }
                placeholder="smtp.ethereal.email"
              />

              <Field
                label="SMTP Port"
                value={senderPort}
                onChange={
                  setSenderPort
                }
                placeholder="587"
                type="number"
              />
            </div>

            <div>
              <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={
                    senderSecure
                  }
                  onChange={(event) =>
                    setSenderSecure(
                      event.target
                        .checked
                    )
                  }
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800"
                />
                Use secure SMTP connection
              </label>
            </div>

            <Field
              label="SMTP Username"
              value={
                senderUsername
              }
              onChange={
                setSenderUsername
              }
              placeholder="SMTP username"
            />

            <Field
              label="SMTP Password"
              value={
                senderPassword
              }
              onChange={
                setSenderPassword
              }
              placeholder="SMTP password"
              type="password"
            />

            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs leading-5 text-blue-300">
              SMTP credentials are used by the
              backend worker to send email.
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
              <button
                type="button"
                onClick={() =>
                  setShowSenderModal(
                    false
                  )
                }
                className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  senderLoading
                }
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {senderLoading
                  ? "Adding..."
                  : "Add Sender"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showSenderManager && (
        <Modal
          title="Sender Management"
          onClose={() =>
            setShowSenderManager(
              false
            )
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Manage the SMTP senders used by
                your campaigns.
              </p>

              <button
                onClick={() => {
                  setShowSenderManager(
                    false
                  );
                  setShowSenderModal(
                    true
                  );
                }}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                + Add
              </button>
            </div>

            {senders.length === 0 ? (
              <EmptyState
                title="No senders"
                description="Add an SMTP sender to start scheduling emails."
                action={
                  <button
                    onClick={() => {
                      setShowSenderManager(
                        false
                      );
                      setShowSenderModal(
                        true
                      );
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
                  >
                    Add Sender
                  </button>
                }
              />
            ) : (
              <div className="space-y-3">
                {senders.map(
                  (sender) => (
                    <div
                      key={
                        sender.id
                      }
                      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#080b12] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-200">
                            {sender.name}
                          </p>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              sender.isActive
                                ? "bg-green-500/10 text-green-400"
                                : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            {sender.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {sender.email}
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          {sender.host}:
                          {sender.port}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          handleToggleSender(
                            sender
                          )
                        }
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          sender.isActive
                            ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
                            : "border-green-500/30 text-green-300 hover:bg-green-500/10"
                        }`}
                      >
                        {sender.isActive
                          ? "Disable"
                          : "Enable"}
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function LoginScreen() {
  function handleGoogleLogin() {
    window.location.href =
      "/api/auth/google";
  }

  return (
    <div className="min-h-screen bg-[#080b12] px-5 text-slate-100">
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d111a] p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold shadow-lg shadow-blue-900/30">
              R
            </div>

            <h1 className="text-2xl font-semibold">
              Welcome to ReachInbox
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Sign in to manage your email
              scheduling dashboard.
            </p>
          </div>

          <button
            onClick={
              handleGoogleLogin
            }
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-white px-5 py-3 font-medium text-slate-900 transition hover:bg-slate-100"
          >
            <span className="text-lg font-bold">
              G
            </span>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-xs leading-5 text-slate-600">
            Secure Google OAuth authentication
            is required to access the dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0d111a] p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-2xl font-semibold text-slate-100">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: Email["status"];
}) {
  const styles: Record<
    Email["status"],
    string
  > = {
    SCHEDULED:
      "bg-blue-500/10 text-blue-400",
    PROCESSING:
      "bg-yellow-500/10 text-yellow-400",
    SENT:
      "bg-green-500/10 text-green-400",
    FAILED:
      "bg-red-500/10 text-red-400",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function SlackCard({
  slack,
  loading,
  onConnect,
  onDisconnect,
}: {
  slack: SlackStatus;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0d111a] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Notifications
          </p>

          <h3 className="mt-2 font-semibold">
            Slack
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Receive notifications when the email
            rate limit is reached.
          </p>
        </div>

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            slack.connected
              ? "bg-green-500/10 text-green-400"
              : "bg-slate-800 text-slate-500"
          }`}
        >
          #
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-[#080b12] p-4">
        {slack.connected ? (
          <>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-sm font-medium text-green-400">
                Connected
              </span>
            </div>

            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <p>
                Workspace:{" "}
                <span className="text-slate-300">
                  {slack.team ||
                    "Connected workspace"}
                </span>
              </p>

              {slack.channelId && (
                <p>
                  Channel ID:{" "}
                  <span className="text-slate-300">
                    {slack.channelId}
                  </span>
                </p>
              )}

              {slack.connectedAt && (
                <p>
                  Connected:{" "}
                  <span className="text-slate-300">
                    {formatDate(
                      slack.connectedAt
                    )}
                  </span>
                </p>
              )}
            </div>

            <button
              onClick={
                onDisconnect
              }
              disabled={loading}
              className="mt-4 w-full rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              {loading
                ? "Disconnecting..."
                : "Disconnect Slack"}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-600" />
              <span className="text-sm text-slate-400">
                Not connected
              </span>
            </div>

            <button
              onClick={onConnect}
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-[#4a154b] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#611f69] disabled:opacity-50"
            >
              {loading
                ? "Connecting..."
                : "Connect Slack"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function SenderCard({
  senders,
  onManage,
  onAdd,
}: {
  senders: Sender[];
  onManage: () => void;
  onAdd: () => void;
}) {
  const activeCount =
    senders.filter(
      (sender) => sender.isActive
    ).length;

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0d111a] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Email Infrastructure
          </p>

          <h3 className="mt-2 font-semibold">
            Senders
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            {activeCount} active sender
            {activeCount === 1
              ? ""
              : "s"}
          </p>
        </div>

        <button
          onClick={onAdd}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
        >
          + Add
        </button>
      </div>

      {senders.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-800 p-4 text-center">
          <p className="text-sm text-slate-500">
            No senders configured.
          </p>

          <button
            onClick={onAdd}
            className="mt-3 text-xs font-medium text-blue-400 hover:text-blue-300"
          >
            Add your first sender
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {senders
              .slice(0, 3)
              .map((sender) => (
                <div
                  key={sender.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#080b12] px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-300">
                      {sender.name}
                    </p>
                    <p className="truncate text-xs text-slate-600">
                      {sender.email}
                    </p>
                  </div>

                  <span
                    className={`ml-3 h-2 w-2 shrink-0 rounded-full ${
                      sender.isActive
                        ? "bg-green-400"
                        : "bg-slate-600"
                    }`}
                  />
                </div>
              ))}
          </div>

          {senders.length > 3 && (
            <p className="mt-3 text-xs text-slate-600">
              +{senders.length - 3} more
              sender(s)
            </p>
          )}

          <button
            onClick={onManage}
            className="mt-4 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Manage Senders
          </button>
        </>
      )}
    </section>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0d111a] p-5">
      <h3 className="font-medium text-slate-200">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-500">
        —
      </div>

      <h3 className="font-medium text-slate-300">
        {title}
      </h3>

      <p className="mt-2 max-w-sm text-sm text-slate-600">
        {description}
      </p>

      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  );
}

function Alert({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
      {message}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700 bg-[#080b12] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500"
      />
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-[#0d111a] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-[#0d111a] px-6 py-4">
          <h2 className="font-semibold">
            {title}
          </h2>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-slate-500 hover:bg-slate-800 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export default App;