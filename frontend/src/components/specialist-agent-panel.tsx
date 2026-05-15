"use client";

import type { SpecialistAgentProfile, SpecialistSkill } from "@/lib/types";

type SpecialistAgentPanelProps = {
  profile: SpecialistAgentProfile;
  variant?: "card" | "embedded";
};

const kindStyles: Record<SpecialistSkill["kind"], string> = {
  touch: "border-sky-500/40 bg-sky-950/50 text-sky-100",
  generate: "border-emerald-500/40 bg-emerald-950/40 text-emerald-100",
  orchestrate: "border-violet-500/40 bg-violet-950/40 text-violet-100",
  other: "border-white/20 bg-white/5 text-slate"
};

export function SpecialistAgentPanel({ profile, variant = "card" }: SpecialistAgentPanelProps) {
  const shell =
    variant === "embedded"
      ? "rounded-lg border border-white/10 bg-slate-950/70 p-3"
      : "rounded-xl border border-slate/40 bg-slate-900/60 p-4";

  return (
    <aside className={shell}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-electric">Generated specialist</h2>
      <div className="space-y-2 text-xs leading-relaxed">
        <p>
          <span className="text-slate">Name:</span> <span className="text-white">{profile.name}</span>
        </p>
        <p>
          <span className="text-slate">Role:</span> <span className="text-white">{profile.role}</span>
        </p>
        <p>
          <span className="text-slate">Purpose:</span> <span className="text-white">{profile.purpose}</span>
        </p>

        <div>
          <span className="text-slate">Skills</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(profile.skills ?? []).length ? (
              profile.skills.map((s) => (
                <span
                  key={s.id}
                  title={s.description}
                  className={`inline-block max-w-full truncate rounded border px-2 py-0.5 text-[10px] font-medium ${kindStyles[s.kind]}`}
                >
                  {s.label}
                </span>
              ))
            ) : (
              <span className="text-slate">—</span>
            )}
          </div>
        </div>

        <p>
          <span className="text-slate">Tools:</span>{" "}
          <span className="text-white">{profile.allowedTools.join(", ") || "none"}</span>
        </p>
        <p>
          <span className="text-slate">Output:</span> <span className="text-white">{profile.outputFormat}</span>
        </p>
        <p>
          <span className="text-slate">API refs:</span>{" "}
          <span className="text-white">{profile.apiKeyRefs.join(", ") || "none"}</span>
        </p>
        {profile.systemInstructions ? (
          <p>
            <span className="text-slate">Instructions:</span>{" "}
            <span className="text-white">{profile.systemInstructions}</span>
          </p>
        ) : null}
        <p>
          <span className="text-slate">Orchestration:</span>{" "}
          <span className="text-white">{profile.orchestrationMode}</span>
        </p>
        <p>
          <span className="text-slate">Specializations:</span>{" "}
          <span className="text-white">{profile.specializations?.join(", ") || "—"}</span>
        </p>
        {profile.subAgents?.length ? (
          <div>
            <span className="text-slate">Sub-agents (OpenClaw fleet):</span>
            <ul className="mt-1 list-inside list-disc text-white">
              {profile.subAgents.map((s) => (
                <li key={s.id}>
                  <span className="font-mono text-[11px] text-electric">{s.id}</span> — {s.role}: {s.focus}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {profile.readmeMd && variant === "embedded" ? (
          <p className="border-t border-white/10 pt-2 text-[10px] leading-relaxed text-slate">
            README.md (HTML/CSS & artefak) ada di{" "}
            <span className="font-medium text-electric">Dashboard</span> → tab{" "}
            <span className="font-medium text-electric">README.md</span>, atau klik node di canvas.
          </p>
        ) : null}
        {profile.readmeMd && variant !== "embedded" ? (
          <div className="border-t border-white/10 pt-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-slate">README.md (Central-generated)</span>
              <button
                type="button"
                className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-electric hover:bg-white/10"
                onClick={() => void navigator.clipboard.writeText(profile.readmeMd)}
              >
                Copy
              </button>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-black/40 p-2 font-mono text-[10px] leading-relaxed text-slate-100">
              {profile.readmeMd}
            </pre>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
