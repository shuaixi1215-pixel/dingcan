import {
  badRequest,
  cleanText,
  constantTimeEqual,
  createSession,
  ensureAuthTables,
  getDb,
  hashPassword,
  json,
  readBody,
  sessionCookie
} from "../_shared.js";

export async function onRequestPost(context) {
  const db = getDb(context);
  if (!db) {
    return json({ error: "D1 database binding DB is not configured." }, { status: 503 });
  }

  await ensureAuthTables(db);

  const body = await readBody(context.request);
  const username = cleanText(body?.username, 40).toLowerCase();
  const password = String(body?.password || "");

  if (!username || !password) {
    return badRequest("请输入用户名和密码。");
  }

  const user = await db.prepare(`
    SELECT id, username, password_hash, password_salt, iterations
    FROM admin_users
    WHERE username = ?
  `).bind(username).first();

  if (!user) {
    return json({ error: "用户名或密码不正确。" }, { status: 401 });
  }

  const passwordResult = await hashPassword(password, user.password_salt, Number(user.iterations));
  if (!constantTimeEqual(passwordResult.hash, user.password_hash)) {
    return json({ error: "用户名或密码不正确。" }, { status: 401 });
  }

  const session = await createSession(db, user.id);

  return json(
    { ok: true, user: { username: user.username } },
    { headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } }
  );
}
