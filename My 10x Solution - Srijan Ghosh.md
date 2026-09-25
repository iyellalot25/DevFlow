# My 10x Solution — Srijan Ghosh

**Project:** DevFlow — an AI-powered developer task planning and tracking system.

**Repository:** [https://github.com/iyellalot25/DevFlow](https://github.com/iyellalot25/DevFlow)

---

## 1. What is the problem I am solving?

Developers frequently write down a piece of engineering work as a single vague sentence — for example, _"move the API to Postgres and dockerize it"_ — and then have to manually translate that sentence into a real, actionable checklist before they can actually start working. This translation step is repetitive, easy to get wrong, and is exactly the kind of thing that gets skipped under time pressure — which is precisely when a task most needs to be broken down properly before work begins.

**Who has this problem:** individual developers and small dev teams who plan work informally (a one-line ticket, a Slack message, a note-to-self) and want a lightweight way to turn that into a trackable plan without adopting a heavyweight project-management tool.

**The 10x claim:** DevFlow reduces the time required to turn an unstructured development task into an actionable implementation checklist from several minutes of manual planning to a matter of seconds. This claim is specifically about the task-planning/decomposition step — it is not a claim about software development as a whole, and DevFlow does not attempt to write or modify any application code.

**Non-goal:** DevFlow is not an AI coding assistant. It does not generate, edit, or execute code, and it does not attempt to autonomously complete the subtasks it generates. Its only AI responsibility is turning a task description into a structured list of implementation steps.

---

## 2. How did I implement my solution?

### In plain words

A user registers, creates a project, and adds a task described in their own words. DevFlow sends that description through a narrowly-scoped LLM job whose only job is decomposition — it returns a structured, ordered list of implementation subtasks. Those subtasks are persisted and tracked to completion (todo / in progress / done), and progress can be exported as a PDF report at any time, generated from live data. Everything is backed by a real REST API, real persistence, and real authentication — a user only ever sees their own team's data.

Beyond the original scope, the system grew to support multiple users collaborating on shared projects (via a shareable join code), live updates across teammates' dashboards, and each team optionally supplying its own AI API key.

### The concepts implemented

All 5+ required concepts came directly from the primary FlyRank concept list — no swaps were needed.

| #   | Concept             | Where it lives in the code                                                                           | What makes it real                                                                                                                                                                                                    |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **API endpoints**   | `routes/*.js`                                                                                        | Full REST surface across auth, projects, tasks, subtasks, teams, jobs, and reports, with correct status codes (`201`/`204`/`400`/`401`/`404`/`429`) and input validation on every write                               |
| 2   | **Database**        | `schema.sql`, `services/*.js`, `db.js`                                                               | PostgreSQL with real foreign-key constraints across teams/users/projects/tasks/subtasks/jobs; data survives a full application restart                                                                                |
| 3   | **Authentication**  | `middleware/auth.js`, `services/authService.js`, `routes/auth.js`                                    | JWT access tokens + opaque, hashed refresh tokens, delivered as httpOnly cookies; every protected route verifies the session and independently re-checks that the requested resource belongs to the caller's own team |
| 4   | **Background jobs** | `worker.js`, `services/decompositionProcessor.js`                                                    | A DB-polling worker claims decomposition jobs with `FOR UPDATE SKIP LOCKED` (safe under multiple worker processes), with orphaned-job recovery on startup                                                             |
| 5   | **Reporting (PDF)** | `services/pdfService.js`, `routes/reports.js`                                                        | A generated-on-request PDF report built from live persisted data — project summary, per-task progress, subtask status markers                                                                                         |
| 6   | **LLM integration** | `services/llmService.js`, `services/decompositionValidator.js`, `services/decompositionProcessor.js` | One narrow job (task → structured subtasks) behind an authenticated endpoint, with a two-layer validation step (the LLM's raw response is never trusted directly) and per-job token/cost logging                      |

_Zero swaps were used — this row is intentionally empty; all six concepts are original._

### What was built beyond the required six

Once the core system was working end to end, the project grew past the original scope in ways that go beyond what the capstone required, but that made it a stronger, more complete system:

- **Team collaboration via shareable join codes** — multiple users can now share the same team's projects, joining or leaving via a code rather than a fixed one-user-per-team model.
- **Real-time updates (Server-Sent Events)** — every teammate's dashboard updates live when a project, task, or subtask changes, with no polling or manual refresh required.
- **Full CRUD everywhere** — projects, tasks, and subtasks can all be edited and deleted, not just created and read.
- **Bring-your-own AI API key** — a team can supply its own Gemini API key instead of sharing the default one, encrypted at rest (AES-256-GCM) and never exposed to any client.
- **Per-team usage quota and dashboard** — daily AI-decomposition limits enforced server-side with a clean `429` response, plus a visible usage/token dashboard in the UI.
- **Rate limiting** on login and registration to slow down brute-force attempts.
- **Health check endpoint** for uptime monitoring.
- **Full containerization** — the entire stack (app + database) starts with a single `docker compose up --build`.
- **Live deployment** — the app is deployed and publicly reachable (Render for the app, Neon for managed Postgres), both on free tiers.
- **A redesigned frontend and PDF report** — a proper three-pane dashboard UI and a typographically designed PDF report, rather than minimal placeholders.

None of this replaces or substitutes for the six required concepts above — it was built on top of a system where all six were already working and demonstrable on their own.

### How to run it

Full setup and environment variable documentation is in the repository's `README.md`. In short:

```bash
git clone <repo-url>
cd devflow
npm install
cp .env.example .env   # fill in real values, see README for the full table
docker compose up -d --build
```

The app is then available at `http://localhost:3000/`. A 5-minute guided demo path (register → create a project → describe a task → trigger AI decomposition → track progress → export a PDF) is documented in the README and has been verified end-to-end from a fresh clone.

No paid services or credit card are required anywhere in the stack.

---

## Summary

DevFlow demonstrates all six required backend concepts implemented for real — not stubbed — plus additional engineering (multi-user teams, real-time updates, encrypted per-team API keys, quota enforcement, containerized deployment) built on top of that required core. The system is deployed and reachable at the link above, in addition to being fully runnable locally with two documented commands.
