import { INGREDIENTS, RECIPES, SAVE_SCHEMA_VERSION, createInitialState } from "./game-state.js";

export const SAVE_KEY = "neon-brew-cafe-manager";
const ORDER_STATES = new Set(["waiting", "checking", "barQueue", "brewing", "ready", "serving", "served", "payment", "completed", "failed"]);
const STAFF_STATES = new Set(["idle", "guide", "checking", "brewing", "serving", "payment"]);

function validCounter(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;
}

export function validateSave(data) {
  if (!data || typeof data !== "object" || data.schemaVersion !== SAVE_SCHEMA_VERSION) return false;
  if (!Number.isInteger(data.day) || data.day < 1 || data.day > 10000) return false;
  if (![data.cash, data.totalRevenue, data.dayRevenue, data.dayExpenses, data.dayBonus, data.totalBonus].every(validCounter)) return false;
  if (!Number.isFinite(data.secondsLeft) || data.secondsLeft < 0 || data.secondsLeft > 150) return false;
  if (!Array.isArray(data.orders) || data.orders.length > 30) return false;
  if (!data.inventory || !Object.keys(INGREDIENTS).every((id) => Number.isSafeInteger(data.inventory[id]) && data.inventory[id] >= 0 && data.inventory[id] <= 100000)) return false;
  if (!data.upgrades || !["machine", "service"].every((id) => Number.isInteger(data.upgrades[id]) && data.upgrades[id] >= 0 && data.upgrades[id] <= 3)) return false;
  if (data.hiredStaffId !== undefined && data.hiredStaffId !== null && !["nhan", "nam", "thuy", "ly"].includes(data.hiredStaffId)) return false;
  if (data.playerWork !== undefined && data.playerWork !== null && (!data.playerWork || typeof data.playerWork.orderId !== "string" || !["brewing", "serving"].includes(data.playerWork.status) || !Number.isFinite(data.playerWork.workLeft) || data.playerWork.workLeft < 0 || data.playerWork.workLeft > 60)) return false;
  if (!Array.isArray(data.unlockedRecipes) || data.unlockedRecipes.length === 0 || new Set(data.unlockedRecipes).size !== data.unlockedRecipes.length || data.unlockedRecipes.some((id) => !RECIPES[id])) return false;
  if (!data.staff || !["tuan", "nhan", "nam", "thuy", "ly"].every((id) => {
    const person = data.staff[id];
    return person && STAFF_STATES.has(person.status) && (person.orderId === null || typeof person.orderId === "string") && (person.workLeft === undefined || (Number.isFinite(person.workLeft) && person.workLeft >= 0 && person.workLeft <= 60));
  })) return false;
  if (!data.quest || !["completed", "failed", "goal", "reward"].every((key) => Number.isSafeInteger(data.quest[key]) && data.quest[key] >= 0) || typeof data.quest.claimed !== "boolean") return false;
  if (!data.dayStats || !["arrived", "completed", "failed"].every((key) => Number.isSafeInteger(data.dayStats[key]) && data.dayStats[key] >= 0)) return false;
  if (!Number.isInteger(data.nextOrderNumber) || data.nextOrderNumber < 1 || !Number.isInteger(data.rngSeed) || data.rngSeed < 1 || !Number.isFinite(data.customerSpawnIn) || data.customerSpawnIn < 0 || data.customerSpawnIn > 20) return false;
  if (!Number.isSafeInteger(data.reputationTotal) || data.reputationTotal < 0 || !Number.isSafeInteger(data.reputationCount) || data.reputationCount < 1) return false;
  if (!data.orders.every((order) => order && typeof order.id === "string" && order.id.length <= 64 && Number.isInteger(order.number) && order.number > 0 && typeof order.customerName === "string" && order.customerName.length <= 32 && RECIPES[order.recipeId] && ORDER_STATES.has(order.status) && Number.isFinite(order.patience) && order.patience >= 0 && order.patience <= 44 && Number.isSafeInteger(order.price) && order.price > 0 && order.price <= 200000 && typeof order.ingredientsReserved === "boolean" && typeof order.paid === "boolean" && typeof order.questRecorded === "boolean" && typeof order.failureReason === "string" && order.failureReason.length <= 80)) return false;
  if (new Set(data.orders.map((order) => order.id)).size !== data.orders.length) return false;
  if (data.orders.some((order) => (order.status === "completed") !== order.paid)) return false;
  return data.phase === "playing" || data.phase === "summary";
}

export function loadGame(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const raw = target.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!validateSave(parsed)) {
      target.removeItem(SAVE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try { (storage ?? globalThis.localStorage).removeItem(SAVE_KEY); } catch { /* Storage may be disabled. */ }
    return null;
  }
}

export function saveGame(state, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearGameSave(storage) {
  try { (storage ?? globalThis.localStorage).removeItem(SAVE_KEY); } catch { /* Storage may be disabled. */ }
}

export function freshGame() {
  return createInitialState();
}