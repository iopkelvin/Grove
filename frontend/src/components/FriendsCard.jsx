// "N friends online" on the home page.
//
// Was:
//
//     export default function FriendsCard({ friendsOnline = 0 }) {
//       return <div className="card">{friendsOnline} Friends Online</div>;
//     }
//
// and Home rendered it as <FriendsCard friendsOnline={0} />, so it always
// said zero. It would have said zero even with the real number wired in,
// because `is_online` was a column nothing ever set to true.

import { Link } from "react-router-dom";
import { UserPlus, Users } from "lucide-react";

import { useUser } from "../context/UserContext";

export default function FriendsCard() {
  const { friendsSummary } = useUser();
  const { total, online, pending_incoming: pending } = friendsSummary;

  return (
    <div className="card friends-card">
      <h2 className="card-title">
        <Users size={18} aria-hidden="true" /> Friends
      </h2>

      {total === 0 ? (
        <p className="friends-card-empty">
          No friends yet. <Link to="/friends">Find someone to study with.</Link>
        </p>
      ) : (
        <p className="friends-card-count">
          <strong>{online}</strong> of {total} online
        </p>
      )}

      {pending > 0 && (
        <Link to="/friends" className="friends-card-pending">
          <UserPlus size={16} aria-hidden="true" />
          {pending} request{pending === 1 ? "" : "s"} waiting
        </Link>
      )}
    </div>
  );
}
