# Grove — Testing Report

## Summary

| | Count |
|---|---|
| Backend tests (`pytest`) | **232** |
| — of which stress / edge cases (`pytest -m edge`) | **32** |
| Frontend tests (`vitest`) | **121** |
| **Total** | **353** |
| Backend statement coverage of `api/` | **87 %** |

Run them:

```bash
pytest                              # all backend tests
pytest -m edge                      # just the stress and edge cases
pytest --cov=api --cov-report=term-missing
cd frontend && npm test
```

Both suites run on every pull request. Backend coverage has a floor of 80 %
in `pyproject.toml`, so a change that guts it fails CI rather than merging.

### Where the tests live

| File | Tests | What it protects |
|---|---:|---|
| `tests/test_auth.py` | 24 | Identity cannot be spoofed, from every angle it used to be spoofable |
| `tests/test_users.py` | 21 | Signup, username generation, the profile allow-list |
| `tests/test_tasks.py` | 41 | CRUD, tags, ownership, paging, filters |
| `tests/test_streaks.py` | 25 | The date state machine, day by day |
| `tests/test_friends.py` | 27 | The request lifecycle in both directions |
| `tests/test_rooms.py` | 26 | Lobby, hosted rooms, presence, the sweep |
| `tests/test_edge_cases.py` | 32 | Stress and edge cases |
| `tests/test_infrastructure.py` | 36 | Health, error shape, config resolution, the worker |
| `frontend/src/**/*.test.{js,jsx}` | 121 | API client, formatting, tree generator, components, pages |

**Starting point:** `tests/` contained four files — `api.py`, `models.py`,
`services.py` and `__init__.py`. All four were empty. There was no frontend
test tooling at all.

That was not laziness. The old `app.py` built its Flask object at import
time, wired to whatever `DATABASE_URL` happened to be in the environment, so
there was no way to construct the application against a test database. The
application factory is what made this suite possible; the tests are a
consequence of that refactor, not a separate task.

---

## Feature tests

Fifteen representative feature tests, with what we expected, what actually
happened the first time we ran it, and what we changed. Ten are required;
these are the ones that taught us something.

Rows marked **FAILED** did not pass on first run. Each one is a real defect
this exercise found.

---

### FT-1 — A new user can sign up and gets a usable username

**Test:** `test_users.py::TestAccountSync::test_signup_creates_an_account`
**Steps:** POST `/api/users/sync` with a verified token for
`ada@berkeley.edu` and first/last name.
**Expected:** 201, username `ada`, display name `Ada Lovelace`.
**Actual:** Passed.
**Fix:** None.

---

### FT-2 — Two people with the same email prefix both get usernames

**Test:** `test_users.py::TestUsernameGeneration::test_two_signups_sharing_an_email_prefix_both_succeed`
**Steps:** Sign up `john@gmail.com`, then `john@yahoo.com`.
**Expected:** `john` and `john2`.
**Actual:** Passed after the service rewrite. **The original code did not.**
`generate_unique_username(data.get("username"))` was called with whatever
the client sent; when that was absent it produced the literal string
`"None2"` as somebody's public handle.
**Fix:** `normalise_username_seed()` strips an email to its prefix, drops
`+tags`, removes characters that are illegal in a URL, and falls back to
`grove` when nothing usable remains.
Covered by `test_a_seed_with_nothing_usable_still_produces_a_username`.

---

### FT-3 — A user only ever sees their own tasks

**Test:** `test_tasks.py::TestOwnership::test_you_only_see_your_own_tasks`
**Steps:** Two users each create a task; list as the first.
**Expected:** One task, theirs.
**Actual:** Passed.
**Fix:** None — but see FT-4, which is the same rule from the attacker's
side.

---

### FT-4 — Knowing somebody's `supabase_id` grants nothing

**Test:** `test_auth.py::TestIdentityCannotBeSpoofed::test_knowing_a_supabase_id_alone_grants_nothing`
**Steps:** PATCH `/api/users/<their supabase_id>` with no token.
**Expected:** 401, and their profile unchanged.
**Actual:** **FAILED against the original code — this was the project's most
serious defect.** Every endpoint took identity from the request:
`User.query.filter_by(supabase_id=request.args.get("supabase_id"))`. A
`supabase_id` is not a secret — it is returned by the public profile
endpoint and visible in the browser's network tab. With one you could list
another user's tasks, rewrite their profile, delete their data, or accept
friend requests on their behalf.
**Fix:** `api/utils/auth.py`. The Supabase JWT is verified against the
project secret and identity comes from the `sub` claim. The body's opinion
about who it is no longer matters. Twenty-four tests in `test_auth.py` cover
this from every direction, including expired tokens, tokens signed with the
wrong key, tokens for a different audience, and passing somebody else's id
in the body alongside a valid token of your own.

---

### FT-5 — Completing a task raises the streak, once per day

**Test:** `test_streaks.py::TestCounting::test_a_second_completion_on_the_same_day_does_not_count_twice`
**Steps:** Complete two tasks on the same calendar day.
**Expected:** Streak = 1.
**Actual:** Passed.
**Fix:** None. `record_completion` takes an explicit day parameter, so the
whole state machine is testable without mocking the clock — which is why
`test_every_transition` can cover same-day, consecutive-day, one-day-gap and
week-gap as a parameterised table.

---

### FT-6 — The API reports whether the streak actually moved

**Test:** `test_tasks.py::TestUpdate::test_the_response_says_whether_the_streak_moved`
**Steps:** Complete a task, un-complete it, complete it again.
**Expected:** `streak_bumped: true` then `false`. The day is already
counted; nothing moved the second time.
**Actual:** **FAILED.** Returned `true` both times. The flag was set from
`Task.mark_completed()`, which reports a false→true edge — and un-ticking
then re-ticking genuinely is a fresh edge. It just is not a streak change.
**Fix:** `api/services/task.py` now compares the streak count before and
after. Without this the UI celebrates a number that did not change.

---

### FT-7 — Two people adding each other become friends

**Test:** `test_friends.py::TestSendingRequests::test_requesting_someone_who_already_requested_you_just_accepts`
**Steps:** B requests A; A then requests B.
**Expected:** One accepted friendship.
**Actual:** Passed after the service rewrite. **The original code returned
409** and left the pending request untouched, so two people who had both
clicked *Add* were not friends and neither could work out why.
**Fix:** `send_request` detects the reverse pending row and accepts it. One
row, one friendship.

---

### FT-8 — Only the recipient can answer a friend request

**Test:** `test_friends.py::TestResponding::test_the_sender_cannot_accept_their_own_request`
**Steps:** A requests B; A tries to accept.
**Expected:** 403.
**Actual:** Passed.
**Fix:** None. The neighbouring test —
`test_an_unrelated_user_cannot_answer` — is the one that matters more, and
also passed.

---

### FT-9 — The lobby exists and counts who is present

**Test:** `test_rooms.py::TestLobby::test_population_counts_who_is_present_not_who_ever_joined`
**Steps:** Two users join; push one's `last_seen_at` back three hours; read
the population.
**Expected:** 1.
**Actual:** Passed against the rewrite. **Untestable before it** — the three
room routes had `pass` bodies, so every one of them returned a 500. The old
`Room.to_dict` also computed population as `len(self.memberships)`, which
counted everyone who had ever opened the page and only ever went up.
**Fix:** Implemented the endpoints; population now counts members whose
`last_seen_at` is recent.

---

### FT-10 — Creating a room without naming a theme uses the default

**Test:** `test_rooms.py::TestHostedRooms::test_theme_defaults_when_omitted`
**Steps:** POST `/api/rooms` with only a name.
**Expected:** 201, theme `grove`.
**Actual:** **FAILED with 400.** The validator returns a `MISSING` sentinel
for an absent key, and the route did `theme = fields.one_of(...) or DEFAULT`
— `MISSING` is an `object()` and therefore truthy, so the sentinel survived
and failed the theme check downstream.
**Fix:** Compare against the sentinel explicitly. A neat illustration of why
`or` is the wrong operator for defaulting anything that can legitimately be
falsy — or, here, wrongly truthy.

---

### FT-11 — The shared room appears on the Rooms page

**Test:** `test_rooms.py::TestVisibility::test_you_see_the_lobby_your_rooms_and_rooms_you_joined`
**Steps:** Create a room, join someone else's, list rooms.
**Expected:** The Grove, plus both rooms.
**Actual:** **FAILED.** The Grove was missing. It is created lazily on first
access, and only the lobby endpoint did that — so a user who opened **Rooms**
before anyone had opened **Lobby** saw no shared room at all, which reads as
a bug rather than as "nobody has been here yet".
**Fix:** `list_rooms` ensures the global room too.

---

### FT-12 — A profile PATCH cannot write fields it should not

**Test:** `test_users.py::TestProfileEditing::test_streak_cannot_be_written_through_the_profile`
**Steps:** PATCH `/api/users/me` with `{"current_streak": 999}`.
**Expected:** 400, streak unchanged.
**Actual:** **FAILED with 200.** The streak was not written — the route only
reads known keys — but the unknown key was silently discarded. A client
sending `{"username": "..."}` got a cheerful 200 and no change, which is a
much harder bug to notice than an error.
**Fix:** Unknown fields are now a 400 that names them. Identity keys used by
trusted-client mode are exempted, so an older frontend build still works.

---

### FT-13 — Errors come back as JSON, always

**Test:** `test_infrastructure.py::TestErrorShape::test_errors_are_json_not_html`
**Steps:** GET an endpoint that does not exist.
**Expected:** `application/json`, a stable `code`, and a `request_id`.
**Actual:** Passed against the rewrite. **The original returned Flask's HTML
error page**, which is the worst possible failure for a JSON client:
`res.json()` throws while parsing the error and the user sees a blank
screen.
**Fix:** `api/utils/errors.py` — one hierarchy, one response shape, handlers
for `HTTPException`, `IntegrityError` (a 409, not a 500 — it is almost
always a double-click) and a last-resort `Exception`.

---

### FT-14 — Calendar says "not built", not "broken"

**Test:** `test_infrastructure.py::TestCalendarIsExplicitlyNotBuilt::test_it_answers_501_rather_than_crashing`
**Steps:** GET `/api/calendar`.
**Expected:** 501 with `code: "not_implemented"`.
**Actual:** Passed. **The original stub had a `pass` body**, so Flask raised
"view function did not return a valid response" and it answered 500 — which
a frontend cannot tell apart from a real fault.
**Fix:** A deliberate 501. Calendar remains out of scope.

---

### FT-15 — Readiness fails when the database is unreachable

**Test:** `test_infrastructure.py::TestHealth::test_readiness_fails_when_the_database_is_unreachable`
**Steps:** Patch the session to raise `OperationalError`; GET `/api/ready`.
**Expected:** 503.
**Actual:** Passed.
**Fix:** None — but the companion test
(`test_liveness_does_not_touch_the_database`) exists because the two
endpoints must differ: if liveness touched the database, an outage would
make the host kill and restart otherwise-healthy instances in a loop.

---

## Stress and edge cases

Thirty-two, all marked `@pytest.mark.edge`. Eight worth writing up.

---

### EC-1 — A 200,000-character task title

**Test:** `test_edge_cases.py::TestOversizedInput::test_a_200000_character_title_is_rejected_not_500`
**Expected:** 400, nothing written.
**Actual:** Passed against the rewrite. **The original code checked only
that the title was non-empty**, so anything longer than the `String(200)`
column reached the database and came back as an unhandled error.
**Fix:** Declarative length validation in `api/utils/validation.py`.
Boundary tests confirm 200 is accepted and 201 is not.

---

### EC-2 — Searching for `%`

**Test:** `test_edge_cases.py::TestSearchAbuse::test_a_bare_percent_does_not_dump_every_user`
**Expected:** No results.
**Actual:** Passed against the rewrite. **The original returned every user
in the database.** The search interpolated the term straight into a LIKE
pattern — `ilike(f"%{query}%")` — so `%` matched everything and `_` matched
any single character. The search box was a full user listing.
**Fix:** `escape_like()` escapes `\`, `%` and `_`, and a two-character
minimum stops a stray keystroke doing the same.
Related: SQL metacharacters are covered separately and are just text —
SQLAlchemy parameterises, so injection was never the risk here. Wholesale
disclosure was.

---

### EC-3 — Double-clicking "Add Friend"

**Test:** `test_edge_cases.py::TestConcurrencyAndRepeats::test_a_double_clicked_add_friend_produces_one_friendship`
**Expected:** 201 then 409; exactly one row.
**Actual:** Passed. The service checks both column orders before inserting,
and catches `IntegrityError` for the case where two requests race past that
check simultaneously.

---

### EC-4 — A Supabase account deleted and recreated

**Test:** `test_edge_cases.py::TestConcurrencyAndRepeats::test_a_recreated_supabase_account_keeps_its_data`
**Steps:** A user with tasks syncs again with the same email and a brand-new
`supabase_id`.
**Expected:** One user row, re-pointed; the tasks survive.
**Actual:** Passed against the rewrite. **The original would have created a
second row** and orphaned every task and friendship behind an id nobody
could log in as. It would then have hit the unique constraint on email and
returned a 500.
**Fix:** `sync_account` detects the email collision and re-links.

---

### EC-5 — A streak across a year boundary

**Test:** `test_edge_cases.py::TestBoundariesInTime::test_a_streak_across_a_year_boundary`
**Steps:** Complete on 31 Dec 2025, then 1 Jan 2026.
**Expected:** Streak = 2.
**Actual:** Passed. `date` arithmetic, not integer arithmetic. A leap-day
test and a 400-consecutive-day test cover the same property at different
scales.

---

### EC-6 — Emoji and non-Latin task titles

**Test:** `test_edge_cases.py::TestUnicodeAndWhitespace::test_emoji_and_non_latin_text_survive_a_round_trip`
**Steps:** Create `复习 CS160 📚 — chapître trois`, then read it back.
**Expected:** Byte-identical.
**Actual:** Passed.

---

### EC-7 — 250 tasks

**Test:** `test_edge_cases.py::TestScale::test_a_user_with_many_tasks_pages_rather_than_returning_everything`
**Expected:** `total: 250`, one page of 100.
**Actual:** Passed against the rewrite. **The original list endpoints
returned every row they could find** — fine with a class-project amount of
data, and not fine the first time somebody's list is long.
**Fix:** Paging on every list endpoint, with the total in the envelope so
the UI can tell whether it is showing everything.

---

### EC-8 — A 2 MB request body

**Test:** `test_edge_cases.py::TestOversizedInput::test_a_request_body_larger_than_the_cap_is_refused`
**Expected:** 413, rejected before anything parses it.
**Actual:** Passed. `MAX_CONTENT_LENGTH` is 1 MiB. Every endpoint takes
small JSON; images go straight to Supabase Storage from the browser and
never touch this service.

---

## Frontend tests

121 tests. Three findings worth recording.

### FE-1 — Dark mode crashed the app in a browser without `matchMedia`

**Test:** every test that renders a provider.
**Actual:** **FAILED.** `ThemeContext` called
`window.matchMedia?.("...").matches`. The optional chain guards `matchMedia`
being absent but not it returning nothing — which is the case in jsdom and
in some older mobile browsers. It threw during the first render, before
anything painted, taking the whole app down.
**Fix:** `window.matchMedia?.("...")?.matches ?? false`. A real
browser-compatibility bug that only surfaced because the tests ran in an
environment poorer than Chrome.

### FE-2 — "Due today" displayed as "yesterday"

**Test:** `format.test.js::formatDueDate::parses at local midnight, not UTC`
**Actual:** Passed — the code was written correctly — but the *first version
of the test* asserted using `new Date().toISOString()`, which is UTC. Run in
the evening in Berkeley it produced tomorrow's date, and the test would have
passed while asserting the wrong thing.
**Fix:** The test builds the date from local components. Worth recording
because a test that passes for the wrong reason is worse than no test.

### FE-3 — An empty list and a failed request must not look the same

**Test:** `Tasks.test.jsx::says so when loading fails, rather than showing the empty state`
**Actual:** Passed against the rewrite. **The original API layer returned
`[]` on any error**, so a backend outage rendered "Nothing here yet — add
your first task", telling the user their data did not exist rather than that
it could not be fetched.
**Fix:** `lib/apiClient` throws a typed `ApiError`; `components/states.jsx`
renders loading, empty and error distinctly, and distinguishes a connection
failure from a server error because "check your connection" is actionable
and "something went wrong" is not.

---

## Tests that failed, and what changed as a result

The rubric asks for both successful and unsuccessful tests. Everything the
suite caught, in one place:

| # | Test | Defect | Change |
|---|---|---|---|
| 1 | FT-10 | Room creation without a theme returned 400 | Sentinel compared explicitly instead of with `or` |
| 2 | FT-11 | The shared room was missing from `/api/rooms` | `list_rooms` creates it too |
| 3 | FT-6 | `streak_bumped` was true when nothing moved | Compare the count before and after |
| 4 | FT-12 | Unknown profile fields were silently dropped | 400 naming the offending fields |
| 5 | FE-1 | `matchMedia` crash on first render | Second optional chain |
| 6 | — | `flask db upgrade` could never run against SQLite | `create_all` only bootstraps an untouched database, then stamps head |
| 7 | — | Test suite hung instead of failing | A test router nested `/login` inside the guard that redirects to it; `restoreAllMocks` stripped the `matchMedia` stub after the first test in each file |

Defects 1–5 were shipped code. Defect 6 was found by writing the CI job that
applies migrations end to end — the kind of thing nothing else would have
caught until a teammate first tried to run a migration. Defect 7 was in the
tests themselves and is recorded because both symptoms cost real time to
diagnose.

The larger point: the eight defects the *original* code contained — the
authentication hole, the `%` search, the oversized-title 500, the `"None2"`
username, the 500-returning stubs, the HTML error pages, the unpaged lists,
the double-request friendship — were all found by writing tests for
behaviour that had never been exercised. None of them were found by reading
the code, and none would have been found by clicking through the happy path.

---

## What is not tested

Stated plainly, so nobody assumes otherwise:

- **Supabase Auth itself.** Signup, login and token refresh are Supabase's.
  We test that we verify its tokens correctly, not that it issues them
  correctly.
- **Image upload against real storage.** The size and type checks are
  tested; the upload path is not.
- **Real browsers.** The frontend suite runs in jsdom. Cross-browser
  behaviour was checked by hand (see the table in the user manual).
- **Load.** "250 tasks" and "20 people in a room" are correctness tests at
  scale, not performance tests. Nothing here measures throughput.
- **The calendar.** Out of scope; the only thing tested is that it returns a
  documented 501.
