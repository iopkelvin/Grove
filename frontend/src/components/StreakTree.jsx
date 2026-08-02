import { useMemo } from "react";
import { generateTree } from "../utils/treeGenerator";

// compact: just the tree graphic at a small, fixed inline size (e.g. a
// friends-list row) — no "Your Streak" label, doesn't grow to fill the
// Home/Profile frame.
function TreeSvg({ tree, gradientId, className }) {
  return (
    <svg viewBox={tree.viewBox} className={className}>
      <defs>
        <radialGradient id={gradientId} cx="40%" cy="25%" r="75%">
          <stop offset="0%" stopColor={tree.trunkGradient.highlight} />
          <stop offset="55%" stopColor={tree.trunkGradient.mid} />
          <stop offset="100%" stopColor={tree.trunkGradient.shadow} />
        </radialGradient>
      </defs>

      <ellipse
        cx={tree.groundShadow.cx}
        cy={tree.groundShadow.cy}
        rx={tree.groundShadow.rx}
        ry={tree.groundShadow.ry}
        className="streak-tree-ground-shadow"
      />

      <ellipse
        cx={tree.rootFlare.cx}
        cy={tree.rootFlare.cy}
        rx={tree.rootFlare.rx}
        ry={tree.rootFlare.ry}
        fill={`url(#${gradientId})`}
        opacity="0.9"
      />

      {tree.branches.map((d, i) => (
        <path key={`branch-${i}`} d={d} fill={`url(#${gradientId})`} />
      ))}

      {tree.fallenLeaves.map((leaf, i) => (
        <g key={`fallen-${i}`} transform={`translate(${leaf.cx}, ${leaf.cy}) rotate(${leaf.rotation})`}>
          <ellipse cx="0" cy="0" rx={leaf.rx} ry={leaf.ry} fill={leaf.color} opacity={leaf.opacity} />
        </g>
      ))}

      {tree.leaves.map((leaf, i) => (
        <g key={`leaf-${i}`} transform={`translate(${leaf.cx}, ${leaf.cy}) rotate(${leaf.rotation})`}>
          <ellipse cx="0" cy="0" rx={leaf.rx} ry={leaf.ry} fill={leaf.color} opacity={leaf.opacity} />
        </g>
      ))}

      {tree.flowers.map((flower, i) => (
        <g key={`flower-${i}`}>
          <circle cx={flower.cx} cy={flower.cy} r={flower.r} fill={flower.edgeColor} opacity={flower.opacity} />
          <circle
            cx={flower.cx}
            cy={flower.cy}
            r={flower.r * 0.45}
            fill={flower.coreColor}
            opacity={flower.opacity}
          />
        </g>
      ))}

      {tree.snow.map((s, i) => (
        <circle key={`snow-${i}`} cx={s.cx} cy={s.cy} r={s.r} fill={s.color} opacity={s.opacity} />
      ))}
    </svg>
  );
}

export default function StreakTree({ streak = 0, userId = "guest", showLabel = true, compact = false, glow = false }) {
  const tree = useMemo(() => generateTree(userId, streak), [userId, streak]);

  // Unique per user so multiple trees on one page (a friends list full
  // of them) don't fight over the same gradient id.
  const gradientId = useMemo(
    () => `tree-gradient-${String(userId ?? "guest").replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [userId]
  );

  if (compact) {
    return <TreeSvg tree={tree} gradientId={gradientId} className="streak-tree-svg streak-tree-svg-compact" />;
  }

  return (
    <div className={`streak-frame${glow ? " streak-frame-glow" : ""}`}>
      <div className="streak-tree-inner">
        <TreeSvg tree={tree} gradientId={gradientId} className="streak-tree-svg-large" />

        {showLabel && (
          <div className="streak-frame-label">
            <p>Tree Level:</p>
            <span className="streak-number">{streak}</span>
          </div>
        )}
      </div>
    </div>
  );
}