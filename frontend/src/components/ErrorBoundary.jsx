// Top-level error boundary.
//
// A render-time exception anywhere in a React tree unmounts the entire tree.
// With no boundary, that is a white page: no navigation, no message, no way
// back short of the browser's reload button. One bad `profile.username` on a
// profile that failed to load was enough to do it.
//
// Class component because React only supports componentDidCatch on classes.

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Nothing collects frontend errors yet, so the console is the only
    // destination. Keeping the call here means wiring up Sentry later is a
    // one-line change in one place.
    console.error("Unhandled UI error:", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="page">
        <div className="page-content">
          <div className="card state state-error" role="alert">
            <p className="state-title">Grove hit an unexpected problem</p>
            <p className="state-hint">
              The page could not be displayed. Your data is safe — nothing was lost.
            </p>
            <div className="state-actions">
              <button type="button" className="state-retry" onClick={this.handleReset}>
                Try again
              </button>
              <a className="state-retry" href="/">
                Go home
              </a>
            </div>
            {/* Visible in development only: in production it is noise to the
                user, and the same text is already in the console. */}
            {import.meta.env.DEV && (
              <pre className="state-debug">{String(error?.stack || error)}</pre>
            )}
          </div>
        </div>
      </div>
    );
  }
}
