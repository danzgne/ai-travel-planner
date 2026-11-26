# AI-LOG

One entry per task where an assistant did part of the work, written as we go.

## The model inside the product

- Anthropic `claude-haiku-5-5`, called only from the backend. The key has a $5 per month spend limit (README, "Model and secrets").
- What leaves our system: places, menu items, travel times, weather and members' interests. Never names or email addresses.
- Cost of one plan: not measured yet. The agent arrives in PA#3.

## 2026-11-25: plan PA#2 from the rubric and the brief

Tool: Claude Code.
Asked for: read the PA#2 rubric, the AI Travel Planner brief and the IA#3 contract, and turn them into an ordered plan.
Kept: the order. Protect `main` first, then send every change through a PR, so the red check and the deliberate contract break happen in real history.
Changed: nothing. We followed its phases in order.
Rejected: reusing our PA#1 repository. It proposed a different project, so we started a clean one.
By hand: none of the plan text. We gave it the IA#3 `CONTRACT.md` and the session 3 slides (4 to 6) it was missing, and picked `POST /plans/{planId}/save` from the endpoints it shortlisted.

## 2026-11-25: repository scaffold, checks and CI

Tool: Claude Code.
Asked for: an npm workspaces repo with one command each for lint, format check, type check and tests, and a CI that runs the same commands.
Kept: Express 5 in `apps/api`, Vitest + supertest, ESLint + Prettier + `tsc`, one CI job per check plus a gitleaks scan of the whole history. Also the TypeScript 6.0 pin: the latest TypeScript is 7, which typescript-eslint 8 does not support.
Changed: nothing.
Rejected: a Next.js full-stack app. We want a separate API so model keys stay in the backend.
By hand: none of the code. We chose the stack from the three it offered and where the repo lives (`danzgne/ai-travel-planner`).

## 2026-11-25: branch protection on main

Tool: Claude Code, through the GitHub API.
Asked for: protect `main`: PR required, the five CI checks required, branch up to date, no bypass for admins, no force push or deletion.
Kept: all of it, including zero required approvals so one member can merge. We checked it against the settings page by hand (screenshots in PA2.md).
Changed: nothing.
Rejected: nothing.
By hand: the screenshots.

## 2026-11-25: rules file, permissions and secrets

Tool: Claude Code.
Asked for: a first draft of `AGENTS.md`, the permission tiers in `.claude/settings.json`, `.env.example` and the README section on the model key.
Kept: all of it as drafted: `AGENTS.md`, `CLAUDE.md` as a one-line `@AGENTS.md` import, the allow / ask / deny lists in `.claude/settings.json`, `.env.example` and the README section.
Changed: nothing.
Rejected: our own idea of making `CLAUDE.md` a symlink to `AGENTS.md`. Git on Windows checks a symlink out as a one-line text file, so we kept the import.
By hand: the choices it asked us for (Anthropic Haiku, a $5 cap, Claude Code and Codex as our tools), and setting the $5 spend limit in the Claude Console.

## 2026-11-26: write the plan-save contract tests

Tool: Codex.
Asked for: prepare the injectable app and write the contract tests first for PA2 step 1.
Kept: Supertest assertions for all problem types, access rules, check order, replay, concurrency, and plan validation.
Changed: ESLint caught unsafe assignments from Vitest's untyped asymmetric matchers. Codex gave the matcher values type `unknown` before the test commit and kept the assertions.
Rejected: using a later request with a different key to prove a failed save was not cached. The test now retries the same plan and revision after the plan reaches that revision.
Evidence: [red CI run](https://github.com/danzgne/ai-travel-planner/actions/runs/45680538157) and [blocked merge](docs/pa2/plans-save-blocked.webp).

## 2026-11-26: implement the plan-save endpoint

Tool: Codex.
Asked for: implement the save contract for PA2 step 2, then record the workflow.
Kept: route-local body parsing, integer pricing, plan validation, and saved-response replay.
Changed: ESLint caught the first raw-body adapter rejecting with an arbitrary callback value. Codex kept existing errors and converted other failures to an Error before the implementation commit.
Rejected: keeping the replay snapshot aliased to the current in-memory plan. The store copies the successful response when it records the save.
Evidence: [implementation commit](https://github.com/danzgne/ai-travel-planner/commit/5ffcaf0adc7c437a36f1060f7fd3f017a3a94e40) and [workflow record](docs/pa2/plans-save-workflow.md).

## 2026-11-26: deliberate contract break to verify CI gate

Tool: Antigravity (Gemini).
Asked for: break one contract rule in code only on branch `demo/contract-break`, open a PR so CI catches it on `test`, comment with the failing test, and close without merging (PA2 step 3).
Kept: deleting only the 5-line `store.getSaved(id, revision)` replay lookup in `apps/api/src/plans/save.ts` so `lint`, `format`, `typecheck`, and `secrets` stay green while `POST /v1/plans/{planId}/save > replays the original successful body before and after an edit` fails.
Changed: on Windows (`core.autocrlf=true`), `npm run format:check` flagged all 24 checked-out files for CRLF line endings; instead of reformatting unrelated files, we checked `save.ts` directly with Prettier (`--end-of-line auto`) and kept the commit scoped to the 5-line deletion so Linux CI `format` passed.
Rejected: running `npm run format` across the workspace or deleting the `demo/contract-break` branch after closing the PR, so the red commit and PR remain easy for graders to inspect.
By hand: reviewed the diff and local failure output, and approved the commit, push, and PR creation.
Evidence: [PR #5 (closed)](https://github.com/danzgne/ai-travel-planner/pull/5), [commit 61d9221](https://github.com/danzgne/ai-travel-planner/commit/61d92217170e306da2187acda00a295fc441bf37), and [red CI run](https://github.com/danzgne/ai-travel-planner/actions/runs/45750788014).

## 2026-11-26: update AGENTS.md with rules from real incidents

Tool: Antigravity (Gemini).
Asked for: turn real incidents from earlier AI-LOG entries into concise rules in `AGENTS.md` for PA2 step 4, update `AI-LOG.md`, and merge through a PR.
Kept: three incident-backed rules under `Conventions`—cloning stored replay snapshots and normalizing non-`Error` middleware rejections (`2026-11-26: implement the plan-save endpoint`), typing Vitest asymmetric matchers as `unknown` and retrying the same `(planId, revision)` key (`2026-11-26: write the plan-save contract tests`), and keeping `CLAUDE.md` as an `@AGENTS.md` import on Windows (`2026-11-25: rules file, permissions and secrets`).
Changed: combined the replay-cloning and middleware-error lessons from the same implementation entry into one line to keep `AGENTS.md` short.
Rejected: adding a Windows `core.autocrlf` formatting note to `AGENTS.md`; kept it in `AI-LOG.md` only since it is a local Git setting rather than a codebase rule.
By hand: selected which real incidents to promote, approved editing `AGENTS.md`, and authorized committing and merging the PR under `ThangTo`.

## 2026-11-26: rewrite the incident rules in AGENTS.md by hand

Tool: none for the text. Claude Code only committed it and opened the PR.
Asked for: nothing. An assistant had drafted the three rules added in PR #6, so we rewrote them ourselves.
Kept: the two real incidents (a stored replay that pointed at the live plan, and a test that proved "not cached" with a different key) and the note on keeping `CLAUDE.md` as an import.
Changed: moved the two incident rules under Never, cut each to one sentence, and dropped the ESLint details (non-`Error` rejections, untyped Vitest matchers).
Rejected: nothing.
By hand: the whole `AGENTS.md` change in commit "docs: rewrite the incident rules in AGENTS.md by hand".
