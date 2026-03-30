import {
  allowMethods,
  sendJson,
  httpError,
  verifyImapLogin
} from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST", "OPTIONS"])) return;

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      throw httpError(400, "Email dan password wajib diisi.");
    }

    const result = await verifyImapLogin({ email, password });

    if (!result.ok) {
      return sendJson(res, 401, {
        ok: false,
        detail: "Email atau password Mailin salah."
      });
    }

    return sendJson(res, 200, {
      ok: true,
      email
    });
  } catch (error) {
    return sendJson(res, error.status || 500, {
      ok: false,
      detail: error.message || "Server error."
    });
  }
}
