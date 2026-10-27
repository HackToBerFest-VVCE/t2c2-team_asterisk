import { describe, expect, it } from "vitest";
import { normalizeRoadmap, ROADMAP_STEP_TITLES } from "../supabase/functions/_shared/roadmap";

function validGeneratedRoadmap() {
  return {
    steps: ROADMAP_STEP_TITLES.map((title) => ({
      title,
      explanation: `Specific guidance for ${title}.`,
      tasks: ["Review the issue details.", "Check the repository instructions."],
      completed: true,
    })),
  };
}

describe("contribution roadmap validation", () => {
  it("enforces the required seven ordered steps and initializes them incomplete", () => {
    const result = normalizeRoadmap(validGeneratedRoadmap());
    expect(result?.steps).toHaveLength(7);
    expect(result?.steps.map((step) => step.title)).toEqual(ROADMAP_STEP_TITLES);
    expect(result?.steps.every((step) => step.completed === false)).toBe(true);
    expect(result).toMatchObject({ generated_by: "ai", suggestions_unverified: true });
  });

  it("rejects missing steps, out-of-order steps, and empty task lists", () => {
    const missing = validGeneratedRoadmap();
    missing.steps.pop();
    expect(normalizeRoadmap(missing)).toBeNull();

    const outOfOrder = validGeneratedRoadmap();
    [outOfOrder.steps[0], outOfOrder.steps[1]] = [outOfOrder.steps[1], outOfOrder.steps[0]];
    expect(normalizeRoadmap(outOfOrder)).toBeNull();

    const noTasks = validGeneratedRoadmap();
    noTasks.steps[0].tasks = [];
    expect(normalizeRoadmap(noTasks)).toBeNull();
  });
});
