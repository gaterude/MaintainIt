import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../services/api";
import "./TenantDashboard.css";

const categories = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "cleaning", label: "Cleaning" },
  { value: "appliance", label: "Appliance" },
  { value: "structural", label: "Structural" },
  { value: "other", label: "Other" },
];

const priorities = [
  { value: "low", label: "Low — can wait" },
  { value: "medium", label: "Medium — normal maintenance" },
  { value: "urgent", label: "Urgent — needs attention" },
];

function formatLabel(value) {
  if (!value) return "Not available";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function formatMoney(cents) {
  return `KSh ${(Number(cents) / 100).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function TenantDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [requests, setRequests] = useState([]);

  const [loadingRoom, setLoadingRoom] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [payingRequestId, setPayingRequestId] = useState(null);

  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [requestFilter, setRequestFilter] = useState("all");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  function showMessage(text, type = "success") {
    setMessage(text);
    setMessageType(type);
  }
async function loadTenantRoom() {
  setLoadingRoom(true);

  try {
    const data = await apiRequest("/maintenance-requests/my-room");
    setRoom(data.room || null);
  } catch (error) {
    setRoom(null);

    if (error.status === 404) {
      setMessage("");
    } else {
      showMessage(
        error.message || "Unable to load your room details.",
        "error"
      );
    }
  } finally {
    setLoadingRoom(false);
  }
}



  async function loadMaintenanceRequests() {
    setLoadingRequests(true);

    try {
      const data = await apiRequest(
        "/maintenance-requests/my-requests"
      );

      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (error) {
      showMessage(
        error.message || "Unable to load maintenance requests.",
        "error"
      );
    } finally {
      setLoadingRequests(false);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (!token || !savedUser) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      const loggedInUser = JSON.parse(savedUser);

      if (loggedInUser.role !== "tenant") {
        if (loggedInUser.role === "admin") {
          navigate("/admin/dashboard", { replace: true });
        } else if (loggedInUser.role === "fundi") {
          navigate("/fundi/dashboard", { replace: true });
        } else {
          navigate("/login", { replace: true });
        }

        return;
      }

      setUser(loggedInUser);
      loadTenantRoom();
      loadMaintenanceRequests();
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  async function handleCreateRequest(event) {
    event.preventDefault();
    setMessage("");

    if (!room?.roomId) {
      showMessage(
        "Your room information is unavailable. Refresh your room details and try again.",
        "error"
      );
      return;
    }

    if (!category || !description.trim()) {
      showMessage(
        "Select a category and describe the maintenance problem.",
        "error"
      );
      return;
    }

    setSubmittingRequest(true);

    try {
      await apiRequest("/maintenance-requests", {
        method: "POST",
        body: JSON.stringify({
          roomId: room.roomId,
          category,
          priority,
          description: description.trim(),
        }),
      });

      setCategory("");
      setPriority("medium");
      setDescription("");

      showMessage("Maintenance request submitted successfully.");
      await loadMaintenanceRequests();
    } catch (error) {
      showMessage(
        error.message || "Unable to submit your request.",
        "error"
      );
    } finally {
      setSubmittingRequest(false);
    }
  }

  async function handlePayNow(request) {
    setMessage("");

    let savedUser = {};

    try {
      savedUser = JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      showMessage("Your session information is invalid.", "error");
      return;
    }

    const defaultPhone = savedUser.phone || "";

    const enteredPhone = window.prompt(
      "Enter the M-Pesa phone number to receive the payment prompt:",
      defaultPhone
    );

    if (enteredPhone === null) return;

    const digits = enteredPhone.replace(/\D/g, "");
    let phoneNumber = digits;

    if (digits.startsWith("0") && digits.length === 10) {
      phoneNumber = `254${digits.slice(1)}`;
    } else if (digits.startsWith("7") && digits.length === 9) {
      phoneNumber = `254${digits}`;
    }

    if (!/^254[17]\d{8}$/.test(phoneNumber)) {
      showMessage(
        "Enter a valid Kenyan mobile number, for example 0712345678.",
        "error"
      );
      return;
    }

    const repairCost = Number(request.repair_cost_cents);

    if (!Number.isFinite(repairCost) || repairCost <= 0) {
      showMessage("The repair cost is invalid.", "error");
      return;
    }

    const requestLabel = formatLabel(
      request.category || request.title
    );

    const confirmed = window.confirm(
      `Initiate an M-Pesa payment of ${formatMoney(
        repairCost
      )} for "${requestLabel}" to ${phoneNumber}?`
    );

    if (!confirmed) return;

    setPayingRequestId(request.id);

    try {
      const result = await apiRequest("/payments/initiate", {
        method: "POST",
        body: JSON.stringify({
          requestId: request.id,
          phoneNumber,
        }),
      });

      showMessage(
        result.message ||
          "M-Pesa payment initiated. Check your phone for the payment prompt."
      );

      await loadMaintenanceRequests();
    } catch (error) {
      showMessage(
        error.message || "Unable to initiate the M-Pesa payment.",
        "error"
      );
    } finally {
      setPayingRequestId(null);
    }
  }
    async function handleCashPayment(request) {
    setMessage("");

    const repairCost = Number(request.repair_cost_cents);

    if (!Number.isFinite(repairCost) || repairCost <= 0) {
      showMessage("The repair cost is invalid.", "error");
      return;
    }

    const requestLabel = formatLabel(
      request.category || request.title
    );

    const confirmed = window.confirm(
      `Choose cash payment for ${formatMoney(
        repairCost
      )} for "${requestLabel}"? Your assigned fundi must confirm receiving the cash.`
    );

    if (!confirmed) return;

    setPayingRequestId(request.id);

    try {
      const result = await apiRequest("/payments/cash/initiate", {
        method: "POST",
        body: JSON.stringify({
          requestId: request.id,
        }),
      });

      showMessage(
        result.message ||
          "Cash payment recorded as pending. Ask your assigned fundi to confirm receipt."
      );

      await loadMaintenanceRequests();
    } catch (error) {
      showMessage(
        error.message || "Unable to initiate the cash payment.",
        "error"
      );
    } finally {
      setPayingRequestId(null);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  const totalRequests = requests.length;

  const pendingRequests = requests.filter(
    (request) => request.status?.toLowerCase() === "pending"
  ).length;

  const completedRequests = requests.filter(
    (request) => request.status?.toLowerCase() === "completed"
  ).length;

  const filteredRequests = requests.filter((request) => {
    if (requestFilter === "all") {
      return true;
    }

    return request.status?.toLowerCase() === requestFilter;
  });

  function handleStatClick(filter) {
    setRequestFilter(filter);

    window.setTimeout(() => {
      document.getElementById("my-requests")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function getPaymentInfo(request) {
const status = request.payment_status;
const method = request.payment_method;

if (status === "paid") {
  return {
    label: "Paid",
    className: "mi-payment-paid",
    description:
      method === "cash"
        ? "Cash received and confirmed by your fundi."
        : "Payment confirmed.",
  };
}

if (status === "processing") {
  return {
    label: method === "cash" ? "Cash Pending Confirmation" : "M-Pesa Processing",
    className: "mi-payment-pending",
    description:
      method === "cash"
        ? "Your fundi must confirm receipt of the cash."
        : "Check your phone for the M-Pesa payment prompt.",
  };
}

if (status === "pending") {
  return {
    label: method === "cash" ? "Cash Awaiting Confirmation" : "Payment Pending",
    className: "mi-payment-pending",
    description:
      method === "cash"
        ? "Your fundi must confirm receipt of the cash."
        : "Your payment has not yet been confirmed.",
  };
}

if (status === "failed" || status === "cancelled") {
  return {
    label: method === "cash" ? "Cash Payment Not Completed" : "Payment Not Completed",
    className: "mi-payment-failed",
    description:
      method === "cash"
        ? "The cash payment was not completed."
        : "You can try M-Pesa again.",
  };
}

return null;


}

  if (!user) {
    return (
      <div className="mi-loading-screen">
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="mi-dashboard">
      <aside className="mi-sidebar">
        <a className="mi-brand" href="#dashboard">
          <span>MaintainIt</span>
        </a>

        <nav className="mi-navigation" aria-label="Main navigation">
          <a className="mi-nav-link mi-nav-active" href="#dashboard">
            Dashboard
          </a>

          <a className="mi-nav-link" href="#my-requests">
            My Requests
          </a>

          <a className="mi-nav-link" href="#my-room">
            My Room
          </a>

          <a className="mi-nav-link" href="#profile">
            Profile
          </a>
        </nav>

        <button
          type="button"
          className="mi-logout"
          onClick={handleLogout}
        >
          Logout
        </button>
      </aside>

      <div className="mi-main">
        <header className="mi-topbar" id="profile">
          <div className="mi-mobile-brand">
            MaintainIt
          </div>

          <div className="mi-user">
            <div className="mi-avatar">
              {(user.name || "T").charAt(0).toUpperCase()}
            </div>

            <div className="mi-user-details">
              <strong>{user.name}</strong>
              <span>Tenant</span>
            </div>

            <button
              type="button"
              className="mi-top-logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>

        <main className="mi-content" id="dashboard">
          <section className="mi-welcome-banner">
            <div className="mi-welcome-copy">
              <p className="mi-eyebrow">YOUR HOME, WELL MAINTAINED</p>
              <h1>Welcome back, {user.name}!</h1>
              <p>
                Here is your maintenance overview. Keep your home
                safe, comfortable and in good condition.
              </p>
            </div>
          </section>

          {message && (
            <div
              className={`mi-alert ${
                messageType === "error"
                  ? "mi-alert-error"
                  : "mi-alert-success"
              }`}
              role={messageType === "error" ? "alert" : "status"}
            >
              <p>{message}</p>

              <button
                type="button"
                onClick={() => setMessage("")}
                aria-label="Dismiss message"
              >
                Dismiss
              </button>
            </div>
          )}

          <section className="mi-stats-grid" aria-label="Request summary">
            <button
              type="button"
              className={`mi-stat-card ${
                requestFilter === "all" ? "mi-stat-selected" : ""
              }`}
              onClick={() => handleStatClick("all")}
              aria-pressed={requestFilter === "all"}
              disabled={loadingRequests}
            >
              <div>
                <p>Total Requests</p>
                <strong>
                  {loadingRequests ? "—" : totalRequests}
                </strong>
              </div>
            </button>

            <button
              type="button"
              className={`mi-stat-card ${
                requestFilter === "pending" ? "mi-stat-selected" : ""
              }`}
              onClick={() => handleStatClick("pending")}
              aria-pressed={requestFilter === "pending"}
              disabled={loadingRequests}
            >
              <div>
                <p>Pending Requests</p>
                <strong>
                  {loadingRequests ? "—" : pendingRequests}
                </strong>
              </div>
            </button>

            <button
              type="button"
              className={`mi-stat-card ${
                requestFilter === "completed" ? "mi-stat-selected" : ""
              }`}
              onClick={() => handleStatClick("completed")}
              aria-pressed={requestFilter === "completed"}
              disabled={loadingRequests}
            >
              <div>
                <p>Completed Requests</p>
                <strong>
                  {loadingRequests ? "—" : completedRequests}
                </strong>
              </div>
            </button>
          </section>

          <div className="mi-dashboard-columns">
            <div className="mi-left-column">
              <section className="mi-panel" id="my-room">
                <div className="mi-panel-heading">
                  <div className="mi-heading-title">
                    <h2>My Room</h2>
                  </div>

                  <button
                    type="button"
                    className="mi-text-button"
                    onClick={loadTenantRoom}
                    disabled={loadingRoom}
                  >
                    {loadingRoom ? "Loading..." : "Refresh"}
                  </button>
                </div>

                {loadingRoom ? (
                  <div className="mi-empty-inline">
                    Loading your room details...
                  </div>
                ) : room ? (
                  <div className="mi-room-details">
                    <div className="mi-room-detail">
                      <span>Room Number</span>
                      <strong>{room.roomNumber || "Unavailable"}</strong>
                    </div>

                    <div className="mi-room-detail">
                      <span>Property</span>
                      <strong>
                        {room.propertyName || "Unavailable"}
                      </strong>
                    </div>

                    <div className="mi-room-detail mi-room-address">
                      <span>Address</span>
                      <strong>
                        {room.propertyAddress || "Unavailable"}
                      </strong>
                    </div>
                  </div>
               
            ) : (
              <div className="mi-empty-inline">
                <h3>Waiting for Room Assignment</h3>

                <p>
                  Your account has been registered successfully.
                  Please wait for the administrator to assign you
                  a room. Your room details will appear here once
                  the assignment is complete.
                </p>

                <button
                  type="button"
                  className="mi-text-button"
                  onClick={loadTenantRoom}
                  disabled={loadingRoom}
                >
                  {loadingRoom ? "Checking..." : "Check Again"}
                </button>
              </div>
            )}

              </section>

              <section className="mi-panel" id="new-request">
                <div className="mi-panel-heading mi-heading-start">
                  <div>
                    <h2>Submit a Maintenance Request</h2>
                    <p>
                      Select a category and describe the problem.
                    </p>
                  </div>
                </div>

                <form
                  className="mi-request-form"
                  onSubmit={handleCreateRequest}
                >
                  <div className="mi-form-row">
                    <div className="mi-form-field">
                      <label htmlFor="mi-category">Category</label>

                      <select
                        id="mi-category"
                        value={category}
                        onChange={(event) =>
                          setCategory(event.target.value)
                        }
                        required
                      >
                        <option value="">Select a category</option>

                        {categories.map((item) => (
                          <option
                            key={item.value}
                            value={item.value}
                          >
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mi-form-field">
                      <label htmlFor="mi-priority">Priority</label>

                      <select
                        id="mi-priority"
                        value={priority}
                        onChange={(event) =>
                          setPriority(event.target.value)
                        }
                        required
                      >
                        {priorities.map((item) => (
                          <option
                            key={item.value}
                            value={item.value}
                          >
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mi-form-field">
                    <label htmlFor="mi-description">Description</label>

                    <textarea
                      id="mi-description"
                      placeholder="Explain what is wrong and where you noticed the problem..."
                      value={description}
                      onChange={(event) =>
                        setDescription(event.target.value)
                      }
                      maxLength={3000}
                      rows={5}
                      required
                    />
                  </div>

                  <div className="mi-room-notice">
                    <span>
                      Room:{" "}
                      <strong>
                        {loadingRoom
                          ? "Loading room information..."
                          : room?.roomNumber || "Unavailable"}
                      </strong>
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="mi-primary-button"
                    disabled={
                      submittingRequest ||
                      loadingRoom ||
                      !room?.roomId
                    }
                  >
                    {submittingRequest
                      ? "Submitting request..."
                      : "Submit Request"}
                  </button>
                </form>
              </section>
            </div>

            <section
              className="mi-panel mi-requests-panel"
              id="my-requests"
            >
              <div className="mi-panel-heading mi-requests-heading">
                <div className="mi-heading-title">
                  <h2>My Maintenance Requests</h2>
                </div>

                <button
                  type="button"
                  className="mi-refresh-button"
                  onClick={loadMaintenanceRequests}
                  disabled={loadingRequests}
                >
                  {loadingRequests ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {requestFilter !== "all" && (
                <div className="mi-filter-banner">
                  <span>
                    Showing:{" "}
                    <strong>
                      {formatLabel(requestFilter)} Requests
                    </strong>
                  </span>

                  <button
                    type="button"
                    onClick={() => setRequestFilter("all")}
                  >
                    View all requests
                  </button>
                </div>
              )}

              {loadingRequests ? (
                <div className="mi-empty-state">
                  <p>Loading your requests...</p>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="mi-empty-state">
                  <h3>
                    {requestFilter === "all"
                      ? "No requests yet"
                      : `No ${requestFilter} requests`}
                  </h3>

                  <p>
                    {requestFilter === "all"
                      ? "Your maintenance requests will appear here after you submit your first one."
                      : "There are no requests in this category right now."}
                  </p>

                  {requestFilter !== "all" ? (
                    <button
                      type="button"
                      className="mi-inline-link mi-clear-filter"
                      onClick={() => setRequestFilter("all")}
                    >
                      View all requests
                    </button>
                  ) : (
                    <a
                      href="#new-request"
                      className="mi-inline-link"
                    >
                      Submit your first request
                    </a>
                  )}
                </div>
              ) : (
                <div className="mi-request-list">
                  {filteredRequests.map((request) => {
                    const repairCost = Number(
                      request.repair_cost_cents
                    );

                    const paymentStatus = request.payment_status;

                    const canPay =
                      request.status === "completed" &&
                      request.responsible_party === "tenant" &&
                      !["paid", "pending", "processing"].includes(
                        paymentStatus
                      ) &&
                      Number.isFinite(repairCost) &&
                      repairCost > 0;

                    const paymentInfo = getPaymentInfo(request);

                    return (
                      <article
                        className="mi-request-item"
                        key={request.id}
                      >
                        <div className="mi-request-body">
                          <div className="mi-request-title-row">
                            <h3>
                              {formatLabel(
                                request.category || request.title
                              )}
                            </h3>

                            <span
                              className={`mi-status mi-status-${String(
                                request.status || "unknown"
                              )
                                .toLowerCase()
                                .replace(/_/g, "-")}`}
                            >
                              {formatLabel(request.status || "Unknown")}
                            </span>
                          </div>

                          <p className="mi-request-description">
                            {request.description ||
                              "No description provided."}
                          </p>

                          <div className="mi-request-meta">
                            <span>
                              {formatDate(request.created_at)}
                            </span>

                            <span
                              className={`mi-priority mi-priority-${String(
                                request.priority || "medium"
                              ).toLowerCase()}`}
                            >
                              {formatLabel(request.priority || "medium")}
                            </span>
                          </div>

                          {request.responsible_party && (
                            <p className="mi-detail-line">
                              Responsible party:{" "}
                              <strong>
                                {formatLabel(
                                  request.responsible_party
                                )}
                              </strong>
                            </p>
                          )}

                          {Number.isFinite(repairCost) &&
                            repairCost > 0 && (
                              <p className="mi-detail-line">
                                Repair cost:{" "}
                                <strong>{formatMoney(repairCost)}</strong>
                              </p>
                            )}

                          {paymentInfo && (
                            <div className="mi-payment-info">
                              <span
                                className={`mi-payment-badge ${paymentInfo.className}`}
                              >
                                {paymentInfo.label}
                              </span>

                              <p>{paymentInfo.description}</p>
                            </div>
                          )}

                         {canPay && (
  <div className="mi-payment-actions">
    <button
      type="button"
      className="mi-pay-button"
      onClick={() => handlePayNow(request)}
      disabled={payingRequestId === request.id}
    >
      {payingRequestId === request.id
        ? "Processing..."
        : paymentStatus === "failed" ||
            paymentStatus === "cancelled"
          ? "Try M-Pesa Again"
          : "Pay with M-Pesa"}
    </button>

    <button
      type="button"
      className="mi-pay-button mi-cash-pay-button"
      onClick={() => handleCashPayment(request)}
      disabled={payingRequestId === request.id}
    >
      {payingRequestId === request.id
        ? "Processing..."
        : "Pay with Cash"}
    </button>
  </div>
)}
                          <div className="mi-request-footer">
                            <span>
                              Request ID:{" "}
                              {String(request.id).slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <footer className="mi-footer">
            <span>MaintainIt</span>
            <span>Making property maintenance simpler.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default TenantDashboard;