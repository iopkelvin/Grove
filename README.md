# Grove

CS160 Project — Grove, a productivity application

## Project Structure

```
Grove/
├── api/                              # backend
│   ├── config/                       # app config + DB setup
│   ├── models/                       # data models (DB schemas)
│   ├── services/                     # business logic
│   ├── utils/                        # helpers (e.g. logger)
│   ├── workers/                      # background jobs (empty)
│   └── __init__.py                   # Python package marker
│
├── frontend/                         # React app
│   ├── src/
│   │   ├── pages/                    # replaces templates/*.html
│   │   │   ├── Home.jsx              # was main.html
│   │   │   ├── Lobby.jsx             # was lobby.html
│   │   │   ├── Room.jsx              # was room.html
│   │   │   ├── Tasks.jsx             # was tasks.html
│   │   │   ├── Friends.jsx           # was friends.html
│   │   │   ├── Calendar.jsx          # was calendar.html
│   │   │   ├── Streaks.jsx           # was streaks.html
│   │   │   ├── Profile.jsx           # was profile.html
│   │   │   └── Settings.jsx          # was settings.html
│   │   ├── components/               # shared UI pieces
│   │   ├── context/                  # app-wide state (auth)
│   │   ├── api/                      # calls to Flask API
│   │   ├── App.jsx                   # sets up routing
│   │   └── main.jsx                  # boots the app
│   ├── public/
│   │   └── img/                      # was static/img
│   ├── index.html                    # React's HTML shell
│   ├── package.json                  # JS dependencies
│   ├── vite.config.js                # dev server + proxy
│   └── Dockerfile                    # frontend container
│
├── tests/
├── .env.example
├── .gitignore                        # ignores node_modules/, dist/
├── app.py                            # routes return JSON
├── docker-compose.yml                # backend + frontend services
├── Dockerfile                        # backend container
└── requirements.txt
```