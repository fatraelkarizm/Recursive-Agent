# OpenClaw + mother-agent orchestration

The Recursive Agent **mother** can mark a mission as **OpenClaw-orchestrated** and call the local **OpenClaw CLI** once per mission to coordinate the generated **sub-agents** (fleet descriptors live on the specialist profile).

This is intentionally thin glue: the hackathon app stays in `backend/`, while OpenClaw stays your installed toolchain (`openclaw` on `PATH`, plugins in `~/.openclaw/openclaw.json`). See also [MEM9_OPENCLAW.md](./MEM9_OPENCLAW.md) for mem9 memory plugin notes.

## When orchestration runs

If the user prompt matches browser / OpenClaw heuristics (see `backend/src/agent/specializations.ts`), the profile gets:

- `specializations` such as `browser-automation` and/or `openclaw-orchestration`
- `orchestrationMode: "openclaw"` when orchestration keywords are present
- `subAgents[]` — three stub roles (scout / worker / reviewer) passed into the OpenClaw message body

The worker then runs (in order):

1. Mission graph plan  
2. **Playwright** browser touch when `browser-automation` is active (first URL in the prompt, or `BROWSER_DEFAULT_URL`, or `https://example.com`)  
3. **OpenClaw** CLI when orchestration is active  
4. Existing tool route + sandbox echo  

## Environment variables (backend `.env`)

| Variable | Purpose |
|----------|---------|
| `OPENCLAW_ORCHESTRATION` | Set to `0` to skip OpenClaw calls entirely. |
| `OPENCLAW_BIN` | Override binary name/path (default `openclaw`). |
| `OPENCLAW_ORCHESTRATOR_AGENT` | `--agent` id (default `main`). |
| `OPENCLAW_SESSION_PREFIX` | Optional prefix for `--session-id` (`recursive-agent-<missionId>` if unset). |
| `OPENCLAW_USE_LOCAL` | Set to `0` to omit `--local` (gateway mode). Default: local embedded run. |
| `OPENCLAW_TIMEOUT_MS` | CLI timeout (default `120000`). |
| `BROWSER_AUTOMATION` | Set to `0` to skip Playwright. |
| `BROWSER_DEFAULT_URL` | Fallback URL when the prompt has no `http(s)` link. |

## One-time machine setup

1. Install OpenClaw globally (or ensure `openclaw` is on `PATH`).  
2. Install Playwright browsers for the backend runtime:

```bash
cd backend
npm install
npx playwright install chromium
```

3. Smoke-test the CLI (adjust `--agent` to a real id from your OpenClaw config):

```bash
openclaw agent --local --agent main --session-id recursive-agent-smoke --message "ping" --json
```

If this fails, the API still returns `200`; the mission `events[]` will contain the stderr-style hint from the bridge.

## Security

- Do not commit API keys or `~/.openclaw` into this repository.  
- Browser automation runs **headless** on the worker machine — only enable in trusted environments.
