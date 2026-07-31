// Procedural streak tree.
//
// Everything here is pure functions of (userId, streak) — same inputs
// always produce the same output, no Date.now()/Math.random() anywhere.
// That's what makes the tree feel like "this user's tree" instead of a
// random image that reshuffles on every reload.
//
// Two things are deliberately kept independent of each other:
//   - BRANCH STRUCTURE depends only on (seed, stage). Stage is derived
//     from streak but saturates at 35+ days, so once a user is fully
//     grown the skeleton never changes again — only color/leaf density
//     keep moving (see buildTree/generateTree split below).
//   - COLOR + LEAF DENSITY depend only on (season, seasonProgress), and
//     are layered on top of the structure afterward. This is why a
//     season boundary never resets the tree: the structure-generating
//     RNG calls happen first and are unaffected by season math.

const MIN_DEPTH = 0;
const MAX_DEPTH_CAP = 8; // hard ceiling regardless of stage config, just in case
const MIN_BRANCH_LENGTH = 2;
const MIN_WIDTH = 0.6;

const STAGE_THRESHOLDS = [
  { minStreak: 35, stage: 4, depth: 6, trunkWidth: 17, minLeaves: 3, maxLeaves: 7 },
  { minStreak: 20, stage: 3, depth: 5, trunkWidth: 15, minLeaves: 2, maxLeaves: 5 },
  { minStreak: 10, stage: 2, depth: 4, trunkWidth: 13, minLeaves: 1, maxLeaves: 3 },
  { minStreak: 5, stage: 1, depth: 3, trunkWidth: 11, minLeaves: 0, maxLeaves: 0 },
  { minStreak: 0, stage: 0, depth: 2, trunkWidth: 9, minLeaves: 0, maxLeaves: 0 },
];

const SEASON_PALETTES = [
  ["#A8CC8C", "#C3E0A8", "#8FB86E", "#D4E8B8"], // Spring
  ["#5E7A61", "#4A6350", "#729C5E", "#3D5240"], // Summer
  ["#D9622B", "#E8A33D", "#C44536", "#B8822E"], // Autumn
  ["#8B8378", "#A69B8D", "#6B6459", "#9C9184"], // Winter
];
const SEASON_NAMES = ["spring", "summer", "autumn", "winter"];
const DAYS_PER_SEASON = 30;

const TRUNK_GRADIENT = {
  highlight: "#9C7B54",
  mid: "#6B4F35",
  shadow: "#3E2B1D",
};

// ── Seeded RNG ──────────────────────────────────────────────────────
// FNV-1a style string hash -> 32-bit seed, then mulberry32 for the
// actual stream. Both are tiny, dependency-free, and deterministic.
function hashStringToSeed(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Stage / season lookups ──────────────────────────────────────────
function getStageConfig(streak) {
  const found = STAGE_THRESHOLDS.find((entry) => streak >= entry.minStreak);
  return found || STAGE_THRESHOLDS[STAGE_THRESHOLDS.length - 1];
}

function getSeasonInfo(streak) {
  const seasonIndex = Math.floor(streak / DAYS_PER_SEASON) % 4;
  const dayInSeason = streak % DAYS_PER_SEASON;
  const seasonProgress = dayInSeason / DAYS_PER_SEASON;
  return {
    seasonIndex,
    seasonName: SEASON_NAMES[seasonIndex],
    seasonProgress,
    palette: SEASON_PALETTES[seasonIndex],
  };
}

// ── Geometry helpers ─────────────────────────────────────────────────
function perpendicularUnit(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  return { px: -dy / len, py: dx / len };
}

// Builds one tapered, curved, filled branch segment as an SVG path "d"
// string: two Q curves (one per edge) that share a base and a tip, each
// offset perpendicular to the branch direction by half the width at
// that point. Widening/narrowing along the curve is approximated by
// using the average of base/tip width at the control point — good
// enough for the gentle bends used here.
function taperedBranchPath(x0, y0, x1, y1, cx, cy, baseWidth, tipWidth) {
  const { px, py } = perpendicularUnit(x0, y0, x1, y1);
  const avgWidth = (baseWidth + tipWidth) / 2;

  const baseL = { x: x0 + px * (baseWidth / 2), y: y0 + py * (baseWidth / 2) };
  const baseR = { x: x0 - px * (baseWidth / 2), y: y0 - py * (baseWidth / 2) };
  const tipL = { x: x1 + px * (tipWidth / 2), y: y1 + py * (tipWidth / 2) };
  const tipR = { x: x1 - px * (tipWidth / 2), y: y1 - py * (tipWidth / 2) };
  const ctrlL = { x: cx + px * (avgWidth / 2), y: cy + py * (avgWidth / 2) };
  const ctrlR = { x: cx - px * (avgWidth / 2), y: cy - py * (avgWidth / 2) };

  return [
    `M ${baseL.x.toFixed(2)} ${baseL.y.toFixed(2)}`,
    `Q ${ctrlL.x.toFixed(2)} ${ctrlL.y.toFixed(2)} ${tipL.x.toFixed(2)} ${tipL.y.toFixed(2)}`,
    `L ${tipR.x.toFixed(2)} ${tipR.y.toFixed(2)}`,
    `Q ${ctrlR.x.toFixed(2)} ${ctrlR.y.toFixed(2)} ${baseR.x.toFixed(2)} ${baseR.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

// Recursively draws one branch and (if not at max depth) splits into
// two children, occasionally a third. Two independent base cases keep
// this from ever running away: hitting maxDepth, or the branch getting
// too short/thin to be worth drawing.
function buildBranch(ctx, x0, y0, angle, length, baseWidth, depth) {
  const { rng, maxDepth, paths, tips } = ctx;

  const safeLength = Math.max(length, MIN_BRANCH_LENGTH);
  const safeBaseWidth = Math.max(baseWidth, MIN_WIDTH);
  const tipWidth = Math.max(safeBaseWidth * 0.55, MIN_WIDTH);

  const x1 = x0 + Math.sin(angle) * safeLength;
  const y1 = y0 - Math.cos(angle) * safeLength;

  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const bendPerp = perpendicularUnit(x0, y0, x1, y1);
  const bendJitter = (rng() - 0.5) * safeLength * 0.3;
  const cx = mx + bendPerp.px * bendJitter;
  const cy = my + bendPerp.py * bendJitter;

  paths.push(taperedBranchPath(x0, y0, x1, y1, cx, cy, safeBaseWidth, tipWidth));

  const atMaxDepth = depth >= maxDepth || depth >= MAX_DEPTH_CAP;
  const tooSmallToContinue = safeLength <= MIN_BRANCH_LENGTH * 1.5 || tipWidth <= MIN_WIDTH * 1.2;

  if (atMaxDepth || tooSmallToContinue) {
    tips.push({ x: x1, y: y1, angle });
    return;
  }

  const splitAngle = 0.35 + rng() * 0.28;
  const lengthFactor = 0.66 + rng() * 0.14;
  const widthFactor = 0.6 + rng() * 0.12;
  const nextLength = safeLength * lengthFactor;
  const nextWidth = safeBaseWidth * widthFactor;

  buildBranch(
    ctx,
    x1,
    y1,
    angle - splitAngle * (0.8 + rng() * 0.4),
    nextLength,
    nextWidth,
    depth + 1
  );
  buildBranch(
    ctx,
    x1,
    y1,
    angle + splitAngle * (0.8 + rng() * 0.4),
    nextLength,
    nextWidth,
    depth + 1
  );

  // Occasional third, smaller branch for fuller trees — never at the
  // very first split, so young/sparse trees stay visibly sparse.
  if (depth >= 1 && rng() < 0.3) {
    buildBranch(
      ctx,
      x1,
      y1,
      angle + (rng() - 0.5) * 0.6,
      nextLength * 0.68,
      nextWidth * 0.68,
      depth + 1
    );
  }
}

// Deterministic pool of candidate leaves per tip, then only the first
// N (by seasonProgress) are shown. Same pool every time a given tip is
// rendered — leaves accumulate as the season progresses instead of
// being swapped for a different random set each call.
function buildLeafCluster(tip, rng, palette, seasonProgress, minLeaves, maxLeaves) {
  if (maxLeaves <= 0) return [];

  const pool = [];
  for (let i = 0; i < maxLeaves; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * 5;
    const rx = 2.6 + rng() * 2.6;
    const ry = rx * (0.55 + rng() * 0.3);
    pool.push({
      cx: tip.x + Math.cos(angle) * dist,
      cy: tip.y + Math.sin(angle) * dist,
      rx,
      ry,
      rotation: Math.round(rng() * 360),
      color: palette[Math.floor(rng() * palette.length)],
      opacity: Number((0.55 + rng() * 0.35).toFixed(2)),
    });
  }

  const visibleCount = Math.min(
    maxLeaves,
    Math.max(minLeaves, Math.round(minLeaves + seasonProgress * (maxLeaves - minLeaves)))
  );
  return pool.slice(0, visibleCount);
}

/**
 * generateTree(userId, streak) -> {
 *   viewBox, stage, seasonName, seasonProgress,
 *   trunkGradient, branches: string[], leaves: {...}[],
 *   groundShadow: {...}, rootFlare: {...},
 * }
 *
 * Deterministic: same userId + streak always returns the same shape.
 */
export function generateTree(userId, streak) {
  const safeStreak = Number.isFinite(streak) && streak > 0 ? Math.floor(streak) : 0;
  const seed = hashStringToSeed(String(userId ?? "guest"));
  const rng = mulberry32(seed);

  const stageConfig = getStageConfig(safeStreak);
  const { seasonName, seasonProgress, palette } = getSeasonInfo(safeStreak);

  const width = 200;
  const height = 240;
  const trunkBaseX = width / 2;
  const trunkBaseY = height - 26;

  const paths = [];
  const tips = [];
  const ctx = {
    rng,
    maxDepth: Math.max(MIN_DEPTH, Math.min(stageConfig.depth, MAX_DEPTH_CAP)),
    paths,
    tips,
  };

  const trunkLength = 30 + stageConfig.stage * 3;
  buildBranch(ctx, trunkBaseX, trunkBaseY, 0, trunkLength, stageConfig.trunkWidth, 0);

  const leaves = stageConfig.maxLeaves > 0
    ? tips.flatMap((tip) =>
        buildLeafCluster(tip, rng, palette, seasonProgress, stageConfig.minLeaves, stageConfig.maxLeaves)
      )
    : [];

  return {
    viewBox: `0 0 ${width} ${height}`,
    stage: stageConfig.stage,
    seasonName,
    seasonProgress,
    trunkGradient: TRUNK_GRADIENT,
    branches: paths,
    leaves,
    groundShadow: {
      cx: trunkBaseX,
      cy: trunkBaseY + 10,
      rx: 34 + stageConfig.stage * 2,
      ry: 7,
    },
    rootFlare: {
      cx: trunkBaseX,
      cy: trunkBaseY + 2,
      rx: stageConfig.trunkWidth * 0.9,
      ry: stageConfig.trunkWidth * 0.35,
    },
  };
}
