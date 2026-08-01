import { BookOpen, ExternalLink, RotateCcw } from "lucide-react";
import MenuIcon from "../components/MenuIcon";
import { queueHomeTutorialReplay } from "../hooks/useHomeTutorial";

export default function Settings() {
  const manualPdfUrl = `${import.meta.env.BASE_URL}manual.pdf`;

  function replayHomeTutorial() {
    queueHomeTutorialReplay();
    window.location.assign(import.meta.env.BASE_URL || "/");
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
              <p>
                Read the Grove manual or replay the Home-page tutorial.
              </p>
            </div>
          </div>

          <div className="settings-actions">
            <a
              className="settings-action"
              href={manualPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                <strong>Open the app manual</strong>
                <small>Open the Grove PDF guide in a new tab.</small>
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
                <small>
                  Show the guided Home-page walkthrough again.
                </small>
              </span>

              <RotateCcw size={20} aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}