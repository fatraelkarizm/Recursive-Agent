"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Globe, Layers, Loader2, Search, Wrench, X, Zap } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { MotherAgentManagement } from "@/components/mother-agent-management";
import { fetchRuntimeDiagnostics, fetchTelegramStatus, previewExtract, startTelegramBot, stopTelegramBot, type TelegramBotStatus } from "@/lib/api";
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
  centralReadmeMd
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
            <div className="space-y-4">
              {fleetSummary?.mergedReport ? (
                <>
                  <p className="text-xs text-slate">Laporan gabungan fleet → Central Agent (ringkas).</p>
                  <pre className="max-h-[min(48vh,440px)] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[12px] text-slate-100">
                    {fleetSummary.mergedReport.slice(0, 8000)}
                    {fleetSummary.mergedReport.length > 8000 ? "\n\n…(potong)" : ""}
                  </pre>
                  <p className="text-[10px] text-slate">
                    Lead: <span className="text-white">{lead?.name ?? "—"}</span> — buka dashboard specialist untuk
                    SKILL.md / README / sample output penuh.
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate">Belum ada hasil fleet. Jalankan misi dari chat.</p>
              )}
            </div>
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

  if (allSkills.length === 0) {
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
            SKILL Central Agent — {allSkills.length} skills dari {specialists.length} specialist + web extraction.
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

        <div className="grid gap-2 sm:grid-cols-3">
          {allSkills.map((sk) => (
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
