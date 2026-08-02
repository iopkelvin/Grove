import { Link } from "react-router-dom";
import { Plus, DoorOpen } from "lucide-react";

// lastCreatedRoom is null until the user has hosted at least one room.
export default function StudyRoomsCard({ lastCreatedRoom, onCreate, creating }) {
  return (
    <div className="card study-rooms-card">
      <button
        type="button"
        className="study-rooms-create"
        onClick={onCreate}
        disabled={creating}
      >
        <Plus size={16} />
        {creating ? "Creating…" : "New study room"}
      </button>

      {lastCreatedRoom && (
        <Link to={`/rooms/${lastCreatedRoom.id}`} className="study-rooms-last">
          <DoorOpen size={14} />
          {lastCreatedRoom.name}
        </Link>
      )}
    </div>
  );
}
