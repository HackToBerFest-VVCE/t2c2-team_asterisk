export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export interface DeveloperProfile {
  id: string;
  languages: string[];
  skills: string[];
  skills_to_practice: string[];
  project_experience: string[];
  experience_level: ExperienceLevel;
  interests: string[];
  project_types: string[];
  github_username: string | null;
  updated_at: string;
}

export interface GitHubLabel {
  id?: number;
  name: string;
  color?: string;
  description?: string | null;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  repository_full_name: string;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
  labels: GitHubLabel[];
  repository_url: string;
  repository: string;
  owner: string;
  language: string | null;
}

export type IssueSort = "match" | "updated" | "created" | "comments";

export interface IssueFilters {
  keywords?: string;
  language?: string;
  beginnerFriendly?: boolean;
  repository?: string;
  sort?: IssueSort;
  page?: number;
  perPage?: number;
}

export interface IssueSearchResult {
  items: GitHubIssue[];
  total_count: number;
  candidate_count?: number;
  incomplete_results: boolean;
  page: number;
  perPage: number;
  cacheWarning?: string;
}

export interface ScoreFactor {
  label: string;
  /** Normalized component score, always 0-100. */
  score: number;
  /** Percentage of the overall score assigned to this component. */
  weight: number;
  /** Weighted points this component contributes to the overall score. */
  points: number;
  explanation: string;
}

export interface IssueMatch {
  score: number;
  factors: ScoreFactor[];
}

export interface SavedIssue {
  issue: GitHubIssue;
  status: "saved" | "in_progress" | "completed";
  updatedAt: string;
}

export interface StoredContributionGuide {
  id: string;
  issue_id: number;
  guide: ContributionGuide;
  model: string;
  generated_at: string;
}

export interface ContributionGuide {
  summary: string;
  prerequisites: string[];
  setup: string[];
  steps: string[];
  files_to_investigate: string[];
  testing: string[];
  pull_request: string[];
  verify: string[];
  source_notes: string[];
  links: {
    issue: string;
    repository: string;
    readme: string | null;
    contributing: string | null;
  };
  generated_by: "ai" | "fallback";
  issue_explanation?: string;
  pull_request_explanation?: string;
  expected_outcome?: string;
  solution_approach?: string;
  repository_setup_workflow?: string[];
  possible_root_causes?: string[];
  files_to_inspect?: string[];
  implementation_steps?: string[];
  example_code?: string;
  test_commands?: string[];
  edge_cases?: string[];
  pull_request_checklist?: string[];
  context_note?: string;
  repository_verification?: "not_performed";
}

export interface ContributionRoadmapStep {
  title: string;
  explanation: string;
  tasks: string[];
  completed: boolean;
}

export interface ContributionRoadmap {
  steps: ContributionRoadmapStep[];
  generated_by: "ai";
  suggestions_unverified: true;
}

export interface SavedContributionRoadmap {
  id: string;
  user_id: string;
  issue_id: number;
  owner: string;
  repository: string;
  issue_number: number;
  issue_title: string;
  issue_url: string;
  roadmap: ContributionRoadmap;
  created_at: string;
  updated_at: string;
}

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
  documentation: { label: string; url: string }[];
}

export interface SkillGapAnalysis {
  skills: SkillGapItem[];
  recommended_preparation: SkillPreparationStep[];
  difficulty: {
    level: "Beginner" | "Intermediate" | "Advanced";
    explanation: string;
  };
}
