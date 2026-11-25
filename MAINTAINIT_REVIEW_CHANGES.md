# Review changes (applied on top of maintainit-all-enhancements.zip)

Syntax-checked only (node --check on every server file, esbuild parse on every JSX file).
NOT run against PostgreSQL, a browser, or the OpenAI API. Test locally before committing.

## Bugs fixed
1. Fundi "Photos on your assigned jobs" was always empty: the panel read `jobs`, but
   `/maintenance-assignments/my-jobs` returns `assignments`.
2. Monthly analytics could show the wrong month in Kenya (pg DATE -> JS Date timezone shift).
   Month is now returned as text "YYYY-MM".
3. Property overview could double-count requests if a request had more than one responsibility
   row. Costs are now pre-summed per request.
4. "Up to five photos per request" was only enforced per upload. It is now enforced in total,
   inside a transaction that locks the request row.
5. Malformed IDs caused database error text to be returned to the client. IDs are now validated
   (400 "Invalid identifier."); non-upload errors now return a generic 500.
6. Fundi average rating showed 0 when unrated; it is now empty ("No ratings yet").
7. AI network failures/timeouts could return raw error text; now a clean 502.

## Privacy / access fixes
- GET /api/fundi-profiles/:id no longer returns email/phone to tenants or other fundis.
  Admin: any fundi. Fundi: self only. Tenant: only fundis assigned to their own requests.
- Verification can only be set on accounts whose role is fundi.
- AI rate limit is per logged-in tenant instead of per IP.
- Profile skills/specialisations items capped at 50 characters.

## Added
- "Use these suggestions in my request form" button: AI category/priority/description fill the
  normal form; the tenant reviews and submits. (Small edit in tenantDashboard.jsx.)
- Average time-to-complete tile in admin analytics.
- Request labels use category (the title field was removed from the tenant form).
- Panels load each part independently so one failing endpoint no longer blanks a whole panel.

## Still unverified (cannot be checked from this zip)
- Panels call /maintenance-ratings/eligible, /maintenance-ratings/my-feedback and
  /maintenance-ratings (POST). Those routes are not in this zip; confirm they exist.
- Table/column names used by the SQL (e.g. properties.name, rooms.property_id,
  maintenance_requests.room_id, maintenance_assignments.fundi_id = users.id).
