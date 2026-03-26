import {
  allowMethods,
  sendJson,
  getUserByEmail,
  hashPassword,
  encryptValue,
  supabase,
  httpError
} from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST", "OPTIONS"])) return;

  try {
    const { admin_key, email, web_password, mail_password } = req.body || {};

    if (admin_key !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw httpError(403, "admin_key salah.");
    }

    if (!email || !web_password || !mail_password) {
      throw httpError(400, "email, web_password, dan mail_password wajib diisi.");
    }

    const existing = await getUserByEmail(email);
    if (existing) throw httpError(400, "User sudah ada.");

    const passwordHash = await hashPassword(web_password);
    const mailPasswordEncrypted = encryptValue(mail_password);

    const { data, error } = await supabase
      .from("users")
      .insert({
        email,
        password_hash: passwordHash,
        mail_password_encrypted: mailPasswordEncrypted,
        is_active: true
      })
      .select("*")
      .limit(1);

    if (error) throw httpError(500, error.message);

    const user = data?.[0];

    await supabase.from("mail_accounts").insert({
      owner_user_id: user.id,
      email,
      mail_password_encrypted: mailPasswordEncrypted,
      is_active: true
    });

    return sendJson(res, 200, { ok: true, user });
  } catch (error) {
    return sendJson(res, error.status || 500, {
      detail: error.message || "Server error."
    });
  }
}
