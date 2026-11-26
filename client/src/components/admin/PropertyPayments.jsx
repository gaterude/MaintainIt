import { useCallback, useEffect, useState } from "react";
import apiRequest from "../../services/api";
import { toast } from "../toast/toast";
import { usePropertyFilter } from "./propertyFilter";
import "./PropertyPayments.css";

// Jobs the property is responsible for. After the fundi completes the work,
// the admin pays here (M-Pesa prompt or cash). For cash, the fundi then
// confirms receipt on their own dashboard, same as for tenants.

const kes = (cents) =>
  `KES ${(Number(cents || 0) / 100).toLocaleString("en-KE")}`;

const label = (value) =>
  String(value || "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function toKenyanPhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  return digits;
}

export default function PropertyPayments() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const { matches } = usePropertyFilter();
  // Only the chosen property's jobs (all of them when none is chosen).
  const visibleJobs = jobs.filter(matches);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest("/maintenance-requests/all");
      const list = Array.isArray(data.requests) ? data.requests : [];
      setJobs(
        list.filter(
          (r) =>
            r.status === "completed" &&
            r.responsible_party === "admin" &&
            Number(r.repair_cost_cents) > 0 &&
            r.payment_status !== "paid"
        )
      );
    } catch (error) {
      toast.error(error.message || "Unable to load property payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const waiting = (job) =>
    job.payment_status === "pending" || job.payment_status === "processing";

  async function payMpesa(job) {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      /* ignore */
    }

    const entered = window.prompt(
      "Enter the M-Pesa number to receive the payment prompt:",
      saved.phone || ""
    );
    if (entered === null) return;

    const phoneNumber = toKenyanPhone(entered);
    if (!/^254[17]\d{8}$/.test(phoneNumber)) {
      toast.error("Enter a valid Kenyan number, for example 0712345678.");
      return;
    }

    setBusyId(job.id);
    try {
      const result = await apiRequest("/payments/initiate", {
        method: "POST",
        body: JSON.stringify({ requestId: job.id, phoneNumber }),
      });
      toast.success(result.message || "M-Pesa prompt sent. Check your phone.");
      await load();
    } catch (error) {
      toast.error(error.message || "Unable to start the M-Pesa payment.");
    } finally {
      setBusyId(null);
    }
  }

  async function recover(job, action) {
    if (
      action === "cancel" &&
      !window.confirm("Cancel the waiting M-Pesa attempt? Only do this if no prompt arrived.")
    )
      return;

    setBusyId(job.id);
    try {
      const result = await apiRequest(`/payments/mpesa/${job.id}/${action}`, {
        method: "POST",
      });
      const show = result.outcome === "failed" || result.outcome === "cancelled" ? toast.success : toast.info || toast.success;
      show(result.message);
      await load();
    } catch (error) {
      toast.error(error.message || "Unable to update the payment.");
    } finally {
      setBusyId(null);
    }
  }

  async function payCash(job) {
    if (
      !window.confirm(
        `Pay ${kes(job.repair_cost_cents)} in cash? The assigned fundi must confirm they received it.`
      )
    )
      return;

    setBusyId(job.id);
    try {
      const result = await apiRequest("/payments/cash/initiate", {
        method: "POST",
        body: JSON.stringify({ requestId: job.id }),
      });
      toast.success(result.message || "Cash payment recorded. Waiting for the fundi to confirm.");
      await load();
    } catch (error) {
      toast.error(error.message || "Unable to record the cash payment.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="pp-card">
      <div className="pp-head">
        <div>
          <h2>Property payments due</h2>
          <p>Completed jobs the property is responsible for paying.</p>
        </div>
        <span className="pp-count">{visibleJobs.length} open</span>
      </div>

      {loading ? (
        <p className="pp-empty">Loading...</p>
      ) : visibleJobs.length === 0 ? (
        <p className="pp-empty">Nothing to pay. All property-funded jobs are settled.</p>
      ) : (
        <ul className="pp-list">
          {visibleJobs.map((job) => (
            <li key={job.id} className="pp-row">
              <div className="pp-main">
                <strong>{label(job.category || job.title)}</strong>
                <span>
                  {job.property_name || "Property"}
                  {job.room_number ? ` · Room ${job.room_number}` : ""}
                  {job.fundi_name ? ` · ${job.fundi_name}` : ""}
                </span>
                {waiting(job) && (
                  <small className="pp-note">
                    {job.payment_method === "cash"
                      ? "Cash recorded. Waiting for the fundi to confirm receipt."
                      : "M-Pesa prompt sent. Waiting for confirmation."}
                  </small>
                )}
                {(job.payment_status === "failed" || job.payment_status === "cancelled") && (
                  <small className="pp-note pp-warn">Last attempt did not complete. You can try again.</small>
                )}
              </div>

              <b className="pp-amount">{kes(job.repair_cost_cents)}</b>

              <div className="pp-actions">
                {waiting(job) && job.payment_method !== "cash" ? (
                  <>
                    <button
                      type="button"
                      className="pp-secondary"
                      disabled={busyId === job.id}
                      onClick={() => recover(job, "check")}
                    >
                      Check status
                    </button>
                    <button
                      type="button"
                      className="pp-secondary"
                      disabled={busyId === job.id}
                      onClick={() => recover(job, "cancel")}
                    >
                      Cancel attempt
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="pp-primary"
                      disabled={busyId === job.id || waiting(job)}
                      onClick={() => payMpesa(job)}
                    >
                      Pay with M-Pesa
                    </button>
                    <button
                      type="button"
                      className="pp-secondary"
                      disabled={busyId === job.id || waiting(job)}
                      onClick={() => payCash(job)}
                    >
                      Pay cash
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}