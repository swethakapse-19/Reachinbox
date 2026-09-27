import { useEffect, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "https://reachinbox-backend-tmec.onrender.com/api";

type Email = {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt?: string;
  sentAt?: string;
};

type Sender = {
  id: string;
  email: string;
  name?: string;
  dailyLimit?: number;
  isActive?: boolean;
};

function App() {
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">(
    "scheduled"
  );

  const [emails, setEmails] = useState<Email[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);

  const [showSchedule, setShowSchedule] = useState(false);
  const [showSender, setShowSender] = useState(false);

  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [dailyLimit, setDailyLimit] = useState("100");

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const USER_ID = "demo-user";

  // -----------------------------
  // LOAD DASHBOARD DATA
  // -----------------------------

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const emailResponse = await fetch(
        `${API_BASE}/emails?userId=${USER_ID}`
      );

      if (emailResponse.ok) {
        const emailData = await emailResponse.json();

        const list =
          emailData?.emails ||
          emailData?.data ||
          emailData ||
          [];

        if (Array.isArray(list)) {
          setEmails(list);
        }
      }

      const senderResponse = await fetch(
        `${API_BASE}/senders?userId=${USER_ID}`
      );

      if (senderResponse.ok) {
        const senderData = await senderResponse.json();

        const list =
          senderData?.senders ||
          senderData?.data ||
          senderData ||
          [];

        if (Array.isArray(list)) {
          setSenders(list);
        }
      }
    } catch (error) {
      console.error("Dashboard loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // -----------------------------
  // SCHEDULE EMAILS
  // -----------------------------

  const scheduleEmails = async () => {
    try {
      const emailList = recipients
        .split(/[\n,;]/)
        .map((email) => email.trim())
        .filter(Boolean);

      if (emailList.length === 0) {
        setMessage("Enter at least one recipient.");
        return;
      }

      if (!subject.trim()) {
        setMessage("Enter an email subject.");
        return;
      }

      if (!body.trim()) {
        setMessage("Enter the email body.");
        return;
      }

      if (!scheduledAt) {
        setMessage("Select a schedule date and time.");
        return;
      }

      setLoading(true);

      const response = await fetch(
        `${API_BASE}/emails/schedule-bulk`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            userId: USER_ID,
            recipients: emailList,
            subject,
            body,
            scheduledAt: new Date(scheduledAt).toISOString(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Unable to schedule emails"
        );
      }

      setMessage(
        `${emailList.length} email(s) scheduled successfully.`
      );

      setRecipients("");
      setSubject("");
      setBody("");
      setScheduledAt("");

      setShowSchedule(false);

      await loadDashboard();
    } catch (error: any) {
      console.error(error);

      setMessage(
        error?.message ||
          "Unable to schedule emails."
      );
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // CREATE SENDER
  // -----------------------------

  const addSender = async () => {
    try {
      if (!senderEmail.trim()) {
        setMessage("Enter sender email.");
        return;
      }

      setLoading(true);

      const response = await fetch(
        `${API_BASE}/senders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            userId: USER_ID,
            email: senderEmail,
            name: senderName,
            dailyLimit: Number(dailyLimit) || 100,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Unable to add sender"
        );
      }

      setMessage("Sender added successfully.");

      setSenderEmail("");
      setSenderName("");
      setDailyLimit("100");

      setShowSender(false);

      await loadDashboard();
    } catch (error: any) {
      console.error(error);

      setMessage(
        error?.message ||
          "Unable to add sender."
      );
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // FILTER EMAILS
  // -----------------------------

  const visibleEmails = emails.filter((email) => {
    const matchesTab =
      activeTab === "scheduled"
        ? email.status === "SCHEDULED" ||
          email.status === "PROCESSING"
        : email.status === "SENT" ||
          email.status === "FAILED";

    const query = search.toLowerCase();

    const matchesSearch =
      !query ||
      email.to?.toLowerCase().includes(query) ||
      email.subject?.toLowerCase().includes(query);

    return matchesTab && matchesSearch;
  });

  const scheduledCount = emails.filter(
    (email) => email.status === "SCHEDULED"
  ).length;

  const processingCount = emails.filter(
    (email) => email.status === "PROCESSING"
  ).length;

  const sentCount = emails.filter(
    (email) => email.status === "SENT"
  ).length;

  const failedCount = emails.filter(
    (email) => email.status === "FAILED"
  ).length;

  // -----------------------------
  // DATE FORMAT
  // -----------------------------

  const formatDate = (date?: string) => {
    if (!date) return "-";

    try {
      return new Date(date).toLocaleString();
    } catch {
      return "-";
    }
  };

  // -----------------------------
  // UI
  // -----------------------------

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        fontFamily:
          "Inter, Arial, Helvetica, sans-serif",
        color: "#111827",
      }}
    >
      {/* TOP NAVBAR */}

      <header
        style={{
          height: "70px",
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
            }}
          >
            ReachInbox
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "#6b7280",
              marginTop: "2px",
            }}
          >
            Email Scheduling Dashboard
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          <button
            onClick={loadDashboard}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              background: "#ffffff",
              cursor: "pointer",
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            onClick={() => setShowSchedule(true)}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              background: "#111827",
              color: "#ffffff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            + Schedule Email
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}

      <main
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "32px",
        }}
      >
        {/* MESSAGE */}

        {message && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "14px 18px",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{message}</span>

            <button
              onClick={() => setMessage("")}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* STAT CARDS */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
            marginBottom: "28px",
          }}
        >
          <StatCard
            title="Total Emails"
            value={emails.length}
          />

          <StatCard
            title="Scheduled"
            value={scheduledCount}
          />

          <StatCard
            title="Processing"
            value={processingCount}
          />

          <StatCard
            title="Sent"
            value={sentCount}
          />

          <StatCard
            title="Failed"
            value={failedCount}
          />
        </div>

        {/* EMAIL SECTION */}

        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {/* SECTION HEADER */}

          <div
            style={{
              padding: "22px 24px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                }}
              >
                Email Campaigns
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "#6b7280",
                  fontSize: "13px",
                }}
              >
                View and manage scheduled and sent emails.
              </p>
            </div>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search emails..."
              style={{
                width: "260px",
                maxWidth: "100%",
                padding: "10px 13px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                outline: "none",
              }}
            />
          </div>

          {/* TABS */}

          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              gap: "8px",
            }}
          >
            <button
              onClick={() => setActiveTab("scheduled")}
              style={{
                padding: "9px 18px",
                borderRadius: "7px",
                border: "none",
                background:
                  activeTab === "scheduled"
                    ? "#111827"
                    : "#f3f4f6",
                color:
                  activeTab === "scheduled"
                    ? "#ffffff"
                    : "#374151",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Scheduled
            </button>

            <button
              onClick={() => setActiveTab("sent")}
              style={{
                padding: "9px 18px",
                borderRadius: "7px",
                border: "none",
                background:
                  activeTab === "sent"
                    ? "#111827"
                    : "#f3f4f6",
                color:
                  activeTab === "sent"
                    ? "#ffffff"
                    : "#374151",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Sent
            </button>
          </div>

          {/* TABLE */}

          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f9fafb",
                  }}
                >
                  <TableHeader>Recipient</TableHeader>
                  <TableHeader>Subject</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Scheduled At</TableHeader>
                  <TableHeader>Sent At</TableHeader>
                </tr>
              </thead>

              <tbody>
                {visibleEmails.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        padding: "70px 20px",
                        color: "#6b7280",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "42px",
                          marginBottom: "12px",
                        }}
                      >
                        📭
                      </div>

                      <div
                        style={{
                          fontWeight: 600,
                          color: "#374151",
                          marginBottom: "5px",
                        }}
                      >
                        No emails found
                      </div>

                      <div
                        style={{
                          fontSize: "13px",
                        }}
                      >
                        Click "Schedule Email" to create your
                        first scheduled email.
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleEmails.map((email) => (
                    <tr key={email.id}>
                      <TableCell>
                        {email.to}
                      </TableCell>

                      <TableCell>
                        {email.subject}
                      </TableCell>

                      <TableCell>
                        <Status status={email.status} />
                      </TableCell>

                      <TableCell>
                        {formatDate(email.scheduledAt)}
                      </TableCell>

                      <TableCell>
                        {formatDate(email.sentAt)}
                      </TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* SENDERS */}

        <section
          style={{
            marginTop: "28px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "18px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                }}
              >
                Email Senders
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                Manage your sending accounts.
              </p>
            </div>

            <button
              onClick={() => setShowSender(true)}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background: "#ffffff",
                cursor: "pointer",
              }}
            >
              + Add Sender
            </button>
          </div>

          {senders.length === 0 ? (
            <div
              style={{
                background: "#f9fafb",
                borderRadius: "8px",
                padding: "25px",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              No senders added yet.
            </div>
          ) : (
            senders.map((sender) => (
              <div
                key={sender.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "15px",
                  marginBottom: "10px",
                }}
              >
                <strong>{sender.email}</strong>

                <div
                  style={{
                    color: "#6b7280",
                    fontSize: "13px",
                    marginTop: "4px",
                  }}
                >
                  {sender.name || "No name"} · Daily limit:{" "}
                  {sender.dailyLimit || 100}
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {/* SCHEDULE MODAL */}

      {showSchedule && (
        <Modal
          title="Schedule Emails"
          close={() => setShowSchedule(false)}
        >
          <label>Recipients</label>

          <textarea
            value={recipients}
            onChange={(event) =>
              setRecipients(event.target.value)
            }
            placeholder="one@example.com&#10;two@example.com"
            rows={5}
            style={inputStyle}
          />

          <label>Subject</label>

          <input
            value={subject}
            onChange={(event) =>
              setSubject(event.target.value)
            }
            placeholder="Email subject"
            style={inputStyle}
          />

          <label>Email Body</label>

          <textarea
            value={body}
            onChange={(event) =>
              setBody(event.target.value)
            }
            placeholder="Write your email..."
            rows={7}
            style={inputStyle}
          />

          <label>Schedule At</label>

          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) =>
              setScheduledAt(event.target.value)
            }
            style={inputStyle}
          />

          <button
            onClick={scheduleEmails}
            disabled={loading}
            style={primaryButton}
          >
            {loading ? "Scheduling..." : "Schedule Emails"}
          </button>
        </Modal>
      )}

      {/* SENDER MODAL */}

      {showSender && (
        <Modal
          title="Add Sender"
          close={() => setShowSender(false)}
        >
          <label>Sender Email</label>

          <input
            value={senderEmail}
            onChange={(event) =>
              setSenderEmail(event.target.value)
            }
            placeholder="sender@example.com"
            style={inputStyle}
          />

          <label>Sender Name</label>

          <input
            value={senderName}
            onChange={(event) =>
              setSenderName(event.target.value)
            }
            placeholder="Sender name"
            style={inputStyle}
          />

          <label>Daily Limit</label>

          <input
            type="number"
            value={dailyLimit}
            onChange={(event) =>
              setDailyLimit(event.target.value)
            }
            style={inputStyle}
          />

          <button
            onClick={addSender}
            disabled={loading}
            style={primaryButton}
          >
            {loading ? "Adding..." : "Add Sender"}
          </button>
        </Modal>
      )}
    </div>
  );
}

// --------------------------------------------------
// SMALL COMPONENTS
// --------------------------------------------------

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "22px",
      }}
    >
      <div
        style={{
          color: "#6b7280",
          fontSize: "13px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "30px",
          fontWeight: 700,
          marginTop: "8px",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th
      style={{
        padding: "14px 18px",
        textAlign: "left",
        fontSize: "12px",
        color: "#6b7280",
        borderBottom: "1px solid #e5e7eb",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <td
      style={{
        padding: "16px 18px",
        borderBottom: "1px solid #f0f0f0",
        fontSize: "14px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function Status({ status }: { status: string }) {
  let background = "#dbeafe";
  let color = "#1d4ed8";

  if (status === "SENT") {
    background = "#dcfce7";
    color = "#15803d";
  }

  if (status === "FAILED") {
    background = "#fee2e2";
    color = "#b91c1c";
  }

  if (status === "PROCESSING") {
    background = "#fef3c7";
    color = "#b45309";
  }

  return (
    <span
      style={{
        background,
        color,
        borderRadius: "999px",
        padding: "5px 10px",
        fontSize: "12px",
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}

function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: "14px",
          padding: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "25px",
          }}
        >
          <h2
            style={{
              margin: 0,
            }}
          >
            {title}
          </h2>

          <button
            onClick={close}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "22px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "14px",
  marginBottom: "8px",
};

const primaryButton: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "none",
  borderRadius: "8px",
  background: "#111827",
  color: "#ffffff",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "12px",
};

export default App;