import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./SidebarLayout.css";

// One shared shell for the admin and fundi pages.
// groups = [{ label, items: [{ label, to?, href?, active?, badge? }] }]
function SidebarLayout({ roleLabel, groups, title, description, children }) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function closeMobileMenu() {
    setIsMenuOpen(false);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsMenuOpen(false);
    navigate("/login", { replace: true });
  }

  return (
    <div className="ax-shell">
      <aside className="ax-sidebar">
        <div className="ax-sidebar-header">
          <div className="ax-logo">
            Maintain<span>It</span>
          </div>

          <p className="ax-role">{roleLabel}</p>

          <button
            type="button"
            className="ax-menu-toggle"
            onClick={() => setIsMenuOpen((current) => !current)}
            aria-expanded={isMenuOpen}
            aria-controls="ax-sidebar-navigation"
          >
            <span className="ax-menu-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>

            <span>{isMenuOpen ? "Close" : "Menu"}</span>
          </button>
        </div>

        <nav
          id="ax-sidebar-navigation"
          className={`ax-sidebar-nav${isMenuOpen ? " is-open" : ""}`}
          aria-label="Main navigation"
        >
          {groups.map((group) => (
            <div className="ax-nav-section" key={group.label}>
              <p className="ax-nav-group">{group.label}</p>

              {group.items.map((item) => {
                const cls =
                  "ax-nav-item" + (item.active ? " is-active" : "");

                const badge = item.badge ? (
                  <span className="ax-nav-badge">{item.badge}</span>
                ) : null;

                return item.href ? (
                  <a
                    key={item.label}
                    href={item.href}
                    className={cls}
                    onClick={closeMobileMenu}
                  >
                    <span>{item.label}</span>
                    {badge}
                  </a>
                ) : (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    className={cls}
                    onClick={closeMobileMenu}
                  >
                    <span>{item.label}</span>
                    {badge}
                  </NavLink>
                );
              })}
            </div>
          ))}

          <button
            type="button"
            className="ax-nav-item ax-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </nav>
      </aside>

      {isMenuOpen && (
        <button
          type="button"
          className="ax-menu-backdrop"
          onClick={closeMobileMenu}
          aria-label="Close navigation menu"
        />
      )}

      <div className="ax-content">
        <main className="ax-main">
          {title && (
            <div className="ax-page-head">
              <h1 className="ax-page-title">{title}</h1>

              {description && (
                <p className="ax-page-desc">{description}</p>
              )}
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}

export default SidebarLayout;