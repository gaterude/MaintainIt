import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiRequest from "../../services/api";
import "./TenantDashboard.css";
import "./TenantTheme.css";
import EnhancementPanels, { RatingPrompt } from "../../components/maintenance-enhancements/EnhancementPanels";
import { toast } from "../../components/toast/toast";

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

// Photo rules (the server enforces the same limits).
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  const [appointments, setAppointments] = useState([]);
  const [appointmentNotes, setAppointmentNotes] = useState({});
  const [appointmentActionId, setAppointmentActionId] = useState(null);

  const [loadingRoom, setLoadingRoom] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [payingRequestId, setPayingRequestId] = useState(null);

  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  // Photos chosen on the form. Each item keeps the file and a temporary preview URL.
  const [photos, setPhotos] = useState([]);
  const photosRef = useRef([]);
  // Changing this number restarts the AI box, clearing its text and suggestion.
  const [assistantKey, setAssistantKey] = useState(0);
  const [requestFilter, setRequestFilter] = useState("all");
  // Sidebar sections: overview (new request + AI), requests (history), room.
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get("section") || "overview";
  const goTo = (next) => setSearchParams(next === "overview" ? {} : { section: next });

  // Shows a small notification that disappears on its own.
  function showMessage(text, type = "success") {
    if (type === "error") toast.error(text);
    else toast.success(text);
  }
async function loadTenantRoom() {
  setLoadingRoom(true);

  try {
    const data = await apiRequest("/maintenance-requests/my-room");
    setRoom(data.room || null);
  } catch (error) {
    setRoom(null);

    if (error.status === 404) {
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

  async function loadAppointments() {
    try {
      const data = await apiRequest("/appointments/my-requests");

      setAppointments(
        Array.isArray(data.appointments) ? data.appointments : []
      );
    } catch (error) {
      showMessage(
        error.message || "Unable to load appointment information.",
        "error"
      );
    }
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

  function formatAppointmentDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (!token || !savedUser) {
      navigate("/login", { replace: true });
      return;
    }

    let timerId;

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

      // Flow: wait one tick -> save the user -> load room, requests
      // and appointments (once).
      timerId = window.setTimeout(() => {
        setUser(loggedInUser);
        loadTenantRoom();
        loadMaintenanceRequests();
        loadAppointments();
      }, 0);
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
    }

    // Cancel the pending load if the page closes before it runs.
    return () => window.clearTimeout(timerId);
    // This should run only once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Keep a copy of the list so previews can be released when the page closes.
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(
    () => () => photosRef.current.forEach((item) => URL.revokeObjectURL(item.url)),
    []
  );

  // Flow: pick files -> check type, size and total -> show thumbnails.
  function handleAddPhotos(event) {
    const chosen = Array.from(event.target.files || []);
    event.target.value = ""; // lets the same file be chosen again after removing it

    const accepted = [];

    for (const file of chosen) {
      if (!PHOTO_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only JPEG, PNG or WebP images are allowed.`);
      } else if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`${file.name} is larger than 5 MB.`);
      } else if (photos.length + accepted.length >= MAX_PHOTOS) {
        toast.error(`You can attach up to ${MAX_PHOTOS} photos.`);
        break;
      } else {
        accepted.push({ file, url: URL.createObjectURL(file) });
      }
    }

    if (accepted.length > 0) setPhotos((previous) => [...previous, ...accepted]);
  }

  function handleRemovePhoto(index) {
    setPhotos((previous) => {
      URL.revokeObjectURL(previous[index].url);
      return previous.filter((_, position) => position !== index);
    });
  }

  // The server's reply shape for a new request may vary, so read the ID defensively.
  async function findNewRequestId(data, text) {
    const direct =
      data?.request?.id ||
      data?.maintenanceRequest?.id ||
      data?.request?.request_id ||
      data?.id ||
      data?.request_id;

    if (direct) return direct;

    // Fallback: take the newest of my requests that has the same description.
    const list = await apiRequest("/maintenance-requests/my-requests");
    const match = (Array.isArray(list.requests) ? list.requests : [])
      .filter((item) => (item.description || "").trim() === text)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    return match?.id || match?.request_id || null;
  }

  async function handleCreateRequest(event) {
    event.preventDefault();

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
      const submittedText = description.trim();

      const created = await apiRequest("/maintenance-requests", {
        method: "POST",
        body: JSON.stringify({
          roomId: room.roomId,
          category,
          priority,
          description: submittedText,
        }),
      });

      // Flow: request saved -> upload the chosen photos to it -> reset the form.
      let photoProblem = "";

      if (photos.length > 0) {
        try {
          const requestId = await findNewRequestId(created, submittedText);

          if (!requestId) throw new Error("Could not find the new request.");

          const form = new FormData();
          photos.forEach((item) => form.append("photos", item.file));

          await apiRequest(`/maintenance-photos/${requestId}`, {
            method: "POST",
            body: form,
          });
        } catch (photoError) {
          photoProblem = photoError.message || "The photos could not be uploaded.";
        }
      }

      photos.forEach((item) => URL.revokeObjectURL(item.url));
      setPhotos([]);
      setCategory("");
      setPriority("medium");
      setDescription("");
      setAssistantKey((current) => current + 1);

      if (photoProblem) {
        toast.error(`Request submitted, but the photos were not uploaded: ${photoProblem}`);
      } else {
        showMessage("Maintenance request submitted successfully.");
      }

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

    let savedUser;

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
  async function handleMpesaRecovery(request, action) {
    if (
      action === "cancel" &&
      !window.confirm(
        "Cancel the waiting M-Pesa attempt? Only do this if no prompt arrived."
      )
    ) {
      return;
    }

    setPayingRequestId(request.id);

    try {
      const result = await apiRequest(
        `/payments/mpesa/${request.id}/${action}`,
        { method: "POST" }
      );

      showMessage(result.message);
      await loadMaintenanceRequests();
    } catch (error) {
      showMessage(
        error.message || "Unable to update the payment.",
        "error"
      );
    } finally {
      setPayingRequestId(null);
    }
  }

    async function handleCashPayment(request) {

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

  async function handleAppointmentResponse(appointment, response) {
    setAppointmentActionId(appointment.id);

    try {
      const result = await apiRequest(
        `/appointments/${appointment.id}/respond`,
        {
          method: "POST",
          body: JSON.stringify({
            response,
            note: appointmentNotes[appointment.id] || "",
          }),
        }
      );

      showMessage(
        result.message ||
          (response === "confirm"
            ? "Appointment confirmed successfully."
            : "Rescheduling requested successfully.")
      );

      setAppointmentNotes((current) => ({
        ...current,
        [appointment.id]: "",
      }));

      await loadAppointments();
    } catch (error) {
      showMessage(
        error.message || "Unable to update the appointment.",
        "error"
      );
    } finally {
      setAppointmentActionId(null);
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
    goTo("requests");
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
          {[["overview", "Dashboard"], ["requests", "My Requests"], ["room", "My Room"]].map(([id, text]) => (
            <a
              key={id}
              className={"mi-nav-link" + (section === id ? " mi-nav-active" : "")}
              href={id === "overview" ? "/tenant/dashboard" : "/tenant/dashboard?section=" + id}
              onClick={(event) => { event.preventDefault(); goTo(id); }}
            >
              {text}
            </a>
          ))}
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
          {section === "overview" && (<>
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
          {/* Visits waiting for the tenant: shown on the dashboard so they are never missed. */}
          {appointments
            .filter((a) => ["pending_confirmation", "rescheduled"].includes(a.status))
            .map((a) => (
              <section className="mi-visit-card" key={a.id}>
                <div>
                  <h3>Your fundi proposed a visit</h3>
                  <p>
                    <strong>{a.fundi_name || "Your fundi"}</strong> will visit on{" "}
                    <strong>{formatAppointmentDate(a.proposed_visit_at)}</strong>.
                  </p>
                  <input
                    type="text"
                    maxLength={300}
                    placeholder="Optional note (for example, a time that suits you better)"
                    value={appointmentNotes[a.id] || ""}
                    onChange={(event) =>
                      setAppointmentNotes((current) => ({ ...current, [a.id]: event.target.value }))
                    }
                  />
                </div>
                <div className="mi-visit-actions">
                  <button
                    type="button"
                    className="mi-visit-confirm"
                    disabled={appointmentActionId !== null}
                    onClick={() => handleAppointmentResponse(a, "confirm")}
                  >
                    {appointmentActionId === a.id ? "Saving..." : "Confirm visit"}
                  </button>
                  <button
                    type="button"
                    className="mi-visit-reschedule"
                    disabled={appointmentActionId !== null}
                    onClick={() => handleAppointmentResponse(a, "reschedule")}
                  >
                    Ask to reschedule
                  </button>
                </div>
              </section>
            ))}
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

                  <div className="mi-form-field">
                    <label htmlFor="mi-photos">
                      Photos <span className="mi-optional">(optional, up to {MAX_PHOTOS})</span>
                    </label>

                    <input
                      id="mi-photos"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleAddPhotos}
                      disabled={photos.length >= MAX_PHOTOS || submittingRequest}
                    />

                    {photos.length > 0 && (
                      <ul className="mi-photo-picker" aria-label="Selected photos">
                        {photos.map((item, index) => (
                          <li key={item.url}>
                            <img src={item.url} alt={item.file.name} />

                            <button
                              type="button"
                              className="mi-photo-remove"
                              aria-label={`Remove ${item.file.name}`}
                              onClick={() => handleRemovePhoto(index)}
                              disabled={submittingRequest}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
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

            <EnhancementPanels
              key={assistantKey}
              role="tenant"
              onApplyAssessment={(suggestion) => {
                // Flow: AI suggestion -> fill the form -> tenant reviews and submits.
                setCategory(suggestion.category);
                setPriority(suggestion.priority);
                if (!description.trim()) setDescription(suggestion.description);
                showMessage("Suggestions added to the request form. Review and edit them, then submit.");
                document.getElementById("mi-category")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />

          </div>
          </>)}

          {section === "room" && (
            <div className="mi-dashboard-columns"><div className="mi-left-column">
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

            </div></div>
          )}

          {section === "requests" && (
            <div className="mi-dashboard-columns">
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

                    const appointment = getLatestAppointment(request.id);

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

                          {appointment && (

                            <div

                              className="mi-appointment-info"

                              style={{

                                margin: "14px 0",

                                padding: "14px",

                                border: "1px solid #dbe3ec",

                                borderRadius: "8px",

                              }}

                            >

                              <h4>Fundi visit appointment</h4>



                              <p>

                                <strong>Proposed visit:</strong>{" "}

                                {formatAppointmentDate(appointment.proposed_visit_at)}

                              </p>



                              <p>

                                <strong>Fundi:</strong>{" "}

                                {appointment.fundi_name || "Assigned fundi"}

                              </p>



                              <p>

                                <strong>Status:</strong>{" "}

                                {formatLabel(appointment.status)}

                              </p>



                              {appointment.tenant_response_note && (

                                <p>

                                  <strong>Your previous note:</strong>{" "}

                                  {appointment.tenant_response_note}

                                </p>

                              )}



                              {["pending_confirmation", "rescheduled"].includes(

                                appointment.status

                              ) && (

                                <div>

                                  <label

                                    htmlFor={`appointment-note-${appointment.id}`}

                                    style={{ display: "block", marginBottom: "6px" }}

                                  >

                                    Note for the fundi (optional)

                                  </label>



                                  <textarea

                                    id={`appointment-note-${appointment.id}`}

                                    value={appointmentNotes[appointment.id] || ""}

                                    maxLength={1000}

                                    rows={2}

                                    onChange={(event) =>

                                      setAppointmentNotes((current) => ({

                                        ...current,

                                        [appointment.id]: event.target.value,

                                      }))

                                    }

                                    disabled={appointmentActionId !== null}

                                    style={{

                                      display: "block",

                                      width: "100%",

                                      maxWidth: "420px",

                                      marginBottom: "10px",

                                      padding: "9px",

                                    }}

                                  />



                                  <button

                                    type="button"

                                    onClick={() =>

                                      handleAppointmentResponse(appointment, "confirm")

                                    }

                                    disabled={appointmentActionId !== null}

                                    style={{

                                      marginRight: "8px",

                                      marginBottom: "8px",

                                      padding: "9px 14px",

                                      border: "none",

                                      borderRadius: "5px",

                                      cursor: appointmentActionId !== null ? "wait" : "pointer",

                                    }}

                                  >

                                    {appointmentActionId === appointment.id

                                      ? "Processing..."

                                      : "Confirm visit"}

                                  </button>



                                  <button

                                    type="button"

                                    onClick={() =>

                                      handleAppointmentResponse(appointment, "reschedule")

                                    }

                                    disabled={appointmentActionId !== null}

                                    style={{

                                      marginBottom: "8px",

                                      padding: "9px 14px",

                                      border: "1px solid #b8c3d1",

                                      borderRadius: "5px",

                                      cursor: appointmentActionId !== null ? "wait" : "pointer",

                                    }}

                                  >

                                    Request rescheduling

                                  </button>

                                </div>

                              )}



                              {appointment.status === "confirmed" && (

                                <p role="status">

                                  You have confirmed this visit.

                                </p>

                              )}



                              {appointment.status === "reschedule_requested" && (

                                <p role="status">

                                  Your rescheduling request has been sent. The fundi needs to propose another time.

                                </p>

                              )}

                            </div>

                          )}

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

                          {request.responsible_party === "tenant" &&
                            paymentStatus === "processing" &&
                            request.payment_method !== "cash" && (
                              <div className="mi-payment-actions">
                                <button
                                  type="button"
                                  className="mi-pay-button"
                                  onClick={() =>
                                    handleMpesaRecovery(request, "check")
                                  }
                                  disabled={payingRequestId === request.id}
                                >
                                  Check status
                                </button>

                                <button
                                  type="button"
                                  className="mi-pay-button mi-cash-pay-button"
                                  onClick={() =>
                                    handleMpesaRecovery(request, "cancel")
                                  }
                                  disabled={payingRequestId === request.id}
                                >
                                  Cancel attempt
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
          )}

          <footer className="mi-footer">
            <span>MaintainIt</span>
            <span>Making property maintenance simpler.</span>
          </footer>
        </main>
      </div>
      <RatingPrompt />
    </div>
  );
}

export default TenantDashboard;