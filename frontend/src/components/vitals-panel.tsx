type VitalsPanelProps = {
  status: string;
};

export function VitalsPanel({ status }: VitalsPanelProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-black/30 p-4 shadow-inner shadow-black/30 sm:p-5">
      <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate">Vitals</h2>
      <p className="mb-4 text-sm font-semibold text-white">Mission health</p>
      <ul className="space-y-2.5 text-sm text-slate">
        <li className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <span className="text-xs text-slate">Status</span>
          <span className="font-medium text-electric">{status || "idle"}</span>
        </li>
        <li className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <span className="text-xs text-slate">Token budget</span>
          <span className="text-[11px] text-slate">Belum di-wire</span>
        </li>
        <li className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <span className="text-xs text-slate">Tool calls</span>
          <span className="text-[11px] text-slate">Lihat events misi</span>
        </li>
      </ul>
    </section>
  );
}
