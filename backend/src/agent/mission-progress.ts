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
};

export type MissionProgressEmitter = (event: Omit<MissionProgressEvent, "at">) => void;

export function createProgressEmitter(onEvent?: MissionProgressEmitter): MissionProgressEmitter {
  return (event) => {
    onEvent?.({
      ...event,
      at: new Date().toISOString()
    });
  };
}
