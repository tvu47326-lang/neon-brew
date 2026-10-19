import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, RECIPES } from "../js/game-state.js";
import { reserveIngredients } from "../js/inventory-system.js";

test("reserving an order twice only deducts ingredients once", () => {
  const state = createInitialState();
  const order = { recipe: RECIPES["bac-xiu"], ingredientsReserved: false };
  const before = { ...state.inventory };

  assert.equal(reserveIngredients(state, order), true);
  assert.equal(reserveIngredients(state, order), true);
  assert.equal(state.inventory.beans, before.beans - 1);
  assert.equal(state.inventory.milk, before.milk - 2);
});

test("missing one ingredient leaves the entire inventory unchanged", () => {
  const state = createInitialState();
  state.inventory.milk = 0;
  const before = { ...state.inventory };
  const order = { recipe: RECIPES["bac-xiu"], ingredientsReserved: false };

  assert.equal(reserveIngredients(state, order), false);
  assert.deepEqual(state.inventory, before);
  assert.equal(order.ingredientsReserved, false);
});