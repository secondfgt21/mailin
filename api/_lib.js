import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { ImapFlow } from "imapflow";
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const APP_ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY;
const MAILIN_IMAP_HOST = process.env.MAILIN_IMAP_HOST || "fusion.mailin.id";
const MAILIN_IMAP_PORT = Number(process.env.MAILIN_IMAP_PORT || 993);
const MAILIN_IMAP_TLS =
  String(process.env.MAILIN_IMAP_TLS || "true").toLowerCase() === "true";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET || !APP_ENCRYPTION_KEY) {
  console.warn("Missing required environment variables.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const jwtSecretBytes = new TextEncoder().encode(JWT_SECRET);

function base64UrlToBuffer(value) {
  const padLength = (4 - (value.length % 4)) % 4;
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  return Buffer.from(padded, "base64");
}

function getEncryptionKey() {
  const raw = base64UrlToBuffer(APP_ENCRYPTION_KEY);
  if (raw.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY harus 32-byte base64url.");
  }
  return raw;
}

export function encryptValue(plainText) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptValue(cipherText) {
  try {
    const key = getEncryptionKey();
    const data = Buffer.from(cipherText, "base64url");
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    throw new Error("Gagal decrypt mail password. Cek APP_ENCRYPTION_KEY.");
  }
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function createToken(user) {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setExpirationTime("7d")
    .sign(jwtSecretBytes);
}

export async function getClaimsFromRequest(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    throw httpError(401, "Token tidak ada.");
  }
  const token = auth.slice(7);
  try {
    const { payload } = await jwtVerify(token, jwtSecretBytes);
    return payload;
  } catch {
    throw httpError(401, "Token tidak valid.");
  }
}

export async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .limit(1);

  if (error) throw httpError(500, error.message);
  return data?.[0] || null;
}

export async function getUserById(id) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .limit(1);

  if (error) throw httpError(500, error.message);
  return data?.[0] || null;
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function sendJson(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export function allowMethods(req, res, methods) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return false;
  }
  return true;
}

/**
 * OPSI 1:
 * Ambil SEMUA email dari INBOX Mailin, lalu simpan ke Supabase.
 * Email yang sudah pernah masuk tidak akan dobel karena pakai
 * upsert + unique(user_id, mail_uid).
 */
export async function syncMailForUser(user) {
  if (!user?.is_active) {
    throw httpError(403, "Akun nonaktif.");
  }

  const client = new ImapFlow({
    host: MAILIN_IMAP_HOST,
    port: MAILIN_IMAP_PORT,
    secure: MAILIN_IMAP_TLS,
    auth: {
      user: user.email,
      pass: decryptValue(user.mail_password_encrypted),
    },
    logger: false,
  });

  await client.connect();

  try {
    await client.mailboxOpen("INBOX");
    const lock = await client.getMailboxLock("INBOX");

    try {
      for await (const msg of client.fetch("1:*", {
        uid: true,
        envelope: true,
        source: true,
        internalDate: true,
      })) {
        const fromEntry = msg.envelope?.from?.[0];
        const fromEmail = fromEntry?.address || "";
        const fromName = fromEntry?.name || "";
        const subject = msg.envelope?.subject || "(Tanpa subject)";
        const receivedAt = msg.internalDate
          ? new Date(msg.internalDate).toISOString()
          : null;
        const messageId = msg.envelope?.messageId || null;
        const bodyText = extractTextFromRaw(msg.source?.toString("utf8") || "");

        const { error } = await supabase.from("emails").upsert(
          {
            user_id: user.id,
            mail_uid: msg.uid,
            message_id: messageId,
            from_name: fromName,
            from_email: fromEmail,
            subject,
            body_text: bodyText.slice(0, 20000),
            received_at: receivedAt,
          },
          { onConflict: "user_id,mail_uid" }
        );

        if (error) {
          throw httpError(500, error.message);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

function extractTextFromRaw(raw) {
  if (!raw) return "";

  // ambil body setelah header
  const parts = raw.split(/\r?\n\r?\n/);
  let body = parts.slice(1).join("\n\n");

  // 🔥 buang boundary MIME
  body = body.replace(/--[_A-Za-z0-9\-]+/g, " ");

  // 🔥 buang header dalam body
  body = body.replace(/Content-[^\n]+\n/gi, " ");

  // 🔥 decode quoted-printable (=0A dll)
  body = body
    .replace(/=\r?\n/g, "") // soft line break
    .replace(/=([A-F0-9]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

  // 🔥 hapus style/script dll
  body = body
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // 🔥 convert HTML ke text
  body = body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n");

  body = body.replace(/<[^>]+>/g, " ");

  // 🔥 decode entity
  body = body
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // 🔥 hapus baris sampah
  body = body.replace(/^=.*$/gm, ""); // buang line =_xxx

  // rapikan
  body = body
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return body.slice(0, 20000);
}
