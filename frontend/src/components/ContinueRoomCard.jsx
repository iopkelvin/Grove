import { Link } from "react-router-dom";
import { DoorOpen } from "lucide-react";

// Renders nothing when there's no last room (never visited one yet, or it's
// since been deleted) — Home just leaves an empty grid slot rather than
// showing a broken/empty card.
export default function ContinueRoomCard({ room }) {
  if (!room) return null;

  return (
    <Link to={`/rooms/${room.id}`} className="card continue-room-card">
      <DoorOpen size={18} />
      <div>
        <p className="continue-room-label">Continue where you left off</p>
        <p className="continue-room-name">{room.name}</p>
      </div>
    </Link>
  );
}
