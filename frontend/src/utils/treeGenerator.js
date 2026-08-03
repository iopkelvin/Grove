// Procedural streak tree.
//
// GROWTH MODEL (linear, two phases):
//   Phase 1 (streak 1–20): structural growth, interpolated smoothly.
//     No leaves yet. By streak === 20 the skeleton is final and frozen.
//   Phase 2 (streak 21+): skeleton frozen. Only color, leaves, flowers,
//     fallen leaves, and snow keep changing, on a repeating 80-day
//     cycle (4 seasons x 20 days), continuously interpolated so every
//     day looks slightly different from the last.
//
// SIZING: the frame is fixed at "0 0 200 200". Growth is tuned so a
// FULLY MATURE tree (streak >= 20) naturally reaches near the frame's
// edges on its own — we do NOT scale trees up to fill the frame, ever.
// A safety scale factor is applied but capped at 1.0, so it can only
// shrink an unusually wide/tall seed back down to fit; it can never
// enlarge a small tree.

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function hexToRgb(hex) {
  const c = hex.replace("#", "");
  return { r: parseInt(c.slice(0, 2), 16), g: parseInt(c.slice(2, 4), 16), b: parseInt(c.slice(4, 6), 16) };
}
function rgbToHex(r, g, b) {
  const h = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t));
}

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

const MIN_DEPTH = 2;
const MAX_DEPTH_CAP = 7;
const MIN_BRANCH_LENGTH = 2;
const MIN_WIDTH = 0.6;

const TRUNK_GRADIENT = { highlight: "#9C7B54", mid: "#6B4F35", shadow: "#3E2B1D" };

const PALETTE = {
  springLeafA: "#A8CC8C",
  springLeafB: "#8FB86E",
  summerLeafA: "#5E7A61",
  summerLeafB: "#4A6350",
  fallLeafA: "#E8A33D",
  fallLeafB: "#C44536",
  flowerCore: "#FFFFFF",
  flowerEdge: "#F4A6C8",
  fruit: "#D9622B",
  snow: "#FBFBFF",
};

function perpendicularUnit(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  return { px: -dy / len, py: dx / len };
}

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

function buildBranch(ctx, x0, y0, angle, length, baseWidth, depth) {
  const { rng, maxDepth, paths, tips } = ctx;
  const safeLength = Math.max(length, MIN_BRANCH_LENGTH);
  const safeBaseWidth = Math.max(baseWidth, MIN_WIDTH);
  const tipWidth = Math.max(safeBaseWidth * 0.58, MIN_WIDTH);

  const x1 = x0 + Math.sin(angle) * safeLength;
  const y1 = y0 - Math.cos(angle) * safeLength;

  ctx.minY = Math.min(ctx.minY, y1);
  ctx.minX = Math.min(ctx.minX, x1);
  ctx.maxX = Math.max(ctx.maxX, x1);

  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const bendPerp = perpendicularUnit(x0, y0, x1, y1);
  const bendJitter = (rng() - 0.5) * safeLength * 0.28;
  const cx = mx + bendPerp.px * bendJitter, cy = my + bendPerp.py * bendJitter;

  paths.push(taperedBranchPath(x0, y0, x1, y1, cx, cy, safeBaseWidth, tipWidth));

  const atMaxDepth = depth >= maxDepth || depth >= MAX_DEPTH_CAP;
  const tooSmall = safeLength <= MIN_BRANCH_LENGTH * 1.5 || tipWidth <= MIN_WIDTH * 1.2;
  if (atMaxDepth || tooSmall) {
    tips.push({ x: x1, y: y1, angle });
    return;
  }

  const splitAngle = 0.24 + rng() * 0.18; // narrower spread — less wide canopy
  const lengthFactor = 0.76 + rng() * 0.08; // slightly longer reach — more vertical growth
  const widthFactor = 0.62 + rng() * 0.1;
  const nextLength = safeLength * lengthFactor;
  const nextWidth = safeBaseWidth * widthFactor;

  buildBranch(ctx, x1, y1, angle - splitAngle * (0.8 + rng() * 0.4), nextLength, nextWidth, depth + 1);
  buildBranch(ctx, x1, y1, angle + splitAngle * (0.8 + rng() * 0.4), nextLength, nextWidth, depth + 1);
  if (depth >= 1 && rng() < 0.35) {
    buildBranch(ctx, x1, y1, angle + (rng() - 0.5) * 0.55, nextLength * 0.72, nextWidth * 0.72, depth + 1);
  }
}

function getGrowthConfig(streak) {
  const growthProgress = clamp(streak / 20, 0, 1);
  return {
    growthProgress,
    depth: Math.round(lerp(MIN_DEPTH, 7, growthProgress)),
    trunkWidth: lerp(6, 19, growthProgress),
    trunkLength: lerp(12, 54, growthProgress),
  };
}

// Standalone export so callers that only need the season name (e.g. tinting
// the mini calendar's selected day) don't have to run the full tree
// generation for it.
export function getTreeSeason(streak) {
  return getSeasonState(streak).seasonName;
}

function getSeasonState(streak) {
  if (streak < 21) return { seasonIndex: -1, seasonName: "none", progressInSeason: 0 };
  const cycleStreak = streak - 21;
  const cyclePosition = cycleStreak % 80;
  const seasonIndex = Math.floor(cyclePosition / 20);
  const progressInSeason = (cyclePosition % 20) / 20;
  const names = ["spring", "summer", "fall", "winter"];
  return { seasonIndex, seasonName: names[seasonIndex], progressInSeason };
}

function makeFoliagePuff(tip, rng, color, radiusRange, count, opacityBase) {
  const shapes = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * 7;
    const r = radiusRange[0] + rng() * (radiusRange[1] - radiusRange[0]);
    shapes.push({
      cx: tip.x + Math.cos(angle) * dist,
      cy: tip.y + Math.sin(angle) * dist * 0.8,
      rx: r,
      ry: r * (0.75 + rng() * 0.2),
      rotation: Math.round(rng() * 360),
      color,
      opacity: Number((opacityBase + rng() * 0.2).toFixed(2)),
    });
  }
  return shapes;
}

function makeFlower(tip, rng, size, opacity) {
  const angle = rng() * Math.PI * 2;
  const dist = rng() * 6;
  return {
    cx: tip.x + Math.cos(angle) * dist,
    cy: tip.y + Math.sin(angle) * dist * 0.8,
    r: size,
    coreColor: PALETTE.flowerCore,
    edgeColor: PALETTE.flowerEdge,
    opacity,
  };
}

function makeFallenLeaf(rng, color, spreadRadius) {
  const angle = rng() * Math.PI * 2;
  const dist = rng() * spreadRadius;
  return {
    dx: Math.cos(angle) * dist,
    dy: Math.abs(Math.sin(angle)) * (spreadRadius * 0.22),
    rx: 3 + rng() * 2.6,
    ry: 1.6 + rng() * 1.4,
    rotation: Math.round(rng() * 360),
    color,
    opacity: Number((0.75 + rng() * 0.2).toFixed(2)),
  };
}

function makeSnowBlob(tip, rng, size, opacity) {
  const angle = rng() * Math.PI * 2;
  const dist = rng() * 5;
  return {
    cx: tip.x + Math.cos(angle) * dist,
    cy: tip.y + Math.sin(angle) * dist * 0.6 - size * 0.4,
    r: size,
    color: PALETTE.snow,
    opacity,
  };
}

function buildSeasonalShapes(tips, rng, seasonIndex, progressInSeason, trunkBaseX, trunkBaseY) {
  const leaves = [];
  const flowers = [];
  const fallenLeaves = [];
  const snow = [];

  if (seasonIndex === -1 || tips.length === 0) {
    return { leaves, flowers, fallenLeaves, snow };
  }

  const FULL_PUFF_COUNT = 6;
  const FULL_PUFF_RADIUS = [4, 8];

  tips.forEach((tip) => {
    if (seasonIndex === 0) {
      const leafColor = lerpColor(PALETTE.springLeafA, PALETTE.springLeafB, progressInSeason);
      const puffCount = Math.round(lerp(1, FULL_PUFF_COUNT, progressInSeason));
      leaves.push(...makeFoliagePuff(tip, rng, leafColor, FULL_PUFF_RADIUS, puffCount, 0.65));

      const flowerCount = Math.round(lerp(0, 4, progressInSeason));
      const bloomSize = lerp(0.8, 3.2, progressInSeason);
      for (let i = 0; i < flowerCount; i++) {
        flowers.push(makeFlower(tip, rng, bloomSize * (0.7 + rng() * 0.5), 0.85 + rng() * 0.15));
      }
    }

    if (seasonIndex === 1) {
      const leafColor = lerpColor(PALETTE.summerLeafA, PALETTE.summerLeafB, progressInSeason);
      leaves.push(...makeFoliagePuff(tip, rng, leafColor, FULL_PUFF_RADIUS, FULL_PUFF_COUNT, 0.75));

      const flowerFadeT = clamp(1 - progressInSeason / 0.25, 0, 1);
      if (rng() < flowerFadeT * 0.5) {
        flowers.push(makeFlower(tip, rng, 2.6, flowerFadeT));
      }
      if (progressInSeason > 0.4 && rng() < 0.35) {
        flowers.push({ ...makeFlower(tip, rng, 2.2, 0.9), coreColor: PALETTE.fruit, edgeColor: PALETTE.fruit });
      }
    }

    if (seasonIndex === 2) {
      const leafColor = lerpColor(PALETTE.fallLeafA, PALETTE.fallLeafB, progressInSeason);
      const onTreeT = clamp(1 - progressInSeason, 0, 1);
      const puffCount = Math.round(FULL_PUFF_COUNT * onTreeT);
      if (puffCount > 0) {
        leaves.push(...makeFoliagePuff(tip, rng, leafColor, FULL_PUFF_RADIUS, puffCount, 0.7));
      }
      const droppedPerTip = Math.round((FULL_PUFF_COUNT - puffCount) * 1.4);
      for (let i = 0; i < droppedPerTip; i++) {
        fallenLeaves.push(makeFallenLeaf(rng, leafColor, 50));
      }
    }

    if (seasonIndex === 3) {
      const leftoverT = clamp(1 - progressInSeason / 0.15, 0, 1);
      if (leftoverT > 0) {
        const puffCount = Math.round(FULL_PUFF_COUNT * 0.2 * leftoverT);
        leaves.push(...makeFoliagePuff(tip, rng, PALETTE.fallLeafB, FULL_PUFF_RADIUS, puffCount, leftoverT * 0.6));
      }
      const snowCount = Math.round(lerp(0, 5, progressInSeason));
      const snowSize = lerp(2, 6, progressInSeason);
      for (let i = 0; i < snowCount; i++) {
        snow.push(makeSnowBlob(tip, rng, snowSize * (0.7 + rng() * 0.4), 0.8 + rng() * 0.2));
      }
    }
  });

  const resolvedFallen = fallenLeaves.map((leaf) => ({
    ...leaf,
    cx: trunkBaseX + leaf.dx,
    cy: trunkBaseY + leaf.dy,
  }));

  if (seasonIndex === 3 && progressInSeason > 0.1) {
    const groundSnowT = clamp((progressInSeason - 0.1) / 0.9, 0, 1);
    const rng2 = rng;
    const count = Math.round(lerp(0, 14, groundSnowT));
    for (let i = 0; i < count; i++) {
      const dx = (rng2() - 0.5) * 60;
      const dy = rng2() * 10;
      snow.push({
        cx: trunkBaseX + dx,
        cy: trunkBaseY + dy,
        r: 2.5 + rng2() * 2.5,
        color: PALETTE.snow,
        opacity: Number((0.7 + rng2() * 0.25).toFixed(2)),
      });
    }
  }

  return { leaves, flowers, fallenLeaves: resolvedFallen, snow };
}

export function generateTree(userId, streak) {
  const safeStreak = Number.isFinite(streak) && streak > 0 ? Math.floor(streak) : 0;
  const seed = hashStringToSeed(String(userId ?? "guest"));
  const rng = mulberry32(seed);

  const growth = getGrowthConfig(Math.min(safeStreak, 20));
  const season = getSeasonState(safeStreak);

  const width = 200;
  const height = 200;
  const trunkBaseX = width / 2;
  const trunkBaseY = height - 22;

  const topCrop = 14;

  const paths = [];
  const tips = [];
  const ctx = {
    rng,
    maxDepth: clamp(growth.depth, MIN_DEPTH, MAX_DEPTH_CAP),
    paths,
    tips,
    minY: trunkBaseY,
    minX: trunkBaseX,
    maxX: trunkBaseX,
  };

  buildBranch(ctx, trunkBaseX, trunkBaseY, 0, growth.trunkLength, growth.trunkWidth, 0);

  const safeMarginX = 10;
  const safeMarginTop = 16;
  const halfWidthNeeded = Math.max(trunkBaseX - ctx.minX, ctx.maxX - trunkBaseX, 1);
  const heightNeeded = Math.max(trunkBaseY - ctx.minY, 1);
  const availableHalfWidth = trunkBaseX - safeMarginX;
  const availableHeight = trunkBaseY - safeMarginTop;
  const scale = Math.min(1, availableHalfWidth / halfWidthNeeded, availableHeight / heightNeeded);

  function scalePoint(x, y) {
    return {
      x: trunkBaseX + (x - trunkBaseX) * scale,
      y: trunkBaseY - (trunkBaseY - y) * scale,
    };
  }

  const scaledPaths = paths.map((d) =>
    d.replace(/(-?\d+\.\d+) (-?\d+\.\d+)/g, (_, xStr, yStr) => {
      const { x, y } = scalePoint(parseFloat(xStr), parseFloat(yStr));
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    })
  );
  const scaledTips = tips.map((tip) => {
    const { x, y } = scalePoint(tip.x, tip.y);
    return { ...tip, x, y };
  });

  const { leaves, flowers, fallenLeaves, snow } = buildSeasonalShapes(
    scaledTips,
    rng,
    season.seasonIndex,
    season.progressInSeason,
    trunkBaseX,
    trunkBaseY
  );

  return {
    viewBox: `0 ${topCrop} ${width} ${height - topCrop}`,
    growthProgress: growth.growthProgress,
    seasonName: season.seasonName,
    progressInSeason: season.progressInSeason,
    trunkGradient: TRUNK_GRADIENT,
    trunkBaseY,
    branches: scaledPaths,
    leaves,
    flowers,
    fallenLeaves,
    snow,
    groundShadow: { cx: trunkBaseX, cy: trunkBaseY + 10, rx: 30 + growth.growthProgress * 14, ry: 7 },
    rootFlare: {
      cx: trunkBaseX,
      cy: trunkBaseY + 2,
      rx: growth.trunkWidth * 0.9 * scale,
      ry: growth.trunkWidth * 0.35 * scale,
    },
  };
}