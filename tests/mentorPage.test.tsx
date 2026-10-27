import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MentorPage } from "../src/pages/MentorPage";
import type { ContributionGuide, GitHubIssue } from "../src/types/domain";

const mocks = vi.hoisted(() => ({
  getIssue: vi.fn(),
  generateContributionGuide: vi.fn(),
}));

vi.mock("../src/lib/issues", () => ({
  getIssue: mocks.getIssue,
  generateContributionGuide: mocks.generateContributionGuide,
}));

const issue: GitHubIssue = {
  id: 55,
  number: 4,
  title: "Keyboard navigation is broken",
  body: "Arrow keys do not move focus.",
  repository_full_name: "example/menu",
  html_url: "https://github.com/example/menu/issues/4",
  state: "open",
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-24T00:00:00Z",
  closed_at: null,
  comments: 1,
  labels: [{ name: "help wanted" }],
  repository_url: "https://api.github.com/repos/example/menu",
  repository: "menu",
  owner: "example",
  language: "TypeScript",
};

const fallbackGuide: ContributionGuide = {
  summary: "This issue asks the project to improve keyboard navigation.",
  issue_explanation: "This issue asks the project to improve keyboard navigation.",
  pull_request_explanation: "A pull request proposes your change to the project for review.",
  prerequisites: ["Review project documentation for specific tools."],
  setup: [],
  repository_setup_workflow: ["Read README setup guidance."],
  steps: [],
  implementation_steps: ["Read the issue.", "Review docs.", "Explore code.", "Plan.", "Implement.", "Test.", "Open a PR."],
  files_to_investigate: [],
  files_to_inspect: [],
  testing: [],
  test_commands: ["Follow the documented test instructions."],
  pull_request: [],
  pull_request_checklist: ["Link the issue in your pull request."],
  verify: ["Check project instructions."],
  source_notes: ["README fetched from GitHub."],
  generated_by: "fallback",
  expected_outcome: "The issue's expected behavior needs confirmation.",
  solution_approach: "Review the issue and repository docs.",
  possible_root_causes: [],
  example_code: "",
  edge_cases: ["Check nearby keyboard behavior."],
  context_note: "No source tree was inspected.",
  repository_verification: "not_performed",
  links: {
    issue: issue.html_url,
    repository: "https://github.com/example/menu",
    readme: "https://github.com/example/menu#readme",
    contributing: "https://github.com/example/menu/blob/HEAD/CONTRIBUTING.md",
  },
};

function renderMentor() {
  return render(
    <MemoryRouter initialEntries={["/mentor/example/menu/4"]}>
      <Routes>
        <Route path="/mentor/:owner/:repo/:number" element={<MentorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AI Contribution Mentor page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getIssue.mockResolvedValue(issue);
    mocks.generateContributionGuide.mockResolvedValue(fallbackGuide);
  });

  it("shows loading state, a retryable generation error, and the non-AI fallback", async () => {
    mocks.generateContributionGuide
      .mockRejectedValueOnce(new Error("Temporary provider failure"))
      .mockResolvedValueOnce(fallbackGuide);
    renderMentor();

    expect(screen.getByText("Loading the source issue...")).toBeInTheDocument();
    expect(await screen.findByText(/example\/menu.*Keyboard navigation is broken/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate contribution guide" }));
    expect(await screen.findByText("Temporary provider failure")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry guide generation" }));

    expect(await screen.findByText(/Non-AI starter guide/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How to submit a pull request" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /repository readme/i })).toHaveAttribute(
      "href",
      fallbackGuide.links.readme,
    );
    expect(screen.getByRole("link", { name: /contribution guidelines/i })).toHaveAttribute(
      "href",
      fallbackGuide.links.contributing,
    );
  });

  it("shows an empty issue state and retries loading the selected issue", async () => {
    mocks.getIssue.mockRejectedValueOnce(new Error("GitHub is unavailable")).mockResolvedValue(issue);
    renderMentor();

    expect(await screen.findByText("Could not load this issue")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading issue" }));
    expect(await screen.findByText(/example\/menu.*Keyboard navigation is broken/)).toBeInTheDocument();
    expect(mocks.generateContributionGuide).not.toHaveBeenCalled();
  });
});
