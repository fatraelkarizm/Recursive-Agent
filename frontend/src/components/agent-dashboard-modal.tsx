"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { fetchRuntimeDiagnostics } from "@/lib/api";
import { extractFirstHtmlFence } from "@/lib/extract-html-fence";
import type {
  FleetOrchestrationSummary,
  PublicRuntimeDiagnostics,
  SpecialistAgentProfile,
  SubAgentRunResult
} from "@/lib/types";

export type AgentDashboardTarget =
  | { kind: "specialist"; index: number }
  | { kind: "sub"; subId: string };

type TabId = "overview" | "config" | "task" | "keys" | "readme" | "preview" | "result";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Ringkas" },
  { id: "config", label: "Config" },
  { id: "task", label: "Task" },
  { id: "keys", label: "API & tools" },
  { id: "readme", label: "README.md" },
  { id: "preview", label: "Live preview" },
  { id: "result", label: "Hasil" }
];

function findSubRun(fleet: FleetOrchestrationSummary | null, subId: string): SubAgentRunResult | undefined {
  return fleet?.subAgentRuns.find((r) => r.id === subId);
}

function findSubDescriptor(lead: SpecialistAgentProfile | undefined, subId: string) {
  return lead?.subAgents?.find((s) => s.id === subId);
}

export type AgentDashboardModalProps = {
  open: boolean;
  onClose: () => void;
  target: AgentDashboardTarget | null;
  missionPrompt: string;
  specialists: SpecialistAgentProfile[];
  fleetSummary: FleetOrchestrationSummary | null;
};

export function AgentDashboardModal({
  open,
  onClose,
  target,
  missionPrompt,
  specialists,
  fleetSummary
}: AgentDashboardModalProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [runtime, setRuntime] = useState<PublicRuntimeDiagnostics | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeErr, setRuntimeErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRuntime(null);
      setRuntimeErr(null);
      setRuntimeLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "config") return;
    let cancelled = false;
    setRuntimeLoading(true);
    setRuntimeErr(null);
    fetchRuntimeDiagnostics()
      .then((d) => {
        if (!cancelled) setRuntime(d);
      })
      .catch(() => {
        if (!cancelled) {
          setRuntimeErr("Tidak bisa memuat config worker. Pastikan backend jalan dan NEXT_PUBLIC_BACKEND_URL benar.");
        }
      })
      .finally(() => {
        if (!cancelled) setRuntimeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tab]);

  useEffect(() => {
    if (!open || !target) return;
    const readmeForDefault =
      target.kind === "sub"
        ? (specialists[0]?.readmeMd ?? "")
        : (specialists[target.index]?.readmeMd ?? "");
    const html = extractFirstHtmlFence(readmeForDefault);
    if (html) setTab("preview");
    else if (readmeForDefault.trim().length > 0) setTab("readme");
    else setTab("overview");
  }, [open, target, specialists]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !target) return null;

  const lead = specialists[0];
  const isSub = target.kind === "sub";
  const specialist = !isSub ? specialists[target.index] : undefined;
  const subDesc = isSub ? findSubDescriptor(lead, target.subId) : undefined;
  const subRun = isSub ? findSubRun(fleetSummary, target.subId) : undefined;

  const readmeMd = isSub ? (lead?.readmeMd ?? "") : (specialist?.readmeMd ?? "");
  const previewHtml = extractFirstHtmlFence(readmeMd);

  const title = isSub
    ? `Sub-agent · ${subDesc?.role ?? target.subId}`
    : `Specialist · ${specialist?.name ?? "Agent"}`;

  const skipHint =
    "Output kosong biasanya karena belum ada gateway LLM (`OPENAI_COMPAT_BASE_URL` + key) atau OpenClaw dimatikan (`OPENCLAW_ORCHESTRATION=0`). Isi `backend/.env` lalu jalankan ulang misi.";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Tutup"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-dash-title"
        className="relative flex max-h-[min(92vh,780px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#070f1c] shadow-2xl shadow-black/60"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate">Agent dashboard</p>
            <h2 id="agent-dash-title" className="truncate text-lg font-semibold text-white">
              {title}
            </h2>
            {isSub && subDesc ? (
              <p className="mt-1 text-xs text-slate">Focus: {subDesc.focus}</p>
            ) : specialist?.canvasLane ? (
              <p className="mt-1 text-xs text-slate">
                Lane: <span className="text-electric">{specialist.canvasLane}</span>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-slate hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="flex shrink-0 gap-1 border-b border-white/10 px-3 pt-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-3 py-2 text-xs font-medium transition ${
                tab === t.id
                  ? "bg-electric/15 text-electric"
                  : "text-slate hover:bg-white/5 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed">
          {tab === "overview" && !isSub && (
            <div className="space-y-3 text-slate-200">
              {!specialist ? (
                <p className="text-slate">Profil tidak ditemukan.</p>
              ) : (
                <>
                  <p>
                    <span className="text-slate">Role:</span>{" "}
                    <span className="font-mono text-xs text-white">{specialist.role}</span>
                  </p>
                  <p>
                    <span className="text-slate">Purpose:</span> {specialist.purpose}
                  </p>
                  <p>
                    <span className="text-slate">Orkestrasi:</span> {specialist.orchestrationMode}
                  </p>
                  <div>
                    <span className="text-slate">Skills</span>
                    <ul className="mt-1 list-inside list-disc text-xs">
                      {(specialist.skills ?? []).map((s) => (
                        <li key={s.id}>{s.label}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "overview" && isSub && (
            <div className="space-y-3 text-slate-200">
              <p>
                <span className="text-slate">Id:</span>{" "}
                <span className="font-mono text-xs text-white">{target.subId}</span>
              </p>
              <p>
                <span className="text-slate">Role:</span>{" "}
                <span className="font-mono text-xs text-white">{subDesc?.role ?? "—"}</span>
              </p>
              <p>
                <span className="text-slate">Focus:</span> {subDesc?.focus ?? "—"}
              </p>
              {subRun ? (
                <p>
                  <span className="text-slate">Sumber eksekusi:</span>{" "}
                  <span className="text-electric">{subRun.source}</span>
                </p>
              ) : null}
            </div>
          )}

          {tab === "config" && (
            <div className="space-y-4 text-slate-200">
              <p className="text-xs text-slate">
                Model dan key di sini mengikuti <strong className="text-white">satu worker backend</strong> untuk
                semua agent. Key tidak pernah ditampilkan — hanya status &quot;ada / belum&quot;.
              </p>
              {runtimeLoading ? (
                <p className="text-sm text-slate">Memuat snapshot worker…</p>
              ) : runtimeErr ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-100">
                  {runtimeErr}
                </p>
              ) : runtime ? (
                <>
                  <p className="text-[10px] text-slate">{runtime.disclaimer}</p>
                  <p className="text-[10px] text-slate/80">Diperbarui: {runtime.generatedAt}</p>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
                    <p className="mb-2 font-semibold uppercase tracking-wide text-electric">Gateway LLM (OpenAI-compatible)</p>
                    <dl className="grid gap-1.5 sm:grid-cols-[140px_1fr]">
                      <dt className="text-slate">Siap pakai</dt>
                      <dd className="font-mono text-white">{runtime.llmGateway.openAiCompat.configured ? "ya" : "tidak"}</dd>
                      <dt className="text-slate">Base URL</dt>
                      <dd className="break-all font-mono text-white">
                        {runtime.llmGateway.openAiCompat.baseUrlDisplay ?? "—"}
                      </dd>
                      <dt className="text-slate">Model upstream</dt>
                      <dd className="font-mono text-electric">{runtime.llmGateway.openAiCompat.model}</dd>
                      <dt className="text-slate">Bearer dari env</dt>
                      <dd className="font-mono text-white">{runtime.llmGateway.openAiCompat.bearerFrom}</dd>
                      <dt className="text-slate">Bearer terisi</dt>
                      <dd className="font-mono text-white">{runtime.llmGateway.openAiCompat.bearerPresent ? "ya" : "tidak"}</dd>
                      <dt className="text-slate">Timeout</dt>
                      <dd className="font-mono text-white">{runtime.llmGateway.openAiCompat.timeoutMs} ms</dd>
                    </dl>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
                    <p className="mb-2 font-semibold uppercase tracking-wide text-electric">OpenClaw (CLI)</p>
                    <dl className="grid gap-1.5 sm:grid-cols-[140px_1fr]">
                      <dt className="text-slate">OPENCLAW_ORCHESTRATION</dt>
                      <dd className="font-mono text-white">
                        {runtime.llmGateway.openClaw.orchestrationRaw ?? "(unset)"} →{" "}
                        {runtime.llmGateway.openClaw.orchestrationEnabled ? "aktif" : "mati (0 = skip)"}
                      </dd>
                      <dt className="text-slate">Biner / agent</dt>
                      <dd className="font-mono text-white">
                        {runtime.llmGateway.openClaw.bin} · {runtime.llmGateway.openClaw.agentId}
                      </dd>
                      <dt className="text-slate">OPENCLAW_MODEL</dt>
                      <dd className="font-mono text-white">{runtime.llmGateway.openClaw.model ?? "— (default OpenClaw)"}</dd>
                      <dt className="text-slate">--local</dt>
                      <dd className="font-mono text-white">{runtime.llmGateway.openClaw.useLocal ? "ya" : "tidak"}</dd>
                      <dt className="text-slate">Timeout CLI</dt>
                      <dd className="font-mono text-white">{runtime.llmGateway.openClaw.timeoutMs} ms</dd>
                    </dl>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
                    <p className="mb-2 font-semibold uppercase tracking-wide text-electric">Tools & persistensi</p>
                    <dl className="grid gap-1.5 sm:grid-cols-[140px_1fr]">
                      <dt className="text-slate">TAVILY_API_KEY</dt>
                      <dd className="font-mono text-white">{runtime.tools.tavilyApiKeyPresent ? "terisi" : "kosong"}</dd>
                      <dt className="text-slate">E2B_API_KEY</dt>
                      <dd className="font-mono text-white">{runtime.tools.e2bApiKeyPresent ? "terisi" : "kosong"}</dd>
                      <dt className="text-slate">DATABASE_URL</dt>
                      <dd className="font-mono text-white">{runtime.persistence.databaseUrlPresent ? "terisi" : "kosong"}</dd>
                    </dl>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
                    <p className="mb-2 font-semibold uppercase tracking-wide text-electric">Fleet (sub-agent)</p>
                    <dl className="grid gap-1.5 sm:grid-cols-[160px_1fr]">
                      <dt className="text-slate">AUTO_ORCHESTRATION</dt>
                      <dd className="font-mono text-white">
                        {runtime.fleet.autoOrchestrationEnabled ? "default on (fleet otomatis)" : "off — fleet hanya jika prompt menyebut orkestrasi"}
                      </dd>
                      <dt className="text-slate">Token cap / sub</dt>
                      <dd className="font-mono text-white">{runtime.fleet.maxTokensPerSub}</dd>
                      <dt className="text-slate">Token merge</dt>
                      <dd className="font-mono text-white">{runtime.fleet.mergeMaxTokens}</dd>
                    </dl>
                  </div>
                </>
              ) : null}

              <div className="border-t border-white/10 pt-3 text-xs">
                <p className="mb-2 font-semibold text-white">Profil agent (dari mother)</p>
                {!isSub && specialist ? (
                  <dl className="grid gap-1.5 sm:grid-cols-[140px_1fr]">
                    <dt className="text-slate">Nama</dt>
                    <dd className="text-white">{specialist.name}</dd>
                    <dt className="text-slate">Orkestrasi profil</dt>
                    <dd className="font-mono text-electric">{specialist.orchestrationMode}</dd>
                    <dt className="text-slate">Output format</dt>
                    <dd className="font-mono text-white">{specialist.outputFormat}</dd>
                    <dt className="text-slate">Tools diizinkan</dt>
                    <dd className="text-white">{(specialist.allowedTools ?? []).join(", ") || "—"}</dd>
                    <dt className="text-slate">Spesialisasi</dt>
                    <dd className="text-white">{(specialist.specializations ?? []).join(", ") || "—"}</dd>
                    <dt className="text-slate">Referensi key (nama env)</dt>
                    <dd className="font-mono text-[11px] text-electric">
                      {(specialist.apiKeyRefs ?? []).join(", ") || "—"}
                    </dd>
                  </dl>
                ) : isSub ? (
                  <dl className="grid gap-1.5 sm:grid-cols-[140px_1fr]">
                    <dt className="text-slate">Sub-agent</dt>
                    <dd className="font-mono text-white">{subDesc?.id ?? target.subId}</dd>
                    <dt className="text-slate">Sumber run terakhir</dt>
                    <dd className="font-mono text-electric">{subRun?.source ?? "—"}</dd>
                    <dt className="text-slate">Key refs (lead)</dt>
                    <dd className="font-mono text-[11px] text-electric">
                      {(lead?.apiKeyRefs ?? []).join(", ") || "—"}
                    </dd>
                  </dl>
                ) : (
                  <p className="text-slate">Tidak ada profil.</p>
                )}
              </div>
              <p className="text-[10px] leading-relaxed text-slate">
                Lihat <span className="text-electric">docs/OPENCLAW_INTEGRATION.md</span> dan{" "}
                <span className="text-electric">docs/SETUP.md</span> untuk daftar env lengkap.
              </p>
            </div>
          )}

          {tab === "task" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate">Misi user (prompt)</p>
              <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-slate-100">
                {missionPrompt.trim() || "(belum ada misi)"}
              </pre>
              {!isSub && specialist?.notes && specialist.notes !== missionPrompt ? (
                <>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate">Catatan profil</p>
                  <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-slate">
                    {specialist.notes}
                  </pre>
                </>
              ) : null}
            </div>
          )}

          {tab === "keys" && (
            <div className="space-y-3 text-slate-200">
              <p className="text-xs text-slate">
                Referensi key di profil (nilai rahasia tidak pernah dikirim ke browser).
              </p>
              <ul className="list-inside list-disc text-sm">
                {(() => {
                  const keyList = isSub ? lead?.apiKeyRefs ?? [] : specialist?.apiKeyRefs ?? [];
                  return keyList.length ? (
                    keyList.map((k) => (
                      <li key={k} className="font-mono text-xs text-electric">
                        {k}
                      </li>
                    ))
                  ) : (
                    <li className="text-slate">—</li>
                  );
                })()}
              </ul>
              <p className="border-t border-white/10 pt-3 text-xs text-slate">
                Fleet / sub-agent: butuh <strong className="text-white">OPENAI_COMPAT_BASE_URL</strong> + bearer
                (atau <strong className="text-white">OPENCLAW_ORCHESTRATION</strong> bukan 0 + CLI OpenClaw). Tavily
                untuk riset: <strong className="text-white">TAVILY_API_KEY</strong>.
              </p>
            </div>
          )}

          {tab === "readme" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate">
                  {isSub
                    ? "README.md lead specialist (Mother: skills, tools, starter HTML/CSS, …)."
                    : "README.md yang di-generate mother untuk specialist ini."}
                </p>
                {readmeMd.trim() ? (
                  <button
                    type="button"
                    className="shrink-0 rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-electric hover:bg-white/10"
                    onClick={() => void navigator.clipboard.writeText(readmeMd)}
                  >
                    Copy README
                  </button>
                ) : null}
              </div>
              {readmeMd.trim() ? (
                <pre className="max-h-[min(58vh,520px)] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
                  {readmeMd}
                </pre>
              ) : (
                <p className="text-sm text-slate">Belum ada README untuk misi ini.</p>
              )}
            </div>
          )}

          {tab === "preview" && (
            <div className="space-y-2">
              <p className="text-xs text-slate">
                Pratinjau dari blok <code className="text-electric">{"```html"}</code> di README (iframe sandbox,
                script tidak dijalankan).
              </p>
              {previewHtml ? (
                <iframe
                  title="HTML preview"
                  className="h-[min(52vh,480px)] w-full rounded-lg border border-white/15 bg-white"
                  sandbox=""
                  srcDoc={previewHtml}
                />
              ) : (
                <p className="rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-slate">
                  Tidak ada fence <code className="text-electric">{"```html ... ```"}</code> di README. Minta output
                  HTML di README atau tambahkan blok tersebut.
                </p>
              )}
            </div>
          )}

          {tab === "result" && !isSub && specialist && (
            <div className="space-y-4">
              {target.index === 0 && fleetSummary?.mergedReport ? (
                <>
                  <p className="text-xs text-slate">
                    Lead specialist — laporan gabungan mother (scout → worker → reviewer + merge).
                  </p>
                  <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-xs text-slate-100">
                    {fleetSummary.mergedReport}
                  </pre>
                </>
              ) : target.index !== 0 ? (
                <p className="text-xs text-slate">
                  Specialist squad (bukan lead). Ringkasan fleet ada di lead (node pertama / tab Frontend).
                </p>
              ) : (
                <p className="text-slate text-xs">
                  Belum ada laporan fleet (sub-agent tidak dijalankan atau belum ada output).
                </p>
              )}
              <p className="text-[10px] text-slate">
                README & HTML: tab <span className="text-electric">README.md</span>
                {previewHtml ? (
                  <>
                    {" "}
                    · <span className="text-electric">Live preview</span>
                  </>
                ) : null}
                .
              </p>
            </div>
          )}

          {tab === "result" && isSub && (
            <div className="space-y-3">
              {previewHtml ? (
                <p className="rounded-lg border border-electric/25 bg-electric/10 px-3 py-2 text-[11px] text-electric">
                  HTML ada di README lead — buka tab <strong>Live preview</strong>.
                </p>
              ) : (
                <p className="text-[10px] text-slate">
                  Artefak README lead: tab <span className="text-electric">README.md</span>.
                </p>
              )}
              {subRun?.source === "skipped" ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
                  {skipHint}
                </p>
              ) : null}
              <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-xs text-slate-100">
                {subRun?.output?.trim() || "_Belum ada output._"}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
