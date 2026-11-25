import { NavLink, useNavigate } from "react-router-dom";
import "./SidebarLayout.css";

// One shared shell for the admin and fundi pages (navy sidebar + page heading).
// groups = [{ label, items: [{ label, to? , href?, active?, badge? }] }]
//   to   -> router link, href -> same-page anchor (smooth scroll by the browser)
function SidebarLayout({ roleLabel, groups, title, description, children }) {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  return (
    <div className="ax-shell">
      <aside className="ax-sidebar">
        <div className="ax-logo">
          Maintain<span>It</span>
        </div>
        <p className="ax-role">{roleLabel}</p>

        {groups.map((group) => (
          <div key={group.label}>
            <p className="ax-nav-group">{group.label}</p>
            {group.items.map((item) => {
              const cls = "ax-nav-item" + (item.active ? " is-active" : "");
              const badge = item.badge ? (
                <span className="ax-nav-badge">{item.badge}</span>
              ) : null;
              return item.href ? (
                <a key={item.label} href={item.href} className={cls}>
                  <span>{item.label}</span>
                  {badge}
                </a>
              ) : (
                <NavLink key={item.label} to={item.to} className={cls}>
                  <span>{item.label}</span>
                  {badge}
                </NavLink>
              );
            })}
          </div>
        ))}

        <button type="button" className="ax-nav-item ax-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <div className="ax-content">
        <main className="ax-main">
          {title && (
            <div className="ax-page-head">
              <h1 className="ax-page-title">{title}</h1>
              {description && <p className="ax-page-desc">{description}</p>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export default SidebarLayout;