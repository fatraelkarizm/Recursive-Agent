# STEP.md

This file is the build order for turning this docs-first repository into a runnable Recursive Agent application.

## Snapshot (read this first)
The repo already contains a **Next.js dashboard** in `frontend/` and an **Express worker** in `backend/`. The UI follows the three-column “workflow builder + control chat” layout described in [DESIGN.md](./DESIGN.md): recipes/API rail (left), React Flow canvas (center), mission chat + specialist readout (right).

**Fastest local run**
```bash
cd backend && npm install && npm run dev   # http://localhost:4000
cd frontend && npm install && npm run dev  # http://localhost:3000
```

**Still open for “full product” quality** — persistence, streaming logs, real MCP hosts, hardened budgets, production deploy polish. Use the checklist below to track those slices.

The recommended shape is a single Next.js frontend plus a separate Node worker for agent orchestration and tool execution.

## Boilerplate Intent
This repository is meant to be built one slice at a time.

Build the folder structure first, then wire one feature at a time:
- create the workspace
- create the frontend shell
- create the backend worker shell
- create the shared types and config
- create the specialist agent configurator
- create one mission flow
- create one tool integration
- create one sandbox path
- create persistence and logs
- polish the UI last

## Quick Audit Checklist
- [x] Repo workspace created (`frontend/`, `backend/`, `docs/`)
- [x] Frontend bootstrapped (Next.js App Router + Tailwind)
- [x] Backend worker bootstrapped (Express + TypeScript)
- [ ] Environment files prepared locally (`.env` / `.env.local` — never commit)
- [x] Mission UI scaffolded (canvas + chat + rail + vitals + terminal)
- [x] Specialist agent config panel (summary under control chat)
- [x] Mother agent generates agent profile (worker stub in `backend/src/agent/mother-agent.ts`)
- [x] Worker orchestration flow (mission graph + tool stub + sandbox stub)
- [x] Frontend connected to worker (`POST /api/missions` via `frontend/src/lib/api.ts`)
- [ ] One real tool integration (replace stub router with live MCP/Tavily/etc.)
- [ ] Sandbox execution path hardened (E2B beyond echo)
- [x] Persistence added (PostgreSQL + Prisma for missions, profiles, and events)
- [ ] Observability added (streaming logs, Sentry, toasts)
- [ ] Safety limits added
- [ ] End-to-end smoke test passed on clean machine
- [ ] Demo assets prepared
- [ ] Submission assets ready

## Goal
Build a demoable app with:
- a mission control UI
- one mother agent flow
- one tool call
- one execution sandbox path
- one visible log / audit trail

## 0. Prerequisites
Install these first on the machine:
- Node.js 20+ 
- npm 10+ or pnpm 9+
- Git
- A code editor
- Accounts or API keys for the services you actually plan to use

PostgreSQL is now part of the MVP. Redis is still optional for queues/rate limits.

## 1. Create The Workspace
If this repo is still docs-only, create the actual app folders from the root.

Recommended layout:

```text
frontend/
backend/
```

If you prefer a single Next.js app with a worker folder inside it, use:

```text
src/
worker/
```

For hackathon speed, the simplest path is a Next.js app in `frontend` and a Node worker in `backend`.

Create the folders one by one if you want the boilerplate to stay clean:

```bash
mkdir frontend
mkdir backend
```

> **Status:** folders already exist in this repository.

## 2. Bootstrap The Frontend
Create the frontend app first.

**Option A — interactive wizard**

```bash
npx create-next-app@latest
```

Choose TypeScript, Tailwind, ESLint, App Router, `src/`, import alias `@/*`, and output directory `frontend` (or create `frontend`, `cd frontend`, then run the wizard with project name `.` inside that empty folder).

**Option B — one shot from repo root (no prompts)**

```bash
npx create-next-app@latest frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
cd frontend
```

Skip Option A/B if this repository already contains `frontend/` with code; only run `npm install` there.

If `npx create-next-app` reports **directory contains files that could conflict**, see the troubleshooting block in [SETUP.md](./SETUP.md) §1 (rename `frontend` or skip the command).

Install the UI, graph, and client packages:

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic @modelcontextprotocol/sdk
npm install framer-motion lucide-react clsx tailwind-merge zod @xyflow/react sonner nanoid pino
```

Persistence lives in the backend workspace. It already uses:

```bash
npm install --workspace backend @prisma/client
npm install --workspace backend -D prisma
```

Redis remains optional:

```bash
npm install --workspace backend ioredis
```

> **Status:** `frontend/package.json` already includes the UI + `@xyflow/react` stack. Run `npm install` after pulling changes.

## 3. Bootstrap The Backend Worker
Create the worker folder for orchestration and sandbox logic.

```bash
cd ../backend
npm init -y
npm install @langchain/core @langchain/langgraph @e2b/code-interpreter zod pino nanoid
```

If the worker needs HTTP transport, add:

```bash
npm install express cors dotenv
```

If you want TypeScript in the worker too:

```bash
npm install -D typescript tsx @types/node @types/express
npx tsc --init
```

> **Status:** `backend/package.json` already includes Express + LangChain + E2B helpers.

## 4. Create The Environment Files
Add a `.env.local` file in the frontend and a `.env` file in the backend.

Frontend example:

```env
OPENAI_API_KEY="..."
ANTHROPIC_API_KEY="..."
ZAPIER_MCP_URL="..."
TAVILY_API_KEY="..."
DATABASE_URL="..."
REDIS_URL="..."
SENTRY_DSN="..."
NEXT_PUBLIC_BACKEND_URL="http://localhost:4000"
```

Backend example:

```env
OPENAI_API_KEY="..."
ANTHROPIC_API_KEY="..."
E2B_API_KEY="..."
DATABASE_URL="..."
REDIS_URL="..."
```

Never commit these files.

## 5. Build The Frontend Skeleton
Create these pages and panels in the frontend:
- mission canvas (React Flow graph)
- control chat / mission stream (right column)
- vitals panel
- terminal drawer
- workspace rail (recipes + API/integration hints)
- specialist agent summary (under the chat composer)

The first version can be static, but it must show the structure of the app.

Suggested folder order for the frontend boilerplate:
1. `src/app`
2. `src/components`
3. `src/lib`
4. `src/lib/types.ts`
5. `src/lib/api.ts`
6. `src/components/workspace-rail.tsx`
7. `src/components/control-chat-panel.tsx`
8. `src/components/workflow-nodes.tsx`
9. `src/components/specialist-agent-panel.tsx`
10. `src/components/mission-canvas.tsx`
11. `src/components/mission-stream.tsx` (optional legacy helper)
12. `src/components/vitals-panel.tsx`
13. `src/components/terminal-drawer.tsx`

Suggested frontend files:

```text
src/app/page.tsx
src/components/workspace-rail.tsx
src/components/control-chat-panel.tsx
src/components/workflow-nodes.tsx
src/components/mission-canvas.tsx
src/components/mission-stream.tsx
src/components/vitals-panel.tsx
src/components/terminal-drawer.tsx
src/components/specialist-agent-panel.tsx
src/lib/api.ts
src/lib/types.ts
```

The specialist agent panel should show the agent generated by the mother agent and expose editable fields for:
- agent name
- agent role
- agent purpose
- allowed tools
- system prompt or instructions
- API key references
- output format
- manual notes from the user

This panel should appear on the **right side under the control chat** so the user can inspect and edit the generated agent immediately after each mission response.

If you want to keep the boilerplate extra clean, make the panel support three states:
- empty state before the mother agent runs
- generated state after the mother agent returns a profile
- manual edit state after the user changes the profile

> **Next easy win:** convert the specialist summary into a controlled form and persist edits back to the worker.

## 6. Build The Worker Skeleton
Create the worker flow in the backend.

Suggested folder order for the backend boilerplate:
1. `src/server.ts`
2. `src/logging.ts`
3. `src/agent`
4. `src/agent/mother-agent.ts`
5. `src/agent/mission-graph.ts`
6. `src/agent/tool-router.ts`
7. `src/sandbox`
8. `src/sandbox/e2b.ts`

Suggested backend files:

```text
src/agent/mother-agent.ts
src/agent/mission-graph.ts
src/agent/tool-router.ts
src/sandbox/e2b.ts
src/logging.ts
src/server.ts
```

The worker should:
- accept a mission request
- generate a specialist agent profile from the mother agent
- turn it into steps
- call one external tool
- run one sandboxed action
- return a structured result

The worker should also return the generated agent definition so the frontend can render it in the configurator panel.

Start with one worker route or handler only. Add more routes later if you need them.

> **Status:** `POST /api/missions` returns `{ missionId, status, profile, events }` today. Grow `events` as you add real telemetry. Tavily Extract (URL “browser” read) + OpenClaw CLI orchestration live in `backend/src/capabilities/browser.ts` and `backend/src/agent/openclaw-bridge.ts` — see [OPENCLAW_INTEGRATION.md](./OPENCLAW_INTEGRATION.md).

## 7. Connect Frontend To Worker
Pick one transport.

Good options:
- simple REST endpoint from frontend to backend
- server actions that call the worker
- SSE or WebSocket for live updates

For the hackathon, REST plus polling or SSE is usually the fastest.

Minimum contract:
- frontend sends mission input
- worker returns mission id
- worker returns generated agent profile
- frontend polls or subscribes for status
- frontend renders progress and final output

> **Status:** REST client implemented in `frontend/src/lib/api.ts`. Add polling/SSE when missions become long-lived.

## 8. Add One Real Agent Flow
Do not start with full autonomy.

Implement one path:
1. user submits a mission
2. mother agent breaks it into one or two steps
3. mother agent generates a specialist agent profile
4. frontend shows the profile in the right-side configurator
5. user can edit the profile manually if needed
6. worker calls one tool
7. worker writes a log event
8. frontend shows the result

This is enough to prove the product direction.

> **Status:** happy-path stub covers steps 1–4 + 6–8; manual edit persistence (step 5) is still open.

## 9. Add One Tool Integration
Choose the easiest integration that can actually work in time.

Safer choices:
- Tavily for research
- a simple file or database action
- a mock MCP adapter that you can later replace with the real service

Avoid trying to wire too many external systems in the first day.

## 10. Add The Sandbox Path
Integrate E2B only after the basic flow works.

The sandbox should:
- receive generated code or a simple task
- execute it safely
- return stdout, stderr, and status

If the sandbox is unstable, the demo should still work without it.

## 11. Add Persistence
> **Status:** implemented with PostgreSQL + Prisma in `backend/prisma/schema.prisma` and `backend/src/db/mission-store.ts`.

Persisted records:
- `missions` stores mission id, prompt, status, create time, and completion time.
- `specialist_profiles` stores the generated specialist summary plus the full profile JSON.
- `mission_events` stores ordered event messages for audit/readback.

Local setup:

```bash
docker run --name recursive-agent-postgres \
  -e POSTGRES_USER=recursive \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=recursive_agent \
  -p 5432:5432 \
  -d postgres:16

copy backend\.env.example backend\.env
npm --workspace backend run db:generate
npm --workspace backend run db:migrate
```

Set `backend/.env`:

```env
DATABASE_URL="postgresql://recursive:postgres@localhost:5432/recursive_agent?schema=public"
```

The backend degrades gracefully when `DATABASE_URL` is absent: missions still complete, but persistence is skipped and the returned events explain why.

## 12. Add Observability
You need visibility for demoing and debugging.

Add:
- structured logs
- error boundaries
- toast or status feedback
- timestamps on mission events

If possible, add Sentry after the core flow is stable.

## 13. Add Safety Limits
Before the app is considered done, enforce:
- max iterations
- max tool calls
- max runtime
- max budget or token cap

These limits prevent runaway loops and make the system feel trustworthy.

## 14. Make The UI Feel Real
Once the flow works, improve the interface.

Polish priorities:
- clear loading states
- clear success states
- clear error states
- graph node status colors
- compact audit logs
- readable spacing and typography
- editable specialist agent form state
- clear handoff between generated config and manual config

The generated agent should feel like a real artifact, not just a chat response. Users need to understand what the agent is, what it can do, and what they can still change by hand.

Do not spend too long on decorative motion before the workflow is stable.

## 15. Run The App Locally
Open two terminals.

Frontend:

```bash
cd frontend
npm run dev
```

Backend:

```bash
cd backend
npm run dev
```

If the backend is a TypeScript worker using `tsx`, the dev script can be:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts"
  }
}
```

## 16. Smoke Test The End-To-End Flow
Before you add more features, verify this sequence:
1. Load the app.
2. Submit one mission.
3. See the mission id.
4. See at least one tool call.
5. See one sandbox or execution result.
6. See the final status in the UI.

If any of these fail, fix the workflow before adding new scope.

## 17. Prepare For Demo
When the app is stable enough for the hackathon demo:
- seed a demo mission
- make the logs easy to read
- ensure the graph updates visibly
- ensure the error state is not broken
- record a short walkthrough video

## 18. Prepare For Submission
Before final submission, confirm:
- README has install and run instructions
- AI models and tools are listed
- pitch deck is exported as PDF
- repo is public
- demo video is accessible

## Recommended Build Order
If time is short, build in this order:
1. workspace and install
2. frontend shell
3. backend worker
4. mission state contract
5. one tool call
6. one sandbox action
7. persistence
8. UI polish
9. demo assets

## Definition Of Done
The project is “done enough” when a reviewer can:
- read the README and understand how to run it
- start the frontend and backend
- submit one mission
- watch the mission progress
- inspect logs and output
- understand the agent architecture from the docs
