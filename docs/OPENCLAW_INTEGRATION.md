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
2. **Tavily Extract** when `browser-automation` is active — reads the first `http(s)` URL in the prompt (or `BROWSER_DEFAULT_URL`, or `https://example.com`) via the Tavily API (**no local headless browser**).  
3. **OpenClaw** CLI when orchestration is active  
4. **Tavily Search** on the tool route when the prompt looks like “research / search the web” (same `TAVILY_API_KEY`)  
5. Sandbox echo checkpoint  

## Environment variables (backend `.env`)

| Variable | Purpose |
|----------|---------|
| `TAVILY_API_KEY` | **Required** for Tavily Extract + Tavily Search in the worker. |
| `OPENCLAW_ORCHESTRATION` | Set to `0` to skip OpenClaw calls entirely. |
| `OPENCLAW_BIN` | Override binary name/path (default `openclaw`). |
| `OPENCLAW_ORCHESTRATOR_AGENT` | `--agent` id (default `main`). |
| `OPENCLAW_SESSION_PREFIX` | Optional prefix for `--session-id` (`recursive-agent-<missionId>` if unset). |
| `OPENCLAW_USE_LOCAL` | Set to `0` to omit `--local` (gateway mode). Default: local embedded run. |
| `OPENCLAW_MODEL` | Paksa model per panggilan CLI, mis. `deepseek/deepseek-v4-pro` (supaya run dari API tidak pakai default `zai/glm` di config global). |
| `DEEPSEEK_API_KEY` | Key DeepSeek; taruh di **`backend/.env`** — ikut ke proses `openclaw` lewat `process.env` (lihat bagian di bawah). Juga dipakai sebagai **Bearer** gateway OpenAI-compatible jika `OPENAI_COMPAT_API_KEY` kosong. |
| `OPENAI_COMPAT_BASE_URL` | Mis. `https://ai.sumopod.com/v1` — endpoint `chat/completions` di-append di server (`backend/src/compat/openai-compatible-chat.ts`). |
| `OPENAI_COMPAT_API_KEY` | Bearer opsional; jika kosong dipakai `DEEPSEEK_API_KEY`. |
| `OPENAI_COMPAT_MODEL` | Id model upstream (default `gpt-4o-mini`). |
| `OPENAI_COMPAT_TIMEOUT_MS` | Timeout HTTP (default `45000`). |
| `OPENCLAW_TIMEOUT_MS` | CLI timeout (default `120000`). |
| `BROWSER_AUTOMATION` | Set to `0` to skip the Tavily “web read” step (misnamed for backward compat). |
| `BROWSER_DEFAULT_URL` | Fallback URL when the prompt has no `http(s)` link. |

## One-time machine setup

1. Install OpenClaw globally (or ensure `openclaw` is on `PATH`).  
2. Add `TAVILY_API_KEY` to `backend/.env` (from [Tavily](https://app.tavily.com)). Workspace install:

```bash
cd backend
npm install
```

3. Smoke-test the CLI (adjust `--agent` to a real id from your OpenClaw config):

```bash
openclaw agent --local --agent main --session-id recursive-agent-smoke --message "ping" --json
```

### Pakai **DeepSeek V4 Pro** (ganti dari `zai/glm`)

OpenClaw memakai ref model bentuk **`provider/model-id`**. Untuk plugin resmi DeepSeek, env auth-nya **`DEEPSEEK_API_KEY`** (lihat [Model providers](https://github.com/openclaw/openclaw/blob/main/docs/concepts/model-providers.md)).

**A. Cepat — hanya satu perintah CLI (tanpa ubah `openclaw.json` dulu)**

Pastikan `DEEPSEEK_API_KEY` sudah di-set di environment Windows (User env) atau di shell sebelum jalan:

```powershell
$env:DEEPSEEK_API_KEY = "sk-..."   # contoh; lebih aman: set permanen di System Properties → Environment Variables
openclaw agent --local --agent main --model deepseek/deepseek-v4-pro --session-id recursive-agent-smoke --message "ping" --json
```

Kalau ref model tidak dikenali, cek id yang didukung instalasi kamu, mis. `deepseek/deepseek-v4-flash`, lalu ganti `--model`.

**B. Default global (semua run `main` pakai DeepSeek)**

1. Login / onboard DeepSeek ke OpenClaw (contoh: `openclaw onboard` dan pilih alur DeepSeek, atau ikuti [DeepSeek di OpenClaw](https://docs.openclaw.ai/) / `openclaw models auth` untuk provider `deepseek`).  
2. Edit config global biasanya di **`%USERPROFILE%\.openclaw\openclaw.json`** (atau `openclaw config edit` kalau tersedia) dan set default model, pola konsepnya:

```json5
{
  "agents": {
    "defaults": {
      "model": { "primary": "deepseek/deepseek-v4-pro" }
    }
  }
}
```

Pastikan provider **deepseek** sudah ter-auth; tanpa itu `primary` akan gagal.

**C. Dari app Recursive Agent (`backend/.env`)**

Tambahkan:

```env
DEEPSEEK_API_KEY=sk-...
OPENCLAW_MODEL=deepseek/deepseek-v4-pro
```

**Ini bisa**, karena:

1. `backend/src/server.ts` memuat `import "dotenv/config"` → variabel di **`backend/.env`** masuk ke `process.env`.
2. `openclaw-bridge` memanggil `openclaw` dengan `env: { ...process.env }` → child process **melihat `DEEPSEEK_API_KEY`** yang sama.
3. `OPENCLAW_MODEL` ditambahkan sebagai argumen **`--model`**, jadi run dari API memaksa **DeepSeek**, bukan default global yang masih mengarah ke **zai** (selama OpenClaw versi kamu menghormati `--model` untuk embedded run).

Kalau masih ke **zai**, biasanya salah satu: (a) `--model` tidak dipakai untuk jalur itu — naikkan versi OpenClaw atau cek log; (b) key DeepSeek tidak terbaca — pastikan kamu **start worker dari folder `backend`** atau `dotenv` memang memuat file yang berisi `DEEPSEEK_API_KEY`; (c) auth global memaksa provider lain — sesuaikan `~/.openclaw/openclaw.json` atau nonaktifkan profil zai sementara untuk tes.

If this fails, the API still returns `200`; the mission `events[]` will contain the hint from the bridge.

### SumoPod (curl OpenAI-compatible) ↔ env backend

Contoh docs SumoPod memanggil `POST https://ai.sumopod.com/v1/chat/completions` dengan header `Authorization: Bearer sk-...` dan body JSON `model` + `messages`. Di Recursive Agent, set:

```env
OPENAI_COMPAT_BASE_URL=https://ai.sumopod.com/v1
OPENAI_COMPAT_API_KEY=sk-...
# atau biarkan kosong dan isi saja DEEPSEEK_API_KEY dengan token SumoPod yang sama
OPENAI_COMPAT_MODEL=gpt-4o-mini
```

Jika ini ter-set, **mother** akan (best-effort) memanggil gateway itu sekali per misi dan menambahkan paragraf singkat ke **README** spesialis; kegagalan jaringan tidak memutus misi.

## Troubleshooting OpenClaw CLI

### `429` / “Insufficient balance” / “rate limit” with `provider=zai` and `glm-5.1`

OpenClaw is working; the **model provider** refused the request. Your log shows the embedded agent used **Zhipu / Z.AI** (`zai`) with **`glm-5.1`**, and the upstream error was effectively **no quota / recharge required** (`Insufficient balance or no resource package`).

**What to do (pick one):**

1. **Top up or enable billing** on the Z.AI / GLM account tied to that OpenClaw auth profile (same place you configured Codex-style sync if applicable).  
2. **Switch the agent’s default model** in OpenClaw so `main` does not depend on `zai/glm-5.1` — e.g. bind **OpenAI** or **Anthropic** (where you already have credits) for embedded runs. That is configured in your **global OpenClaw config** and/or agent workspace under `%USERPROFILE%\.openclaw\` (see [OpenClaw docs](https://docs.openclaw.ai/)).  
3. **Try gateway mode** instead of `--local` if your gateway uses different credentials: set `OPENCLAW_USE_LOCAL=0` in `backend/.env` and ensure the gateway is running and healthy.  
4. **Hackathon / demo fallback:** set `OPENCLAW_ORCHESTRATION=0` in `backend/.env` so Recursive Agent still runs Tavily + tools without calling the CLI until billing is fixed.

After you change provider or top up, rerun the same smoke command; you want `meta.stopReason` (or equivalent) **not** `error` and payloads without the warning emoji.

### Session / agent id mismatch

`--agent main` must match an agent id that exists in your OpenClaw install. If yours differs, set `OPENCLAW_ORCHESTRATOR_AGENT` in `backend/.env` to that id.

## Security

- Do not commit API keys or `~/.openclaw` into this repository.  
- Tavily calls go to Tavily’s API over HTTPS; treat URLs in user prompts as untrusted input.
