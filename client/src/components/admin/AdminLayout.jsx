import { useLocation } from "react-router-dom";
import SidebarLayout from "../layout/SidebarLayout";
import PropertyPicker from "./PropertyPicker";

// Admin navigation. The dashboard sections live in the URL (?section=...),
// so the sidebar can highlight the current one on every admin page.
const DASH = "/admin/dashboard";

function AdminLayout({ title, description, badges = {}, children }) {
  const location = useLocation();
  const onDashboard = location.pathname === DASH;
  const section = new URLSearchParams(location.search).get("section") || "overview";
  const dash = (id, label, extra = {}) => ({
    label,
    to: id === "overview" ? DASH : `${DASH}?section=${id}`,
    active: onDashboard && section === id,
    ...extra,
  });
  // The property picker appears on every page that follows it: the whole
  // dashboard, Manage requests and Assign fundis.
  const showPicker =
    onDashboard ||
    location.pathname === "/admin/requests" ||
    location.pathname === "/admin/assignments";
  const page = (to, label) => ({ label, to, active: location.pathname === to });

  const groups = [
    { label: "Overview", items: [dash("overview", "Dashboard"), dash("insights", "Analytics and fundis")] },
    {
      label: "Work",
      items: [
        dash("requests", "All requests"),
        page("/admin/requests", "Manage requests"),
        page("/admin/assignments", "Assign fundis"),
        page("/admin/properties", "Properties and rooms"),
        page("/admin/tenant-assignments", "Tenants and rooms"),
      ],
    },
    { label: "Money", items: [dash("money", "Payments", { badge: badges.payments })] },
    { label: "People", items: [page("/admin/staff", "Add staff")] },
  ];

  return (
    <SidebarLayout roleLabel="Property administrator" groups={groups} title={title} description={description}>
      {showPicker && <PropertyPicker />}
      {children}
    </SidebarLayout>
  );
}

export default AdminLayout;