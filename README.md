# Grove

A productivity app built for CS160. Tasks, streaks that grow a tree, friends,
and shared study rooms.

[User manual](docs/USER_MANUAL.md) ·
[Testing report](docs/TESTING.md) ·
[Development plan](docs/DEVELOPMENT_PLAN.md) ·
[Contributing](CONTRIBUTING.md)

---

## Running it locally

You need Python 3.11+, Node 20+, and a Supabase project (free tier).

### Backend

```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements-dev.txt

python app.py                     # http://localhost:5000
```

That works with no configuration at all: with no `DATABASE_URL` set, the
backend creates a local SQLite file (`grove.db`) and builds the schema on
first boot.

Check it: <http://localhost:5000/api/health>.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env              # then fill in the two Supabase values
npm run dev                       # http://localhost:5173
```

`VITE_API_URL` should stay **empty** in development. The Vite dev server
proxies `/api` to Flask on port 5000, so the browser only ever talks to one
origin and there is no CORS to configure.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` come from your Supabase
project under **Settings → API**. Without them the app still starts, and the
login page tells you what is missing rather than showing a blank screen.

### With Docker instead

```bash
docker compose up --build
```

Brings up Postgres, the API on :5000 and the frontend on :8080. Running
against real Postgres locally is worth it — the SQLite fallback is
convenient, but case sensitivity and date handling differ, and those
differences otherwise only surface after deploying.

---

## Configuration

Every variable the backend reads is documented in
[`.env.example`](.env.example); the frontend's are in
[`frontend/.env.example`](frontend/.env.example). The two that matter most:

| Variable | Effect when unset |
|---|---|
| `DATABASE_URL` | Falls back to local SQLite. Fine locally, data loss in production. |
| `SUPABASE_JWT_SECRET` | **Trusted-client mode** — see below. |

### Authentication, and the escape hatch

Supabase Auth issues the browser a signed JWT at login. The frontend sends
it as `Authorization: Bearer <token>`, and the backend verifies the
signature before believing any claim in it. Identity comes from the verified
`sub` claim.

Nobody can be expected to have the JWT secret configured before running the
app for the first time, so when `SUPABASE_JWT_SECRET` is absent the API
falls back to trusting a `supabase_id` parameter. It warns on every startup
and `/api/health` reports `"auth": "trusted-client"`.

**That mode cannot reach production.** `ProductionConfig` sets
`ALLOW_UNVERIFIED_IDENTITY = False`, and `create_app()` raises rather than
serving an app where anyone can read anyone else's data.

---

## Project layout

```
Grove/
├── api/
│   ├── __init__.py       create_app() — the boot sequence lives here
│   ├── config/           settings, database URL resolution
│   ├── models/           SQLAlchemy models
│   ├── routes/           one blueprint per resource; thin by design
│   ├── services/         business rules, testable without HTTP
│   ├── utils/            auth, errors, logging, validation
│   └── workers/          in-process queue and maintenance schedule
│
├── frontend/src/
│   ├── pages/            one component per screen
│   ├── components/       shared UI
│   ├── context/          auth session, theme
│   ├── api/              thin wrappers over lib/apiClient
│   ├── lib/              apiClient, supabase, formatting
│   ├── styles/           theme.css holds every colour token
│   └── utils/            the procedural streak-tree generator
│
├── migrations/           Alembic revisions
├── tests/                pytest suite
├── docs/                 user manual, testing report, plan
└── docker-compose.yml    Postgres + API + frontend
```

The layering rule: **routes parse and serialise, services decide, models
store.** A route with business logic in it belongs in a service.

---

## API reference

Everything is under `/api`. All authenticated endpoints take
`Authorization: Bearer <supabase access token>`.

Errors always come back in one shape:

```json
{
  "error": "Task not found.",
  "code": "not_found",
  "details": { "fields": { "title": "This field is required." } },
  "request_id": "9f2c1ab4e8d0"
}
```

`request_id` also appears in the `X-Request-ID` response header and in every
server log line for that request.

### Health

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/health` | Liveness. Never touches the database. |
| `GET` | `/api/ready` | Readiness. 503 when the database is unreachable. |

### Users

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/users/sync` | Create this Grove account after Supabase signup. Idempotent. |
| `GET` | `/api/users/me` | Your own profile, with email. |
| `PATCH` | `/api/users/me` | Partial update. Unknown fields are rejected, not ignored. |
| `GET` | `/api/users/search?q=` | Username / display-name search. |
| `GET` | `/api/users/by-username/<username>` | Public profile. Optional auth. |

### Tasks

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/tasks` | `{items, total, limit, offset}`. Filters: `completed`, `tag`, `q`, `sort`, `order`. |
| `POST` | `/api/tasks` | |
| `PATCH`/`PUT` | `/api/tasks/<id>` | Partial. Response includes `streak_bumped`. |
| `DELETE` | `/api/tasks/<id>` | |
| `POST` | `/api/tasks/clear-completed` | |
| `GET` | `/api/tasks/up-next` | Ordered by urgency, not recency. |
| `GET` | `/api/tasks/stats` | |
| `GET` | `/api/tasks/tags` | |

### Streaks

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/streaks/me?days=` | Counts, totals and day-by-day history. |
| `GET` | `/api/streaks/user/<username>` | Headline numbers only — no history. |

### Friends

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/friends?status=&direction=` | |
| `GET` | `/api/friends/summary` | Counts for the home page. |
| `POST` | `/api/friends` | |
| `PATCH` | `/api/friends/<id>` | `accepted` or `declined`. Recipient only. |
| `DELETE` | `/api/friends/<id>` | Either party. |

### Rooms

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/rooms` | Rooms you can see, plus the valid theme list. |
| `POST` | `/api/rooms` | |
| `GET` | `/api/rooms/lobby` | The one global room. |
| `POST` | `/api/rooms/lobby/join`, `/leave` | |
| `GET` | `/api/rooms/<id>` | |
| `POST` | `/api/rooms/<id>/join`, `/leave` | |
| `DELETE` | `/api/rooms/<id>` | Host only. |

### Calendar

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/calendar` | **501 Not Implemented.** Out of scope; stretch goal. |

---

## Development

```bash
ruff check . && pytest              # backend: lint + 245 tests
cd frontend && npm run check        # frontend: lint, tokens, 121 tests, build
```

CI runs exactly these on every pull request.

```bash
pytest -m edge                      # just the stress and edge cases
pytest --cov=api --cov-report=term-missing
cd frontend && npm run test:watch
```

### Database changes

```bash
flask --app app db migrate -m "add due_date to tasks"
flask --app app db upgrade
```

Read the generated revision before committing it, and use
`batch_alter_table` for anything that alters an existing column or the
migration will not run against SQLite. CI fails a pull request whose models
have drifted from its migrations.

---

## Deployment

The backend is a standard WSGI app:

```
gunicorn app:app
```

Set in production: `FLASK_ENV=production`, `DATABASE_URL`,
`SUPABASE_JWT_SECRET`, and `CORS_ORIGINS` listing the exact frontend
origin(s). The app refuses to start without the JWT secret, and refuses to
start with `CORS_ORIGINS=*`.

The frontend builds to static files (`npm run build` → `frontend/dist`).
`VITE_*` values are inlined at build time, so changing them means
rebuilding — that is inherent to a static bundle, not a choice this project
made.
