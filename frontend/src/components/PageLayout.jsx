// The frame every page sits in.
//
// Each page used to repeat the same four lines — <div className="page">, a
// <MenuIcon />, an <h1 className="page-title">, a wrapper div — and they had
// already drifted: some wrapped their content in .page-content and some did
// not, so the same layout was 960px wide on one page and full-bleed on the
// next.

import MenuIcon from "./MenuIcon";
import { LoadingState } from "./states";

export default function PageLayout({ title, subtitle, actions, loading, children }) {
  return (
    <div className="page">
      <MenuIcon />
      <div className="page-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="page-actions">{actions}</div>}
        </header>
        {loading ? <LoadingState /> : children}
      </div>
    </div>
  );
}
