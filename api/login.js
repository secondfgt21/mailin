import {
  allowMethods,
  sendJson,
  getUserByEmail,
  verifyPassword,
  createToken,
  httpError
} from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST", "OPTIONS"])) return;

  try {
    const { email, password } = req.body || {};
    if (!email || !password) throw httpError(400, "Email dan password wajib diisi.");

    const user = await getUserByEmail(email);
    if (!user) throw httpError(404, "Email tidak ditemukan.");
    if (!user.is_active) throw httpError(403, "Akun nonaktif.");

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw httpError(401, "Password salah.");

    const token = await createToken(user);
    return sendJson(res, 200, {
      ok: true,
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    return sendJson(res, error.status || 500, { detail: error.message || "Server error." });
  }
}
