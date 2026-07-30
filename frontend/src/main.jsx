// Kelvin
// Entry point of the React app. Mounts the app into the HTML page
// and wraps it with any global providers (e.g. auth state).

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// global styles

// import App
// import AuthProvider


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)