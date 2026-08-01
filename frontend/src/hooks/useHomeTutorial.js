import { useCallback, useEffect, useState } from "react";

const TUTORIAL_REQUEST_KEY = "grove:home-tutorial-request";
const TUTORIAL_COMPLETE_PREFIX = "grove:home-tutorial-complete:";

function completionKey(userId) {
  return `${TUTORIAL_COMPLETE_PREFIX}${userId}`;
}

/**
 * Call this immediately after a successful login or automatic signup login.
 * The Home page consumes the request after the redirect.
 */
export function queueHomeTutorialAfterLogin() {
  try {
    window.sessionStorage.setItem(TUTORIAL_REQUEST_KEY, "first-login");
  } catch (error) {
    console.error("Unable to queue the Home tutorial:", error);
  }
}

/**
 * Call this from Settings when the user explicitly asks to replay the tour.
 */
export function queueHomeTutorialReplay() {
  try {
    window.sessionStorage.setItem(TUTORIAL_REQUEST_KEY, "replay");
  } catch (error) {
    console.error("Unable to queue the Home tutorial replay:", error);
  }
}

export default function useHomeTutorial(userId, authLoading) {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (authLoading || !userId) return;

    try {
      const request = window.sessionStorage.getItem(TUTORIAL_REQUEST_KEY);

      // A normal refresh or ordinary navigation to Home should not start it.
      if (!request) return;

      // Consume the request so refreshing Home does not restart the tour.
      window.sessionStorage.removeItem(TUTORIAL_REQUEST_KEY);

      const completed =
        window.localStorage.getItem(completionKey(userId)) === "true";

      if (request === "replay" || !completed) {
        setShowTutorial(true);
      }
    } catch (error) {
      console.error("Unable to check the Home tutorial status:", error);
    }
  }, [authLoading, userId]);

  const completeTutorial = useCallback(() => {
    if (userId) {
      try {
        window.localStorage.setItem(completionKey(userId), "true");
      } catch (error) {
        console.error("Unable to save the Home tutorial status:", error);
      }
    }

    setShowTutorial(false);
  }, [userId]);

  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
  }, []);

  return {
    showTutorial,
    completeTutorial,
    closeTutorial,
  };
}
