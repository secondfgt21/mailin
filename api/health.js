import { allowMethods, sendJson } from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "OPTIONS"])) return;
  return sendJson(res, 200, { ok: true });
}
