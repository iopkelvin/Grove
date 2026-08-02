import { useEffect, useState } from "react";

// The tree only grows once a day (a streak can only go up once per calendar
// day — see api/services/streak.py), and it's shown on both Home and
// Profile. Whichever of those two the user opens first after an increase
// "claims" the glow by writing the new streak here immediately, so the
// other page won't show it again for the same increase.
const LAST_SEEN_STREAK_PREFIX = "grove:last-seen-streak:";

function storageKey(userId) {
  return `${LAST_SEEN_STREAK_PREFIX}${userId}`;
}

export default function useStreakLevelUp(userId, streak) {
  const [showGlow, setShowGlow] = useState(false);

  useEffect(() => {
    if (!userId || typeof streak !== "number") return;

    try {
      const key = storageKey(userId);
      const lastSeen = Number(window.localStorage.getItem(key) ?? 0);

      if (streak > lastSeen) {
        setShowGlow(true);
      }
      window.localStorage.setItem(key, String(streak));
    } catch (error) {
      console.error("Unable to check streak level-up status:", error);
    }
  }, [userId, streak]);

  return showGlow;
}
