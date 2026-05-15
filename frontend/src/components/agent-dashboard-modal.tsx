"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, ExternalLink, Globe, Search, Wrench, X, Zap } from "lucide-react";
import { fetchRuntimeDiagnostics } from "@/lib/api";
import { extractFirstHtmlFence, findReadmeWithHtmlFence } from "@/lib/extract-html-fence";
import { extractHttpUrlsFromText } from "@/lib/extract-urls";
import type {
  FleetOrchestrationSummary,
  PublicRuntimeDiagnostics,
  SpecialistAgentProfile,
  SpecialistSkill,
  SubAgentRunResult
} from "@/lib/types";

export type AgentDashboardTarget =
  | { kind: "specialist"; agentId: string }
  | { kind: "specialist"; index: number }
  | { kind: "sub"; subId: string };

type TabId = "overview" | "config" | "task" | "keys" | "skill" | "readme" | "preview" | "result";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Ringkas" },
  { id: "config", label: "Config" },
  { id: "task", label: "Task" },
  { id: "keys", label: "API & tools" },
  { id: "skill", label: "SKILL.md" },
  { id: "readme", label: "README.md" },
  { id: "preview", label: "Sample output" },
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
  /** Fleet / sub-agent output only for this mission id. */
  activeMissionId?: string | null;
};

export function AgentDashboardModal({
  open,
  onClose,
  target,
  missionPrompt,
  specialists,
  fleetSummary,
  activeMissionId
}: AgentDashboardModalProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [runtime, setRuntime] = useState<PublicRuntimeDiagnostics | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeErr, setRuntimeErr] = useState<string | null>(null);

  const activeSpecialist = useMemo(() => {
    if (!target || target.kind !== "specialist") return undefined;
    if ("agentId" in target && target.agentId) {
      return specialists.find((s) => s.persistedId === target.agentId || `idx-${specialists.indexOf(s)}` === target.agentId);
    }
    if ("index" in target) return specialists[target.index];
    return undefined;
  }, [target, specialists]);

  const fleetForView = useMemo(() => {
    if (!activeMissionId || !fleetSummary) return fleetSummary;
    return fleetSummary;
  }, [activeMissionId, fleetSummary]);

  const skillMd = useMemo(() => {
    if (!open || !target) return "";
    if (target.kind === "sub") {
      const lead =
        specialists.find((s) => s.missionId === activeMissionId) ?? specialists[0];
      return lead?.skillMd ?? "";
    }
    return activeSpecialist?.skillMd ?? "";
  }, [open, target, specialists, activeSpecialist, activeMissionId]);

  const readmeMd = useMemo(() => {
    if (!open || !target) return "";
    if (target.kind === "sub") {
      const missionSquad = specialists.filter((s) => s.missionId === activeMissionId);
      const pool = missionSquad.length ? missionSquad : specialists;
      return findReadmeWithHtmlFence(pool);
    }
    const own = activeSpecialist?.readmeMd ?? "";
    if (own && extractFirstHtmlFence(own)) return own;
    return findReadmeWithHtmlFence(specialists);
  }, [open, target, specialists, activeSpecialist, activeMissionId]);

  const previewHtml = useMemo(() => extractFirstHtmlFence(readmeMd), [readmeMd]);

  const readmeUrls = useMemo(() => extractHttpUrlsFromText(readmeMd), [readmeMd]);

  const previewBlobUrl = useMemo(() => {
    if (!open || !previewHtml) return null;
    return URL.createObjectURL(new Blob([previewHtml], { type: "text/html;charset=utf-8" }));
  }, [open, previewHtml]);

  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [previewBlobUrl]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      setRuntime(null);
      setRuntimeErr(null);
      setRuntimeLoading(false);
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const currentSkillMd = skillMd;
  const currentActiveSpecialist = activeSpecialist;
  useEffect(() => {
    if (!open || !target) return;
    const readmeForDefault =
      target.kind === "sub"
        ? findReadmeWithHtmlFence(
            specialists.filter((s) => s.missionId === activeMissionId).length
              ? specialists.filter((s) => s.missionId === activeMissionId)
              : specialists
          )
        : (() => {
            const own = currentActiveSpecialist?.readmeMd ?? "";
            return own && extractFirstHtmlFence(own) ? own : findReadmeWithHtmlFence(specialists);
          })();
    const next: TabId = currentSkillMd.trim().length > 0 ? "skill" : readmeForDefault.trim().length > 0 ? "readme" : "overview";
    const id = requestAnimationFrame(() => setTab(next));
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target, specialists, activeMissionId]);

  useEffect(() => {
    if (!open || tab !== "config") return;
    let cancelled = false;
    const startId = requestAnimationFrame(() => {
      if (cancelled) return;
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
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(startId);
    };
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !target) return null;

  const lead =
    specialists.find((s) => s.missionId === activeMissionId) ??
    specialists[specialists.length - 1] ??
    specialists[0];
  const isSub = target.kind === "sub";
  const specialist = !isSub ? activeSpecialist : undefined;
  const subDesc = isSub ? findSubDescriptor(lead, target.subId) : undefined;
  const subRun = isSub ? findSubRun(fleetForView, target.subId) : undefined;
  const isActiveMissionLead = Boolean(
    specialist?.missionId && activeMissionId && specialist.missionId === activeMissionId
  );

  const title = isSub
    ? `Sub-agent · ${subDesc?.role ?? target.subId}`
    : `Specialist · ${specialist?.name ?? "Agent"}`;

  const skipHint =
    "Fleet otomatis: OpenClaw dulu (`OPENCLAW_ORCHESTRATION=1`), lalu gateway SumoPod fallback. Pastikan `openclaw` ada di PATH dan `AUTO_ORCHESTRATION=1` di `backend/.env`.";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
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
        className="relative flex max-h-[min(96vh,960px)] w-full max-w-[min(1400px,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#070f1c] shadow-2xl shadow-black/60"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate">Agent dashboard</p>
            <h2 id="agent-dash-title" className="truncate text-xl font-semibold text-white sm:text-2xl">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[15px] leading-relaxed">
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
                <p className="mb-2 font-semibold text-white">Profil agent (dari Central Agent)</p>
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

          {tab === "skill" && (
            <AgentSkillCards
              skillMd={skillMd}
              skills={isSub ? [] : (activeSpecialist?.skills ?? [])}
              agentName={isSub ? (subDesc?.role ?? "sub-agent") : (specialist?.name ?? "Agent")}
            />
          )}

          {tab === "readme" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate">
                  {isSub
                    ? "README.md lead specialist (Central Agent: skills, tools, starter HTML/CSS, …)."
                    : "README.md yang di-generate Central Agent untuk specialist ini."}
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
                <pre className="max-h-[min(68vh,680px)] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-[12px] leading-relaxed text-slate-100 sm:text-[13px]">
                  {readmeMd}
                </pre>
              ) : (
                <p className="text-sm text-slate">Belum ada README untuk misi ini.</p>
              )}
            </div>
          )}

          {tab === "preview" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <p className="max-w-3xl text-sm text-slate">
                  Sample deliverable dari blok <code className="text-electric">{"```html"}</code> di README. Ini bukan artifact utama; artifact utama agent ada di tab <span className="text-electric">SKILL.md</span>. Iframe pakai{" "}
                  <code className="text-electric">sandbox=&quot;&quot;</code> (script tidak jalan). Buka tab baru untuk
                  halaman penuh — itu URL <code className="text-electric">blob:</code> lokal (bisa menjalankan script;
                  hanya untuk konten kamu sendiri).
                </p>
              </div>

              {readmeUrls.length > 0 ? (
                <div className="rounded-lg border border-electric/20 bg-electric/5 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-electric">Link di README</p>
                  <ul className="flex flex-col gap-2">
                    {readmeUrls.map((u) => (
                      <li key={u} className="min-w-0">
                        <a
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-2 break-all font-mono text-sm text-electric underline decoration-electric/40 underline-offset-2 hover:decoration-electric"
                        >
                          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                          {u}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {previewHtml ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {previewBlobUrl ? (
                      <>
                        <a
                          href={previewBlobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-electric/40 bg-electric/15 px-3 py-2 text-sm font-medium text-electric hover:bg-electric/25"
                        >
                          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                          Buka sample HTML di tab baru
                        </a>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate hover:bg-white/10 hover:text-white"
                          onClick={() => void navigator.clipboard.writeText(previewBlobUrl)}
                        >
                          <Copy className="h-4 w-4 shrink-0" aria-hidden />
                          Salin URL blob
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-white/15 bg-white shadow-inner shadow-black/20">
                    <iframe
                      title="HTML preview"
                      className="block h-[min(68vh,720px)] min-h-[320px] w-full"
                      sandbox=""
                      srcDoc={previewHtml}
                    />
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-slate">
                  Tidak ada fence <code className="text-electric">{"```html ... ```"}</code> di README. Kalau hanya
                  punya link situs, pakai daftar <strong className="text-white">Link di README</strong> di atas (bila
                  URL terdeteksi). Jika butuh demo aksi, minta Central Agent menaruh sample HTML di fence atau URL lengkap di README.
                </p>
              )}
            </div>
          )}

          {tab === "result" && !isSub && specialist && (
            <div className="space-y-4">
              {isActiveMissionLead && fleetForView?.mergedReport ? (
                <>
                  <p className="text-xs text-slate">
                    Lead specialist — laporan gabungan Central Agent (scout → worker → reviewer + merge).
                  </p>
                  <pre className="max-h-[min(62vh,640px)] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-[12px] text-slate-100 sm:text-[13px]">
                    {fleetForView.mergedReport}
                  </pre>
                </>
              ) : !isActiveMissionLead ? (
                <p className="text-xs text-slate">
                  Specialist squad (bukan lead). Ringkasan fleet ada di lead (node pertama / tab Frontend).
                </p>
              ) : (
                <p className="text-slate text-xs">
                  Belum ada laporan fleet (sub-agent tidak dijalankan atau belum ada output).
                </p>
              )}
              <p className="text-[10px] text-slate">
                Agent package: tab <span className="text-electric">SKILL.md</span> dan <span className="text-electric">README.md</span>
                {previewHtml ? (
                  <>
                    {" "}
                    · <span className="text-electric">Sample output</span>
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
                  Sample output ada di README lead — buka tab <strong>Sample output</strong>.
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
              <pre className="max-h-[min(62vh,640px)] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-[12px] text-slate-100 sm:text-[13px]">
                {subRun?.output?.trim() || "_Belum ada output._"}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function skillKindIcon(kind: string) {
  const cls = "h-4 w-4 shrink-0";
  if (kind === "touch") return <Search className={`${cls} text-cyan-400`} />;
  if (kind === "generate") return <Wrench className={`${cls} text-amber-400`} />;
  if (kind === "orchestrate") return <Zap className={`${cls} text-violet-400`} />;
  return <Globe className={`${cls} text-slate`} />;
}

function skillKindStyle(kind: string) {
  if (kind === "touch") return "border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10";
  if (kind === "generate") return "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10";
  if (kind === "orchestrate") return "border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10";
  return "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]";
}

function skillKindLabel(kind: string) {
  if (kind === "touch") return "Riset";
  if (kind === "generate") return "Generate";
  if (kind === "orchestrate") return "Orkestrasi";
  return "Skill";
}

type SkillCardItem = {
  id: string;
  label: string;
  description: string;
  kind: string;
  instructions?: string;
};

function AgentSkillCards({ skillMd, skills, agentName }: {
  skillMd: string;
  skills: SpecialistSkill[];
  agentName: string;
}) {
  const [modalSkill, setModalSkill] = useState<SkillCardItem | null>(null);

  const allSkills = useMemo((): SkillCardItem[] => {
    const items: SkillCardItem[] = [];
    const seen = new Set<string>();

    for (const sk of skills) {
      if (!seen.has(sk.id)) {
        seen.add(sk.id);
        items.push({ id: sk.id, label: sk.label, description: sk.description, kind: sk.kind, instructions: sk.instructions });
      }
    }

    if (skillMd.trim()) {
      const lines = skillMd.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const m = line.match(/^(.+?)\.\s+(.+)$/);
        if (m && m[1].length < 80 && m[2].length > 10) {
          const label = m[1].trim();
          const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
          if (seen.has(id)) continue;
          seen.add(id);
          const rest = m[2].trim();
          const kindMatch = rest.match(/Jenis:\s*(\w+)/i);
          const kind = kindMatch?.[1]?.toLowerCase() ?? "other";
          const desc = rest.replace(/Jenis:\s*\w+\.?/i, "").replace(/\((?:sumber|dari):\s*.+?\)/i, "").trim();
          items.push({ id, label, description: desc || rest, kind });
        }
      }
    }

    return items;
  }, [skills, skillMd]);

  if (allSkills.length === 0 && !skillMd.trim()) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate">Belum ada SKILL.md. Jalankan misi untuk extract skills dari web.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate">
            SKILL {agentName} — {allSkills.length} skills dari Central Agent + web extraction.
          </p>
          {skillMd.trim() ? (
            <button
              type="button"
              className="shrink-0 rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-electric hover:bg-white/10"
              onClick={() => void navigator.clipboard.writeText(skillMd)}
            >
              Copy raw
            </button>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {allSkills.map((sk) => (
            <button
              key={sk.id}
              type="button"
              onClick={() => setModalSkill(sk)}
              className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${skillKindStyle(sk.kind)}`}
            >
              {skillKindIcon(sk.kind)}
              <div className="flex-1 min-w-0">
                <span className="block truncate text-xs font-semibold text-white">{sk.label}</span>
                <span className="text-[10px] text-slate">{skillKindLabel(sk.kind)}</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate" />
            </button>
          ))}
        </div>
      </div>

      {modalSkill && (
        <SkillDetailModal skill={modalSkill} onClose={() => setModalSkill(null)} />
      )}
    </>
  );
}

function SkillDetailModal({ skill, onClose }: { skill: SkillCardItem; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0d1117] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={`flex items-center gap-3 border-b border-white/10 px-5 py-4 ${
          skill.kind === "touch" ? "bg-cyan-500/10" :
          skill.kind === "generate" ? "bg-amber-500/10" :
          skill.kind === "orchestrate" ? "bg-violet-500/10" : "bg-white/5"
        }`}>
          {skillKindIcon(skill.kind)}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white">{skill.label}</h3>
            <p className="text-[11px] text-slate">{skillKindLabel(skill.kind)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          <p className="text-[13px] leading-relaxed text-slate-200">{skill.description}</p>

          {skill.instructions ? (
            <div className="space-y-3">
              {skill.instructions.split("\n\n").map((section, i) => {
                const lines = section.split("\n");
                const firstLine = lines[0]?.trim() ?? "";
                const isHeading = firstLine.length < 60 && !firstLine.includes(".") && lines.length > 1;

                if (isHeading) {
                  return (
                    <div key={i}>
                      <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-electric">{firstLine}</h4>
                      <div className="space-y-1">
                        {lines.slice(1).map((line, j) => {
                          const trimmed = line.trim();
                          if (!trimmed) return null;
                          const isBullet = trimmed.startsWith("- ");
                          const isNumbered = /^\d+\./.test(trimmed);
                          return (
                            <p key={j} className={`text-[12px] leading-relaxed text-slate-300 ${isBullet || isNumbered ? "pl-3" : ""}`}>
                              {trimmed}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={i} className="space-y-1">
                    {lines.map((line, j) => {
                      const trimmed = line.trim();
                      if (!trimmed) return null;
                      return (
                        <p key={j} className="text-[12px] leading-relaxed text-slate-300">{trimmed}</p>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate">Belum ada instruksi detail untuk skill ini.</p>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-white/10 px-5 py-3">
          <span className="text-[10px] text-slate">Skill extracted by Central Agent</span>
          {skill.instructions ? (
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(`# ${skill.label}\n\n${skill.instructions}`)}
              className="rounded border border-white/15 bg-white/5 px-3 py-1 text-[10px] text-electric hover:bg-white/10"
            >
              Copy skill
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
