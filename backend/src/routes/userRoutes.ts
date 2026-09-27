import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

// Get user by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get user",
    });
  }
});

// Create user / return existing user
router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      googleId,
      avatarUrl,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          googleId: googleId || existingUser.googleId,
          avatarUrl: avatarUrl || existingUser.avatarUrl,
        },
      });

      return res.status(200).json({
        success: true,
        message: "User already exists",
        user: updatedUser,
      });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        googleId: googleId || null,
        avatarUrl: avatarUrl || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("Create user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
});

export default router;