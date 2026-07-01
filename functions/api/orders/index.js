import {
  badRequest,
  cleanText,
  deliveryFee,
  getDb,
  json,
  listDishes,
  listOrders,
  minimumOrder,
  orderStatuses,
  readBody,
  requireAdmin
} from "../_shared.js";

export async function onRequestGet(context) {
  const db = getDb(context);
  if (!db) {
    return json({ error: "D1 database binding DB is not configured." }, { status: 503 });
  }

  const auth = await requireAdmin(context);
  if (auth.response) return auth.response;

  const orders = await listOrders(db);
  return json({ orders });
}

export async function onRequestPost(context) {
  const db = getDb(context);
  if (!db) {
    return json({ error: "D1 database binding DB is not configured." }, { status: 503 });
  }

  const body = await readBody(context.request);
  if (!body || !Array.isArray(body.items)) {
    return badRequest("订单内容不能为空。");
  }

  const customer = {
    name: cleanText(body.name, 40),
    phone: cleanText(body.phone, 30),
    address: cleanText(body.address, 160),
    note: cleanText(body.note, 120)
  };

  if (!customer.name || !customer.phone || !customer.address) {
    return badRequest("请填写联系人、手机号和配送地址。");
  }

  const qtyById = new Map();
  for (const item of body.items) {
    const id = cleanText(item.id, 80);
    const qty = Math.max(0, Math.min(99, Number.parseInt(item.qty, 10) || 0));
    if (id && qty > 0) {
      qtyById.set(id, (qtyById.get(id) || 0) + qty);
    }
  }

  if (!qtyById.size) {
    return badRequest("请选择至少一个菜品。");
  }

  const dishes = await listDishes(db);
  const dishById = new Map(dishes.filter((dish) => dish.available !== false).map((dish) => [dish.id, dish]));
  const orderItems = [];

  for (const [id, qty] of qtyById) {
    const dish = dishById.get(id);
    if (!dish) {
      return badRequest("订单中包含已下架或不存在的菜品。");
    }
    orderItems.push({ id: dish.id, name: dish.name, qty, price: dish.price });
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  if (subtotal < minimumOrder) {
    return badRequest(`满 ¥${minimumOrder} 起送。`);
  }

  const fee = deliveryFee;
  const total = subtotal + fee;
  const id = `DC${Date.now().toString().slice(-8)}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const createdAt = new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
  const status = orderStatuses[0];

  await db.batch([
    db.prepare(`
      INSERT INTO orders (
        id, created_at, subtotal, fee, total, status,
        customer_name, customer_phone, customer_address, note
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      createdAt,
      subtotal,
      fee,
      total,
      status,
      customer.name,
      customer.phone,
      customer.address,
      customer.note
    ),
    ...orderItems.map((item) => db.prepare(`
      INSERT INTO order_items (order_id, dish_id, dish_name, qty, price)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, item.id, item.name, item.qty, item.price))
  ]);

  return json({
    order: {
      id,
      createdAt,
      items: orderItems,
      subtotal,
      fee,
      total,
      status,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      note: customer.note
    }
  }, { status: 201 });
}
