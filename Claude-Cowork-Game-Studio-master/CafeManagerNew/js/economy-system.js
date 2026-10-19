import { DAY_LENGTH_SECONDS, EMPLOYMENT_CASH_THRESHOLD, HIREABLE_STAFF } from "./game-state.js";

export const UPGRADE_INFO = {
  machine: { label: "Máy pha cà phê", baseCost: 150000, max: 3 },
  service: { label: "Quy trình phục vụ", baseCost: 100000, max: 3 }
};

export function settleOrder(state, order) {
  if (!order || order.status !== "completed" || order.paid) return false;
  const price = order.price;
  if (!Number.isSafeInteger(price) || price <= 0) return false;
  state.cash += price;
  state.dayRevenue += price;
  state.totalRevenue += price;
  order.paid = true;
  return true;
}

export function purchaseUpgrade(state, upgradeId) {
  const info = UPGRADE_INFO[upgradeId];
  if (!info) return false;
  const level = state.upgrades[upgradeId];
  if (!Number.isInteger(level) || level >= info.max) return false;
  const cost = info.baseCost * (level + 1);
  if (state.cash < cost) return false;
  state.cash -= cost;
  state.dayExpenses += cost;
  state.upgrades[upgradeId] += 1;
  return true;
}

export function getUpgradeCost(state, upgradeId) {
  const info = UPGRADE_INFO[upgradeId];
  const level = state.upgrades[upgradeId];
  return info && level < info.max ? info.baseCost * (level + 1) : null;
}

export function canHireStaff(state) {
  return !HIREABLE_STAFF.includes(state.hiredStaffId) && state.cash >= EMPLOYMENT_CASH_THRESHOLD;
}

export function hireStaff(state, staffId) {
  if (!HIREABLE_STAFF.includes(staffId) || !canHireStaff(state)) return false;
  state.hiredStaffId = staffId;
  state.staff[staffId].status = "idle";
  state.staff[staffId].orderId = null;
  state.staff[staffId].workLeft = 0;
  return true;
}

export function startNextDay(state) {
  if (state.phase !== "summary") return false;
  state.day += 1;
  state.phase = "playing";
  state.secondsLeft = DAY_LENGTH_SECONDS;
  state.dayRevenue = 0;
  state.dayExpenses = 0;
  state.dayBonus = 0;
  state.playerWork = null;
  state.dayStats = { arrived: 0, completed: 0, failed: 0 };
  state.quest = { completed: 0, failed: 0, goal: 5, reward: 60000 + (state.day - 1) * 10000, claimed: false };
  state.nextOrderNumber = 1;
  state.customerSpawnIn = 2;
  for (const person of Object.values(state.staff)) {
    person.status = "idle";
    person.orderId = null;
    person.workLeft = 0;
  }
  return true;
}