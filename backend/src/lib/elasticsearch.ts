import dotenv from "dotenv";
import { Client } from "@elastic/elasticsearch";

dotenv.config();

const elasticsearchUrl =
  process.env.ELASTICSEARCH_URL || "http://localhost:9200";

export const elasticsearch = new Client({
  node: elasticsearchUrl,
});

export const EMAIL_INDEX = "emails";

export async function ensureEmailIndex() {
  const exists = await elasticsearch.indices.exists({
    index: EMAIL_INDEX,
  });

  if (!exists) {
    await elasticsearch.indices.create({
      index: EMAIL_INDEX,
      mappings: {
        properties: {
          emailId: { type: "keyword" },
          userId: { type: "keyword" },
          senderId: { type: "keyword" },
          to: { type: "keyword" },
          subject: { type: "text" },
          body: { type: "text" },
          scheduledAt: { type: "date" },
          sentAt: { type: "date" },
          status: { type: "keyword" },
          createdAt: { type: "date" },
        },
      },
    });

    console.log(`Elasticsearch index "${EMAIL_INDEX}" created`);
  }
}