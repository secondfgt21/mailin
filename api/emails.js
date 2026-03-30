import {
  allowMethods,
  sendJson,
  getClaimsFromRequest,
  supabase,
  httpError
} from "./_lib.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "OPTIONS"])) return;

  try {
    const claims = await getClaimsFromRequest(req);

    if (!claims?.email) {
      throw httpError(401, "Session email tidak ditemukan.");
    }

    const { data, error } = await supabase
      .from("emails")
      .select("id, mailbox_email, from_name, from_email, subject, body_text, received_at, created_at")
      .eq("mailbox_email", claims.email)
      .order("received_at", { ascending: false })
      .limit(100);

    if (error) throw httpError(500, error.message);

    return sendJson(res, 200, {
      ok: true,
      emails: data || []
    });
  } catch (error) {
    return sendJson(res, error.status || 500, {
      detail: error.message || "Server error."
    });
  }
}
