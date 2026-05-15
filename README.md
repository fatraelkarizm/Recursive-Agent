# Recursive Agent: Build Specialist Agents By Chat

OpenClaw Agenthon 2026 project docs for **Recursive Agent**, a multi-agent product that helps non-developers create their own specialist agents.

## Overview
The problem this project solves is simple: most AI agents are too static, too generic, and are usually built only by developers for developers. People can chat with them, but they cannot easily shape the agent into something purpose-built for their own workflow.

Recursive Agent changes that. A user can describe what they want in plain chat, and the mother agent turns that request into a specialist agent with a clear role, clear instructions, and configurable settings. The result is not a one-size-fits-all agent. It is a custom agent built for one job, such as coding, scraping, research, recommendations, workflow automation, or other specialized tasks.

The product is designed to feel like a mission control dashboard rather than a hidden chat bot. It makes the agent structure visible, editable, and easy to understand.

This repository currently serves as the specification and launchpad for Recursive Agent. It contains the design, infrastructure, setup guidance, and dependency registry needed to build the implementation from scratch.

## Product Story
The user experience should feel like this:
1. The user chats with the mother agent.
2. The mother agent asks for the goal and converts it into a specialist agent.
3. The system generates the agent profile, instructions, and tool access.
4. A configuration panel appears so the user can edit the agent manually if needed.
5. The user can inspect what the agent does, what it knows, and what tools it can use.
6. The agent then works on the task with a focused scope instead of trying to do everything.

## What The Product Does
- Turns a plain chat request into a specialist agent.
- Lets the user create agents for coding, scraping, research, recommendations, automation, and similar workflows.
- Keeps each agent focused on its specialty instead of forcing one general-purpose bot to do everything.
- Shows the generated agent definition in a visible configuration panel.
- Lets the user manually adjust the agent instructions, settings, and API key references.
- Uses external tools for research, execution, and integration work.
- Shows a live operational dashboard with mission state, logs, runtime health, and budget awareness.
- Keeps the system bounded with circuit breakers, budgets, and state checkpoints.

## Why This Fits The Hackathon
- It clearly contains an AI agent / multi-agent system component.
- It demonstrates reasoning, orchestration, tool usage, and workflow execution.
- It solves a real usability gap by making agent creation accessible through chat.
- It can be shown well in a short demo because the agent actions are visible in the UI and logs.
- It has a practical extension story through MCP integrations, sandbox execution, and persistent memory.

## Current Repository Status
The repository is docs-first. There is not yet a committed application source tree in this folder, so the setup instructions below are the canonical path to bootstrap the implementation.

## Suggested Tech Stack
- Frontend and API shell: Next.js 14+ with TypeScript
- Orchestration: LangGraph.js and an OpenClaw-style mother agent layer
- Tool access: Model Context Protocol servers and Vercel AI SDK clients
- Execution sandbox: E2B
- Persistence: PostgreSQL plus Redis or queue support
- UI: Tailwind CSS, Framer Motion, Lucide icons, and a graph canvas library
- Observability: structured logs, error tracking, and audit events

## Recommended Project Structure
- `src/app` for routing and page composition
- `src/components` for dashboard panels and reusable UI blocks
- `src/lib/agent` for orchestration, tool routing, and state handling
- `src/lib/mcp` for MCP clients and adapters
- `src/lib/sandbox` for E2B execution helpers
- `src/lib/db` for persistence and audit logs
- `src/config` for runtime and feature flags

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

The user should be able to see and edit that profile before the agent is finalized.

## Installation And Setup
Follow [SETUP.md](./docs/SETUP.md) for the full bootstrap flow. The short version is:
1. Create the Next.js app with TypeScript, App Router, and Tailwind.
2. Install the agent, UI, sandbox, validation, and observability packages.
3. Add the required environment variables.
4. Configure any MCP servers that run outside the browser or application process.
5. Start the dev server and verify the main end-to-end flow.

## Environment Variables
The implementation will need values for:
- AI model providers
- E2B sandbox access
- MCP authentication or remote endpoints
- Memory and persistence backends
- Optional observability services

See [SETUP.md](./docs/SETUP.md) and [LIBRARY.md](./docs/LIBRARY.md) for the exact list.

## Key Product Principles
- Visible agent behavior is better than a black box.
- Each tool call should be logged and explainable.
- Every long-running workflow needs a stop condition.
- The UI should prioritize signal over decoration.
- Mobile support should be a status-oriented monitor mode, not a full control surface.
- Specialist agents should be easy to create without forcing the user to think like a developer.

## Documentation Index
- [STEP.md](./docs/STEP.md) - Build order from workspace bootstrap to a running app
- [SETUP.md](./docs/SETUP.md) - Bootstrap commands and environment setup
- [LIBRARY.md](./docs/LIBRARY.md) - Dependency and MCP registry
- [DESIGN.md](./docs/DESIGN.md) - UI system and interaction model
- [INFRASTRUCTURE.md](./docs/INFRASTRUCTURE.md) - Runtime architecture and deployment model
- [MEM9_OPENCLAW.md](./docs/MEM9_OPENCLAW.md) - mem9 status and OpenClaw setup notes
- [COMMIT.md](./docs/COMMIT.md) - Commit and branch workflow
- [REQUIREMENTS.md](./docs/REQUIREMENTS.md) - Hackathon requirement reference

## Implementation Notes
- Do not assume all agent or MCP packages run on Edge runtime.
- Keep the UI and worker concerns separate so the app can degrade gracefully.
- Prefer one stable, demoable end-to-end path over many partially working features.

## Submission Assets To Prepare
- Public GitHub repository
- README with installation steps and screenshots or GIFs
- Maximum 2 minute demo video
- Maximum 5 slide PDF pitch deck
- Final list of AI models and tools used

## License And Credits
This repository is a hackathon concept project and should be populated with the actual team implementation, demo assets, and release notes before submission.
