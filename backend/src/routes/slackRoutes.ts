import { Router } from "express";
import crypto from "crypto";
import redis from "../lib/redis";
import prisma from "../lib/prisma";

const router = Router();

const STATE_EXPIRY_SECONDS = 10 * 60;

/**
 * Start Slack OAuth
 */
router.get("/oauth/start", async (req, res) => {
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

    const user =
      await prisma.user.findUnique({
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

    const clientId =
      process.env.SLACK_CLIENT_ID;

    const redirectUri =
      process.env.SLACK_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({
        success: false,
        message:
          "Slack OAuth configuration is missing",
      });
    }

    /*
     * Generate a secure state value.
     * It is stored in Redis temporarily so the
     * OAuth callback can identify the user.
     */
    const state =
      crypto.randomBytes(32).toString("hex");

    await redis.set(
      `slack-oauth-state:${state}`,
      userId,
      "EX",
      STATE_EXPIRY_SECONDS
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope:
        "chat:write,incoming-webhook",
    });

    const slackAuthUrl =
      `https://slack.com/oauth/v2/authorize?${params.toString()}`;

    return res.redirect(
      slackAuthUrl
    );
  } catch (error) {
    console.error(
      "Slack OAuth start error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to start Slack OAuth",
    });
  }
});

/**
 * Slack OAuth callback
 */
router.get(
  "/oauth/callback",
  async (req, res) => {
    try {
      const code = String(
        req.query.code || ""
      );

      const state = String(
        req.query.state || ""
      );

      if (!code || !state) {
        return res.status(400).json({
          success: false,
          message:
            "Missing Slack OAuth code or state",
        });
      }

      /*
       * Retrieve the user associated with
       * this OAuth request.
       */
      const userId =
        await redis.get(
          `slack-oauth-state:${state}`
        );

      if (!userId) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid or expired Slack OAuth state",
        });
      }

      /*
       * State should only be usable once.
       */
      await redis.del(
        `slack-oauth-state:${state}`
      );

      const clientId =
        process.env.SLACK_CLIENT_ID;

      const clientSecret =
        process.env.SLACK_CLIENT_SECRET;

      const redirectUri =
        process.env.SLACK_REDIRECT_URI;

      if (
        !clientId ||
        !clientSecret ||
        !redirectUri
      ) {
        return res.status(500).json({
          success: false,
          message:
            "Slack OAuth configuration is missing",
        });
      }

      /*
       * Exchange the OAuth authorization code
       * for Slack access credentials.
       */
      const response = await fetch(
        "https://slack.com/api/oauth.v2.access",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret:
              clientSecret,
            code,
            redirect_uri:
              redirectUri,
          }),
        }
      );

      const data =
        await response.json();

      if (!data.ok) {
        console.error(
          "Slack OAuth error:",
          data
        );

        return res.status(400).json({
          success: false,
          message:
            data.error ||
            "Slack OAuth authorization failed",
        });
      }

      /*
       * Save Slack connection information
       * against the authenticated user.
       */
      await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          slackAccessToken:
            data.access_token ||
            null,

          slackWebhookUrl:
            data.incoming_webhook
              ?.url || null,

          slackChannelId:
            data.incoming_webhook
              ?.channel_id || null,

          slackTeamId:
            data.team?.id || null,

          slackTeamName:
            data.team?.name || null,

          slackConnectedAt:
            new Date(),
        },
      });

      /*
       * Return the user to the React dashboard
       * instead of showing a JSON response.
       */
      const frontendUrl =
        process.env.FRONTEND_URL ||
        "http://localhost:5173";

      return res.redirect(
        `${frontendUrl}?slack=connected`
      );
    } catch (error) {
      console.error(
        "Slack OAuth callback error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to complete Slack OAuth",
      });
    }
  }
);

/**
 * Get Slack connection status
 */
router.get("/status", async (req, res) => {
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

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          slackTeamName: true,
          slackChannelId: true,
          slackConnectedAt: true,
          slackAccessToken: true,
          slackWebhookUrl: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const connected =
      Boolean(
        user.slackAccessToken
      ) ||
      Boolean(
        user.slackWebhookUrl
      );

    return res.json({
      success: true,
      connected,
      team:
        user.slackTeamName ||
        null,
      channelId:
        user.slackChannelId ||
        null,
      connectedAt:
        user.slackConnectedAt ||
        null,
    });
  } catch (error) {
    console.error(
      "Slack status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get Slack status",
    });
  }
});

/**
 * Disconnect Slack
 */
router.post(
  "/disconnect",
  async (req, res) => {
    try {
      const userId = String(
        req.body?.userId || ""
      );

      if (!userId) {
        return res.status(400).json({
          success: false,
          message:
            "userId is required",
        });
      }

      await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          slackAccessToken: null,
          slackWebhookUrl: null,
          slackChannelId: null,
          slackTeamId: null,
          slackTeamName: null,
          slackConnectedAt: null,
        },
      });

      return res.json({
        success: true,
        message:
          "Slack disconnected successfully",
      });
    } catch (error) {
      console.error(
        "Slack disconnect error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to disconnect Slack",
      });
    }
  }
);

export default router;