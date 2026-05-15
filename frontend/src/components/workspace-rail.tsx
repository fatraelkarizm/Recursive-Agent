const INTEGRATIONS = [
  { name: "Central Agent API", detail: "POST /api/missions (+ konteks, review, URLs)", tone: "text-electric" },
  { name: "Central Services", detail: "POST /api/preview-extract (baca docs / URL)", tone: "text-electric" },
  { name: "Runtime config", detail: "GET /api/runtime-config (model/env, no secrets)", tone: "text-electric" },
  { name: "OpenClaw CLI", detail: "openclaw agent --json (see docs/OPENCLAW_INTEGRATION.md)", tone: "text-electric" },
  { name: "Tavily", detail: "Extract + Search (TAVILY_API_KEY)", tone: "text-electric" },
  { name: "MCP (hosted)", detail: "Wire in SETUP.md", tone: "text-slate" },
  { name: "Lovable (optional)", detail: "LOVABLE_API_KEY — README mentions API docs", tone: "text-slate" },
  { name: "Env keys", detail: ".env in frontend/backend", tone: "text-slate" }
];

export function WorkspaceRail() {
  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-black/35 to-black/15">
      <div className="border-b border-white/10 px-4 py-4 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate">Workspace</p>
        <h1 className="mt-1 text-base font-semibold tracking-tight text-white">Recursive Agent</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-slate">
          Central Agent mengubah satu mission menjadi squad specialist yang bisa diinspeksi, direview, dan dijalankan ulang.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate">API & integrations</p>
        <ul className="space-y-2 px-2">
          {INTEGRATIONS.map((item) => (
            <li
              key={item.name}
              className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-[11px] text-slate"
            >
              <span className={`font-medium ${item.tone}`}>{item.name}</span>
              <span className="mt-0.5 block text-[10px] text-slate/90">{item.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
