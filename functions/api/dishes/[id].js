import { badRequest, getDb, json, readBody } from "../_shared.js";

export async function onRequestPatch(context) {
  const db = getDb(context);
  if (!db) {
    return json({ error: "D1 database binding DB is not configured." }, { status: 503 });
  }

  const body = await readBody(context.request);
  if (!body || typeof body.available !== "boolean") {
    return badRequest("请提供菜品上下架状态。");
  }

  const id = context.params.id;
  const result = await db.prepare(`
    UPDATE dishes
    SET available = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(body.available ? 1 : 0, id).run();

  if (!result.meta || result.meta.changes === 0) {
    return json({ error: "菜品不存在。" }, { status: 404 });
  }

  return json({ ok: true });
}
