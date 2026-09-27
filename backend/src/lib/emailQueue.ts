import { Queue } from "bullmq";
import redis from "./redis";

export const emailQueue = new Queue("emailQueue", {
  connection: redis,
});

emailQueue.on("error", (error) => {
  console.error("Email queue error:", error);
});