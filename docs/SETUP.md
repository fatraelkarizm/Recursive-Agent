# Quick Start Setup

This file is the bootstrap checklist for turning the docs in this repository into a runnable Next.js implementation for Recursive Agent.

## 0. If You Cloned This Repository
The hackathon monorepo already contains `frontend/` and `backend/`. You can skip **§1 Create The App Shell** unless you are rebuilding from scratch.

```bash
npm install
```

Point the UI at the worker (defaults to `http://localhost:4000`):

```env
# frontend/.env.local (optional)
NEXT_PUBLIC_BACKEND_URL="http://localhost:4000"
```

Run both processes (two terminals):

```bash
npm run dev:backend
npm run dev:frontend
```

For a step-by-step audit of what is implemented vs pending, read [STEP.md](./STEP.md).

## 1. Create The App Shell
If the app does not exist yet, scaffold Next.js with the official CLI.

**Interactive (wizard, recommended the first time you run it)**

```bash
npx create-next-app@latest
```

Pick TypeScript, Tailwind, ESLint, App Router, and `src/`. Use folder name `frontend` if you are following this monorepo layout.

**Non-interactive (same defaults, no prompts)**

From the repository root (only if `frontend/` does **not** already exist):

```bash
npx create-next-app@latest frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
cd frontend
```

If `frontend/` already exists (for example after cloning this repo), skip creation and only run `npm install` inside `frontend/`.

### If you see: "The directory frontend contains files that could conflict"
That is normal. `create-next-app` will not overwrite a non-empty app folder.

Pick one:

1. **Keep the existing app (usual for this repo)** — do not run `create-next-app` again. From repo root: `cd frontend && npm install && npm run dev`.

2. **Really want a brand-new Next scaffold named `frontend`** — move the old app aside, then run the same `npx` line again (PowerShell from `E:\hackathon\agenthon`):
   ```powershell
   Rename-Item -Path frontend -NewName frontend_backup
   npx create-next-app@latest frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
   ```
   Then copy your custom code from `frontend_backup\src` into the new `frontend\src` (and merge `package.json` / env files as needed). Delete `frontend_backup` when you are done.

## 2. Install Core Dependencies
Install the packages that cover agent orchestration, AI clients, graph UI, validation, execution, and app polish.

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic @modelcontextprotocol/sdk @langchain/core @langchain/langgraph @e2b/code-interpreter
npm install lucide-react clsx tailwind-merge framer-motion zod @xyflow/react sonner
npm install pino nanoid
```

Backend persistence packages are included in this repository:

```bash
npm install --workspace backend @prisma/client
npm install --workspace backend -D prisma
```

Redis is still optional for queues/rate limits:

```bash
npm install --workspace backend ioredis
```

## 3. Add Environment Variables
Create local env files and keep them out of Git. Frontend public config belongs in `frontend/.env.local`; backend secrets and database URLs belong in `backend/.env`.

```env
# AI providers
OPENAI_API_KEY="sk-proj-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Sandbox execution
E2B_API_KEY="e2b_..."

# MCP and integrations
ZAPIER_MCP_URL="https://..."
TAVILY_API_KEY="tvly-..."

# Persistence (backend)
DATABASE_URL="postgresql://recursive:postgres@localhost:5432/recursive_agent?schema=public"
REDIS_URL="redis://..."

# Optional observability
SENTRY_DSN="https://..."
```

If you are using a provider-specific SDK instead of a remote MCP endpoint, replace the URL fields with the corresponding auth tokens.

## 4. Configure PostgreSQL Persistence
The backend stores completed missions, generated specialist profiles, and ordered event logs in PostgreSQL through Prisma.

Start a local Postgres container:

```bash
docker run --name recursive-agent-postgres \
  -e POSTGRES_USER=recursive \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=recursive_agent \
  -p 5432:5432 \
  -d postgres:16
```

Set `backend/.env`:

```env
DATABASE_URL="postgresql://recursive:postgres@localhost:5432/recursive_agent?schema=public"
```

If you already created the `recursive_agent` database in pgAdmin, also create the matching login role or change `DATABASE_URL` to an existing PostgreSQL user.

Run this in pgAdmin Query Tool while connected as a superuser such as `postgres`:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'recursive') THEN
    CREATE ROLE recursive WITH LOGIN PASSWORD 'postgres';
  END IF;
END
$$;

ALTER DATABASE recursive_agent OWNER TO recursive;
GRANT ALL PRIVILEGES ON DATABASE recursive_agent TO recursive;
GRANT USAGE, CREATE ON SCHEMA public TO recursive;
```

If you prefer using your existing `postgres` account instead, set:

```env
DATABASE_URL="postgresql://postgres:<your-password>@localhost:5432/recursive_agent?schema=public"
```

Generate the Prisma client and apply the schema:

```bash
npm --workspace backend run db:generate
npm --workspace backend run db:migrate
```

If `DATABASE_URL` is not configured, the backend still runs and returns mission responses, but the response events will include `Persistence skipped: DATABASE_URL is not configured`.

## 5. Configure The Local Development Workflow
Recommended directories to create early:

```text
src/app
src/components
src/lib/agent
src/lib/mcp
src/lib/sandbox
src/lib/db
src/lib/logging
```

Recommended npm scripts:

```json
{
	"scripts": {
		"dev": "next dev",
		"build": "next build",
		"start": "next start",
		"lint": "eslint ."
	}
}
```

## 6. MCP Server Setup
Use hosted HTTP/SSE MCP services when possible. If you need local development servers, run the specific MCP server you are testing and wire it through your client layer.

Example placeholders:

```bash
npx -y @modelcontextprotocol/server-memory
npx -y @tavily/mcp-server
```

Do not assume a stdio-only MCP process will work in a serverless production deployment.

## 7. Development Smoke Test
After wiring the first MVP slice, verify the flow in this order:
1. Open the dashboard.
2. Trigger one mission.
3. Confirm one tool call is logged.
4. Confirm the agent state updates.
5. Confirm the UI renders the result without a full reload.

## 8. Run The App

```bash
npm run dev:backend
npm run dev:frontend
```

## 9. Recommended MVP Scope
Build the smallest demo that can be shown in under two minutes:
- one mother agent
- one visible mission state machine
- one tool call
- one log panel
- one success and one error path

## 10. Before You Deploy
- Replace placeholder credentials with real secrets in your deployment platform.
- Verify whether every runtime dependency works on Edge or must stay on Node.
- Move any long-running agent logic to a worker process if needed.
- Make sure the README contains the exact commands a judge can run.
