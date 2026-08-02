import { useEffect, useState } from "react";
import { Pencil, Move } from "lucide-react";

export default function Banner({ bannerUrl, positionY = 50, onChange, onPositionChange }) {
  const [repositioning, setRepositioning] = useState(false);
  const [previewPosition, setPreviewPosition] = useState(positionY);

  // Keep the local preview in sync if the saved position changes elsewhere
  // (e.g. a fresh profile fetch) while we're not actively dragging it.
  useEffect(() => {
    setPreviewPosition(positionY);
  }, [positionY]);

  const canEdit = Boolean(onChange);

  function commitPosition() {
    if (previewPosition !== positionY) onPositionChange(previewPosition);
  }

  return (
    <div className="banner-wrap">
      <label
        className={onChange ? "banner banner-editable" : "banner"}
        style={{
          backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
          backgroundPosition: `center ${previewPosition}%`,
        }}
      >
        {canEdit && (
          <>
            <input type="file" accept="image/*" hidden onChange={onChange} />
            <span className="banner-edit-icon" aria-hidden="true">
              <Pencil size={16} />
            </span>
          </>
        )}
      </label>

      {/* Separate control from the upload label above — otherwise every
          click here would just reopen the file picker instead of letting
          the existing image be repositioned. */}
      {canEdit && bannerUrl && onPositionChange && (
        <button
          type="button"
          className="banner-reposition-toggle"
          onClick={() => setRepositioning((value) => !value)}
          aria-label="Reposition banner image"
          aria-pressed={repositioning}
        >
          <Move size={16} />
        </button>
      )}

      {repositioning && (
        <input
          type="range"
          min="0"
          max="100"
          value={previewPosition}
          onInput={(e) => setPreviewPosition(Number(e.target.value))}
          onChange={(e) => setPreviewPosition(Number(e.target.value))}
          onMouseUp={commitPosition}
          onTouchEnd={commitPosition}
          onKeyUp={commitPosition}
          className="banner-reposition-slider"
          aria-label="Banner vertical position"
        />
      )}
    </div>
  );
}
