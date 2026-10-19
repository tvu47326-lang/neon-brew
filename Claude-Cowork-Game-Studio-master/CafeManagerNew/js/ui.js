import { EMPLOYMENT_CASH_THRESHOLD, HIREABLE_STAFF, INGREDIENTS, RECIPES, STAFF } from "./game-state.js";
import { getActiveOrders, getPlayerOrderAction } from "./order-system.js";
import { getStaffView } from "./staff-system.js";
import { UPGRADE_INFO, getUpgradeCost } from "./economy-system.js";
import { getReputation } from "./quest-system.js";
import { initAnimationController, pauseAnimations, resumeAnimations, setCharacterState } from "./character-animation-controller.js";

const $ = (selector) => document.querySelector(selector);
const moneyFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const GLYPHS = { beans: "✳", milk: "◌", condensed: "▰", sugar: "◇", ice: "❄", cups: "▱", tea: "⌁", peach: "●", cocoa: "◉" };

let state;
let handlers = {};
let toastTimer = 0;
let orderSignature = "";
let stockSignature = "";
let panelId = "";
let panelSignature = "";

function money(value) { return `${moneyFormat.format(value)} ₫`; }
function byId(id) { return document.getElementById(id); }
function make(tag, className, text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function setupUI(callbacks) {
  handlers = callbacks;
  initAnimationController();
  document.addEventListener("click", handleClick);
  for (const id of ["welcome-dialog", "guide-dialog", "summary-dialog", "confirm-dialog"]) {
    byId(id).addEventListener("cancel", (event) => {
      if (id !== "confirm-dialog") event.preventDefault();
    });
  }
  byId("panel-dialog").addEventListener("close", () => {
    if (panelId === "pause") handlers.onPauseChanged?.(false);
    resumeAnimations("panel");
    panelId = "";
    panelSignature = "";
  });
}

function handleClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.id === "new-game-button") {
    byId("welcome-dialog").close();
    resumeAnimations("welcome");
    handlers.onNewGame?.();
    return;
  }
  if (button.id === "continue-button") {
    byId("welcome-dialog").close();
    resumeAnimations("welcome");
    handlers.onContinue?.();
    return;
  }
  if (button.id === "guide-start-button") {
    byId("guide-dialog").close();
    handlers.onGuideFinished?.();
    return;
  }
  if (button.id === "next-day-button") {
    byId("summary-dialog").close();
    resumeAnimations("summary");
    handlers.onNextDay?.();
    return;
  }
  if (button.id === "pause-button") { openPanel("pause"); return; }
  if (button.id === "dialogue-action") { showHint(); return; }
  if (button.dataset.panel) { openPanel(button.dataset.panel); return; }

  switch (button.dataset.action) {
    case "close-panel": byId("panel-dialog").close(); break;
    case "close-confirm":
      byId("confirm-dialog").close();
      handlers.onPauseChanged?.(false);
      break;
    case "confirm-reset":
      byId("confirm-dialog").close();
      handlers.onNewGame?.();
      break;
    case "new-game":
      panelId = "";
      panelSignature = "";
      byId("panel-dialog").close();
      handlers.onPauseChanged?.(true);
      byId("confirm-dialog").showModal();
      break;
    case "resume": byId("panel-dialog").close(); break;
    case "buy-stock": handlers.onBuyStock?.(button.dataset.id); break;
    case "upgrade": handlers.onUpgrade?.(button.dataset.id); break;
    case "claim-quest": handlers.onClaimQuest?.(); break;
    case "order-action": handlers.onOrderAction?.(button.dataset.id); break;
    case "hire-staff": handlers.onHireStaff?.(button.dataset.id); break;
    case "save-now": handlers.onSaveNow?.(); break;
    default: return;
  }
  if (panelId) renderPanelIfChanged(true);
}

function showHint() {
  const active = state ? getActiveOrders(state) : [];
  const message = !active.length
    ? "Chút nữa khách sẽ ghé. Mình kiểm tra kho một vòng nhé!"
    : state.inventory.cups <= 4
      ? "Ly giấy sắp hết rồi. Mở Kho để nhập thêm trước khi khách chờ lâu nhé."
        : state.hiredStaffId === "nhan"
          ? `Nhân đang điều phối ${active.length} đơn. Mình để đội làm việc theo nhịp nhé!`
          : `Bạn đang có ${active.length} đơn. Chọn từng việc trên đơn để tự xử lý nhé!`;
      byId("dialogue-name").textContent = "Tuấn · Quản lý ca";
  byId("dialogue-text").textContent = message;
  setCharacterState("tuan", "talking", { transient: true });
}

export function showWelcome(canContinue) {
  byId("continue-button").hidden = !canContinue;
  pauseAnimations("welcome");
  byId("welcome-dialog").showModal();
}

export function showGuide() {
  setCharacterState("tuan", "talking");
  byId("guide-dialog").showModal();
}

export function showSummary(summary) {
  pauseAnimations("summary");
  byId("summary-title").textContent = summary.completed >= 5 ? "Một ngày thật khéo!" : "Quán mình đã hết ca";
  byId("summary-copy").textContent = summary.failed
    ? `Đội mình hoàn thành ${summary.completed} đơn. Ngày mai mình thử nhập kho sớm hơn nhé.`
    : "Đội mình đã cùng nhau chăm sóc những vị khách hôm nay.";
  byId("summary-orders").textContent = summary.completed;
  byId("summary-revenue").textContent = money(summary.revenue);
  byId("summary-expenses").textContent = money(summary.expenses);
  byId("summary-bonus").textContent = money(summary.bonus);
  byId("summary-failed").textContent = summary.failed;
  byId("summary-cash").textContent = money(summary.cash);
  if (!byId("summary-dialog").open) byId("summary-dialog").showModal();
}

export function render(nextState) {
  state = nextState;
  byId("day-label").textContent = `Ngày ${state.day}`;
  byId("cash-value").textContent = money(state.cash);
  const seconds = Math.max(0, Math.ceil(state.secondsLeft));
  byId("time-value").textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  byId("rating-value").textContent = `${getReputation(state)}%`;
  byId("quest-label").textContent = state.quest.claimed ? "Thưởng nhiệm vụ đã nhận" : `Phục vụ ${state.quest.goal} vị khách`;
  byId("quest-progress-label").textContent = `${Math.min(state.quest.completed, state.quest.goal)} / ${state.quest.goal}`;
  byId("quest-progress-bar").style.width = `${Math.min(100, (state.quest.completed / state.quest.goal) * 100)}%`;
  const active = getActiveOrders(state);
  byId("active-order-count").textContent = active.length;
  byId("arrival-label").textContent = active.length >= 5 ? "Quán đang đông" : `Khách ghé sau ${Math.max(0, Math.ceil(state.customerSpawnIn))} giây`;
  renderOrders(active);
  renderStaff();
  renderStockGlance();
  renderDialogue();
  if (panelId) renderPanelIfChanged(false);
}

function renderOrders(orders) {
  const signature = `${state.hiredStaffId ?? "none"}|${orders.map((order) => `${order.id}:${order.status}`).join("|")}`;
  const list = byId("order-list");
  if (signature !== orderSignature) {
    orderSignature = signature;
    list.replaceChildren();
    if (!orders.length) {
      list.append(make("p", "empty-orders", "Một tách trà, vài phút nắng. Khách mới sắp đến rồi."));
      return;
    }
    for (const order of orders) {
      const recipe = RECIPES[order.recipeId];
      const card = make("article", "order-card");
      card.dataset.orderId = order.id;
      const mark = make("span", `drink-mark ${order.recipeId === "tra-dao" ? "tea" : order.recipeId === "cacao" ? "cocoa" : ""}`, GLYPHS[recipe.ingredients.beans ? "beans" : recipe.ingredients.tea ? "tea" : "cocoa"]);
      const detail = make("span", "order-detail");
      detail.append(make("strong", "", recipe.name), make("small", "", `#${order.number} · ${order.customerName} · ${money(order.price)}`));
      const status = make("span", "order-state");
      card.append(mark, detail, status);
      list.append(card);
    }
  }
  for (const order of orders) {
    const card = list.querySelector(`[data-order-id="${CSS.escape(order.id)}"]`);
    if (!card) continue;
    const status = card.querySelector(".order-state");
    status.textContent = getOrderStatusLabel(order);
    status.classList.toggle("is-urgent", order.patience <= 10);
    card.style.setProperty("--patience", `${Math.round((order.patience / 44) * 100)}%`);
    const action = getPlayerOrderAction(state, order);
    let actionButton = card.querySelector(".order-action");
    if (action && !actionButton) {
      actionButton = make("button", "order-action");
      actionButton.type = "button";
      actionButton.dataset.action = "order-action";
      actionButton.dataset.id = order.id;
      card.append(actionButton);
    }
    if (actionButton && action) actionButton.textContent = action.label;
    else actionButton?.remove();
  }
}

function getOrderStatusLabel(order) {
  if (order.status === "waiting") return state.hiredStaffId === "nhan" ? "Nhân nhận đơn" : "Chờ bạn nhận đơn";
  if (order.status === "checking") return "Nhân đang kiểm đơn";
  if (order.status === "barQueue") return state.hiredStaffId === "nam" ? "Chờ Nam pha" : "Chờ bạn pha";
  if (order.status === "brewing") return state.hiredStaffId === "nam" ? "Nam đang pha" : "Bạn đang pha";
  if (order.status === "ready") return state.hiredStaffId === "thuy" ? "Chờ Thúy giao" : "Chờ bạn giao";
  if (order.status === "serving") return state.hiredStaffId === "thuy" ? "Thúy đang giao" : "Bạn đang giao";
  if (order.status === "served") return state.hiredStaffId === "ly" ? "Chờ Ly thu tiền" : "Chờ bạn thu tiền";
  if (order.status === "payment") return "Ly đang thanh toán";
  return "Đang xử lý";
}

function renderStaff() {
  const view = getStaffView(state);
  const grid = byId("staff-grid");
  for (const person of view) {
    const signature = `${person.status}:${person.orderNumber ?? ""}`;
    let card = grid.querySelector(`[data-staff-id="${person.id}"]`);
    let status = card?.querySelector(".staff-status");
    if (!card) {
      card = make("div", "staff-card");
      card.dataset.staffId = person.id;
      const portrait = make("span", "portrait character-avatar");
      portrait.dataset.characterId = person.id;
      portrait.setAttribute("aria-hidden", "true");
      portrait.innerHTML = `<svg viewBox="0 0 80 80"><use href="assets/staff-portraits.svg#${person.id}"></use></svg>`;
      card.append(portrait, make("strong", "staff-name", person.name), make("small", "staff-role", person.role));
      status = make("span", "staff-status");
      card.append(status);
      grid.append(card);
    }

    card.dataset.staffSignature = signature;
    const statusClass = person.statusLabel === "Chưa thuê" ? "is-unhired" : person.status === "idle" ? "" : person.status === "guide" ? "is-guide" : "is-working";
    status.className = `staff-status ${statusClass}`;
    status.textContent = person.orderNumber ? `${person.statusLabel} · #${person.orderNumber}` : person.statusLabel;
    const animationState = person.id === "tuan" && person.status === "guide"
      ? "talking"
      : person.id === "thuy" && person.status === "serving"
        ? "serving"
        : (person.id === "nhan" && person.status === "checking") || (person.id === "nam" && person.status === "brewing") || (person.id === "ly" && person.status === "payment")
          ? "working"
          : "idle";
    setCharacterState(person.id, animationState);
  }
}

function renderStockGlance() {
  const keys = ["beans", "milk", "ice", "cups", "tea", "peach"];
  const signature = keys.map((id) => `${id}:${state.inventory[id]}`).join("|");
  if (signature === stockSignature) return;
  stockSignature = signature;
  const list = byId("stock-glance-list");
  list.replaceChildren();
  for (const id of keys) {
    const chip = make("span", `stock-chip ${state.inventory[id] <= 4 ? "is-low" : ""}`);
    chip.append(make("span", "", GLYPHS[id]), make("span", "", INGREDIENTS[id].label), make("strong", "", state.inventory[id]));
    list.append(chip);
  }
}

function renderDialogue() {
  const working = getStaffView(state).find((person) => person.id === "tuan");
  byId("dialogue-name").textContent = `${working.name} · ${working.role}`;
}

function openPanel(id) {
  if (id === "orders") {
    if (byId("panel-dialog").open) byId("panel-dialog").close();
    document.querySelectorAll(".dock-item").forEach((item) => item.classList.toggle("active", item.dataset.panel === "orders"));
    return;
  }
  panelId = id;
  panelSignature = "";
  pauseAnimations("panel");
  document.querySelectorAll(".dock-item").forEach((item) => item.classList.toggle("active", item.dataset.panel === id));
  if (id === "pause") handlers.onPauseChanged?.(true);
  renderPanelIfChanged(true);
  if (!byId("panel-dialog").open) byId("panel-dialog").showModal();
}

function panelStateSignature(id) {
  if (id === "inventory") return `${state.cash}|${Object.values(state.inventory).join(",")}`;
  if (id === "menu") return state.unlockedRecipes.join("|");
  if (id === "quests") return `${state.quest.completed}|${state.quest.failed}|${state.quest.claimed}|${state.cash}`;
  if (id === "upgrades") return `${state.cash}|${state.upgrades.machine}|${state.upgrades.service}|${state.hiredStaffId ?? "none"}`;
  if (id === "pause") return `${state.day}|${state.secondsLeft}`;
  return "";
}

function renderPanelIfChanged(force) {
  if (!panelId || !state) return;
  const signature = panelStateSignature(panelId);
  if (!force && signature === panelSignature) return;
  panelSignature = signature;
  const title = { inventory: "Kho nguyên liệu", menu: "Menu hôm nay", quests: "Việc của quán", upgrades: "Chăm chút quán", pause: "Tạm nghỉ một chút" }[panelId] ?? "Quán mình";
  byId("panel-title").textContent = title;
  byId("panel-eyebrow").textContent = panelId === "pause" ? `NGÀY ${state.day} · ĐÃ TỰ LƯU` : "NEON BREW · QUẢN LÝ QUÁN";
  const content = byId("panel-content");
  content.replaceChildren();
  if (panelId === "inventory") buildInventory(content);
  if (panelId === "menu") buildMenu(content);
  if (panelId === "quests") buildQuests(content);
  if (panelId === "upgrades") buildUpgrades(content);
  if (panelId === "pause") buildPause(content);
}

function addIntro(parent, text) { parent.append(make("p", "sheet-intro", text)); }
function makeActionButton(label, action, id, disabled = false, className = "buy-button") {
  const button = make("button", className, label);
  button.type = "button";
  button.dataset.action = action;
  if (id) button.dataset.id = id;
  button.disabled = disabled;
  return button;
}

function buildInventory(parent) {
  addIntro(parent, "Chạm vào nhập hàng để mua một gói. Nguyên liệu mua sẽ dùng ngay cho công thức của quán.");
  for (const [id, item] of Object.entries(INGREDIENTS)) {
    const row = make("div", "inventory-row");
    const swatch = make("span", `item-swatch ${state.inventory[id] <= 4 ? "low" : ""}`, GLYPHS[id]);
    const copy = make("div", "item-copy");
    copy.append(make("strong", "", item.label), make("small", "", `+${item.pack} ${item.unit} · ${money(item.price)}`));
    const quantity = make("span", "item-quantity", state.inventory[id]);
    const buy = makeActionButton("Nhập hàng", "buy-stock", id, state.cash < item.price);
    row.append(swatch, copy, quantity, buy);
    parent.append(row);
  }
}

function buildMenu(parent) {
  addIntro(parent, "Mỗi món bán ra sẽ tự trừ đúng công thức trong kho. Công thức mới được mở theo số đơn hoàn thành.");
  for (const [id, recipe] of Object.entries(RECIPES)) {
    const unlocked = state.unlockedRecipes.includes(id);
    const row = make("div", `menu-row ${unlocked ? "" : "locked-row"}`);
    const swatch = make("span", "item-swatch", unlocked ? (id === "tra-dao" ? "⌁" : id === "cacao" ? "◉" : "☕") : "◇");
    const copy = make("div", "item-copy");
    const ingredients = Object.keys(recipe.ingredients).map((key) => INGREDIENTS[key].label).join(" · ");
    copy.append(make("strong", "", unlocked ? recipe.name : "Công thức bí mật"), make("small", "", unlocked ? ingredients : "Mở khóa khi hoàn thành thêm đơn"));
    row.append(swatch, copy, make("span", "menu-price", unlocked ? money(recipe.price) : "•••"));
    parent.append(row);
  }
}

function buildQuests(parent) {
  addIntro(parent, "Những mục tiêu nhỏ giúp quán mình lớn lên từng ngày.");
  const card = make("div", "quest-card");
  const medal = make("span", "quest-medal", "✦");
  const copy = make("div", "item-copy");
  copy.append(make("strong", "", `Phục vụ vui vẻ · ${Math.min(state.quest.completed, state.quest.goal)}/${state.quest.goal}`), make("p", "", `Hoàn thành ${state.quest.goal} đơn trong ngày. Thưởng ${money(state.quest.reward)}.`));
  const claim = makeActionButton(state.quest.claimed ? "Đã nhận" : "Nhận thưởng", "claim-quest", "", state.quest.claimed || state.quest.completed < state.quest.goal);
  card.append(medal, copy, claim);
  parent.append(card);
  const result = make("p", "panel-note", `Hôm nay: ${state.dayStats.completed} đơn xong, ${state.dayStats.failed} khách chưa thể phục vụ. Món mới mở sau 3 và 8 đơn hoàn thành.`);
  parent.append(result);
}

function buildUpgrades(parent) {
  addIntro(parent, "Đầu tư từ tiền quán đang có. Máy tốt giúp pha nhanh hơn; quy trình gọn giúp phục vụ mau hơn.");
  const descriptions = { machine: "Rút ngắn thời gian pha chế.", service: "Thuy phục vụ và Ly thanh toán nhanh hơn." };
  for (const [id, info] of Object.entries(UPGRADE_INFO)) {
    const level = state.upgrades[id];
    const cost = getUpgradeCost(state, id);
    const row = make("div", "upgrade-row");
    const swatch = make("span", "item-swatch", id === "machine" ? "◈" : "↗");
    const copy = make("div", "item-copy");
    const meter = make("span", "level-meter");
    for (let index = 0; index < info.max; index += 1) {
      const segment = make("span", index < level ? "filled" : "");
      meter.append(segment);
    }
    copy.append(make("strong", "", info.label), make("small", "", `Cấp ${level}/${info.max} · ${descriptions[id]}`), meter);
    const button = makeActionButton(cost === null ? "Đã đủ cấp" : `Nâng · ${money(cost)}`, "upgrade", id, cost === null || state.cash < cost);
    row.append(swatch, copy, button);
    parent.append(row);
  }
  buildHiring(parent);
}

function buildHiring(parent) {
  parent.append(make("p", "hiring-heading", "Đội ngũ vận hành"));
  if (HIREABLE_STAFF.includes(state.hiredStaffId)) {
    const hired = STAFF.find((person) => person.id === state.hiredStaffId);
    parent.append(make("p", "panel-note", `Bạn đã tuyển ${hired.name} · ${hired.role}. Nhân viên tự xử lý công đoạn này; những bước còn lại bạn thao tác trên đơn.`));
    return;
  }

  const progress = Math.min(100, (state.cash / EMPLOYMENT_CASH_THRESHOLD) * 100);
  const note = make("p", "hiring-note", `Đạt ${money(EMPLOYMENT_CASH_THRESHOLD)} tiền mặt để mở khóa một suất tuyển dụng. Hiện có ${money(state.cash)}.`);
  const track = make("div", "progress-track hiring-progress");
  const fill = make("span");
  fill.style.width = `${progress}%`;
  track.append(fill);
  parent.append(note, track);

  for (const person of STAFF.filter((candidate) => HIREABLE_STAFF.includes(candidate.id))) {
    const row = make("div", "hiring-row");
    const copy = make("div", "item-copy");
    copy.append(make("strong", "", person.name), make("small", "", `${person.role} · tự động xử lý một công đoạn`));
    const button = makeActionButton(state.cash >= EMPLOYMENT_CASH_THRESHOLD ? `Tuyển ${person.name}` : "Đạt 10 triệu", "hire-staff", person.id, state.cash < EMPLOYMENT_CASH_THRESHOLD);
    row.append(copy, button);
    parent.append(row);
  }
}

function buildPause(parent) {
  addIntro(parent, "Tiến trình được lưu tự động trên thiết bị này. Nghỉ một chút, khi trở lại ca vẫn ở đúng nhịp.");
  const actions = make("div", "pause-actions");
  actions.append(makeActionButton("Tiếp tục ca làm", "resume", "", false, "button button-primary"));
  actions.append(makeActionButton("Lưu ngay", "save-now", "", false, "button button-quiet"));
  actions.append(makeActionButton("Bắt đầu mới", "new-game", "", false, "button button-quiet"));
  parent.append(actions, make("p", "storage-note", "Bản lưu chỉ nằm trong localStorage của trình duyệt này."));
}

export function refreshPanel() { renderPanelIfChanged(true); }
export function closePanel() { if (byId("panel-dialog").open) byId("panel-dialog").close(); }
export function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2400);
}