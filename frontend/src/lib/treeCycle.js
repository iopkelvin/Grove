const TREE_CYCLE_LENGTH = 100;

export function getTreeCycleLevel(streakCount) {
  const streak = Math.max(0, Number(streakCount) || 0);
  return streak === 0 ? 1 : streak % TREE_CYCLE_LENGTH || TREE_CYCLE_LENGTH;
}
