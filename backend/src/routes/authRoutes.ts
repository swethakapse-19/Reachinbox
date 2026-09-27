import dotenv from "dotenv";
import path from "path";

// Load .env from project root and backend folder
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

import { Router, Request } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

const router = Router();

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || "";

const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || "";

const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:5000/api/auth/google/callback";

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

const JWT_SECRET =
  process.env.AUTH_JWT_SECRET ||
  "development-secret-change-me";

const googleClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

/*
 * Read authentication cookie
 */
function getCookie(
  req: Request,
  name: string
): string | null {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const parts = cookie.trim().split("=");

    const key = parts.shift();

    if (key === name) {
      return decodeURIComponent(
        parts.join("=")
      );
    }
  }

  return null;
}

/*
 * Start Google OAuth
 */
router.get("/google", (_req, res) => {
  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET
  ) {
    return res.status(500).json({
      success: false,
      message:
        "Google OAuth is not configured",
    });
  }

  const authUrl =
    googleClient.generateAuthUrl({
      access_type: "offline",

      scope: [
        "openid",
        "email",
        "profile",
      ],

      include_granted_scopes: true,

      prompt: "select_account",
    });

  return res.redirect(authUrl);
});

/*
 * Google OAuth callback
 */
router.get(
  "/google/callback",
  async (req, res) => {
    try {
      const { code } = req.query;

      if (typeof code !== "string") {
        return res
          .status(400)
          .send(
            "Google authorization code is missing."
          );
      }

      const { tokens } =
        await googleClient.getToken(code);

      if (!tokens.id_token) {
        return res
          .status(400)
          .send(
            "Google ID token was not returned."
          );
      }

      const ticket =
        await googleClient.verifyIdToken({
          idToken: tokens.id_token,
          audience: GOOGLE_CLIENT_ID,
        });

      const payload =
        ticket.getPayload();

      if (!payload) {
        return res
          .status(401)
          .send(
            "Unable to verify Google account."
          );
      }

      const googleId = payload.sub;
      const email = payload.email;

      const name =
        payload.name ||
        email ||
        "Google User";

      const avatarUrl =
        payload.picture || null;

      if (!googleId || !email) {
        return res
          .status(400)
          .send(
            "Google account information is missing."
          );
      }

      if (
        payload.email_verified === false
      ) {
        return res
          .status(403)
          .send(
            "Google email address is not verified."
          );
      }

      /*
       * Create or update user
       */
      const user =
        await prisma.user.upsert({
          where: {
            email,
          },

          update: {
            googleId,
            name,
            avatarUrl,
          },

          create: {
            googleId,
            name,
            email,
            avatarUrl,
          },
        });

      /*
       * Create JWT
       */
      const token = jwt.sign(
        {
          userId: user.id,
        },
        JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

      /*
       * Store JWT in HTTP-only cookie
       */
      res.setHeader(
        "Set-Cookie",
        `reachinbox_token=${encodeURIComponent(
          token
        )}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`
      );

      /*
       * Redirect to frontend
       */
      return res.redirect(
        FRONTEND_URL
      );
    } catch (error) {
      console.error(
        "Google OAuth error:",
        error
      );

      return res
        .status(500)
        .send(
          "Google authentication failed."
        );
    }
  }
);

/*
 * Get authenticated user
 */
router.get("/me", async (req, res) => {
  try {
    const token = getCookie(
      req,
      "reachinbox_token"
    );

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    if (
      typeof decoded === "string" ||
      typeof decoded.userId !== "string"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication token",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: decoded.userId,
        },
      });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(
      "Authentication error:",
      error
    );

    return res.status(401).json({
      success: false,
      message:
        "Authentication expired",
    });
  }
});

/*
 * Logout
 */
router.post("/logout", (_req, res) => {
  res.setHeader(
    "Set-Cookie",
    "reachinbox_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"
  );

  return res.json({
    success: true,
    message:
      "Logged out successfully",
  });
});

/*
 * Export router
 */
export default router;

