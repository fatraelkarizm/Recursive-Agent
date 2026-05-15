# Quick Start Setup

This file is the bootstrap checklist for turning the docs in this repository into a runnable Next.js implementation for Recursive Agent.

## 0. If You Cloned This Repository
The hackathon monorepo already contains `frontend/` and `backend/`. You can skip **§1 Create The App Shell** unless you are rebuilding from scratch.

```bash
cd frontend && npm install
cd ../backend && npm install
```

Point the UI at the worker (defaults to `http://localhost:4000`):

```env
# frontend/.env.local (optional)
NEXT_PUBLIC_BACKEND_URL="http://localhost:4000"
```

Run both processes (two terminals):

```bash
cd backend && npm run dev
cd frontend && npm run dev
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

Optional backend packages if you want persistence and queueing in the MVP:

```bash
npm install prisma @prisma/client ioredis
```

## 3. Add Environment Variables
Create `.env.local` in the project root and keep it out of Git.

```env
# AI providers
OPENAI_API_KEY="sk-proj-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Sandbox execution
E2B_API_KEY="e2b_..."

# MCP and integrations
ZAPIER_MCP_URL="https://..."
TAVILY_API_KEY="tvly-..."

# Persistence
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."

# Optional observability
SENTRY_DSN="https://..."
```

If you are using a provider-specific SDK instead of a remote MCP endpoint, replace the URL fields with the corresponding auth tokens.

## 4. Configure The Local Development Workflow
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
		"lint": "next lint"
	}
}
```

## 5. MCP Server Setup
Use hosted HTTP/SSE MCP services when possible. If you need local development servers, run the specific MCP server you are testing and wire it through your client layer.

Example placeholders:

```bash
npx -y @modelcontextprotocol/server-memory
npx -y @tavily/mcp-server
```

Do not assume a stdio-only MCP process will work in a serverless production deployment.

## 6. Development Smoke Test
After wiring the first MVP slice, verify the flow in this order:
1. Open the dashboard.
2. Trigger one mission.
3. Confirm one tool call is logged.
4. Confirm the agent state updates.
5. Confirm the UI renders the result without a full reload.

## 7. Run The App

```bash
npm run dev
```

## 8. Recommended MVP Scope
Build the smallest demo that can be shown in under two minutes:
- one mother agent
- one visible mission state machine
- one tool call
- one log panel
- one success and one error path

## 9. Before You Deploy
- Replace placeholder credentials with real secrets in your deployment platform.
- Verify whether every runtime dependency works on Edge or must stay on Node.
- Move any long-running agent logic to a worker process if needed.
- Make sure the README contains the exact commands a judge can run.
