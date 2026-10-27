import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SimplifierPage } from "../src/pages/SimplifierPage";
import type { GitHubIssue } from "../src/types/domain";

const mocks = vi.hoisted(() => ({
  searchIssues: vi.fn(),
  getIssue: vi.fn(),
  simplifyIssue: vi.fn(),
  generateContributionRoadmap: vi.fn(),
  listSavedRoadmaps: vi.fn(),
  saveContributionRoadmap: vi.fn(),
}));

vi.mock("../src/app/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("../src/lib/issues", () => ({
  searchIssues: mocks.searchIssues,
  getIssue: mocks.getIssue,
  simplifyIssue: mocks.simplifyIssue,
}));

vi.mock("../src/lib/roadmaps", () => ({
  generateContributionRoadmap: mocks.generateContributionRoadmap,
  listSavedRoadmaps: mocks.listSavedRoadmaps,
  saveContributionRoadmap: mocks.saveContributionRoadmap,
}));

const issue: GitHubIssue = {
  id: 501,
  number: 12,
  title: "Improve keyboard navigation",
  body: "Arrow keys do not move focus.\n\n## Acceptance Criteria\n- Arrow keys move focus.",
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

const explanation = {
  problem_plain_english: "Keyboard users cannot move through the menu.",
  what_needs_to_be_done: "Update the navigation behavior described in the issue.",
  why_it_matters: "The issue reports that keyboard navigation is broken.",
  technical_terms: [{ term: "focus", explanation: "The item currently selected for keyboard input." }],
  expected_outcome: "Arrow keys move focus through the menu.",
  acceptance_criteria: ["Arrow keys move focus."],
  generated_by: "ai" as const,
};

const roadmap = {
  steps: [
    "Understand the issue and acceptance criteria",
    "Read the README and contribution guidelines",
    "Explore the codebase and identify files to inspect",
    "Plan the implementation",
    "Implement and review the changes",
    "Run appropriate tests and checks",
    "Prepare a pull request",
  ].map((title) => ({
    title,
    explanation: `Review the repository context for ${title.toLowerCase()}.`,
    tasks: ["Check the issue and current project instructions."],
    completed: false,
  })),
  generated_by: "ai" as const,
  suggestions_unverified: true as const,
};

describe("Issue Simplifier page", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.searchIssues.mockResolvedValue({ items: [issue], total_count: 1 });
    mocks.getIssue.mockResolvedValue(issue);
    mocks.simplifyIssue.mockResolvedValue(explanation);
    mocks.generateContributionRoadmap.mockResolvedValue(roadmap);
    mocks.listSavedRoadmaps.mockResolvedValue([]);
    mocks.saveContributionRoadmap.mockImplementation(async (selectedIssue, savedRoadmap) => ({
      id: "roadmap-1",
      user_id: "user-1",
      issue_id: selectedIssue.id,
      owner: selectedIssue.owner,
      repository: selectedIssue.repository,
      issue_number: selectedIssue.number,
      issue_title: selectedIssue.title,
      issue_url: selectedIssue.html_url,
      roadmap: savedRoadmap,
      created_at: "2026-10-27T00:00:00Z",
      updated_at: "2026-10-27T00:00:00Z",
    }));
  });

  it("selects a live issue, fetches its details, and displays sourced facts separately from AI explanations", async () => {
    const { container } = render(<MemoryRouter><SimplifierPage /></MemoryRouter>);
    const select = await screen.findByRole("combobox", { name: /select a github issue/i });
    fireEvent.change(select, { target: { value: String(issue.id) } });

    expect(await screen.findByRole("heading", { name: issue.title })).toBeInTheDocument();
    expect(screen.getByText("sample/menu · Issue #12 · TypeScript")).toBeInTheDocument();
    expect(container.querySelector(".simplifier-issue-body")).toHaveTextContent("Arrow keys do not move focus.");

    fireEvent.click(screen.getByRole("button", { name: "Simplify Issue" }));
    expect(await screen.findByText(explanation.problem_plain_english)).toBeInTheDocument();
    expect(screen.getByText("AI-generated explanation")).toBeInTheDocument();
    expect(screen.getByText("Copied from the original GitHub issue")).toBeInTheDocument();
    expect(screen.getByText("1. What is the problem?")).toBeInTheDocument();
    expect(screen.getByText("5. Words you may not know")).toBeInTheDocument();
    expect(screen.getByText("Arrow keys move focus.", { exact: true })).toBeInTheDocument();
  });

  it("shows a clear error and retries generation", async () => {
    mocks.simplifyIssue
      .mockRejectedValueOnce(new Error("OpenRouter is temporarily unavailable."))
      .mockResolvedValueOnce(explanation);

    render(<MemoryRouter><SimplifierPage /></MemoryRouter>);
    fireEvent.change(await screen.findByRole("combobox", { name: /select a github issue/i }), {
      target: { value: String(issue.id) },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Simplify Issue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("OpenRouter is temporarily unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mocks.simplifyIssue).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(explanation.problem_plain_english)).toBeInTheDocument();
  });

  it("generates and persists a roadmap with interactive progress", async () => {
    render(<MemoryRouter><SimplifierPage /></MemoryRouter>);
    fireEvent.change(await screen.findByRole("combobox", { name: /select a github issue/i }), {
      target: { value: String(issue.id) },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Generate Roadmap" }));

    expect(await screen.findByRole("heading", { name: "Your contribution roadmap" })).toBeInTheDocument();
    expect(mocks.generateContributionRoadmap).toHaveBeenCalledWith(issue, null);
    expect(screen.getByText(/0 of 7 steps · 0% complete/)).toBeInTheDocument();
    const firstCheckbox = screen.getByRole("checkbox", {
      name: /mark complete: understand the issue and acceptance criteria/i,
    });
    fireEvent.click(firstCheckbox);
    await waitFor(() => expect(mocks.saveContributionRoadmap).toHaveBeenLastCalledWith(
      issue,
      expect.objectContaining({
        steps: expect.arrayContaining([expect.objectContaining({ title: roadmap.steps[0].title, completed: true })]),
      }),
    ));
    expect(await screen.findByText(/1 of 7 steps · 14% complete/)).toBeInTheDocument();
  });

  it("reopens a saved roadmap and restores its checklist state", async () => {
    const savedRoadmap = {
      ...roadmap,
      steps: roadmap.steps.map((step, index) => ({ ...step, completed: index === 0 })),
    };
    mocks.listSavedRoadmaps.mockResolvedValue([{
      id: "roadmap-1",
      user_id: "user-1",
      issue_id: issue.id,
      owner: issue.owner,
      repository: issue.repository,
      issue_number: issue.number,
      issue_title: issue.title,
      issue_url: issue.html_url,
      roadmap: savedRoadmap,
      created_at: "2026-10-27T00:00:00Z",
      updated_at: "2026-10-27T00:00:00Z",
    }]);

    render(<MemoryRouter><SimplifierPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /improve keyboard navigation.*sample\/menu #12.*1\/7 complete/i }));
    expect(await screen.findByRole("heading", { name: "Your contribution roadmap" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", {
      name: /mark incomplete: understand the issue and acceptance criteria/i,
    })).toBeChecked();
    expect(screen.getByText(/1 of 7 steps · 14% complete/)).toBeInTheDocument();
  });
});
