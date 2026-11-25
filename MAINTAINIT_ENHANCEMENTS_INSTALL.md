# MaintainIt coordinated enhancements

This package adds ratings UI, AI-assisted maintenance intake, private maintenance photos, fundi profiles/reputation, and admin analytics. Existing WhatsApp, M-Pesa, appointments, SMS, email, and authentication modules are retained.

## Before applying

1. Stop the frontend and backend.
2. From the project root, create a fresh source backup:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = ".\backups\before-enhancements-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Copy-Item .\server\src "$backup\server-src" -Recurse
Copy-Item .\client\src "$backup\client-src" -Recurse
Copy-Item .\database\migrations "$backup\migrations" -Recurse
Copy-Item .\package.json "$backup\package.json"
```

3. Before running the migration, back up PostgreSQL. This migration is additive, but preserve a restorable copy of your existing data:

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
pg_dump -h localhost -p 5432 -U maintainit_user -d maintainit -F c -f .\backups\maintainit-before-enhancements.dump
```

`pg_dump` will prompt for the database password. Do not put the password in the command or commit the dump.

4. Extract this ZIP into the MaintainIt project root, preserving folders and allowing the listed changed files to be overwritten.
5. Install the new backend dependency from the project root:

```powershell
npm install multer@2.0.2
```

This updates `package-lock.json` consistently with the existing lockfile.

## Environment

Add these two variables to your existing root `.env` (do not replace your existing `.env`):

```env
OPENAI_API_KEY=your_private_key
OPENAI_MODEL=gpt-4o-mini
```

The AI endpoint returns HTTP 503 when no key is configured. Normal maintenance requests continue to work without AI. Never put the key in frontend environment variables or commit it.

## Database

The package adds `database/migrations/012_maintenance_enhancements.sql`. It creates fundi profile metadata and maintenance photo metadata. It does not edit previously applied migrations.

Run from the project root:

```powershell
npm run db:migrate
```

Check that migration 012 is reported as APPLIED or SKIPPED (if already applied).

## Private photo storage

Photos are stored under `server/storage/maintenance-photos`, not served as a public static directory. The API checks that the caller is the tenant who owns the request, an admin, or the fundi assigned to it before upload/list/view. Accepted formats are JPEG, PNG and WebP; the server checks image signatures and limits each file to 5 MB, up to five files per request.

Add these lines to your existing root `.gitignore` (do not replace your existing ignore rules):

```gitignore
server/storage/maintenance-photos/*
!server/storage/maintenance-photos/.gitkeep
```

For production, mount this directory on persistent private storage and include it in encrypted backups. Do not expose it through Nginx as a public static folder. A future object-storage adapter can replace local disk without changing the photo API.

## API additions

- `POST /api/maintenance-ai/assess` — tenant-only, rate-limited to 10 assessments per hour per IP.
- `POST /api/maintenance-photos/:requestId` — authenticated multipart form field `photos`, up to five images.
- `GET /api/maintenance-photos/:requestId` — authorised photo metadata.
- `GET /api/maintenance-photos/file/:photoId` — authorised private image response.
- `GET /api/fundi-profiles/me` and `PUT /api/fundi-profiles/me` — fundi profile read/update.
- `GET /api/fundi-profiles/:fundiId` — authenticated fundi profile.
- `PATCH /api/fundi-profiles/:fundiId/verification` — admin-only verification status change.
- `GET /api/property-analytics` — admin-only property and platform maintenance overview.

AI output is advisory. It does not decide tenant liability, set repair costs, auto-dispatch a fundi, or override the tenant's category/priority choice. The AI service sends only the issue description to OpenAI; do not include names, phone numbers, room numbers, or other identifying information in that description.

## Validation

Run:

```powershell
node --check .\server\src\index.js
Get-ChildItem .\server\src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
cd .\client
npm run build
npm run lint
cd ..
```

Then test with tenant, admin and fundi accounts separately. Confirm tenant A cannot view tenant B's photos, an unassigned fundi cannot view a request's photos, tenants cannot call fundi/admin endpoints, and only admins can set verification status. Test uploads with valid and invalid image formats and files over 5 MB. Confirm the AI disabled-key fallback works. Existing M-Pesa, cash, WhatsApp, appointment, SMS and email flows should receive regression checks because the package adds routes but does not intentionally alter their services.

## Important implementation limits

- Analytics are derived from existing request, responsibility, assignment and rating data. Repair-cost totals represent recorded responsibility costs, not necessarily paid amounts.
- Verification status is an administrative record; MaintainIt must only mark a fundi verified after the organisation completes a real-world verification process.
- Local disk photo storage is intended for development and a single-host deployment. Production must use persistent private storage and a tested backup/restore process.
- This archive is a source patch. It has not been run against your local PostgreSQL database or Windows Node environment. Do not commit until the migration, frontend build, role/access tests and regression tests pass locally.
