import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";
import {
  searchUsers,
  getFriends,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
} from "../api/friends";
import MenuIcon from "../components/MenuIcon";
import { UserPlus, Check, X } from "lucide-react";

function displayNameFor(user) {
  return user.display_name || capitalize(user.username);
}

function Friends() {
  const { session, loading, refreshPendingRequests } = useUser();
  const supabaseId = session?.user?.id;

  const [tab, setTab] = useState("friends");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sentRequestIds, setSentRequestIds] = useState(new Set());
  const [error, setError] = useState("");

  const loadFriends = useCallback(async () => {
    if (!supabaseId) return;
    setFriends(await getFriends(supabaseId, { status: "accepted" }));
  }, [supabaseId]);

  const loadRequests = useCallback(async () => {
    if (!supabaseId) return;
    setRequests(await getFriends(supabaseId, { status: "pending" }));
  }, [supabaseId]);

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, [loadFriends, loadRequests]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      setResults(await searchUsers(query.trim(), supabaseId));
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(targetUserId) {
    setError("");
    const res = await sendFriendRequest(supabaseId, targetUserId);
    if (res.ok) {
      setSentRequestIds((prev) => new Set(prev).add(targetUserId));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to send friend request.");
    }
  }

  async function handleRespond(friendshipId, status) {
    const res = await respondToFriendRequest(friendshipId, supabaseId, status);
    if (res.ok) {
      await loadRequests();
      await refreshPendingRequests();
      if (status === "accepted") await loadFriends();
    }
  }

  async function handleRemove(friendshipId) {
    const res = await removeFriend(friendshipId, supabaseId);
    if (res.ok) {
      await loadFriends();
    }
  }

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  return (
    <div className="page">
      <MenuIcon />
      <div className="page-content">
        <h1 className="page-title">Friends</h1>

        <form onSubmit={handleSearch} className="friends-search">
          <input
            type="text"
            placeholder="Search by username"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={searching}>
            Search
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}

        {results.length > 0 && (
          <div className="friends-list">
            {results.map((user) => (
              <div key={user.id} className="card friends-row">
                <Link to={`/user/${user.username}`}>{displayNameFor(user)}</Link>
                <button
                  type="button"
                  className="friends-add-button"
                  onClick={() => handleSendRequest(user.id)}
                  disabled={sentRequestIds.has(user.id)}
                >
                  <UserPlus size={16} />
                  {sentRequestIds.has(user.id) ? "Requested" : "Add"}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="friends-tabs">
          <button
            type="button"
            className={tab === "friends" ? "friends-tab friends-tab-active" : "friends-tab"}
            onClick={() => setTab("friends")}
          >
            Friends ({friends.length})
          </button>
          <button
            type="button"
            className={tab === "requests" ? "friends-tab friends-tab-active" : "friends-tab"}
            onClick={() => setTab("requests")}
          >
            Requests{requests.length > 0 ? ` (${requests.length})` : ""}
          </button>
        </div>

        {tab === "friends" && (
          <div className="friends-list">
            {friends.length === 0 && <p>No friends yet — search above to add some.</p>}
            {friends.map(({ friendship_id, user }) => (
              <div key={friendship_id} className="card friends-row">
                <Link to={`/user/${user.username}`}>{displayNameFor(user)}</Link>
                <button type="button" onClick={() => handleRemove(friendship_id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "requests" && (
          <div className="friends-list">
            {requests.length === 0 && <p>No pending requests.</p>}
            {requests.map(({ friendship_id, user }) => (
              <div key={friendship_id} className="card friends-row">
                <Link to={`/user/${user.username}`}>{displayNameFor(user)}</Link>
                <div className="friends-row-actions">
                  <button
                    type="button"
                    className="friends-accept-button"
                    onClick={() => handleRespond(friendship_id, "accepted")}
                    aria-label="Accept"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    className="friends-decline-button"
                    onClick={() => handleRespond(friendship_id, "declined")}
                    aria-label="Decline"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Friends;
