"use client";

import { useEffect, useState } from "react";
import { BookOpen, Layers, Loader2, X } from "lucide-react";
import { MotherAgentManagement } from "@/components/mother-agent-management";
import { fetchRuntimeDiagnostics, previewExtract } from "@/lib/api";
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

type TabId = "overview" | "agents" | "config" | "services" | "context" | "task" | "hasil";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Ringkas" },
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
  agentsBusy
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
