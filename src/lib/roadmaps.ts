import { supabase } from "./supabase";
import type { ContributionRoadmap, GitHubIssue, SavedContributionRoadmap } from "../types/domain";
import type { IssueSimplification } from "./issues";
import { getFunctionErrorMessage } from "./apiErrors";

const roadmapStepTitles = [
  "Understand the issue and acceptance criteria",
  "Read the README and contribution guidelines",
  "Explore the codebase and identify files to inspect",
  "Plan the implementation",
  "Implement and review the changes",
  "Run appropriate tests and checks",
  "Prepare a pull request",
];

function isRoadmap(value: unknown): value is ContributionRoadmap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const roadmap = value as Record<string, unknown>;
  return roadmap.generated_by === "ai" &&
    roadmap.suggestions_unverified === true &&
    Array.isArray(roadmap.steps) &&
    roadmap.steps.length === roadmapStepTitles.length &&
    roadmap.steps.every((step, index) =>
      step !== null &&
      typeof step === "object" &&
      !Array.isArray(step) &&
      (step as Record<string, unknown>).title === roadmapStepTitles[index] &&
      typeof (step as Record<string, unknown>).explanation === "string" &&
      ((step as Record<string, unknown>).explanation as string).trim().length > 0 &&
      ((step as Record<string, unknown>).explanation as string).length <= 1200 &&
      Array.isArray((step as Record<string, unknown>).tasks) &&
      ((step as Record<string, unknown>).tasks as unknown[]).length > 0 &&
      ((step as Record<string, unknown>).tasks as unknown[]).length <= 8 &&
      ((step as Record<string, unknown>).tasks as unknown[]).every((task) =>
        typeof task === "string" && task.trim().length > 0 && task.length <= 500
      ) &&
      typeof (step as Record<string, unknown>).completed === "boolean"
    );
}

export async function generateContributionRoadmap(
  issue: GitHubIssue,
  simplification?: IssueSimplification | null,
): Promise<ContributionRoadmap> {
  if (!supabase) throw new Error("Connect Supabase before requesting a contribution roadmap.");
  const { data, error } = await supabase.functions.invoke<{ roadmap: ContributionRoadmap }>("generate-roadmap", {
    body: {
      owner: issue.owner,
      repo: issue.repository,
      number: issue.number,
      simplifiedExplanation: simplification
        ? [
            simplification.problem_plain_english,
            simplification.what_needs_to_be_done,
            simplification.why_it_matters,
            simplification.expected_outcome,
            ...simplification.technical_terms.map(({ term, explanation }) => `${term}: ${explanation}`),
          ].join("\n")
        : null,
    },
  });
  if (error) {
    const message = await getFunctionErrorMessage(error.message, error.context);
    throw new Error(message || "The roadmap service could not complete the request.");
  }
  if (!data || !isRoadmap(data.roadmap)) {
    throw new Error("The roadmap service returned an invalid response.");
  }
  return { ...data.roadmap, steps: data.roadmap.steps.map((step) => ({ ...step, completed: false })) };
}

export async function listSavedRoadmaps(): Promise<SavedContributionRoadmap[]> {
  if (!supabase) throw new Error("Connect Supabase to load saved contribution roadmaps.");
  const { data, error } = await supabase
    .from("contribution_roadmaps")
    .select("id, user_id, issue_id, owner, repository, issue_number, issue_title, issue_url, roadmap, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not load saved roadmaps: ${error.message}`);
  return (data ?? []).map((record) => {
    if (!isRoadmap(record.roadmap)) {
      throw new Error(`Saved roadmap ${record.id} has invalid data. Contact support before continuing.`);
    }
    return { ...record, roadmap: record.roadmap } as SavedContributionRoadmap;
  });
}

export async function saveContributionRoadmap(
  issue: GitHubIssue,
  roadmap: ContributionRoadmap,
): Promise<SavedContributionRoadmap> {
  if (!supabase) throw new Error("Connect Supabase to save contribution roadmaps.");
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Could not verify your session: ${userError.message}`);
  if (!userData.user) throw new Error("Sign in to save your contribution roadmap.");

  const { data, error } = await supabase
    .from("contribution_roadmaps")
    .upsert({
      user_id: userData.user.id,
      issue_id: issue.id,
      owner: issue.owner,
      repository: issue.repository,
      issue_number: issue.number,
      issue_title: issue.title,
      issue_url: issue.html_url,
      roadmap,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,issue_id" })
    .select("id, user_id, issue_id, owner, repository, issue_number, issue_title, issue_url, roadmap, created_at, updated_at")
    .single();
  if (error) throw new Error(`Could not save your contribution roadmap: ${error.message}`);
  if (!data) throw new Error("The roadmap was saved but could not be loaded.");
  if (!isRoadmap(data.roadmap)) throw new Error("The saved roadmap data is invalid.");
  return { ...data, roadmap: data.roadmap };
}
