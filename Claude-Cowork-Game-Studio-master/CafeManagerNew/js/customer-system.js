import { RECIPES } from "./game-state.js";
import { failOrder } from "./order-system.js";

const CUSTOMER_NAMES = ["Mai", "An", "Binh", "Ha", "Minh", "Vy", "Khanh", "Linh", "Phuc", "Trang"];

function random(state) {
  state.rngSeed = (state.rngSeed * 48271) % 2147483647;
  return state.rngSeed / 2147483647;
}

export function spawnCustomer(state) {
  const active = state.orders.filter((order) => !["completed", "failed"].includes(order.status));
  if (active.length >= 5) return false;

  const choices = state.unlockedRecipes.filter((id) => RECIPES[id]);
  const recipeId = choices[Math.floor(random(state) * choices.length)];
  const recipe = RECIPES[recipeId];
  const number = state.nextOrderNumber++;
  state.orders.push({
    id: `order-${state.day}-${number}`,
    number,
    customerName: CUSTOMER_NAMES[Math.floor(random(state) * CUSTOMER_NAMES.length)],
    recipeId,
    price: recipe.price,
    status: "waiting",
    patience: 34 + Math.floor(random(state) * 10),
    createdAt: Date.now(),
    ingredientsReserved: false,
    paid: false,
    questRecorded: false,
    failureReason: ""
  });
  state.dayStats.arrived += 1;
  return true;
}

export function tickCustomers(state, seconds) {
  if (state.phase !== "playing") return [];
  state.customerSpawnIn -= seconds;
  if (state.customerSpawnIn <= 0) {
    spawnCustomer(state);
    state.customerSpawnIn = 8 + Math.floor(random(state) * 5);
  }

  const failed = [];
  for (const order of state.orders) {
    if (["completed", "failed"].includes(order.status)) continue;
    order.patience = Math.max(0, order.patience - seconds);
    if (order.patience === 0 && failOrder(state, order, "Khách hết kiên nhẫn")) failed.push(order);
  }
  return failed;
}