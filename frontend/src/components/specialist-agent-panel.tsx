import type { SpecialistAgentProfile } from "@/lib/types";

type SpecialistAgentPanelProps = {
  profile: SpecialistAgentProfile;
  variant?: "card" | "embedded";
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
      </div>
    </aside>
  );
}
