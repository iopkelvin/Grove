import { useState, useEffect, useCallback, useMemo } from "react";
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
import StreakTree from "../components/StreakTree";
import { UserPlus, Check, X, UserRound } from "lucide-react";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const PAGE_SIZE = 10;

function displayNameFor(user) {
  return user.display_name || capitalize(user.username);
}

// First/last name if we have them (friends list), otherwise fall back to
// username (search results don't carry first/last name).
function sortKeyFor(user) {
  const name = `${user.first_name || user.username} ${user.last_name || ""}`;
  return name.trim().toLowerCase();
}

function firstLetterOf(user) {
  return sortKeyFor(user).charAt(0).toUpperCase();
}

function addFriendLabel(user, sentRequestIds) {
  if (sentRequestIds.has(user.id) || user.friendship_status === "pending") return "Requested";
  if (user.friendship_status === "accepted") return "Friends";
  return "Add";
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
  const [activeLetter, setActiveLetter] = useState(null);
  const [page, setPage] = useState(1);

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

  const sortedFriends = useMemo(
    () => [...friends].sort((a, b) => sortKeyFor(a.user).localeCompare(sortKeyFor(b.user))),
    [friends]
  );

  const availableLetters = useMemo(
    () => new Set(sortedFriends.map(({ user }) => firstLetterOf(user))),
    [sortedFriends]
  );

  const filteredFriends = useMemo(
    () =>
      activeLetter
        ? sortedFriends.filter(({ user }) => firstLetterOf(user) === activeLetter)
        : sortedFriends,
    [sortedFriends, activeLetter]
  );

  const totalPages = Math.max(1, Math.ceil(filteredFriends.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedFriends = filteredFriends.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleLetterClick(letter) {
    setActiveLetter((prev) => (prev === letter ? null : letter));
    setPage(1);
  }

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
            placeholder="Search by username or name"
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
                  disabled={sentRequestIds.has(user.id) || Boolean(user.friendship_status)}
                >
                  <UserPlus size={16} />
                  {addFriendLabel(user, sentRequestIds)}
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
          <>
            <div className="friends-panel">
              <div className="friends-list">
                {friends.length === 0 && <p>No friends yet — search above to add some.</p>}
                {friends.length > 0 && pagedFriends.length === 0 && (
                  <p>No friends starting with "{activeLetter}".</p>
                )}
                {pagedFriends.map(({ friendship_id, user }) => (
                  <div key={friendship_id} className="card friends-row">
                    <div
                      className="friends-avatar"
                      style={user.avatar_url ? { backgroundImage: `url(${user.avatar_url})` } : undefined}
                    >
                      {!user.avatar_url && <UserRound className="friends-avatar-placeholder-icon" />}
                    </div>
                    <Link to={`/user/${user.username}`}>{displayNameFor(user)}</Link>
                    <StreakTree streak={user.current_streak ?? 0} userId={user.supabase_id} compact />
                    <button type="button" onClick={() => handleRemove(friendship_id)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {friends.length > 0 && (
                <div className="friends-alphabet">
                  <button
                    type="button"
                    className={
                      activeLetter === null
                        ? "friends-letter friends-letter-all friends-letter-active"
                        : "friends-letter friends-letter-all"
                    }
                    onClick={() => handleLetterClick(null)}
                  >
                    All
                  </button>
                  {ALPHABET.map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      className={
                        activeLetter === letter ? "friends-letter friends-letter-active" : "friends-letter"
                      }
                      disabled={!availableLetters.has(letter)}
                      onClick={() => handleLetterClick(letter)}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="friends-pagination">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  Prev
                </button>
                <span>
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
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
