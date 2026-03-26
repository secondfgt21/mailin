import {
  allowMethods,
  sendJson,
  getClaimsFromRequest,
  getUserById,
  ensurePrimaryAccountForUser,
  listAccountsForUser,
  getAccountById,
  syncMailForAccount,
  httpError
} from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST", "OPTIONS"])) return;

  try {
    const claims = await getClaimsFromRequest(req);
    const user = await getUserById(Number(claims.sub));
    if (!user) throw httpError(404, "User tidak ditemukan.");

    await ensurePrimaryAccountForUser(user);

    const accountId = Number(req.query.account_id || req.body?.account_id || 0);

    if (accountId) {
      const account = await getAccountById(user.id, accountId);
      if (!account) throw httpError(404, "Akun email tidak ditemukan.");

      const result = await syncMailForAccount(user, account);
      return sendJson(res, 200, { ok: true, mode: "single", result });
    }

    const accounts = await listAccountsForUser(user.id);
    if (!accounts.length) {
      throw httpError(400, "Tidak ada akun email.");
    }

    let totalImported = 0;
    const results = [];

    for (const account of accounts) {
      const result = await syncMailForAccount(user, account);
      totalImported += Number(result.imported || 0);
      results.push({
        account_id: account.id,
        email: account.email,
        ...result
      });
    }

    return sendJson(res, 200, {
      ok: true,
      mode: "all",
      totalImported,
      results
    });
  } catch (error) {
    return sendJson(res, error.status || 500, {
      detail: error.message || "Server error."
    });
  }
}
