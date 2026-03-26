import {
  allowMethods,
  sendJson,
  getClaimsFromRequest,
  getUserById,
  syncMailForUser,
  httpError
} from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST", "OPTIONS"])) return;

  try {
    const claims = await getClaimsFromRequest(req);
    const user = await getUserById(Number(claims.sub));
    if (!user) throw httpError(404, "User tidak ditemukan.");

    await syncMailForUser(user);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, error.status || 500, { detail: error.message || "Server error." });
  }
}
