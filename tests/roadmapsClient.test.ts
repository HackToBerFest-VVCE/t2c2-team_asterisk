import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubIssue } from "../src/types/domain";
import { ROADMAP_STEP_TITLES } from "../supabase/functions/_shared/roadmap";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  order: vi.fn(),
}));

vi.mock("../src/lib/supabase", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));

import { generateContributionRoadmap, listSavedRoadmaps, saveContributionRoadmap } from "../src/lib/roadmaps";

const issue: GitHubIssue = {
  id: 501,
  number: 12,
  title: "Improve keyboard navigation",
  body: "Arrow keys do not move focus.",
  repository_full_name: "sample/menu",
  html_url: "https://github.com/sample/menu/issues/12",
  state: "open",
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-24T00:00:00Z",
  closed_at: null,
  comments: 1,
  labels: [{ name: "help wanted" }],
  repository_url: "https://api.github.com/repos/sample/menu",
  repository: "menu",
  owner: "sample",
  language: "TypeScript",
};

const roadmap = {
  steps: ROADMAP_STEP_TITLES.map((title) => ({
    title,
    explanation: `Specific guidance for ${title}.`,
    tasks: ["Review issue details."],
    completed: true,
  })),
  generated_by: "ai" as const,
  suggestions_unverified: true as const,
};

const saved = {
  id: "roadmap-1",
  user_id: "user-1",
  issue_id: issue.id,
  owner: issue.owner,
  repository: issue.repository,
  issue_number: issue.number,
  issue_title: issue.title,
  issue_url: issue.html_url,
  roadmap,
  created_at: "2026-10-27T00:00:00Z",
  updated_at: "2026-10-27T00:00:00Z",
};

describe("contribution roadmap client", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.invoke.mockResolvedValue({ data: { roadmap }, error: null });
    mocks.upsert.mockReturnThis();
    mocks.select.mockReturnThis();
    mocks.single.mockResolvedValue({ data: saved, error: null });
    mocks.order.mockResolvedValue({ data: [saved], error: null });
    const chain = {
      upsert: mocks.upsert,
      select: mocks.select,
      single: mocks.single,
      order: mocks.order,
    };
    mocks.from.mockReturnValue(chain);
  });

  it("generates a roadmap with the optional simplification and resets model completion flags", async () => {
    const result = await generateContributionRoadmap(issue, {
      problem_plain_english: "Keyboard users cannot move through the menu.",
      what_needs_to_be_done: "Improve keyboard movement.",
      why_it_matters: "The issue describes broken navigation.",
      expected_outcome: "Arrow navigation works.",
      technical_terms: [{ term: "focus", explanation: "The active keyboard target." }],
      acceptance_criteria: [],
      generated_by: "ai",
    });

    expect(mocks.invoke).toHaveBeenCalledWith("generate-roadmap", {
      body: {
        owner: issue.owner,
        repo: issue.repository,
        number: issue.number,
        simplifiedExplanation: expect.stringContaining("Keyboard users cannot move through the menu."),
      },
    });
    expect(result.steps.every((step) => !step.completed)).toBe(true);
  });

  it("loads saved roadmaps and persists progress with the authenticated user id", async () => {
    await expect(listSavedRoadmaps()).resolves.toEqual([saved]);
    const result = await saveContributionRoadmap(issue, roadmap);

    expect(mocks.from).toHaveBeenCalledWith("contribution_roadmaps");
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1",
      issue_id: issue.id,
      owner: issue.owner,
      repository: issue.repository,
      issue_number: issue.number,
      roadmap,
    }), { onConflict: "user_id,issue_id" });
    expect(result).toEqual(saved);
  });
});
