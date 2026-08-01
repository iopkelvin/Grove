# Grove — Development Plan

**Updated:** 31 July 2026
**Supersedes:** the Milestone 3 plan in *Planning Development for Grove.xlsx*

This is an update to that plan, not a replacement. Every row from the
spreadsheet appears below with its status re-checked against the code as it
actually stands, plus the work that turned out to be necessary once we
started looking.

> **How this is being landed.** The hardening work is split across two pull
> requests against `development`. The **backend** one — `api/`, tests,
> migrations, CI, containers and these documents — is self-contained and
> conflicts with nothing except the two files noted below. The **frontend**
> rewrite follows separately, because it overlaps with pages Turner and
> Kelvin have rebuilt on `development` in the meantime and that overlap
> needs their eyes, not a merge-conflict resolution by whoever gets there
> first. Rows below marked *(frontend PR)* are therefore complete but not
> yet on `development`.

Ownership from the spreadsheet is preserved. Where a row's owner has
changed, or where a newly discovered item has no owner yet, it says
**proposed** — those need confirming at Monday's standup rather than being
assumed.

---

## Status at a glance

| | Front end | Back end | Other |
|---|---:|---:|---:|
| Complete | 11 | 15 | 2 |
| Remaining | 1 | 1 | 2 |
| Out of scope this milestone | 1 | 1 | — |

**Everything the plan marked "In Progress" is now done**, along with four
items that had no status at all. Two rows are deliberately unfinished and
one is deferred; all three are listed with reasons.

---

## Front end

| Item | Plan status | Now | Owner | Notes |
|---|---|---|---|---|
| Main page | In Progress | **Complete** | Kelvin | Every card on it was a placeholder — `FriendsCard` hard-coded to "0 Friends Online", `UpNextCard` whose body was the text "Up Next Card", a `TaskList` rendered with no props. All now load real data with their own loading, empty and error states. |
| Sign up, Login, Log out | Complete | **Complete** | Kelvin | Reworked: signup used to navigate into the app even when creating the Grove account failed, leaving users on pages that said "User not found" with no way to recover. |
| Tasks Page | Complete | **Complete** | Kyle | Added filters, due dates, tags, optimistic toggling and a delete confirmation. Failures are now visible — every handler was `if (res.ok)` with no else. |
| Menu Bar | Complete | **Complete** | Kelvin | Focus trap, scroll lock, correct active-item highlighting. It linked to four routes that did not exist. |
| Profile and User | Complete | **Complete** | Kelvin | Fixed a crash when viewing a public profile signed out, and the file-picker that appeared on *other people's* photos. |
| Lobby Page | In Progress | **Complete** | Turner | The file was 0 bytes. Global room, live population, members drawn as a grove of streak-sized trees. |
| Rooms Page | In Progress | **Complete** | Turner | Create, join, leave, close; themes and capacity. |
| Streaks Page | In Progress | **Complete** | Kelvin | The file was 0 bytes. Current and longest run, active days, 13-week heatmap. |
| Friends Page | Complete | **Complete** | Kelvin | Debounced search, a Sent tab, and request state that comes from the server so it survives a reload. |
| Settings Page | *(no status)* | **Complete** | Aatish | The file was 0 bytes. Theme, presence visibility, account facts. |
| Dark Mode | *(no status)* | **Complete** | Kyle | Three-way choice including "match my system". |
| 404 / error boundary | *(not on the plan)* | **Complete** | Ameya | Newly discovered — see below. |
| Calendar Page | In Progress | **Deferred** | Aatish | Out of scope for this milestone. See [Deferred](#deferred). |

## Back end

| Item | Plan status | Now | Owner | Notes |
|---|---|---|---|---|
| App structure outline | Complete | **Complete** | Kelvin | Restructured: `app.py` was 460 lines holding the entire backend. |
| API Routing | Complete | **Complete** | Kelvin | One blueprint per resource. Four routes had `pass` bodies and returned 500. |
| Theme and Shared CSS | Complete | **Complete** | Kelvin | Token set widened to spacing, radius and shadow; dark theme layered on top. |
| JS file (Main) | Complete | **Complete** | Kelvin | Superseded by `lib/apiClient`. |
| **Services** | *(no status)* | **Complete** | Kelvin, Kyle, Turner, Ameya, Aatish | The plan's largest core item, six hours estimated. All five files contained a single comment line with a name in it. |
| Tree Component | In Progress | **Complete** | Kelvin | Unchanged logic; now covered by 14 tests pinning its determinism. |
| Tasks Component | *(no status)* | **Complete** | Kyle, Kelvin | |
| Data models | Complete | **Complete** | Kyle, Ameya, Kelvin | Extended: presence, streak history, due dates, room themes. One migration. |
| Database | Complete | **Complete** | Kyle, Kelvin | |
| Front end / back end hosting | Complete | **Complete** | Kelvin | |
| Database hosting and auth | Complete | **Complete** | Kelvin | |
| **Testing (10)** | In Progress | **Complete** | Kelvin | 245 backend tests. The four files in `tests/` were empty. |
| **Testing edge cases (5)** | In Progress | **Complete** | Kelvin | 32, marked `@pytest.mark.edge`. |
| Uploading Pictures | Complete | **Complete** | Kelvin | Added size and type checks; a 40MB photo used to upload in full before failing. |
| Lint check GitHub workflow | Complete | **Superseded** | Kelvin | Replaced by four workflows — see below. |
| Authentication | Complete | **Rewritten** | Kelvin, Ameya | Marked complete but was not: identity came from a request parameter anybody could read. See [Blockers resolved](#blockers-resolved). |
| Processing and Async | In Progress | **Complete** | Kelvin, Turner | `api/workers/queue.py` was a single comment. |

## Other

| Item | Plan status | Now | Owner |
|---|---|---|---|
| **User manual** | *(no status)* | **Complete** | Aatish, Turner |
| Testing report | *(not on the plan)* | **Complete** | Ameya |
| Updated development plan | *(not on the plan)* | **Complete** (this file) | Ameya |
| Deployment verification | *(not on the plan)* | **Remaining** | Kelvin |
| AI tool-use form | *(rubric item)* | **Remaining** | everyone |

---

## Newly discovered work

None of this was on the Milestone 3 plan. It was found by working through
the code rather than by planning, which is why it is recorded separately.

| # | Item | Why it was needed | Status | Owner |
|---|---|---|---|---|
| N-1 | Verify Supabase JWTs | Authentication was marked complete but did not exist. Any user could read and modify any other user's data. | **Done** | Ameya |
| N-2 | JSON error handling | A JSON API returning HTML error pages breaks every client: `res.json()` throws while parsing the error. | **Done** | Ameya |
| N-3 | Structured logging with request ids | No logging at all. "It broke when I clicked save" was unreconstructable. | **Done** | Ameya |
| N-4 | Input validation layer | Length was never checked, so a long title reached the column and 500'd. | **Done** | Ameya |
| N-5 | Loading / empty / error states | The rubric asks for them; what existed was the string "Loading..." on five pages and nothing for error. | **Done** | Ameya |
| N-6 | Route guards, 404 page, error boundary | Four menu links went nowhere; a render error was a blank white page. | **Done** | Ameya |
| N-7 | Paging on list endpoints | Every list returned every row. | **Done** | Ameya |
| N-8 | Presence that works | `is_online` was a column nothing ever set to true, so everyone was permanently offline. | **Done** | Ameya |
| N-9 | Real Dockerfiles | All three contained one comment line and could not build. | **Done** | Ameya |
| N-10 | Backend and frontend CI | The only workflow linted CSS. A PR could break every endpoint and show green. | **Done** | Ameya |
| N-11 | SQLite bootstrap vs. migrations | `create_all()` on boot made `flask db upgrade` impossible against SQLite. Found by writing the CI migration job. | **Done** | Ameya |
| N-12 | Frontend test tooling | There was none. | **Done** | Ameya |

---

## Blockers resolved

**Authentication was not implemented.** The plan marked it Complete. In
fact, every endpoint took the caller's identity from a `supabase_id`
parameter in the request — a value that is not secret, is returned by the
public profile endpoint, and is visible in the browser's network tab.
Anybody holding one could read another user's tasks, rewrite their profile,
delete their data, or accept friend requests on their behalf.

This blocked everything downstream: no per-user feature could be considered
finished, and the rubric's "supports account creation, login, logout, and
user-specific data" could not honestly be ticked. Resolved by verifying the
Supabase JWT and taking identity from the verified `sub` claim. Production
now refuses to start without the signing secret.

**Four routes returned 500.** `/api/rooms`, `/api/rooms/<id>`,
`/api/streaks/<user_id>` and `/api/calendar` had `pass` bodies. A Flask view
returning `None` raises. Three are implemented; calendar returns a
documented 501.

**Four page files were empty.** `Streaks.jsx`, `Lobby.jsx`, `Room.jsx` and
`Settings.jsx` were 0 bytes and the menu linked to routes that were never
registered. All four are built.

**The app could not be tested.** `app.py` built its Flask object at import
time against whatever `DATABASE_URL` was in the environment, so the
application could not be constructed twice — which is the real reason the
repo had no tests. The application factory unblocked all 353 of them.

---

## Blockers still open

| Blocker | Impact | Who can clear it |
|---|---|---|
| **`SUPABASE_JWT_SECRET` is not set on Render.** | The deployed backend will now refuse to boot in production without it. Someone with Supabase dashboard access must add it before the next deploy. | Kelvin |
| **`CORS_ORIGINS` must list the deployed frontend origin.** | Without it the browser blocks every API call. Production also refuses `*`. | Kelvin |
| **Supabase Storage policy for `profile-images`.** | Uploads are scoped to `<user-id>/…` and expect a policy restricting writes to that prefix. Unverified against the live project. | Kelvin |
| **Nobody has run the new migration against the shared database.** | It drops `password_hash` and `is_online` and adds six columns plus a table. Reversible, but it should be applied deliberately, not discovered during a demo. | Kyle |

---

## Deferred

**Calendar / CalDAV.** Listed as a stretch goal on the original plan and
explicitly out of scope for this pass. `frontend/src/pages/Calendar.jsx`
remains empty, the menu link is removed rather than pointing at a blank
page, and `/api/calendar` returns a documented 501 with
`code: "not_implemented"` so the UI can distinguish "planned" from "broken".
Owner remains Aatish.

**Direct messages and Ping.** On the plan as profile stretch features. The
buttons exist on other users' profiles, disabled and labelled *Planned*,
rather than being live buttons that silently do nothing when clicked.

**Task sharing.** Stretch goal, not started.

---

## Next week

**Week of Monday 3 August – Friday 7 August 2026.**

### Goals

1. **Ship this to production and confirm it works there.** Every remaining
   blocker above is a deployment concern, not a code concern.
2. **Get the team onto the new conventions** — services, the API client,
   tests with new behaviour.
3. **Close the two rubric items that are not code.**

### Assignments

| # | Task | Owner | Due | Blocked by |
|---|---|---|---|---|
| 1 | Set `SUPABASE_JWT_SECRET` and `CORS_ORIGINS` on Render; confirm `/api/health` reports `"auth": "jwt"` | Kelvin | Mon 3 Aug | — |
| 2 | Apply the new migration to the shared Supabase database; take a snapshot first | Kyle | Mon 3 Aug | 1 |
| 3 | Verify the Supabase Storage policy on `profile-images`, upload an avatar end to end | Kelvin | Tue 4 Aug | 2 |
| 4 | Smoke-test the deployed app on Chrome, Safari and one phone; sign up as a new user and complete every flow in the manual | Turner, Aatish | Wed 5 Aug | 2, 3 |
| 5 | Complete the AI coding tool-use form | everyone | Wed 5 Aug | — |
| 6 | Walk the team through `api/services/` and `lib/apiClient` (30 min) | Ameya | Tue 4 Aug | — |
| 7 | Re-read the user manual against the deployed app and correct anything that has drifted | Aatish, Turner | Thu 6 Aug | 4 |
| 8 | Fix whatever (4) turns up | whoever finds it | Fri 7 Aug | 4 |

### Stretch, if the above lands early

| Task | Owner (proposed) | Notes |
|---|---|---|
| Calendar page + CalDAV | Aatish | The largest remaining item on the original plan |
| Direct messages | Kyle | Needs a model, a service and a route; the UI slot exists |
| Task sharing | Kyle | Stretch on the original plan |
| Websocket presence | Turner | Would replace 30-second polling in rooms |
| Username editing | Ameya | Service and validation exist; no UI |

### Risks

- **(1) and (2) are on the critical path and both are Monday.** Everything
  from Wednesday onward depends on them. If either slips, (4) slips and
  there is no time left to fix what it finds.
- **The migration is the only irreversible-feeling step.** It has a working
  `downgrade`, and it has been round-tripped against SQLite in CI, but it
  has not been run against Postgres with real data. Snapshot first.
- **Nobody but the author has read the refactor yet.** (6) exists for that
  reason and should not be skipped.
