import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../services/api";
import { styles, getStatusStyle } from "../../styles";

function AdminDashboard() {
const navigate = useNavigate();

const [requests, setRequests] = useState([]);
const [loading, setLoading] = useState(true);
const [message, setMessage] = useState("");

useEffect(() => {
const token = localStorage.getItem("token");
const savedUser = localStorage.getItem("user");


if (!token || !savedUser) {
  navigate("/login", { replace: true });
  return;
}

try {
  const user = JSON.parse(savedUser);

  if (user.role !== "admin") {
    if (user.role === "tenant") {
      navigate("/tenant/dashboard", { replace: true });
    } else if (user.role === "fundi") {
      navigate("/fundi/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }

    return;
  }
} catch {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  navigate("/login", { replace: true });
  return;
}

async function loadRequests() {
  try {
   const data = await apiRequest("/maintenance-requests/all");
    setRequests(Array.isArray(data.requests) ? data.requests : []);
  } catch (error) {
    setMessage(error.message || "Unable to load maintenance requests.");
  } finally {
    setLoading(false);
  }
}

loadRequests();


}, [navigate]);

function handleLogout() {
localStorage.removeItem("token");
localStorage.removeItem("user");
navigate("/login", { replace: true });
}

const pendingCount = requests.filter(
(request) => request.status === "pending"
).length;

const approvedCount = requests.filter(
(request) => request.status === "approved"
).length;

const assignedCount = requests.filter(
(request) => request.status === "assigned"
).length;

return ( <div style={styles.page}> <header style={styles.header}> <h1 style={styles.brand}>MaintainIt</h1>

    <button
      type="button"
      style={styles.secondaryButton}
      onClick={handleLogout}
    >
      Logout
    </button>
  </header>

  <main style={styles.container}>
    <div style={styles.welcome}>
      <h2>Admin Dashboard</h2>
      <p style={styles.muted}>
        Manage maintenance requests and fundi assignments.
      </p>
    </div>

    {message && (
      <div role="alert" style={styles.error}>
        {message}
      </div>
    )}

    <section style={styles.grid}>
      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Pending Requests</h3>
        <p style={styles.statNumber}>
          {loading ? "..." : pendingCount}
        </p>
        <p style={styles.muted}>Awaiting review</p>
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Approved Requests</h3>
        <p style={styles.statNumber}>
          {loading ? "..." : approvedCount}
        </p>
        <p style={styles.muted}>Approved for maintenance</p>
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Assigned Requests</h3>
        <p style={styles.statNumber}>
          {loading ? "..." : assignedCount}
        </p>
        <p style={styles.muted}>Assigned to fundis</p>
      </div>
    </section>

    <section style={{ ...styles.card, marginTop: "24px" }}>
      <h2 style={styles.sectionTitle}>Management</h2>

      <p style={styles.muted}>
        Review tenant requests and manage maintenance assignments.
      </p>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button
          type="button"
          style={styles.button}
          onClick={() => navigate("/admin/requests")}
        >
          Manage Requests
        </button>

        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => navigate("/admin/assignments")}
        >
          Assign Fundis
        </button>
      </div>
    </section>

    <section style={{ ...styles.card, marginTop: "24px" }}>
     <h2 style={styles.sectionTitle}>All Maintenance Requests</h2>
      {loading ? (
        <p style={styles.muted}>Loading requests...</p>
      ) : requests.length === 0 ? (
        <p style={styles.muted}>
         No maintenance requests were returned by the server.
        </p>
      ) : (
        <div>
          {requests.map((request, index) => (
            <article
              key={request.id || request.request_id || index}
              style={styles.requestCard}
            >
              <h3>{request.title || "Maintenance request"}</h3>

              <p style={styles.muted}>
                {request.description || "No description provided."}
              </p>

              <p>
                Status:{" "}
                <span
                  style={getStatusStyle(request.status)}
                >
                  {request.status || "Unknown"}
                </span>
              </p>

              {request.room_number && (
                <p>Room: {request.room_number}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  </main>
</div>


);
}

export default AdminDashboard;
