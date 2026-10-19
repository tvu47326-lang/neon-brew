import { RECIPES } from "./game-state.js";
import { reserveIngredients } from "./inventory-system.js";
import { HIREABLE_STAFF } from "./game-state.js";

const FINAL_STATES = new Set(["completed", "failed"]);

export function getActiveOrders(state) {
  return state.orders.filter((order) => !FINAL_STATES.has(order.status));
}

export function failOrder(state, order, reason) {
  if (!order || FINAL_STATES.has(order.status)) return false;
  order.status = "failed";
  order.failureReason = reason;
  for (const staff of Object.values(state.staff)) {
    if (staff.orderId === order.id) {
      staff.status = "idle";
      staff.orderId = null;
      staff.workLeft = 0;
    }
  }
  if (state.playerWork?.orderId === order.id) state.playerWork = null;
  return true;
}

export function getPlayerOrderAction(state, order) {
  if (!order || state.playerWork) return null;
  const hired = state.hiredStaffId;
  if (order.status === "waiting" && hired !== "nhan") return { type: "receive", label: "Nhận đơn" };
  if (order.status === "barQueue" && hired !== "nam") return { type: "brew", label: "Bắt đầu pha" };
  if (order.status === "ready" && hired !== "thuy") return { type: "serve", label: "Giao món" };
  if (order.status === "served" && hired !== "ly") return { type: "pay", label: "Thu tiền" };
  return null;
}

export function performPlayerOrderAction(state, orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  const action = getPlayerOrderAction(state, order);
  const result = { completed: [], failed: [], success: false };
  if (!action) return result;

  if (action.type === "receive") {
    const reservation = { recipe: RECIPES[order.recipeId], ingredientsReserved: order.ingredientsReserved };
    if (!reserveIngredients(state, reservation)) {
      if (failOrder(state, order, "Thiếu nguyên liệu")) result.failed.push(order);
      return result;
    }
    order.ingredientsReserved = reservation.ingredientsReserved;
    order.status = "barQueue";
  } else if (action.type === "brew") {
    order.status = "brewing";
    state.playerWork = {
      orderId: order.id,
      status: "brewing",
      workLeft: Math.max(2, RECIPES[order.recipeId].prep - state.upgrades.machine)
    };
  } else if (action.type === "serve") {
    order.status = "serving";
    state.playerWork = {
      orderId: order.id,
      status: "serving",
      workLeft: Math.max(1, 2 - state.upgrades.service * 0.25)
    };
  } else if (action.type === "pay") {
    order.status = "completed";
    result.completed.push(order);
  }

  result.success = true;
  return result;
}

export function tickPlayerWork(state, seconds) {
  const work = state.playerWork;
  if (!work) return;
  const order = state.orders.find((item) => item.id === work.orderId);
  if (!order || FINAL_STATES.has(order.status)) {
    state.playerWork = null;
    return;
  }
  work.workLeft = Math.max(0, work.workLeft - seconds);
  if (work.workLeft > 0) return;
  order.status = work.status === "brewing" ? "ready" : "served";
  state.playerWork = null;
}

function assign(state, staffId, order, status, duration) {
  const staff = state.staff[staffId];
  staff.status = status;
  staff.orderId = order.id;
  staff.workLeft = duration;
}

function finishTask(state, staffId, order, nextStatus) {
  const staff = state.staff[staffId];
  staff.status = "idle";
  staff.orderId = null;
  staff.workLeft = 0;
  order.status = nextStatus;
}

function tickWorker(state, staffId, seconds) {
  const staff = state.staff[staffId];
  if (staff.status === "idle") return null;
  const order = state.orders.find((item) => item.id === staff.orderId);
  if (!order || FINAL_STATES.has(order.status)) {
    staff.status = "idle";
    staff.orderId = null;
    staff.workLeft = 0;
    return null;
  }

  staff.workLeft = Math.max(0, staff.workLeft - seconds);
  if (staff.workLeft > 0) return null;

  if (staffId === "nhan") finishTask(state, staffId, order, "barQueue");
  if (staffId === "nam") finishTask(state, staffId, order, "ready");
  if (staffId === "thuy") finishTask(state, staffId, order, "served");
  if (staffId === "ly") {
    order.status = "completed";
    staff.status = "idle";
    staff.orderId = null;
    staff.workLeft = 0;
    return order;
  }
  return null;
}

function assignNext(state, staffId, statuses, targetStatus, durationFor) {
  const staff = state.staff[staffId];
  if (staff.status !== "idle") return;
  const order = state.orders.find((item) => statuses.includes(item.status));
  if (!order) return;
  assign(state, staffId, order, targetStatus, durationFor(order));
  order.status = targetStatus;
}

export function tickStaff(state, seconds) {
  const completed = [];
  const failed = [];
  const hiredStaffId = HIREABLE_STAFF.includes(state.hiredStaffId) ? state.hiredStaffId : null;
  if (!hiredStaffId) return { completed, failed };

  if (hiredStaffId === "ly") {
    const paid = tickWorker(state, "ly", seconds);
    if (paid) completed.push(paid);
  } else {
    tickWorker(state, hiredStaffId, seconds);
  }

  if (hiredStaffId === "nhan" && state.staff.nhan.status === "idle") {
    const order = state.orders.find((item) => item.status === "waiting");
    if (order) {
      const reservation = { recipe: RECIPES[order.recipeId], ingredientsReserved: order.ingredientsReserved };
      if (!reserveIngredients(state, reservation)) {
        if (failOrder(state, order, "Thiếu nguyên liệu")) failed.push(order);
      } else {
        order.ingredientsReserved = reservation.ingredientsReserved;
        assign(state, "nhan", order, "checking", 1);
        order.status = "checking";
      }
    }
  }

  if (hiredStaffId === "nam") assignNext(state, "nam", ["barQueue"], "brewing", (order) => Math.max(2, RECIPES[order.recipeId].prep - state.upgrades.machine));
  if (hiredStaffId === "thuy") assignNext(state, "thuy", ["ready"], "serving", () => Math.max(1, 2 - state.upgrades.service * 0.25));
  if (hiredStaffId === "ly") assignNext(state, "ly", ["served"], "payment", () => 1);
  return { completed, failed };
}

export function closeOrdersAtEnd(state) {
  const failed = [];
  for (const order of state.orders) {
    if (failOrder(state, order, "Hết giờ")) failed.push(order);
  }
  return failed;
}

export function pruneOrders(state) {
  const active = state.orders.filter((order) => !FINAL_STATES.has(order.status));
  const history = state.orders.filter((order) => FINAL_STATES.has(order.status)).slice(-8);
  state.orders = [...history, ...active];
}