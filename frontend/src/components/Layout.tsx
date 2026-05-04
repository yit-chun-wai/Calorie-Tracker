import { NavLink } from 'react-router-dom';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <NavLink to="/" className="nav-logo" style={{ textDecoration: 'none' }}>
            🥗 CalorieAI
          </NavLink>
          <div className="nav-actions">
            <NavLink
              to="/"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/camera"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              + Add Food
            </NavLink>
          </div>
        </div>
      </nav>
      <main className="page">{children}</main>
    </>
  );
}
