import { NavLink, Outlet, Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="ChatPRFAQ home">
      <span className="brand__mark" aria-hidden="true">
        PR
      </span>
      <span className="brand__name">ChatPRFAQ</span>
    </Link>
  );
}

export function SiteLayout() {
  return (
    <>
      <header className="sitebar">
        <div className="sitebar__inner">
          <Brand />
          <nav className="sitebar__nav" aria-label="Site">
            <NavLink to="/how-it-works" className={({ isActive }) => `sitebar__link${isActive ? ' is-active' : ''}`}>
              How it works
            </NavLink>
            <NavLink to="/runs" className={({ isActive }) => `sitebar__link${isActive ? ' is-active' : ''}`}>
              Runs
            </NavLink>
            <NavLink to="/demo" className={({ isActive }) => `sitebar__link${isActive ? ' is-active' : ''}`}>
              Sample run
            </NavLink>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="sitefoot">
        <div className="sitefoot__inner">
          <span>ChatPRFAQ</span>
          <span className="muted">A Working Backwards council for product ideas.</span>
        </div>
      </footer>
    </>
  );
}
