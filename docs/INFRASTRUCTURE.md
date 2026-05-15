# Technical Infrastructure

This document defines the runtime boundary for the Recursive Agent project.

## Architecture Overview
The system should be split into four primary runtime concerns:
1. UI and user interaction
2. Agent orchestration and workflow control
3. External tool and MCP integration
4. Sandbox execution, persistence, and observability

That separation keeps the application debuggable and makes deployment realistic.

## Recommended Runtime Layout

### 1. Frontend Application
The frontend is a Next.js application (`frontend/` in this repo) responsible for:
- mission creation and control
- dashboard rendering
- live status updates
- logs and audit surfaces
- user actions such as retry, pause, and cancel

This layer should stay lightweight and should not contain long-running agent loops.

### 2. Agent Worker
The agent worker (`backend/` in this repo) is the part that performs orchestration, reasoning, and tool routing. It should:
- maintain mission state
- run planner/reviewer/executor loops
- enforce budgets and maximum depth
- call MCP integrations
- enqueue and resolve sandbox tasks

This worker is the right place for logic that depends on Node APIs or long-lived execution.

### 3. Tool And MCP Layer
External tools should be abstracted behind adapters so the rest of the app does not care whether a tool is local, remote, or hosted.

Recommended integrations:
- Zapier MCP for external app automation
- Tavily for research and retrieval
- Mem9 or similar persistent memory if available
- Google Drive MCP for artifact storage

If a tool only works over stdio in local development, do not rely on that as the production path.

### 4. Sandbox Layer
Use E2B for code execution, tests, and any untrusted generation that must be isolated from the host.

Sandbox responsibilities:
- run generated code
- validate snippets or configs
- protect the host machine from unsafe execution
- return structured execution artifacts

## Data And State Model
The system should explicitly define the following records:
- missions
- mission steps
- agent roles
- tool call events
- execution artifacts
- budget usage events
- failure reasons

Store the core state in a database so workflows can resume after interruptions.

## Recommended Storage Stack
- PostgreSQL for durable mission state and audit logs
- Redis for queue state, locks, retries, and rate limits
- Object storage or Drive-like storage for artifacts and generated files

## Context And Memory
Use memory only where it improves mission continuity.

Good uses for memory:
- saving mission summaries
- storing handoff context
- caching reusable research outputs

Bad uses for memory:
- storing everything forever
- assuming memory can replace proper database state

## Execution Rules
### Budget Controls
Every mission should have:
- max iterations
- max tool calls
- max runtime
- max token budget

### Circuit Breakers
The worker must be able to stop safely if:
- the same step repeats too many times
- an external tool keeps failing
- the budget threshold is exceeded
- the user cancels the mission

### Retry Policy
Retries should be selective and bounded. Do not automatically retry infinite loops.

## Runtime Compatibility Guidance
Do not assume the following will run on Edge runtime:
- file system access
- process execution
- sandbox orchestration
- complex MCP clients
- background worker loops

Use Edge only for lightweight request handling if it is proven compatible. For the core agent worker, default to Node runtime.

## Security Model
### Secrets
Store all API keys and service tokens in deployment secrets, never in source control.

### Allowlisting
Only allow approved tool calls and approved external services.

### Isolation
Keep execution isolated from the host via E2B or an equivalent sandbox.

### Auditing
Log every mission transition, tool call, and failure state.

## Deployment Model
Recommended deployment split:
- Vercel or similar for the Next.js UI
- Railway, Render, VPS, or a container host for the agent worker
- Separate host for remote MCP services if needed
- Managed Postgres and Redis for persistence and queueing

This split avoids relying on serverless functions for every part of the workflow.

## Environment Variables
Typical runtime variables:
- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- E2B_API_KEY
- DATABASE_URL
- REDIS_URL
- SENTRY_DSN
- ZAPIER_MCP_URL
- TAVILY_API_KEY

## Failure Modes To Plan For
- MCP service unavailable
- sandbox launch failure
- database outage
- budget exceeded
- agent recursion loop
- stale mission state
- invalid tool result payload

## Operational Checklist
Before a demo or deployment, verify:
1. The UI loads.
2. The worker can accept a mission.
3. The worker can call at least one tool.
4. The sandbox can run a safe job.
5. The logs show the whole path.
6. The system stops cleanly on failure.
