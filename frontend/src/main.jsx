// Entry point. Mounts the app and wraps it in the global providers.
//
// ThemeProvider is outermost so the data-theme attribute is on <html> before
// anything paints — otherwise a dark-mode user gets one white frame on every
// load.

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { UserProvider } from "./context/UserContext";

import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/card.css";
import "./styles/nav.css";
import "./styles/components.css";
import "./styles/states.css";
import "./styles/profile.css";
import "./styles/auth.css";
import "./styles/friends.css";
import "./styles/tasks.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <UserProvider>
        <App />
      </UserProvider>
    </ThemeProvider>
  </React.StrictMode>
);
