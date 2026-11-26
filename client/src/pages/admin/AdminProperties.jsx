import { useCallback, useEffect, useState } from "react";
import apiRequest from "../../services/api";
import AdminLayout from "../../components/admin/AdminLayout";
import { toast } from "../../components/toast/toast";
import "./AdminProperties.css";

// Flow: load properties and their rooms -> admin adds a property, then adds
// rooms to it (several at once, separated by commas) -> list refreshes.
function AdminProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [roomText, setRoomText] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiRequest("/properties");
      const list = Array.isArray(data.properties) ? data.properties : [];
      setProperties(list);
      setPropertyId((current) => current || list[0]?.id || "");
    } catch (error) {
      toast.error(error.message || "Unable to load properties.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addProperty(event) {
    event.preventDefault();
    if (name.trim().length < 2 || address.trim().length < 3) {
      toast.error("Enter the property name and its address.");
      return;
    }

    setSaving(true);
    try {
      const data = await apiRequest("/properties", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), address: address.trim() }),
      });
      toast.success(data.message || "Property added.");
      setName("");
      setAddress("");
      setPropertyId(data.property?.id || "");
      await load();
    } catch (error) {
      toast.error(error.message || "Unable to add the property.");
    } finally {
      setSaving(false);
    }
  }

  async function addRooms(event) {
    event.preventDefault();
    const roomNumbers = roomText.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);

    if (!propertyId) {
      toast.error("Add a property first.");
      return;
    }
    if (roomNumbers.length === 0) {
      toast.error("Enter at least one room number, for example A1, A2, A3.");
      return;
    }

    setSaving(true);
    try {
      const data = await apiRequest(`/properties/${propertyId}/rooms`, {
        method: "POST",
        body: JSON.stringify({ roomNumbers }),
      });
      toast.success(
        data.skipped?.length
          ? `${data.message} Already existed: ${data.skipped.join(", ")}.`
          : data.message
      );
      setRoomText("");
      await load();
    } catch (error) {
      toast.error(error.message || "Unable to add the rooms.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout
      title="Properties and rooms"
      description="Add the properties you manage and their rooms. Tenants are then assigned to these rooms."
    >
      <div className="pr-grid">
        <section className="pr-card">
          <h2>Your properties</h2>

          {loading ? (
            <p className="pr-muted">Loading...</p>
          ) : properties.length === 0 ? (
            <p className="pr-muted">No properties yet. Add your first one on the right.</p>
          ) : (
            <ul className="pr-list">
              {properties.map((property) => (
                <li key={property.id}>
                  <div className="pr-head">
                    <strong>{property.name}</strong>
                    <span className="pr-count">{property.rooms.length} rooms</span>
                  </div>
                  <span className="pr-muted">{property.address}</span>
                  <div className="pr-rooms">
                    {property.rooms.length === 0 ? (
                      <em>No rooms yet</em>
                    ) : (
                      property.rooms.map((room) => <b key={room.id}>{room.room_number}</b>)
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="pr-side">
          <form className="pr-card" onSubmit={addProperty}>
            <h2>Add a property</h2>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} placeholder="Sunrise Apartments" />
            </label>
            <label>
              Address
              <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} placeholder="Kenyatta Avenue, Nakuru" />
            </label>
            <button className="pr-submit" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add property"}
            </button>
          </form>

          <form className="pr-card" onSubmit={addRooms}>
            <h2>Add rooms</h2>
            <label>
              Property
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} disabled={properties.length === 0}>
                {properties.length === 0 && <option value="">No properties yet</option>}
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
            </label>
            <label>
              Room numbers
              <textarea
                rows={3}
                value={roomText}
                onChange={(e) => setRoomText(e.target.value)}
                placeholder="A1, A2, A3, B1"
              />
            </label>
            <p className="pr-muted">Separate room numbers with commas. Rooms that already exist are skipped.</p>
            <button className="pr-submit" type="submit" disabled={saving || properties.length === 0}>
              {saving ? "Saving..." : "Add rooms"}
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminProperties;