export function recordOrderResult(state, order) {
  if (!order || order.questRecorded) return false;
  order.questRecorded = true;
  if (order.status === "completed") {
    state.quest.completed += 1;
    state.dayStats.completed += 1;
    state.reputationTotal += 1;
    state.reputationCount += 1;
    if (state.quest.completed >= 3 && !state.unlockedRecipes.includes("tra-dao")) state.unlockedRecipes.push("tra-dao");
    if (state.quest.completed >= 8 && !state.unlockedRecipes.includes("cacao")) state.unlockedRecipes.push("cacao");
  } else if (order.status === "failed") {
    state.quest.failed += 1;
    state.dayStats.failed += 1;
    state.reputationTotal = Math.max(0, state.reputationTotal - 1);
    state.reputationCount += 1;
  }
  return true;
}

export function claimQuestReward(state) {
  if (state.quest.claimed || state.quest.completed < state.quest.goal) return false;
  state.quest.claimed = true;
  state.cash += state.quest.reward;
  state.dayBonus += state.quest.reward;
  state.totalBonus += state.quest.reward;
  return true;
}

export function getReputation(state) {
  return state.reputationCount > 0 ? Math.round((state.reputationTotal / state.reputationCount) * 100) : 100;
}