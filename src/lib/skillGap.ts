import { getFunctionErrorMessage } from "./apiErrors";
import { supabase } from "./supabase";
import type { GitHubIssue, SkillGapAnalysis, SkillGapConfidence, SkillGapStatus } from "../types/domain";

function isSkillGapAnalysis(value: unknown): value is SkillGapAnalysis {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const analysis = value as Record<string, unknown>;
  if (!Array.isArray(analysis.skills) || !Array.isArray(analysis.recommended_preparation)) return false;
  if (
    !analysis.difficulty ||
    typeof analysis.difficulty !== "object" ||
    !["Beginner", "Intermediate", "Advanced"].includes((analysis.difficulty as Record<string, unknown>).level as string) ||
    typeof (analysis.difficulty as Record<string, unknown>).explanation !== "string"
  ) return false;

  const statuses: SkillGapStatus[] = ["Known", "Needs Practice", "Learn"];
  const confidences: SkillGapConfidence[] = ["High", "Medium", "Low"];
  return analysis.skills.every((skill) =>
    skill !== null &&
    typeof skill === "object" &&
    !Array.isArray(skill) &&
    typeof (skill as Record<string, unknown>).name === "string" &&
    statuses.includes((skill as Record<string, unknown>).status as SkillGapStatus) &&
    confidences.includes((skill as Record<string, unknown>).confidence as SkillGapConfidence) &&
    typeof (skill as Record<string, unknown>).why_relevant === "string" &&
    typeof (skill as Record<string, unknown>).profile_note === "string"
  ) && analysis.recommended_preparation.every((step) =>
    step !== null &&
    typeof step === "object" &&
    !Array.isArray(step) &&
    typeof (step as Record<string, unknown>).skill === "string" &&
    typeof (step as Record<string, unknown>).topic === "string" &&
    typeof (step as Record<string, unknown>).exercise === "string" &&
    Array.isArray((step as Record<string, unknown>).documentation) &&
    ((step as Record<string, unknown>).documentation as unknown[]).every((doc) =>
      doc !== null &&
      typeof doc === "object" &&
      !Array.isArray(doc) &&
      typeof (doc as Record<string, unknown>).label === "string" &&
      typeof (doc as Record<string, unknown>).url === "string"
    )
  );
}

export async function analyzeSkillGap(
  issue: Pick<GitHubIssue, "owner" | "repository" | "number">,
  simplifiedExplanation?: string | null,
): Promise<SkillGapAnalysis> {
  if (!supabase) throw new Error("Connect Supabase before analyzing a skill gap.");
  const { data, error } = await supabase.functions.invoke<{ analysis: SkillGapAnalysis }>("analyze-skill-gap", {
    body: {
      owner: issue.owner,
      repo: issue.repository,
      number: issue.number,
      simplifiedExplanation: simplifiedExplanation ?? null,
    },
  });
  if (error) {
    const message = await getFunctionErrorMessage(error.message, error.context);
    throw new Error(message || "The Skill Gap Analyzer could not complete the request.");
  }
  if (!data || !isSkillGapAnalysis(data.analysis)) {
    throw new Error("The Skill Gap Analyzer returned an invalid response.");
  }
  return data.analysis;
}
