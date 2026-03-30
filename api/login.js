import {
  allowMethods,
  sendJson,
  encryptValue,
  createToken,
  verifyMailinLogin,
  httpError
} from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST", "OPTIONS"])) return;

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      throw httpError(400, "Email dan password wajib diisi.");
    }

    await verifyMailinLogin(email, password);

    const encryptedMailPassword = encryptValue(password);
    const token = await createToken(email, encryptedMailPassword);

    return sendJson(res, 200, {
      ok: true,
      token,
      user: {
        email
      }
    });
  } catch (error) {
    return sendJson(res, error.status || 500, {
      detail: error.message || "Server error."
    });
  }
}
