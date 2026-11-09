import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../services/api";
import { getStatusStyle } from "../../styles";
import "./FundiDashboard.css";

function FundiDashboard() {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyJobId, setBusyJobId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [appointmentDates, setAppointmentDates] = useState({});
  const [appointmentError, setAppointmentError] = useState("");

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
      try {
        const appointmentData = await apiRequest("/appointments/my-jobs");

        setAppointments(
          Array.isArray(appointmentData.appointments)
            ? appointmentData.appointments
            : []
        );

        setAppointmentError("");
      } catch (appointmentLoadError) {
        setAppointmentError(
          appointmentLoadError.message ||
            "Unable to load appointment information."
        );
      }
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

    // Flow: wait one tick -> load the fundi's jobs and appointments.
    const timerId = window.setTimeout(() => {
      loadJobs();
    }, 0);

    // Cancel the pending load if the page closes before it runs.
    return () => window.clearTimeout(timerId);
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
  function formatAppointmentDate(value) {
    if (!value) return "Not scheduled";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function getLatestAppointment(requestId) {
    return (
      appointments
        .filter(
          (appointment) =>
            appointment.maintenance_request_id === requestId
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )[0] || null
    );
  }

  async function handleAppointmentSubmit(job) {
    const requestId = job.maintenance_request_id;
    const selectedDateTime = appointmentDates[requestId];

    if (!selectedDateTime) {
      setAppointmentError("Choose a proposed visit date and time.");
      return;
    }

    const proposedDate = new Date(selectedDateTime);

    if (
      Number.isNaN(proposedDate.getTime()) ||
      // This runs only when the fundi clicks the button (an event handler),
      // so reading the clock here is correct. Lint wrongly treats it as render.
      // eslint-disable-next-line react-hooks/purity
      proposedDate.getTime() <= Date.now()
    ) {
      setAppointmentError(
        "The proposed visit date and time must be in the future."
      );
      return;
    }

    const existingAppointment = getLatestAppointment(requestId);
    const isReschedule =
      existingAppointment?.status === "reschedule_requested";

    setBusyJobId(requestId);
    setMessage("");
    setError("");
    setAppointmentError("");

    try {
      const proposedVisitAt = proposedDate.toISOString();

      const endpoint = isReschedule
        ? `/appointments/${existingAppointment.id}/reschedule`
        : "/appointments";

      const body = isReschedule
        ? { proposedVisitAt }
        : { requestId, proposedVisitAt };

      const data = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setMessage(
        data.message ||
          (isReschedule
            ? "Replacement visit time proposed successfully."
            : "Visit time proposed successfully.")
      );

      setAppointmentDates((current) => {
        const updated = { ...current };
        delete updated[requestId];
        return updated;
      });

      await loadJobs();
    } catch (err) {
      setAppointmentError(
        err.message || "Unable to save the proposed visit time."
      );
    } finally {
      setBusyJobId(null);
    }
  }
  async function handleConfirmCash(job) {
    if (!job.payment_id) {
      setError("Payment details are unavailable. Refresh your jobs and try again.");
      return;
    }

    const confirmed = window.confirm(
      "Confirm that you have received the cash payment for this completed job?"
    );

    if (!confirmed) {
      return;
    }

    setBusyJobId(job.maintenance_request_id);
    setMessage("");
    setError("");

    try {
      const data = await apiRequest(
        `/payments/cash/${job.payment_id}/confirm`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      setMessage(
        data.message || "Cash payment confirmed successfully."
      );

      await loadJobs();
    } catch (err) {
      setError(
        err.message || "Unable to confirm the cash payment."
      );
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

  function formatStatus(status) {
    return (status || "unknown")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatDate(date) {
    if (!date) {
      return "Date not available";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Date not available";
    }

    return parsedDate.toLocaleString();
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

  const filteredJobs =
    activeFilter === "all"
      ? jobs
      : jobs.filter((job) => job.status === activeFilter);

  function selectFilter(filter) {
    setActiveFilter(filter);

    window.setTimeout(() => {
      document
        .getElementById("fundi-jobs")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 0);
  }

  const filterHeading =
    activeFilter === "assigned"
      ? "Assigned Jobs"
      : activeFilter === "in_progress"
        ? "Jobs In Progress"
        : activeFilter === "completed"
          ? "Completed Jobs"
          : "My Maintenance Jobs";

  return (
    <div className="fundi-page">
      <header className="fundi-header">
        <div className="fundi-header-inner">
          <div className="fundi-brand">
            <span className="fundi-brand-icon">M</span>

            <div>
              <h1>MaintainIt</h1>
              <p>Maintenance management</p>
            </div>
          </div>

          <div className="fundi-header-actions">
            <span className="fundi-user-label">
              {user?.name || "Fundi"}
            </span>

            <button
              type="button"
              className="fundi-logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="fundi-main">
        <section className="fundi-welcome">
          <div>
            <span className="fundi-eyebrow">
              FUNDI WORKSPACE
            </span>

            <h2>Welcome back, {user?.name || "Fundi"}</h2>

            <p>
              Keep track of your assigned maintenance jobs and
              update their progress from one place.
            </p>
          </div>

          <button
            type="button"
            className="fundi-refresh-button"
            onClick={loadJobs}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh jobs"}
          </button>
        </section>

        {message && (
          <div
            className="fundi-alert fundi-alert-success"
            role="status"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            className="fundi-alert fundi-alert-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <section className="fundi-stats">
          <button
            type="button"
            className={`fundi-stat-card fundi-stat-button ${
              activeFilter === "assigned"
                ? "fundi-stat-active"
                : ""
            }`}
            onClick={() => selectFilter("assigned")}
            aria-pressed={activeFilter === "assigned"}
          >
            <div className="fundi-stat-top">
              <span className="fundi-stat-caption">
                Awaiting action
              </span>
            </div>

            <p className="fundi-stat-label">Assigned jobs</p>

            <h3>{assignedCount}</h3>

            <div className="fundi-stat-footer">
              Jobs waiting for you to accept
            </div>
          </button>

          <button
            type="button"
            className={`fundi-stat-card fundi-stat-button ${
              activeFilter === "in_progress"
                ? "fundi-stat-active"
                : ""
            }`}
            onClick={() => selectFilter("in_progress")}
            aria-pressed={activeFilter === "in_progress"}
          >
            <div className="fundi-stat-top">
              <span className="fundi-stat-caption">
                In progress
              </span>
            </div>

            <p className="fundi-stat-label">Active jobs</p>

            <h3>{inProgressCount}</h3>

            <div className="fundi-stat-footer">
              Jobs currently being handled
            </div>
          </button>

          <button
            type="button"
            className={`fundi-stat-card fundi-stat-button ${
              activeFilter === "completed"
                ? "fundi-stat-active"
                : ""
            }`}
            onClick={() => selectFilter("completed")}
            aria-pressed={activeFilter === "completed"}
          >
            <div className="fundi-stat-top">
              <span className="fundi-stat-caption">
                Finished
              </span>
            </div>

            <p className="fundi-stat-label">Completed jobs</p>

            <h3>{completedCount}</h3>

            <div className="fundi-stat-footer">
              Successfully completed jobs
            </div>
          </button>
        </section>

        <section
          className="fundi-jobs-section"
          id="fundi-jobs"
        >
          <div className="fundi-section-heading">
            <div>
              <span className="fundi-eyebrow">YOUR WORK</span>

              <h2>{filterHeading}</h2>

              <p>
                Review job details and take action on your assignments.
              </p>
            </div>

            <div className="fundi-heading-actions">
              <span className="fundi-total-badge">
                {filteredJobs.length}{" "}
                {filteredJobs.length === 1 ? "job" : "jobs"}
              </span>

              {activeFilter !== "all" && (
                <button
                  type="button"
                  className="fundi-refresh-button"
                  onClick={() => selectFilter("all")}
                >
                  View all jobs
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="fundi-state-card">
              <div className="fundi-loading-spinner" />

              <h3>Loading your jobs</h3>

              <p>
                Please wait while we retrieve your assignments.
              </p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="fundi-state-card">
              <h3>
                {activeFilter === "all"
                  ? "No assigned jobs yet"
                  : `No ${formatStatus(activeFilter).toLowerCase()} jobs`}
              </h3>

              <p>
                {activeFilter === "all"
                  ? "New maintenance assignments will appear here when the admin assigns work to you."
                  : "There are currently no jobs in this category."}
              </p>

              {activeFilter !== "all" ? (
                <button
                  type="button"
                  className="fundi-primary-button"
                  onClick={() => selectFilter("all")}
                >
                  View all jobs
                </button>
              ) : (
                <button
                  type="button"
                  className="fundi-primary-button"
                  onClick={loadJobs}
                >
                  Check for jobs
                </button>
              )}
            </div>
          ) : (
            <div className="fundi-job-list">
              {filteredJobs.map((job, index) => {
                const isBusy =
                  busyJobId === job.maintenance_request_id;

                const issueNumber = String(index + 1).padStart(
                  3,
                  "0"
                );
                const appointment = getLatestAppointment(
                  job.maintenance_request_id
                );

                const hasConfirmedAppointment = appointment?.status === "confirmed";

                return (
                  <article
                    className="fundi-job-card"
                    key={
                      job.assignment_id ||
                      job.maintenance_request_id
                    }
                  >
                    <div className="fundi-job-card-header">
                      <div className="fundi-job-title-group">
                        <div>
                          <h3>
                            {formatCategory(
                              job.category || job.title
                            )}
                          </h3>

                          <p className="fundi-job-reference">
                            Issue #{issueNumber}
                          </p>
                        </div>
                      </div>

                      <span
                        className="fundi-status-badge"
                        style={getStatusStyle(job.status)}
                      >
                        {formatStatus(job.status)}
                      </span>
                    </div>

                    <div className="fundi-job-description">
                      <span className="fundi-detail-label">
                        Issue description
                      </span>

                      <p>
                        {job.description ||
                          "No description provided."}
                      </p>
                    </div>

                    <div className="fundi-job-details">
                      <div className="fundi-detail-item">
                        <div>
                          <span className="fundi-detail-label">
                            Property
                          </span>

                          <p>
                            {job.property_name || "Not available"}
                          </p>
                        </div>
                      </div>

                      <div className="fundi-detail-item">
                        <div>
                          <span className="fundi-detail-label">
                            Address
                          </span>

                          <p>
                            {job.property_address || "Not available"}
                          </p>
                        </div>
                      </div>

                      <div className="fundi-detail-item">
                        <div>
                          <span className="fundi-detail-label">
                            Room
                          </span>

                          <p>
                            {job.room_number || "Not available"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="fundi-job-card-footer">
                      <div className="fundi-job-dates">
                        <p>
                          <strong>Assigned:</strong>{" "}
                          {formatDate(job.assigned_at)}
                        </p>

                        {job.accepted_at && (
                          <p>
                            <strong>Accepted:</strong>{" "}
                            {formatDate(job.accepted_at)}
                          </p>
                        )}

                        {job.completed_at && (
                          <p>
                            <strong>Completed:</strong>{" "}
                            {formatDate(job.completed_at)}
                          </p>
                        )}
                      </div>
<div className="fundi-job-actions">
  {job.status === "in_progress" && (
    <div
      className="fundi-appointment-panel"
      style={{
        width: "100%",
        marginBottom: "16px",
        padding: "14px",
        border: "1px solid #dbe3ec",
        borderRadius: "8px",
      }}
    >
      <h4>Visit appointment</h4>

      {appointmentError && (
        <p role="alert" className="fundi-error">
          {appointmentError}
        </p>
      )}

      {appointment && appointment.status !== "cancelled" ? (
        <>
          <p>
            <strong>Proposed visit:</strong>{" "}
            {formatAppointmentDate(appointment.proposed_visit_at)}
          </p>

          <p>
            <strong>Status:</strong>{" "}
            {formatStatus(appointment.status)}
          </p>

          {appointment.tenant_response_note && (
            <p>
              <strong>Tenant note:</strong>{" "}
              {appointment.tenant_response_note}
            </p>
          )}

          {appointment.status === "reschedule_requested" && (
            <>
              <label
                htmlFor={`appointment-${job.maintenance_request_id}`}
              >
                Propose a replacement date and time
              </label>

              <input
                id={`appointment-${job.maintenance_request_id}`}
                type="datetime-local"
                value={appointmentDates[job.maintenance_request_id] || ""}
                onChange={(event) =>
                  setAppointmentDates((current) => ({
                    ...current,
                    [job.maintenance_request_id]: event.target.value,
                  }))
                }
                disabled={busyJobId !== null}
                style={{
                  display: "block",
                  width: "100%",
                  maxWidth: "320px",
                  margin: "8px 0",
                  padding: "9px",
                }}
              />

              <button
                type="button"
                className="fundi-primary-button"
                onClick={() => handleAppointmentSubmit(job)}
                disabled={
                  busyJobId !== null ||
                  !appointmentDates[job.maintenance_request_id]
                }
              >
                {isBusy ? "Saving..." : "Propose new time"}
              </button>
    {!hasConfirmedAppointment && (
      <p role="status">
        The tenant must confirm the appointment before this job can be completed.
      </p>
    )}
            </>
          )}
        </>
      ) : (
        <>
          <p>No visit time has been proposed yet.</p>

          <label
            htmlFor={`appointment-${job.maintenance_request_id}`}
          >
            Proposed visit date and time
          </label>

          <input
            id={`appointment-${job.maintenance_request_id}`}
            type="datetime-local"
            value={appointmentDates[job.maintenance_request_id] || ""}
            onChange={(event) =>
              setAppointmentDates((current) => ({
                ...current,
                [job.maintenance_request_id]: event.target.value,
              }))
            }
            disabled={busyJobId !== null}
            style={{
              display: "block",
              width: "100%",
              maxWidth: "320px",
              margin: "8px 0",
              padding: "9px",
            }}
          />

          <button
            type="button"
            className="fundi-primary-button"
            onClick={() => handleAppointmentSubmit(job)}
            disabled={
              busyJobId !== null ||
              !appointmentDates[job.maintenance_request_id]
            }
          >
            {isBusy ? "Saving..." : "Propose visit time"}
          </button>
        </>
      )}
    </div>
  )}
  {job.payment_method === "cash" && (
    <div className="fundi-cash-payment-info">
      <span>
        Cash payment: {formatStatus(job.payment_status)}
      </span>

      {job.payment_status === "pending" && (
        <button
          type="button"
          className="fundi-primary-button"
          onClick={() => handleConfirmCash(job)}
          disabled={busyJobId !== null}
        >
          {isBusy
            ? "Confirming..."
            : "Confirm Cash Received"}
        </button>
      )}

      {job.payment_status === "paid" && (
        <span className="fundi-completed-label">
          Cash payment confirmed
        </span>
      )}
    </div>
  )}

  {job.status === "assigned" && (
    <button
      type="button"
      className="fundi-primary-button"
      onClick={() =>
        handleJobAction(
          job.maintenance_request_id,
          "accept"
        )
      }
      disabled={!hasConfirmedAppointment || isBusy || busyJobId !== null}
    >
      {isBusy ? "Processing..." : "Accept job"}
    </button>
  )}

  {job.status === "in_progress" && (
    <button
      type="button"
      className="fundi-primary-button"
      onClick={() =>
        handleJobAction(
          job.maintenance_request_id,
          "complete"
        )
      }
      disabled={!hasConfirmedAppointment || isBusy || busyJobId !== null}
    >
      {isBusy ? "Processing..." : hasConfirmedAppointment ? "Mark as completed" : "Awaiting tenant confirmation"}
    </button>
  )}

  {job.status === "completed" && (
    <span className="fundi-completed-label">
      Job completed
    </span>
  )}
</div>

                    
                     

                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="fundi-footer">
          <span>MaintainIt</span>
          <span>Maintenance management made simpler.</span>
        </footer>
      </main>
    </div>
  );
}

export default FundiDashboard;