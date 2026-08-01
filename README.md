# Grove

CS160 Project — Grove, a productivity application

## Project Structure

```
Grove/
├── api/                              # backend
│   ├── config/                       # app config + DB setup
│   ├── models/                       # data models (DB schemas)
│   ├── services/                     # business logic
│   ├── utils/                        # small shared helpers (e.g. utcnow)
│   └── __init__.py                   # Python package marker
│
├── frontend/                         # React app
│   ├── src/
│   │   ├── pages/                    # one component per screen (Home, Lobby, Room, Tasks, Friends, Calendar, Streaks, Profile)
│   │   ├── components/               # shared UI pieces
│   │   ├── context/                  # app-wide state (auth, theme)
│   │   ├── hooks/                    # shared stateful logic (e.g. useTasks)
│   │   ├── lib/                      # small clients/helpers (Supabase client, formatting, uploads)
│   │   ├── utils/                    # standalone utilities (e.g. tree art generator)
│   │   ├── styles/                   # CSS, one file per feature area
│   │   ├── api/                      # calls to Flask API
│   │   ├── App.jsx                   # sets up routing
│   │   └── main.jsx                  # boots the app
│   ├── public/
│   │   └── img/
│   ├── index.html                    # React's HTML shell
│   ├── package.json                  # JS dependencies
│   └── vite.config.js                # dev server + proxy
│
├── migrations/                       # Alembic DB schema migrations
├── tests/                            # backend test suite (pytest)
├── .env.example
├── .gitignore                        # ignores node_modules/, dist/
├── app.py                            # routes return JSON
└── requirements.txt
```