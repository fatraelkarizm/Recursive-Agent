# Library & MCP Registry

This registry tracks the recommended dependencies, services, and AI providers for the Recursive Agent implementation.

## Core App Dependencies
These packages form the base application shell.

| Package | Purpose | Required |
|---|---|---|
| next | App framework and server rendering | Yes |
| react | UI runtime | Yes |
| react-dom | DOM runtime | Yes |
| typescript | Type safety | Yes |
| tailwindcss | Styling system | Yes |
| postcss | Tailwind build pipeline | Yes |
| autoprefixer | CSS compatibility | Yes |
| eslint | Linting | Yes |
| @types/node | Node typings | Yes |
| @types/react | React typings | Yes |
| @types/react-dom | React DOM typings | Yes |

## UI And Interaction Libraries
| Package | Purpose | Notes |
|---|---|---|
| framer-motion | Motion and transitions | Good for panel reveals and status transitions |
| lucide-react | Icons | Lightweight and readable |
| clsx | Conditional class names | Useful for state-driven styles |
| tailwind-merge | Tailwind class deduplication | Recommended with clsx |
| zod | Runtime schema validation | Useful for mission payloads and tool outputs |
| @xyflow/react | Node graph and mission canvas | Recommended for the orbit/graph UI |
| sonner | Toast and status feedback | Simple and polished |
| nanoid | Short IDs | Good for missions and logs |

## Agent And AI Libraries
| Package | Purpose | Notes |
|---|---|---|
| ai | Vercel AI SDK runtime | Good for streaming and UI hooks |
| @ai-sdk/openai | OpenAI provider | Use for chat, reasoning, or embeddings if desired |
| @ai-sdk/anthropic | Anthropic provider | Use for planner or reviewer roles |
| @modelcontextprotocol/sdk | MCP client/runtime | Needed for external tool integrations |
| @langchain/core | Shared LangChain primitives | Useful for tool and message abstractions |
| @langchain/langgraph | Stateful multi-step workflows | Good for mission graphs and retries |
| openai | Direct API client | Optional if you prefer direct calls |

## Sandbox And Execution
| Package | Purpose | Notes |
|---|---|---|
| @e2b/code-interpreter | Secure code execution | Recommended for isolated code runs |
| execa | Process execution helper | Optional for local worker orchestration |

## Persistence And State
| Package | Purpose | Notes |
|---|---|---|
| prisma | Schema-driven database access | Good if you want a clean DB layer |
| @prisma/client | Prisma client | Pair with prisma |
| ioredis | Redis client | Useful for queues, rate limits, and locks |
| postgres | Postgres client | Minimal direct SQL option |
| @neondatabase/serverless | Serverless Postgres | Good for hosted Postgres in Next.js contexts |
| @supabase/supabase-js | Supabase backend client | Useful if you choose Supabase |

## Observability And Reliability
| Package | Purpose | Notes |
|---|---|---|
| pino | Structured logging | Recommended for agent and worker logs |
| pino-pretty | Local log formatting | Dev-only helper |
| sentry | Error tracking | Useful once the app is demo-ready |

## MCP Integrations
Use remote services when available, especially for production deployments. Some of these may be hosted servers rather than npm packages.

| Integration | Role | Notes |
|---|---|---|
| OpenClaw Mother Agent | Orchestration layer | Conceptual core of the system |
| Zapier MCP | External app automation | Best hosted over HTTP/SSE if possible |
| Mem9 | Persistent memory | Use for long-lived context when available |
| Tavily MCP | Search and research | Useful for web research flows |
| Crawl4AI | Content extraction | Useful for document scraping workflows |
| Google Drive MCP | Artifact storage | Useful for file and document handoff |

## Recommended Model Choices
The repository does not lock the project to one provider. Pick the model based on the role.

| Role | Recommended Model Type | Notes |
|---|---|---|
| Planner / Mother Agent | Strong reasoning model | Use the best model you can afford for mission decomposition |
| Reviewer / Critic | Reliable reasoning model | Should be stable and deterministic |
| Worker / Executor | Lower-latency model | Enough for code edits and tool calls |
| Research | Search-friendly model | Useful for summarization and extraction |
| Embeddings | Text embedding model | Only needed if you store semantic memory |

If you want a concrete default, start with one planning model and one execution model, then measure cost and quality before adding more complexity.

## Installation Order
Recommended install order for a new build:
1. Core app dependencies.
2. UI and interaction packages.
3. Agent and AI SDKs.
4. Sandbox and execution packages.
5. Persistence and observability packages.
6. MCP clients or service URLs.

## Compatibility Rules
Before adding a package, verify:
1. Whether it works in the intended runtime.
2. Whether it is safe for serverless or Edge use.
3. Whether it has a browser-safe path if used in UI code.
4. Whether it needs a separate worker process.

## Environment Variables To Track
This registry is also the place to remember the required secrets and runtime endpoints.

| Variable | Purpose |
|---|---|
| OPENAI_API_KEY | OpenAI access |
| ANTHROPIC_API_KEY | Anthropic access |
| E2B_API_KEY | Sandbox access |
| ZAPIER_MCP_URL | Zapier integration endpoint |
| TAVILY_API_KEY | Research access |
| DATABASE_URL | Primary database |
| REDIS_URL | Queue or cache |
| SENTRY_DSN | Error tracking |

## Change Policy
When a new dependency is added, update this file together with the implementation notes so the team can see why the package exists, what runtime it needs, and whether it is required for the MVP.