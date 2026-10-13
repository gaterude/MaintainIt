import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../services/api";
import { styles, getStatusStyle } from "../../styles";

function ManageRequests() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submittingId, setSubmittingId] = useState(null);

  const [decisions, setDecisions] = useState({});

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
        const data = await apiRequest(
          "/maintenance-requests/pending"
        );

        setRequests(
          Array.isArray(data.requests) ? data.requests : []
        );
      } catch (error) {
        setErrorMessage(
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

  function handleDecisionChange(requestId, field, value) {
    setDecisions((previous) => ({
      ...previous,
      [requestId]: {
        ...previous[requestId],
        [field]: value,
      },
    }));
  }

  async function handleSubmitDecision(event, request) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    const requestId = request.id || request.request_id;
    const decision = decisions[requestId] || {};

    if (!requestId) {
      setErrorMessage(
        "This request does not have a valid request ID."
      );
      return;
    }

    if (
      !decision.responsibleParty ||
      !decision.reason?.trim() ||
      decision.repairCostKes === undefined ||
      decision.repairCostKes === ""
    ) {
      setErrorMessage(
        "Choose who is responsible, enter the repair cost, and provide a reason."
      );
      return;
    }

    const repairCost = Number(decision.repairCostKes);

    if (!Number.isFinite(repairCost) || repairCost <= 0) {
      setErrorMessage(
        "Enter a repair cost greater than zero."
      );
      return;
    }

    if (!Number.isInteger(repairCost)) {
      setErrorMessage(
        "Enter the repair cost as a whole amount in KSh."
      );
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

      setRequests((previous) =>
        previous.filter(
          (item) => (item.id || item.request_id) !== requestId
        )
      );

      setDecisions((previous) => {
        const updated = { ...previous };
        delete updated[requestId];
        return updated;
      });

      setMessage(
        `Responsibility decision saved for "${request.title || "maintenance request"}".`
      );
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Unable to save the responsibility decision."
      );
    } finally {
      setSubmittingId(null);
    }
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
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => navigate("/admin/dashboard")}
        >
          Back to Dashboard
        </button>

        <div style={styles.welcome}>
          <h2>Manage Maintenance Requests</h2>
          <p style={styles.muted}>
            Review pending requests and record responsibility
            decisions and repair costs.
          </p>
        </div>

        {message && (
          <div
            role="status"
            style={{
              padding: "12px",
              marginBottom: "16px",
              border: "1px solid #86b98a",
              borderRadius: "6px",
            }}
          >
            {message}
          </div>
        )}

        {errorMessage && (
          <div role="alert" style={styles.error}>
            {errorMessage}
          </div>
        )}

        <section style={styles.card}>
          <h3 style={styles.sectionTitle}>
            Pending Requests ({requests.length})
          </h3>

          {loading ? (
            <p style={styles.muted}>Loading requests...</p>
          ) : requests.length === 0 ? (
            <p style={styles.muted}>
              No pending requests were returned by the server.
            </p>
          ) : (
            requests.map((request, index) => {
              const requestId =
                request.id || request.request_id;

              const decision = decisions[requestId] || {};
              const isSubmitting =
                submittingId === requestId;

              return (
                <article
                  key={requestId || index}
                  style={styles.requestCard}
                >
                  <h3>
                    {request.title || "Maintenance request"}
                  </h3>

                  <p>
                    {request.description ||
                      "No description provided."}
                  </p>

                  <p>
                    Status:{" "}
                    <span style={getStatusStyle(request.status)}>
                      {request.status || "Unknown"}
                    </span>
                  </p>

                  {request.room_number && (
                    <p>Room: {request.room_number}</p>
                  )}

                  {request.created_at && (
                    <p style={styles.muted}>
                      Submitted:{" "}
                      {new Date(
                        request.created_at
                      ).toLocaleString()}
                    </p>
                  )}

                  <form
                    onSubmit={(event) =>
                      handleSubmitDecision(event, request)
                    }
                  >
                    <h4>Responsibility Decision</h4>

                    <div style={{ marginBottom: "12px" }}>
                      <label
                        htmlFor={`party-${requestId}`}
                        style={{
                          display: "block",
                          marginBottom: "6px",
                        }}
                      >
                        Who is responsible for the repair?
                      </label>

                      <select
                        id={`party-${requestId}`}
                        value={decision.responsibleParty || ""}
                        onChange={(event) =>
                          handleDecisionChange(
                            requestId,
                            "responsibleParty",
                            event.target.value
                          )
                        }
                        required
                        disabled={isSubmitting}
                        style={{
                          width: "100%",
                          padding: "10px",
                          boxSizing: "border-box",
                        }}
                      >
                        <option value="">
                          Select responsible party
                        </option>
                        <option value="tenant">Tenant</option>
                        <option value="admin">Admin / Property</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <label
                        htmlFor={`cost-${requestId}`}
                        style={{
                          display: "block",
                          marginBottom: "6px",
                        }}
                      >
                        Repair cost (KSh)
                      </label>

                      <input
                        id={`cost-${requestId}`}
                        type="number"
                        min="1"
                        step="1"
                        value={decision.repairCostKes || ""}
                        onChange={(event) =>
                          handleDecisionChange(
                            requestId,
                            "repairCostKes",
                            event.target.value
                          )
                        }
                        required
                        disabled={isSubmitting}
                        placeholder="e.g. 1500"
                        style={{
                          width: "100%",
                          padding: "10px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <label
                        htmlFor={`reason-${requestId}`}
                        style={{
                          display: "block",
                          marginBottom: "6px",
                        }}
                      >
                        Reason for the decision
                      </label>

                      <textarea
                        id={`reason-${requestId}`}
                        value={decision.reason || ""}
                        onChange={(event) =>
                          handleDecisionChange(
                            requestId,
                            "reason",
                            event.target.value
                          )
                        }
                        required
                        disabled={isSubmitting}
                        rows={3}
                        placeholder="Explain why the tenant or property is responsible."
                        style={{
                          width: "100%",
                          padding: "10px",
                          boxSizing: "border-box",
                          resize: "vertical",
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      style={styles.primaryButton}
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? "Saving decision..."
                        : "Save Responsibility Decision"}
                    </button>
                  </form>
                </article>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}

export default ManageRequests;
