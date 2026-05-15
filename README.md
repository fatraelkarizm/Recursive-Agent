# Recursive Agent: Build Specialist Agents By Chat

OpenClaw Agenthon 2026 project docs for **Recursive Agent**, a multi-agent product that helps non-developers create their own specialist agents.

## Overview
The problem this project solves is simple: most AI agents are too static, too generic, and are usually built only by developers for developers. People can chat with them, but they cannot easily shape the agent into something purpose-built for their own workflow.

Recursive Agent changes that. A user can describe what they want in plain chat, and the Central Agent compiles that request into a reusable specialist-agent package: role, scope, tools, SKILL.md playbook, README, sub-agent fleet, and review notes. The result is not a one-size-fits-all agent or a one-off HTML generator. It is a custom agent built for one job, such as coding, scraping, research, recommendations, workflow automation, or other specialized tasks.

The product is designed to feel like a mission control dashboard rather than a hidden chat bot. It makes the agent structure visible, editable, and easy to understand.

## Current Repository Status
This repository is a **working monorepo slice**:
- **`frontend/`** — Next.js Latest dashboard with a three-column mission control UI, React Flow workflow canvas, and REST client to the worker.
- **`backend/`** — Express worker with a Central Agent mission path, stub tool routing, and optional E2B wiring (see `backend/src`).


## Product Story
The user experience should feel like this:
1. The user chats with the Central Agent.
2. The Central Agent asks for the goal and converts it into a reusable specialist-agent package.
3. The system generates the agent profile, SKILL.md playbook, README, instructions, and tool access.
4. A configuration panel appears so the user can edit the agent manually if needed.
5. The user can inspect what the agent does, what it knows, and what tools it can use.
6. The agent then works on the task with a focused scope instead of trying to do everything.

## What The Product Does
- Turns a plain chat request into a reusable specialist-agent package.
- Lets the user create agents for coding, scraping, research, recommendations, automation, and similar workflows.
- Keeps each agent focused on its specialty instead of forcing one general-purpose bot to do everything.
- Shows the generated agent definition, SKILL.md, README, tools, and review state in a visible dashboard.
- Lets the user manually adjust the agent instructions, settings, and API key references.
- Treats content/code output as a sample deliverable, not the core product; the core artifact is the agent itself.
- Uses external tools for research, execution, and integration work.
- Shows a live operational dashboard with mission state, logs, runtime health, and budget awareness.
- **Automatic orchestration** (default): every mission **schedules** the scout/worker/reviewer fleet and builds a merged Central Agent report in the mission graph. **Sub-agent turns only produce real LLM output** when an OpenAI-compatible gateway (`OPENAI_COMPAT_BASE_URL` + bearer) or a working **OpenClaw** fallback is available; otherwise events show `source=skipped` with a placeholder — the mission still completes (graceful degradation). Set `AUTO_ORCHESTRATION=0` in `backend/.env` to orchestrate only when the user asks for fleet/multi-agent explicitly.
- Keeps the system bounded with circuit breakers, budgets, and state checkpoints.

## Why This Fits The Hackathon
- It clearly contains an AI agent / multi-agent system component.
- It demonstrates reasoning, orchestration, tool usage, and workflow execution.
- It solves a real usability gap by making agent creation accessible through chat.
- It can be shown well in a short demo because the agent actions are visible in the UI and logs.
- It has a practical extension story through MCP integrations, sandbox execution, and persistent memory.

## Mission Control UI (implemented layout)
The dashboard follows a **visual workflow builder** metaphor (similar to n8n-style canvases):
- **Left rail** — API & integrations strip (Central Agent worker route, OpenClaw, Tavily, runtime config, env files). Recipes were removed so the product stays focused on one user-written mission instead of canned prompts.
- **Center canvas** — `@xyflow/react` graph: trigger → Central Agent (model / memory / tools) → policy branch → tool-heavy vs sandbox paths. Status rings reflect the latest mission state.
- **Right column** — **Control chat**: send a mission, read assistant handoffs, and inspect the generated specialist profile under the thread.
- **Agent dashboard** — Per specialist/sub-agent: tabs include **Config** (worker model/env snapshot via `GET /api/runtime-config` — no secret values), SKILL.md, README, optional sample preview, and results.
- **Below the canvas** — Vitals plus a compact terminal/audit readout fed by the latest assistant message.

## Suggested Tech Stack
- Frontend and API shell: Next.js Latest with TypeScript
- Orchestration: LangGraph.js and an OpenClaw-style Central Agent layer
- Tool access: Model Context Protocol servers and Vercel AI SDK clients
- Execution sandbox: E2B
- Persistence: PostgreSQL plus Redis or queue support
- UI: Tailwind CSS, Framer Motion, Lucide icons, and `@xyflow/react` for the graph canvas
- Observability: structured logs, error tracking, and audit events

## Repository Layout (this codebase)
```text
frontend/src/app          # Next.js routes and shell
frontend/src/components   # Mission UI modules (canvas, chat, rail, vitals, terminal)
frontend/src/lib          # API client, types, helpers
backend/src               # Express server, Central Agent, tools, sandbox stubs
backend/prisma            # PostgreSQL schema and migration for missions/profiles/events
docs/                     # Product + build documentation (STEP.md is the runbook)
```

## Specialist Agent Model
Each generated agent should have a clear profile with:
- name
- role
- purpose
- allowed tools
- system instructions
- input and output expectations
- config fields
- API key references if needed
- SKILL.md playbook with when to use it, workflow, constraints, tools, and expected outputs
- README.md for human-facing usage and handoff notes

The user should be able to see and edit that profile before the agent is finalized.

## Installation And Run (this repo)
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment templates if you use keys (never commit secrets). See [SETUP.md](./docs/SETUP.md).
3. Start PostgreSQL and apply the Prisma migration if you want persistence:
   ```bash
   docker run --name recursive-agent-postgres -e POSTGRES_USER=recursive -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=recursive_agent -p 5432:5432 -d postgres:16
   npm --workspace backend run db:migrate
   ```
4. Start the worker, then the UI:
   ```bash
   # terminal A
   npm run dev:backend

   # terminal B
   npm run dev:frontend
   ```
5. Open `http://localhost:3000`. The UI calls `http://localhost:4000` by default. Override with `NEXT_PUBLIC_BACKEND_URL` in `frontend/.env.local` if needed.

For greenfield bootstrap, use `npx create-next-app@latest` (wizard) or the non-interactive one-liner in [SETUP.md](./docs/SETUP.md). This repo already ships a `frontend/` app; optional packages and MCP hosts are covered there too.

## Environment Variables
The implementation will need values for:
- AI model providers
- E2B sandbox access
- MCP authentication or remote endpoints
- Memory and persistence backends
- Optional observability services

See [SETUP.md](./docs/SETUP.md) and [LIBRARY.md](./docs/LIBRARY.md) for the exact list.

### Fleet / sub-agent LLM gateway (`OPENAI_COMPAT_*`)
Sub-agents (scout → worker → reviewer) call **`POST …/chat/completions`** on an **OpenAI-compatible** HTTP API (same shape as OpenAI, SumoPod, LiteLLM, vLLM, many hosted gateways).

- **`OPENAI_COMPAT_BASE_URL`** — Root URL that already includes **`/v1`**. Contoh: `https://ai.sumopod.com/v1` (bukan cuma hostname; backend akan menempel path `chat/completions`).
- **`OPENAI_COMPAT_API_KEY`** atau **`DEEPSEEK_API_KEY`** — Bearer token untuk header `Authorization`. Salah satu harus terisi.
- **`OPENAI_COMPAT_MODEL`** — ID model di provider itu, mis. `qwen3.6-plus` (SumoPod: tanpa prefix `qwen/`).

Tanpa pasangan **base URL + key**, fleet tetap jalan tapi tiap sub-agent `source=skipped` sampai OpenClaw CLI benar-benar bisa dipakai sebagai fallback. Lihat [OPENCLAW_INTEGRATION.md](./docs/OPENCLAW_INTEGRATION.md).

**HTTP 402 / “Insufficient Balance” (DeepSeek via SumoPod):** sering **bukan** karena SumoPod Credit kamu habis — dashboard bisa masih ~$3 sementara **route `deepseek/deepseek-v4-pro`** ditolak (pool DeepSeek upstream SumoPod). Cek log SumoPod: request sukses vs Failure. **Workaround:** `OPENAI_COMPAT_MODEL=gemini/gemini-2.5-flash` (biasanya masih jalan dengan key yang sama). Backend juga auto-retry fallback bila primary DeepSeek 402. Setelah gateway HTTP gagal, fleet **mencoba OpenClaw** (`OPENCLAW_ORCHESTRATION=1`).

## Persistence
The backend stores completed missions, generated specialist profiles, and ordered mission events in PostgreSQL:
- `missions`
- `specialist_profiles`
- `mission_events`

Set `DATABASE_URL` in `backend/.env` and run `npm --workspace backend run db:migrate`. This applies committed Prisma migrations without creating a shadow database. If `DATABASE_URL` is absent, the mission still completes and the returned events explain that persistence was skipped.

## Key Product Principles
- Visible agent behavior is better than a black box.
- Each tool call should be logged and explainable.
- Every long-running workflow needs a stop condition.
- The UI should prioritize signal over decoration.
- Mobile support should be a status-oriented monitor mode, not a full control surface.
- Specialist agents should be easy to create without forcing the user to think like a developer.

## Documentation Index
- [STEP.md](./docs/STEP.md) — **Start here:** what is implemented, checklists, and copy-paste run order
- [SETUP.md](./docs/SETUP.md) — Bootstrap commands and environment setup
- [OPENCLAW_INTEGRATION.md](./docs/OPENCLAW_INTEGRATION.md) — OpenClaw CLI orchestration + Tavily web read/search
- [LIBRARY.md](./docs/LIBRARY.md) — Dependency and MCP registry
- [DESIGN.md](./docs/DESIGN.md) — UI system and interaction model (includes the three-column layout)
- [INFRASTRUCTURE.md](./docs/INFRASTRUCTURE.md) — Runtime architecture and deployment model
- [MEM9_OPENCLAW.md](./docs/MEM9_OPENCLAW.md) — mem9 status and OpenClaw setup notes
- [COMMIT.md](./docs/COMMIT.md) — Commit and branch workflow
- [REQUIREMENTS.md](./docs/REQUIREMENTS.md) — Hackathon requirement reference

## Implementation Notes
- Do not assume all agent or MCP packages run on Edge runtime.
- Keep the UI and worker concerns separate so the app can degrade gracefully.
- Prefer one stable, demoable end-to-end path over many partially working features.

## License And Credits
This repository is a hackathon concept project and should be populated with the actual team implementation, demo assets, and release notes before submission.
