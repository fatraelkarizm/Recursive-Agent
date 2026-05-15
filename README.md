# Recursive Agent

**AI agents shouldn't be one-size-fits-all. They should be purpose-built, knowledge-rich, and continuously improving.**

---

## The Problem

Today's AI agents are **static and generic**. You get a chatbot that can do a little bit of everything but masters nothing. Want a code reviewer? Same generic model. Want a market researcher? Same generic model. Want a content strategist? Same generic model.

The real world doesn't work like that. **Specialists outperform generalists.** A senior code reviewer thinks differently than a market analyst. They have different frameworks, different vocabularies, different quality standards.

But building specialized agents requires:
- Developer skills most people don't have
- Manual prompt engineering that takes hours
- Static skills that go stale the moment you write them
- No quality assurance — you get whatever the model gives you

**What if you could describe what you need in plain language, and get back a team of specialists with real-world expertise — extracted live from the internet?**

## The Solution

Recursive Agent is a **self-improving multi-agent orchestrator** that produces specialist agents on demand.

Tell it what you need. It researches the internet in real-time, extracts skills from GitHub repos, documentation, and best practices, then assembles a squad of specialist agents — each with deeply injected domain knowledge.

Then it reviews their output against industry standards. If quality isn't good enough, it sends them back to rework. Automatically. Until the output is actually useful.

```
You: "Build me a team to audit our API security"

Recursive Agent:
  → Researches OWASP, API security best practices, pentesting frameworks
  → Extracts 14 skills from GitHub SKILL.md files and docs
  → Produces 3 specialists: Security Auditor, API Analyst, Remediation Planner
  → Runs scout → worker → reviewer fleet
  → Reviews output quality (iteration 1: REWORK, iteration 2: PASS)
  → Delivers industry-standard security audit report
  → Saves learnings to memory for next time
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     RECURSIVE AGENT                         │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  Memory   │    │   Web    │    │  Skill   │              │
│  │  Recall   │───▶│ Research │───▶│ Extract  │              │
│  │  (Mem0)   │    │ (Tavily) │    │ (GitHub) │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│       │                               │                     │
│       ▼                               ▼                     │
│  ┌──────────────────────────────────────────┐              │
│  │         CENTRAL AGENT (Orchestrator)      │              │
│  │  Synthesize squad • Inject skills • Review│              │
│  └──────────────────────────────────────────┘              │
│       │                                                     │
│       ▼                                                     │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │
│  │Agent A │  │Agent B │  │Agent C │  │Agent N │           │
│  │Frontend│  │Backend │  │  Data  │  │  ...   │           │
│  │12 skills│ │9 skills│  │7 skills│  │        │           │
│  └────┬───┘  └────┬───┘  └────┬───┘  └────────┘           │
│       │           │           │                             │
│       ▼           ▼           ▼                             │
│  ┌─────────────────────────────────┐                       │
│  │   Fleet: Scout → Worker → Reviewer                      │
│  │   Auto-review loop (max 3 iterations)                   │
│  │   Until industry-standard quality ✓                     │
│  └─────────────────────────────────┘                       │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────┐    ┌──────────────┐                          │
│  │  Quality  │    │   Memory     │                          │
│  │  Review   │    │   Save       │                          │
│  │ pass/fail │    │  (learns)    │                          │
│  └──────────┘    └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### The Pipeline

| Step | What Happens |
|------|-------------|
| **1. Memory Recall** | Searches past missions via Mem0 — learns from every interaction |
| **2. Web Research** | Tavily Search finds current trends, docs, and best practices |
| **3. Skill Extraction** | Discovers SKILL.md files, GitHub repos, npm packages, awesome-lists |
| **4. Squad Synthesis** | LLM designs a team of specialists based on mission needs |
| **5. Skill Injection** | Each agent gets detailed, actionable skill instructions — not generic prompts |
| **6. Fleet Execution** | Scout → Worker → Reviewer pattern via OpenClaw CLI |
| **7. Auto-Review Loop** | LLM reviewer evaluates against industry standards, sends back for rework if needed |
| **8. Memory Save** | Stores results so next mission benefits from past learnings |

## What Makes This Different

| Traditional Agents | Recursive Agent |
|---|---|
| Static skills hardcoded by developer | Skills extracted live from the internet |
| One generic model for everything | Purpose-built specialists per mission |
| Single-pass output, take it or leave it | Auto-review loop until quality passes |
| No memory between sessions | Persistent memory — gets smarter over time |
| Developer-only configuration | Plain language mission input |
| Black box execution | Visual mission control dashboard |

## Features

### Real-time Skill Extraction
Agents don't rely on pre-programmed knowledge. Before every mission, the system searches GitHub, documentation sites, npm packages, and best practice guides — then injects that knowledge directly into each agent's prompt.

### Auto-Review Quality Loop
Output is reviewed against industry standards by a dedicated reviewer agent. If quality is insufficient, failing agents are automatically sent back with specific feedback. The loop continues until all agents pass or max iterations are reached.

### Visual Mission Control
A three-column dashboard built with React Flow shows the entire agent ecosystem: who's working, what skills they have, how they're connected, and what they produced.

### Multi-Channel Input
Missions can come from the web dashboard, a Telegram bot, or the REST API. Same quality regardless of channel.

### Downloadable Reports
Every mission produces a structured report that can be downloaded as a standalone HTML file or copied as Markdown.

### Persistent Memory
Every mission teaches the system something new. Past learnings are recalled before future missions, making the agent recommendations better over time.

### 8000+ App Integrations
Via Zapier MCP, agents can connect to Google Sheets, Gmail, Calendar, Telegram, Slack, and thousands more.

## Quick Start

```bash
# Clone
git clone https://github.com/fatraelkarizm/Recursive-Agent.git
cd Recursive-Agent

# Backend
cd backend
npm install
cp .env.example .env   # Fill in your API keys
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` — type a mission and watch the agents come to life.

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_COMPAT_BASE_URL` | Yes | OpenAI-compatible API endpoint (e.g. SumoPod, LiteLLM) |
| `OPENAI_COMPAT_API_KEY` | Yes | Bearer token for the LLM gateway |
| `OPENAI_COMPAT_MODEL` | Yes | Model ID (e.g. `qwen3.6-plus`, `gemini/gemini-2.5-flash`) |
| `TAVILY_API_KEY` | Recommended | Enables real-time web research and skill extraction |
| `DATABASE_URL` | Recommended | PostgreSQL for mission and agent persistence |
| `MEM0_API_KEY` | Optional | Persistent agent memory across sessions |
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram bot for mobile mission input |

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS, React Flow, Lucide
- **Backend:** Express, TypeScript, Prisma (PostgreSQL)
- **AI:** OpenAI-compatible gateway, OpenClaw CLI
- **Research:** Tavily Search + Extract
- **Memory:** Mem0 Platform
- **Integrations:** Zapier MCP, grammY (Telegram)

## Architecture

```
frontend/           → Next.js dashboard, React Flow canvas, mission UI
backend/
  src/agent/        → Central Agent, fleet orchestrator, skill discovery, quality review
  src/capabilities/ → Browser automation, tool routing
  src/compat/       → OpenAI-compatible LLM gateway
  src/memory/       → Mem0 persistent memory client
  src/telegram/     → Telegram bot (grammY)
  src/db/           → Prisma persistence layer
  prisma/           → Database schema and migrations
```

## Team

Built for **OpenClaw Agenthon 2026**.

## License

MIT
