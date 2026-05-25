import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "./config.js";

function secretKey() {
  return crypto.createHash("sha256").update(config.secretKey).digest();
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compareSync(password, passwordHash);
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function encryptSecret(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function secretPreview(encryptedValue) {
  return encryptedValue ? "已保存" : "未配置";
}

export function generateNodeToken() {
  return `node_${crypto.randomBytes(24).toString("base64url")}`;
}

export function hashNodeToken(token) {
  if (!token) return "";
  return crypto.createHmac("sha256", secretKey()).update(String(token)).digest("hex");
}
