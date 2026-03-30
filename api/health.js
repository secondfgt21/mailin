import { allowMethods, sendJson } from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "OPTIONS"])) return;

  return sendJson(res, 200, {
    ok: true,
    service: "impura-mail-panel",
    imap_host: process.env.MAILIN_IMAP_HOST || "fusion.mxrouting.net"
  });
}
