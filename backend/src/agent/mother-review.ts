import type { FleetOrchestrationSummary, SpecialistAgentProfile } from "../types";
import { isOpenAiCompatConfigured, openAiCompatibleChatCompletion } from "../compat/openai-compatible-chat";
import { logger } from "../logging";

export type MotherAgentVerdict = {
  agentName: string;
  verdict: "pass" | "rework";
  instructions?: string;
};

export type MotherQualityReview = {
  reviewMarkdown: string;
  verdicts: MotherAgentVerdict[];
};

function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  let depth = 0;
  let end = -1;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === "{") depth++;
    else if (candidate[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (start === -1 || end === -1) throw new Error("No JSON in Central Agent review");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Central Agent reviews each specialist deliverable and can request rework (second pass).
 */
export async function runMotherQualityReview(params: {
  missionPrompt: string;
  squad: SpecialistAgentProfile[];
  fleetSummary?: FleetOrchestrationSummary;
}): Promise<MotherQualityReview> {
  const fallback: MotherQualityReview = {
    reviewMarkdown: "_Central review dilewati (gateway tidak tersedia)._",
    verdicts: params.squad.map((s) => ({ agentName: s.name, verdict: "pass" as const }))
  };

  if (!isOpenAiCompatConfigured()) return fallback;

  const agentSummaries = params.squad
    .map((s) => {
      const readmeSnippet = s.readmeMd.slice(0, 1200);
      return `### ${s.name} (${s.role})\nPurpose: ${s.purpose}\nREADME excerpt:\n${readmeSnippet}`;
    })
    .join("\n\n");

  const fleetBlock = params.fleetSummary?.mergedReport
    ? `\n\nFleet merged report:\n${params.fleetSummary.mergedReport.slice(0, 4000)}`
    : "";

  try {
    const motherTimeout = Number(process.env.MOTHER_LLM_TIMEOUT_MS ?? "120000");
    const raw = await openAiCompatibleChatCompletion({
      messages: [
        {
          role: "system",
          content: [
            "You are the Central Agent — senior reviewer. You are smarter than the specialists.",
            "Review each specialist output against the user mission.",
            "Return ONLY JSON:",
            '{ "reviewMarkdown": "Indonesian markdown summary for the user",',
            '  "verdicts": [{ "agentName": "exact name", "verdict": "pass|rework", "instructions": "if rework, precise fix list" }] }',
            "Use rework when the generated agent package is too generic, missing actionable SKILL.md guidance, has unsafe/irrelevant tools, or cannot be reused. Sample deliverables are secondary proof of work."
          ].join(" ")
        },
        {
          role: "user",
          content: `Mission:\n${params.missionPrompt.slice(0, 3000)}\n\nSpecialists:\n${agentSummaries}${fleetBlock}`
        }
      ],
      maxTokens: 1800,
      temperature: 0.3,
      timeoutMs: Number.isFinite(motherTimeout) && motherTimeout > 10_000 ? motherTimeout : 120_000
    });

    const data = extractJsonObject(raw) as {
      reviewMarkdown?: string;
      verdicts?: MotherAgentVerdict[];
    };

    return {
      reviewMarkdown: (data.reviewMarkdown ?? "_Review selesai._").trim(),
      verdicts: Array.isArray(data.verdicts) ? data.verdicts : fallback.verdicts
    };
  } catch (err) {
    logger.warn({ err }, "Central Agent quality review failed");
    return fallback;
  }
}
