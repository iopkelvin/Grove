import { BookOpen, ExternalLink, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MenuIcon from "../components/MenuIcon";
import { queueHomeTutorialReplay } from "../hooks/useHomeTutorial";

export default function Settings() {
  const navigate = useNavigate();

  function replayHomeTutorial() {
    queueHomeTutorialReplay();
    navigate("/");
  }

  return (
    <div className="page settings-page">
      <MenuIcon />
      <h1 className="page-title">Settings</h1>

      <div className="page-content settings-content">
        <section className="card settings-section">
          <div className="settings-section-heading">
            <BookOpen size={26} aria-hidden="true" />
            <div>
              <h2>Help and guidance</h2>
              <p>Review how Grove works or replay the Home-page walkthrough.</p>
            </div>
          </div>

          <div className="settings-actions">
            <a
              className="settings-action"
              href="/manual.html"
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <strong>Open the app manual</strong>
                <small>Read about tasks, friends, rooms, streaks, and profiles.</small>
              </span>
              <ExternalLink size={20} aria-hidden="true" />
            </a>

            <button
              className="settings-action settings-action-button"
              type="button"
              onClick={replayHomeTutorial}
            >
              <span>
                <strong>Replay the Home tutorial</strong>
                <small>Show the guided popups over the Home dashboard again.</small>
              </span>
              <RotateCcw size={20} aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}   