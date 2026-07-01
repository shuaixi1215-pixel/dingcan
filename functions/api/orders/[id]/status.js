import { badRequest, getDb, json, orderStatuses, readBody } from "../../_shared.js";

export async function onRequestPut(context) {
  const db = getDb(context);
  if (!db) {
    return json({ error: "D1 database binding DB is not configured." }, { status: 503 });
  }

  const body = await readBody(context.request);
  if (!body || !orderStatuses.includes(body.status)) {
    return badRequest("订单状态不正确。");
  }

  const result = await db.prepare(`
    UPDATE orders
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(body.status, context.params.id).run();

  if (!result.meta || result.meta.changes === 0) {
    return json({ error: "订单不存在。" }, { status: 404 });
  }

  return json({ ok: true });
}
