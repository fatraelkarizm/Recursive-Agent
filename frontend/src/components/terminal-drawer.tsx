import type { ChatMessage } from "@/lib/types";

type TerminalDrawerProps = {
  events?: ChatMessage[];
};

export function TerminalDrawer({ events }: TerminalDrawerProps) {
  const latest = events?.[0];

  return (
    <section className="rounded-xl border border-slate/40 bg-black/40 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-electric">Terminal / audit</h2>
      {latest ? (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/50 p-3 text-[11px] leading-relaxed text-slate">
          {latest.content}
        </pre>
      ) : (
        <p className="text-sm text-slate">Structured worker logs will mirror the latest assistant handoff here.</p>
      )}
    </section>
  );
}
