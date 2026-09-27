import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  getEmails,
  getSenders,
  scheduleBulkEmails,
  createSender,
  toggleSender,
  searchEmails,
} from "./services/api";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "https://reachinbox-backend-tmec.onrender.com/api";

const BACKEND_BASE = API_BASE.replace(/\/api\/?$/, "");

type EmailStatus = "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED";

interface Email {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt?: string;
  failedAt?: string | null;
  error?: string | null;
}

interface Sender {
  id: string;
  email: string;
  name?: string | null;
  dailyLimit?: number;
  isActive?: boolean;
}

const DEMO_USER_ID = "demo-user";

function App() {
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">(
    "scheduled"
  );

  const [emails, setEmails] = useState<Email[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showSenderModal, setShowSenderModal] = useState(false);

  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [scheduledAt, setScheduledAt] = useState("");

  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [dailyLimit, setDailyLimit] = useState("100");

  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<
    "ALL" | EmailStatus
  >("ALL");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [stats, setStats] = useState({
    scheduled: 0,
    sent: 0,
    failed: 0,
    total: 0,
  });

  const refreshData = async () => {
    try {
      setLoading(true);

      const [emailResponse, senderResponse] = await Promise.all([
        getEmails(DEMO_USER_ID),
        getSenders(DEMO_USER_ID),
      ]);

      const emailData =
        Array.isArray(emailResponse)
          ? emailResponse
          : (emailResponse as any)?.emails ||
            (emailResponse as any)?.data ||
            [];

      const senderData =
        Array.isArray(senderResponse)
          ? senderResponse
          : (senderResponse as any)?.senders ||
            (senderResponse as any)?.data ||
            [];

      setEmails(emailData);
      setSenders(senderData);

      calculateStats(emailData);
    } catch (error) {
      console.error("Dashboard data error:", error);

      setMessage(
        "Dashboard is loaded. Backend data could not be fetched yet."
      );

      setEmails([]);
      setSenders([]);

      setStats({
        scheduled: 0,
        sent: 0,
        failed: 0,
        total: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Email[]) => {
    setStats({
      scheduled: data.filter((email) => email.status === "SCHEDULED").length,
      sent: data.filter((email) => email.status === "SENT").length,
      failed: data.filter((email) => email.status === "FAILED").length,
      total: data.length,
    });
  };

  useEffect(() => {
    refreshData();

    const interval = setInterval(() => {
      refreshData();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const filteredEmails = useMemo(() => {
    let result = emails;

    if (activeTab === "scheduled") {
      result = result.filter(
        (email) =>
          email.status === "SCHEDULED" ||
          email.status === "PROCESSING"
      );
    }

    if (activeTab === "sent") {
      result = result.filter(
        (email) =>
          email.status === "SENT" ||
          email.status === "FAILED"
      );
    }

    if (selectedStatus !== "ALL") {
      result = result.filter(
        (email) => email.status === selectedStatus
      );
    }

    if (search.trim()) {
      const query = search.toLowerCase();

      result = result.filter(
        (email) =>
          email.to.toLowerCase().includes(query) ||
          email.subject.toLowerCase().includes(query) ||
          email.body.toLowerCase().includes(query)
      );
    }

    return result;
  }, [emails, activeTab, selectedStatus, search]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const parseRecipients = () => {
    return recipients
      .split(/[\n,;]/)
      .map((email) => email.trim())
      .filter(Boolean)
      .filter(validateEmail);
  };

  const handleSchedule = async () => {
    try {
      const emailList = parseRecipients();

      if (emailList.length === 0) {
        setMessage("Please enter at least one valid email address.");
        return;
      }

      if (!subject.trim()) {
        setMessage("Please enter a subject.");
        return;
      }

      if (!body.trim()) {
        setMessage("Please enter email content.");
        return;
      }

      if (!scheduledAt) {
        setMessage("Please select a scheduled date and time.");
        return;
      }

      setLoading(true);
      setMessage("");

      await scheduleBulkEmails({
        userId: DEMO_USER_ID,
        recipients: emailList,
        subject,
        body,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });

      setMessage(
        `${emailList.length} email(s) scheduled successfully.`
      );

      setRecipients("");
      setSubject("");
      setBody("");
      setScheduledAt("");

      setShowScheduleModal(false);

      await refreshData();
    } catch (error: any) {
      console.error("Schedule error:", error);

      setMessage(
        error?.response?.data?.message ||
          "Unable to schedule emails. Check the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSender = async () => {
    try {
      if (!senderEmail.trim() || !validateEmail(senderEmail)) {
        setMessage("Please enter a valid sender email.");
        return;
      }

      setLoading(true);

      await createSender({
        userId: DEMO_USER_ID,
        email: senderEmail.trim(),
        name: senderName.trim() || undefined,
        dailyLimit: Number(dailyLimit) || 100,
      });

      setMessage("Sender added successfully.");

      setSenderEmail("");
      setSenderName("");
      setDailyLimit("100");

      setShowSenderModal(false);

      await refreshData();
    } catch (error: any) {
      console.error("Create sender error:", error);

      setMessage(
        error?.response?.data?.message ||
          "Unable to create sender."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSender = async (sender: Sender) => {
    try {
      await toggleSender(sender.id, !sender.isActive);

      setMessage(
        `${sender.email} ${
          sender.isActive ? "disabled" : "enabled"
        }.`
      );

      await refreshData();
    } catch (error) {
      console.error(error);
      setMessage("Unable to update sender.");
    }
  };

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];

        const extractedEmails = rows
          .map((row) => {
            return (
              row.email ||
              row.Email ||
              row.EMAIL ||
              row.to ||
              row.To ||
              row.recipient ||
              ""
            );
          })
          .map((email) => email.trim())
          .filter(validateEmail);

        if (extractedEmails.length === 0) {
          setMessage(
            "No valid email addresses were found in the file."
          );
        } else {
          setRecipients((previous) => {
            const existing = previous
              .split(/[\n,;]/)
              .map((x) => x.trim())
              .filter(Boolean);

            return [...existing, ...extractedEmails].join("\n");
          });

          setMessage(
            `${extractedEmails.length} email address(es) imported.`
          );
        }

        setUploading(false);
      },
      error: (error) => {
        console.error(error);
        setMessage("Unable to read the file.");
        setUploading(false);
      },
    });

    event.target.value = "";
  };

  const handleSearch = async () => {
    if (!search.trim()) {
      await refreshData();
      return;
    }

    try {
      setLoading(true);

      const result = await searchEmails(
        DEMO_USER_ID,
        search.trim()
      );

      const data =
        Array.isArray(result)
          ? result
          : (result as any)?.emails ||
            (result as any)?.data ||
            [];

      setEmails(data);
      calculateStats(data);
    } catch (error) {
      console.error(error);
      setMessage("Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";

    return new Date(value).toLocaleString();
  };

  const getStatusClass = (status: EmailStatus) => {
    switch (status) {
      case "SENT":
        return "bg-green-100 text-green-700";

      case "FAILED":
        return "bg-red-100 text-red-700";

      case "PROCESSING":
        return "bg-yellow-100 text-yellow-700";

      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-64 transform bg-white border-r border-slate-200 transition-transform lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          <div>
            <div className="text-xl font-bold text-slate-900">
              ReachInbox
            </div>

            <div className="text-xs text-slate-500">
              Email Scheduler
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          <button
            onClick={() => {
              setActiveTab("scheduled");
              setSidebarOpen(false);
            }}
            className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium ${
              activeTab === "scheduled"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            📅 Scheduled
          </button>

          <button
            onClick={() => {
              setActiveTab("sent");
              setSidebarOpen(false);
            }}
            className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium ${
              activeTab === "sent"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            ✉️ Sent
          </button>

          <button
            onClick={() => {
              setShowSenderModal(true);
              setSidebarOpen(false);
            }}
            className="w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            👤 Senders
          </button>

          <button
            onClick={() => {
              setShowScheduleModal(true);
              setSidebarOpen(false);
            }}
            className="w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            ➕ Schedule Email
          </button>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-4">
          <div className="mb-2 text-xs text-slate-400">
            Backend
          </div>

          <div className="break-all text-xs text-slate-500">
            {BACKEND_BASE}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold">
              {activeTab === "scheduled"
                ? "Scheduled Emails"
                : "Sent Emails"}
            </h1>

            <p className="text-xs text-slate-500">
              Manage your email campaigns
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshData}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>

            <button
              onClick={() => setShowScheduleModal(true)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Schedule
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          {/* Message */}
          {message && (
            <div className="mb-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
              <span>{message}</span>

              <button
                onClick={() => setMessage("")}
                className="ml-4 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
          )}

          {/* Stats */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">
                Total Emails
              </div>

              <div className="mt-2 text-3xl font-bold">
                {stats.total}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">
                Scheduled
              </div>

              <div className="mt-2 text-3xl font-bold text-blue-600">
                {stats.scheduled}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">
                Sent
              </div>

              <div className="mt-2 text-3xl font-bold text-green-600">
                {stats.sent}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">
                Failed
              </div>

              <div className="mt-2 text-3xl font-bold text-red-600">
                {stats.failed}
              </div>
            </div>
          </section>

          {/* Search */}
          <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch();
                  }
                }}
                placeholder="Search recipient, subject or body..."
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500"
              />

              <button
                onClick={handleSearch}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white"
              >
                Search
              </button>
            </div>
          </section>

          {/* Tabs and filters */}
          <section className="mt-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => setActiveTab("scheduled")}
                className={`rounded-md px-5 py-2 text-sm font-medium ${
                  activeTab === "scheduled"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600"
                }`}
              >
                Scheduled
              </button>

              <button
                onClick={() => setActiveTab("sent")}
                className={`rounded-md px-5 py-2 text-sm font-medium ${
                  activeTab === "sent"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600"
                }`}
              >
                Sent
              </button>
            </div>

            <select
              value={selectedStatus}
              onChange={(event) =>
                setSelectedStatus(
                  event.target.value as "ALL" | EmailStatus
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="PROCESSING">Processing</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
            </select>
          </section>

          {/* Email table */}
          <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                      Recipient
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                      Subject
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                      Scheduled
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                      Sent
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredEmails.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-16 text-center"
                      >
                        <div className="text-4xl">📭</div>

                        <div className="mt-3 text-sm font-medium text-slate-700">
                          No emails found
                        </div>

                        <div className="mt-1 text-sm text-slate-400">
                          Schedule an email to see it here.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEmails.map((email) => (
                      <tr
                        key={email.id}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 text-sm font-medium">
                          {email.to}
                        </td>

                        <td className="max-w-xs truncate px-5 py-4 text-sm text-slate-600">
                          {email.subject}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                              email.status
                            )}`}
                          >
                            {email.status}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                          {formatDate(email.scheduledAt)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                          {formatDate(email.sentAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Senders */}
          <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Email Senders
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Manage sender accounts and daily limits.
                </p>
              </div>

              <button
                onClick={() => setShowSenderModal(true)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                + Add Sender
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {senders.length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500">
                  No senders available.
                </div>
              ) : (
                senders.map((sender) => (
                  <div
                    key={sender.id}
                    className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 p-4 md:flex-row md:items-center"
                  >
                    <div>
                      <div className="font-medium">
                        {sender.email}
                      </div>

                      <div className="text-sm text-slate-500">
                        {sender.name || "No name"} · Daily limit:{" "}
                        {sender.dailyLimit ?? 100}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        handleToggleSender(sender)
                      }
                      className={`rounded-lg px-4 py-2 text-sm font-medium ${
                        sender.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {sender.isActive
                        ? "Active"
                        : "Inactive"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <h2 className="text-xl font-semibold">
                  Schedule Emails
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Add recipients and choose when to send.
                </p>
              </div>

              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-xl text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Recipients
                  </label>

                  <button
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {uploading
                      ? "Importing..."
                      : "Import CSV"}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <textarea
                  value={recipients}
                  onChange={(event) =>
                    setRecipients(event.target.value)
                  }
                  placeholder="email1@example.com&#10;email2@example.com"
                  rows={5}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                />

                <p className="mt-1 text-xs text-slate-400">
                  Separate multiple emails using commas, semicolons
                  or new lines.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Subject
                </label>

                <input
                  value={subject}
                  onChange={(event) =>
                    setSubject(event.target.value)
                  }
                  placeholder="Email subject"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Email Body
                </label>

                <textarea
                  value={body}
                  onChange={(event) =>
                    setBody(event.target.value)
                  }
                  placeholder="Write your email..."
                  rows={7}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Schedule At
                </label>

                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) =>
                    setScheduledAt(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  onClick={() =>
                    setShowScheduleModal(false)
                  }
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSchedule}
                  disabled={loading}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loading
                    ? "Scheduling..."
                    : "Schedule Emails"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sender Modal */}
      {showSenderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <h2 className="text-xl font-semibold">
                  Add Sender
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Configure an email sender.
                </p>
              </div>

              <button
                onClick={() => setShowSenderModal(false)}
                className="text-xl text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Email
                </label>

                <input
                  value={senderEmail}
                  onChange={(event) =>
                    setSenderEmail(event.target.value)
                  }
                  placeholder="sender@example.com"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Name
                </label>

                <input
                  value={senderName}
                  onChange={(event) =>
                    setSenderName(event.target.value)
                  }
                  placeholder="Sender name"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Daily Limit
                </label>

                <input
                  type="number"
                  min="1"
                  value={dailyLimit}
                  onChange={(event) =>
                    setDailyLimit(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  onClick={() =>
                    setShowSenderModal(false)
                  }
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm"
                >
                  Cancel
                </button>

                <button
                  onClick={handleCreateSender}
                  disabled={loading}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm text-white disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add Sender"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;