import { getAdminUser, getDb, hasAdminUser, json } from "../_shared.js";

export async function onRequestGet(context) {
  const db = getDb(context);
  if (!db) {
    return json({ error: "D1 database binding DB is not configured." }, { status: 503 });
  }

  const needsSetup = !(await hasAdminUser(db));
  const user = needsSetup ? null : await getAdminUser(context);

  return json({
    needsSetup,
    authenticated: Boolean(user),
    user: user ? { username: user.username } : null
  });
}
