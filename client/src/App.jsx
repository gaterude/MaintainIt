import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import TenantDashboard from "./pages/tenant/TenantDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageRequests from "./pages/admin/ManageRequests";
import AssignFundis from "./pages/admin/AssignFundis";
import FundiDashboard from "./pages/fundi/FundiDashboard";
import Register from "./pages/Register";
import TenantAssignments from "./pages/admin/TenantAssignments";

function PlaceholderPage({ title, description }) {
return (
<main
style={{
padding: "32px",
fontFamily: "Arial, sans-serif",
}}
> <h1>{title}</h1> <p>{description}</p> </main>
);
}

function App() {
return ( <BrowserRouter> <Routes>
<Route path="/login" element={<Login />} />
<Route path="/register" element={<Register />} />

    <Route
      path="/tenant/dashboard"
      element={<TenantDashboard />}
    />

    <Route
      path="/admin/dashboard"
      element={<AdminDashboard />}
    />

    <Route
      path="/admin/requests"
      element={<ManageRequests />}
    />

    <Route
      path="/admin/assignments"
      element={<AssignFundis />}
    />
    <Route
  path="/admin/tenant-assignments"
  element={<TenantAssignments />}
/>

    <Route
      path="/fundi/dashboard"
      element={<FundiDashboard />}
    />

    <Route
      path="/fundi/jobs"
      element={
        <PlaceholderPage
          title="My Jobs"
          description="View and manage assigned maintenance jobs here."
        />
      }
    />

    <Route
      path="*"
      element={<Navigate to="/login" replace />}
    />
  </Routes>
</BrowserRouter>


);
}

export default App;
