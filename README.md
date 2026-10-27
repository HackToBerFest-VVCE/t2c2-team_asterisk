# OpenSource Buddy

OpenSource Buddy helps developers discover real public GitHub issues that fit their skills, experience, and interests. Issue results come from the official GitHub REST API; the app does not ship sample issues. Match scores are transparent estimates, not guarantees that an issue is suitable.

## What is included

- Responsive React, Vite, TypeScript, and Tailwind application.
- Supabase email/password authentication, private developer profiles, saved issues, and contribution progress.
- GitHub issue search, filtering, pagination, five-minute search/issue caching, and a server-side optional GitHub token.
- Local AI contribution mentor backend re-fetches the selected issue and available README/contribution guidelines through GitHub's API. OpenRouter is optional and called server-side; a non-AI starter guide is available without its key.
- PostgreSQL migration with indexes, foreign keys, checks, and Row Level Security.
- Unit/UI tests plus GitHub Actions for validation and optional backend deployment.

## Repository layout

```text
src/
  app/                 Routing, app shell, and authentication state
  components/          Shared forms, issue cards, and UI primitives
  lib/                 Supabase, GitHub Edge Function client, matching, profiles
  pages/                Landing, auth, onboarding, dashboard, explorer, detail,
                        mentor, saved issues, and profile pages
  types/                Domain types
  styles.css            Tailwind directives and responsive design system
server/
  ai-mentor.ts           Authenticated local OpenRouter API handler
supabase/
  config.toml           Edge Function JWT settings
  migrations/           PostgreSQL schema and RLS
  functions/
    _shared/            CORS, GitHub API, and request helpers
    search-issues/       Public GitHub search/detail endpoint and cache
    contribution-guide/ Legacy authenticated guide endpoint (not used by current mentor UI)
tests/                  Matching, API error handling, and UI tests
.github/workflows/      CI and optional Supabase deployment
```

## Browser-based setup

You do not need to install VS Code or a local toolchain to deploy or maintain the app. Use the GitHub and provider dashboards in a browser; GitHub Actions runs tests/builds and can deploy the backend.

### 1. Create Supabase project and schema

1. Create a project from the [Supabase Dashboard](https://supabase.com/dashboard).
2. Open **Project Settings → API**. Copy the Project URL and the public anon/publishable key into your local `.env` file as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. These are public browser credentials; never use a `service_role` or secret key here.
3. Apply the SQL migrations in filename order. In the Supabase SQL Editor, run the migration files in `supabase/migrations/` timestamp order, including `20261027135000_contribution_roadmaps.sql` and `20261027141000_profile_skill_gap.sql`. Alternatively, use the documented GitHub Actions migration deployment workflow.
4. Under **Authentication → URL Configuration**, add `http://localhost:5173` as a redirect URL. Configure email confirmation and SMTP according to your account needs.

### 2. Deploy the Edge Functions and configure secrets

The GitHub Actions workflow `.github/workflows/supabase-deploy.yml` applies migrations and deploys the GitHub issue search Edge Function. In GitHub, open **Settings → Secrets and variables → Actions** and add:

- Repository variable `SUPABASE_PROJECT_REF`: the project reference shown in Supabase Project Settings.
- Repository secret `SUPABASE_ACCESS_TOKEN`: a Supabase access token created in the Supabase account dashboard.
- Repository secret `SUPABASE_DB_URL`: the project's database connection string. Treat it as a password.

The workflow runs on pushes to `main` that change `supabase/`, or on demand from the **Actions** tab. If the migration was already applied manually, the workflow's migration step will safely recognize it.

In Supabase **Edge Functions → Secrets**, configure:

- `GITHUB_TOKEN` (optional): a fine-grained GitHub token with public repository read access. Without it, search uses GitHub's lower unauthenticated rate limit. Keep it server-side.
- `OPENROUTER_API_KEY` (required for Issue Simplifier): the key used by the `simplify-issue` Edge Function. It is never sent to or included in the browser app.
- `OPENROUTER_MODEL` (optional): OpenRouter model identifier; defaults to `openai/gpt-4o-mini`.

Search works without `GITHUB_TOKEN`, within GitHub's unauthenticated search limits. Do not add server-side secrets with a `VITE_` prefix.

The AI Mentor runs locally as Vite server middleware at `/api/ai-mentor` (`server/ai-mentor.ts`). It verifies the Supabase access token, re-fetches the issue and repository docs from GitHub, and saves guides through the caller's existing RLS permissions. OpenRouter is called only from the local Node server, never from React. `OPENROUTER_API_KEY` is optional: without it, the API returns a non-AI starter guide based on the live issue and any available docs. Optionally set `OPENROUTER_MODEL` and `GITHUB_TOKEN` in the ignored `.env.local` file; never prefix server secrets with `VITE_`.

### Deploy the frontend and AI Mentor to Vercel

The production deployment uses one Vercel project rooted at this repository. Vite builds the React app to `dist/`; `api/ai-mentor.ts` is a Vercel Node Function that adapts the existing authenticated mentor handler. This repository does not contain an Express server or require Express: using the Vercel serverless API route fits the existing Vite middleware architecture and keeps the browser and mentor API same-origin at `/api/ai-mentor`. The Vite middleware remains available for local development. GitHub issue search and the Simplifier, roadmap, and Skill Gap Analyzer continue to use Supabase Edge Functions; Vercel does not replace those functions.

In the Vercel project dashboard, import `DarshanR2006ivory/opensource-buddy-desktop` and set **Root Directory** to the repository root. The checked-in `vercel.json` selects Vite, `npm ci`, `npm run build`, `dist`, a 60-second function execution limit, and filesystem-first routing so `/api/ai-mentor` resolves as a function while application routes fall back to `index.html`. The function entry point sets a 24kb request-body limit; the external AI request times out after 45 seconds to leave time for authentication, GitHub context, and guide persistence. Do not add a production-domain rewrite or configure a separate backend project.

Add these project environment variables for **Production** and **Preview** (Development is optional):

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL, used by the browser and the mentor function for session verification. |
| `VITE_SUPABASE_ANON_KEY` | Yes | Existing Supabase anon/publishable key. It is intentionally public in the browser; Supabase Auth and RLS enforce authorization. |
| `OPENROUTER_API_KEY` | No | Server-only OpenRouter credential for AI-generated Mentor guides. Without it, the authenticated Mentor provides its non-AI fallback. Never use a `VITE_` prefix. |
| `OPENROUTER_MODEL` | No | Optional server-side model override; defaults to `openai/gpt-4o-mini`. |
| `GITHUB_TOKEN` | No | Optional server-only GitHub token to reduce rate-limit risk while the Mentor reads public issues and repository documentation. |
| `APP_ORIGIN` | No | Optional exact app origin for additional CORS validation. Usually omit it; the handler permits the same origin based on the incoming Vercel host. Do not enter a localhost URL in Production. |

Do not configure `SUPABASE_SERVICE_ROLE_KEY` in the frontend or for this mentor route; it uses the public anon key with the caller's verified Supabase bearer token and existing RLS policies. `OPENROUTER_API_KEY` is also required separately in **Supabase → Edge Functions → Secrets** for the Simplifier, contribution roadmap, and Skill Gap Analyzer. Configure `GITHUB_TOKEN` there as well if GitHub issue search needs the higher rate limit. These Edge Function secrets are not supplied by Vercel environment variables.

After Vercel provides the project URL, open **Supabase → Authentication → URL Configuration** and set the production **Site URL** to that exact origin. Add the production URL and any intended Vercel preview URL patterns to **Redirect URLs**. Retain the local development redirect if needed. No production URL is hardcoded in the app.

For browser-based deployment, connect the GitHub repository in Vercel, add the variables above, and deploy from the Vercel dashboard. For a CLI deployment after reviewing and pushing the code, use `npx vercel` for a Preview deployment and `npx vercel --prod` for Production from the repository root. This task does not run either deployment command. After deployment, verify a deep-link refresh, Supabase sign-in/session persistence, issue search, and the Mentor API with and without `OPENROUTER_API_KEY`; also verify saved issues and guides under RLS.

### 3. Local development

For a local development environment, use Node.js 20 or newer. The Supabase JS dependency is already included in this repository:

```sh
npm ci
# Windows PowerShell (only if .env.local does not already exist):
Copy-Item .env.example .env.local
# macOS/Linux (only if .env.local does not already exist):
cp .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. OPENROUTER_API_KEY is optional.
npm run dev
npm test
npm run build
```

Open `http://localhost:5173`. The same Vite dev server serves the frontend and local `/api/ai-mentor` backend. Supabase Edge Functions continue to provide GitHub issue search.

The checked-out project currently contains a React/Vite web app and does not contain a Tauri 2 shell (`src-tauri`/Tauri dependencies). The same Vite client module can be used by a future Tauri wrapper, but no Tauri packaging or native runtime integration is present or claimed here.

## Product behavior and data

- **Explore** searches public, open issues through `search-issues`; filters include language, beginner-friendly labels, keywords, repository, sort, and page. A selected language is verified against the repository metadata API (cached for 24 hours), because GitHub's issue-search endpoint does not filter by repository language. The result count shows GitHub issue candidates before language filtering, not a global count of verified matches.
- **Issue details** show the API-returned title, description, labels, repository, and original issue link.
- **Issue Simplifier** is available to signed-in users from the navigation. It searches the existing live issue service, fetches the selected issue details, and asks the authenticated `simplify-issue` Edge Function to fetch the latest public GitHub issue and call OpenRouter. Original issue details and explicitly labeled acceptance criteria are shown separately from AI-generated explanations. The server extracts acceptance criteria verbatim only from a clearly labeled section in the source issue; it does not invent project requirements. No guide or issue is saved by this feature.
- **Recommendations** compare profile terms to issue text and show a per-factor score for skill/interest overlap, experience fit, beginner-friendly signals, clarity, and freshness. Some signals are heuristics; always review the issue and repository.
- **Saved issues** are private to the signed-in user. Progress statuses are held in `contribution_progress`; saved references are in `saved_issues`.
- **Mentor** can be launched with **Ask AI Mentor** from an issue card or issue detail page. The authenticated local server route re-fetches the canonical issue, repository README, and contribution guidelines (when available) through the GitHub REST API, then optionally calls OpenRouter. If `OPENROUTER_API_KEY` is not set, it returns a labeled non-AI starter guide instead of failing. It shows the original issue, setup workflow, contribution plan, testing checklist, pull-request explanation, and source links; exact file suggestions are retained only when named in the issue or fetched docs. The source tree is not fetched, and no code/tests are claimed to have been changed or run. Guides are saved to `contribution_guides` through the authenticated Supabase session and RLS. Issue progress continues to use `contribution_progress`. The older Supabase `contribution-guide` function remains for compatibility but the UI does not call it.
- **Contribution roadmap** is available for selected issues in the Simplifier. The authenticated `generate-roadmap` Edge Function loads the user's profile under their session, fetches the latest public GitHub issue, and returns seven ordered AI-generated steps. Roadmaps and checkbox changes are saved in `contribution_roadmaps` under user-scoped RLS; users can reopen saved roadmaps. README/contribution-guideline review is included as an action, but repository files are not fetched or asserted to exist. Exact paths, project instructions, commands, and tests must be discovered and verified by the contributor. The simplified explanation is included only when one is already available.
- **Skill Gap Analyzer** compares a selected issue and GitHub repository metadata with the user's private profile. It supports languages, frameworks/tools, experience, skills to practice, and related project experience. Skill statuses and difficulty are estimates; only a profile match is marked **Known**, user-listed learning goals can be marked **Learn**, and an unlisted skill is **Needs Practice** with low confidence—not assumed missing. Preparation exercises are suggestions, and documentation links come from a curated official-documentation list. The analysis is not persisted; the profile fields use the existing `profiles` row and RLS.
- **Cache** stores public issue metadata and paginated search results in Supabase for five minutes, and repository languages for 24 hours. A cache write failure is surfaced while the successful live GitHub result is still shown. GitHub errors and rate limits are returned explicitly.
- **RLS** keeps profiles, saved references, guides, and progress scoped to `auth.uid()`. Cached public issue metadata is readable; search cache and GitHub issue writes are server-side. The profile and user-owned record operations use the signed-in user's session and RLS policies, not the service-role key.

## Supabase profile and user-data access

`src/lib/supabase.ts` creates the single browser client only when `VITE_SUPABASE_URL` is valid and both values are present. The app shows a startup setup notice listing missing/invalid variables. Only the public anon/publishable key belongs in Vite; never configure a `service_role` or secret key there. `.env.example` intentionally contains empty values; local `.env` is ignored by Git.

The data services use the existing migration schema without renaming columns:

- `profiles`: `id`, `languages`, `skills`, `experience_level`, `interests`, `project_types`, `github_username`, and `updated_at`; profile retrieval and upsert are scoped to the signed-in user's `auth.uid()`.
- `saved_issues`: the existing `(user_id, issue_id)` relation. Saving is an upsert (re-saving refreshes `created_at`), listing is scoped to the current user, and removal deletes only that user's relation. There is no separate mutable saved-issue payload column; progress belongs in `contribution_progress`.
- `contribution_guides`: new guide creation is performed by the authenticated local `server/ai-mentor.ts` route using the user's Supabase token and existing RLS insert policy. The older Supabase contribution-guide function remains but is not used by the current UI. Users can list/read, update the JSON guide, and delete only their own guide rows; migrations preserve the original columns.
- `contribution_progress`: status upsert/update, reads alongside the user's saved issues, and delete are scoped to the current user.

### Manual database and user-isolation check

1. Apply both migrations in order and deploy the Supabase Edge Functions. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` locally; restart Vite after editing env files.
2. Register two test accounts (User A and User B). Sign in as A, create/update the profile, save an issue, change its progress, and generate a mentor guide. Confirm each operation shows its loading/success state and the records appear after reload.
3. Sign in as B. Confirm B sees only B's profile, saved issues, progress, and guides. In the Supabase API/SQL editor, test with authenticated sessions if verifying direct RLS denial: selecting or changing A's records as B must return no accessible rows or an RLS error, never A's data.
4. As A, delete a guide and remove a saved issue; confirm they disappear for A and remain inaccessible to B. Confirm B cannot update/delete A's records.
5. Temporarily clear either Vite variable and restart the app. Confirm the startup banner identifies the missing variable; restore the values afterward.

These are manual validation steps, not a claim that authenticated CRUD or cross-user isolation was tested against the supplied live project. No test account was available for this session.

### Test the local AI Mentor API

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` or `.env.local`. For AI-generated guidance, set `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`) in `.env.local`. Without the AI key, the non-AI starter guide remains available. Optionally set a public-repository `GITHUB_TOKEN` server-side to increase GitHub API rate limits. Never use `VITE_` for secrets. Restart `npm run dev` after changing server-side environment variables.
2. Run `npm run dev`, open `http://localhost:5173`, and sign in. The Vite server serves both the app and `POST /api/ai-mentor`; no Vercel CLI or deployment is used.
3. Select **Ask AI Mentor** on a real issue. The server validates the Supabase session, re-fetches the issue and repository documentation from GitHub, and then either calls OpenRouter or returns the non-AI fallback. It saves the guide in the existing `contribution_guides` table under RLS. Retry failures and use **Copy guide** to copy the sections.
4. Confirm README and contribution links appear only when GitHub returns those documents; missing docs are identified instead of guessed. Confirm unauthenticated calls return 401 and unsupported methods return 405. Verify guide ownership using two test users.

The guide includes a plain-English issue explanation, prerequisites, a documentation-informed setup workflow, ordered contribution steps, supported file/code-area suggestions, a testing checklist, and a beginner-friendly pull-request explanation. GitHub issue and documentation contents are treated as untrusted source data. The source tree is not fetched; project-specific paths are accepted only when present in the issue or fetched documents, and commands are not claimed as run. The API input is size-limited, GitHub requests have bounded timeouts, issue URLs must match the requested repository, and each OpenRouter attempt has a 45-second timeout. A server-side `GITHUB_TOKEN` is optional and never included in the browser bundle.

### Test the Issue Simplifier

1. In Supabase **Edge Functions → Secrets**, set `OPENROUTER_API_KEY`; optionally set `OPENROUTER_MODEL`. Never put these values in a `VITE_` variable.
2. Deploy `simplify-issue` using the `supabase-deploy.yml` GitHub Actions workflow, or run `supabase functions deploy simplify-issue --project-ref <project-ref>` from the repository after linking the Supabase CLI.
3. Sign in to the app and open **Simplify issue**. Search and select a live issue, review the GitHub-sourced title, description, repository, and labels, then choose **Simplify Issue**. If generation fails, use **Retry**.
4. The Edge Function verifies the caller's Supabase JWT, fetches issue details from GitHub by owner/repository/number, and calls OpenRouter with the key held in Supabase secrets. Missing keys, invalid sessions, GitHub rate limits, and provider errors are returned explicitly; the function does not present fallback text as an AI response.

Acceptance criteria are copied from bullet items beneath an explicitly labeled `Acceptance Criteria`, `Acceptance Tests`, or `Definition of Done` heading in the GitHub issue. If there is no such section, the UI says so. Other explanation sections are AI-generated and should be checked against the original issue; no repository files or contribution instructions are inferred.

### Test contribution roadmaps

1. Apply `20261027135000_contribution_roadmaps.sql` after the existing migrations and deploy the Supabase `generate-roadmap` function (the GitHub Actions workflow deploys it automatically after the migrations).
2. Set `OPENROUTER_API_KEY` in **Supabase → Edge Functions → Secrets**. The function also uses the authenticated user's existing `profiles` row; complete onboarding before generating a personalized roadmap.
3. Sign in, open **Simplify issue**, select a GitHub issue, and choose **Generate Roadmap**. Run **Simplify Issue** first if you want its explanation included as additional context.
4. Mark checklist items complete/incomplete and reload the page; the roadmap should remain under **Saved roadmaps** with the same progress. Reopen it from that list. RLS restricts roadmap rows to their owner.

The function fixes the seven step titles and their order; AI supplies the explanation and actionable task lists. Since the repository tree is not inspected, it does not generate exact file paths, project commands, code snippets, or claims that tests ran. Review the roadmap against the issue and repository instructions before following it.

### Test the Skill Gap Analyzer

1. Apply all SQL migrations in timestamp order, including `20261027141000_profile_skill_gap.sql`, then deploy `analyze-skill-gap` (the GitHub Actions workflow deploys it automatically).
2. Ensure `OPENROUTER_API_KEY` is configured in Supabase Edge Function Secrets. The function loads the signed-in user's `profiles` row through RLS and obtains issue and repository details from GitHub's REST API.
3. On **Simplify issue**, select an issue, enter or update languages, known frameworks/tools, learning goals, experience level, and related projects. **Analyze Skill Gap** saves the profile first, then displays skill sections, preparation exercises, available curated documentation links, and an estimated difficulty.
4. An unlisted skill is shown as an uncertain estimate and is not treated as proof the user lacks it. Repository file contents are not inspected, and no exact implementation path or command is claimed.

## Issue match scoring

Each candidate gets five independently normalized component scores from 0 to 100. The overall score is the weighted sum:

```text
overall = round(
  skill_match × 0.35
  + experience_difficulty_fit × 0.25
  + beginner_friendly_labels × 0.15
  + description_clarity × 0.15
  + freshness × 0.10
)
```

| Component | Weight | Heuristic |
| --- | ---: | --- |
| Skill match | 35% | Percentage of the developer's distinct language, skill, and interest terms matched against issue title/body/labels/repository. Programming languages use exact repository-language metadata when available; otherwise they are matched against issue text. No profile terms yields 0 until the developer adds preferences. |
| Experience and difficulty fit | 25% | Compare experience preference with a difficulty hint inferred from labels (`beginner`/`easy`/`good first issue`, `intermediate`/`medium`, or `advanced`/`hard`). The fit scores (developer experience × inferred difficulty) are: beginner × beginner/intermediate/advanced = 100/70/45; intermediate = 50/100/75; advanced = 20/60/100. Missing, conflicting, or unrecognized difficulty signals use a neutral 60. |
| Beginner-friendly labels | 15% | Recognized beginner labels score 100; `help wanted` alone scores 40; otherwise 0. |
| Issue description clarity | 15% | Start at 20 for fewer than 40 characters, 40 for 40–119, or 60 for 120 or more. Add 15 for section headings, 15 for explicit requirement phrases, and 10 for actionable details, capped at 100. Missing descriptions score 0. |
| Freshness | 10% | Updates within 7/30/90/180 days score 100/80/60/35, respectively; older issues score 10. Missing or invalid dates use a neutral 50. |

Every result displays all five component values as `0–100`, its configured weight and weighted points, plus the explanation used for that issue/profile pair. Edit languages, skills, interests, or experience in onboarding/profile settings to recalculate; matching is computed from the current profile and issue data at render time, not written as a new database record on refresh.

These scores prioritize discovery, not suitability. Label conventions differ between projects; a label is a weak difficulty hint, and difficulty **cannot be reliably determined from labels alone**. Description length/structure is not a measure of correctness or implementation effort. Repository language is a single primary-language field and may not reflect the files touched by an issue. Review the linked issue, current repository contribution instructions, and maintainer discussion before choosing work.

## Environment and security notes

`.env.example` contains placeholders only. The frontend uses the Supabase URL and public anon/publishable key. The optional OpenRouter key and GitHub token are loaded by server-side code from `.env.local` for local development and are never exposed to the browser. The GitHub issue Edge Function can separately use `GITHUB_TOKEN` in Supabase Edge Function secrets. Never commit `.env` or paste secrets into client code.

GitHub API search calls are made server-side from Supabase Edge Functions; GitHub HTML pages are not scraped. Search and AI requests validate their inputs, use bounded timeouts, and produce explicit errors for invalid responses, rate limits, and unavailable services. The local AI Mentor needs the local backend and Supabase configuration; OpenRouter is optional and its absence activates the non-AI fallback. The Issue Simplifier, contribution roadmap, and Skill Gap Analyzer use the Supabase `OPENROUTER_API_KEY` Edge Function secret. No AI or GitHub key is exposed to the browser. Tests use mocked provider responses; no live OpenRouter or authenticated Supabase write is claimed until configured and tested.

## Testing the GitHub Issues integration

The deployed `search-issues` Supabase Edge Function calls the official `GET https://api.github.com/search/issues` endpoint. It requests 20 issues by default, caps each request at 20, and clamps pagination to pages 1–50. Search always includes `is:issue is:open`; keywords, repository, and beginner-friendly label qualifiers are added as requested. Programming-language filtering is verified against the GitHub repository API because the issue-search endpoint does not filter by repository language. That repository-language metadata is cached for 24 hours.

The function also caches normalized issue and search results in Supabase for five minutes. Unauthenticated public GitHub API requests are used when `GITHUB_TOKEN` is absent; to raise GitHub's rate limits, add a fine-grained token with public repository read access to **Supabase → Edge Functions → Secrets**. Keep the token there: it is only attached by the server-side function and is never exposed in the browser bundle. AI is not required for issue search.

To verify locally, run `npm ci` followed by `npm test` and `npm run build`. `tests/aiMentorApi.test.ts` mocks Supabase authentication, GitHub issue/docs responses, and OpenRouter; it checks the non-AI fallback when the key is absent, source links, authenticated guide saving, invalid sessions, URL validation, rate limits, and method handling. No live API credentials are required. `npm run dev` runs both the frontend and mentor API locally.

## Checks

```sh
npm test
npm run build
```