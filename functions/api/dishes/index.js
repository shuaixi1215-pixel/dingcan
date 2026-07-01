import { getDb, json, listDishes } from "../_shared.js";

export async function onRequestGet(context) {
  const db = getDb(context);
  if (!db) {
    return json({ error: "D1 database binding DB is not configured." }, { status: 503 });
  }

  const dishes = await listDishes(db);
  return json({ dishes });
}
