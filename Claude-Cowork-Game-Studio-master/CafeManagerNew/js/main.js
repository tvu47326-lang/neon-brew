import { createInitialState, EMPLOYMENT_CASH_THRESHOLD, normalizeEmploymentState, RECIPES, STAFF } from "./game-state.js";
import { tickCustomers } from "./customer-system.js";
import { closeOrdersAtEnd, performPlayerOrderAction, pruneOrders, tickPlayerWork, tickStaff } from "./order-system.js";
import { buyIngredientPack } from "./inventory-system.js";
import { hireStaff, purchaseUpgrade, settleOrder, startNextDay } from "./economy-system.js";
import { claimQuestReward, recordOrderResult } from "./quest-system.js";
import { clearGameSave, loadGame, saveGame } from "./save-system.js";
import { closePanel, refreshPanel, render, setupUI, showGuide, showSummary, showToast, showWelcome } from "./ui.js";
import { destroyAnimationController, pauseAnimations, resumeAnimations, setCharacterState } from "./character-animation-controller.js";

let state = null;
let timerId = 0;
let bootTimer = 0;
let paused = false;
let summaryShown = false;

function persist() {
  if (state && !saveGame(state)) showToast("Không lưu được trên thiết bị này.");
}

function startNewGame() {
  clearGameSave();
  state = createInitialState();
  state.staff.tuan.status = "guide";
  paused = true;
  pauseAnimations("game");
  summaryShown = false;
  if (timerId) clearInterval(timerId);
  render(state);
  persist();
  showGuide();
  startClock();
}

function continueGame() {
  state = normalizeEmploymentState(loadGame() ?? createInitialState());
  state.staff.tuan.status = "idle";
  paused = false;
  resumeAnimations("game");
  summaryShown = false;
  render(state);
  if (state.phase === "summary") openSummary();
  else startClock();
}

function startClock() {
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => tick(1), 1000);
}

function processResults(completed, failed) {
  for (const order of completed) {
    const cashBefore = state.cash;
    if (settleOrder(state, order)) {
      showToast(`${RECIPES[order.recipeId].name} đã thanh toán · +${order.price.toLocaleString("vi-VN")} ₫`);
      setCharacterState("ly", "working", { transient: true });
      if (cashBefore < EMPLOYMENT_CASH_THRESHOLD && state.cash >= EMPLOYMENT_CASH_THRESHOLD && !state.hiredStaffId) {
        showToast("Quán đã đạt 10 triệu! Bạn có thể tuyển một nhân viên.");
      }
    }
    const previousProgress = state.quest.completed;
    recordOrderResult(state, order);
    if (previousProgress < state.quest.goal && state.quest.completed >= state.quest.goal) {
      setCharacterState("tuan", "celebrating", { transient: true });
    }
  }
  for (const order of failed) {
    if (recordOrderResult(state, order)) showToast(`${order.customerName} rời quán · ${order.failureReason}`);
  }
}

function tick(seconds) {
  if (!state || state.phase !== "playing" || paused) return;
  state.secondsLeft = Math.max(0, state.secondsLeft - seconds);
  if (state.secondsLeft === 0) {
    processResults([], closeOrdersAtEnd(state));
    state.phase = "summary";
    persist();
    render(state);
    openSummary();
    return;
  }

  const timedOut = tickCustomers(state, seconds);
  tickPlayerWork(state, seconds);
  const staffEvents = tickStaff(state, seconds);
  processResults(staffEvents.completed, [...timedOut, ...staffEvents.failed]);
  pruneOrders(state);
  persist();
  render(state);
}

function openSummary() {
  summaryShown = true;
  showSummary({
    completed: state.dayStats.completed,
    failed: state.dayStats.failed,
    revenue: state.dayRevenue,
    expenses: state.dayExpenses,
    bonus: state.dayBonus,
    cash: state.cash
  });
}

setupUI({
  onNewGame: startNewGame,
  onContinue: continueGame,
  onGuideFinished: () => {
    paused = false;
    resumeAnimations("game");
    setCharacterState("tuan", "idle", { force: true });
    if (state?.staff.tuan) state.staff.tuan.status = "idle";
    persist();
    render(state);
  },
  onPauseChanged: (value) => {
    paused = value;
    if (value) pauseAnimations("game");
    else resumeAnimations("game");
  },
  onBuyStock: (id) => {
    if (buyIngredientPack(state, id)) {
      persist(); render(state); refreshPanel(); showToast(`Đã nhập ${id === "beans" ? "hạt cà phê" : "nguyên liệu"}.`);
    } else showToast("Tiền mặt chưa đủ cho gói nhập này.");
  },
  onUpgrade: (id) => {
    if (purchaseUpgrade(state, id)) {
      persist(); render(state); refreshPanel(); showToast("Quán mình vừa được nâng cấp!");
    } else showToast("Chưa đủ tiền hoặc nâng cấp đã đạt cấp tối đa.");
  },
  onOrderAction: (orderId) => {
    const order = state.orders.find((item) => item.id === orderId);
    const result = performPlayerOrderAction(state, orderId);
    processResults(result.completed, result.failed);
    persist();
    render(state);
    if (!result.success && !result.failed.length) showToast("Quy trình này đang do nhân viên phụ trách.");
    else if (result.success && order?.status !== "completed") {
      const messages = { barQueue: "Đã nhận đơn. Kiểm tra nguyên liệu xong!", brewing: "Bạn bắt đầu pha món.", serving: "Bạn đang mang món ra bàn." };
      if (messages[order.status]) showToast(messages[order.status]);
    }
  },
  onHireStaff: (staffId) => {
    if (!hireStaff(state, staffId)) {
      showToast("Cần có 10 triệu tiền mặt và chỉ tuyển được một người.");
      return;
    }
    const person = STAFF.find((candidate) => candidate.id === staffId);
    persist(); render(state); refreshPanel();
    showToast(`${person.name} đã gia nhập quán!`);
  },
  onClaimQuest: () => {
    if (claimQuestReward(state)) {
      persist(); render(state); refreshPanel(); showToast(`Đã nhận thưởng ${state.quest.reward.toLocaleString("vi-VN")} ₫.`);
    } else showToast("Hoàn thành mục tiêu trước khi nhận thưởng nhé.");
  },
  onSaveNow: () => { persist(); showToast("Đã lưu tiến trình."); },
  onNextDay: () => {
    if (startNextDay(state)) {
      summaryShown = false; persist(); render(state); startClock();
    }
  }
});

const savedGame = loadGame();
state = normalizeEmploymentState(savedGame ?? createInitialState());
render(state);
pauseAnimations("boot");
bootTimer = setTimeout(() => {
  document.getElementById("boot-screen")?.remove();
  resumeAnimations("boot");
  showWelcome(Boolean(savedGame));
}, 900);

window.addEventListener("pagehide", () => {
  if (timerId) clearInterval(timerId);
  if (bootTimer) clearTimeout(bootTimer);
  if (state) saveGame(state);
  destroyAnimationController();
}, { once: true });