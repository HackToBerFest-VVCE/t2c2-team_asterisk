import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, ExternalLink, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { useAuth } from "../app/AuthContext";
import { Button, EmptyState, LoadingState, Notice, PageTitle } from "../components/ui";
import { SkillGapAnalyzer } from "../components/SkillGapAnalyzer";
import { getIssue, searchIssues, simplifyIssue, type IssueSimplification } from "../lib/issues";
import { generateContributionRoadmap, listSavedRoadmaps, saveContributionRoadmap } from "../lib/roadmaps";
import type { ContributionRoadmap, ContributionRoadmapStep, GitHubIssue, SavedContributionRoadmap } from "../types/domain";

function ExplanationCard({
  title,
  helperText,
  className = "",
  children,
}: {
  title: string;
  helperText?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`simplifier-card ${className}`.trim()}>
      <h2>{title}</h2>
      {helperText && <p className="simplifier-card-helper">{helperText}</p>}
      {children}
    </section>
  );
}

function RoadmapChecklist({
  roadmap,
  saving,
  onStepChange,
}: {
  roadmap: ContributionRoadmap;
  saving: boolean;
  onStepChange: (index: number, completed: boolean) => void;
}) {
  const completedCount = roadmap.steps.filter((step) => step.completed).length;
  const progress = Math.round((completedCount / roadmap.steps.length) * 100);

  return (
    <section className="roadmap-panel" aria-labelledby="roadmap-heading">
      <div className="roadmap-header">
        <div>
          <p className="eyebrow"><CheckCircle2 size={13} aria-hidden="true" /> AI-generated roadmap</p>
          <h2 id="roadmap-heading">Your contribution roadmap</h2>
        </div>
        <p className="roadmap-count" aria-live="polite">
          {completedCount} of {roadmap.steps.length} steps · {progress}% complete
        </p>
      </div>
      <div
        className="roadmap-progress-track"
        role="progressbar"
        aria-label="Roadmap completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="roadmap-disclaimer">
        Suggestions are based on the issue and your profile. Repository files were not inspected; verify
        exact paths, project rules, and commands in the repository before acting.
      </p>
      <ol className="roadmap-steps">
        {roadmap.steps.map((step, index) => (
          <RoadmapStepCard
            key={`${index}-${step.title}`}
            step={step}
            index={index}
            saving={saving}
            onStepChange={onStepChange}
          />
        ))}
      </ol>
    </section>
  );
}

function RoadmapStepCard({
  step,
  index,
  saving,
  onStepChange,
}: {
  step: ContributionRoadmapStep;
  index: number;
  saving: boolean;
  onStepChange: (index: number, completed: boolean) => void;
}) {
  return (
    <li className={`roadmap-step${step.completed ? " roadmap-step-complete" : ""}`}>
      <label className="roadmap-step-check">
        <input
          type="checkbox"
          checked={step.completed}
          disabled={saving}
          onChange={(event) => onStepChange(index, event.target.checked)}
          aria-label={`${step.completed ? "Mark incomplete" : "Mark complete"}: ${step.title}`}
        />
        <span className="roadmap-step-number">{String(index + 1).padStart(2, "0")}</span>
        <span className="roadmap-step-title">{step.title}</span>
      </label>
      <div className="roadmap-step-content">
        <p>{step.explanation}</p>
        <ul>{step.tasks.map((task, taskIndex) => <li key={`${taskIndex}-${task}`}>{task}</li>)}</ul>
      </div>
    </li>
  );
}

export function SimplifierPage() {
  const { user } = useAuth();
  const [keywords, setKeywords] = useState("");
  const [appliedKeywords, setAppliedKeywords] = useState("");
  const [page, setPage] = useState(1);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [listError, setListError] = useState("");
  const [listAttempt, setListAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [loadingIssue, setLoadingIssue] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [simplification, setSimplification] = useState<IssueSimplification | null>(null);
  const [simplifying, setSimplifying] = useState(false);
  const [simplifyError, setSimplifyError] = useState("");
  const [roadmap, setRoadmap] = useState<ContributionRoadmap | null>(null);
  const [savedRoadmaps, setSavedRoadmaps] = useState<SavedContributionRoadmap[]>([]);
  const [loadingRoadmaps, setLoadingRoadmaps] = useState(true);
  const [roadmapLoadingError, setRoadmapLoadingError] = useState("");
  const [roadmapSaving, setRoadmapSaving] = useState(false);
  const [roadmapError, setRoadmapError] = useState("");
  const [roadmapNotice, setRoadmapNotice] = useState("");
  const issueRequest = useRef(0);
  const simplifyRequest = useRef(0);
  const roadmapRequest = useRef(0);
  const perPage = 20;

  useEffect(() => {
    let active = true;
    setLoadingIssues(true);
    setListError("");
    void searchIssues({ keywords: appliedKeywords || undefined, page, perPage, sort: "updated" })
      .then((result) => {
        if (!active) return;
        setIssues(result.items);
        setTotal(result.total_count);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setIssues([]);
        setTotal(0);
        setListError(reason instanceof Error ? reason.message : "Could not load GitHub issues.");
      })
      .finally(() => {
        if (active) setLoadingIssues(false);
      });
    return () => {
      active = false;
    };
  }, [appliedKeywords, page, listAttempt]);

  useEffect(() => {
    let active = true;
    setLoadingRoadmaps(true);
    setRoadmapLoadingError("");
    void listSavedRoadmaps()
      .then((items) => {
        if (active) setSavedRoadmaps(items);
      })
      .catch((reason: unknown) => {
        if (active) setRoadmapLoadingError(reason instanceof Error ? reason.message : "Could not load saved roadmaps.");
      })
      .finally(() => {
        if (active) setLoadingRoadmaps(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function loadIssue(issue: GitHubIssue) {
    const requestId = ++issueRequest.current;
    simplifyRequest.current += 1;
    roadmapRequest.current += 1;
    setSelectedId(String(issue.id));
    setSelectedIssue(null);
    setSimplification(null);
    setIssueError("");
    setSimplifyError("");
    setRoadmap(null);
    setRoadmapError("");
    setRoadmapNotice("");
    setRoadmapSaving(false);
    setSimplifying(false);
    setLoadingIssue(true);
    try {
      const details = await getIssue(issue.owner, issue.repository, issue.number);
      if (requestId === issueRequest.current) {
        setSelectedIssue(details);
        const saved = savedRoadmaps.find((item) => item.issue_id === details.id);
        if (saved) setRoadmap(saved.roadmap);
      }
    } catch (reason) {
      if (requestId === issueRequest.current) {
        setIssueError(reason instanceof Error ? reason.message : "Could not load this GitHub issue.");
      }
    } finally {
      if (requestId === issueRequest.current) setLoadingIssue(false);
    }
  }

  function handleSelect(issueId: string) {
    const issue = issues.find((item) => String(item.id) === issueId);
    if (issue) void loadIssue(issue);
    else {
      issueRequest.current += 1;
      simplifyRequest.current += 1;
      roadmapRequest.current += 1;
      setSelectedId("");
      setSelectedIssue(null);
      setSimplification(null);
      setRoadmap(null);
      setIssueError("");
      setSimplifyError("");
      setRoadmapError("");
      setRoadmapNotice("");
      setRoadmapSaving(false);
      setSimplifying(false);
    }
  }

  async function handleSimplify() {
    if (!selectedIssue) return;
    const requestId = ++simplifyRequest.current;
    const issueId = selectedIssue.id;
    setSimplifying(true);
    setSimplifyError("");
    setSimplification(null);
    try {
      const result = await simplifyIssue(selectedIssue);
      if (requestId === simplifyRequest.current && issueId === selectedIssue.id) setSimplification(result);
    } catch (reason) {
      if (requestId === simplifyRequest.current) {
        setSimplifyError(reason instanceof Error ? reason.message : "Could not simplify this issue.");
      }
    } finally {
      if (requestId === simplifyRequest.current) setSimplifying(false);
    }
  }

  async function handleGenerateRoadmap() {
    if (!selectedIssue) return;
    const requestId = ++roadmapRequest.current;
    setRoadmapSaving(true);
    setRoadmapError("");
    setRoadmapNotice("");
    try {
      const generated = await generateContributionRoadmap(selectedIssue, simplification);
      if (requestId !== roadmapRequest.current) return;
      const saved = await saveContributionRoadmap(selectedIssue, generated);
      if (requestId !== roadmapRequest.current) return;
      setRoadmap(saved.roadmap);
      setRoadmapNotice("Roadmap saved. Your checklist progress is private to your account.");
      setSavedRoadmaps((items) => [saved, ...items.filter((item) => item.issue_id !== saved.issue_id)]);
    } catch (reason) {
      if (requestId === roadmapRequest.current) {
        setRoadmapError(reason instanceof Error ? reason.message : "Could not generate or save the roadmap.");
      }
    } finally {
      if (requestId === roadmapRequest.current) setRoadmapSaving(false);
    }
  }

  async function handleStepChange(stepIndex: number, completed: boolean) {
    if (!selectedIssue || !roadmap || roadmapSaving) return;
    const updated: ContributionRoadmap = {
      ...roadmap,
      steps: roadmap.steps.map((step, index) => index === stepIndex ? { ...step, completed } : step),
    };
    setRoadmapSaving(true);
    setRoadmapError("");
    setRoadmapNotice("");
    try {
      const saved = await saveContributionRoadmap(selectedIssue, updated);
      setRoadmap(saved.roadmap);
      setSavedRoadmaps((items) => [saved, ...items.filter((item) => item.issue_id !== saved.issue_id)]);
    } catch (reason) {
      setRoadmapError(reason instanceof Error ? reason.message : "Could not save your checklist progress.");
    } finally {
      setRoadmapSaving(false);
    }
  }

  async function handleOpenSavedRoadmap(saved: SavedContributionRoadmap) {
    const requestId = ++issueRequest.current;
    simplifyRequest.current += 1;
    roadmapRequest.current += 1;
    setSelectedId("");
    setSelectedIssue(null);
    setSimplification(null);
    setRoadmap(null);
    setIssueError("");
    setSimplifyError("");
    setRoadmapError("");
    setRoadmapNotice("");
    setRoadmapSaving(false);
    setSimplifying(false);
    setLoadingIssue(true);
    try {
      const issue = await getIssue(saved.owner, saved.repository, saved.issue_number);
      if (requestId !== issueRequest.current) return;
      setSelectedIssue(issue);
      setRoadmap(saved.roadmap);
      setRoadmapNotice("Opened your saved roadmap. Checklist changes are saved automatically.");
    } catch (reason) {
      if (requestId === issueRequest.current) {
        setIssueError(reason instanceof Error ? reason.message : "Could not reopen this roadmap's issue.");
      }
    } finally {
      if (requestId === issueRequest.current) setLoadingIssue(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    issueRequest.current += 1;
    simplifyRequest.current += 1;
    roadmapRequest.current += 1;
    setSelectedId("");
    setSelectedIssue(null);
    setSimplification(null);
    setRoadmap(null);
    setIssueError("");
    setSimplifyError("");
    setRoadmapError("");
    setRoadmapNotice("");
    setSimplifying(false);
    setRoadmapSaving(false);
    setPage(1);
    setAppliedKeywords(keywords.trim());
    setListAttempt((attempt) => attempt + 1);
  }

  const selectedSummary = issues.find((item) => String(item.id) === selectedId);
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      <PageTitle
        eyebrow="AI issue simplifier"
        title="Make an issue easier to understand"
        description="Choose an issue from the live GitHub results, review its original details, and get a beginner-friendly explanation grounded in that issue."
      />
      <form className="simplifier-search" onSubmit={submitSearch}>
        <div className="field">
          <label htmlFor="simplifier-keywords">Find an issue</label>
          <input
            className="filter-input"
            id="simplifier-keywords"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
            placeholder="Search issues by keyword"
            maxLength={80}
          />
        </div>
        <Button type="submit" disabled={loadingIssues}>Search issues</Button>
      </form>

      <section className="simplifier-picker panel" aria-labelledby="issue-picker-heading">
        <div className="panel-heading">
          <h2 id="issue-picker-heading">Select a GitHub issue</h2>
          {!loadingIssues && <span className="issue-meta">{total.toLocaleString()} results</span>}
        </div>
        {listError && (
          <Notice tone="error">
            {listError}
            <Button variant="quiet" onClick={() => setListAttempt((attempt) => attempt + 1)}>
              <RefreshCw size={14} /> Retry search
            </Button>
          </Notice>
        )}
        {loadingIssues ? <LoadingState label="Loading real issues from GitHub..." /> : issues.length ? (
          <>
            <label className="field" htmlFor="simplifier-issue">
              Issue from the current results
              <select
                id="simplifier-issue"
                className="filter-select"
                aria-label="Select a GitHub issue"
                value={selectedId}
                onChange={(event) => handleSelect(event.target.value)}
              >
                <option value="">Choose an issue…</option>
                {issues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.repository_full_name} #{issue.number} — {issue.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="simplifier-pagination">
              <Button variant="secondary" disabled={page <= 1} onClick={() => {
                handleSelect("");
                setPage((current) => current - 1);
              }}>Previous</Button>
              <span className="issue-meta">Page {page} of {pageCount}</span>
              <Button variant="secondary" disabled={page >= pageCount || page >= 50} onClick={() => {
                handleSelect("");
                setPage((current) => current + 1);
              }}>Next</Button>
            </div>
          </>
        ) : !listError ? (
          <EmptyState title="No issues found" description="Try another search. Results come from the GitHub Issues API." />
        ) : null}
      </section>

      <section className="saved-roadmaps-panel panel" aria-labelledby="saved-roadmaps-heading">
        <div className="panel-heading">
          <h2 id="saved-roadmaps-heading">Saved roadmaps</h2>
          {loadingRoadmaps && <span className="issue-meta">Loading…</span>}
        </div>
        {roadmapLoadingError ? <Notice tone="error">{roadmapLoadingError}</Notice> : savedRoadmaps.length ? (
          <div className="saved-roadmaps-list">
            {savedRoadmaps.map((saved) => {
              const completed = saved.roadmap.steps.filter((step) => step.completed).length;
              return (
                <button className="saved-roadmap-link" key={saved.id} onClick={() => void handleOpenSavedRoadmap(saved)}>
                  <span><strong>{saved.issue_title}</strong><small>{saved.owner}/{saved.repository} #{saved.issue_number}</small></span>
                  <span className="saved-roadmap-progress">{completed}/{saved.roadmap.steps.length} complete</span>
                </button>
              );
            })}
          </div>
        ) : !loadingRoadmaps ? (
          <p className="issue-meta">Your generated roadmaps will appear here so you can reopen them later.</p>
        ) : null}
      </section>

      {loadingIssue && <LoadingState label="Fetching the latest issue details from GitHub..." />}
      {issueError && (
        <Notice tone="error">
          {issueError}
          {selectedSummary && (
            <Button variant="quiet" onClick={() => void loadIssue(selectedSummary)}>
              <RefreshCw size={14} /> Retry loading issue
            </Button>
          )}
        </Notice>
      )}

      {selectedIssue && (
        <>
          <section className="simplifier-source panel" aria-labelledby="source-issue-heading">
            <div className="simplifier-section-heading">
              <div>
                <p className="eyebrow">Source: GitHub issue</p>
                <h2 id="source-issue-heading">{selectedIssue.title}</h2>
              </div>
              <a className="button button-secondary" href={selectedIssue.html_url} target="_blank" rel="noreferrer">
                Open original <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
            <p className="simplifier-repository">
              {selectedIssue.repository_full_name} · Issue #{selectedIssue.number}
              {selectedIssue.language ? ` · ${selectedIssue.language}` : ""}
            </p>
            <div className="label-row">
              {selectedIssue.labels.map((label) => <span className="label-chip" key={label.name}>{label.name}</span>)}
              {!selectedIssue.labels.length && <span className="issue-meta">No labels</span>}
            </div>
            <details className="simplifier-original-details">
              <summary>Read the original issue description</summary>
              <div className="simplifier-issue-body">
                {selectedIssue.body || "The issue author did not provide a description."}
              </div>
            </details>
          </section>

          <div className="simplifier-action">
            <Button onClick={() => void handleSimplify()} disabled={simplifying}>
              <Sparkles size={15} aria-hidden="true" />
              {simplifying ? "Simplifying..." : "Simplify Issue"}
            </Button>
            {simplifying && <span role="status" className="issue-meta">Generating an explanation from the issue details…</span>}
          </div>
          {simplifyError && (
            <Notice tone="error">
              {simplifyError}
              <Button variant="quiet" onClick={() => void handleSimplify()} disabled={simplifying}>
                <RefreshCw size={14} /> Retry
              </Button>
            </Notice>
          )}

          <section className="roadmap-launch panel" aria-labelledby="roadmap-launch-heading">
            <div>
              <p className="eyebrow">Personalized contribution plan</p>
              <h2 id="roadmap-launch-heading">Turn this issue into a series of manageable steps</h2>
              <p>Uses your saved developer profile and the live issue. The simplified explanation is included when available.</p>
            </div>
            <Button onClick={() => void handleGenerateRoadmap()} disabled={roadmapSaving}>
              <Sparkles size={15} aria-hidden="true" />
              {roadmapSaving ? "Generating or saving..." : roadmap ? "Generate Roadmap Again" : "Generate Roadmap"}
            </Button>
          </section>
          {roadmapError && (
            <Notice tone="error">
              {roadmapError}
              {roadmapError.toLowerCase().includes("profile") && (
                <Button variant="quiet" to="/onboarding">Complete your profile</Button>
              )}
            </Notice>
          )}
          {roadmapNotice && <Notice tone="success">{roadmapNotice}</Notice>}
          {roadmapSaving && <LoadingState label="Generating or saving your personalized roadmap..." />}
          {roadmap && (
            <RoadmapChecklist
              roadmap={roadmap}
              saving={roadmapSaving}
              onStepChange={handleStepChange}
            />
          )}

          {simplification && (
            <section className="simplifier-results" aria-labelledby="simplification-heading">
              <div className="simplifier-results-heading">
                <div>
                  <p className="eyebrow"><Lightbulb size={13} aria-hidden="true" /> AI-generated explanation</p>
                  <h2 id="simplification-heading">The issue, in plain English</h2>
                  <p className="simplifier-reading-guide">Start with the problem, then see what change is requested. Compare the explanation with the original GitHub issue above.</p>
                </div>
                <span className="ai-disclaimer">Suggestions are generated from this issue; verify details with the maintainers.</span>
              </div>
              <div className="simplifier-card-grid">
                <ExplanationCard
                  title="1. What is the problem?"
                  helperText="A short summary of what is not working or what needs attention."
                  className="simplifier-card-primary"
                >
                  <p>{simplification.problem_plain_english}</p>
                </ExplanationCard>
                <ExplanationCard
                  title="2. What change is requested?"
                  helperText="The task the issue is asking contributors to work on."
                >
                  <p>{simplification.what_needs_to_be_done}</p>
                </ExplanationCard>
                <ExplanationCard
                  title="3. Why does it matter?"
                  helperText="Why the issue says this problem is worth fixing."
                >
                  <p>{simplification.why_it_matters}</p>
                </ExplanationCard>
                <ExplanationCard
                  title="4. What should happen after the fix?"
                  helperText="The result described by the issue. If it is not clear, the explanation says so."
                >
                  <p>{simplification.expected_outcome}</p>
                </ExplanationCard>
                <ExplanationCard
                  title="5. Words you may not know"
                  helperText="Simple definitions for technical words used in the issue."
                >
                  {simplification.technical_terms.length ? (
                    <ul>
                      {simplification.technical_terms.map(({ term, explanation }) => (
                        <li key={`${term}-${explanation}`}><strong>{term}:</strong> {explanation}</li>
                      ))}
                    </ul>
                  ) : <p>No specific technical terms were identified in the issue.</p>}
                </ExplanationCard>
              </div>
            </section>
          )}
          {simplification && (
            <section className="simplifier-source-criteria" aria-label="Acceptance criteria from GitHub issue">
              <p className="eyebrow">Copied from the original GitHub issue</p>
              <ExplanationCard
                title="How will the change be checked?"
                helperText="These checklist items are copied from the issue, not written by the AI."
              >
                {simplification.acceptance_criteria.length ? (
                  <ul>{simplification.acceptance_criteria.map((criterion, index) => <li key={`${index}-${criterion}`}>{criterion}</li>)}</ul>
                ) : <p>The issue does not provide a clearly labeled acceptance-criteria section.</p>}
              </ExplanationCard>
            </section>
          )}
          <SkillGapAnalyzer issue={selectedIssue} simplification={simplification} />
        </>
      )}
    </>
  );
}
