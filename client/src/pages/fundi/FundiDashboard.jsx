import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../services/api";
import { styles, getStatusStyle } from "../../styles";

function FundiDashboard() {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyJobId, setBusyJobId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [user] = useState(() =>
    JSON.parse(localStorage.getItem("user") || "null")
  );

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(
        "/maintenance-assignments/my-jobs"
      );

      setJobs(
        Array.isArray(data.assignments) ? data.assignments : []
      );
    } catch (err) {
      setError(err.message || "Unable to load your jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("token") || !user) {
      navigate("/login", { replace: true });
      return;
    }

    if (user.role !== "fundi") {
      if (user.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/tenant/dashboard", { replace: true });
      }

      return;
    }

    loadJobs();
  }, [navigate, user, loadJobs]);

  async function handleJobAction(requestId, action) {
    setBusyJobId(requestId);
    setMessage("");
    setError("");

    try {
      const endpoint =
        action === "accept"
          ? "/maintenance-assignments/accept"
          : "/maintenance-assignments/complete";

      const data = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({ requestId }),
      });

      setMessage(
        data.message ||
          (action === "accept"
            ? "Job accepted successfully."
            : "Job marked as completed.")
      );

      await loadJobs();
    } catch (err) {
      setError(err.message || "Unable to update this job.");
    } finally {
      setBusyJobId(null);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  function formatCategory(category) {
    if (!category) {
      return "Maintenance Job";
    }

    return category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  const assignedCount = jobs.filter(
    (job) => job.status === "assigned"
  ).length;

  const inProgressCount = jobs.filter(
    (job) => job.status === "in_progress"
  ).length;

  const completedCount = jobs.filter(
    (job) => job.status === "completed"
  ).length;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.brand}>MaintainIt</h1>
          <p style={styles.muted}>Fundi Dashboard</p>
        </div>

        <button
          type="button"
          style={styles.secondaryButton}
          onClick={handleLogout}
        >
          Logout
        </button>
      </header>

      <main style={styles.container}>
        <section style={styles.welcome}>
          <h2>Welcome, {user?.name || "Fundi"}</h2>

          <p style={styles.muted}>
            View your assigned maintenance jobs and update their
            progress.
          </p>
        </section>

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

        <section style={styles.grid}>
          <div style={styles.card}>
            <p style={styles.muted}>Assigned</p>
            <h2 style={styles.statNumber}>{assignedCount}</h2>
          </div>

          <div style={styles.card}>
            <p style={styles.muted}>In progress</p>
            <h2 style={styles.statNumber}>{inProgressCount}</h2>
          </div>

          <div style={styles.card}>
            <p style={styles.muted}>Completed</p>
            <h2 style={styles.statNumber}>{completedCount}</h2>
          </div>
        </section>

        <section style={{ marginTop: "30px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h2 style={styles.sectionTitle}>
              My Maintenance Jobs
            </h2>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={loadJobs}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh jobs"}
            </button>
          </div>

          {loading ? (
            <p style={styles.muted}>Loading your jobs...</p>
          ) : jobs.length === 0 ? (
            <div style={styles.card}>
              <p style={styles.muted}>
                No maintenance jobs have been assigned to you yet.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {jobs.map((job) => {
                const isBusy =
                  busyJobId === job.maintenance_request_id;

                return (
                  <article
                    key={job.assignment_id}
                    style={styles.requestCard}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>
                        {formatCategory(
                          job.category || job.title
                        )}
                      </h3>

                      <span style={getStatusStyle(job.status)}>
                        {(job.status || "unknown").replace(
                          /_/g,
                          " "
                        )}
                      </span>
                    </div>

                    <p>
                      <strong>Description:</strong>{" "}
                      {job.description ||
                        "No description provided."}
                    </p>

                    <p>
                      <strong>Property:</strong>{" "}
                      {job.property_name || "Not available"}
                    </p>

                    <p>
                      <strong>Address:</strong>{" "}
                      {job.property_address || "Not available"}
                    </p>

                    <p>
                      <strong>Room:</strong>{" "}
                      {job.room_number || "Not available"}
                    </p>

                    <p style={styles.muted}>
                      Assigned:{" "}
                      {job.assigned_at
                        ? new Date(
                            job.assigned_at
                          ).toLocaleString()
                        : "Date not available"}
                    </p>

                    {job.accepted_at && (
                      <p style={styles.muted}>
                        Accepted:{" "}
                        {new Date(
                          job.accepted_at
                        ).toLocaleString()}
                      </p>
                    )}

                    {job.completed_at && (
                      <p style={styles.muted}>
                        Completed:{" "}
                        {new Date(
                          job.completed_at
                        ).toLocaleString()}
                      </p>
                    )}

                    {job.status === "assigned" && (
                      <button
                        type="button"
                        style={styles.button}
                        onClick={() =>
                          handleJobAction(
                            job.maintenance_request_id,
                            "accept"
                          )
                        }
                        disabled={
                          isBusy || busyJobId !== null
                        }
                      >
                        {isBusy ? "Processing..." : "Accept Job"}
                      </button>
                    )}

                    {job.status === "in_progress" && (
                      <button
                        type="button"
                        style={styles.button}
                        onClick={() =>
                          handleJobAction(
                            job.maintenance_request_id,
                            "complete"
                          )
                        }
                        disabled={
                          isBusy || busyJobId !== null
                        }
                      >
                        {isBusy
                          ? "Processing..."
                          : "Mark as Completed"}
                      </button>
                    )}

                    {job.status === "completed" && (
                      <p style={styles.muted}>
                        This job has been completed.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default FundiDashboard;
