import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, ExternalLink, GraduationCap, RefreshCw, Sparkles } from "lucide-react";
import { useAuth } from "../app/AuthContext";
import { analyzeSkillGap } from "../lib/skillGap";
import { getProfile, saveProfile, type ProfileInput } from "../lib/profile";
import type { DeveloperProfile, ExperienceLevel, GitHubIssue, SkillGapAnalysis, SkillGapItem } from "../types/domain";
import { Button, LoadingState, Notice } from "./ui";

function splitList(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim().slice(0, 100)).filter(Boolean))].slice(0, 30);
}

function initialProfile(profile: DeveloperProfile | null): ProfileInput {
  return {
    languages: profile?.languages ?? [],
    skills: profile?.skills ?? [],
    skills_to_practice: profile?.skills_to_practice ?? [],
    project_experience: profile?.project_experience ?? [],
    experience_level: profile?.experience_level ?? "beginner",
    interests: profile?.interests ?? [],
    project_types: profile?.project_types ?? [],
    github_username: profile?.github_username ?? null,
  };
}

function skillStatusClass(status: SkillGapItem["status"]): string {
  return `skill-gap-status skill-gap-status-${status.toLowerCase().replace(" ", "-")}`;
}

function SkillCard({ skill }: { skill: SkillGapItem }) {
  return (
    <article className="skill-gap-card">
      <div className="skill-gap-card-heading">
        <h3>{skill.name}</h3>
        <span className={skillStatusClass(skill.status)}>{skill.status}</span>
      </div>
      <p>{skill.why_relevant}</p>
      <p className="skill-gap-evidence">{skill.profile_note} Confidence: {skill.confidence}.</p>
    </article>
  );
}

function SkillGapResults({ analysis }: { analysis: SkillGapAnalysis }) {
  const knownSkills = analysis.skills.filter((skill) => skill.status === "Known");
  const developmentSkills = analysis.skills.filter((skill) => skill.status !== "Known");

  return (
    <section className="skill-gap-results" aria-labelledby="skill-gap-results-heading">
      <div className="skill-gap-results-heading">
        <div>
          <p className="eyebrow"><Sparkles size={13} aria-hidden="true" /> AI-assisted estimate</p>
          <h2 id="skill-gap-results-heading">Your skill gap analysis</h2>
        </div>
        <div className="skill-gap-difficulty">
          <span>Estimated difficulty</span>
          <strong>{analysis.difficulty.level}</strong>
          <p>{analysis.difficulty.explanation}</p>
        </div>
      </div>
      <Notice>
        Skills and difficulty are estimates based on issue text, repository metadata, and the profile you provided.
        A skill not listed in your profile is marked uncertain—not assumed missing.
      </Notice>
      <div className="skill-gap-sections">
        <section className="skill-gap-section" aria-labelledby="known-skills-heading">
          <h3 id="known-skills-heading">1. Skills you already have</h3>
          <p>These match skills, languages, or project experience in your profile.</p>
          {knownSkills.length ? (
            <div className="skill-gap-list">{knownSkills.map((skill) => <SkillCard key={skill.name} skill={skill} />)}</div>
          ) : <p className="skill-gap-empty">No likely matches were identified from your profile. This does not mean you lack relevant skills—add experience above and analyze again.</p>}
        </section>
        <section className="skill-gap-section" aria-labelledby="growth-skills-heading">
          <h3 id="growth-skills-heading">2. Skills you may need to improve or learn</h3>
          <p>These are potential areas to explore, not confirmed requirements.</p>
          {developmentSkills.length ? (
            <div className="skill-gap-list">{developmentSkills.map((skill) => <SkillCard key={skill.name} skill={skill} />)}</div>
          ) : <p className="skill-gap-empty">No additional likely skills were identified for this issue.</p>}
        </section>
        <section className="skill-gap-section" aria-labelledby="preparation-heading">
          <h3 id="preparation-heading">3. Recommended preparation steps</h3>
          {analysis.recommended_preparation.length ? (
            <ol className="skill-preparation-list">
              {analysis.recommended_preparation.map((step, index) => (
                <li className="skill-preparation-card" key={`${step.skill}-${step.topic}-${index}`}>
                  <p className="skill-preparation-topic"><strong>{step.skill}:</strong> {step.topic}</p>
                  <p><strong>Small exercise:</strong> {step.exercise}</p>
                  {step.documentation.length > 0 && (
                    <div className="skill-doc-links">
                      {step.documentation.map((doc) => (
                        <a key={doc.url} href={doc.url} target="_blank" rel="noreferrer">
                          <BookOpen size={13} aria-hidden="true" /> {doc.label} <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : <p className="skill-gap-empty">No specific preparation steps were returned. Retry the analysis or review the issue with a maintainer.</p>}
        </section>
      </div>
    </section>
  );
}

export function SkillGapAnalyzer({
  issue,
  simplification,
}: {
  issue: GitHubIssue;
  simplification?: {
    problem_plain_english: string;
    what_needs_to_be_done: string;
    why_it_matters: string;
    expected_outcome: string;
    technical_terms: { term: string; explanation: string }[];
  } | null;
}) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [languages, setLanguages] = useState("");
  const [skills, setSkills] = useState("");
  const [skillsToPractice, setSkillsToPractice] = useState("");
  const [projectExperience, setProjectExperience] = useState("");
  const [experience, setExperience] = useState<ExperienceLevel>("beginner");
  const [savingProfile, setSavingProfile] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [analysis, setAnalysis] = useState<SkillGapAnalysis | null>(null);

  useEffect(() => {
    if (!user) {
      setLoadingProfile(false);
      setProfileError("Sign in to use personalized skill gap analysis.");
      return;
    }
    let active = true;
    setLoadingProfile(true);
    setProfileError("");
    void getProfile(user)
      .then((loaded) => {
        if (!active) return;
        setProfile(loaded);
        const values = initialProfile(loaded);
        setLanguages(values.languages.join(", "));
        setSkills(values.skills.join(", "));
        setSkillsToPractice(values.skills_to_practice.join(", "));
        setProjectExperience(values.project_experience.join(", "));
        setExperience(values.experience_level);
      })
      .catch((reason: unknown) => {
        if (active) setProfileError(reason instanceof Error ? reason.message : "Could not load your profile.");
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  function getDraft(): ProfileInput {
    return {
      ...initialProfile(profile),
      languages: splitList(languages),
      skills: splitList(skills),
      skills_to_practice: splitList(skillsToPractice),
      project_experience: splitList(projectExperience),
      experience_level: experience,
    };
  }

  async function persistProfile(): Promise<void> {
    if (!user) throw new Error("Sign in to save your skill profile.");
    const draft = getDraft();
    await saveProfile(user, draft);
    setProfile({
      ...draft,
      id: user.id,
      updated_at: new Date().toISOString(),
    });
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setNotice("");
    try {
      await persistProfile();
      setNotice("Your skill profile has been saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your skill profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError("");
    setNotice("");
    setAnalysis(null);
    try {
      await persistProfile();
      const simplifiedExplanation = simplification
        ? [
            simplification.problem_plain_english,
            simplification.what_needs_to_be_done,
            simplification.why_it_matters,
            simplification.expected_outcome,
            ...simplification.technical_terms.map(({ term, explanation }) => `${term}: ${explanation}`),
          ].join("\n")
        : null;
      const result = await analyzeSkillGap(issue, simplifiedExplanation);
      setAnalysis(result);
      setNotice("Your profile was saved and the issue analysis is ready.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not analyze your skill gap.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <section className="skill-gap-panel panel" aria-labelledby="skill-gap-heading">
      <div className="skill-gap-panel-heading">
        <div>
          <p className="eyebrow"><GraduationCap size={13} aria-hidden="true" /> Personalized preparation</p>
          <h2 id="skill-gap-heading">Skill Gap Analyzer</h2>
          <p>Compare your experience with likely skills for this issue. Your profile remains yours to edit.</p>
        </div>
      </div>
      {profileError && <Notice tone="error">{profileError}</Notice>}
      {loadingProfile ? <LoadingState label="Loading your developer profile..." /> : (
        <form className="skill-gap-profile-form" onSubmit={(event) => void handleSaveProfile(event)}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="gap-languages">Programming languages</label>
              <input id="gap-languages" value={languages} onChange={(event) => setLanguages(event.target.value)} placeholder="TypeScript, Python" />
            </div>
            <div className="field">
              <label htmlFor="gap-known-skills">Frameworks and tools you know</label>
              <input id="gap-known-skills" value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="React, Git, Docker" />
            </div>
            <div className="field">
              <label htmlFor="gap-practice-skills">Skills you want to practice or learn</label>
              <input id="gap-practice-skills" value={skillsToPractice} onChange={(event) => setSkillsToPractice(event.target.value)} placeholder="Accessibility testing, CI" />
            </div>
            <div className="field">
              <label htmlFor="gap-experience-level">Experience level</label>
              <select id="gap-experience-level" value={experience} onChange={(event) => setExperience(event.target.value as ExperienceLevel)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="field skill-gap-projects-field">
              <label htmlFor="gap-project-experience">Relevant project experience</label>
              <textarea id="gap-project-experience" value={projectExperience} onChange={(event) => setProjectExperience(event.target.value)} placeholder="Describe related projects or contributions (separate entries with commas)." maxLength={2400} />
            </div>
          </div>
          <p className="field-hint">Only mark skills as known when you are comfortable with them. An unlisted skill is treated as unknown, not missing.</p>
          <div className="form-actions">
            <Button type="submit" variant="secondary" disabled={savingProfile || analyzing}>
              {savingProfile ? "Saving profile..." : "Save profile"}
            </Button>
            <Button type="button" onClick={() => void handleAnalyze()} disabled={savingProfile || analyzing || loadingProfile}>
              <Sparkles size={14} aria-hidden="true" /> {analyzing ? "Analyzing..." : "Analyze Skill Gap"}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <Notice tone="error">
          {error}
          <Button variant="quiet" onClick={() => void handleAnalyze()} disabled={analyzing || loadingProfile}>
            <RefreshCw size={14} /> Retry analysis
          </Button>
        </Notice>
      )}
      {notice && <Notice tone="success">{notice}</Notice>}
      {analyzing && <LoadingState label="Comparing your profile with the issue and repository..." />}
      {analysis && <SkillGapResults analysis={analysis} />}
    </section>
  );
}
