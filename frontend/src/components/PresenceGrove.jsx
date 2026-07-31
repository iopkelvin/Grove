// Artistic representation of who is in a room.
//
// The plan asks for "a global study room with population count, artistic
// representation of users". Each present member is drawn as a small tree
// whose shape is derived from their own id and streak — the same generator
// the Streaks page uses — so the room reads as a grove of the people in it
// rather than a list of names.
//
// Deterministic placement: a member's position depends only on their id, so
// the grove does not reshuffle every time the poll refreshes.

import { useMemo } from "react";

import { generateTree } from "../utils/treeGenerator";

const ROW_COUNT = 3;

function positionFor(index, total) {
  const row = index % ROW_COUNT;
  const perRow = Math.ceil(total / ROW_COUNT) || 1;
  const column = Math.floor(index / ROW_COUNT);
  return {
    // Back rows sit higher and smaller, which reads as depth without
    // needing any real perspective maths.
    left: `${((column + 0.5) / perRow) * 100}%`,
    bottom: `${row * 26}%`,
    scale: 1 - row * 0.16,
    zIndex: ROW_COUNT - row,
  };
}

function MemberTree({ member, index, total }) {
  const tree = useMemo(
    () => generateTree(member.username, member.current_streak ?? 0),
    [member.username, member.current_streak]
  );
  const position = positionFor(index, total);

  return (
    <div
      className="grove-member"
      style={{
        left: position.left,
        bottom: position.bottom,
        transform: `translateX(-50%) scale(${position.scale})`,
        zIndex: position.zIndex,
      }}
    >
      <svg viewBox={tree.viewBox} className="grove-member-tree" aria-hidden="true">
        {tree.branches.map((d, branchIndex) => (
          <path key={branchIndex} d={d} fill={tree.trunkGradient.mid} />
        ))}
        {tree.leaves.map((leaf, leafIndex) => (
          <ellipse
            key={leafIndex}
            cx={leaf.cx}
            cy={leaf.cy}
            rx={leaf.rx}
            ry={leaf.ry}
            fill={leaf.color}
            opacity={leaf.opacity}
          />
        ))}
      </svg>
      <span className="grove-member-name">{member.display_name || member.username}</span>
    </div>
  );
}

export default function PresenceGrove({ members = [], theme = "grove", emptyMessage }) {
  if (!members.length) {
    return (
      <div className={`grove grove-theme-${theme} grove-empty`}>
        <p>{emptyMessage || "Nobody is here right now. Join to be the first."}</p>
      </div>
    );
  }

  return (
    <div className={`grove grove-theme-${theme}`}>
      {/* The visual is decorative; the same information is in the roster
          list beneath it, which is what a screen reader reads. */}
      {members.map((member, index) => (
        <MemberTree key={member.id} member={member} index={index} total={members.length} />
      ))}
    </div>
  );
}
