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
export const sessionCookieName = "dingcan_admin_session";
export const sessionDays = 7;

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

export function unauthorized(message = "请先登录后台。") {
  return json({ error: message }, { status: 401 });
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

export async function ensureAuthTables(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        iterations INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
      )
    `),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at)")
  ]);
}

export async function hasAdminUser(db) {
  await ensureAuthTables(db);
  const row = await db.prepare("SELECT COUNT(*) AS count FROM admin_users").first();
  return Number(row?.count || 0) > 0;
}

export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const cookies = new Map();
  for (const part of header.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name) {
      cookies.set(name, valueParts.join("="));
    }
  }
  return cookies;
}

export function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

export function constantTimeEqual(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] || 0) ^ (right[index] || 0);
  }

  return diff === 0;
}

export async function hashPassword(password, salt = randomToken(16), iterations = 30000) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations
    },
    keyMaterial,
    256
  );
  return {
    hash: base64Url(new Uint8Array(bits)),
    salt,
    iterations
  };
}

export async function createSession(db, userId) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000).toISOString();
  const id = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO admin_sessions (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(id, userId, tokenHash, expiresAt).run();

  return { token, expiresAt };
}

export function sessionCookie(token, expiresAt) {
  return `${sessionCookieName}=${token}; Path=/; Expires=${new Date(expiresAt).toUTCString()}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${sessionCookieName}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function getAdminUser(context) {
  const db = getDb(context);
  if (!db) return null;

  await ensureAuthTables(db);
  const token = parseCookies(context.request).get(sessionCookieName);
  if (!token) return null;

  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const session = await db.prepare(`
    SELECT admin_sessions.id, admin_users.id AS user_id, admin_users.username
    FROM admin_sessions
    JOIN admin_users ON admin_users.id = admin_sessions.user_id
    WHERE admin_sessions.token_hash = ? AND admin_sessions.expires_at > ?
  `).bind(tokenHash, now).first();

  if (!session) return null;
  return { id: session.user_id, username: session.username, sessionId: session.id };
}

export async function requireAdmin(context) {
  const user = await getAdminUser(context);
  if (!user) {
    return { response: unauthorized() };
  }
  return { user };
}
