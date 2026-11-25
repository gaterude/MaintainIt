import { useCallback, useEffect, useState } from 'react';
import apiRequest, { API_URL } from '../../services/api';
import { toast } from '../toast/toast';
import './enhancements.css';

// A readable label for a request. The tenant form no longer has a title field,
// so we use the category (and fall back to any old title/description).
function requestLabel(request) {
  const category = request.category
    ? String(request.category).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';
  return category || request.title || request.description || 'Maintenance request';
}

function Panel({ title, children }) {
  return <section className="mi-enhancement-panel"><h2>{title}</h2>{children}</section>;
}

// Photos are private: a plain <img src> would not send the login token, so each
// image is fetched with the token and shown from a temporary in-memory URL.
async function loadPhotoUrl(photoId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/maintenance-photos/file/${photoId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok ? URL.createObjectURL(await response.blob()) : null;
}

function PhotoGallery({ requests }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all((requests || []).slice(0, 30).map(async (request) => {
      try {
        const data = await apiRequest(`/maintenance-photos/${request.id}`);
        const photos = await Promise.all((data.photos || []).map(async (photo) => {
          const url = await loadPhotoUrl(photo.id);
          return url ? { ...photo, requestLabel: requestLabel(request), url } : null;
        }));
        return photos;
      } catch { return []; }
    })).then((groups) => {
      const next = groups.flat().filter(Boolean);
      if (active) setItems(next); else next.forEach((item) => URL.revokeObjectURL(item.url));
    });
    return () => { active = false; };
  }, [requests]);

  useEffect(() => () => items.forEach((item) => URL.revokeObjectURL(item.url)), [items]);

  if (!items.length) return <p>No maintenance photos available for your accessible jobs.</p>;
  return (
    <div className="mi-photo-gallery">
      {items.map((item) => (
        <a key={item.id} href={item.url} target="_blank" rel="noreferrer">
          <img src={item.url} alt={item.original_name} /><span>{item.requestLabel}</span>
        </a>
      ))}
    </div>
  );
}

function TenantEnhancements({ onApplyAssessment }) {
  const [description, setDescription] = useState('');
  const [assessment, setAssessment] = useState(null);
  const [busy, setBusy] = useState('');

  // Flow: send the description -> show the suggestion -> tenant may copy it into the form.
  async function assess() {
    setBusy('ai'); setAssessment(null);
    try {
      const data = await apiRequest('/maintenance-ai/assess', { method: 'POST', body: JSON.stringify({ description }) });
      setAssessment(data.assessment);
    } catch (error) { toast.error(error.message); }
    finally { setBusy(''); }
  }

  return (
    <div className="mi-enhancement-grid">
      <Panel title="AI maintenance assistant">
        <p>Describe the issue to receive an initial category, urgency and technician suggestion. You stay in control: you review everything before submitting.</p>
        <textarea value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the maintenance problem (10–2,000 characters). Do not include names, phone numbers or room numbers." />
        <button disabled={busy === 'ai' || description.trim().length < 10} onClick={assess}>{busy === 'ai' ? 'Assessing…' : 'Assess issue'}</button>
        {assessment && (
          <div className="mi-assessment">
            <p><b>Suggested category:</b> {assessment.category}</p>
            <p><b>Suggested priority:</b> {assessment.priority}</p>
            <p><b>Technician:</b> {assessment.technicianType}</p>
            <b>Possible causes</b><ul>{assessment.possibleCauses.map((item, index) => <li key={index}>{item}</li>)}</ul>
            <b>Suggested next steps</b><ul>{assessment.suggestedNextSteps.map((item, index) => <li key={index}>{item}</li>)}</ul>
            {assessment.safetyNote && <p><b>Safety:</b> {assessment.safetyNote}</p>}
            <small>{assessment.disclaimer}</small>
            {onApplyAssessment && (
              <button type="button" onClick={() => onApplyAssessment({ category: assessment.category, priority: assessment.priority, description: description.trim() })}>
                Use these suggestions in my request form
              </button>
            )}
          </div>
        )}
      </Panel>

    </div>
  );
}

function FundiEnhancements() {
  const [profile, setProfile] = useState({ bio: '', skills: [], specialisations: [] });
  const [feedback, setFeedback] = useState([]);
  const [summary, setSummary] = useState({});
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  // editing=false shows the saved profile read-only; 'Edit profile' unlocks the form.
  const [editing, setEditing] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      apiRequest('/fundi-profiles/me'),
      apiRequest('/maintenance-ratings/my-feedback'),
      apiRequest('/maintenance-assignments/my-jobs'),
    ]).then(([profileResult, feedbackResult, jobsResult]) => {
      if (profileResult.status === 'fulfilled' && profileResult.value.profile) {
        const p = profileResult.value.profile;
        setProfile({ bio: p.bio || '', skills: p.skills || [], specialisations: p.specialisations || [], verification_status: p.verification_status || 'unverified' });
        // A profile that already has details is shown as saved, not as an open form.
        if (p.bio || (p.skills || []).length || (p.specialisations || []).length) setEditing(false);
      } else if (profileResult.status === 'rejected') toast.error(profileResult.reason.message);
      if (feedbackResult.status === 'fulfilled') {
        setFeedback(feedbackResult.value.feedback || []);
        setSummary(feedbackResult.value.summary || {});
      }
      // The assignments endpoint returns { assignments: [...] } (same as the fundi dashboard).
      if (jobsResult.status === 'fulfilled') setJobs(jobsResult.value.assignments || []);
    });
  }, []);

  const toList = (value) => (typeof value === 'string' ? value.split(',').map((x) => x.trim()).filter(Boolean) : value);

  async function save(event) {
    event.preventDefault(); setBusy(true);
    try {
      await apiRequest('/fundi-profiles/me', { method: 'PUT', body: JSON.stringify({ ...profile, skills: toList(profile.skills), specialisations: toList(profile.specialisations) }) });
      toast.success('Profile saved. It is now waiting for administrator review.');
      setProfile((current) => ({ ...current, skills: toList(current.skills), specialisations: toList(current.specialisations) }));
      setEditing(false);
    } catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }

  const ratingCount = summary.total_ratings || 0;

  return (
    <div className="mi-enhancement-grid">
      <Panel title="Your professional profile">
        {(() => {
          const status = profile.verification_status || 'unverified';
          const label = status === 'verified' ? 'Verified by administrator'
            : status === 'rejected' ? 'Not approved: update your profile'
            : 'Waiting for administrator review';
          return <span className={`mi-status-pill mi-status-${status}`}>{label}</span>;
        })()}

        {editing ? (
          <form onSubmit={save}>
            <label>Professional bio<textarea maxLength={1000} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} /></label>
            <label>Skills (comma separated)<input value={Array.isArray(profile.skills) ? profile.skills.join(', ') : profile.skills} onChange={(e) => setProfile({ ...profile, skills: e.target.value })} /></label>
            <label>Specialisations (comma separated)<input value={Array.isArray(profile.specialisations) ? profile.specialisations.join(', ') : profile.specialisations} onChange={(e) => setProfile({ ...profile, specialisations: e.target.value })} /></label>
            <button disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
          </form>
        ) : (
          <div className="mi-profile-saved">
            <p>{profile.bio || 'No bio added.'}</p>
            <p><small>Skills</small><br />{(profile.skills || []).join(', ') || 'None listed'}</p>
            <p><small>Specialisations</small><br />{(profile.specialisations || []).join(', ') || 'None listed'}</p>
            <button type="button" onClick={() => setEditing(true)}>Edit profile</button>
          </div>
        )}
      </Panel>

      <Panel title="Customer reputation">
        <div className="mi-reputation">
          {ratingCount === 0
            ? <strong>No ratings yet</strong>
            : <><strong>{Number(summary.average_rating || 0).toFixed(1)} / 5</strong><span>{ratingCount} customer ratings</span></>}
        </div>
        {feedback.length === 0 ? <p>No customer feedback yet.</p> : feedback.map((item) => (
          <article className="mi-feedback" key={item.id}>
            <b>{item.score} / 5</b>
            <p>{item.comment || 'No written comment.'}</p>
            <small>{requestLabel(item)} · {new Date(item.created_at).toLocaleDateString()}</small>
          </article>
        ))}
      </Panel>

      <Panel title="Photos on your assigned jobs">
        <PhotoGallery requests={jobs.map((job) => ({ id: job.maintenance_request_id, category: job.category, title: job.title, description: job.description }))} />
      </Panel>
    </div>
  );
}

function AdminEnhancements() {
  const [analytics, setAnalytics] = useState(null);
  const [requests, setRequests] = useState([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.allSettled([apiRequest('/property-analytics'), apiRequest('/maintenance-requests/all')]).then(([analyticsResult, requestsResult]) => {
      if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value.analytics);
      else setNotice(analyticsResult.reason.message);
      if (requestsResult.status === 'fulfilled') setRequests(requestsResult.value.requests || []);
    });
  }, []);

  async function setVerification(fundiId, status) {
    try {
      await apiRequest(`/fundi-profiles/${fundiId}/verification`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setAnalytics((current) => ({ ...current, fundis: current.fundis.map((item) => (item.id === fundiId ? { ...item, verification_status: status } : item)) }));
      toast.success('Verification status updated.');
    } catch (error) { toast.error(error.message); }
  }

  if (notice && !analytics) return <Panel title="Property analytics"><p>{notice}</p></Panel>;
  if (!analytics) return <Panel title="Property analytics"><p>Loading analytics…</p></Panel>;

  const money = (cents) => `KSh ${(Number(cents || 0) / 100).toLocaleString('en-KE')}`;
  const hours = analytics.summary.avg_completion_hours;
  const tiles = [
    ['Total requests', analytics.summary.total_requests],
    ['Completed', analytics.summary.completed_requests],
    ['Open', analytics.summary.open_requests],
    ['Cancelled', analytics.summary.cancelled_requests],
    ['Recorded repair costs', money(analytics.summary.recorded_repair_cost_cents)],
    ['Avg. time to complete', hours == null ? 'No data yet' : `${Number(hours).toLocaleString('en-KE')} hrs`],
  ];

  return (
    <Panel title="Property maintenance analytics">
      {notice && <p className="mi-enhancement-notice">{notice}</p>}
      <div className="mi-analytics-grid">{tiles.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <h3>Issues by category</h3>
      {analytics.categories.map((row) => <p key={row.category}>{row.category}: <b>{row.request_count}</b></p>)}
      <h3>Fundi performance</h3>
      {analytics.fundis.map((row) => (
        <div className="mi-feedback" key={row.id}>
          <p>{row.name}: {row.completed_jobs} completed · {row.average_rating || 'No rating'} / 5 ({row.rating_count} ratings)</p>
          <label>Verification
            <select value={row.verification_status || 'unverified'} onChange={(event) => setVerification(row.id, event.target.value)}>
              <option value="unverified">Unverified</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
            </select>
          </label>
        </div>
      ))}
      <h3>Property overview</h3>
      {analytics.properties.map((row) => <p key={row.id}>{row.name}: {row.request_count} requests · {row.completed_count} completed · {money(row.repair_cost_cents)} recorded repairs</p>)}
      <h3>Monthly request trend</h3>
      {/* month arrives as "YYYY-MM"; day 15 avoids any timezone edge cases */}
      {analytics.monthly.map((row) => <p key={row.month}>{new Date(`${row.month}-15`).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })}: {row.request_count} requests</p>)}
      <h3>Maintenance photos</h3>
      <PhotoGallery requests={requests} />
    </Panel>
  );
}

export default function EnhancementPanels({ role, onApplyAssessment }) {
  if (role === 'tenant') return <TenantEnhancements onApplyAssessment={onApplyAssessment} />;
  if (role === 'fundi') return <FundiEnhancements />;
  if (role === 'admin') return <AdminEnhancements />;
  return null;
}

// Uber-style rating: when a finished, paid job is waiting, a small card asks for stars once.
// Flow: check /eligible on load, on window focus and every 20s -> show the first job ->
// stars (+ optional comment) -> POST -> check again. "Not now" hides it until the next visit.
export function RatingPrompt() {
  const [job, setJob] = useState(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState([]);

  const check = useCallback(async () => {
    try {
      const data = await apiRequest('/maintenance-ratings/eligible');
      const list = Array.isArray(data.requests) ? data.requests : [];
      setJob(list.find((item) => !skipped.includes(item.maintenance_request_id)) || null);
    } catch { setJob(null); }
  }, [skipped]);

  useEffect(() => {
    Promise.resolve().then(check);
    const timer = window.setInterval(check, 20000);
    window.addEventListener('focus', check);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', check); };
  }, [check]);

  if (!job) return null;
  const id = job.maintenance_request_id;

  async function submit() {
    setBusy(true);
    try {
      await apiRequest('/maintenance-ratings', { method: 'POST', body: JSON.stringify({ requestId: id, score, comment }) });
      toast.success('Thank you for your rating.');
      setScore(0); setComment('');
      await check();
    } catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mi-rate-backdrop" role="dialog" aria-modal="true" aria-label="Rate your fundi">
      <div className="mi-rate-card">
        <h3>How was the repair?</h3>
        <p>{requestLabel(job)} · {job.fundi_name || 'Your fundi'}</p>
        <div className="mi-rate-stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={n <= score ? 'is-on' : ''} aria-label={n + ' star' + (n > 1 ? 's' : '')} onClick={() => setScore(n)}>★</button>
          ))}
        </div>
        <textarea maxLength={500} placeholder="Add a comment (optional)" value={comment} onChange={(event) => setComment(event.target.value)} />
        <div className="mi-rate-actions">
          <button type="button" className="mi-rate-skip" onClick={() => setSkipped([...skipped, id])}>Not now</button>
          <button type="button" disabled={!score || busy} onClick={submit}>{busy ? 'Sending…' : 'Submit rating'}</button>
        </div>
      </div>
    </div>
  );
}

export { PhotoGallery };