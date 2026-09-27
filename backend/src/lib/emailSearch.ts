import {
  elasticsearch,
  EMAIL_INDEX,
} from "./elasticsearch";

export interface SearchableEmail {
  emailId: string;
  userId: string;
  senderId?: string | null;
  to: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  status: string;
  createdAt: Date;
}

export async function indexEmail(
  email: SearchableEmail
) {
  await elasticsearch.index({
    index: EMAIL_INDEX,
    id: email.emailId,
    document: {
      emailId: email.emailId,
      userId: email.userId,
      senderId: email.senderId ?? null,
      to: email.to,
      subject: email.subject,
      body: email.body,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt ?? null,
      status: email.status,
      createdAt: email.createdAt,
    },
  });
}

export async function updateEmailIndex(
  email: SearchableEmail
) {
  await elasticsearch.index({
    index: EMAIL_INDEX,
    id: email.emailId,
    document: {
      emailId: email.emailId,
      userId: email.userId,
      senderId: email.senderId ?? null,
      to: email.to,
      subject: email.subject,
      body: email.body,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt ?? null,
      status: email.status,
      createdAt: email.createdAt,
    },
  });
}

export async function searchEmails(
  userId: string,
  query: string
) {
  const response = await elasticsearch.search({
    index: EMAIL_INDEX,
    query: {
      bool: {
        must: [
          {
            term: {
              userId,
            },
          },
          {
            multi_match: {
              query,
              fields: [
                "to",
                "subject",
                "body",
              ],
            },
          },
        ],
      },
    },
    sort: [
      {
        scheduledAt: {
          order: "desc",
        },
      },
    ],
  });

  return response.hits.hits.map((hit) => hit._source);
}