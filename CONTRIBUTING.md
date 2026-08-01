# Contributing to Grove

Five people work in this repository. These are the conventions that keep
that from turning into merge conflicts and mystery bugs.

## Getting set up

See [README.md](README.md) for the full first-run instructions. The short
version:

```bash
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements-dev.txt
python app.py                                     # http://localhost:5000

cd frontend && npm install
cp .env.example .env                              # fill in the Supabase values
npm run dev                                       # http://localhost:5173
```

No `DATABASE_URL` is needed to start: the backend falls back to a local
SQLite file. No `SUPABASE_JWT_SECRET` is needed either, though without it
the API runs in trusted-client mode — see [Authentication](#authentication).

## Before you push

```bash
ruff check . && pytest              # backend
cd frontend && npm run check        # lint, design tokens, tests, build
```

CI runs exactly these. Running them locally saves a round trip.

## Branches

`main` is deployed. Branch off it, in your own namespace:

```
ameya/streak-history
kyle/task-filters
```

Open a pull request against `main`. The template asks three questions —
what changed, why, and how you tested it. Answer them; a reviewer who has
to reconstruct the "why" from the diff will review it badly.

## Commits

Write a subject line that says what changed for a user or a developer, in
lower case, no trailing period:

```
stop a JSON API from answering in HTML
fill in the five empty service files the plan calls for
```

Not `fix bug`, `update files`, or `wip`.

If the change is not obvious, use the body to say **why**, and what the
previous behaviour was. A future reader can see what the code does now; the
thing they cannot recover is what was wrong before.

Keep commits self-contained: each one should leave the tests passing. That
is what makes `git bisect` useful when something breaks three weeks later.

## Where code goes

```
api/
  routes/     parse the request, call a service, serialise the result
  services/   the business rules — who may do what, and what follows
  models/     the schema, and small derived properties
  utils/      auth, errors, logging, validation
  workers/    work that must not happen on the request path
frontend/src/
  pages/      one per screen
  components/ shared UI
  api/        thin wrappers over lib/apiClient
  lib/        apiClient, supabase, formatting
  context/    app-wide state
```

Two rules follow from that layout:

**Routes stay thin.** If a route function has business logic in it, that
logic belongs in a service. Services are testable without an HTTP request;
routes are not.

**The frontend does not call `fetch` directly.** Everything goes through
`lib/apiClient`, which attaches the access token, applies a timeout, and
turns failures into a typed `ApiError`. A raw `fetch` bypasses all three.

## Authentication

Identity comes from the verified JWT, never from the request body. Inside a
route, use `current_user()` — never a `supabase_id` from the query string or
the body. That parameter is how the original code worked, and it meant
anyone who knew your id could read and rewrite your data.

Protected routes use `@require_user`. Public reads that show more to a
signed-in viewer use `@optional_user`.

Locally, without `SUPABASE_JWT_SECRET`, the API accepts the legacy
`supabase_id` parameter so the app runs with no setup. It warns loudly on
every startup, `/api/health` reports `"auth": "trusted-client"`, and
production refuses to boot in that state.

## Database changes

Changing a model means writing a migration:

```bash
flask --app app db migrate -m "add due_date to tasks"
flask --app app db upgrade
```

Read the generated file before committing it — Alembic's autogenerate is a
good first draft and not much more. Use `batch_alter_table` for anything
that alters an existing column, or the migration will not run on SQLite.

CI fails a pull request whose models have drifted from its migrations.

## Styling

Colours come from the tokens in `src/styles/theme.css`. Stylelint enforces
this: a raw hex value in a component stylesheet fails the build. That
discipline is why dark mode was a twenty-line change to one file instead of
a change to every component.

New tokens follow the naming convention: `--color-`, `--font-`, `--space-`,
`--radius-`, `--shadow-`.

## Tests

New behaviour needs a test, and the test should fail without the change —
if it passes either way it is not testing what you think.

Backend tests live in `tests/`, use the fixtures in `conftest.py`, and get a
fresh in-memory database each. Mark stress and edge cases with
`@pytest.mark.edge`.

Frontend tests sit next to what they test as `*.test.jsx`. Mock the module
under `src/api/`, not `fetch` — you are testing the component, not the
network.

Assert on what a user can see (`getByRole`, `getByText`), not on internal
state. A test that passes because a class name is present will keep passing
when the button stops working.

## Reviewing

Look for: does it handle the failure case, is the error message something a
user can act on, and would you understand this code in a month.

Approving a pull request means you believe it works. Pull the branch and
click the thing if you are not sure.
