// Friends.
//
// Changes beyond the API rewrite:
//
//   * Search is debounced instead of requiring a submit, and it says when it
//     found nothing — an empty result set was previously indistinguishable
//     from not having searched.
//   * Results carry the real friendship status from the server, rather than
//     a local `sentRequestIds` set that forgot everything on reload. Someone
//     you already asked no longer shows an enabled "Add" that fails when
//     clicked.
//   * Sent requests have their own tab and can be cancelled.
//   * Every action reports its failure instead of doing nothing.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Search, UserPlus, X } from "lucide-react";

import {
  getFriends,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
} from "../api/friends";
import { searchUsers } from "../api/users";
import PageLayout from "../components/PageLayout";
import { AsyncBoundary, EmptyState, LoadingState } from "../components/states";
import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";
import { messageFor } from "../lib/apiClient";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 2;

const TABS = [
  { key: "friends", label: "Friends" },
  { key: "incoming", label: "Requests" },
  { key: "sent", label: "Sent" },
];

function nameOf(user) {
  return user.display_name || capitalize(user.username);
}

export default function Friends() {
  const { refreshFriendsSummary } = useUser();

  const [tab, setTab] = useState("friends");
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accepted, waitingOnMe, waitingOnThem] = await Promise.all([
        getFriends({ status: "accepted" }),
        getFriends({ status: "pending", direction: "incoming" }),
        getFriends({ status: "pending", direction: "sent" }),
      ]);
      setFriends(accepted);
      setIncoming(waitingOnMe);
      setSent(waitingOnThem);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced search. Without the delay, typing "kelvin" fires six requests
  // and the answer to "k" can arrive after the answer to "kelvin".
  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setSearched(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const found = await searchUsers(term);
        if (!cancelled) {
          setResults(found);
          setSearched(true);
        }
      } catch (err) {
        if (!cancelled) setActionError(messageFor(err, "Search failed."));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function runAction(action, { refreshSummary = false } = {}) {
    setActionError("");
    try {
      await action();
      await load();
      if (refreshSummary) await refreshFriendsSummary();
      // Keep the search list honest about the new state.
      if (query.trim().length >= MIN_SEARCH_LENGTH) {
        setResults(await searchUsers(query.trim()));
      }
    } catch (err) {
      setActionError(messageFor(err));
    }
  }

  const rows = { friends, incoming, sent }[tab];

  return (
    <PageLayout title="Friends">
      <div className="friends-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search by username or name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search for people"
        />
        {searching && <LoadingState label="Searching" inline />}
      </div>

      {actionError && (
        <p className="auth-error" role="alert">
          {actionError}
        </p>
      )}

      {searched && results.length === 0 && (
        <p className="state-hint">No one matches “{query.trim()}”.</p>
      )}

      {results.length > 0 && (
        <ul className="friends-list friends-results">
          {results.map((user) => (
            <li key={user.id} className="card friends-row">
              <Link to={`/user/${user.username}`}>{nameOf(user)}</Link>
              <AddButton
                user={user}
                onAdd={() =>
                  runAction(() => sendFriendRequest(user.id), { refreshSummary: true })
                }
              />
            </li>
          ))}
        </ul>
      )}

      <div className="friends-tabs" role="tablist" aria-label="Friend lists">
        {TABS.map(({ key, label }) => {
          const count = { friends, incoming, sent }[key].length;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? "friends-tab friends-tab-active" : "friends-tab"}
              onClick={() => setTab(key)}
            >
              {label}
              {count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      <AsyncBoundary
        loading={loading}
        error={error}
        onRetry={load}
        loadingLabel="Loading friends"
        isEmpty={rows.length === 0}
        empty={
          <EmptyState
            title={
              {
                friends: "No friends yet",
                incoming: "No pending requests",
                sent: "You have not asked anyone yet",
              }[tab]
            }
            hint={
              tab === "friends" ? "Search above to find people you study with." : undefined
            }
          />
        }
      >
        <ul className="friends-list">
          {rows.map(({ friendship_id: id, user }) => (
            <li key={id} className="card friends-row">
              <Link to={`/user/${user.username}`}>
                {nameOf(user)}
                {user.is_online && (
                  <span className="friends-online" title="Online now" aria-label="Online now" />
                )}
              </Link>

              <div className="friends-row-actions">
                {tab === "incoming" ? (
                  <>
                    <button
                      type="button"
                      className="friends-accept-button"
                      onClick={() =>
                        runAction(() => respondToFriendRequest(id, "accepted"), {
                          refreshSummary: true,
                        })
                      }
                      aria-label={`Accept ${nameOf(user)}`}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      className="friends-decline-button"
                      onClick={() =>
                        runAction(() => respondToFriendRequest(id, "declined"), {
                          refreshSummary: true,
                        })
                      }
                      aria-label={`Decline ${nameOf(user)}`}
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => runAction(() => removeFriend(id), { refreshSummary: true })}
                  >
                    {tab === "sent" ? "Cancel" : "Remove"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </AsyncBoundary>
    </PageLayout>
  );
}

/** The button's state comes from the server, so it survives a reload. */
function AddButton({ user, onAdd }) {
  const status = user.friendship_status;

  if (status === "accepted") {
    return <span className="friends-status">Friends</span>;
  }
  if (status === "pending") {
    return <span className="friends-status">Requested</span>;
  }

  return (
    <button type="button" className="friends-add-button" onClick={onAdd}>
      <UserPlus size={16} aria-hidden="true" />
      Add
    </button>
  );
}
