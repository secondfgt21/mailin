import {
  allowMethods,
  sendJson,
  getClaimsFromRequest,
  syncMailbox,
  httpError
} from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST", "OPTIONS"])) return;

  try {
    const claims = await getClaimsFromRequest(req);

    if (!claims?.email || !claims?.mail_password_encrypted) {
      throw httpError(401, "Session tidak lengkap.");
    }

    const result = await syncMailbox(
      claims.email,
      claims.mail_password_encrypted
    );

    return sendJson(res, 200, {
      ok: true,
      result
    });
  } catch (error) {
    return sendJson(res, error.status || 500, {
      detail: error.message || "Server error."
    });
  }
}
