import {
  allowMethods,
  sendJson,
  getClaimsFromRequest,
  httpError
} from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "OPTIONS"])) return;

  try {
    const claims = await getClaimsFromRequest(req);
    if (!claims?.email) {
      throw httpError(401, "Session email tidak ditemukan.");
    }

    return sendJson(res, 200, {
      email: claims.email
    });
  } catch (error) {
    return sendJson(res, error.status || 500, {
      detail: error.message || "Server error."
    });
  }
}
