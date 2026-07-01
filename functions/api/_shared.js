export const defaultDishes = [
  { id: "bowl-beef", category: "热销", name: "招牌牛肉饭", price: 28, tag: "人气", icon: "饭", desc: "慢炖牛肉、溏心蛋、青菜，酱香浓郁。", available: true },
  { id: "noodle-chicken", category: "热销", name: "鸡汤鲜面", price: 24, tag: "暖胃", icon: "面", desc: "清鸡汤底，搭配手撕鸡和时蔬。", available: true },
  { id: "dumpling", category: "小吃", name: "煎饺拼盘", price: 18, tag: "酥脆", icon: "饺", desc: "猪肉白菜和三鲜双口味，外皮焦香。", available: true },
  { id: "tofu", category: "热菜", name: "家常豆腐", price: 22, tag: "下饭", icon: "豆", desc: "豆腐煎香后入味，微辣可选。", available: true },
  { id: "shrimp", category: "热菜", name: "鲜虾滑蛋", price: 32, tag: "新鲜", icon: "虾", desc: "鲜虾仁配嫩滑鸡蛋，适合全家分享。", available: true },
  { id: "salad", category: "轻食", name: "牛油果鸡胸沙拉", price: 26, tag: "低脂", icon: "沙", desc: "鸡胸肉、牛油果、玉米和油醋汁。", available: true },
  { id: "tea", category: "饮品", name: "柠檬冷萃茶", price: 12, tag: "解腻", icon: "茶", desc: "清爽茶香，搭配鲜切柠檬。", available: true },
  { id: "set", category: "套餐", name: "双人安心套餐", price: 68, tag: "省心", icon: "套", desc: "两份主食、一份小吃、两杯饮品。", available: true }
];

export const orderStatuses = ["待接单", "已接单", "制作中", "配送中", "已完成", "已取消"];
export const minimumOrder = 20;
export const deliveryFee = 4;

export function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(init.headers || {})
    }
  });
}

export function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

export function getDb(context) {
  return context.env && context.env.DB;
}

export async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function ensureSeedDishes(db) {
  const count = await db.prepare("SELECT COUNT(*) AS count FROM dishes").first();
  if (Number(count?.count || 0) > 0) return;

  const statements = defaultDishes.map((dish) => db.prepare(`
    INSERT OR IGNORE INTO dishes (id, category, name, price, tag, icon, description, available)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    dish.id,
    dish.category,
    dish.name,
    dish.price,
    dish.tag,
    dish.icon,
    dish.desc,
    dish.available ? 1 : 0
  ));
  await db.batch(statements);
}

export function normalizeDish(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    price: Number(row.price),
    tag: row.tag,
    icon: row.icon,
    desc: row.description,
    available: Boolean(row.available)
  };
}

export async function listDishes(db) {
  await ensureSeedDishes(db);
  const { results } = await db.prepare(`
    SELECT id, category, name, price, tag, icon, description, available
    FROM dishes
    ORDER BY sort_order ASC, created_at ASC
  `).all();
  return results.map(normalizeDish);
}

export function normalizeOrder(row, items = []) {
  return {
    id: row.id,
    createdAt: row.created_at,
    items,
    subtotal: Number(row.subtotal),
    fee: Number(row.fee),
    total: Number(row.total),
    status: row.status,
    name: row.customer_name,
    phone: row.customer_phone,
    address: row.customer_address,
    note: row.note || ""
  };
}

export async function listOrders(db) {
  const { results: orderRows } = await db.prepare(`
    SELECT *
    FROM orders
    ORDER BY created_at DESC
    LIMIT 100
  `).all();

  if (!orderRows.length) return [];

  const placeholders = orderRows.map(() => "?").join(",");
  const { results: itemRows } = await db.prepare(`
    SELECT order_id, dish_id AS id, dish_name AS name, qty, price
    FROM order_items
    WHERE order_id IN (${placeholders})
    ORDER BY id ASC
  `).bind(...orderRows.map((order) => order.id)).all();

  const itemsByOrder = new Map();
  for (const item of itemRows) {
    const line = {
      id: item.id,
      name: item.name,
      qty: Number(item.qty),
      price: Number(item.price)
    };
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) || []), line]);
  }

  return orderRows.map((order) => normalizeOrder(order, itemsByOrder.get(order.id) || []));
}

export function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}
