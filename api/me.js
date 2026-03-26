import {
  allowMethods,
  sendJson,
  getClaimsFromRequest,
  getUserById,
  httpError
} from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "OPTIONS"])) return;

  try {
    const claims = await getClaimsFromRequest(req);
    const user = await getUserById(Number(claims.sub));
    if (!user) throw httpError(404, "User tidak ditemukan.");

    return sendJson(res, 200, {
      id: user.id,
      email: user.email,
      is_active: user.is_active
    });
  } catch (error) {
    return sendJson(res, error.status || 500, { detail: error.message || "Server error." });
  }
}
