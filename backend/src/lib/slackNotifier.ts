import prisma from "./prisma";

export async function sendSlackRateLimitNotification(
  userId: string,
  senderId: string,
  retryAfterMs: number
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        slackAccessToken: true,
        slackChannelId: true,
        slackWebhookUrl: true,
        slackTeamName: true,
      },
    });

    if (!user) {
      console.warn(
        `Slack notification skipped: user ${userId} not found`
      );
      return;
    }

    if (!user.slackAccessToken && !user.slackWebhookUrl) {
      console.log(
        `Slack notification skipped: Slack is not connected for user ${userId}`
      );
      return;
    }

    const retryMinutes = Math.ceil(retryAfterMs / 60000);

    const message =
      `⚠️ ReachInbox email rate limit reached.\n` +
      `Sender: ${senderId}\n` +
      `Emails will be automatically rescheduled.\n` +
      `Retry window: approximately ${retryMinutes} minutes.`;

    /*
     * Prefer Slack OAuth access token.
     */
    if (user.slackAccessToken && user.slackChannelId) {
      const response = await fetch(
        "https://slack.com/api/chat.postMessage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.slackAccessToken}`,
          },
          body: JSON.stringify({
            channel: user.slackChannelId,
            text: message,
          }),
        }
      );

      const data = await response.json();

      /*
       * Log the actual Slack API response.
       * This helps verify whether Slack accepted
       * the notification or rejected it.
       */
      console.log("Slack API response:", {
        status: response.status,
        ok: data.ok,
        error: data.error,
        channel: user.slackChannelId,
        team: user.slackTeamName,
      });

      if (!response.ok || !data.ok) {
        throw new Error(
          `Slack chat.postMessage failed: ${
            data.error || `HTTP ${response.status}`
          }`
        );
      }

      console.log(
        `Slack rate-limit notification sent to ${
          user.slackTeamName || "Slack"
        }`
      );

      return;
    }

    /*
     * Fallback to incoming webhook.
     */
    if (user.slackWebhookUrl) {
      const response = await fetch(user.slackWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: message,
        }),
      });

      const responseText = await response.text();

      console.log("Slack webhook response:", {
        status: response.status,
        ok: response.ok,
        response: responseText,
      });

      if (!response.ok) {
        throw new Error(
          `Slack webhook failed with status ${response.status}`
        );
      }

      console.log(
        "Slack rate-limit notification sent through webhook"
      );
    }
  } catch (error) {
    /*
     * Slack failure must never crash the email worker.
     * The email job should continue its normal processing.
     */
    console.error(
      "Slack rate-limit notification failed:",
      error
    );
  }
}