"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, Download, Globe, Layers, Loader2, Search, Wrench, X, XCircle, Zap } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { MotherAgentManagement } from "@/components/mother-agent-management";
import { fetchMem0Status, fetchRuntimeDiagnostics, fetchTelegramStatus, previewExtract, searchMem0, startTelegramBot, stopTelegramBot, type Mem0SearchResult, type Mem0Status, type TelegramBotStatus } from "@/lib/api";
import type { CanvasViewMode } from "@/lib/canvas-agent-prefs";
import type {
  FleetOrchestrationSummary,
  PublicRuntimeDiagnostics,
  SpecialistAgentProfile
} from "@/lib/types";

export type MotherMissionBundle = {
  contextNotes: string;
  referenceUrlsText: string;
  preferTavilySearch: boolean;
  motherReviewNotes: string;
};

export function emptyMotherMissionBundle(): MotherMissionBundle {
  return {
    contextNotes: "",
    referenceUrlsText: "",
    preferTavilySearch: false,
    motherReviewNotes: ""
  };
}

export function motherBundleToMissionExtras(bundle: MotherMissionBundle): {
  contextNotes?: string;
  referenceUrls?: string[];
  preferTavilySearch?: boolean;
  motherReviewNotes?: string;
} {
  const urls = bundle.referenceUrlsText
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s))
    .slice(0, 16);
  return {
    ...(bundle.contextNotes.trim() ? { contextNotes: bundle.contextNotes.trim() } : {}),
    ...(urls.length ? { referenceUrls: urls } : {}),
    ...(bundle.preferTavilySearch ? { preferTavilySearch: true } : {}),
    ...(bundle.motherReviewNotes.trim() ? { motherReviewNotes: bundle.motherReviewNotes.trim() } : {})
  };
}

type TabId = "overview" | "agents" | "skill" | "readme" | "config" | "services" | "context" | "task" | "hasil";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Ringkas" },
  { id: "skill", label: "SKILL.md" },
  { id: "readme", label: "README.md" },
  { id: "agents", label: "Kelola agent" },
  { id: "config", label: "Config" },
  { id: "services", label: "Services" },
  { id: "context", label: "Konteks & iterasi" },
  { id: "task", label: "Task" },
  { id: "hasil", label: "Hasil" }
];

type MotherAgentModalProps = {
  open: boolean;
  onClose: () => void;
  bundle: MotherMissionBundle;
  onApply: (next: MotherMissionBundle) => void;
  missionPrompt: string;
  specialists: SpecialistAgentProfile[];
  fleetSummary: FleetOrchestrationSummary | null;
  activeMissionId?: string | null;
  canvasViewMode: CanvasViewMode;
  onCanvasViewModeChange: (mode: CanvasViewMode) => void;
  hiddenAgentIds: Set<string>;
  onToggleHiddenAgent: (persistedId: string) => void;
  onDeleteAgent: (persistedId: string) => void;
  onKeepLatestMissionAgents: () => void;
  onClearAllAgents: () => void;
  agentsBusy?: boolean;
  centralSkillMd?: string | null;
  centralReadmeMd?: string | null;
  motherBrief?: string | null;
  motherReview?: string | null;
};

export function MotherAgentModal({
  open,
  onClose,
  bundle,
  onApply,
  missionPrompt,
  specialists,
  fleetSummary,
  activeMissionId = null,
  canvasViewMode,
  onCanvasViewModeChange,
  hiddenAgentIds,
  onToggleHiddenAgent,
  onDeleteAgent,
  onKeepLatestMissionAgents,
  onClearAllAgents,
  agentsBusy,
  centralSkillMd,
  centralReadmeMd,
  motherBrief,
  motherReview
}: MotherAgentModalProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [local, setLocal] = useState<MotherMissionBundle>(bundle);

  const [runtime, setRuntime] = useState<PublicRuntimeDiagnostics | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeErr, setRuntimeErr] = useState<string | null>(null);

  const [svcUrl, setSvcUrl] = useState("https://nextjs.org/docs");
  const [svcQuery, setSvcQuery] = useState("");
  const [svcLoading, setSvcLoading] = useState(false);
  const [svcResult, setSvcResult] = useState<string | null>(null);
  const [svcTitle, setSvcTitle] = useState<string | null>(null);
  const [svcErr, setSvcErr] = useState<string | null>(null);

  const [telegramStatus, setTelegramStatus] = useState<TelegramBotStatus | null>(null);
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramErr, setTelegramErr] = useState<string | null>(null);

  const [mem0Status, setMem0Status] = useState<Mem0Status | null>(null);
  const [mem0Query, setMem0Query] = useState("");
  const [mem0Results, setMem0Results] = useState<Mem0SearchResult[]>([]);
  const [mem0Searching, setMem0Searching] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setLocal(bundle));
    return () => cancelAnimationFrame(id);
  }, [open, bundle]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      setRuntime(null);
      setRuntimeErr(null);
      setRuntimeLoading(false);
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

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
          if (!cancelled) setRuntimeErr("Gagal memuat config worker.");
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
    if (!open || tab !== "services") return;
    let cancelled = false;
    fetchTelegramStatus()
      .then((s) => { if (!cancelled) setTelegramStatus(s); })
      .catch(() => {});
    fetchMem0Status()
      .then((s) => { if (!cancelled) setMem0Status(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const lead = specialists[0];

  async function handleExtract() {
    setSvcLoading(true);
    setSvcErr(null);
    setSvcResult(null);
    setSvcTitle(null);
    try {
      const res = await previewExtract({ url: svcUrl.trim(), query: svcQuery.trim() || undefined });
      if (!res.ok) {
        setSvcErr(res.error ?? "Extract gagal");
        return;
      }
      setSvcTitle(res.title ?? null);
      setSvcResult(res.markdown ?? "");
    } catch {
      setSvcErr("Tidak terhubung ke backend.");
    } finally {
      setSvcLoading(false);
    }
  }

  function appendExtractToContext() {
    if (!svcResult?.trim()) return;
    const block = [
      "",
      `### Cuplikan docs (Tavily) — ${svcUrl.trim()}`,
      svcTitle ? `_Judul: ${svcTitle}_` : "",
      "",
      svcResult.trim().slice(0, 12000)
    ]
      .filter(Boolean)
      .join("\n");
    setLocal((s) => ({
      ...s,
      contextNotes: (s.contextNotes.trim() ? `${s.contextNotes.trim()}\n\n` : "") + block
    }));
  }

  function handleSave() {
    onApply(local);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-label="Tutup" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mother-dash-title"
        className="relative flex max-h-[min(96vh,960px)] w-full max-w-[min(1400px,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-violet-500/25 bg-[#0a0f24] shadow-2xl shadow-black/60"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">Central Agent</p>
            <h2 id="mother-dash-title" className="truncate text-xl font-semibold text-white sm:text-2xl">
              Central dashboard
            </h2>
            <p className="mt-1 text-xs text-slate">
              Konteks, URL, Services (baca docs), dan catatan review digabung ke <strong className="text-white">Run mission</strong> berikutnya.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-slate hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-2 pt-2 sm:px-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-t-lg px-3 py-2 text-xs font-medium transition ${
                tab === t.id ? "bg-violet-500/20 text-violet-200" : "text-slate hover:bg-white/5 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[15px] leading-relaxed text-slate-200">
          {tab === "overview" && (
            <div className="space-y-3">
              <p>
                Central Agent merakit <strong className="text-white">squad specialist</strong>, menjalankan{" "}
                <strong className="text-white">fleet sub-agent</strong>, lalu tool route &amp; sandbox. Gunakan tab{" "}
                <span className="text-violet-300">Konteks &amp; iterasi</span> untuk pengetahuan + URL; tab{" "}
                <span className="text-violet-300">Services</span> untuk baca dokumentasi / berita lewat Tavily Extract
                tanpa menunggu misi penuh.
              </p>
              <p className="text-sm text-slate">
                Alur manual: isi konteks → (opsional) cuplikkan docs di Services → tulis review di Konteks &amp; iterasi
                → Run mission dari chat → baca Hasil di sini atau buka dashboard specialist/sub.
              </p>
            </div>
          )}

          {tab === "skill" && (
            <CentralSkillCards
              centralSkillMd={centralSkillMd ?? null}
              specialists={specialists.filter((s) => s.role !== "pending")}
            />
          )}

          {tab === "readme" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate">README Central Agent — ringkasan misi dan semua agent yang diproduce.</p>
                {centralReadmeMd?.trim() ? (
                  <button
                    type="button"
                    className="shrink-0 rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-violet-300 hover:bg-white/10"
                    onClick={() => void navigator.clipboard.writeText(centralReadmeMd)}
                  >
                    Copy README
                  </button>
                ) : null}
              </div>
              {centralReadmeMd?.trim() ? (
                <pre className="max-h-[min(68vh,680px)] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/50 p-3 text-[12px] leading-relaxed text-slate-100 sm:text-[13px]">
                  {centralReadmeMd}
                </pre>
              ) : (
                <p className="text-sm text-slate">Belum ada README Central Agent. Jalankan misi dulu.</p>
              )}
            </div>
          )}

          {tab === "agents" && (
            <MotherAgentManagement
              agents={specialists.filter((s) => s.role !== "pending")}
              activeMissionId={activeMissionId}
              hiddenIds={hiddenAgentIds}
              viewMode={canvasViewMode}
              onViewModeChange={onCanvasViewModeChange}
              onToggleHidden={onToggleHiddenAgent}
              onDeleteAgent={onDeleteAgent}
              onKeepLatestMission={onKeepLatestMissionAgents}
              onClearAll={onClearAllAgents}
              busy={agentsBusy}
            />
          )}

          {tab === "config" && (
            <div className="space-y-4">
              <p className="text-xs text-slate">Snapshot worker (sama untuk semua agent). Key tidak ditampilkan.</p>
              {runtimeLoading ? (
                <p className="text-sm text-slate">Memuat…</p>
              ) : runtimeErr ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-100">
                  {runtimeErr}
                </p>
              ) : runtime ? (
                <div className="grid gap-3 text-xs sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="mb-2 font-semibold text-violet-200">OpenAI-compatible</p>
                    <p className="font-mono text-[11px] text-white">
                      {runtime.llmGateway.openAiCompat.configured ? "siap" : "belum"} · {runtime.llmGateway.openAiCompat.model}
                    </p>
                    <p className="mt-1 break-all text-[10px] text-slate">
                      {runtime.llmGateway.openAiCompat.baseUrlDisplay ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="mb-2 font-semibold text-violet-200">Tavily / DB</p>
                    <p className="text-[11px] text-white">
                      Tavily: {runtime.tools.tavilyApiKeyPresent ? "ok" : "belum"} · DB:{" "}
                      {runtime.persistence.databaseUrlPresent ? "ok" : "skip"}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {tab === "services" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-sm text-slate">
                <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden />
                <p>
                  Baca halaman publik (docs, blog, news) via <strong className="text-white">Tavily Extract</strong>.
                  Contoh: <code className="text-violet-200">https://nextjs.org/docs</code>. Butuh{" "}
                  <code className="text-violet-200">TAVILY_API_KEY</code> di backend.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                <div>
                  <label className="text-xs font-semibold text-slate">URL</label>
                  <input
                    value={svcUrl}
                    onChange={(e) => setSvcUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate">Query fokus (opsional)</label>
                  <input
                    value={svcQuery}
                    onChange={(e) => setSvcQuery(e.target.value)}
                    placeholder="mis. app router getting started"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-violet-500/50"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={svcLoading || !svcUrl.trim()}
                  onClick={() => void handleExtract()}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
                >
                  {svcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                  Baca URL
                </button>
                {svcResult ? (
                  <button
                    type="button"
                    onClick={appendExtractToContext}
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm text-electric hover:bg-white/5"
                  >
                    Tambahkan ke pengetahuan
                  </button>
                ) : null}
              </div>
              {svcErr ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
                  {svcErr}
                </p>
              ) : null}
              {svcTitle ? <p className="text-xs text-violet-200">Judul: {svcTitle}</p> : null}
              {svcResult ? (
                <pre className="max-h-[min(50vh,420px)] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
                  {svcResult}
                </pre>
              ) : (
                <p className="text-sm text-slate">Belum ada hasil extract.</p>
              )}

              <div className="border-t border-white/10 pt-4">
                <div className="flex items-start gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-slate">
                  <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
                  <div>
                    <p>
                      <strong className="text-white">Telegram Bot</strong> — terima misi langsung dari Telegram.
                      Buat bot via <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-cyan-300 underline">@BotFather</a>,
                      paste token di bawah, klik Connect.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate">Bot Token</label>
                    <input
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                      placeholder="123456:ABCdef..."
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white focus:border-cyan-500/50"
                    />
                  </div>
                  {telegramStatus?.running ? (
                    <button
                      type="button"
                      disabled={telegramLoading}
                      onClick={async () => {
                        setTelegramLoading(true);
                        setTelegramErr(null);
                        try {
                          await stopTelegramBot();
                          setTelegramStatus({ running: false, botUsername: null, token: null });
                        } catch {
                          setTelegramErr("Gagal stop bot");
                        } finally {
                          setTelegramLoading(false);
                        }
                      }}
                      className="shrink-0 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={telegramLoading || telegramToken.trim().length < 20}
                      onClick={async () => {
                        setTelegramLoading(true);
                        setTelegramErr(null);
                        try {
                          const res = await startTelegramBot(telegramToken.trim());
                          if (res.ok) {
                            setTelegramStatus({ running: true, botUsername: res.username ?? null, token: telegramToken.slice(0, 8) + "..." });
                            setTelegramToken("");
                          } else {
                            setTelegramErr(res.error ?? "Token tidak valid");
                          }
                        } catch {
                          setTelegramErr("Gagal konek ke backend");
                        } finally {
                          setTelegramLoading(false);
                        }
                      }}
                      className="shrink-0 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
                    >
                      {telegramLoading ? "Connecting..." : "Connect"}
                    </button>
                  )}
                </div>

                {telegramErr && (
                  <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
                    {telegramErr}
                  </p>
                )}

                {telegramStatus?.running && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-white font-semibold">@{telegramStatus.botUsername}</span>
                    <span className="text-xs text-slate">— Online, menerima misi dari Telegram</span>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 pt-4">
                <div className="flex items-start gap-2 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 text-sm text-slate">
                  <Zap className="mt-0.5 h-5 w-5 shrink-0 text-purple-300" aria-hidden />
                  <div>
                    <p>
                      <strong className="text-white">Mem0 Memory</strong> — persistent memory untuk Central Agent.
                      Agent mengingat misi sebelumnya dan belajar dari hasilnya.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  {mem0Status ? (
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                      <span className={`h-2 w-2 rounded-full ${mem0Status.connected ? "bg-green-400 animate-pulse" : mem0Status.configured ? "bg-amber-400" : "bg-red-400"}`} />
                      <span className="text-xs text-white font-semibold">
                        {mem0Status.connected ? "Connected" : mem0Status.configured ? "Configured (not connected)" : "Not configured"}
                      </span>
                      {mem0Status.connected && (
                        <span className="text-[10px] text-slate">{mem0Status.memoryCount} memories</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate">Loading...</span>
                  )}
                </div>

                {mem0Status?.connected && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-slate">Search memories</label>
                        <input
                          value={mem0Query}
                          onChange={(e) => setMem0Query(e.target.value)}
                          placeholder="Cari memori agent..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && mem0Query.trim()) {
                              setMem0Searching(true);
                              searchMem0(mem0Query.trim())
                                .then(setMem0Results)
                                .finally(() => setMem0Searching(false));
                            }
                          }}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-purple-500/50"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={mem0Searching || !mem0Query.trim()}
                        onClick={() => {
                          setMem0Searching(true);
                          searchMem0(mem0Query.trim())
                            .then(setMem0Results)
                            .finally(() => setMem0Searching(false));
                        }}
                        className="shrink-0 rounded-xl bg-purple-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
                      >
                        {mem0Searching ? "..." : "Search"}
                      </button>
                    </div>

                    {mem0Results.length > 0 && (
                      <div className="space-y-1 rounded-lg border border-white/10 bg-black/30 p-2">
                        {mem0Results.map((m) => (
                          <div key={m.id} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                            <p className="text-[11px] leading-relaxed text-slate-200">{m.memory}</p>
                            {m.created_at && (
                              <p className="mt-1 text-[9px] text-slate">{new Date(m.created_at).toLocaleString()}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "context" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate">Pengetahuan / catatan</label>
                <textarea
                  rows={7}
                  value={local.contextNotes}
                  onChange={(e) => setLocal((s) => ({ ...s, contextNotes: e.target.value }))}
                  className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-violet-500/50"
                  placeholder="Domain rules, API contract, tone, …"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate">URL referensi (satu per baris)</label>
                <textarea
                  rows={5}
                  value={local.referenceUrlsText}
                  onChange={(e) => setLocal((s) => ({ ...s, referenceUrlsText: e.target.value }))}
                  className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-[12px] text-white focus:border-violet-500/50"
                  placeholder="https://…"
                />
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                <input
                  type="checkbox"
                  checked={local.preferTavilySearch}
                  onChange={(e) => setLocal((s) => ({ ...s, preferTavilySearch: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-black/50 text-violet-500"
                />
                <span className="text-sm text-slate">
                  Paksa <strong className="text-white">Tavily web search</strong> di tool route pada misi berikutnya.
                </span>
              </label>
              <div>
                <label className="text-xs font-semibold text-violet-200">Review / uji → Central Agent (putaran berikutnya)</label>
                <textarea
                  rows={5}
                  value={local.motherReviewNotes}
                  onChange={(e) => setLocal((s) => ({ ...s, motherReviewNotes: e.target.value }))}
                  className="mt-1 w-full resize-y rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-sm text-white focus:border-violet-400/50"
                  placeholder="Contoh: perketat SKILL.md, sempitkan scope agent, tambahkan tool constraints, fokus ke endpoint /articles..."
                />
                <p className="mt-1 text-[10px] text-slate">
                  Teks ini disematkan di akhir payload misi sebagai blok &quot;Review / uji dari user&quot; setiap kali kamu
                  menekan Run mission — alur manual review ↔ run.
                </p>
              </div>
            </div>
          )}

          {tab === "task" && (
            <div className="space-y-2">
              <p className="text-xs text-slate">Prompt utama dari panel Mission chat (edit di sana).</p>
              <pre className="max-h-[min(55vh,520px)] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-sm text-slate-100">
                {missionPrompt.trim() || "(kosong — isi di chat)"}
              </pre>
            </div>
          )}

          {tab === "hasil" && (
            <MissionResultsTab
              fleetSummary={fleetSummary}
              specialists={specialists}
              missionPrompt={missionPrompt}
              motherBrief={motherBrief ?? null}
              motherReview={motherReview ?? null}
              centralSkillMd={centralSkillMd ?? null}
              activeMissionId={activeMissionId}
            />
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-4">
          <p className="text-[10px] text-slate">Tip: simpan sebelum Run mission agar konteks &amp; review ikut.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate hover:bg-white/5"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Simpan &amp; tutup
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

type CentralSkillItem = {
  id: string;
  label: string;
  description: string;
  kind: string;
  instructions?: string;
  agentSource?: string;
};

function centralKindIcon(kind: string) {
  const cls = "h-4 w-4 shrink-0";
  if (kind === "touch") return <Search className={`${cls} text-cyan-400`} />;
  if (kind === "generate") return <Wrench className={`${cls} text-amber-400`} />;
  if (kind === "orchestrate") return <Zap className={`${cls} text-violet-400`} />;
  return <Globe className={`${cls} text-slate`} />;
}

function centralKindStyle(kind: string) {
  if (kind === "touch") return "border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10";
  if (kind === "generate") return "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10";
  if (kind === "orchestrate") return "border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10";
  return "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]";
}

function centralKindLabel(kind: string) {
  if (kind === "touch") return "Riset";
  if (kind === "generate") return "Generate";
  if (kind === "orchestrate") return "Orkestrasi";
  return "Skill";
}

function CentralSkillCards({ centralSkillMd, specialists }: { centralSkillMd: string | null; specialists: SpecialistAgentProfile[] }) {
  const [modalSkill, setModalSkill] = useState<CentralSkillItem | null>(null);
  const [kindFilter, setKindFilter] = useState<string | null>(null);

  const allSkills = useMemo((): CentralSkillItem[] => {
    const skills: CentralSkillItem[] = [];
    const seen = new Set<string>();

    for (const agent of specialists) {
      for (const sk of agent.skills ?? []) {
        if (!seen.has(sk.id)) {
          seen.add(sk.id);
          skills.push({
            id: sk.id,
            label: sk.label,
            description: sk.description,
            kind: sk.kind,
            instructions: sk.instructions,
            agentSource: agent.name,
          });
        }
      }
    }

    if (centralSkillMd) {
      const lines = centralSkillMd.split("\n").map((l) => l.trim()).filter(Boolean);
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
          skills.push({ id, label, description: desc || rest, kind });
        }
      }
    }

    return skills;
  }, [centralSkillMd, specialists]);

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sk of allSkills) {
      const k = ["touch", "generate", "orchestrate"].includes(sk.kind) ? sk.kind : "other";
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [allSkills]);

  const filtered = kindFilter ? allSkills.filter((sk) => {
    const k = ["touch", "generate", "orchestrate"].includes(sk.kind) ? sk.kind : "other";
    return k === kindFilter;
  }) : allSkills;

  if (allSkills.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate">Belum ada SKILL.md. Jalankan misi untuk extract skills dari web.</p>
      </div>
    );
  }

  const filterButtons: { kind: string; label: string; color: string; activeColor: string }[] = [
    { kind: "touch", label: "Riset", color: "border-cyan-500/30 text-cyan-400", activeColor: "border-cyan-400 bg-cyan-500/20 text-cyan-300" },
    { kind: "generate", label: "Generate", color: "border-amber-500/30 text-amber-400", activeColor: "border-amber-400 bg-amber-500/20 text-amber-300" },
    { kind: "orchestrate", label: "Orkestrasi", color: "border-violet-500/30 text-violet-400", activeColor: "border-violet-400 bg-violet-500/20 text-violet-300" },
    { kind: "other", label: "Lainnya", color: "border-white/20 text-slate", activeColor: "border-white/40 bg-white/10 text-white" },
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate">
            SKILL Central Agent — {allSkills.length} skills dari {specialists.length} specialist + built-in.
          </p>
          {centralSkillMd?.trim() ? (
            <button
              type="button"
              className="shrink-0 rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-violet-300 hover:bg-white/10"
              onClick={() => void navigator.clipboard.writeText(centralSkillMd)}
            >
              Copy raw
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setKindFilter(null)}
            className={`rounded-full border px-3 py-1 text-[10px] font-semibold transition ${!kindFilter ? "border-white/40 bg-white/10 text-white" : "border-white/15 text-slate hover:bg-white/5"}`}
          >
            Semua ({allSkills.length})
          </button>
          {filterButtons.map((fb) => {
            const count = kindCounts[fb.kind] ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={fb.kind}
                type="button"
                onClick={() => setKindFilter(kindFilter === fb.kind ? null : fb.kind)}
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold transition ${kindFilter === fb.kind ? fb.activeColor : `${fb.color} hover:bg-white/5`}`}
              >
                {fb.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {filtered.map((sk) => (
            <button
              key={sk.id}
              type="button"
              onClick={() => setModalSkill(sk)}
              className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${centralKindStyle(sk.kind)}`}
            >
              {centralKindIcon(sk.kind)}
              <div className="flex-1 min-w-0">
                <span className="block truncate text-xs font-semibold text-white">{sk.label}</span>
                <span className="text-[10px] text-slate">{centralKindLabel(sk.kind)}{sk.agentSource ? ` · ${sk.agentSource}` : ""}</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate" />
            </button>
          ))}
        </div>
      </div>

      {modalSkill && (
        <CentralSkillDetailModal skill={modalSkill} onClose={() => setModalSkill(null)} />
      )}
    </>
  );
}

function CentralSkillDetailModal({ skill, onClose }: { skill: CentralSkillItem; onClose: () => void }) {
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
          {centralKindIcon(skill.kind)}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white">{skill.label}</h3>
            <p className="text-[11px] text-slate">{centralKindLabel(skill.kind)}{skill.agentSource ? ` · dari ${skill.agentSource}` : ""}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate hover:bg-white/10 hover:text-white">
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
                      return <p key={j} className="text-[12px] leading-relaxed text-slate-300">{trimmed}</p>;
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
              className="rounded border border-white/15 bg-white/5 px-3 py-1 text-[10px] text-violet-300 hover:bg-white/10"
            >
              Copy skill
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mission Results Tab — rich structured view + downloadable report  */
/* ------------------------------------------------------------------ */

function generateMissionReportHtml(opts: {
  missionId: string | null;
  missionPrompt: string;
  specialists: SpecialistAgentProfile[];
  fleetSummary: FleetOrchestrationSummary | null;
  motherBrief: string | null;
  motherReview: string | null;
}): string {
  const { missionId, missionPrompt, specialists, fleetSummary, motherBrief, motherReview } = opts;
  const totalSkills = new Set(specialists.flatMap((s) => s.skills.map((sk) => sk.id))).size;
  const totalSubs = specialists.reduce((n, s) => n + (s.subAgents?.length ?? 0), 0);
  const now = new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });

  const agentRows = specialists.map((s) => {
    const subCount = s.subAgents?.length ?? 0;
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;font-weight:600;color:#e2e8f0">${esc(s.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#94a3b8">${esc(s.role)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#94a3b8">${esc(s.canvasLane ?? "general")}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#94a3b8">${s.skills.length}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#94a3b8">${subCount}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#64748b;font-size:12px">${esc(s.purpose.slice(0, 120))}</td>
    </tr>`;
  }).join("\n");

  const subAgentCards = (fleetSummary?.subAgentRuns ?? []).map((run) => {
    const srcColor = run.source === "openclaw" ? "#a78bfa" : run.source === "openai-compat" ? "#38bdf8" : "#64748b";
    const statusIcon = run.source === "skipped" ? "&#10060;" : "&#9989;";
    return `<div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:16px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:16px">${statusIcon}</span>
        <span style="font-weight:700;color:#e2e8f0;font-size:14px">${esc(run.role)}</span>
        <span style="background:${srcColor}22;color:${srcColor};padding:2px 8px;border-radius:100px;font-size:10px;font-weight:600">${esc(run.source)}</span>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin-bottom:8px">${esc(run.focus)}</p>
      <pre style="background:#020617;border:1px solid #1e293b;border-radius:8px;padding:12px;color:#cbd5e1;font-size:11px;white-space:pre-wrap;max-height:300px;overflow:auto">${esc(run.output.slice(0, 3000))}${run.output.length > 3000 ? "\n\n…(truncated)" : ""}</pre>
    </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mission Report — ${esc(missionId ?? "Recursive Agent")}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px 20px}
  .container{max-width:900px;margin:0 auto}
  h1{font-size:28px;font-weight:800;background:linear-gradient(135deg,#a78bfa,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
  h2{font-size:18px;font-weight:700;color:#e2e8f0;margin:32px 0 12px;padding-bottom:8px;border-bottom:1px solid #1e293b}
  h3{font-size:14px;font-weight:600;color:#a78bfa;margin:16px 0 8px}
  .meta{color:#64748b;font-size:12px;margin-bottom:32px}
  .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px}
  .stat{background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:16px;text-align:center}
  .stat-val{font-size:28px;font-weight:800;color:#a78bfa}
  .stat-label{font-size:11px;color:#64748b;margin-top:4px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;padding:8px 12px;border-bottom:2px solid #334155;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px}
  .section-box{background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:16px;margin-bottom:16px}
  .section-box pre{white-space:pre-wrap;font-size:12px;color:#cbd5e1;line-height:1.6}
  .badge{display:inline-block;padding:2px 10px;border-radius:100px;font-size:10px;font-weight:600}
  .footer{margin-top:48px;padding-top:16px;border-top:1px solid #1e293b;text-align:center;color:#475569;font-size:11px}
  @media print{
    body{background:#fff;color:#1e293b;padding:20px}
    h1{-webkit-text-fill-color:#4c1d95;color:#4c1d95}
    h2{color:#1e293b;border-bottom-color:#e2e8f0}
    h3{color:#6d28d9}
    .stat{background:#f8fafc;border-color:#e2e8f0}
    .stat-val{color:#6d28d9}
    .stat-label{color:#64748b}
    .section-box{background:#f8fafc;border-color:#e2e8f0}
    .section-box pre{color:#334155;background:#f1f5f9;border-color:#e2e8f0}
    table{border:1px solid #e2e8f0}
    th{border-bottom-color:#e2e8f0;color:#475569}
    td{color:#334155;border-bottom-color:#f1f5f9}
    pre{max-height:none!important;overflow:visible!important;page-break-inside:avoid}
    .footer{color:#94a3b8;border-top-color:#e2e8f0}
    @page{margin:1cm;size:A4}
  }
</style>
</head>
<body>
<div class="container">
  <h1>Recursive Agent</h1>
  <p class="meta">Mission Report · ${esc(missionId ?? "-")} · ${esc(now)}</p>

  <div class="stat-grid">
    <div class="stat"><div class="stat-val">${specialists.length}</div><div class="stat-label">Specialist Agents</div></div>
    <div class="stat"><div class="stat-val">${totalSubs}</div><div class="stat-label">Sub-agents</div></div>
    <div class="stat"><div class="stat-val">${totalSkills}</div><div class="stat-label">Skills Extracted</div></div>
    <div class="stat"><div class="stat-val">${fleetSummary?.subAgentRuns.length ?? 0}</div><div class="stat-label">Fleet Runs</div></div>
  </div>

  <h2>Mission Prompt</h2>
  <div class="section-box"><pre>${esc(missionPrompt || "(kosong)")}</pre></div>

  ${motherBrief ? `<h2>Central Agent Brief</h2><div class="section-box"><pre>${esc(motherBrief)}</pre></div>` : ""}

  <h2>Squad Composition</h2>
  <table>
    <thead><tr><th>Agent</th><th>Role</th><th>Lane</th><th>Skills</th><th>Subs</th><th>Purpose</th></tr></thead>
    <tbody>${agentRows}</tbody>
  </table>

  ${subAgentCards ? `<h2>Fleet Execution Results</h2>${subAgentCards}` : ""}

  ${motherReview ? `<h2>Quality Review</h2><div class="section-box"><pre>${esc(motherReview)}</pre></div>` : ""}

  ${fleetSummary?.mergedReport ? `<h2>Merged Report</h2><div class="section-box"><pre>${esc(fleetSummary.mergedReport.slice(0, 12000))}${fleetSummary.mergedReport.length > 12000 ? "\n\n…(truncated)" : ""}</pre></div>` : ""}

  <div class="footer">
    Generated by <strong>Recursive Agent</strong> — Central Agent Orchestrator<br>
    ${esc(now)}
  </div>
</div>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function MissionResultsTab({
  fleetSummary,
  specialists,
  missionPrompt,
  motherBrief,
  motherReview,
  centralSkillMd,
  activeMissionId,
}: {
  fleetSummary: FleetOrchestrationSummary | null;
  specialists: SpecialistAgentProfile[];
  missionPrompt: string;
  motherBrief: string | null;
  motherReview: string | null;
  centralSkillMd: string | null;
  activeMissionId?: string | null;
}) {
  const [showRawReport, setShowRawReport] = useState(false);

  const hasResults = specialists.length > 0;
  const totalSkills = new Set(specialists.flatMap((s) => s.skills.map((sk) => sk.id))).size;
  const totalSubs = specialists.reduce((n, s) => n + (s.subAgents?.length ?? 0), 0);

  const handleDownloadPdf = () => {
    const html = generateMissionReportHtml({
      missionId: activeMissionId ?? null,
      missionPrompt,
      specialists,
      fleetSummary,
      motherBrief,
      motherReview,
    });
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      win.print();
    }, 600);
  };

  const handleDownloadHtml = () => {
    const html = generateMissionReportHtml({
      missionId: activeMissionId ?? null,
      missionPrompt,
      specialists,
      fleetSummary,
      motherBrief,
      motherReview,
    });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mission-report-${activeMissionId ?? "draft"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasResults) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Layers className="h-10 w-10 text-slate/40" />
        <p className="text-sm text-slate">Belum ada hasil misi.</p>
        <p className="text-xs text-slate/60">Jalankan misi dari chat panel untuk melihat hasil di sini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { val: specialists.length, label: "Agents", color: "text-violet-400" },
          { val: totalSubs, label: "Sub-agents", color: "text-cyan-400" },
          { val: totalSkills, label: "Skills", color: "text-amber-400" },
          { val: fleetSummary?.subAgentRuns.length ?? 0, label: "Fleet runs", color: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-[10px] text-slate">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Download button */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="flex items-center gap-1.5 rounded-xl bg-violet-500/20 border border-violet-500/30 px-4 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-500/30 transition"
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </button>
        <button
          type="button"
          onClick={handleDownloadHtml}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate hover:bg-white/10 transition"
        >
          <Download className="h-3.5 w-3.5" />
          Download HTML
        </button>
        <button
          type="button"
          onClick={() => {
            const md = buildMarkdownReport({ missionId: activeMissionId ?? null, missionPrompt, specialists, fleetSummary, motherBrief, motherReview });
            void navigator.clipboard.writeText(md);
          }}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate hover:bg-white/10 transition"
        >
          Copy Markdown
        </button>
      </div>

      {/* Central Agent Brief */}
      {motherBrief && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-violet-400">Central Agent Brief</h4>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200">{motherBrief.slice(0, 2000)}</p>
          </div>
        </div>
      )}

      {/* Squad composition */}
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-400">Squad Composition</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {specialists.map((s, idx) => (
            <div key={`${s.name}-${s.persistedId ?? idx}`} className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2 w-2 rounded-full ${s.canvasLane === "frontend" ? "bg-amber-400" : s.canvasLane === "backend" ? "bg-cyan-400" : "bg-slate"}`} />
                <span className="text-xs font-bold text-white">{s.name}</span>
                <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-slate">{s.canvasLane ?? "general"}</span>
              </div>
              <p className="text-[11px] text-slate mb-1">{s.role} — {s.purpose.slice(0, 100)}</p>
              <div className="flex gap-3 text-[10px] text-slate/70">
                <span>{s.skills.length} skills</span>
                <span>{s.subAgents?.length ?? 0} sub-agents</span>
                <span>{s.orchestrationMode}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fleet execution results */}
      {fleetSummary && fleetSummary.subAgentRuns.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-400">Fleet Execution</h4>
          <div className="space-y-2">
            {fleetSummary.subAgentRuns.map((run, i) => {
              const isSkipped = run.source === "skipped";
              return (
                <details key={run.id ?? i} className="group rounded-xl border border-white/10 bg-black/30">
                  <summary className="flex cursor-pointer items-center gap-2 p-3 text-xs">
                    {isSkipped
                      ? <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    }
                    <span className="font-bold text-white">{run.role}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                      run.source === "openclaw" ? "bg-violet-500/20 text-violet-300" :
                      run.source === "openai-compat" ? "bg-cyan-500/20 text-cyan-300" :
                      "bg-red-500/20 text-red-300"
                    }`}>{run.source}</span>
                    <span className="ml-auto text-[10px] text-slate">{run.focus.slice(0, 60)}</span>
                    <ChevronDown className="h-3 w-3 text-slate transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-white/5 p-3">
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-black/50 p-2 font-mono text-[11px] text-slate-200">
                      {run.output.slice(0, 4000)}{run.output.length > 4000 ? "\n\n…(truncated)" : ""}
                    </pre>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* Quality Review */}
      {motherReview && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-400">Quality Review</h4>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200">{motherReview.slice(0, 4000)}</pre>
          </div>
        </div>
      )}

      {/* Raw merged report toggle */}
      {fleetSummary?.mergedReport && (
        <div>
          <button
            type="button"
            onClick={() => setShowRawReport(!showRawReport)}
            className="flex items-center gap-1 text-[11px] text-slate hover:text-white transition"
          >
            <ChevronRight className={`h-3 w-3 transition ${showRawReport ? "rotate-90" : ""}`} />
            {showRawReport ? "Sembunyikan" : "Lihat"} raw merged report
          </button>
          {showRawReport && (
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[11px] text-slate-300">
              {fleetSummary.mergedReport}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function buildMarkdownReport(opts: {
  missionId: string | null;
  missionPrompt: string;
  specialists: SpecialistAgentProfile[];
  fleetSummary: FleetOrchestrationSummary | null;
  motherBrief: string | null;
  motherReview: string | null;
}): string {
  const { missionId, missionPrompt, specialists, fleetSummary, motherBrief, motherReview } = opts;
  const totalSkills = new Set(specialists.flatMap((s) => s.skills.map((sk) => sk.id))).size;
  const totalSubs = specialists.reduce((n, s) => n + (s.subAgents?.length ?? 0), 0);
  const lines: string[] = [
    "# Recursive Agent — Mission Report",
    "",
    `**Mission ID:** ${missionId ?? "-"}`,
    `**Date:** ${new Date().toLocaleString()}`,
    `**Agents:** ${specialists.length} | **Sub-agents:** ${totalSubs} | **Skills:** ${totalSkills}`,
    "",
    "## Mission Prompt",
    "",
    missionPrompt || "(kosong)",
    "",
  ];

  if (motherBrief) {
    lines.push("## Central Agent Brief", "", motherBrief, "");
  }

  lines.push("## Squad", "");
  lines.push("| Agent | Role | Lane | Skills | Subs |", "|-------|------|------|--------|------|");
  for (const s of specialists) {
    lines.push(`| ${s.name} | ${s.role} | ${s.canvasLane ?? "general"} | ${s.skills.length} | ${s.subAgents?.length ?? 0} |`);
  }
  lines.push("");

  if (fleetSummary) {
    lines.push("## Fleet Execution", "");
    for (const run of fleetSummary.subAgentRuns) {
      lines.push(`### ${run.role} (${run.source})`, "", `**Focus:** ${run.focus}`, "", "```", run.output.slice(0, 4000), "```", "");
    }
  }

  if (motherReview) {
    lines.push("## Quality Review", "", motherReview, "");
  }

  lines.push("---", "", "*Generated by Recursive Agent*");
  return lines.join("\n");
}
