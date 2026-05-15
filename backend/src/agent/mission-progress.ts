export type MotherPhase =
  | "mother-planning"
  | "mother-spawn"
  | "mother-review"
  | "specialist-readme"
  | "fleet-run"
  | "fleet-merge"
  | "tools"
  | "persist"
  | "done"
  | "error";

export type MissionProgressEvent = {
  phase: MotherPhase;
  label: string;
  detail?: string;
  at: string;
  agentName?: string;
  /** Streamed specialist profile — frontend should add to canvas immediately. */
  specialist?: unknown;
  /** Streamed fleet sub-agent run result — frontend can build fleetSummary incrementally. */
  fleetRun?: { id: string; role: string; focus: string; output: string; source: string };
};

export type MissionProgressEmitter = (event: MissionProgressEvent) => void;

export function createProgressEmitter(
  onEvent?: MissionProgressEmitter
): (event: Omit<MissionProgressEvent, "at">) => void {
  return (event) => {
    onEvent?.({
      ...event,
      at: new Date().toISOString()
    });
  };
}
