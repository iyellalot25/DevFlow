# DevFlow

**AI-powered developer task planning and tracking system.**

## What problem does this solve?

Developers often write down engineering work as a single vague sentence —
"move the API to Postgres and dockerize it" — and then have to manually
turn that into a real checklist before they can start. That translation
step is repetitive and easy to skip under time pressure, which is exactly
when a task most needs to be broken down properly.

DevFlow takes that one sentence, sends it through a narrowly-scoped LLM job
whose only responsibility is task decomposition (it never writes or
modifies application code), and returns a structured, actionable list of
implementation subtasks. Those subtasks are then tracked to completion, and
project progress can be exported as a PDF report at any time.

**10x claim:** DevFlow reduces the time to turn an unstructured development
task into an actionable implementation checklist from several minutes of
manual planning to seconds. The 10x improvement is specifically about the
task-planning/decomposition step — not a claim about software development
as a whole.

## Prerequisites

- Node.js (v18 or later recommended)
- Docker + Docker Compose (for local PostgreSQL)
- A free Google Gemini API key ([aistudio.google.com](https://aistudio.google.com/apikey))
- `psql` or any Postgres client (optional, for manual inspection)

No paid services are required anywhere in this stack.

## Setup

```bash
git clone <your-repo-url>
cd devflow
npm install
```

### Environment variables

Copy the example file and fill in real values:

```bash
cp .env.example .env
```

| Variable            | Description                                                                             |
| ------------------- | --------------------------------------------------------------------------------------- |
| `POSTGRES_USER`     | Postgres username (local Docker container)                                              |
| `POSTGRES_PASSWORD` | Postgres password (local Docker container)                                              |
| `POSTGRES_DB`       | Postgres database name                                                                  |
| `DATABASE_URL`      | Full connection string used by the app (`postgresql://user:password@localhost:5432/db`) |
| `JWT_SECRET`        | Secret used to sign/verify auth tokens — use a long random string                       |
| `GEMINI_API_KEY`    | Your Gemini API key                                                                     |
| `PORT`              | Port the Express server listens on (default `3000`)                                     |

Never commit `.env`. It's already covered by `.gitignore`.

Note: JWT expiry is currently a hardcoded constant (`6h`) in
`services/authService.js`, not an environment variable.

### Database setup

```bash
docker compose up -d
docker exec -i devflow-postgres psql -U devflow -d devflow < schema.sql
```

This starts a local Postgres 16 container and applies the schema
(`CREATE TABLE IF NOT EXISTS`, so it's safe to re-run).

### Run the app

```bash
npm run dev
```

This starts the Express server and the background worker in the same
process. `npm start` runs the same app without file-watching, for a
non-development run.

The app is now available at `http://localhost:3000/`.

## API reference

All endpoints except `/auth/register` and `/auth/login` require:

```
Authorization: Bearer <token>
```

Missing or invalid tokens return `401`. All error responses follow the
same shape: `{ "error": "message" }`.

Every route is team-scoped: DevFlow silently checks that the resource you
are accessing belongs to your own team before returning it, and returns a
plain `404` (not a `403`) when it doesn't — this avoids revealing whether
a resource exists at all for another team.

### Auth

**`POST /auth/register`**

```json
// body
{ "email": "dev@example.com", "password": "at least 8 characters" }
```

- `201` → `{ "user": { "id", "email", "team_id" }, "token" }`
- `400` invalid email format, or password under 8 characters
- `409` email already registered

**`POST /auth/login`**

```json
{ "email": "dev@example.com", "password": "..." }
```

- `200` → `{ "user": { "id", "email", "team_id" }, "token" }`
- `400` missing email/password
- `401` invalid email or password

### Projects

**`POST /projects`** — body: `{ "name": "...", "description": "optional" }`

- `201` → the created project row
- `400` if `name` is missing/empty

**`GET /projects`**

- `200` → array of projects belonging to your team

### Tasks

**`POST /projects/:projectId/tasks`** — body: `{ "raw_description": "..." }`

- `201` → the created task row
- `400` if `raw_description` is missing/empty
- `404` if the project doesn't belong to your team

**`GET /projects/:projectId/tasks`**

- `200` → array of tasks for that project
- `404` if the project doesn't belong to your team

### Subtasks

**`POST /tasks/:taskId/subtasks`** — body: `{ "description": "...", "position": 0 }` (`position` optional)

- `201` → the created subtask row
- `400` if `description` is missing/empty
- `404` if the task doesn't belong to your team

**`GET /tasks/:taskId/subtasks`**

- `200` → array of subtasks, ordered by `position` then `created_at`
- `404` if the task doesn't belong to your team

**`PATCH /subtasks/:id`** — body: `{ "status": "todo" | "in_progress" | "done" }`

- `200` → the updated subtask row
- `400` if `status` isn't one of the three valid values
- `404` if the subtask doesn't exist or doesn't belong to your team

### AI decomposition (background job)

**`POST /tasks/:taskId/decompose`**

- `202` → the created job row (`status: "pending"`), work happens asynchronously
- `404` if the task doesn't belong to your team

**`GET /jobs/:id`**

- `200` → the job row: `{ id, task_id, status, result, error, created_at, completed_at }`
  - `status` is one of `pending` / `processing` / `done` / `failed`
  - `result` is populated (an array of generated subtask descriptions) once `done`
  - `error` is populated with a readable message if `failed` — e.g. an
    invalid `GEMINI_API_KEY` fails the job cleanly without crashing the
    worker or the server
- `404` if the job doesn't belong to your team

### Reporting

**`GET /reports/:projectId/pdf`**

- `200` → streams a PDF (`Content-Type: application/pdf`, downloads as
  `devflow-report-<project-name>.pdf`) — project summary with an overall
  progress bar, per-task breakdown, and checkbox-style subtask markers,
  built from live data at request time (not cached)
- `404` if the project doesn't belong to your team

## 5-minute demo path

1. `POST /auth/register` with a new email/password — or use the UI at
   `http://localhost:3000/`.
2. Log in.
3. Create a project, e.g. `"Backend Migration"`.
4. Create a task with a vague real description, e.g. _"Move my Express API
   from SQLite to PostgreSQL, keep the existing endpoints working, and
   dockerize it."_
5. Trigger decomposition (`POST /tasks/:taskId/decompose`) — the UI polls
   the job automatically.
6. Watch the generated subtasks appear (usually within a few seconds).
7. Update a couple of subtasks to `in_progress` / `done` and watch the
   progress bar update.
8. Download the PDF report and confirm it reflects the current state.

## Architecture

```
Client (browser, public/index.html)
        │  fetch + JWT in Authorization header
        ▼
Express app (app.js)
        │
        ├─ routes/*.js       (thin, requireAuth-protected)
        │
        ├─ services/*.js     (business logic + SQL + team-ownership checks)
        │
        ├─ db.js             (pg Pool)  →  PostgreSQL
        │
        └─ worker.js         (DB-polling background loop, same Node process,
                               started after the server begins listening;
                               resets any orphaned 'processing' jobs to
                               'pending' on startup before polling begins)
```

## Design decisions

- **DB-polling worker instead of a message queue** (Redis, RabbitMQ, SQS):
  keeps the stack simple and free of extra infrastructure, while still
  implementing a real async job pattern — jobs are claimed with `FOR
UPDATE SKIP LOCKED` so it stays correct even with multiple worker
  processes.
- **Startup job recovery**: any job still `processing` when the worker
  starts must be orphaned — nothing else in the system can leave a job in
  that state — so it's unconditionally reset to `pending` on startup with
  no age threshold needed.
- **Two-layer LLM output validation**: the LLM is asked for a specific
  array-of-strings shape, and the result is independently re-validated in
  `decompositionValidator.js` before being persisted — the LLM's output is
  never trusted blindly.
- **Team-scoped 404s, not 403s**: every ownership check returns `404` for
  another team's resource rather than `403`, so a caller can't distinguish
  "doesn't exist" from "exists but isn't yours."
- **PDFKit over a headless-browser PDF approach** (e.g. Puppeteer): far
  lighter weight, no Chromium dependency, appropriate for a small report.
- **Flat team model**: every user gets exactly one auto-created team at
  registration; there are no roles, invitations, or shared teams. Auth
  still does real work here — it protects each team's data from every
  other team, over the network, regardless of device — it just doesn't yet
  support multiple people collaborating on one team's data. See Future
  Ideas.
- **Self-rolled JWT auth over a managed alternative** (e.g. Supabase Auth):
  kept as custom JWT + bcrypt to fully own and understand the
  authentication layer rather than delegate it to a third-party service.

## Known limitations

- `projects.team_id` has no foreign key constraint to `teams(id)` —
  cosmetic gap, doesn't affect correctness under normal use.
- No refresh-token flow: the JWT expires after 6 hours and the user must
  log in again — there's no silent token renewal.
- No frontend UX for an expired token beyond a `401` on the next action.
- No automated test suite (not one of the 5 chosen concepts for this
  project — input validation and error-path behavior were instead verified
  manually across every endpoint and are documented above).

## Future ideas

- **Project invitations / shared teams** — letting multiple users
  collaborate on the same team's projects via an invite or join-code flow.
  The current single-user-per-team model already demonstrates real,
  working authentication and authorization; shared teams would be the
  natural next step.
- Refresh-token flow for silent re-authentication.
- Deployment to a public URL: local Postgres would be replaced with a free
  managed Postgres instance (e.g. Neon), and the Express app deployed to a
  free-tier host.

## Security notes

- Passwords are hashed with bcrypt (`bcryptjs`) before storage; plaintext
  passwords are never persisted or logged.
- All SQL queries use parameterized placeholders (`$1`, `$2`, ...) — no
  string-concatenated SQL anywhere.
- Every route except register/login requires a valid JWT, and every
  resource lookup is scoped to the requesting user's team.
- API keys and JWT secrets are read only from environment variables, never
  hardcoded or printed to logs.
