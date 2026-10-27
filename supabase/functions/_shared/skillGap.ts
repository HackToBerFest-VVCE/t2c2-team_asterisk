import { isRecord } from "./http.ts";

export type SkillGapStatus = "Known" | "Needs Practice" | "Learn";
export type SkillGapConfidence = "High" | "Medium" | "Low";

export interface SkillGapItem {
  name: string;
  status: SkillGapStatus;
  confidence: SkillGapConfidence;
  why_relevant: string;
  profile_note: string;
}

export interface SkillPreparationStep {
  skill: string;
  topic: string;
  exercise: string;
}

export interface SkillGapAnalysis {
  skills: SkillGapItem[];
  recommended_preparation: SkillPreparationStep[];
  difficulty: {
    level: "Beginner" | "Intermediate" | "Advanced";
    explanation: string;
  };
}

const documentation: Record<string, { label: string; url: string }> = {
  javascript: { label: "MDN JavaScript Guide", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
  typescript: { label: "TypeScript Handbook", url: "https://www.typescriptlang.org/docs/handbook/intro.html" },
  python: { label: "Python Tutorial", url: "https://docs.python.org/3/tutorial/" },
  react: { label: "React Learn", url: "https://react.dev/learn" },
  nodejs: { label: "Node.js Documentation", url: "https://nodejs.org/docs/latest/api/" },
  git: { label: "Git Reference", url: "https://git-scm.com/docs" },
  github: { label: "GitHub Docs", url: "https://docs.github.com/en" },
  githubactions: { label: "GitHub Actions Documentation", url: "https://docs.github.com/en/actions" },
  docker: { label: "Docker Documentation", url: "https://docs.docker.com/" },
  html: { label: "MDN HTML Guide", url: "https://developer.mozilla.org/en-US/docs/Learn/HTML" },
  css: { label: "MDN CSS Guide", url: "https://developer.mozilla.org/en-US/docs/Learn/CSS" },
  sql: { label: "PostgreSQL Tutorial", url: "https://www.postgresql.org/docs/current/tutorial.html" },
  rust: { label: "The Rust Programming Language", url: "https://doc.rust-lang.org/book/" },
  go: { label: "A Tour of Go", url: "https://go.dev/tour/" },
  java: { label: "Java Tutorials", url: "https://docs.oracle.com/javase/tutorial/" },
  ruby: { label: "Ruby Documentation", url: "https://www.ruby-lang.org/en/documentation/" },
};

function normalizedTerm(value: string): string {
  const term = value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  if (term === "js" || term === "ecmascript") return "javascript";
  if (term === "ts") return "typescript";
  if (term === "node") return "nodejs";
  if (term === "postgres" || term === "postgresql") return "sql";
  if (term === "ghactions" || term === "actions") return "githubactions";
  return term;
}

export function documentationForSkill(name: string): { label: string; url: string }[] {
  const key = normalizedTerm(name);
  const resource = documentation[key];
  return resource ? [resource] : [];
}

export function normalizeSkillGap(
  value: unknown,
  profile: {
    languages: string[];
    skills: string[];
    skills_to_practice: string[];
    project_experience: string[];
  },
): (SkillGapAnalysis & { recommended_preparation: (SkillPreparationStep & {
  documentation: { label: string; url: string }[];
})[] }) | null {
  if (!isRecord(value) || !Array.isArray(value.skills) || !Array.isArray(value.recommended_preparation) || !isRecord(value.difficulty)) {
    return null;
  }
  if (
    typeof value.difficulty.level !== "string" ||
    !["Beginner", "Intermediate", "Advanced"].includes(value.difficulty.level) ||
    typeof value.difficulty.explanation !== "string" ||
    !value.difficulty.explanation.trim() ||
    value.difficulty.explanation.length > 1000 ||
    value.skills.length > 15 ||
    value.recommended_preparation.length > 12
  ) return null;

  const knownTerms = [...profile.languages, ...profile.skills].map(normalizedTerm);
  const projectTerms = profile.project_experience.map(normalizedTerm);
  const learnTerms = profile.skills_to_practice.map(normalizedTerm);
  const skills: SkillGapItem[] = [];
  for (const rawSkill of value.skills) {
    if (
      !isRecord(rawSkill) ||
      typeof rawSkill.name !== "string" ||
      !rawSkill.name.trim() ||
      rawSkill.name.length > 80 ||
      typeof rawSkill.why_relevant !== "string" ||
      !rawSkill.why_relevant.trim() ||
      rawSkill.why_relevant.length > 500
    ) return null;

    const key = normalizedTerm(rawSkill.name);
    const isKnown = knownTerms.some((term) => term === key || (term.length > 2 && (key.includes(term) || term.includes(key)))) ||
      projectTerms.some((term) => key.length > 2 && term.includes(key));
    const isLearning = learnTerms.some((term) => term === key || (term.length > 2 && (key.includes(term) || term.includes(key))));
    const status: SkillGapStatus = isKnown ? "Known" : isLearning ? "Learn" : "Needs Practice";
    const confidence: SkillGapConfidence = isKnown ? "High" : isLearning ? "Medium" : "Low";
    skills.push({
      name: rawSkill.name.trim(),
      status,
      confidence,
      why_relevant: rawSkill.why_relevant.trim(),
      profile_note: isKnown
        ? "Matched to skills, languages, or project experience in your profile."
        : isLearning
          ? "You listed this among skills you want to practice or learn."
          : "Not listed in your profile. This is an uncertain estimate, not evidence that you lack this skill.",
    });
  }

  const recommended_preparation: (SkillPreparationStep & {
    documentation: { label: string; url: string }[];
  })[] = [];
  for (const step of value.recommended_preparation) {
    if (
      !isRecord(step) ||
      typeof step.skill !== "string" ||
      typeof step.topic !== "string" ||
      !step.topic.trim() ||
      step.topic.length > 200 ||
      typeof step.exercise !== "string" ||
      !step.exercise.trim() ||
      step.exercise.length > 500
    ) return null;
    recommended_preparation.push({
      skill: step.skill.slice(0, 80),
      topic: step.topic.trim(),
      exercise: step.exercise.trim(),
      documentation: documentationForSkill(step.skill),
    });
  }

  return {
    skills,
    recommended_preparation,
    difficulty: {
      level: value.difficulty.level as SkillGapAnalysis["difficulty"]["level"],
      explanation: value.difficulty.explanation.trim(),
    },
  };
}
