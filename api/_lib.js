import { createClient } from "@supabase/supabase-js";
import { SignJWT, jwtVerify } from "jose";
import { ImapFlow } from "imapflow";
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const APP_ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY;
const MAILIN_IMAP_HOST = process.env.MAILIN_IMAP_HOST || "fusion.mxrouting.net";
const MAILIN_IMAP_PORT = Number(process.env.MAILIN_IMAP_PORT || 993);
const MAILIN_IMAP_TLS =
  String(process.env.MAILIN_IMAP_TLS || "true").toLowerCase() === "true";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

const jwtSecretBytes = new TextEncoder().encode(JWT_SECRET);

function base64UrlToBuffer(value) {
  const padLength = (4 - (value.length % 4)) % 4;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
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
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptValue(cipherText) {
  if (!cipherText) {
    throw new Error("Password email kosong.");
  }

  const key = getEncryptionKey();
  const data = Buffer.from(cipherText, "base64url");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function createToken(email, encryptedMailPassword) {
  return new SignJWT({
    email,
    mail_password_encrypted: encryptedMailPassword
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
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

export function cleanBodyText(text) {
  return (text || "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function extractTextFromRaw(raw) {
  if (!raw) return "";

  let body = raw;

  const splitMatch = raw.match(/\r?\n\r?\n/);
  const splitIndex = splitMatch ? raw.search(/\r?\n\r?\n/) : -1;
  if (splitIndex !== -1 && splitMatch) {
    body = raw.slice(splitIndex + splitMatch[0].length);
  }

  body = body.replace(/--[-_A-Za-z0-9=.]+/g, " ");
  body = body.replace(/^Content-[^\n]*$/gim, " ");
  body = body.replace(/^MIME-Version:[^\n]*$/gim, " ");
  body = body.replace(/^charset=[^\n]*$/gim, " ");
  body = body.replace(/=\r?\n/g, "");
  body = body.replace(/=([A-F0-9]{2})/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  body = body
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  let lines = body.split(/\r?\n/).map((line) =>
    line.replace(/\u00A0/g, " ").replace(/[ \t]+/g, " ").trim()
  );

  lines = lines.filter((line) => {
    if (!line) return false;
    if (/^=+$/.test(line)) return false;
    if (/^[-_]{2,}$/.test(line)) return false;
    if (/^Content-Type:/i.test(line)) return false;
    if (/^Content-Transfer-Encoding:/i.test(line)) return false;
    if (/^MIME-Version:/i.test(line)) return false;
    if (/^charset=/i.test(line)) return false;
    return true;
  });

  body = lines.join("\n");
  body = body.replace(/\n{2,}/g, "\n").replace(/[ ]{2,}/g, " ").trim();

  return body.slice(0, 20000);
}

export async function verifyMailinLogin(email, mailPassword) {
  const client = new ImapFlow({
    host: MAILIN_IMAP_HOST,
    port: MAILIN_IMAP_PORT,
    secure: MAILIN_IMAP_TLS,
    auth: {
      user: email,
      pass: mailPassword
    },
    logger: false
  });

  await client.connect();
  try {
    await client.mailboxOpen("INBOX");
    return true;
  } catch (err) {
    throw httpError(401, `Login email gagal: ${err.message}`);
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function syncMailbox(email, encryptedMailPassword) {
  const client = new ImapFlow({
    host: MAILIN_IMAP_HOST,
    port: MAILIN_IMAP_PORT,
    secure: MAILIN_IMAP_TLS,
    auth: {
      user: email,
      pass: decryptValue(encryptedMailPassword)
    },
    logger: false
  });

  await client.connect();

  try {
    const mailbox = await client.mailboxOpen("INBOX");
    if (!mailbox.exists || mailbox.exists < 1) {
      return { imported: 0, message: "Inbox kosong" };
    }

    const startSeq = Math.max(1, mailbox.exists - 49);
    const range = `${startSeq}:*`;
    let imported = 0;

    for await (const msg of client.fetch(range, {
      uid: true,
      envelope: true,
      source: true,
      internalDate: true
    })) {
      const fromEntry = msg.envelope?.from?.[0];
      const fromEmail = fromEntry?.address || "";
      const fromName = fromEntry?.name || "";
      const subject = msg.envelope?.subject || "(Tanpa subject)";
      const receivedAt = msg.internalDate ? new Date(msg.internalDate).toISOString() : null;
      const messageId = msg.envelope?.messageId || null;
      const bodyText = cleanBodyText(extractTextFromRaw(msg.source?.toString("utf8") || ""));

      const { error } = await supabase.from("emails").upsert(
        {
          mailbox_email: email,
          mail_uid: msg.uid,
          message_id: messageId,
          from_name: fromName,
          from_email: fromEmail,
          subject,
          body_text: bodyText.slice(0, 20000),
          received_at: receivedAt
        },
        { onConflict: "mailbox_email,mail_uid" }
      );

      if (error) {
        throw httpError(500, `Supabase insert error: ${error.message}`);
      }

      imported++;
    }

    return { imported, message: "Sync selesai" };
  } catch (err) {
    throw httpError(500, `IMAP sync error: ${err.message}`);
  } finally {
    await client.logout().catch(() => {});
  }
}
