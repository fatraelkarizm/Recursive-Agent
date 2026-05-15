# mem9 OpenClaw Setup Notes

This project was checked against the official mem9 OpenClaw setup instructions on 2026-05-15.

## Current Status

- The repository does not currently contain `openclaw.json`.
- No project files currently reference `mem9`, `mnemo`, `MEM9_API_KEY`, or OpenClaw plugin memory slots.
- OpenClaw is installed on this machine:

```text
OpenClaw 2026.4.15 (041266a)
```

- The local global OpenClaw config exists at `~/.openclaw/openclaw.json`, but it is not configured for mem9:
  - `plugins.slots.memory` is not set to `mem9`.
  - `plugins.entries.mem9` is missing.
  - `plugins.allow` does not include `mem9`.

Short version: we have OpenClaw available on the machine, but this project is not using mem9 yet.

## Official mem9 Requirements

The official mem9 `SKILL.md` says OpenClaw setup must use the OpenClaw plugin installer:

```powershell
openclaw plugins install @mem9/mem9
```

Do not replace that with `npm install -g @mem9/mem9` or a normal project `npm install`; OpenClaw will not discover mem9 correctly that way.

The hosted mem9 API URL is:

```text
https://api.mem9.ai
```

The only valid API key config path is:

```text
plugins.entries.mem9.config.apiKey
```

Do not put the key at:

```text
plugins.entries.mem9.apiKey
```

That path is invalid and can stop OpenClaw from loading the plugin.

## Version Note

This machine currently has `OpenClaw 2026.4.15`.

The mem9 instructions say `plugins.entries.mem9.hooks.allowConversationAccess = true` is for OpenClaw `4.23+` or date-style `2026.4.22+`.

Because `2026.4.15` is older than `2026.4.22`, do not add the `hooks.allowConversationAccess` block unless OpenClaw is upgraded. mem9 can still be configured, but full automatic conversation upload requires the newer OpenClaw hook permission.

## Reconnect Existing mem9 Key

Use this path if you already have a `MEM9_API_KEY`.

1. Install the plugin:

```powershell
openclaw plugins install @mem9/mem9
```

2. Edit `~/.openclaw/openclaw.json`.

For the current local OpenClaw version, use this shape:

```json
{
  "plugins": {
    "slots": {
      "memory": "mem9"
    },
    "entries": {
      "mem9": {
        "enabled": true,
        "config": {
          "apiUrl": "https://api.mem9.ai",
          "apiKey": "MEM9_API_KEY_GOES_HERE"
        }
      }
    },
    "allow": ["mem9"]
  }
}
```

If OpenClaw is upgraded to `2026.4.22+` or `4.23+`, use:

```json
{
  "plugins": {
    "slots": {
      "memory": "mem9"
    },
    "entries": {
      "mem9": {
        "enabled": true,
        "hooks": {
          "allowConversationAccess": true
        },
        "config": {
          "apiUrl": "https://api.mem9.ai",
          "apiKey": "MEM9_API_KEY_GOES_HERE"
        }
      }
    },
    "allow": ["mem9"]
  }
}
```

3. Restart OpenClaw:

```powershell
openclaw gateway restart
```

4. Verify mem9 loads. A healthy startup should include a mem9 server-mode signal like:

```text
[mem9] Server mode (v1alpha2)
```

## Create New mem9 Key

Use this path if you do not have a `MEM9_API_KEY` yet.

The official flow generates a one-time `provisionToken`, writes it to OpenClaw config, restarts the gateway, then lets the mem9 plugin provision a key from an OpenClaw agent turn.

Important constraints:

- Do not manually call the raw mem9 provisioning API as a replacement for the OpenClaw plugin flow.
- Do not upload local history, memory files, or session files during setup.
- Do not commit or log the generated API key.
- Before the first restart, `plugins.entries.mem9.config.apiKey` should be absent in create-new mode.
- `plugins.entries.mem9.config.provisionToken` is only for create-new setup.

For this project, reconnecting with a known key is simpler and safer than create-new automation, because the repo itself does not contain OpenClaw runtime config.

## Project Integration Decision

For the current hackathon app, mem9 is not wired into the Next.js or Express code. The app has its own backend agent modules under `backend/src/agent`, while mem9 is an OpenClaw memory plugin configured through OpenClaw, not through this app's `package.json`.

Recommended next step:

1. Decide whether the demo will actually run through OpenClaw.
2. If yes, install mem9 via `openclaw plugins install @mem9/mem9`.
3. Configure `~/.openclaw/openclaw.json` using reconnect mode with a real key.
4. Keep `MEM9_API_KEY` out of this repository.

## References

- Official mem9 skill entry point: https://mem9.ai/SKILL.md
- mem9 setup guide: https://raw.githubusercontent.com/mem9-ai/mem9/main/site/public/SETUP.md
- OpenClaw plugin README: https://raw.githubusercontent.com/mem9-ai/mem9/main/openclaw-plugin/README.md
