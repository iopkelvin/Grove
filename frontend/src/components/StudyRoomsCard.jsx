import { Plus } from "lucide-react";

export default function StudyRoomsCard({ onCreate, creating, className = "" }) {
  return (
    <div className={`card study-rooms-card ${className}`.trim()}>
      <button
        type="button"
        className="study-rooms-create"
        onClick={onCreate}
        disabled={creating}
      >
        <Plus size={16} />
        {creating ? "Creating…" : "New study room"}
      </button>
    </div>
  );
}
