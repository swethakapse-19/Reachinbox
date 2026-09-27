import dotenv from "dotenv";
import path from "path";
import nodemailer from "nodemailer";

dotenv.config({
  path: path.resolve(process.cwd(), "backend/.env"),
});

const host = process.env.ETHEREAL_HOST || "smtp.ethereal.email";
const port = Number(process.env.ETHEREAL_PORT) || 587;

const user = process.env.ETHEREAL_USER;
const pass = process.env.ETHEREAL_PASS;

if (!user || !pass) {
  throw new Error(
    "ETHEREAL_USER and ETHEREAL_PASS must be configured"
  );
}

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: {
    user,
    pass,
  },
});