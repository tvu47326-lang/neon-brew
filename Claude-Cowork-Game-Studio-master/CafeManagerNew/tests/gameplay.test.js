import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, EMPLOYMENT_CASH_THRESHOLD, RECIPES } from "../js/game-state.js";
import { performPlayerOrderAction, tickPlayerWork, tickStaff } from "../js/order-system.js";
import { canHireStaff, hireStaff, settleOrder } from "../js/economy-system.js";
import { claimQuestReward, recordOrderResult } from "../js/quest-system.js";
import { loadGame, SAVE_KEY, saveGame, validateSave } from "../js/save-system.js";

function addCoffeeOrder(state, number = 1) {
  const recipe = RECIPES["ca-phe-sua"];
  const order = {
    id: `test-${number}`, number, customerName: "Mai", recipeId: "ca-phe-sua",
    price: recipe.price, status: "waiting", patience: 44,
    ingredientsReserved: false, paid: false, questRecorded: false, failureReason: ""
  };
  state.orders.push(order);
  return order;
}

test("the player handles each order stage before hiring and only collects payment once", () => {
  const state = createInitialState();
  const order = addCoffeeOrder(state);
  const beansBefore = state.inventory.beans;
  const startingCash = state.cash;

  tickStaff(state, 1);
  assert.equal(order.status, "waiting");
  assert.equal(state.staff.nhan.status, "idle");
  assert.equal(performPlayerOrderAction(state, order.id).success, true);
  assert.equal(order.status, "barQueue");
  assert.equal(performPlayerOrderAction(state, order.id).success, true);
  for (let second = 0; second < 10 && order.status === "brewing"; second += 1) tickPlayerWork(state, 1);
  assert.equal(order.status, "ready");
  assert.equal(performPlayerOrderAction(state, order.id).success, true);
  for (let second = 0; second < 3 && order.status === "serving"; second += 1) tickPlayerWork(state, 1);
  assert.equal(order.status, "served");
  const completed = performPlayerOrderAction(state, order.id);

  assert.equal(order.status, "completed");
  assert.equal(completed.completed.length, 1);
  assert.equal(state.inventory.beans, beansBefore - 1);
  assert.equal(settleOrder(state, order), true);
  assert.equal(settleOrder(state, order), false);
  assert.equal(state.cash, startingCash + RECIPES["ca-phe-sua"].price);
  assert.equal(state.dayRevenue, RECIPES["ca-phe-sua"].price);
});

test("shortage fails an order without partially deducting its recipe", () => {
  const state = createInitialState();
  state.inventory.beans = 0;
  const before = { ...state.inventory };
  const order = addCoffeeOrder(state);
  const result = performPlayerOrderAction(state, order.id);

  assert.equal(order.status, "failed");
  assert.equal(result.failed.length, 1);
  assert.deepEqual(state.inventory, before);
  assert.equal(recordOrderResult(state, order), true);
  assert.equal(recordOrderResult(state, order), false);
  assert.equal(state.quest.failed, 1);
});

test("one employee can be hired only after reaching ten million", () => {
  const state = createInitialState();
  state.cash = EMPLOYMENT_CASH_THRESHOLD - 1;
  assert.equal(canHireStaff(state), false);
  assert.equal(hireStaff(state, "nam"), false);

  state.cash = EMPLOYMENT_CASH_THRESHOLD;
  assert.equal(canHireStaff(state), true);
  assert.equal(hireStaff(state, "nam"), true);
  assert.equal(state.hiredStaffId, "nam");
  assert.equal(hireStaff(state, "thuy"), false);

  const order = addCoffeeOrder(state);
  order.status = "barQueue";
  order.ingredientsReserved = true;
  tickStaff(state, 1);
  assert.equal(order.status, "brewing");
  assert.equal(state.staff.nam.status, "brewing");
});

test("quest reward can only be claimed once and is not sales revenue", () => {
  const state = createInitialState();
  state.quest.completed = state.quest.goal;
  const revenueBefore = state.dayRevenue;
  const cashBefore = state.cash;

  assert.equal(claimQuestReward(state), true);
  assert.equal(claimQuestReward(state), false);
  assert.equal(state.dayRevenue, revenueBefore);
  assert.equal(state.dayBonus, state.quest.reward);
  assert.equal(state.cash, cashBefore + state.quest.reward);
});

test("valid initial state saves, while malformed data is rejected and removed", () => {
  const state = createInitialState();
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };

  assert.equal(validateSave(state), true);
  assert.equal(saveGame(state, storage), true);
  assert.deepEqual(loadGame(storage), state);
  values.set(SAVE_KEY, JSON.stringify({ ...state, cash: -1 }));
  assert.equal(loadGame(storage), null);
  assert.equal(values.has(SAVE_KEY), false);
});