type VitalsPanelProps = {
  status: string;
};

export function VitalsPanel({ status }: VitalsPanelProps) {
  return (
    <section className="rounded-xl border border-slate/40 bg-slate-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-electric">Vitals</h2>
      <ul className="space-y-1 text-sm text-slate">
        <li>Mission Status: {status || "idle"}</li>
        <li>Token Budget: Pending config</li>
        <li>Tool Calls: Pending integration</li>
      </ul>
    </section>
  );
}
