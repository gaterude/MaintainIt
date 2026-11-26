import { useCallback, useEffect, useMemo, useState } from "react";
import apiRequest from "../../services/api";
import AdminLayout from "../../components/admin/AdminLayout";
import { toast } from "../../components/toast/toast";
import "./TenantAssignments.css";

// Flow: load tenants + rooms -> split tenants into "waiting" (no room) and
// "living in a room" -> admin picks a room from those that still have space
// -> server checks capacity -> reload. Vacate sends a tenant back to waiting.
function TenantAssignments() {
  const [tenants, setTenants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [propertyFilter, setPropertyFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const [tenantData, roomData] = await Promise.all([
        apiRequest("/tenant-assignments/tenants"),
        apiRequest("/tenant-assignments/rooms"),
      ]);
      setTenants(Array.isArray(tenantData.tenants) ? tenantData.tenants : []);
      setRooms(Array.isArray(roomData.rooms) ? roomData.rooms : []);
    } catch (error) {
      toast.error(error.message || "Unable to load tenants and rooms.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const properties = useMemo(() => {
    const seen = new Map();
    rooms.forEach((room) => seen.set(room.property_id, room.property_name));
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [rooms]);

  const visibleRooms = rooms.filter(
    (room) => propertyFilter === "all" || room.property_id === propertyFilter
  );

  // A room is "open" while it has fewer tenants than its capacity.
  const openRooms = visibleRooms.filter((room) => room.tenant_count < room.capacity);
  const freeSpots = openRooms.reduce((sum, room) => sum + (room.capacity - room.tenant_count), 0);

  const waiting = tenants.filter((tenant) => !tenant.room_id);
  const living = tenants.filter(
    (tenant) => tenant.room_id && (propertyFilter === "all" || tenant.property_id === propertyFilter)
  );

  async function assign(tenant) {
    const roomId = choice[tenant.user_id];

    if (!roomId) {
      toast.error("Choose a room first.");
      return;
    }

    setBusyId(tenant.user_id);
    try {
      const data = await apiRequest("/tenant-assignments/assign", {
        method: "POST",
        body: JSON.stringify({ userId: tenant.user_id, roomId }),
      });
      toast.success(data.message || "Tenant assigned.");
      setChoice((previous) => ({ ...previous, [tenant.user_id]: "" }));
      await load();
    } catch (error) {
      toast.error(error.message || "Unable to assign the tenant.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function vacate(tenant) {
    const sure = window.confirm(
      `Vacate ${tenant.name} from room ${tenant.room_number}? They keep their account and past requests, but will wait for a new room.`
    );
    if (!sure) return;

    setBusyId(tenant.user_id);
    try {
      const data = await apiRequest("/tenant-assignments/vacate", {
        method: "POST",
        body: JSON.stringify({ userId: tenant.user_id }),
      });
      toast.success(data.message || "Tenant vacated.");
      await load();
    } catch (error) {
      toast.error(error.message || "Unable to vacate the tenant.");
    } finally {
      setBusyId(null);
    }
  }

  function roomLabel(room) {
    const left = room.capacity - room.tenant_count;
    return `${room.property_name} - Room ${room.room_number} (${left} free of ${room.capacity})`;
  }

  function picker(tenant) {
    // When moving, the tenant's own room is not a choice.
    const options = openRooms.filter((room) => room.room_id !== tenant.room_id);

    return (
      <div className="ta-pick">
        <select
          value={choice[tenant.user_id] || ""}
          onChange={(e) => setChoice((previous) => ({ ...previous, [tenant.user_id]: e.target.value }))}
          disabled={busyId === tenant.user_id}
          aria-label={`Room for ${tenant.name}`}
        >
          <option value="">{options.length ? "Choose a room" : "No free rooms"}</option>
          {options.map((room) => (
            <option key={room.room_id} value={room.room_id}>{roomLabel(room)}</option>
          ))}
        </select>
        <button
          type="button"
          className="ta-btn"
          onClick={() => assign(tenant)}
          disabled={busyId === tenant.user_id || !choice[tenant.user_id]}
        >
          {tenant.room_id ? "Move" : "Assign"}
        </button>
      </div>
    );
  }

  return (
    <AdminLayout
      title="Tenants and rooms"
      description="Give new tenants a room, move them, or mark them as moved out."
    >
      {loading ? (
        <p className="ta-muted">Loading...</p>
      ) : (
        <>
          <div className="ta-bar">
            <label>
              Property
              <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
                <option value="all">All properties</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
            </label>
            <div className="ta-stats">
              <span><b>{waiting.length}</b> waiting</span>
              <span><b>{living.length}</b> in rooms</span>
              <span><b>{freeSpots}</b> free spots</span>
            </div>
          </div>

          <div className="ta-grid">
            <div className="ta-main">
              <section className="ta-card">
                <h2>Waiting for a room <span className="ta-count">{waiting.length}</span></h2>
                {waiting.length === 0 ? (
                  <p className="ta-muted">Nobody is waiting. New tenants appear here after they register.</p>
                ) : (
                  <ul className="ta-list">
                    {waiting.map((tenant) => (
                      <li key={tenant.user_id}>
                        <div className="ta-who">
                          <strong>{tenant.name}</strong>
                          <span>{tenant.email}{tenant.phone ? ` · ${tenant.phone}` : ""}</span>
                        </div>
                        {picker(tenant)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="ta-card">
                <h2>Living in a room <span className="ta-count">{living.length}</span></h2>
                {living.length === 0 ? (
                  <p className="ta-muted">No tenants have a room{propertyFilter === "all" ? " yet" : " in this property"}.</p>
                ) : (
                  <ul className="ta-list">
                    {living.map((tenant) => (
                      <li key={tenant.user_id}>
                        <div className="ta-who">
                          <strong>{tenant.name}</strong>
                          <span>{tenant.property_name} · Room {tenant.room_number}</span>
                        </div>
                        <div className="ta-actions">
                          {picker(tenant)}
                          <button
                            type="button"
                            className="ta-btn ta-danger"
                            onClick={() => vacate(tenant)}
                            disabled={busyId === tenant.user_id}
                          >
                            Vacate
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <aside className="ta-card ta-side">
              <h2>Rooms <span className="ta-count">{visibleRooms.length}</span></h2>
              {visibleRooms.length === 0 ? (
                <p className="ta-muted">No rooms yet. Add them under Properties and rooms.</p>
              ) : (
                <ul className="ta-rooms">
                  {visibleRooms.map((room) => {
                    const full = room.tenant_count >= room.capacity;
                    const partly = room.tenant_count > 0 && !full;
                    const state = full ? "Full" : partly ? "Partly occupied" : "Free";

                    return (
                      <li key={room.room_id} title={(room.occupants || []).join(", ")}>
                        <div>
                          <strong>{room.room_number}</strong>
                          {propertyFilter === "all" && <span className="ta-muted"> · {room.property_name}</span>}
                        </div>
                        <span className={`ta-state ${full ? "is-full" : partly ? "is-part" : "is-free"}`}>
                          {state} · {Math.min(room.tenant_count, room.capacity)}/{room.capacity}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

export default TenantAssignments;