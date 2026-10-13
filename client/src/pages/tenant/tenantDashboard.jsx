import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../services/api";
import { styles, getStatusStyle } from "../../styles";

function TenantDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [requests, setRequests] = useState([]);

  const [loadingRoom, setLoadingRoom] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [payingRequestId, setPayingRequestId] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

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
      setRoom(data.room);
    } catch (error) {
      setRoom(null);
      showMessage(error.message, "error");
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

      setRequests(data.requests || []);
    } catch (error) {
      showMessage(error.message, "error");
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
        "Your room information is unavailable. Please refresh your room details.",
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
          title,
          description,
        }),
      });

      setTitle("");
      setDescription("");

      showMessage("Maintenance request submitted successfully.");

      await loadMaintenanceRequests();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSubmittingRequest(false);
    }
  }

  async function handlePayNow(request) {
    setMessage("");

    const savedUser = JSON.parse(
      localStorage.getItem("user") || "{}"
    );

    const defaultPhone = savedUser.phone || "";

    const enteredPhone = window.prompt(
      "Enter the M-Pesa phone number to receive the payment prompt:",
      defaultPhone
    );

    if (enteredPhone === null) {
      return;
    }

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

    const confirmed = window.confirm(
      `Initiate an M-Pesa payment of KSh ${(
        Number(request.repair_cost_cents) / 100
      ).toLocaleString()} for "${request.title}" to ${phoneNumber}?`
    );

    if (!confirmed) {
      return;
    }

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
      showMessage(error.message, "error");
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
    (request) => request.status === "pending"
  ).length;

  const completedRequests = requests.filter(
    (request) => request.status === "completed"
  ).length;

  if (!user) {
    return (
      <div style={styles.page}>
        <main style={styles.container}>
          <p style={styles.muted}>Loading your dashboard...</p>
        </main>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.brand}>MaintainIt</h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <span style={styles.muted}>{user.name}</span>

          <button
            onClick={handleLogout}
            style={styles.secondaryButton}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={styles.container}>
        <section style={styles.welcome}>
          <h2 style={{ fontSize: "28px", marginBottom: "8px" }}>
            Tenant Dashboard
          </h2>

          <p style={styles.muted}>
            Welcome back, {user.name}. Here is your maintenance overview.
          </p>

          <p style={styles.muted}>
            {user.email} {"·"} {user.role}
          </p>
        </section>

        {message && (
          <div
            role="status"
            style={
              messageType === "error"
                ? styles.error
                : styles.message
            }
          >
            {message}
          </div>
        )}

        <section style={styles.grid}>
          <div style={styles.card}>
            <p style={styles.muted}>Total Requests</p>
            <p style={styles.statNumber}>{totalRequests}</p>
          </div>

          <div style={styles.card}>
            <p style={styles.muted}>Pending Requests</p>
            <p style={styles.statNumber}>{pendingRequests}</p>
          </div>

          <div style={styles.card}>
            <p style={styles.muted}>Completed Requests</p>
            <p style={styles.statNumber}>{completedRequests}</p>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>My Room</h2>

          {loadingRoom ? (
            <p style={styles.muted}>
              Loading your room details...
            </p>
          ) : room ? (
            <div style={styles.roomGrid}>
              <div>
                <p style={styles.roomLabel}>Room Number</p>
                <p style={styles.roomValue}>
                  {room.roomNumber || "Unavailable"}
                </p>
              </div>

              <div>
                <p style={styles.roomLabel}>Property</p>
                <p style={styles.roomValue}>
                  {room.propertyName || "Unavailable"}
                </p>
              </div>

              <div>
                <p style={styles.roomLabel}>Address</p>
                <p style={styles.roomValue}>
                  {room.propertyAddress || "Unavailable"}
                </p>
              </div>
            </div>
          ) : (
            <p style={styles.muted}>
              Your room details could not be loaded.
            </p>
          )}

          <button
            onClick={loadTenantRoom}
            disabled={loadingRoom}
            style={{
              ...styles.secondaryButton,
              marginTop: "20px",
              opacity: loadingRoom ? 0.7 : 1,
            }}
          >
            {loadingRoom ? "Loading..." : "Refresh Room Details"}
          </button>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Submit a Maintenance Request
          </h2>

          <p style={styles.muted}>
            Describe the problem in your room so the maintenance team
            can review it.
          </p>

          <form onSubmit={handleCreateRequest}>
            <label htmlFor="title" style={styles.label}>
              Issue Title
            </label>

            <input
              id="title"
              type="text"
              maxLength={150}
              placeholder="e.g. Broken shower tap"
              style={styles.input}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />

            <label htmlFor="description" style={styles.label}>
              Describe the Issue
            </label>

            <textarea
              id="description"
              placeholder="Explain what is wrong and where you noticed the problem."
              style={styles.textarea}
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              required
            />

            <p style={styles.muted}>
              Room:{" "}
              <strong>
                {loadingRoom
                  ? "Loading room information..."
                  : room?.roomNumber || "Unavailable"}
              </strong>
            </p>

            <button
              type="submit"
              style={{
                ...styles.button,
                opacity:
                  submittingRequest || loadingRoom || !room?.roomId
                    ? 0.7
                    : 1,
              }}
              disabled={
                submittingRequest ||
                loadingRoom ||
                !room?.roomId
              }
            >
              {submittingRequest
                ? "Submitting..."
                : "Submit Request"}
            </button>
          </form>
        </section>

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <h2 style={styles.sectionTitle}>
              My Maintenance Requests
            </h2>

            <button
              onClick={loadMaintenanceRequests}
              disabled={loadingRequests}
              style={styles.secondaryButton}
            >
              {loadingRequests ? "Refreshing..." : "Refresh Requests"}
            </button>
          </div>

          {loadingRequests ? (
            <div style={styles.card}>
              <p style={styles.muted}>Loading your requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div style={styles.card}>
              <h3>No requests yet</h3>

              <p style={styles.muted}>
                Your submitted maintenance requests will appear here.
              </p>
            </div>
          ) : (
            requests.map((request) => {
              const repairCost = Number(request.repair_cost_cents);

              const paymentStatus = request.payment_status;

              const canPay =
                request.status === "completed" &&
                request.responsible_party === "tenant" &&
                !["paid", "pending", "processing"].includes(
                  paymentStatus
                ) &&
                Number.isFinite(repairCost) &&
                repairCost > 0;

              return (
                <article
                  key={request.id}
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
                    <h3 style={{ margin: "0 0 12px" }}>
                      {request.title}
                    </h3>

                    <span style={getStatusStyle(request.status)}>
                      {request.status.replace("_", " ")}
                    </span>
                  </div>

                  <p style={{ lineHeight: 1.6 }}>
                    {request.description}
                  </p>

                  <p style={styles.muted}>
                    Submitted:{" "}
                    {new Date(request.created_at).toLocaleString()}
                  </p>

                  {request.responsible_party && (
                    <p style={styles.muted}>
                      Responsible party:{" "}
                      {request.responsible_party}
                    </p>
                  )}

                  {Number.isFinite(repairCost) && repairCost > 0 && (
                    <p style={styles.muted}>
                      Repair cost: KSh{" "}
                      {(repairCost / 100).toLocaleString()}
                    </p>
                  )}

                  {paymentStatus === "paid" && (
                    <p style={styles.muted}>
                      Payment status: Paid
                    </p>
                  )}

                  {paymentStatus === "pending" && (
                    <p style={styles.muted}>
                      Payment is awaiting processing. Please check again shortly.
                    </p>
                  )}

                  {paymentStatus === "processing" && (
                    <p style={styles.muted}>
                      Payment is processing. Wait for M-Pesa confirmation before trying again.
                    </p>
                  )}

                  {paymentStatus === "failed" && (
                    <p style={styles.error}>
                      Payment failed. You can try again using M-Pesa.
                    </p>
                  )}

                  {paymentStatus === "cancelled" && (
                    <p style={styles.muted}>
                      Payment was cancelled. You can initiate another payment.
                    </p>
                  )}

                  {canPay && (
                    <button
                      type="button"
                      onClick={() => handlePayNow(request)}
                      disabled={payingRequestId === request.id}
                      style={{
                        ...styles.button,
                        marginTop: "12px",
                        opacity:
                          payingRequestId === request.id ? 0.7 : 1,
                      }}
                    >
                      {payingRequestId === request.id
                        ? "Initiating payment..."
                        : paymentStatus === "failed" ||
                            paymentStatus === "cancelled"
                          ? "Try M-Pesa Again"
                          : "Pay Now with M-Pesa"}
                    </button>
                  )}
                </article>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}

export default TenantDashboard;
