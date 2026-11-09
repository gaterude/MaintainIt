\# MaintainIt



MaintainIt is a residential property maintenance management platform connecting tenants, property administrators and maintenance technicians (fundis).



It provides a central workflow for reporting maintenance issues, assigning technicians, scheduling visits and managing repair payments.



\## Features



\### Tenants

\- Register and log in.

\- Submit and track maintenance requests.

\- View assigned room information.

\- Confirm appointments or request rescheduling.

\- View payment information.



\### Administrators

\- Manage maintenance requests.

\- Determine maintenance responsibility.

\- Assign fundis to maintenance jobs.

\- Manage tenant and room assignments.

\- Review maintenance history and payments.



\### Fundis

\- View and accept assigned jobs.

\- Propose appointment times.

\- Respond to rescheduling requests.

\- Complete eligible maintenance jobs.



\### Integrations

\- Safaricom Daraja M-Pesa.

\- Africa's Talking SMS.

\- Resend email notifications.

\- Automated overdue-maintenance checks.

\- Scheduled payment reconciliation.



WhatsApp integration is currently deferred.



\## Technology Stack



\- Frontend: React and Vite.

\- Backend: Node.js and Express.

\- Database: PostgreSQL.

\- Authentication: JSON Web Tokens.

\- Password hashing: bcryptjs.

\- Scheduled jobs: node-cron.

\- Payments: Safaricom Daraja API.



\## Requirements



\- Node.js 22.12 or later.

\- npm.

\- PostgreSQL.

\- Git.



\## Installation



\### 1. Clone the repository



```bash

git clone https://github.com/gaterude/MaintainIt.git

cd MaintainIt

```



\### 2. Install backend dependencies



From the project root:



```bash

npm install

```



\### 3. Install frontend dependencies



```bash

cd client

npm install

cd ..

```



\## Environment Configuration



Create your local environment files from the supplied examples.



For PowerShell:



```powershell

Copy-Item .env.example .env

Copy-Item .\\client\\.env.example .\\client\\.env

```



For Linux or macOS:



```bash

cp .env.example .env

cp client/.env.example client/.env

```



Update the root `.env` with your actual configuration.



\### Required backend variables



\- DB\_HOST

\- DB\_PORT

\- DB\_NAME

\- DB\_USER

\- DB\_PASSWORD

\- JWT\_SECRET



\### Optional integration variables



\*\*Africa's Talking SMS\*\*

\- AT\_USERNAME

\- AT\_API\_KEY



\*\*Resend email\*\*

\- RESEND\_API\_KEY

\- EMAIL\_FROM



\*\*Safaricom Daraja\*\*

\- MPESA\_ENV

\- MPESA\_CONSUMER\_KEY

\- MPESA\_CONSUMER\_SECRET

\- MPESA\_SHORTCODE

\- MPESA\_PASSKEY

\- MPESA\_CALLBACK\_URL



\### Frontend variable



The frontend uses `VITE\_API\_URL`.



Local development:



```env

VITE\_API\_URL=http://localhost:4000/api

```



Retain the `/api` suffix.



For deployment, configure the actual backend URL before building the frontend.



\### Generate a JWT secret



Run:



```bash

node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

```



Keep the generated secret private. Never commit your actual `.env` files or expose backend credentials in frontend code.



\## Database Setup



Create a dedicated PostgreSQL user and an empty database.



Connect to PostgreSQL as an administrator and run:



```sql

CREATE ROLE maintainit\_user

WITH LOGIN PASSWORD 'replace-with-a-strong-password';



CREATE DATABASE maintainit

OWNER maintainit\_user;

```



Use the same credentials in the root `.env` file.



\### Run database migrations



From the project root:



```bash

npm run db:migrate

```



The migration runner:

\- Discovers numbered SQL migration files.

\- Executes them in filename order.

\- Records applied migrations in `schema\_migrations`.

\- Stores SHA-256 checksums.

\- Skips previously applied migrations.

\- Detects changes to previously applied migration files.

\- Uses a PostgreSQL advisory lock to prevent concurrent migration runs.



\*\*Important:\*\* The current migration runner is intended for a new, empty database or a database already managed by its migration history.



It deliberately refuses to automatically adopt an existing database containing application tables without migration history.



Do not run it against an existing installation until a reviewed database-baseline procedure has been prepared.



Do not modify previously applied migration files. Create a new numbered migration for future schema changes.



\## First Administrator Setup



Public registration is restricted to tenant accounts.



Create the first administrator using:



```bash

npm run bootstrap:admin

```



The command requires these temporary environment variables:



\- BOOTSTRAP\_ADMIN\_NAME

\- BOOTSTRAP\_ADMIN\_EMAIL

\- BOOTSTRAP\_ADMIN\_PHONE

\- BOOTSTRAP\_ADMIN\_PASSWORD



The password must contain at least 12 characters.



The bootstrap utility:

\- Hashes the password using bcrypt.

\- Uses a database transaction.

\- Uses an advisory lock to serialize bootstrap attempts.

\- Refuses to create another administrator when one already exists.



The initial administrator should be created before normal staff accounts are registered.



\## Running MaintainIt Locally



Open two terminals.



\### Terminal 1: Backend



From the project root:



```bash

npm run dev

```



The backend normally runs at:



http://localhost:4000



API health endpoint:



http://localhost:4000/



\### Terminal 2: Frontend



From the project root:



```bash

cd client

npm run dev

```



The frontend normally runs at:



http://localhost:5173



\## Production Build



Build the frontend:



```bash

cd client

npm run build

```



The generated production files are stored in:



`client/dist/`



Configure `VITE\_API\_URL` to the deployed backend address before building.



Configure the backend's `CLIENT\_URL` to the actual deployed frontend origin.



Use HTTPS for production services.



\### M-Pesa deployment



MaintainIt includes a Daraja payment integration and scheduled payment reconciliation.



Keep `MPESA\_ENV=sandbox` during development and testing.



A publicly reachable HTTPS callback URL is required for Safaricom callbacks.



Do not switch to production credentials until live payments, callback verification and reconciliation have been tested.



\## Security



The backend includes:

\- JWT authentication.

\- Role-based authorization.

\- Bcrypt password hashing.

\- Helmet security headers.

\- API rate limiting.

\- Restricted CORS origins.

\- Request body size limits.

\- Database validation constraints.



Run dependency audits regularly:



```bash

npm audit

```



Run the frontend audit separately:



```bash

cd client

npm audit

```



\## Project Status



MaintainIt is a working MVP developed as a bootcamp project.



It includes tenant, administrator and fundi workflows, appointment scheduling, maintenance assignment, payment handling and notification integrations.



WhatsApp integration is deferred.



A successful installation or frontend build does not by itself establish production readiness. Deployment, integration configuration and end-to-end acceptance testing must be completed separately.



\## Available Commands



| Command | Purpose |

|---|---|

| `npm install` | Install backend dependencies |

| `npm run dev` | Start backend in development |

| `npm start` | Start backend |

| `npm run db:migrate` | Run database migrations |

| `npm run bootstrap:admin` | Create the initial administrator |

| `cd client \&\& npm install` | Install frontend dependencies |

| `cd client \&\& npm run dev` | Start frontend |

| `cd client \&\& npm run build` | Build frontend for production |



\## Repository



https://github.com/gaterude/MaintainIt

