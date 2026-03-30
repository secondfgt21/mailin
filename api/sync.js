import {
  allowMethods,
  sendJson,
  httpError,
  normalizeAccounts,
  fetchInboxForAccount
} from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST", "OPTIONS"])) return;

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const accounts = normalizeAccounts(body.accounts);

    if (!accounts.length) {
      throw httpError(400, "Tidak ada akun yang dikirim.");
    }

    const results = [];
    let allEmails = [];

    for (const account of accounts) {
      const result = await fetchInboxForAccount(account);
      results.push({
        ok: result.ok,
        email: result.email,
        error: result.error || null,
        imported: result.emails.length
      });

      if (result.ok && result.emails.length) {
        allEmails.push(...result.emails);
      }
    }

    allEmails.sort((a, b) => {
      const ta = a.received_at ? new Date(a.received_at).getTime() : 0;
      const tb = b.received_at ? new Date(b.received_at).getTime() : 0;
      return tb - ta;
    });

    return sendJson(res, 200, {
      ok: true,
      emails: allEmails,
      results
    });
  } catch (error) {
    return sendJson(res, error.status || 500, {
      detail: error.message || "Server error."
    });
  }
}
