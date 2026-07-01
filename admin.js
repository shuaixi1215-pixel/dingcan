const defaultDishes = [
  { id: "bowl-beef", category: "热销", name: "招牌牛肉饭", price: 28, tag: "人气", icon: "饭", desc: "慢炖牛肉、溏心蛋、青菜，酱香浓郁。", available: true },
  { id: "noodle-chicken", category: "热销", name: "鸡汤鲜面", price: 24, tag: "暖胃", icon: "面", desc: "清鸡汤底，搭配手撕鸡和时蔬。", available: true },
  { id: "dumpling", category: "小吃", name: "煎饺拼盘", price: 18, tag: "酥脆", icon: "饺", desc: "猪肉白菜和三鲜双口味，外皮焦香。", available: true },
  { id: "tofu", category: "热菜", name: "家常豆腐", price: 22, tag: "下饭", icon: "豆", desc: "豆腐煎香后入味，微辣可选。", available: true },
  { id: "shrimp", category: "热菜", name: "鲜虾滑蛋", price: 32, tag: "新鲜", icon: "虾", desc: "鲜虾仁配嫩滑鸡蛋，适合全家分享。", available: true },
  { id: "salad", category: "轻食", name: "牛油果鸡胸沙拉", price: 26, tag: "低脂", icon: "沙", desc: "鸡胸肉、牛油果、玉米和油醋汁。", available: true },
  { id: "tea", category: "饮品", name: "柠檬冷萃茶", price: 12, tag: "解腻", icon: "茶", desc: "清爽茶香，搭配鲜切柠檬。", available: true },
  { id: "set", category: "套餐", name: "双人安心套餐", price: 68, tag: "省心", icon: "套", desc: "两份主食、一份小吃、两杯饮品。", available: true }
];

const storage = {
  dishes: "dingcan_dishes",
  orders: "dingcan_orders"
};

const api = {
  available: true,
  async request(path, options = {}) {
    try {
      const response = await fetch(path, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { ...data, ok: false, status: response.status };
      }

      return data;
    } catch (error) {
      api.available = false;
      console.warn("API unavailable, using local demo data.", error);
      return null;
    }
  }
};

const orderStatuses = ["待接单", "已接单", "制作中", "配送中", "已完成", "已取消"];

const $ = (selector) => document.querySelector(selector);
const loginPanel = $("[data-login-panel]");
const dashboard = $("[data-admin-dashboard]");
const loginForm = $("[data-login-form]");
const loginTitle = $("[data-login-title]");
const loginCopy = $("[data-login-copy]");
const loginButton = $("[data-login-button]");
const loginTip = $("[data-login-tip]");
const logoutButton = $("[data-admin-logout]");
const ordersEl = $("[data-admin-orders]");
const dishesEl = $("[data-admin-dishes]");
const toastEl = $("[data-toast]");

let dishes = readJson(storage.dishes, defaultDishes);
let orders = readJson(storage.orders, []);
let needsSetup = false;

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function money(value) {
  return `¥${Number(value).toFixed(0)}`;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastEl.classList.remove("is-visible");
  }, 2200);
}

function setLoggedIn(isLoggedIn) {
  loginPanel.hidden = isLoggedIn;
  dashboard.hidden = !isLoggedIn;
  logoutButton.hidden = !isLoggedIn;
  if (isLoggedIn) {
    renderAdmin();
    syncFromApi();
  }
}

function renderLoginMode() {
  loginTitle.textContent = needsSetup ? "创建管理员账号" : "商家后台登录";
  loginCopy.textContent = needsSetup
    ? "这是第一次启用后台。请设置一个只有商家知道的管理员账号和密码。"
    : "请输入管理员账号和密码。";
  loginButton.textContent = needsSetup ? "创建并进入后台" : "进入后台";
}

function renderStats() {
  const revenue = orders
    .filter((order) => order.status !== "已取消")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pending = orders.filter((order) => !["已完成", "已取消"].includes(order.status || "待接单")).length;
  const available = dishes.filter((dish) => dish.available !== false).length;

  $("[data-stat-orders]").textContent = orders.length;
  $("[data-stat-revenue]").textContent = money(revenue);
  $("[data-stat-pending]").textContent = pending;
  $("[data-stat-dishes]").textContent = available;
}

function renderOrders() {
  if (!orders.length) {
    ordersEl.innerHTML = `<p class="empty">还没有订单。你可以先去前台提交一单测试。</p>`;
    return;
  }

  ordersEl.innerHTML = orders.map((order) => `
    <article class="admin-card">
      <div>
        <div class="admin-card-title">
          <strong>${order.id}</strong>
          <span class="pill">${order.status || "待接单"}</span>
        </div>
        <p class="empty">${order.createdAt} / ${order.name} / ${order.phone}</p>
        <p>${order.items.map((item) => `${item.name} x ${item.qty}`).join("、")}</p>
        <p class="empty">地址：${order.address}${order.note ? `；备注：${order.note}` : ""}</p>
      </div>
      <div class="admin-actions">
        <strong>${money(order.total)}</strong>
        <select data-order-status="${order.id}" aria-label="修改 ${order.id} 状态">
          ${orderStatuses.map((status) => `<option value="${status}" ${status === (order.status || "待接单") ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </div>
    </article>
  `).join("");
}

function renderDishes() {
  dishesEl.innerHTML = dishes.map((dish) => `
    <article class="admin-card">
      <div class="dish-mini">
        <span class="dish-photo" aria-hidden="true">${dish.icon}</span>
        <div>
          <div class="admin-card-title">
            <strong>${dish.name}</strong>
            <span class="pill">${dish.category}</span>
          </div>
          <p class="empty">${dish.desc}</p>
        </div>
      </div>
      <div class="admin-actions">
        <strong>${money(dish.price)}</strong>
        <label class="switch">
          <input type="checkbox" data-dish-toggle="${dish.id}" ${dish.available !== false ? "checked" : ""}>
          <span>${dish.available !== false ? "上架中" : "已下架"}</span>
        </label>
      </div>
    </article>
  `).join("");
}

function renderAdmin() {
  dishes = readJson(storage.dishes, defaultDishes);
  orders = readJson(storage.orders, []);
  renderStats();
  renderOrders();
  renderDishes();
}

async function syncFromApi() {
  const [dishesData, ordersData] = await Promise.all([
    api.request("/api/dishes"),
    api.request("/api/orders")
  ]);

  if (dishesData?.dishes?.length) {
    dishes = dishesData.dishes;
    writeJson(storage.dishes, dishes);
  }

  if (ordersData?.orders) {
    orders = ordersData.orders;
    writeJson(storage.orders, orders);
  }

  renderStats();
  renderOrders();
  renderDishes();

  if (api.available) {
    showToast("已连接云端订单系统");
  }
}

async function checkAuth() {
  const data = await api.request("/api/auth/status");
  if (!data) {
    loginTip.textContent = "暂时无法连接后台服务，请稍后刷新。";
    renderLoginMode();
    return;
  }

  needsSetup = Boolean(data.needsSetup);
  renderLoginMode();
  setLoggedIn(Boolean(data.authenticated));
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = {
    username: formData.get("username").trim(),
    password: formData.get("password")
  };

  const endpoint = needsSetup ? "/api/auth/setup" : "/api/auth/login";
  const data = await api.request(endpoint, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!data?.ok) {
    loginTip.textContent = data?.error || `后台服务返回 ${data?.status || "未知"}，请稍后重试。`;
    return;
  }

  const wasSetup = needsSetup;
  needsSetup = false;
  loginForm.reset();
  loginTip.textContent = "";
  renderLoginMode();
  setLoggedIn(true);
  showToast(wasSetup ? "管理员账号已创建" : "已进入商家后台");
});

logoutButton.addEventListener("click", async () => {
  await api.request("/api/auth/logout", { method: "POST" });
  setLoggedIn(false);
  showToast("已退出后台");
});

document.addEventListener("change", async (event) => {
  const statusSelect = event.target.closest("[data-order-status]");
  const dishToggle = event.target.closest("[data-dish-toggle]");

  if (statusSelect) {
    const id = statusSelect.dataset.orderStatus;
    const data = await api.request(`/api/orders/${encodeURIComponent(id)}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: statusSelect.value })
    });

    if (data?.ok) {
      orders = orders.map((order) => order.id === id ? { ...order, status: statusSelect.value } : order);
      writeJson(storage.orders, orders);
      await syncFromApi();
      showToast("云端订单状态已更新");
    } else {
      renderAdmin();
      showToast(data?.error || "更新失败，请重新登录后台。");
    }
  }

  if (dishToggle) {
    const id = dishToggle.dataset.dishToggle;
    const data = await api.request(`/api/dishes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ available: dishToggle.checked })
    });

    if (data?.ok) {
      dishes = dishes.map((dish) => dish.id === id ? { ...dish, available: dishToggle.checked } : dish);
      writeJson(storage.dishes, dishes);
      await syncFromApi();
      showToast("云端菜品状态已更新");
    } else {
      renderAdmin();
      showToast(data?.error || "更新失败，请重新登录后台。");
    }
  }
});

$("[data-reset-demo]").addEventListener("click", () => {
  writeJson(storage.dishes, defaultDishes);
  dishes = defaultDishes;
  renderAdmin();
  showToast("菜品已恢复默认状态");
});

checkAuth();
