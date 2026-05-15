"use client";

import type { MissionProgressEvent } from "@/lib/types";
import type { MotherMissionBundle } from "@/components/mother-agent-modal";

type KnowledgePanelProps = {
  bundle: MotherMissionBundle;
  motherBrief: string | null;
  motherReview?: string | null;
  squadSource: string | null;
  progress: MissionProgressEvent[];
  agentCount?: number;
};

export function KnowledgePanel({
  bundle,
  motherBrief,
  motherReview,
  squadSource,
  progress,
  agentCount = 0
}: KnowledgePanelProps) {
  const hasContext = Boolean(bundle.contextNotes?.trim());
  const urls = bundle.referenceUrlsText
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter(Boolean);
  const hasReview = Boolean(bundle.motherReviewNotes?.trim());

  return (
    <section className="flex h-full min-h-[200px] flex-col rounded-xl border border-white/10 bg-[#0c1a2e]/80 shadow-inner">
      <header className="border-b border-white/10 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-electric/80">Knowledge</p>
        <h3 className="text-sm font-semibold text-white">Konteks Mother & misi</h3>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-xs leading-relaxed">
        {motherBrief ? (
          <article className="rounded-lg border border-violet-400/25 bg-violet-500/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">Mother brief</p>
            <p className="mt-1.5 whitespace-pre-wrap text-slate/95">{motherBrief}</p>
            {squadSource ? (
              <p className="mt-2 text-[10px] text-slate/70">Sumber squad: {squadSource}</p>
            ) : null}
          </article>
        ) : (
          <p className="text-slate/80">Jalankan mission — Mother akan menulis ringkasan pemikiran di sini.</p>
        )}

        {motherReview ? (
          <article className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-100/90">
              Mother review
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-slate/95">{motherReview}</p>
          </article>
        ) : null}

        {agentCount > 0 ? (
          <p className="text-[10px] text-slate/70">
            {agentCount} agent di canvas (persisten — tidak hilang saat refresh).
          </p>
        ) : null}

        {hasContext ? (
          <article className="rounded-lg border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate">Konteks user</p>
            <p className="mt-1.5 whitespace-pre-wrap text-slate/90">{bundle.contextNotes}</p>
          </article>
        ) : null}

        {urls.length > 0 ? (
          <article className="rounded-lg border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate">URL referensi</p>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-electric/90">
              {urls.map((u) => (
                <li key={u} className="truncate">
                  {u}
                </li>
              ))}
            </ul>
          </article>
        ) : null}

        {hasReview ? (
          <article className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-100/90">Review / iterasi</p>
            <p className="mt-1.5 whitespace-pre-wrap text-slate/90">{bundle.motherReviewNotes}</p>
          </article>
        ) : null}

        {progress.length > 0 ? (
          <article className="rounded-lg border border-electric/20 bg-electric/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-electric/90">Timeline proses</p>
            <ol className="mt-2 space-y-1.5">
              {progress.map((p, i) => (
                <li
                  key={`${p.at}-${p.phase}-${i}-${p.label}`}
                  className="flex flex-col gap-0.5 border-l border-electric/30 pl-2"
                >
                  <span className="font-medium text-white/90">{p.label}</span>
                  {p.detail ? <span className="text-[10px] text-slate/75 line-clamp-2">{p.detail}</span> : null}
                </li>
              ))}
            </ol>
          </article>
        ) : null}
      </div>
    </section>
  );
}
