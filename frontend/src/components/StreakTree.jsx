import { useMemo } from "react";
import { generateTree } from "../utils/treeGenerator";

function TreeSvg({ tree, gradientId, className }) {
  return (
    <svg
      className={className}
      viewBox={tree.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Streak tree — stage ${tree.stage}, ${tree.seasonName}`}
    >
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="25%" r="75%">
          <stop offset="0%" stopColor={tree.trunkGradient.highlight} />
          <stop offset="55%" stopColor={tree.trunkGradient.mid} />
          <stop offset="100%" stopColor={tree.trunkGradient.shadow} />
        </radialGradient>
      </defs>

      <ellipse
        className="streak-tree-ground-shadow"
        cx={tree.groundShadow.cx}
        cy={tree.groundShadow.cy}
        rx={tree.groundShadow.rx}
        ry={tree.groundShadow.ry}
      />

      <ellipse
        cx={tree.rootFlare.cx}
        cy={tree.rootFlare.cy}
        rx={tree.rootFlare.rx}
        ry={tree.rootFlare.ry}
        fill={tree.trunkGradient.shadow}
        opacity={0.55}
      />

      {tree.branches.map((d, i) => (
        <path key={i} d={d} fill={`url(#${gradientId})`} />
      ))}

      {tree.leaves.map((leaf, i) => (
        <g key={i} transform={`rotate(${leaf.rotation} ${leaf.cx} ${leaf.cy})`}>
          <ellipse
            cx={leaf.cx}
            cy={leaf.cy}
            rx={leaf.rx}
            ry={leaf.ry}
            fill={leaf.color}
            opacity={leaf.opacity}
          />
        </g>
      ))}
    </svg>
  );
}

// compact: just the tree graphic, sized to sit inline (e.g. a friends-list
// row) instead of the full "Your Streak: N" block used on Home/Profile.
// layout="overlay": tree fills its whole frame at full size, with a small
// "Your Streak: N" label overlaid in the empty space beside the trunk,
// below the canopy — used on Home where the tree fills its own wide grid
// column.
export default function StreakTree({ streak = 0, userId, compact = false, layout = "column" }) {
  const tree = useMemo(() => generateTree(userId, streak), [userId, streak]);

  // Unique per user so multiple trees on one page (Home + Profile, or a
  // friends list full of them) don't fight over the same gradient id.
  const gradientId = useMemo(
    () => `tree-gradient-${String(userId ?? "guest").replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [userId]
  );

  if (compact) {
    return <TreeSvg tree={tree} gradientId={gradientId} className="streak-tree-svg streak-tree-svg-compact" />;
  }

  if (layout === "overlay") {
    return (
      <div className="streak-frame">
        <div className="streak-tree-inner">
          <TreeSvg tree={tree} gradientId={gradientId} className="streak-tree-svg streak-tree-svg-large" />
          <div className="streak-frame-label">
            <p>Your Streak:</p>
            <span className="streak-number">{streak}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="streak-column">
      <p>Your Streak:</p>
      <span className="streak-number">{streak}</span>
      <TreeSvg tree={tree} gradientId={gradientId} className="streak-tree-svg" />
    </div>
  );
}
