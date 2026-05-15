import type { SpecialistAgentProfile } from "../types";
import { getPrismaClient } from "./prisma";

export type StoredCanvasAgent = {
  id: string;
  missionId: string | null;
  profile: SpecialistAgentProfile;
  createdAt: string;
};

function profileFromRow(row: {
  id: string;
  missionId: string | null;
  name: string;
  role: string;
  purpose: string;
  profileJson: unknown;
  createdAt: Date;
}): StoredCanvasAgent {
  const base =
    row.profileJson && typeof row.profileJson === "object"
      ? (row.profileJson as SpecialistAgentProfile)
      : ({
          name: row.name,
          role: row.role,
          purpose: row.purpose,
          systemInstructions: "",
          allowedTools: [],
          outputFormat: "markdown",
          apiKeyRefs: [],
          notes: "",
          specializations: ["core-mission"],
          orchestrationMode: "local",
          skills: [],
          readmeMd: ""
        } satisfies SpecialistAgentProfile);

  return {
    id: row.id,
    missionId: row.missionId,
    createdAt: row.createdAt.toISOString(),
    profile: {
      ...base,
      name: row.name,
      role: row.role,
      purpose: row.purpose,
      persistedId: row.id,
      missionId: row.missionId ?? undefined
    }
  };
}

export async function listCanvasAgents(): Promise<StoredCanvasAgent[]> {
  const db = getPrismaClient();
  if (!db) return [];

  const rows = await db.canvasAgent.findMany({
    orderBy: { createdAt: "asc" },
    take: 48
  });
  return rows.map(profileFromRow);
}

/** Save each specialist from a mission as its own canvas row (never overwrites prior agents). */
export async function persistCanvasAgentsFromMission(
  missionId: string,
  specialists: SpecialistAgentProfile[]
): Promise<SpecialistAgentProfile[]> {
  const db = getPrismaClient();
  if (!db) {
    return specialists.map((p) => ({ ...p, missionId }));
  }

  const out: SpecialistAgentProfile[] = [];
  for (const spec of specialists) {
    if (spec.role === "pending" && spec.name === "Pending Agent") continue;

    const row = await db.canvasAgent.create({
      data: {
        missionId,
        name: spec.name,
        role: spec.role,
        purpose: spec.purpose,
        profileJson: { ...spec, missionId, persistedId: undefined }
      }
    });
    out.push({
      ...spec,
      persistedId: row.id,
      missionId
    });
  }
  return out;
}

export async function updateCanvasAgentProfile(
  agentId: string,
  profile: SpecialistAgentProfile
): Promise<void> {
  const db = getPrismaClient();
  if (!db) return;
  await db.canvasAgent.update({
    where: { id: agentId },
    data: {
      name: profile.name,
      role: profile.role,
      purpose: profile.purpose,
      profileJson: profile
    }
  });
}

export async function deleteCanvasAgent(agentId: string): Promise<boolean> {
  const db = getPrismaClient();
  if (!db) return false;
  try {
    await db.canvasAgent.delete({ where: { id: agentId } });
    return true;
  } catch {
    return false;
  }
}

export async function deleteAllCanvasAgents(): Promise<number> {
  const db = getPrismaClient();
  if (!db) return 0;
  const res = await db.canvasAgent.deleteMany({});
  return res.count;
}

/** Remove agents not tied to the given mission (keeps current mission squad on canvas). */
export async function deleteCanvasAgentsExceptMission(missionId: string): Promise<number> {
  const db = getPrismaClient();
  if (!db) return 0;
  const res = await db.canvasAgent.deleteMany({
    where: { NOT: { missionId } }
  });
  return res.count;
}

export async function updateCanvasAgentPosition(
  agentId: string,
  position: { x: number; y: number }
): Promise<boolean> {
  const db = getPrismaClient();
  if (!db) return false;

  const row = await db.canvasAgent.findUnique({ where: { id: agentId } });
  if (!row) return false;

  const base =
    row.profileJson && typeof row.profileJson === "object"
      ? (row.profileJson as SpecialistAgentProfile)
      : ({} as SpecialistAgentProfile);

  const profile: SpecialistAgentProfile = {
    ...base,
    name: row.name,
    role: row.role,
    purpose: row.purpose,
    canvasPosition: position,
    persistedId: agentId
  };

  await db.canvasAgent.update({
    where: { id: agentId },
    data: { profileJson: profile }
  });
  return true;
}
