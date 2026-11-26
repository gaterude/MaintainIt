import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import TenantDashboard from "./pages/tenant/tenantDashboard.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageRequests from "./pages/admin/ManageRequests";
import AssignFundis from "./pages/admin/AssignFundis";
import FundiDashboard from "./pages/fundi/FundiDashboard";
import Register from "./pages/Register";
import TenantAssignments from "./pages/admin/TenantAssignments";
import AdminStaff from "./pages/admin/AdminStaff";
import AdminProperties from "./pages/admin/AdminProperties";

const HOME_BY_ROLE = {
  admin: "/admin/dashboard",
  fundi: "/fundi/dashboard",
  tenant: "/tenant/dashboard",
};

function readSession() {
  try {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return token && user?.role ? user : null;
  } catch {
    return null;
  }
}

// One guard for every protected page: not signed in -> login,
// wrong role -> that person's own dashboard.
// (The server still checks the role on every API call; this only keeps screens tidy.)
function RequireRole({ role, children }) {
  const user = readSession();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) {
    return <Navigate to={HOME_BY_ROLE[user.role] || "/login"} replace />;
  }
  return children;
}

function PlaceholderPage({ title, description }) {
  return (
    <main style={{ padding: "32px", fontFamily: "Arial, sans-serif" }}>
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/tenant/dashboard"
          element={<RequireRole role="tenant"><TenantDashboard /></RequireRole>}
        />

        <Route
          path="/admin/dashboard"
          element={<RequireRole role="admin"><AdminDashboard /></RequireRole>}
        />
        <Route
          path="/admin/requests"
          element={<RequireRole role="admin"><ManageRequests /></RequireRole>}
        />
        <Route
          path="/admin/assignments"
          element={<RequireRole role="admin"><AssignFundis /></RequireRole>}
        />
        <Route
          path="/admin/tenant-assignments"
          element={<RequireRole role="admin"><TenantAssignments /></RequireRole>}
        />
        <Route
          path="/admin/properties"
          element={<RequireRole role="admin"><AdminProperties /></RequireRole>}
        />
        <Route
          path="/admin/staff"
          element={<RequireRole role="admin"><AdminStaff /></RequireRole>}
        />

        <Route
          path="/fundi/dashboard"
          element={<RequireRole role="fundi"><FundiDashboard /></RequireRole>}
        />
        <Route
          path="/fundi/jobs"
          element={
            <RequireRole role="fundi">
              <PlaceholderPage
                title="My Jobs"
                description="View and manage assigned maintenance jobs here."
              />
            </RequireRole>
          }
        />

        {/* Anything unknown goes to login. Keep this last. */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;