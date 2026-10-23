
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../services/api";
import { styles } from "../../styles";

function TenantAssignments() {
  const navigate = useNavigate();

  const [tenants, setTenants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRooms, setSelectedRooms] = useState({});
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null);
  const [tenantMessages, setTenantMessages] = useState({});

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

    loadData();
  }, [navigate]);

  async function loadData() {
    setLoading(true);

    try {
      const [tenantData, roomData] = await Promise.all([
        apiRequest("/tenant-assignments/tenants"),
        apiRequest("/tenant-assignments/rooms"),
      ]);

      setTenants(
        Array.isArray(tenantData.tenants)
          ? tenantData.tenants
          : []
      );

      setRooms(
        Array.isArray(roomData.rooms)
          ? roomData.rooms
          : []
      );
    } catch (loadError) {
      alert(
        loadError.message ||
          "Unable to load tenants and rooms."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignment(event, userId) {
    event.preventDefault();

    const roomId = selectedRooms[userId];

    if (!roomId) {
      setTenantMessages((previous) => ({
        ...previous,
        [userId]: {
          type: "error",
          text: "Please select a room first.",
        },
      }));
      return;
    }

    setAssigningId(userId);

    setTenantMessages((previous) => ({
      ...previous,
      [userId]: null,
    }));

    try {
      const data = await apiRequest(
        "/tenant-assignments/assign",
        {
          method: "POST",
          body: JSON.stringify({
            userId,
            roomId,
          }),
        }
      );

      setTenantMessages((previous) => ({
        ...previous,
        [userId]: {
          type: "success",
          text: data.message || "Tenant assigned successfully.",
        },
      }));

      setSelectedRooms((previous) => {
        const updated = { ...previous };
        delete updated[userId];
        return updated;
      });

      await loadData();
    } catch (assignmentError) {
      setTenantMessages((previous) => ({
        ...previous,
        [userId]: {
          type: "error",
          text:
            assignmentError.message ||
            "Unable to assign the tenant.",
        },
      }));
    } finally {
      setAssigningId(null);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login", { replace: true });
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
          <h2>Tenant Room Assignments</h2>

          <p style={styles.muted}>
            Assign registered tenants to rooms or change their
            existing room assignments.
          </p>
        </div>

        {loading ? (
          <p style={styles.muted}>
            Loading tenants and rooms...
          </p>
        ) : (
          <>
            <section style={styles.card}>
              <h3 style={styles.sectionTitle}>
                Registered Tenants ({tenants.length})
              </h3>

              {tenants.length === 0 ? (
                <p style={styles.muted}>
                  No registered tenants were found.
                </p>
              ) : (
                tenants.map((tenant) => {
                  const currentRoom = tenant.room_number
                    ? `${tenant.property_name} — Room ${tenant.room_number}`
                    : null;

                  const tenantMessage =
                    tenantMessages[tenant.user_id];

                  return (
                    <article
                      key={tenant.user_id}
                      style={styles.requestCard}
                    >
                      <h3>{tenant.name}</h3>

                      <p>
                        <strong>Email:</strong>{" "}
                        {tenant.email}
                      </p>

                      {tenant.phone && (
                        <p>
                          <strong>Phone:</strong>{" "}
                          {tenant.phone}
                        </p>
                      )}

                      <p>
                        <strong>Current assignment:</strong>{" "}
                        {currentRoom ||
                          "Waiting for room assignment"}
                      </p>

                      <form
                        onSubmit={(event) =>
                          handleAssignment(
                            event,
                            tenant.user_id
                          )
                        }
                      >
                        <label
                          htmlFor={`room-${tenant.user_id}`}
                          style={styles.label}
                        >
                          {currentRoom
                            ? "Change Room"
                            : "Select Room"}
                        </label>

                        <select
                          id={`room-${tenant.user_id}`}
                          style={styles.input}
                          value={
                            selectedRooms[tenant.user_id] || ""
                          }
                          onChange={(event) => {
                            setSelectedRooms((previous) => ({
                              ...previous,
                              [tenant.user_id]:
                                event.target.value,
                            }));

                            setTenantMessages((previous) => ({
                              ...previous,
                              [tenant.user_id]: null,
                            }));
                          }}
                          required
                        >
                          <option value="">
                            Choose a property room
                          </option>

                          {rooms.map((room) => (
                            <option
                              key={room.room_id}
                              value={room.room_id}
                            >
                              {room.property_name} — Room{" "}
                              {room.room_number} (
                              {room.tenant_count}{" "}
                              {Number(room.tenant_count) === 1
                                ? "tenant"
                                : "tenants"}
                              )
                            </option>
                          ))}
                        </select>

                        <button
                          type="submit"
                          style={{
                            ...styles.button,
                            opacity:
                              assigningId === tenant.user_id
                                ? 0.7
                                : 1,
                          }}
                          disabled={
                            assigningId !== null ||
                            rooms.length === 0
                          }
                        >
                          {assigningId === tenant.user_id
                            ? "Saving..."
                            : currentRoom
                              ? "Update Assignment"
                              : "Assign Room"}
                        </button>
                      </form>

                      {tenantMessage && (
                        <div
                          role={
                            tenantMessage.type === "error"
                              ? "alert"
                              : "status"
                          }
                          style={
                            tenantMessage.type === "error"
                              ? styles.error
                              : styles.message
                          }
                        >
                          {tenantMessage.text}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </section>

            <section style={styles.card}>
              <h3 style={styles.sectionTitle}>
                Available Property Rooms ({rooms.length})
              </h3>

              {rooms.length === 0 ? (
                <p style={styles.muted}>
                  No rooms have been registered. Add rooms before
                  assigning tenants.
                </p>
              ) : (
                rooms.map((room) => (
                  <article
                    key={room.room_id}
                    style={styles.requestCard}
                  >
                    <h3>
                      {room.property_name} — Room{" "}
                      {room.room_number}
                    </h3>

                    <p>
                      <strong>Address:</strong>{" "}
                      {room.property_address}
                    </p>

                    <p>
                      <strong>Assigned tenants:</strong>{" "}
                      {room.tenant_count}
                    </p>
                  </article>
                ))
              )}
            </section>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={loadData}
              disabled={assigningId !== null}
            >
              Refresh Tenants and Rooms
            </button>
          </>
        )}
      </main>
    </div>
  );
}

export default TenantAssignments;
