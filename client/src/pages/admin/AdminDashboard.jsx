import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../services/api";
import { getStatusStyle } from "../../styles";
import "./AdminDashboard.css";

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

  function handleStatClick(type, value) {
    setSearch("");

    if (type === "status") {
      setStatusFilter(value);
      setPriorityFilter("all");
    } else {
      setStatusFilter("all");
      setPriorityFilter(value);
    }

    document.getElementById("all-requests")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleStatKeyDown(event, type, value) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleStatClick(type, value);
    }
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
    const priority = getPriority(request);
    const paymentStatus = request.payment_status;
    const paymentMethod = request.payment_method;

    let paymentLabel = "Not recorded";
    let paymentDescription = "";

    if (paymentStatus === "paid") {
      paymentLabel = "Paid";
      paymentDescription =
        paymentMethod === "cash"
          ? "Cash received and confirmed by the fundi."
          : "Payment completed.";
    } else if (
      paymentStatus === "pending" ||
      paymentStatus === "processing"
    ) {
      paymentLabel =
        paymentMethod === "cash"
          ? "Cash awaiting confirmation"
          : paymentStatus === "processing"
            ? "M-Pesa processing"
            : "Payment pending";

      paymentDescription =
        paymentMethod === "cash"
          ? "Awaiting the assigned fundi's confirmation."
          : "Payment has not been completed.";
    } else if (
      paymentStatus === "failed" ||
      paymentStatus === "cancelled"
    ) {
      paymentLabel = "Payment not completed";
      paymentDescription =
        "The latest payment attempt was not completed.";
    }

    return (
      <article
        className="admin-request-card"
        key={request.id || request.request_id || index}
      >
        <div className="admin-request-main">
          <div className="admin-request-heading">
            <h4>
              {formatCategory(request.title || request.category)}
            </h4>

            <span className={`admin-priority admin-priority-${priority}`}>
              {formatPriority(priority)} priority
            </span>
          </div>

          <p className="admin-request-description">
            {request.description || "No description provided."}
          </p>

          <div className="admin-request-details">
            {request.tenant_name && (
              <div className="admin-detail">
                <span className="admin-detail-label">Tenant</span>
                <span>{request.tenant_name}</span>
              </div>
            )}

            {request.tenant_email && (
              <div className="admin-detail">
                <span className="admin-detail-label">Email</span>
                <span>{request.tenant_email}</span>
              </div>
            )}

            {request.property_name && (
              <div className="admin-detail">
                <span className="admin-detail-label">Property</span>
                <span>{request.property_name}</span>
              </div>
            )}

            {request.room_number && (
              <div className="admin-detail">
                <span className="admin-detail-label">Room</span>
                <span>{request.room_number}</span>
              </div>
            )}

            {request.responsible_party && (
              <div className="admin-detail">
                <span className="admin-detail-label">Responsible party</span>
                <span>{formatStatus(request.responsible_party)}</span>
              </div>
            )}

            {request.repair_cost_cents != null && (
              <div className="admin-detail">
                <span className="admin-detail-label">Repair cost</span>
                <span>
                  KSh{" "}
                  {(Number(request.repair_cost_cents) / 100).toLocaleString(
                    "en-KE",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </span>
              </div>
            )}

            <div className="admin-detail">
              <span className="admin-detail-label">Payment method</span>
              <span>
                {paymentMethod ? formatStatus(paymentMethod) : "Not recorded"}
              </span>
            </div>

            <div className="admin-detail">
              <span className="admin-detail-label">Payment status</span>
              <span>{paymentLabel}</span>
            </div>

            {paymentDescription && (
              <div className="admin-detail">
                <span className="admin-detail-label">Payment details</span>
                <span>{paymentDescription}</span>
              </div>
            )}
          </div>
        </div>

        <div className="admin-request-side">
          <span className="admin-status-label">Status</span>

          <span
            className="admin-status-badge"
            style={getStatusStyle(request.status)}
          >
            {formatStatus(request.status)}
          </span>

          {request.created_at && (
            <p className="admin-submitted-date">
              Submitted
              <br />
              {new Date(request.created_at).toLocaleString()}
            </p>
          )}
        </div>
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
      <section className="admin-priority-section" key={priority}>
        <div className="admin-priority-heading">
          <h3>{formatPriority(priority)} Priority</h3>
          <span>{sectionRequests.length}</span>
        </div>

        {sectionRequests.length === 0 ? (
          <div className="admin-empty-priority">
            No {priority} priority requests match these filters.
          </div>
        ) : (
          <div className="admin-request-list">
            {sectionRequests.map(renderRequest)}
          </div>
        )}
      </section>
    );
  }

  function renderStatCard({
    className,
    label,
    count,
    title,
    type,
    value,
  }) {
    return (
      <article
        className={`admin-stat-card ${className}`}
        onClick={() => handleStatClick(type, value)}
        onKeyDown={(event) => handleStatKeyDown(event, type, value)}
        role="button"
        tabIndex={0}
        aria-label={`${title}: ${count}. View matching maintenance requests.`}
      >
        <div className="admin-stat-top">
          <span className="admin-stat-label">{label}</span>
        </div>

        <p className="admin-stat-number">
          {loading ? "—" : count}
        </p>

        <h2>{title}</h2>
      </article>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <a
            href="#dashboard"
            className="admin-brand"
            onClick={(event) => {
              event.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <span>
              Maintain<span className="admin-brand-accent">It</span>
            </span>
          </a>

          <div className="admin-header-right">
            <span className="admin-role-label">
              Property administrator
            </span>

            <button
              type="button"
              className="admin-logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="admin-main" id="dashboard">
        <section className="admin-welcome">
          <div>
            <p className="admin-eyebrow">OVERVIEW</p>

            <h1>Admin Dashboard</h1>

            <p className="admin-welcome-description">
              Monitor maintenance activity, review requests, and
              coordinate your fundi assignments.
            </p>
          </div>
        </section>

        {message && (
          <div className="admin-error-message" role="alert">
            <span>{message}</span>
          </div>
        )}

        <section
          className="admin-stats-grid"
          aria-label="Maintenance statistics"
        >
          {renderStatCard({
            className: "admin-stat-pending",
            label: "Awaiting review",
            count: pendingCount,
            title: "Pending Requests",
            type: "status",
            value: "pending",
          })}

          {renderStatCard({
            className: "admin-stat-approved",
            label: "Ready to proceed",
            count: approvedCount,
            title: "Approved Requests",
            type: "status",
            value: "approved",
          })}

          {renderStatCard({
            className: "admin-stat-assigned",
            label: "With fundis",
            count: assignedCount,
            title: "Assigned Requests",
            type: "status",
            value: "assigned",
          })}

          {renderStatCard({
            className: "admin-stat-urgent",
            label: "Review first",
            count: urgentCount,
            title: "Urgent Priority",
            type: "priority",
            value: "urgent",
          })}

          {renderStatCard({
            className: "admin-stat-medium",
            label: "Normal maintenance",
            count: mediumCount,
            title: "Medium Priority",
            type: "priority",
            value: "medium",
          })}

          {renderStatCard({
            className: "admin-stat-low",
            label: "Can wait",
            count: lowCount,
            title: "Low Priority",
            type: "priority",
            value: "low",
          })}
        </section>

        <section className="admin-panel admin-overdue-panel">
          <div className="admin-panel-heading admin-overdue-heading">
            <div className="admin-panel-title-group">
              <div>
                <h2>Overdue Maintenance</h2>

                <p>
                  {loading
                    ? "Checking maintenance deadlines..."
                    : overdueRequests.length === 1
                      ? "1 request needs attention."
                      : `${overdueRequests.length} requests need attention.`}
                </p>
              </div>
            </div>

            {!loading && (
              <span className="admin-overdue-count">
                {overdueRequests.length} overdue
              </span>
            )}
          </div>

          {loading ? (
            <p className="admin-panel-message">
              Checking maintenance deadlines...
            </p>
          ) : overdueRequests.length === 0 ? (
            <div className="admin-success-empty">
              <div>
                <strong>You're all caught up!</strong>
                <p>No overdue maintenance requests at the moment.</p>
              </div>
            </div>
          ) : (
            <div className="admin-overdue-list">
              {overdueRequests.map((request, index) => (
                <article
                  className="admin-overdue-item"
                  key={request.id || request.request_id || index}
                >
                  <div className="admin-overdue-item-main">
                    <h3>
                      {formatCategory(request.title || request.category)}
                    </h3>

                    <p>
                      {request.tenant_name || "Tenant not specified"}

                      {request.property_name
                        ? ` · ${request.property_name}`
                        : ""}

                      {request.room_number
                        ? ` · Room ${request.room_number}`
                        : ""}
                    </p>

                    {request.description && (
                      <p className="admin-overdue-description">
                        {request.description}
                      </p>
                    )}
                  </div>

                  <div className="admin-overdue-item-side">
                    <span
                      className="admin-status-badge"
                      style={getStatusStyle(request.status)}
                    >
                      {formatStatus(request.status)}
                    </span>

                    <span className="admin-overdue-duration">
                      Overdue by{" "}
                      {formatOverdueDuration(request.overdue_since)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-panel admin-management-panel">
          <div>
            <p className="admin-eyebrow">WORKSPACE</p>
            <h2>Management</h2>

            <p className="admin-panel-description">
              Review tenant requests and manage maintenance assignments.
            </p>
          </div>

          <div className="admin-management-actions">
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => navigate("/admin/requests")}
            >
              Manage Requests
            </button>

            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => navigate("/admin/assignments")}
            >
              Assign Fundis
            </button>

            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => navigate("/admin/tenant-assignments")}
            >
              Assign Tenants to Rooms
            </button>
          </div>
        </section>

        <section
          id="all-requests"
          className="admin-panel admin-all-requests"
        >
          <div className="admin-all-requests-heading">
            <div>
              <p className="admin-eyebrow">REQUEST OVERVIEW</p>
              <h2>All Maintenance Requests</h2>

              <p className="admin-panel-description">
                Search, filter, and review maintenance reported by tenants.
              </p>
            </div>

            <div className="admin-total-count">
              <span>{loading ? "—" : requests.length}</span>
              <small>Total requests</small>
            </div>
          </div>

          <div className="admin-filters">
            <div className="admin-search-field">
              <label htmlFor="request-search">
                Search requests
              </label>

              <div className="admin-input-wrapper">
                <input
                  id="request-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tenant, description, property or room"
                />
              </div>
            </div>

            <div className="admin-filter-field">
              <label htmlFor="status-filter">Status</label>

              <select
                id="status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
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

            <div className="admin-filter-field">
              <label htmlFor="priority-filter">Priority</label>

              <select
                id="priority-filter"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="all">All priorities</option>
                <option value="urgent">Urgent</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="admin-results-bar">
            <p>
              Showing <strong>{filteredRequests.length}</strong> of{" "}
              <strong>{requests.length}</strong> requests
            </p>

            {(search ||
              statusFilter !== "all" ||
              priorityFilter !== "all") && (
              <button
                type="button"
                className="admin-clear-filters"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="admin-list-message">
              <span className="admin-loading-indicator" />
              Loading maintenance requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="admin-empty-state">
              <h3>No maintenance requests yet</h3>
              <p>New requests submitted by tenants will appear here.</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="admin-empty-state">
              <h3>No matching requests</h3>
              <p>Try changing your search term or filters.</p>

              <button
                type="button"
                className="admin-secondary-button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="admin-priority-groups">
              {renderPrioritySection("urgent", groupedRequests.urgent)}
              {renderPrioritySection("medium", groupedRequests.medium)}
              {renderPrioritySection("low", groupedRequests.low)}
            </div>
          )}
        </section>

        <footer className="admin-footer">
          <span>MaintainIt</span>
          <span>Property maintenance management</span>
        </footer>
      </main>
    </div>
  );
}

export default AdminDashboard;
