import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../services/api";
import AdminLayout from "../../components/admin/AdminLayout";
import { toast } from "../../components/toast/toast";
import "./ManageRequests.css";

const CATEGORIES = ["plumbing", "electrical", "cleaning", "appliance", "structural", "other"];

function formatCategory(category) {
  if (!category) return "Uncategorized";
  return category.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPriority(request) {
  return ["urgent", "medium", "low"].includes(request.priority) ? request.priority : "medium";
}

function ManageRequests() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  // Which request has its decision form open (one at a time keeps the table tidy).
  const [openId, setOpenId] = useState(null);

  const [decisions, setDecisions] = useState({});
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Flow: check the admin is logged in -> load pending requests once.
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
        if (user.role === "tenant") navigate("/tenant/dashboard", { replace: true });
        else if (user.role === "fundi") navigate("/fundi/dashboard", { replace: true });
        else navigate("/login", { replace: true });
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
        const data = await apiRequest("/maintenance-requests/pending");
        setRequests(Array.isArray(data.requests) ? data.requests : []);
      } catch (error) {
        toast.error(error.message || "Unable to load maintenance requests.");
      } finally {
        setLoading(false);
      }
    }

    loadRequests();
  }, [navigate]);

  function handleDecisionChange(requestId, field, value) {
    setDecisions((previous) => ({
      ...previous,
      [requestId]: { ...previous[requestId], [field]: value },
    }));
  }

  // Flow: validate the form -> save the decision -> remove the request from the list.
  async function handleSubmitDecision(event, request) {
    event.preventDefault();

    const requestId = request.id || request.request_id;
    const decision = decisions[requestId] || {};

    if (!requestId) {
      toast.error("This request does not have a valid request ID.");
      return;
    }

    if (!decision.responsibleParty || !decision.reason?.trim() || decision.repairCostKes === undefined || decision.repairCostKes === "") {
      toast.error("Choose who is responsible, enter the repair cost and give a reason.");
      return;
    }

    const repairCost = Number(decision.repairCostKes);

    if (!Number.isFinite(repairCost) || repairCost <= 0) {
      toast.error("Enter a repair cost greater than zero.");
      return;
    }

    if (!Number.isInteger(repairCost)) {
      toast.error("Enter the repair cost as a whole amount in KSh.");
      return;
    }

    setSubmittingId(requestId);

    try {
      await apiRequest("/maintenance-responsibilities", {
        method: "POST",
        body: JSON.stringify({
          requestId,
          responsibleParty: decision.responsibleParty,
          reason: decision.reason.trim(),
          repairCostKes: repairCost,
        }),
      });

      setRequests((previous) => previous.filter((item) => (item.id || item.request_id) !== requestId));
      setDecisions((previous) => {
        const updated = { ...previous };
        delete updated[requestId];
        return updated;
      });
      setOpenId(null);
      toast.success("Responsibility decision saved.");
    } catch (error) {
      toast.error(error.message || "Unable to save the responsibility decision.");
    } finally {
      setSubmittingId(null);
    }
  }

  const priorityCounts = {
    urgent: requests.filter((r) => getPriority(r) === "urgent").length,
    medium: requests.filter((r) => getPriority(r) === "medium").length,
    low: requests.filter((r) => getPriority(r) === "low").length,
  };

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((request) => {
      const text = [request.tenant_name, request.tenant_email, request.description, request.category, request.title, request.property_name, request.room_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!term || text.includes(term)) &&
        (priorityFilter === "all" || getPriority(request) === priorityFilter) &&
        (categoryFilter === "all" || request.category === categoryFilter)
      );
    });
  }, [requests, search, priorityFilter, categoryFilter]);

  return (
    <AdminLayout
      title="Manage requests"
      description="Review pending requests, decide who pays and record the repair cost."
    >
      <div className="mr-strip">
        {[
          ["urgent", "Urgent"],
          ["medium", "Medium"],
          ["low", "Low"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={"mr-strip-item" + (priorityFilter === key ? " is-on" : "")}
            onClick={() => setPriorityFilter(priorityFilter === key ? "all" : key)}
          >
            <span>{label}</span>
            <strong>{loading ? "..." : priorityCounts[key]}</strong>
          </button>
        ))}
      </div>

      <div className="mr-filters">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tenant, description, property or room"
          aria-label="Search requests"
        />
        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="Filter by priority">
          <option value="all">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>{formatCategory(category)}</option>
          ))}
        </select>
      </div>

      <section className="mr-card">
        <div className="mr-card-head">
          <h2>Pending requests ({filteredRequests.length})</h2>
          <span>Showing {filteredRequests.length} of {requests.length}</span>
        </div>

        {loading ? (
          <p className="mr-empty">Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="mr-empty">No pending requests. New requests from tenants will appear here.</p>
        ) : filteredRequests.length === 0 ? (
          <p className="mr-empty">No pending requests match your search and filters.</p>
        ) : (
          <div className="mr-list">
            <div className="mr-row mr-row-head">
              <span>Request</span><span>Tenant and room</span><span>Priority</span><span>Submitted</span><span />
            </div>

            {filteredRequests.map((request, index) => {
              const requestId = request.id || request.request_id;
              const decision = decisions[requestId] || {};
              const isOpen = openId === requestId;
              const isSubmitting = submittingId === requestId;
              const priority = getPriority(request);

              return (
                <div className="mr-item" key={requestId || index}>
                  <div className="mr-row">
                    <span>
                      <strong>{formatCategory(request.category || request.title)}</strong>
                      <small>{request.description || "No description provided."}</small>
                    </span>
                    <span>
                      {request.tenant_name || "-"}
                      <small>{[request.property_name, request.room_number && `Room ${request.room_number}`].filter(Boolean).join(", ") || "-"}</small>
                    </span>
                    <span><em className={`mr-badge mr-${priority}`}>{priority[0].toUpperCase() + priority.slice(1)}</em></span>
                    <span>{request.created_at ? new Date(request.created_at).toLocaleDateString("en-KE") : "-"}</span>
                    <span className="mr-action">
                      <button type="button" className={isOpen ? "mr-btn-outline" : "mr-btn"} onClick={() => setOpenId(isOpen ? null : requestId)}>
                        {isOpen ? "Close" : "Review"}
                      </button>
                    </span>
                  </div>

                  {isOpen && (
                    <form className="mr-form" onSubmit={(event) => handleSubmitDecision(event, request)}>
                      <label>
                        Who is responsible for the repair?
                        <select value={decision.responsibleParty || ""} onChange={(event) => handleDecisionChange(requestId, "responsibleParty", event.target.value)} disabled={isSubmitting}>
                          <option value="">Select responsible party</option>
                          <option value="tenant">Tenant</option>
                          <option value="admin">Admin / Property</option>
                        </select>
                      </label>

                      <label>
                        Repair cost (KSh)
                        <input type="number" min="1" step="1" placeholder="e.g. 1500" value={decision.repairCostKes ?? ""} onChange={(event) => handleDecisionChange(requestId, "repairCostKes", event.target.value)} disabled={isSubmitting} />
                      </label>

                      <label className="mr-wide">
                        Reason for the decision
                        <textarea rows={3} placeholder="Explain why the tenant or property is responsible." value={decision.reason || ""} onChange={(event) => handleDecisionChange(requestId, "reason", event.target.value)} disabled={isSubmitting} />
                      </label>

                      <div className="mr-wide mr-form-actions">
                        <button type="submit" className="mr-btn mr-btn-green" disabled={isSubmitting}>
                          {isSubmitting ? "Saving..." : "Save decision"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}

export default ManageRequests;