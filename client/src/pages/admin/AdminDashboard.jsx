import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../services/api";
import { styles, getStatusStyle } from "../../styles";

function AdminDashboard() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

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

        setRequests(
          Array.isArray(data.requests) ? data.requests : []
        );
      } catch (error) {
        setMessage(
          error.message || "Unable to load maintenance requests."
        );
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

  function formatCategory(category) {
    if (!category) {
      return "Maintenance request";
    }

    return category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getPriority(request) {
    return ["urgent", "medium", "low"].includes(request.priority)
      ? request.priority
      : "medium";
  }

  function formatPriority(priority) {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }

  function formatStatus(status) {
    if (!status) {
      return "Unknown";
    }

    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatOverdueDuration(overdueSince) {
    if (!overdueSince) {
      return "Overdue";
    }

    const startTime = new Date(overdueSince).getTime();

    if (Number.isNaN(startTime)) {
      return "Overdue";
    }

    const elapsedMilliseconds = Math.max(
      0,
      Date.now() - startTime
    );

    const totalHours = Math.floor(
      elapsedMilliseconds / (1000 * 60 * 60)
    );

    if (totalHours < 1) {
      return "Less than an hour";
    }

    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    if (days === 0) {
      return `${hours} ${hours === 1 ? "hour" : "hours"}`;
    }

    if (hours === 0) {
      return `${days} ${days === 1 ? "day" : "days"}`;
    }

    return `${days} ${days === 1 ? "day" : "days"}, ${hours} ${
      hours === 1 ? "hour" : "hours"
    }`;
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

  const urgentCount = requests.filter(
    (request) => getPriority(request) === "urgent"
  ).length;

  const mediumCount = requests.filter(
    (request) => getPriority(request) === "medium"
  ).length;

  const lowCount = requests.filter(
    (request) => getPriority(request) === "low"
  ).length;

  const overdueRequests = requests.filter(
    (request) => request.is_overdue === true
  );

  const filteredRequests = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return requests.filter((request) => {
      const searchableText = [
        request.tenant_name,
        request.tenant_email,
        request.description,
        request.category,
        request.title,
        request.property_name,
        request.room_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchTerm || searchableText.includes(searchTerm);

      const matchesStatus =
        statusFilter === "all" ||
        request.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" ||
        getPriority(request) === priorityFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });
  }, [requests, search, statusFilter, priorityFilter]);

  const groupedRequests = {
    urgent: filteredRequests.filter(
      (request) => getPriority(request) === "urgent"
    ),
    medium: filteredRequests.filter(
      (request) => getPriority(request) === "medium"
    ),
    low: filteredRequests.filter(
      (request) => getPriority(request) === "low"
    ),
  };

  function renderRequest(request, index) {
    return (
      <article
        key={request.id || request.request_id || index}
        style={styles.requestCard}
      >
        <h3>
          {formatCategory(request.title || request.category)}
        </h3>

        <p>
          <strong>Priority:</strong>{" "}
          {formatPriority(getPriority(request))}
        </p>

        <p>
          <strong>Description:</strong>{" "}
          {request.description || "No description provided."}
        </p>

        <p>
          <strong>Status:</strong>{" "}
          <span style={getStatusStyle(request.status)}>
            {formatStatus(request.status)}
          </span>
        </p>

        {request.tenant_name && (
          <p>
            <strong>Tenant:</strong> {request.tenant_name}
          </p>
        )}

        {request.tenant_email && (
          <p>
            <strong>Tenant email:</strong> {request.tenant_email}
          </p>
        )}

        {request.property_name && (
          <p>
            <strong>Property:</strong> {request.property_name}
          </p>
        )}

        {request.room_number && (
          <p>
            <strong>Room:</strong> {request.room_number}
          </p>
        )}

        {request.created_at && (
          <p style={styles.muted}>
            Submitted:{" "}
            {new Date(request.created_at).toLocaleString()}
          </p>
        )}
      </article>
    );
  }

  function renderPrioritySection(priority, sectionRequests) {
    if (
      priorityFilter !== "all" &&
      priorityFilter !== priority
    ) {
      return null;
    }

    return (
      <section
        key={priority}
        style={{ marginTop: "20px" }}
      >
        <h3 style={styles.sectionTitle}>
          {formatPriority(priority)} Priority (
          {sectionRequests.length})
        </h3>

        {sectionRequests.length === 0 ? (
          <p style={styles.muted}>
            No {priority} priority requests match these filters.
          </p>
        ) : (
          sectionRequests.map(renderRequest)
        )}
      </section>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.brand}>MaintainIt</h1>

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
            <p style={styles.muted}>
              Approved for maintenance
            </p>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Assigned Requests</h3>
            <p style={styles.statNumber}>
              {loading ? "..." : assignedCount}
            </p>
            <p style={styles.muted}>Assigned to fundis</p>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Urgent Priority</h3>
            <p style={styles.statNumber}>
              {loading ? "..." : urgentCount}
            </p>
            <p style={styles.muted}>Review first</p>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Medium Priority</h3>
            <p style={styles.statNumber}>
              {loading ? "..." : mediumCount}
            </p>
            <p style={styles.muted}>Normal maintenance</p>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Low Priority</h3>
            <p style={styles.statNumber}>
              {loading ? "..." : lowCount}
            </p>
            <p style={styles.muted}>Can wait</p>
          </div>
        </section>

        {/* Overdue maintenance */}
        <section
          style={{
            ...styles.card,
            marginTop: "24px",
          }}
        >
          <h2 style={styles.sectionTitle}>
            Overdue Maintenance
          </h2>

          <p style={styles.muted}>
            {loading
              ? "Checking maintenance deadlines..."
              : `${overdueRequests.length} ${
                  overdueRequests.length === 1
                    ? "request is"
                    : "requests are"
                } overdue.`}
          </p>

          {loading ? null : overdueRequests.length === 0 ? (
            <p style={styles.muted}>
              No overdue maintenance requests at the moment.
            </p>
          ) : (
            overdueRequests.map((request, index) => (
              <article
                key={request.id || request.request_id || index}
                style={styles.requestCard}
              >
                <h3>
                  {formatCategory(
                    request.title || request.category
                  )}
                </h3>

                <p>
                  <strong>Priority:</strong>{" "}
                  {formatPriority(getPriority(request))}
                </p>

                <p>
                  <strong>Status:</strong>{" "}
                  <span style={getStatusStyle(request.status)}>
                    {formatStatus(request.status)}
                  </span>
                </p>

                <p>
                  <strong>Overdue by:</strong>{" "}
                  {formatOverdueDuration(request.overdue_since)}
                </p>

                {request.description && (
                  <p>
                    <strong>Description:</strong>{" "}
                    {request.description}
                  </p>
                )}

                {request.tenant_name && (
                  <p>
                    <strong>Tenant:</strong> {request.tenant_name}
                  </p>
                )}

                {request.property_name && (
                  <p>
                    <strong>Property:</strong> {request.property_name}
                  </p>
                )}

                {request.room_number && (
                  <p>
                    <strong>Room:</strong> {request.room_number}
                  </p>
                )}

                {request.overdue_since && (
                  <p style={styles.muted}>
                    Overdue since:{" "}
                    {new Date(
                      request.overdue_since
                    ).toLocaleString()}
                  </p>
                )}
              </article>
            ))
          )}
        </section>

        <section
          style={{
            ...styles.card,
            marginTop: "24px",
          }}
        >
          <h2 style={styles.sectionTitle}>Management</h2>

          <p style={styles.muted}>
            Review tenant requests and manage maintenance assignments.
          </p>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
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

        <section
          style={{
            ...styles.card,
            marginTop: "24px",
          }}
        >
          <h2 style={styles.sectionTitle}>
            All Maintenance Requests
          </h2>

          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="request-search"
              style={styles.label}
            >
              Search requests
            </label>

            <input
              id="request-search"
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search tenant, description, category, property or room"
              style={{
                ...styles.input,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            <div style={{ flex: "1 1 180px" }}>
              <label
                htmlFor="status-filter"
                style={styles.label}
              >
                Filter by status
              </label>

              <select
                id="status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                style={{
                  ...styles.input,
                  boxSizing: "border-box",
                }}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div style={{ flex: "1 1 180px" }}>
              <label
                htmlFor="priority-filter"
                style={styles.label}
              >
                Filter by priority
              </label>

              <select
                id="priority-filter"
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value)
                }
                style={{
                  ...styles.input,
                  boxSizing: "border-box",
                }}
              >
                <option value="all">All priorities</option>
                <option value="urgent">Urgent</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <p style={styles.muted}>
            Showing {filteredRequests.length} of{" "}
            {requests.length} requests.
          </p>

          {loading ? (
            <p style={styles.muted}>Loading requests...</p>
          ) : requests.length === 0 ? (
            <p style={styles.muted}>
              No maintenance requests were returned by the server.
            </p>
          ) : filteredRequests.length === 0 ? (
            <p style={styles.muted}>
              No requests match your search and filters.
            </p>
          ) : (
            <>
              {renderPrioritySection(
                "urgent",
                groupedRequests.urgent
              )}

              {renderPrioritySection(
                "medium",
                groupedRequests.medium
              )}

              {renderPrioritySection(
                "low",
                groupedRequests.low
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminDashboard;