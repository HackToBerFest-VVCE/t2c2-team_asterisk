import { describe, expect, it } from "vitest";
import { normalizeSkillGap } from "../supabase/functions/_shared/skillGap";

const generated = {
  skills: [
    { name: "TypeScript", why_relevant: "The issue mentions a typed frontend API." },
    { name: "React", why_relevant: "The repository metadata and issue suggest a UI change." },
    { name: "Docker", why_relevant: "The repository topic suggests container tooling may be relevant." },
  ],
  recommended_preparation: [{
    skill: "React",
    topic: "Component state and event handlers",
    exercise: "Build a small interactive form and verify that state updates when a user changes a field.",
  }],
  difficulty: {
    level: "Intermediate",
    explanation: "The issue may require changing UI behavior; inspect its scope before deciding.",
  },
};

describe("skill gap normalization", () => {
  it("uses profile evidence for known and learning statuses without assuming absent skills are missing", () => {
    const result = normalizeSkillGap(generated, {
      languages: ["TypeScript"],
      skills: ["React"],
      skills_to_practice: ["Docker"],
      project_experience: [],
    });

    expect(result?.skills.map(({ name, status, confidence }) => ({ name, status, confidence }))).toEqual([
      { name: "TypeScript", status: "Known", confidence: "High" },
      { name: "React", status: "Known", confidence: "High" },
      { name: "Docker", status: "Learn", confidence: "Medium" },
    ]);
    expect(result?.recommended_preparation[0].documentation).toEqual([
      { label: "React Learn", url: "https://react.dev/learn" },
    ]);
  });

  it("marks skills absent from profile as uncertain instead of saying the user lacks them", () => {
    const result = normalizeSkillGap(generated, {
      languages: [],
      skills: [],
      skills_to_practice: [],
      project_experience: [],
    });
    expect(result?.skills[0]).toMatchObject({
      status: "Needs Practice",
      confidence: "Low",
      profile_note: expect.stringContaining("not evidence that you lack"),
    });
  });

  it("rejects malformed or oversized analyses", () => {
    expect(normalizeSkillGap({ ...generated, skills: [] }, {
      languages: [], skills: [], skills_to_practice: [], project_experience: [],
    })).not.toBeNull();
    expect(normalizeSkillGap({ ...generated, difficulty: { level: "Expert", explanation: "Unknown" } }, {
      languages: [], skills: [], skills_to_practice: [], project_experience: [],
    })).toBeNull();
  });
});
