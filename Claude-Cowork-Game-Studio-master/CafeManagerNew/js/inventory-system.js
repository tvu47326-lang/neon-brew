import { INGREDIENTS } from "./game-state.js";

export function canMakeDrink(state, recipe) {
  return Object.entries(recipe.ingredients).every(([key, amount]) =>
    Number.isInteger(state.inventory[key]) && state.inventory[key] >= amount
  );
}

export function reserveIngredients(state, order) {
  if (order.ingredientsReserved) return true;
  if (!canMakeDrink(state, order.recipe)) return false;

  for (const [key, amount] of Object.entries(order.recipe.ingredients)) {
    state.inventory[key] -= amount;
  }
  order.ingredientsReserved = true;
  return true;
}

export function buyIngredientPack(state, ingredientId) {
  const item = INGREDIENTS[ingredientId];
  if (!item || state.cash < item.price) return false;

  state.cash -= item.price;
  state.dayExpenses += item.price;
  state.inventory[ingredientId] += item.pack;
  return true;
}