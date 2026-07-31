import { useMemo } from "react";
import { generateTree } from "../utils/treeGenerator";

export default function StreakTree({ streak = 0, userId }) {
  const tree = useMemo(() => generateTree(userId, streak), [userId, streak]);

  // Unique per user so multiple trees on one page (Home + Profile, or a
  // future friends list) don't fight over the same gradient id.
  const gradientId = useMemo(
    () => `tree-gradient-${String(userId ?? "guest").replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [userId]
  );

  return (
    <div className="streak-column">
      <p>Your Streak:</p>
      <span className="streak-number">{streak}</span>

      <svg
        className="streak-tree-svg"
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
    </div>
  );
}
