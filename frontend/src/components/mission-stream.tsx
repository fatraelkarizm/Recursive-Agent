type MissionStreamProps = {
  prompt: string;
  status: string;
};

export function MissionStream({ prompt, status }: MissionStreamProps) {
  return (
    <section className="rounded-xl border border-slate/40 bg-slate-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-electric">Mission Stream</h2>
      <p className="text-sm text-slate">Prompt: {prompt || "No mission yet"}</p>
      <p className="text-sm text-slate">Status: {status || "idle"}</p>
    </section>
  );
}
