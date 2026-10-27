import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkillGapAnalyzer } from "../src/components/SkillGapAnalyzer";
import type { GitHubIssue, DeveloperProfile, SkillGapAnalysis } from "../src/types/domain";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
  analyzeSkillGap: vi.fn(),
  user: { id: "user-1" },
}));

vi.mock("../src/app/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("../src/lib/profile", () => ({
  getProfile: mocks.getProfile,
  saveProfile: mocks.saveProfile,
}));

vi.mock("../src/lib/skillGap", () => ({
  analyzeSkillGap: mocks.analyzeSkillGap,
}));

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

const profile: DeveloperProfile = {
  id: "user-1",
  languages: ["TypeScript"],
  skills: ["React"],
  skills_to_practice: ["Docker"],
  project_experience: ["Built a React dashboard"],
  experience_level: "beginner",
  interests: [],
  project_types: [],
  github_username: null,
  updated_at: "2026-10-27T00:00:00Z",
};

const analysis: SkillGapAnalysis = {
  skills: [
    {
      name: "React",
      status: "Known",
      confidence: "High",
      why_relevant: "A possible UI change may involve React.",
      profile_note: "Matched to skills in your profile.",
    },
    {
      name: "Keyboard accessibility",
      status: "Needs Practice",
      confidence: "Low",
      why_relevant: "The issue mentions keyboard navigation.",
      profile_note: "Not listed in your profile. This is uncertain, not evidence that you lack it.",
    },
  ],
  recommended_preparation: [{
    skill: "React",
    topic: "Keyboard event handling",
    exercise: "Try a small accessible menu exercise.",
    documentation: [{ label: "React Learn", url: "https://react.dev/learn" }],
  }],
  difficulty: { level: "Beginner", explanation: "The issue appears focused, but scope should be verified." },
};

describe("Skill Gap Analyzer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getProfile.mockResolvedValue(profile);
    mocks.saveProfile.mockResolvedValue(undefined);
    mocks.analyzeSkillGap.mockResolvedValue(analysis);
  });

  afterEach(() => cleanup());

  it("reuses and updates the profile, then displays statuses, uncertainty, learning tasks, and difficulty", async () => {
    render(<SkillGapAnalyzer issue={issue} />);
    expect(await screen.findByLabelText("Programming languages")).toHaveValue("TypeScript");
    fireEvent.change(screen.getByLabelText("Frameworks and tools you know"), {
      target: { value: "React, Vitest" },
    });
    fireEvent.change(screen.getByLabelText("Relevant project experience"), {
      target: { value: "Built an accessible React menu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze Skill Gap" }));

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith(
      { id: "user-1" },
      expect.objectContaining({
        skills: ["React", "Vitest"],
        project_experience: ["Built an accessible React menu"],
      }),
    ));
    expect(await screen.findByRole("heading", { name: "Your skill gap analysis" })).toBeInTheDocument();
    expect(screen.getByText("Keyboard accessibility")).toBeInTheDocument();
    expect(screen.getByText("Needs Practice")).toBeInTheDocument();
    expect(screen.getByText(/not evidence that you lack it/i)).toBeInTheDocument();
    expect(screen.getByText("Estimated difficulty").parentElement).toHaveTextContent("Beginner");
    expect(screen.getByRole("link", { name: /react learn/i })).toHaveAttribute("href", "https://react.dev/learn");
    expect(mocks.analyzeSkillGap).toHaveBeenCalledWith(issue, null);
  });

  it("passes the simplified explanation when it is available", async () => {
    const simplified = {
      problem_plain_english: "Keyboard users cannot move in the menu.",
      what_needs_to_be_done: "Improve arrow-key movement.",
      why_it_matters: "The issue describes broken navigation.",
      expected_outcome: "Arrow keys move focus.",
      technical_terms: [{ term: "focus", explanation: "Current keyboard target." }],
    };
    render(<SkillGapAnalyzer issue={issue} simplification={simplified} />);
    await screen.findByLabelText("Programming languages");
    fireEvent.click(await screen.findByRole("button", { name: "Analyze Skill Gap" }));
    await waitFor(() => expect(mocks.analyzeSkillGap).toHaveBeenCalledWith(
      issue,
      expect.stringContaining("Keyboard users cannot move in the menu."),
    ));
  });
});
