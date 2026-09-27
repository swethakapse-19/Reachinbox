import { Router } from "express";
import prisma from "../lib/prisma";


const router = Router();

router.post("/", async (req, res) => {
  try {
    const {
      userId,
      name,
      email,
      host,
      port,
      secure,
      username,
      password,
    } = req.body;

    if (
      !userId ||
      !name ||
      !email ||
      !host ||
      !port ||
      !username ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "userId, name, email, host, port, username and password are required",
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

    const existingSender = await prisma.sender.findFirst({
      where: {
        userId,
        email,
      },
    });

    if (existingSender) {
      return res.status(409).json({
        success: false,
        message: "Sender already exists for this user",
        sender: existingSender,
      });
    }

    const sender = await prisma.sender.create({
      data: {
        userId,
        name,
        email,
        host,
        port: Number(port),
        secure: Boolean(secure),
        username,
        password,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Sender created successfully",
      sender,
    });
  } catch (error) {
    console.error("Create sender error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create sender",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const senders = await prisma.sender.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      senders,
    });
  } catch (error) {
    console.error("Get senders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch senders",
    });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const senderId = req.params.id;
    const { isActive } = req.body;

    const sender = await prisma.sender.update({
      where: {
        id: senderId,
      },
      data: {
        isActive: Boolean(isActive),
      },
    });

    return res.json({
      success: true,
      message: "Sender updated successfully",
      sender,
    });
  } catch (error) {
    console.error("Update sender error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update sender",
    });
  }
});

export default router;