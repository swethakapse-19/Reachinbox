import { Router } from "express";
import prisma from "../lib/prisma";
import { emailQueue } from "../lib/emailQueue";
import { searchEmails, indexEmail } from "../lib/emailSearch";

const router = Router();

/*
 * Schedule a single email
 */
router.post("/schedule", async (req, res) => {
  try {
    const {
      userId,
      to,
      subject,
      body,
      scheduledAt,
      senderId,
    } = req.body;

    if (
      !userId ||
      !to ||
      !subject ||
      !body ||
      !scheduledAt
    ) {
      return res.status(400).json({
        success: false,
        message:
          "userId, to, subject, body and scheduledAt are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const scheduledDate = new Date(scheduledAt);

    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid scheduledAt date",
      });
    }

    if (scheduledDate.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: "scheduledAt must be a future date",
      });
    }

    /*
     * Validate sender if provided.
     */
    if (senderId) {
      const sender = await prisma.sender.findFirst({
        where: {
          id: senderId,
          userId,
        },
      });

      if (!sender) {
        return res.status(404).json({
          success: false,
          message: "Sender not found",
        });
      }
    }

    /*
     * Create email in PostgreSQL.
     */
    const email = await prisma.email.create({
      data: {
        userId,
        senderId: senderId || null,
        to,
        subject,
        body,
        scheduledAt: scheduledDate,
        status: "SCHEDULED",
      },
    });

    /*
     * Calculate BullMQ delay.
     */
    const delay = Math.max(
      scheduledDate.getTime() - Date.now(),
      0
    );

    /*
     * Add email to BullMQ.
     */
    const job = await emailQueue.add(
      "send-email",
      {
        emailId: email.id,
      },
      {
        delay,
        jobId: email.id,
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    /*
     * Store BullMQ job ID.
     */
    const updatedEmail = await prisma.email.update({
      where: {
        id: email.id,
      },
      data: {
        bullJobId: job.id,
      },
    });

    /*
     * Index scheduled email in Elasticsearch.
     */
    try {
      await indexEmail({
        emailId: updatedEmail.id,
        userId: updatedEmail.userId,
        senderId: updatedEmail.senderId,
        to: updatedEmail.to,
        subject: updatedEmail.subject,
        body: updatedEmail.body,
        scheduledAt: updatedEmail.scheduledAt,
        sentAt: updatedEmail.sentAt,
        status: updatedEmail.status,
        createdAt: updatedEmail.createdAt,
      });

      console.log(
        `Scheduled email indexed in Elasticsearch: ${updatedEmail.id}`
      );
    } catch (elasticsearchError) {
      console.error(
        `Elasticsearch indexing failed for ${updatedEmail.id}:`,
        elasticsearchError
      );
    }

    return res.status(201).json({
      success: true,
      message: "Email scheduled successfully",
      email: updatedEmail,
    });
  } catch (error) {
    console.error(
      "Schedule email error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to schedule email",
    });
  }
});

/*
 * Schedule multiple emails
 */
router.post("/schedule-bulk", async (req, res) => {
  try {
    const {
      userId,
      recipients,
      subject,
      body,
      scheduledAt,
      delayBetweenEmailsMs = 1000,
      senderId,
    } = req.body;

    if (
      !userId ||
      !Array.isArray(recipients) ||
      recipients.length === 0 ||
      !subject ||
      !body ||
      !scheduledAt
    ) {
      return res.status(400).json({
        success: false,
        message:
          "userId, recipients, subject, body and scheduledAt are required",
      });
    }

    if (recipients.length > 10000) {
      return res.status(400).json({
        success: false,
        message:
          "Maximum 10000 recipients allowed per request",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /*
     * Validate sender if provided.
     */
    if (senderId) {
      const sender = await prisma.sender.findFirst({
        where: {
          id: senderId,
          userId,
        },
      });

      if (!sender) {
        return res.status(404).json({
          success: false,
          message: "Sender not found",
        });
      }
    }

    const scheduledDate = new Date(scheduledAt);

    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid scheduledAt date",
      });
    }

    if (scheduledDate.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: "scheduledAt must be a future date",
      });
    }

    /*
     * Clean and deduplicate recipients.
     */
    const cleanRecipients = [
      ...new Set(
        recipients
          .map((email: unknown) =>
            String(email)
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      ),
    ];

    if (cleanRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid recipients found",
      });
    }

    const baseTime = scheduledDate.getTime();

    /*
     * Create all emails in PostgreSQL.
     */
    const emails = await prisma.$transaction(
      cleanRecipients.map(
        (recipient, index) =>
          prisma.email.create({
            data: {
              userId,
              senderId: senderId || null,
              to: recipient,
              subject,
              body,
              scheduledAt: new Date(
                baseTime +
                  index *
                    Number(delayBetweenEmailsMs)
              ),
              status: "SCHEDULED",
            },
          })
      )
    );

    /*
     * Create BullMQ jobs.
     */
    const jobs = emails.map((email) => ({
      name: "send-email",
      data: {
        emailId: email.id,
      },
      opts: {
        delay: Math.max(
          email.scheduledAt.getTime() -
            Date.now(),
          0
        ),
        jobId: email.id,
        removeOnComplete: false,
        removeOnFail: false,
      },
    }));

    await emailQueue.addBulk(jobs);

    /*
     * Store BullMQ job IDs.
     */
    await prisma.$transaction(
      emails.map((email) =>
        prisma.email.update({
          where: {
            id: email.id,
          },
          data: {
            bullJobId: email.id,
          },
        })
      )
    );

    /*
     * Index all scheduled emails in Elasticsearch.
     */
    for (const email of emails) {
      try {
        await indexEmail({
          emailId: email.id,
          userId: email.userId,
          senderId: email.senderId,
          to: email.to,
          subject: email.subject,
          body: email.body,
          scheduledAt: email.scheduledAt,
          sentAt: email.sentAt,
          status: email.status,
          createdAt: email.createdAt,
        });
      } catch (elasticsearchError) {
        console.error(
          `Elasticsearch indexing failed for ${email.id}:`,
          elasticsearchError
        );
      }
    }

    console.log(
      `${emails.length} scheduled emails indexed in Elasticsearch`
    );

    return res.status(201).json({
      success: true,
      message: `${emails.length} emails scheduled successfully`,
      count: emails.length,
      delayBetweenEmailsMs,
      scheduledAt: scheduledDate,
    });
  } catch (error) {
    console.error(
      "Bulk schedule error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to schedule bulk emails",
    });
  }
});

/*
 * Get all emails for a user
 */
router.get("/", async (req, res) => {
  try {
    const userId = String(
      req.query.userId || ""
    );

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const emails = await prisma.email.findMany({
      where: {
        userId,
      },
      orderBy: {
        scheduledAt: "desc",
      },
    });

    return res.json({
      success: true,
      emails,
    });
  } catch (error) {
    console.error(
      "Get emails error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch emails",
    });
  }
});

/*
 * Search emails using Elasticsearch
 *
 * Example:
 * /api/emails/search?userId=USER_ID&q=Ethereal
 */
router.get("/search", async (req, res) => {
  try {
    const userId = String(
      req.query.userId || ""
    );

    const query = String(
      req.query.q || ""
    ).trim();

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "q search query is required",
      });
    }

    const emails = await searchEmails(
      userId,
      query
    );

    return res.json({
      success: true,
      count: emails.length,
      emails,
    });
  } catch (error) {
    console.error(
      "Email search error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to search emails",
    });
  }
});

export default router;