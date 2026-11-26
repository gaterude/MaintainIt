import { useEffect, useMemo, useState } from "react";
import apiRequest from "../../services/api";
import { toast } from "../toast/toast";
import { usePropertyFilter } from "./propertyFilter";
import { PhotoGallery } from "../maintenance-enhancements/EnhancementPanels";
import "./AdminAnalytics.css";

// Flow: load analytics + request list + detail lists -> show clickable tiles
// -> clicking a tile (or finance / a category) opens the matching list below.
const money = (cents) =>
  `KSh ${(Number(cents || 0) / 100).toLocaleString("en-KE")}`;
const label = (text) =>
  String(text || "Other").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const day = (value) => (value ? new Date(value).toLocaleDateString("en-KE") : "-");

function Table({ columns, rows, empty }) {
  if (rows.length === 0) return <p className="an-empty">{empty}</p>;
  return (
    <div className="an-table-wrap">
      <table className="an-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.title}>{c.title}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || row.request_id || i}>
              {columns.map((c) => <td key={c.title}>{c.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const roomText = (r) => [r.property_name, r.room_number && `Room ${r.room_number}`].filter(Boolean).join(", ") || "-";

function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [details, setDetails] = useState({ completions: [], ratings: [] });
  const [allRequests, setAllRequests] = useState([]);
  const { propertyId, matches } = usePropertyFilter();
  // Requests limited to the chosen property (all of them when none is chosen).
  const requests = useMemo(() => allRequests.filter(matches), [allRequests, matches]);
  const [view, setView] = useState(null);

  // Reload when the chosen property changes. The server limits the analytics to
  // that property; the request list is filtered in the browser (see above).
  useEffect(() => {
    let cancelled = false;
    const query = propertyId ? `?property=${encodeURIComponent(propertyId)}` : "";

    Promise.allSettled([
      apiRequest(`/property-analytics${query}`),
      apiRequest(`/property-analytics/details${query}`),
      apiRequest("/maintenance-requests/all"),
    ]).then(([a, d, r]) => {
      if (cancelled) return;
      if (a.status === "fulfilled") setAnalytics(a.value.analytics);
      else toast.error(a.reason.message || "Unable to load analytics.");
      if (d.status === "fulfilled") setDetails(d.value.details || { completions: [], ratings: [] });
      if (r.status === "fulfilled") setAllRequests(r.value.requests || []);
    });

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  async function setVerification(fundiId, status) {
    try {
      await apiRequest(`/fundi-profiles/${fundiId}/verification`, { method: "PATCH", body: JSON.stringify({ status }) });
      setAnalytics((cur) => ({ ...cur, fundis: cur.fundis.map((f) => (f.id === fundiId ? { ...f, verification_status: status } : f)) }));
      toast.success("Verification status updated.");
    } catch (error) { toast.error(error.message); }
  }

  const derived = useMemo(() => {
    const now = new Date();
    const thisMonth = requests.filter((r) => {
      const d = new Date(r.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const completed = requests.filter((r) => r.status === "completed");
    const paid = requests.filter((r) => r.payment_status === "paid");
    const sum = (list) => list.reduce((t, r) => t + Number(r.repair_cost_cents || 0), 0);
    return {
      thisMonth, completed, paid,
      paidTotal: sum(paid),
      paidMpesa: sum(paid.filter((r) => r.payment_method !== "cash")),
      paidCash: sum(paid.filter((r) => r.payment_method === "cash")),
    };
  }, [requests]);

  if (!analytics) return <p className="an-empty">Loading analytics...</p>;

  const s = analytics.summary;
  const ratings = details.ratings;
  const avgRating = ratings.length ? ratings.reduce((t, r) => t + Number(r.score), 0) / ratings.length : null;
  const hours = s.avg_completion_hours;

  const tiles = [
    ["month", "Requests this month", derived.thisMonth.length],
    ["completed", "Completed", derived.completed.length],
    ["hours", "Avg completion time", hours == null ? "No data" : `${Number(hours)} hrs`],
    ["rating", "Average rating", avgRating == null ? "No ratings" : `${avgRating.toFixed(1)} / 5`],
  ];

  const requestCols = [
    { title: "Request", render: (r) => <><b>{label(r.category || r.title)}</b><br /><span className="an-sub">{r.description}</span></> },
    { title: "Tenant", render: (r) => r.tenant_name || "-" },
    { title: "Property", render: roomText },
    { title: "Status", render: (r) => <span className={`an-pill an-${r.status}`}>{label(r.status)}</span> },
    { title: "Date", render: (r) => day(r.created_at) },
  ];

  let panel = null;
  if (view === "month") panel = ["Requests made this month", <Table key="m" columns={requestCols} rows={derived.thisMonth} empty="No requests have been made this month." />];
  if (view === "completed") panel = ["Completed requests", <Table key="c" columns={requestCols} rows={derived.completed} empty="No completed requests yet." />];
  if (view === "hours") panel = ["Time taken to complete jobs", <Table key="h" columns={[
    { title: "Job", render: (r) => <><b>{label(r.category)}</b><br /><span className="an-sub">{r.description}</span></> },
    { title: "Fundi", render: (r) => r.fundi_name || "-" },
    { title: "Completed", render: (r) => day(r.completed_at) },
    { title: "Hours", render: (r) => `${r.hours} hrs` },
  ]} rows={details.completions} empty="No completed jobs yet." />];
  if (view === "rating") panel = ["Tenant ratings", <Table key="r" columns={[
    { title: "Rating", render: (r) => <b>{r.score} / 5</b> },
    { title: "Comment", render: (r) => r.comment || <span className="an-sub">No written comment</span> },
    { title: "Job", render: (r) => label(r.category) },
    { title: "Fundi", render: (r) => r.fundi_name || "-" },
    { title: "Date", render: (r) => day(r.created_at) },
  ]} rows={ratings} empty="No ratings yet." />];
  if (view === "finance") panel = ["Payments received", <Table key="f" columns={[
    { title: "Request", render: (r) => label(r.category || r.title) },
    { title: "Tenant", render: (r) => r.tenant_name || "-" },
    { title: "Property", render: roomText },
    { title: "Method", render: (r) => (r.payment_method === "cash" ? "Cash" : "M-Pesa") },
    { title: "Amount", render: (r) => <b>{money(r.repair_cost_cents)}</b> },
  ]} rows={derived.paid} empty="No payments have been received yet." />];
  if (view && view.startsWith("cat:")) {
    const cat = view.slice(4);
    const solved = derived.completed.filter((r) => (r.category || "other") === cat);
    panel = [`Solved issues: ${label(cat)}`, <Table key="k" columns={requestCols} rows={solved} empty="No solved issues in this category yet." />];
  }

  return (
    <div className="an-page">
      <div className="an-tiles">
        {tiles.map(([id, name, value]) => (
          <button key={id} type="button" className={"an-tile" + (view === id ? " is-on" : "")} onClick={() => setView(view === id ? null : id)}>
            <span>{name}</span><strong>{value}</strong>
          </button>
        ))}
      </div>

      <div className="an-two">
        <section className="an-card">
          <h2>Finance</h2>
          <button type="button" className={"an-row-btn" + (view === "finance" ? " is-on" : "")} onClick={() => setView(view === "finance" ? null : "finance")}>
            <span>Collected</span><b>{money(derived.paidTotal)}</b>
          </button>
          <p className="an-line"><span>M-Pesa</span><b>{money(derived.paidMpesa)}</b></p>
          <p className="an-line"><span>Cash</span><b>{money(derived.paidCash)}</b></p>
          <p className="an-line"><span>Recorded repair costs</span><b>{money(s.recorded_repair_cost_cents)}</b></p>
          <p className="an-hint">Select Collected to see every payment received. Pending and failed payments are under Payments.</p>
        </section>

        <section className="an-card">
          <h2>Issues by category</h2>
          {analytics.categories.length === 0 && <p className="an-empty">No requests yet.</p>}
          {analytics.categories.map((row) => {
            const key = row.category || "other";
            const solved = derived.completed.filter((r) => (r.category || "other") === key).length;
            return (
              <button key={key} type="button" className={"an-row-btn" + (view === `cat:${key}` ? " is-on" : "")} onClick={() => setView(view === `cat:${key}` ? null : `cat:${key}`)}>
                <span>{label(key)}</span><b>{row.request_count} <small>({solved} solved)</small></b>
              </button>
            );
          })}
          <p className="an-hint">Select a category to see the issues solved in it.</p>
        </section>
      </div>

      {panel && (
        <section className="an-card an-detail">
          <div className="an-detail-head">
            <h2>{panel[0]}</h2>
            <button type="button" className="an-close" onClick={() => setView(null)}>Close</button>
          </div>
          {panel[1]}
        </section>
      )}

      <section className="an-card">
        <h2>Fundi performance</h2>
        <Table
          columns={[
            { title: "Fundi", render: (f) => <b>{f.name}</b> },
            { title: "Completed", render: (f) => f.completed_jobs },
            { title: "Rating", render: (f) => (f.average_rating ? `${f.average_rating} / 5 (${f.rating_count})` : "No ratings") },
            { title: "Verification", render: (f) => (
              <select className="an-select" value={f.verification_status || "unverified"} onChange={(e) => setVerification(f.id, e.target.value)}>
                <option value="unverified">Unverified</option><option value="pending">Pending</option>
                <option value="verified">Verified</option><option value="rejected">Rejected</option>
              </select>
            ) },
          ]}
          rows={analytics.fundis}
          empty="No fundis registered yet."
        />
      </section>

      <section className="an-card">
        <h2>Maintenance photos</h2>
        <PhotoGallery requests={requests} />
      </section>
    </div>
  );
}

export default AdminAnalytics;