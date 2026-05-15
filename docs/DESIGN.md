# Design System And Principles

These guidelines define the visual and interaction model for **Recursive Agent**.

The UI should feel like an engineering mission control surface: dense with information, but still calm, structured, and easy to scan.

## Design Philosophy
The product is not a generic chat app. It is a control room for AI work. The user should always understand:
- what the system is doing
- which agent is responsible
- which tools were used
- whether the workflow is safe to continue
- whether the job is winning or failing

## Core Principles
1. Transparency first. Show mission state, tool calls, and logs by default.
2. Strong hierarchy. Keep the primary mission and its current status visually dominant.
3. Operational clarity. Every panel should answer a practical question.
4. Bounded autonomy. Display limits, budgets, and retries clearly so the system feels trustworthy.
5. Desktop-first, mobile-aware. Desktop supports full control; mobile shows status and summary views.

## Information Architecture
The screen should be organized around four simultaneous layers of attention. The **implemented** dashboard maps them onto a workflow-builder style surface (trigger → agent → branch → actions) inspired by visual automation tools.

### 1. Mission Canvas
This is the central graph or orbit view. It shows missions, sub-agents, tool nodes, and their relationships. The canvas should communicate:
- current mission
- active agents
- completed steps
- blocked steps
- tool dependencies

In code today (`frontend/src/components/mission-canvas.tsx`), the canvas is a live `@xyflow/react` board with a trigger node, a mother-agent hub (model / memory / tools affordances), a policy branch, and two downstream action nodes (tool-heavy vs sandbox). Edge labels document the intent of each branch.

### 2. Mission Stream
This is the conversational and command layer. It shows user prompts, agent responses, structured outputs, and tool summaries.

In code today this lives in the **right-hand control chat** (`frontend/src/components/control-chat-panel.tsx`): user turns are appended when a mission runs, assistant turns summarize `missionId`, `status`, and any `events[]` returned by the worker.

### 3. Vitals Panel
This is the operational health layer. It should contain:
- token usage
- budget or credit status
- queue or worker status
- error counts
- last successful action

The current vitals card is a thin operational summary (`frontend/src/components/vitals-panel.tsx`) and should grow into the full list above.

### 4. Terminal And Logs
This is the audit layer. It should display raw logs, command output, agent traces, and debug messages for power users.

The current terminal card (`frontend/src/components/terminal-drawer.tsx`) mirrors the latest assistant handoff so judges can read structured output without opening devtools.

## Layout Blueprint
### Desktop (implemented)
- **Left rail (`workspace-rail.tsx`)** — Recipes/prompt starters plus an “API & integrations” strip. This answers “what can I connect or reuse?” without hiding HTTP/MCP context in a modal.
- **Center stage** — Mission canvas graph with zoom/pan (`@xyflow/react`), plus a two-column row directly underneath for **Vitals** and **Terminal/Audit**.
- **Right column** — **Control chat** for steering the mother agent, launching missions, and reading structured responses; the generated specialist profile sits directly under the composer so configuration stays adjacent to conversation.

### Desktop (future-friendly)
- Allow collapsing the rails on smaller laptop widths while keeping the canvas readable.
- Move long log tails into a resizable drawer or split pane once streaming logs land.

### Mobile layout (target)
- one primary summary screen
- collapsed vitals cards
- mission list or timeline
- expandable logs drawer

Mobile is still **design target**; the hackathon build optimizes for desktop control rooms first.

## Visual Identity
The aesthetic should be crisp and technical, not decorative for its own sake.

### Color Tokens
- Deep Navy: `#0A192F`
- Electric Blue: `#64FFDA`
- Slate Grey: `#8892B0`
- Surface: dark neutral with subtle elevation
- Success: green with restrained saturation
- Warning: amber or orange for state changes
- Error: red only for actual failures

### Typography
Use a highly legible sans-serif family with good numeric clarity for dashboards and logs. Headings should be compact and strong. Body text should remain readable even when the screen is dense.

### Motion
Motion should inform state changes, not distract.
- Use gentle fades and slide-ins for new missions.
- Use pulse or glow only for active nodes.
- Animate data flow lines sparingly.
- Avoid constant motion in low-priority panels.

## Component Behavior
### Mission Canvas
- Nodes should encode type, status, and responsibility.
- Edges should encode direction and dependency.
- Hover states should reveal tooltips with mission metadata.
- Clicking a node should sync the right panel to that agent or task.

### Mission Stream
- The stream should support structured message types, not just plain chat bubbles.
- Messages should distinguish between user input, agent reasoning summary, tool call, and tool result.
- The latest authoritative state should always be visible without scrolling through raw logs.

Today the stream is implemented as the **control chat** (`control-chat-panel.tsx`): append-only user/assistant turns, with assistant payloads summarizing mission metadata and worker `events[]`.

### Vitals Panel
- Show numeric state at a glance.
- Use sparklines or compact bars only if they help the user decide quickly.
- Include hard limits and warning thresholds.

### Terminal
- Keep it collapsible.
- Make it easy to copy or export logs.
- Preserve timestamps and severity labels.

The current terminal card surfaces the latest assistant handoff for quick auditing; graduate it to streaming logs once SSE lands.

## Interaction Model
The user flow should support three main actions:
1. Start a mission.
2. Observe agent work.
3. Intervene when the workflow stalls or exceeds limits.

That means the UI needs controls for pause, retry, cancel, and inspect.

## States To Design For
The interface should intentionally handle these conditions:
- idle
- streaming
- tool executing
- waiting on external service
- retrying
- completed successfully
- failed safely
- paused by user
- budget warning

## Accessibility Notes
- Keep contrast high enough for dense dashboards.
- Never communicate important state with color alone.
- Ensure keyboard navigation works for panels, tabs, and logs.
- Make interactive nodes reachable and understandable without hover.

## Responsive Behavior
The product is primarily for desktop use, but mobile should still work in monitor mode.
- Desktop exposes the full command center.
- Tablet compresses panels into stacked cards.
- Mobile prioritizes mission status, alerts, and recent outputs.

## Do And Do Not
Do:
- make the system feel alive but bounded
- reveal uncertainty clearly
- keep operational state easy to inspect

Do not:
- hide the agent behavior behind decorative visuals
- overload the screen with constant noise
- use generic AI app styling that feels interchangeable
