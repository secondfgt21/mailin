import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const MAILIN_IMAP_HOST = process.env.MAILIN_IMAP_HOST || "fusion.mxrouting.net";
const MAILIN_IMAP_PORT = Number(process.env.MAILIN_IMAP_PORT || 993);
const MAILIN_IMAP_TLS =
  String(process.env.MAILIN_IMAP_TLS || "true").toLowerCase() === "true";

export function sendJson(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export function allowMethods(req, res, methods) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", methods.join(", "));

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return false;
  }

  return true;
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function normalizeAccounts(accounts) {
  if (!Array.isArray(accounts)) return [];

  const seen = new Set();
  const cleaned = [];

  for (const item of accounts) {
    const email = String(item?.email || "").trim().toLowerCase();
    const password = String(item?.password || "");

    if (!email || !password) continue;
    if (seen.has(email)) continue;

    seen.add(email);
    cleaned.push({ email, password });
  }

  return cleaned;
}

function cleanText(text) {
  return String(text || "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchInboxForAccount(account) {
  const client = new ImapFlow({
    host: MAILIN_IMAP_HOST,
    port: MAILIN_IMAP_PORT,
    secure: MAILIN_IMAP_TLS,
    auth: {
      user: account.email,
      pass: account.password
    },
    logger: false
  });

  await client.connect();

  try {
    await client.mailboxOpen("INBOX");

    const messages = [];
    const lock = await client.getMailboxLock("INBOX");

    try {
      let uids = [];
      for await (const msg of client.fetch("1:*", { uid: true })) {
        uids.push(msg.uid);
      }

      uids = uids.slice(-50).reverse();

      for await (const msg of client.fetch(uids.join(","), {
        uid: true,
        envelope: true,
        source: true,
        internalDate: true
      })) {
        let parsed;
        try {
          parsed = await simpleParser(msg.source);
        } catch {
          parsed = null;
        }

        const fromParsed = parsed?.from?.value?.[0];
        const fromEnvelope = msg.envelope?.from?.[0];

        const fromEmail =
          fromParsed?.address ||
          fromEnvelope?.address ||
          "";

        const fromName =
          fromParsed?.name ||
          fromEnvelope?.name ||
          fromEmail ||
          "Unknown";

        const subject =
          parsed?.subject ||
          msg.envelope?.subject ||
          "(Tanpa subject)";

        const bodyText = cleanText(
          parsed?.text ||
            parsed?.html?.replace(/<[^>]+>/g, " ") ||
            ""
        );

        messages.push({
          id: `${account.email}-${msg.uid}`,
          account_email: account.email,
          mail_uid: msg.uid,
          from_name: fromName,
          from_email: fromEmail,
          subject,
          body_text: bodyText || "(Isi email kosong)",
          received_at: msg.internalDate
            ? new Date(msg.internalDate).toISOString()
            : null
        });
      }
    } finally {
      lock.release();
    }

    return {
      ok: true,
      email: account.email,
      emails: messages
    };
  } catch (error) {
    return {
      ok: false,
      email: account.email,
      error: error.message || "Command failed",
      emails: []
    };
  } finally {
    await client.logout().catch(() => {});
  }
}
