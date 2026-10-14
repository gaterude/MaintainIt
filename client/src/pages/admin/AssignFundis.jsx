
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../services/api";
import { styles, getStatusStyle } from "../../styles";

function AssignFundis() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [fundis, setFundis] = useState([]);
  const [fundiIds, setFundiIds] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingFundis, setLoadingFundis] = useState(true);
  const [assigningId, setAssigningId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

    loadRequests();
    loadFundis();
  }, [navigate]);

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/maintenance-requests/all");

      const allRequests = Array.isArray(data.requests)
        ? data.requests
        : [];

      setRequests(
        allRequests.filter(
          (request) => request.status === "approved"
        )
      );
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to load approved maintenance requests."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadFundis() {
    setLoadingFundis(true);

    try {
      const data = await apiRequest("/users/fundis");

      setFundis(
        Array.isArray(data.fundis) ? data.fundis : []
      );
    } catch (fundiError) {
      setError(
        fundiError.message || "Unable to load registered fundis."
      );
    } finally {
      setLoadingFundis(false);
    }
  }

  async function handleAssignment(event, requestId) {
    event.preventDefault();

    const fundiId = fundiIds[requestId];

    if (!fundiId) {
      setError("Please select a fundi before assigning the job.");
      setMessage("");
      return;
    }

    setAssigningId(requestId);
    setMessage("");
    setError("");

    try {
      const data = await apiRequest("/maintenance-assignments", {
        method: "POST",
        body: JSON.stringify({
          requestId,
          fundiId,
        }),
      });

      setMessage(data.message || "Fundi assigned successfully.");

      setFundiIds((previous) => {
        const updated = { ...previous };
        delete updated[requestId];
        return updated;
      });

      await loadRequests();
    } catch (assignmentError) {
      setError(
        assignmentError.message || "Unable to assign the fundi."
      );
    } finally {
      setAssigningId(null);
    }
  }

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
          <h2>Assign Fundis</h2>

          <p style={styles.muted}>
            Assign approved maintenance jobs to registered fundis.
          </p>
        </div>

        {message && (
          <div role="status" style={styles.message}>
            {message}
          </div>
        )}

        {error && (
          <div role="alert" style={styles.error}>
            {error}
          </div>
        )}

        <section style={styles.card}>
          <h3 style={styles.sectionTitle}>
            Approved Maintenance Requests ({requests.length})
          </h3>

          {loading ? (
            <p style={styles.muted}>Loading requests...</p>
          ) : requests.length === 0 ? (
            <p style={styles.muted}>
              No approved requests are currently available for
              assignment. Approve a pending request first, then
              refresh this page.
            </p>
          ) : (
            requests.map((request, index) => {
              const requestId = request.id || request.request_id;

              return (
                <article
                  key={requestId || index}
                  style={styles.requestCard}
                >
                  <h3>
                    {formatCategory(
                      request.category || request.title
                    )}
                  </h3>

                  <p>
                    <strong>Description:</strong>{" "}
                    {request.description ||
                      "No description provided."}
                  </p>

                  <p>
                    <strong>Status:</strong>{" "}
                    <span style={getStatusStyle(request.status)}>
                      {request.status || "Unknown"}
                    </span>
                  </p>

                  {request.tenant_name && (
                    <p>
                      <strong>Tenant:</strong>{" "}
                      {request.tenant_name}
                    </p>
                  )}

                  {request.property_name && (
                    <p>
                      <strong>Property:</strong>{" "}
                      {request.property_name}
                    </p>
                  )}

                  {request.room_number && (
                    <p>
                      <strong>Room:</strong>{" "}
                      {request.room_number}
                    </p>
                  )}

                  {!requestId ? (
                    <p style={styles.error}>
                      This request has no identifiable ID.
                    </p>
                  ) : (
                    <form
                      onSubmit={(event) =>
                        handleAssignment(event, requestId)
                      }
                    >
                      <label
                        htmlFor={`fundi-${requestId}`}
                        style={styles.label}
                      >
                        Select Fundi
                      </label>

                      <select
                        id={`fundi-${requestId}`}
                        style={styles.input}
                        value={fundiIds[requestId] || ""}
                        onChange={(event) =>
                          setFundiIds((previous) => ({
                            ...previous,
                            [requestId]: event.target.value,
                          }))
                        }
                        disabled={
                          loadingFundis || fundis.length === 0
                        }
                        required
                      >
                        <option value="">
                          {loadingFundis
                            ? "Loading fundis..."
                            : fundis.length === 0
                              ? "No registered fundis available"
                              : "Choose a fundi"}
                        </option>

                        {fundis.map((fundi) => (
                          <option
                            key={fundi.id}
                            value={fundi.id}
                          >
                            {fundi.name} —{" "}
                            {fundi.phone || fundi.email}
                          </option>
                        ))}
                      </select>

                      <button
                        type="submit"
                        style={{
                          ...styles.button,
                          opacity:
                            assigningId === requestId ? 0.7 : 1,
                        }}
                        disabled={
                          assigningId !== null ||
                          loadingFundis ||
                          fundis.length === 0
                        }
                      >
                        {assigningId === requestId
                          ? "Assigning..."
                          : "Assign Fundi"}
                      </button>
                    </form>
                  )}
                </article>
              );
            })
          )}

          {!loading && (
            <button
              type="button"
              style={{
                ...styles.secondaryButton,
                marginTop: "16px",
              }}
              onClick={() => {
                loadRequests();
                loadFundis();
              }}
            >
              Refresh Requests
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

export default AssignFundis;
