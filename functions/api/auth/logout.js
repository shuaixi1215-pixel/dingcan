import { clearSessionCookie, getDb, json, parseCookies, sessionCookieName, sha256 } from "../_shared.js";

export async function onRequestPost(context) {
  const db = getDb(context);
  const token = parseCookies(context.request).get(sessionCookieName);

  if (db && token) {
    const tokenHash = await sha256(token);
    await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).run();
  }

  return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}
