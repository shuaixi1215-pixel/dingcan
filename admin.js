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
  orders: "dingcan_orders",
  session: "dingcan_admin_session"
};

const api = {
  available: true,
  async request(path, options = {}) {
    try {
      const response = await fetch(path, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
      });

      if (!response.ok) {
        throw new Error(`API ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      api.available = false;
      console.warn("API unavailable, using local demo data.", error);
      return null;
    }
  }
};

const orderStatuses = ["待接单", "已接单", "制作中", "配送中", "已完成", "已取消"];
const adminPassword = "888888";

const $ = (selector) => document.querySelector(selector);
const loginPanel = $("[data-login-panel]");
const dashboard = $("[data-admin-dashboard]");
const loginForm = $("[data-login-form]");
const loginTip = $("[data-login-tip]");
const logoutButton = $("[data-admin-logout]");
const ordersEl = $("[data-admin-orders]");
const dishesEl = $("[data-admin-dishes]");
const toastEl = $("[data-toast]");

let dishes = readJson(storage.dishes, defaultDishes);
let orders = readJson(storage.orders, []);

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
  localStorage.setItem(storage.session, isLoggedIn ? "1" : "0");
  loginPanel.hidden = isLoggedIn;
  dashboard.hidden = !isLoggedIn;
  logoutButton.hidden = !isLoggedIn;
  if (isLoggedIn) {
    renderAdmin();
    syncFromApi();
  }
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

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const password = new FormData(loginForm).get("password");
  if (password !== adminPassword) {
    loginTip.textContent = "密码不正确。演示密码是 888888。";
    return;
  }
  loginForm.reset();
  loginTip.textContent = "";
  setLoggedIn(true);
  showToast("已进入商家后台");
});

logoutButton.addEventListener("click", () => {
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

    orders = orders.map((order) => order.id === id ? { ...order, status: statusSelect.value } : order);
    writeJson(storage.orders, orders);
    if (data?.ok) {
      await syncFromApi();
    } else {
      renderAdmin();
    }
    showToast(data?.ok ? "云端订单状态已更新" : "订单状态已在本地更新");
  }

  if (dishToggle) {
    const id = dishToggle.dataset.dishToggle;
    const data = await api.request(`/api/dishes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ available: dishToggle.checked })
    });

    dishes = dishes.map((dish) => dish.id === id ? { ...dish, available: dishToggle.checked } : dish);
    writeJson(storage.dishes, dishes);
    if (data?.ok) {
      await syncFromApi();
    } else {
      renderAdmin();
    }
    showToast(data?.ok ? "云端菜品状态已更新" : "菜品状态已在本地更新");
  }
});

$("[data-reset-demo]").addEventListener("click", () => {
  writeJson(storage.dishes, defaultDishes);
  dishes = defaultDishes;
  renderAdmin();
  showToast("菜品已恢复默认状态");
});

setLoggedIn(localStorage.getItem(storage.session) === "1");
