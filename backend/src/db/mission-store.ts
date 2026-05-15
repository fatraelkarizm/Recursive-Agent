import type { MissionResult } from "../types";
import { getPrismaClient } from "./prisma";

function buildMissionResultPayload(result: MissionResult): {
  specialists: MissionResult["profile"][];
  fleetSummary: MissionResult["fleetSummary"];
  savedAt: string;
} {
  return {
    specialists: result.specialists ?? [result.profile],
    fleetSummary: result.fleetSummary ?? undefined,
    savedAt: new Date().toISOString()
  };
}

type MissionStoreClient = {
  mission: {
    upsert(args: unknown): Promise<unknown>;
  };
  specialistProfile: {
    upsert(args: unknown): Promise<unknown>;
  };
  missionEvent: {
    deleteMany(args: unknown): Promise<unknown>;
    createMany(args: unknown): Promise<unknown>;
  };
};

type PersistMissionInput = {
  prompt: string;
  result: MissionResult;
  db?: MissionStoreClient | null;
};

type PersistMissionOutcome = {
  persisted: boolean;
  reason?: string;
};

export async function persistMissionResult({
  prompt,
  result,
  db = getPrismaClient()
}: PersistMissionInput): Promise<PersistMissionOutcome> {
  if (!db) {
    return {
      persisted: false,
      reason: "DATABASE_URL is not configured"
    };
  }

  const completedAt = result.status === "completed" || result.status === "failed" ? new Date() : null;

  await db.mission.upsert({
    where: { id: result.missionId },
    create: {
      id: result.missionId,
      prompt,
      status: result.status,
      completedAt,
      resultPayload: buildMissionResultPayload(result)
    },
    update: {
      prompt,
      status: result.status,
      completedAt,
      resultPayload: buildMissionResultPayload(result)
    }
  });

  await db.specialistProfile.upsert({
    where: { missionId: result.missionId },
    create: {
      missionId: result.missionId,
      name: result.profile.name,
      role: result.profile.role,
      purpose: result.profile.purpose,
      profileJson: result.profile
    },
    update: {
      name: result.profile.name,
      role: result.profile.role,
      purpose: result.profile.purpose,
      profileJson: result.profile
    }
  });

  await db.missionEvent.deleteMany({
    where: { missionId: result.missionId }
  });

  if (result.events.length > 0) {
    await db.missionEvent.createMany({
      data: result.events.map((message, sequence) => ({
        missionId: result.missionId,
        sequence,
        message
      }))
    });
  }

  return { persisted: true };
}
