// Kelvin
// Entry point of the React app. Mounts the app into the HTML page
// and wraps it with any global providers (e.g. auth state).
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { UserProvider } from './context/UserContext'
import './styles/theme.css'
import './styles/layout.css'
import './styles/card.css'
import './styles/nav.css'
import './styles/components.css'
import './styles/profile.css'
import './styles/auth.css'
import './styles/friends.css'
import './styles/tasks.css'
import './styles/calendar.css'
import './styles/study-rooms.css'
import './styles/tree.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </React.StrictMode>
)