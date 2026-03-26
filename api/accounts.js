import {
  allowMethods,
  sendJson,
  getClaimsFromRequest,
  getUserById,
  listAccountsForUser,
  getAccountById,
  ensurePrimaryAccountForUser,
  encryptValue,
  supabase,
  httpError
} from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "POST", "DELETE", "OPTIONS"])) return;

  try {
    const claims = await getClaimsFromRequest(req);
    const user = await getUserById(Number(claims.sub));
    if (!user) throw httpError(404, "User tidak ditemukan.");

    await ensurePrimaryAccountForUser(user);

    if (req.method === "GET") {
      const accounts = await listAccountsForUser(user.id);
      return sendJson(res, 200, { ok: true, accounts });
    }

    if (req.method === "POST") {
      const { email, mail_password } = req.body || {};
      if (!email || !mail_password) {
        throw httpError(400, "email dan mail_password wajib diisi.");
      }

      const accounts = await listAccountsForUser(user.id);
      if (accounts.find(a => a.email.toLowerCase() === String(email).toLowerCase())) {
        throw httpError(400, "Email sudah ditambahkan.");
      }

      const { data, error } = await supabase
        .from("mail_accounts")
        .insert({
          owner_user_id: user.id,
          email,
          mail_password_encrypted: encryptValue(mail_password),
          is_active: true
        })
        .select("id, owner_user_id, email, is_active, created_at")
        .limit(1);

      if (error) throw httpError(500, error.message);
      return sendJson(res, 200, { ok: true, account: data?.[0] || null });
    }

    if (req.method === "DELETE") {
      const accountId = Number(req.query.id);
      if (!accountId) throw httpError(400, "id akun wajib diisi.");

      const account = await getAccountById(user.id, accountId);
      if (!account) throw httpError(404, "Akun tidak ditemukan.");

      const { error } = await supabase
        .from("mail_accounts")
        .delete()
        .eq("id", accountId)
        .eq("owner_user_id", user.id);

      if (error) throw httpError(500, error.message);

      await supabase
        .from("emails")
        .delete()
        .eq("mail_account_id", accountId)
        .eq("user_id", user.id);

      return sendJson(res, 200, { ok: true });
    }
  } catch (error) {
    return sendJson(res, error.status || 500, {
      detail: error.message || "Server error."
    });
  }
}
