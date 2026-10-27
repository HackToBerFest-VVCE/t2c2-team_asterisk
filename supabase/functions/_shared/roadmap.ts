import { isRecord } from "./http.ts";

export const ROADMAP_STEP_TITLES = [
  "Understand the issue and acceptance criteria",
  "Read the README and contribution guidelines",
  "Explore the codebase and identify files to inspect",
  "Plan the implementation",
  "Implement and review the changes",
  "Run appropriate tests and checks",
  "Prepare a pull request",
] as const;

export interface RoadmapStep {
  title: string;
  explanation: string;
  tasks: string[];
  completed: boolean;
}

export interface ContributionRoadmap {
  steps: RoadmapStep[];
  generated_by: "ai";
  suggestions_unverified: true;
}

export function normalizeRoadmap(value: unknown): ContributionRoadmap | null {
  if (!isRecord(value) || !Array.isArray(value.steps) || value.steps.length !== ROADMAP_STEP_TITLES.length) {
    return null;
  }

  const steps: RoadmapStep[] = [];
  for (let index = 0; index < ROADMAP_STEP_TITLES.length; index += 1) {
    const step = value.steps[index];
    if (
      !isRecord(step) ||
      step.title !== ROADMAP_STEP_TITLES[index] ||
      typeof step.explanation !== "string" ||
      !step.explanation.trim() ||
      step.explanation.length > 1200 ||
      !Array.isArray(step.tasks) ||
      step.tasks.length < 1 ||
      step.tasks.length > 8 ||
      !step.tasks.every((task) => typeof task === "string" && task.trim().length > 0 && task.length <= 500)
    ) {
      return null;
    }
    steps.push({
      title: ROADMAP_STEP_TITLES[index],
      explanation: step.explanation,
      tasks: step.tasks,
      completed: false,
    });
  }

  return { steps, generated_by: "ai", suggestions_unverified: true };
}
