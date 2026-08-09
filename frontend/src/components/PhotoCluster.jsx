import { useEffect, useId, useState } from "react";
import { X, Images } from "lucide-react";

const STACK_PREVIEW_COUNT = 3;

export default function PhotoCluster({ photos, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const visible = photos.slice(0, STACK_PREVIEW_COUNT);
  const extra = photos.length - visible.length;

  const wheelClass =
    photos.length === 1
      ? " photo-modal-wheel-single"
      : photos.length <= 3
        ? " photo-modal-wheel-fit"
        : "";
  const wheelStyle = photos.length > 1 && photos.length <= 3 ? { gridTemplateColumns: `repeat(${photos.length}, 1fr)` } : undefined;

  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="photo-cluster-trigger"
        onClick={() => setIsOpen(true)}
        aria-label={`View ${photos.length} photos: ${label}`}
      >
        <span className="photo-cluster-stack">
          {visible.map((photo, i) => (
            <span className="photo-cluster-thumb" key={i}>
              {photo.src ? <img src={photo.src} alt="" /> : <Images size={16} strokeWidth={1.75} />}
            </span>
          ))}
        </span>
        {extra > 0 && <span className="photo-cluster-more">+{extra}</span>}
      </button>

      {isOpen && (
        <div className="photo-modal-backdrop" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <div
            className="photo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="photo-modal-close" onClick={() => setIsOpen(false)} aria-label="Close">
              <X size={20} />
            </button>
            <h2 id={titleId} className="photo-modal-title">{label}</h2>
            <div className={`photo-modal-wheel${wheelClass}`} style={wheelStyle}>
              {photos.map((photo, i) => (
                <div className="photo-modal-slide" key={i}>
                  <div className="photo-modal-image">
                    {photo.src ? (
                      <img src={photo.src} alt={photo.alt || ""} />
                    ) : (
                      <div className="photo-modal-placeholder">
                        <Images size={32} strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  {photo.caption && <p className="photo-modal-caption">{photo.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
