import { useState } from "react";
import apiRequest from "../../services/api";
import AdminLayout from "../../components/admin/AdminLayout";
import { toast } from "../../components/toast/toast";
import "./AdminStaff.css";

// Flow: admin fills the form -> POST /users/staff (admin-only on the server) ->
// a toast confirms and the form clears so the next account can be added.
const EMPTY = { role: "fundi", name: "", email: "", phone: "", password: "", confirm: "" };

function AdminStaff() {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState([]);

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Enter the full name, email and phone number.");
      return;
    }

    if (form.password.length < 8) {
      toast.error("The password must be at least 8 characters long.");
      return;
    }

    if (form.password !== form.confirm) {
      toast.error("The passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      await apiRequest("/users/staff", {
        method: "POST",
        body: JSON.stringify({
          role: form.role,
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          password: form.password,
        }),
      });

      toast.success(`${form.role === "admin" ? "Administrator" : "Fundi"} account created.`);
      setCreated((list) => [{ name: form.name.trim(), email: form.email.trim().toLowerCase(), role: form.role }, ...list]);
      setForm({ ...EMPTY, role: form.role });
    } catch (error) {
      toast.error(error.message || "Unable to create the account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout
      title="Add staff"
      description="Create fundi and administrator accounts. Share the password with them privately."
    >
      <div className="st-grid">
        <form className="st-card" onSubmit={handleSubmit}>
          <h2>New account</h2>

          <div className="st-roles" role="radiogroup" aria-label="Account type">
            {[["fundi", "Fundi"], ["admin", "Administrator"]].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.role === value}
                className={form.role === value ? "is-on" : ""}
                onClick={() => setForm({ ...form, role: value })}
              >
                {label}
              </button>
            ))}
          </div>

          <label>Full name<input value={form.name} onChange={set("name")} autoComplete="off" /></label>
          <label>Email address<input type="email" value={form.email} onChange={set("email")} autoComplete="off" /></label>
          <label>Phone number<input type="tel" value={form.phone} onChange={set("phone")} placeholder="e.g. 0712345678" autoComplete="off" /></label>
          <label>Password<input type="password" value={form.password} onChange={set("password")} placeholder="At least 8 characters" autoComplete="new-password" /></label>
          <label>Confirm password<input type="password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" /></label>

          <button type="submit" className="st-submit" disabled={saving}>
            {saving ? "Creating..." : "Create account"}
          </button>
        </form>

        <aside className="st-card">
          <h2>Created this session</h2>
          {created.length === 0 ? (
            <p className="st-muted">Accounts you add will be listed here.</p>
          ) : (
            <ul className="st-list">
              {created.map((item) => (
                <li key={item.email}>
                  <strong>{item.name}</strong>
                  <span>{item.email}</span>
                  <em>{item.role === "admin" ? "Administrator" : "Fundi"}</em>
                </li>
              ))}
            </ul>
          )}
          <p className="st-muted">Fundis then complete their profile, and you verify it under Analytics and fundis.</p>
        </aside>
      </div>
    </AdminLayout>
  );
}

export default AdminStaff;