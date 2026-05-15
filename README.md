# Recursive Agent

**A Central Agent that turns one mission into a reusable team of specialist agents for solopreneurs and non-technical builders.**

Recursive Agent is built for people who want to run a one-person company with AI support, but do not want to manually design prompts, tools, workflows, or agent architectures.

Instead of only generating a final artifact, Recursive Agent produces the agents behind the work: their roles, skills, knowledge, tools, sub-agents, and review loops.

---

## Inspiration

Most agentic tools today are still developer-centric.

They are powerful, but they often assume the user understands prompts, APIs, workflows, repositories, tool routing, and orchestration. OpenClaw inspired us because it shows how powerful agent orchestration can be. But we wanted to ask a different question:

**What would agentic orchestration look like for non-technical people?**

Recursive Agent is our answer.

We wanted to make agent creation accessible to solopreneurs, indie builders, creators, and small teams who want to build a one-person company with the help of specialist AI agents.

Instead of asking a non-technical user to configure workflows or manually design agents, Recursive Agent starts from a simple mission. The Central Agent researches the web, extracts fresh skills, creates specialist agents, runs a scout-worker-reviewer fleet, reviews the result, and packages the output as reusable agent knowledge.

The goal is not just to automate one task. The goal is to help one person create a small expert team around their idea.

## The Problem

AI agents are getting more capable, but they are still hard to operationalize.

For developers, this usually means wiring APIs, prompts, tools, memory, and orchestration code. For non-technical builders, it often means getting stuck with one generic chatbot that can do a little bit of everything but does not behave like a real specialist.

That creates four problems:

- **Generic output:** one agent tries to do every job.
- **High setup cost:** useful agent systems still require technical configuration.
- **Stale knowledge:** hardcoded prompts age quickly.
- **Weak quality control:** many agents answer once and stop, even when the output needs rework.

Solopreneurs need something different: not a chatbot, but a small specialist team that can be created from a business mission.

## The Solution

Recursive Agent is a self-improving multi-agent orchestrator that produces specialist agents on demand.

You describe a mission in plain language. The Central Agent then:

1. recalls relevant memory from past missions,
2. researches the web with Tavily,
3. extracts fresh skills from docs, GitHub, and best practices,
4. designs a specialist squad,
5. injects reusable `SKILL.md`-style instructions,
6. runs a scout-worker-reviewer fleet,
7. reviews the output against quality standards,
8. reworks weak outputs within a bounded loop,
9. saves the result as an inspectable agent package.

In simple terms:

```text
Mission -> Central Agent -> Specialist Agents -> Autonomous Review Loop -> Reusable Agent Package
```

## Example

```text
You:
"Build me a team to launch and validate a niche SaaS idea."

Recursive Agent:
- researches market validation, landing page patterns, pricing, and onboarding
- extracts relevant skills from current web sources and docs
- creates specialist agents such as:
  - Market Research Scout
  - Landing Page Builder
  - Pricing Strategist
  - Launch Reviewer
- runs the fleet in a scout -> worker -> reviewer pattern
- reviews weak outputs and sends them back for rework
- produces an agent package the founder can inspect, reuse, and improve
```

## How It Works

```text
+-------------------+
| User Mission      |
+---------+---------+
          |
          v
+-------------------+     +-------------------+
| Memory Recall     |     | Tavily Research   |
| Mem0              |     | Web + docs        |
+---------+---------+     +---------+---------+
          |                         |
          +-----------+-------------+
                      |
                      v
              +---------------+
              | Central Agent |
              | plan + create |
              +-------+-------+
                      |
                      v
          +-------------------------+
          | Specialist Agent Squad  |
          | roles + skills + tools  |
          +-----------+-------------+
                      |
                      v
        +-----------------------------+
        | Scout -> Worker -> Reviewer |
        | bounded autonomous loop     |
        +-------------+---------------+
                      |
                      v
          +-------------------------+
          | Reusable Agent Package  |
          | SKILL.md + README + log |
          +-------------------------+
```

## Core Pipeline

| Step | What Happens |
| --- | --- |
| Memory Recall | Searches past missions through Mem0 so the system can reuse prior learnings. |
| Web Research | Uses Tavily to gather current references, documentation, and best practices. |
| Skill Extraction | Converts useful source material into practical agent skills. |
| Squad Synthesis | The Central Agent designs specialist agents for the mission. |
| Skill Injection | Each agent receives reusable, role-specific instructions. |
| Fleet Execution | Sub-agents run in a scout, worker, and reviewer pattern. |
| Auto-Review Loop | Weak outputs are sent back for rework within a bounded iteration limit. |
| Memory Save | Results are persisted for future missions. |

## What Makes This Different

| Traditional Agent Tools | Recursive Agent |
| --- | --- |
| Built mainly for developers | Designed for non-technical builders and solopreneurs |
| One generic agent | Mission-specific specialist agents |
| Manual prompt and workflow setup | Plain-language mission input |
| Static instructions | Fresh web knowledge and extracted skills |
| Single-pass generation | Bounded autonomous review and rework loop |
| Final artifact only | Reusable agent package plus final report |
| Black-box execution | Visual mission canvas and inspectable agent profiles |

## Features

### Central Agent Orchestration

The Central Agent is responsible for planning, research, squad creation, skill injection, review, and final packaging.

### Specialist Agent Generation

Each mission produces purpose-built agents with roles, tools, skills, system instructions, README content, and `SKILL.md`-style capability documents.

### Real-Time Skill Discovery

Before generating the agents, the system searches web sources and extracts knowledge from docs, GitHub, package references, and best-practice material.

### Bounded Autonomous Loop

The fleet can review its own outputs and rework failing sub-agent results. The loop is intentionally bounded so the system remains demo-safe and does not run forever.

### OpenClaw Orchestration Path

Recursive Agent can delegate orchestration turns through the OpenClaw CLI when available, with fallback support through OpenAI-compatible gateways.

### Visual Mission Control

The UI shows the Central Agent, specialist agents, sub-agent fleet, mission progress, skill cards, and generated reports.

### Persistent Memory

Mem0 support lets the Central Agent recall relevant previous missions before creating new agents.

## Tech Stack

- **Frontend:** Next.js, React, Tailwind CSS, React Flow, Lucide React
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL, Prisma
- **Agent orchestration:** OpenClaw CLI, custom Central Agent pipeline
- **LLM gateway:** OpenAI-compatible APIs
- **Research:** Tavily Search and Tavily Extract
- **Memory:** Mem0
- **Integrations:** Telegram bot support

## Quick Start

```bash
git clone https://github.com/fatraelkarizm/Recursive-Agent.git
cd Recursive-Agent
npm install
```

Create backend environment variables:

```bash
cd backend
cp .env.example .env
```

Fill in the keys you want to use, then run:

```bash
npm --workspace backend run dev
npm --workspace frontend run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_COMPAT_BASE_URL` | OpenAI-compatible gateway endpoint. |
| `OPENAI_COMPAT_API_KEY` | API key for the LLM gateway. |
| `OPENAI_COMPAT_MODEL` | Primary model for generation. |
| `OPENAI_COMPAT_FALLBACK_MODEL` | Fallback model when the primary route fails. |
| `TAVILY_API_KEY` | Enables real-time web research and source extraction. |
| `DATABASE_URL` | PostgreSQL persistence for missions and agents. |
| `MEM0_API_KEY` | Optional persistent memory support. |
| `OPENCLAW_ORCHESTRATION` | Set to `1` to prefer OpenClaw orchestration, `0` to disable. |
| `OPENCLAW_TIMEOUT_MS` | Timeout per OpenClaw call. Defaults to a demo-friendly value. |
| `FLEET_REVIEW_MAX_ITERATIONS` | Max autonomous review iterations. Defaults to `2`, capped at `3`. |
| `TELEGRAM_BOT_TOKEN` | Optional Telegram mission input. |

## Project Structure

```text
frontend/
  src/app/                 Next.js app shell
  src/components/          Mission canvas, dashboards, panels
  src/lib/                 API clients and UI helpers

backend/
  src/agent/               Central Agent, fleet loop, skill discovery
  src/compat/              OpenAI-compatible gateway
  src/memory/              Mem0 client
  src/db/                  Mission and agent persistence
  src/telegram/            Telegram bot integration
  prisma/                  Database schema

docs/                      OpenClaw, setup, and architecture notes
```

## Why It Matters

The future of agentic AI should not only belong to developers.

Recursive Agent explores what happens when orchestration becomes accessible to people building alone: founders, creators, consultants, and operators who need leverage but do not want to become AI infrastructure engineers.

It is a step toward a world where a solopreneur can describe a company-building mission and receive not just an answer, but a reusable specialist team.

## Built For

OpenClaw Agenthon 2026.
