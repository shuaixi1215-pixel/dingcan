import {
  badRequest,
  cleanText,
  createSession,
  getDb,
  hasAdminUser,
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

  if (await hasAdminUser(db)) {
    return json({ error: "管理员账号已存在，请直接登录。" }, { status: 409 });
  }

  const body = await readBody(context.request);
  const username = cleanText(body?.username, 40).toLowerCase();
  const password = String(body?.password || "");

  if (!/^[a-z0-9_]{3,40}$/.test(username)) {
    return badRequest("用户名需为 3-40 位小写字母、数字或下划线。");
  }

  if (password.length < 8) {
    return badRequest("密码至少需要 8 位。");
  }

  let passwordResult;
  try {
    passwordResult = await hashPassword(password);
  } catch {
    return json({ error: "密码加密失败，请稍后重试。" }, { status: 500 });
  }

  const userId = crypto.randomUUID();
  try {
    await db.prepare(`
      INSERT INTO admin_users (id, username, password_hash, password_salt, iterations)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      userId,
      username,
      passwordResult.hash,
      passwordResult.salt,
      passwordResult.iterations
    ).run();
  } catch {
    return json({ error: "管理员账号保存失败，请稍后重试。" }, { status: 500 });
  }

  const session = await createSession(db, userId);

  return json(
    { ok: true, user: { username } },
    { status: 201, headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } }
  );
}
