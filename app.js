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
  cart: "dingcan_cart",
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

function getDishes() {
  const saved = readJson(storage.dishes, null);
  if (Array.isArray(saved) && saved.length) {
    return saved;
  }
  writeJson(storage.dishes, defaultDishes);
  return defaultDishes;
}

const state = {
  category: "全部",
  dishes: getDishes(),
  cart: readJson(storage.cart, {}),
  orders: readJson(storage.orders, [])
};

const minimumOrder = 20;
const deliveryFee = 4;
const orderStatuses = ["待接单", "已接单", "制作中", "配送中", "已完成", "已取消"];

const $ = (selector) => document.querySelector(selector);
const menuEl = $("[data-menu]");
const tabsEl = $("[data-category-tabs]");
const cartItemsEl = $("[data-cart-items]");
const cartCountEl = $("[data-cart-count]");
const subtotalEl = $("[data-subtotal]");
const deliveryEl = $("[data-delivery]");
const totalEl = $("[data-total]");
const orderForm = $("[data-order-form]");
const formTipEl = $("[data-form-tip]");
const ordersListEl = $("[data-orders-list]");
const toastEl = $("[data-toast]");
const mobileCart = $("[data-mobile-cart]");
const mobileCartText = $("[data-mobile-cart-text]");
const mobileCartTotal = $("[data-mobile-cart-total]");

function money(value) {
  return `¥${Number(value).toFixed(0)}`;
}

function save() {
  writeJson(storage.cart, state.cart);
  writeJson(storage.orders, state.orders);
}

function saveDishes() {
  writeJson(storage.dishes, state.dishes);
}

function getVisibleDishes() {
  return state.dishes.filter((dish) => dish.available !== false);
}

function getCartLines() {
  return Object.entries(state.cart)
    .map(([id, qty]) => ({ ...state.dishes.find((dish) => dish.id === id), qty }))
    .filter((line) => line.id && line.qty > 0 && line.available !== false);
}

function getTotals() {
  const lines = getCartLines();
  const subtotal = lines.reduce((sum, item) => sum + item.price * item.qty, 0);
  const fee = subtotal >= minimumOrder ? deliveryFee : 0;
  return {
    lines,
    subtotal,
    fee,
    total: subtotal + fee,
    count: lines.reduce((sum, item) => sum + item.qty, 0)
  };
}

function renderTabs() {
  const categories = ["全部", ...new Set(getVisibleDishes().map((dish) => dish.category))];
  if (!categories.includes(state.category)) {
    state.category = "全部";
  }
  tabsEl.innerHTML = categories.map((category) => `
    <button class="tab" type="button" aria-selected="${category === state.category}" data-category="${category}">
      ${category}
    </button>
  `).join("");
}

function renderMenu() {
  const availableDishes = getVisibleDishes();
  const visible = state.category === "全部"
    ? availableDishes
    : availableDishes.filter((dish) => dish.category === state.category);

  if (!visible.length) {
    menuEl.innerHTML = `<p class="empty">当前分类暂无可售菜品。</p>`;
    return;
  }

  menuEl.innerHTML = visible.map((dish) => `
    <article class="dish-card">
      <div class="dish-photo" aria-hidden="true">${dish.icon}</div>
      <div class="dish-info">
        <div class="dish-title">
          <h3>${dish.name}</h3>
          <span class="tag">${dish.tag}</span>
        </div>
        <p class="dish-desc">${dish.desc}</p>
        <div class="dish-actions">
          <span class="price">${money(dish.price)}</span>
          <button class="add-button" type="button" data-add="${dish.id}">加入</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderCart() {
  const totals = getTotals();
  cartCountEl.textContent = totals.count;
  subtotalEl.textContent = money(totals.subtotal);
  deliveryEl.textContent = totals.fee ? money(totals.fee) : "未达起送";
  totalEl.textContent = money(totals.total);
  mobileCart.hidden = totals.count === 0;
  mobileCartText.textContent = totals.count ? `${totals.count} 件商品` : "购物车为空";
  mobileCartTotal.textContent = money(totals.total);

  if (!totals.lines.length) {
    cartItemsEl.innerHTML = `<p class="empty">还没有选择菜品</p>`;
  } else {
    cartItemsEl.innerHTML = totals.lines.map((item) => `
      <div class="cart-row">
        <div>
          <h3>${item.name}</h3>
          <p>${money(item.price)} x ${item.qty}</p>
        </div>
        <div class="qty" aria-label="${item.name} 数量">
          <button type="button" data-minus="${item.id}">-</button>
          <span>${item.qty}</span>
          <button type="button" data-add="${item.id}">+</button>
        </div>
      </div>
    `).join("");
  }

  const submitButton = orderForm.querySelector("button[type='submit']");
  submitButton.disabled = totals.subtotal < minimumOrder;
  formTipEl.textContent = totals.subtotal < minimumOrder
    ? `满 ${money(minimumOrder)} 起送，还差 ${money(minimumOrder - totals.subtotal)}。`
    : "已达到起送价，预计 30-45 分钟送达。";
}

function renderOrders() {
  if (!state.orders.length) {
    ordersListEl.innerHTML = `<p class="empty">暂无订单。提交后会显示在这里。</p>`;
    return;
  }

  ordersListEl.innerHTML = state.orders.map((order) => `
    <article class="order-card">
      <header>
        <div>
          <strong>${order.id}</strong>
          <p class="empty">${order.createdAt}</p>
        </div>
        <strong>${money(order.total)}</strong>
      </header>
      <div>${order.items.map((item) => `${item.name} x ${item.qty}`).join("、")}</div>
      <div class="order-meta">
        <span>联系人：${order.name}</span>
        <span>手机：${order.phone}</span>
        <span>状态：${order.status || orderStatuses[0]}</span>
      </div>
      <p class="empty">地址：${order.address}${order.note ? `；备注：${order.note}` : ""}</p>
    </article>
  `).join("");
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastEl.classList.remove("is-visible");
  }, 2200);
}

async function syncFromApi() {
  const [dishesData, ordersData] = await Promise.all([
    api.request("/api/dishes"),
    api.request("/api/orders")
  ]);

  if (dishesData?.dishes?.length) {
    state.dishes = dishesData.dishes;
    saveDishes();
  }

  if (ordersData?.orders) {
    state.orders = ordersData.orders;
    writeJson(storage.orders, state.orders);
  }

  renderTabs();
  renderMenu();
  renderCart();
  renderOrders();

  if (api.available) {
    showToast("已连接云端订单系统");
  }
}

function changeQty(id, delta) {
  const dish = state.dishes.find((item) => item.id === id);
  if (!dish || dish.available === false) {
    showToast("该菜品已下架");
    return;
  }
  state.cart[id] = Math.max(0, (state.cart[id] || 0) + delta);
  if (!state.cart[id]) {
    delete state.cart[id];
  }
  save();
  renderCart();
}

tabsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  renderTabs();
  renderMenu();
});

document.addEventListener("click", (event) => {
  const add = event.target.closest("[data-add]");
  const minus = event.target.closest("[data-minus]");

  if (add) {
    changeQty(add.dataset.add, 1);
    showToast("已加入购物车");
  }

  if (minus) {
    changeQty(minus.dataset.minus, -1);
  }

  if (event.target.closest("[data-open-cart]")) {
    document.querySelector("#checkout").scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

$("[data-clear-cart]").addEventListener("click", () => {
  state.cart = {};
  save();
  renderCart();
  showToast("购物车已清空");
});

$("[data-clear-orders]").addEventListener("click", () => {
  state.orders = [];
  save();
  renderOrders();
  showToast("订单记录已清除");
});

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const totals = getTotals();
  if (totals.subtotal < minimumOrder) {
    showToast("还没有达到起送价");
    return;
  }

  const formData = new FormData(orderForm);
  const orderPayload = {
    items: totals.lines.map(({ id, qty }) => ({ id, qty })),
    name: formData.get("name").trim(),
    phone: formData.get("phone").trim(),
    address: formData.get("address").trim(),
    note: formData.get("note").trim()
  };

  let order = null;
  const data = await api.request("/api/orders", {
    method: "POST",
    body: JSON.stringify(orderPayload)
  });

  if (data?.order) {
    order = data.order;
  } else {
    order = {
      id: `DC${Date.now().toString().slice(-8)}`,
      createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      items: totals.lines.map(({ id, name, qty, price }) => ({ id, name, qty, price })),
      subtotal: totals.subtotal,
      fee: totals.fee,
      total: totals.total,
      status: orderStatuses[0],
      name: formData.get("name").trim(),
      phone: formData.get("phone").trim(),
      address: formData.get("address").trim(),
      note: formData.get("note").trim()
    };
  }

  state.orders = [order, ...state.orders].slice(0, 20);
  state.cart = {};
  orderForm.reset();
  save();
  renderCart();
  renderOrders();
  showToast(`订单 ${order.id} 已提交`);
  document.querySelector("#orders").scrollIntoView({ behavior: "smooth", block: "start" });
});

renderTabs();
renderMenu();
renderCart();
renderOrders();
syncFromApi();
