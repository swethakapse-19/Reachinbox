import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://reachinbox-backend-tmec.onrender.com/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

export interface User {
  id: string;
  googleId?: string | null;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Sender {
  id: string;
  userId: string;
  name: string;
  email: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Email {
  id: string;
  userId: string;
  senderId?: string | null;
  to: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status:
    | "SCHEDULED"
    | "PROCESSING"
    | "SENT"
    | "FAILED";
  sentAt?: string | null;
  failedAt?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt?: string;
  bullJobId?: string | null;
}

export interface BulkScheduleRequest {
  userId: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: string;
  delayBetweenEmailsMs?: number;
  senderId?: string;
}

export interface CreateSenderRequest {
  userId: string;
  name: string;
  email: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export interface SlackStatus {
  connected: boolean;
  team: string | null;
  channelId: string | null;
  connectedAt: string | null;
}

export async function getCurrentUser(): Promise<User> {
  const response = await api.get("/auth/me");

  return response.data.user;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}

export async function getEmails(
  userId: string
): Promise<Email[]> {
  const response = await api.get("/emails", {
    params: {
      userId,
    },
  });

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.data.emails)) {
    return response.data.emails;
  }

  if (Array.isArray(response.data.data)) {
    return response.data.data;
  }

  return [];
}

export async function searchEmails(
  userId: string,
  query: string
): Promise<Email[]> {
  const response = await api.get("/emails/search", {
    params: {
      userId,
      q: query,
    },
  });

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.data.emails)) {
    return response.data.emails;
  }

  if (Array.isArray(response.data.data)) {
    return response.data.data;
  }

  return [];
}

export async function getSenders(
  userId: string
): Promise<Sender[]> {
  const response = await api.get("/senders", {
    params: {
      userId,
    },
  });

  if (Array.isArray(response.data.senders)) {
    return response.data.senders;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return [];
}

export async function createSender(
  data: CreateSenderRequest
): Promise<Sender> {
  const response = await api.post(
    "/senders",
    data
  );

  return response.data.sender;
}

export async function toggleSender(
  senderId: string,
  isActive: boolean
): Promise<Sender> {
  const response = await api.patch(
    `/senders/${senderId}`,
    {
      isActive,
    }
  );

  return response.data.sender;
}

export async function scheduleBulkEmails(
  data: BulkScheduleRequest
): Promise<Email[]> {
  const response = await api.post(
    "/emails/schedule-bulk",
    data
  );

  if (Array.isArray(response.data.emails)) {
    return response.data.emails;
  }

  if (Array.isArray(response.data.data)) {
    return response.data.data;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return [];
}

export async function getSlackStatus(
  userId: string
): Promise<SlackStatus> {
  const response = await api.get(
    "/slack/status",
    {
      params: {
        userId,
      },
    }
  );

  return {
    connected: Boolean(
      response.data.connected
    ),
    team:
      response.data.team || null,
    channelId:
      response.data.channelId || null,
    connectedAt:
      response.data.connectedAt || null,
  };
}

export async function disconnectSlack(
  userId: string
): Promise<void> {
  await api.post(
    "/slack/disconnect",
    {
      userId,
    }
  );
}

export default api;

