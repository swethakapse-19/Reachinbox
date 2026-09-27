import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import prisma from "./lib/prisma";
import "./lib/emailQueue";
import userRoutes from "./routes/userRoutes";
import emailRoutes from "./routes/emailRoutes";
import senderRoutes from "./routes/senderRoutes";
import slackRoutes from "./routes/slackRoutes";
import authRoutes from "./routes/authRoutes";
import { ensureEmailIndex } from "./lib/elasticsearch";
import "./workers/emailWorker";

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "./lib/emailQueue";

const app = express();

/*
 * CORS
 *
 * Frontend:
 * https://reachinbox-jade.vercel.app
 *
 * Backend:
 * https://reachinbox-backend-tmec.onrender.com
 */
app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "https://reachinbox-jade.vercel.app",
    credentials: true,
  })
);

app.use(express.json());

/*
 * BullMQ Dashboard
 */
const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath(
  "/admin/queues"
);

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
  ],
  serverAdapter,
});

app.use(
  "/admin/queues",
  serverAdapter.getRouter()
);

/*
 * API Routes
 */
app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/emails",
  emailRoutes
);

app.use(
  "/api/senders",
  senderRoutes
);

app.use(
  "/api/slack",
  slackRoutes
);

/*
 * Health Check
 */
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message:
      "ReachInbox backend is running",
  });
});

/*
 * Database Test
 */
app.get(
  "/db-test",
  async (_req, res) => {
    try {
      const users =
        await prisma.user.findMany();

      res.json({
        success: true,
        users,
      });
    } catch (error) {
      console.error(
        "Database error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Database connection failed",
      });
    }
  }
);

/*
 * Start Server
 */
const PORT =
  Number(process.env.PORT) || 5000;

app.listen(PORT, async () => {
  console.log(
    `Server running on port ${PORT}`
  );

  try {
    await ensureEmailIndex();

    console.log(
      "Elasticsearch ready"
    );
  } catch (error) {
    console.error(
      "Elasticsearch initialization failed:",
      error
    );
  }
});