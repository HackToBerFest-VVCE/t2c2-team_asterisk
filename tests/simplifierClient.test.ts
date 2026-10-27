import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubIssue } from "../src/types/domain";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("../src/lib/supabase", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

import { simplifyIssue } from "../src/lib/issues";

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

const simplification = {
  problem_plain_english: "Keyboard users cannot move through the menu.",
  what_needs_to_be_done: "Update the issue's menu navigation behavior.",
  why_it_matters: "The issue says keyboard navigation is not working.",
  technical_terms: [{ term: "focus", explanation: "The element currently selected for keyboard input." }],
  expected_outcome: "The behavior requested in the issue works.",
  acceptance_criteria: ["Arrow keys move focus."],
  generated_by: "ai" as const,
};

describe("issue simplifier client", () => {
  beforeEach(() => vi.resetAllMocks());

  it("invokes the authenticated Supabase function with the selected issue identity", async () => {
    mocks.invoke.mockResolvedValue({ data: { simplification }, error: null });
    await expect(simplifyIssue(issue)).resolves.toEqual(simplification);
    expect(mocks.invoke).toHaveBeenCalledWith("simplify-issue", {
      body: { owner: "sample", repo: "menu", number: 12 },
    });
  });

  it("rejects malformed or non-AI fallback responses", async () => {
    mocks.invoke.mockResolvedValue({
      data: { simplification: { ...simplification, generated_by: "fallback" } },
      error: null,
    });
    await expect(simplifyIssue(issue)).rejects.toThrow("invalid response");
  });
});
