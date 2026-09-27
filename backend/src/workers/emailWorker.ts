import { Worker } from "bullmq";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import nodemailer from "nodemailer";

const emailWorker = new Worker(
  "emailQueue",

  async (job) => {
    const { emailId } = job.data;

    console.log(`Processing email job: ${job.id}`);

    const email = await prisma.email.findUnique({
      where: {
        id: emailId,
      },
    });

    if (!email) {
      throw new Error(
        `Email not found: ${emailId}`
      );
    }

    // Prevent duplicate sending
    if (email.status === "SENT") {
      console.log(
        `Email already sent. Skipping: ${emailId}`
      );

      return {
        success: true,
        alreadySent: true,
      };
    }

    await prisma.email.update({
      where: {
        id: emailId,
      },

      data: {
        status: "PROCESSING",
      },
    });

    try {
      const host =
        process.env.ETHEREAL_HOST ||
        "smtp.ethereal.email";

      const port =
        Number(process.env.ETHEREAL_PORT) || 587;

      const user = process.env.ETHEREAL_USER;
      const pass = process.env.ETHEREAL_PASS;

      if (!user || !pass) {
        throw new Error(
          "Ethereal credentials are not configured"
        );
      }

      const transporter =
        nodemailer.createTransport({
          host,
          port,
          secure: port === 465,

          auth: {
            user,
            pass,
          },
        });

      const info =
        await transporter.sendMail({
          from:
            '"ReachInbox" <no-reply@reachinbox.local>',

          to: email.to,

          subject: email.subject,

          text: email.body,
        });

      const previewUrl =
        nodemailer.getTestMessageUrl(info);

      await prisma.email.update({
        where: {
          id: emailId,
        },

        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });

      console.log(
        `Email sent successfully: ${emailId}`
      );

      if (previewUrl) {
        console.log(
          `Ethereal preview: ${previewUrl}`
        );
      }

      return {
        success: true,
        previewUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown email error";

      await prisma.email.update({
        where: {
          id: emailId,
        },

        data: {
          status: "FAILED",
          failedAt: new Date(),
          error: errorMessage,
        },
      });

      console.error(
        `Email failed: ${emailId}`,
        error
      );

      throw error;
    }
  },

  {
    connection: redis,
  }
);

emailWorker.on(
  "completed",
  (job) => {
    console.log(
      `Job completed: ${job.id}`
    );
  }
);

emailWorker.on(
  "failed",
  (job, error) => {
    console.error(
      `Job failed: ${job?.id}`,
      error.message
    );
  }
);

console.log(
  "Email worker started"
);