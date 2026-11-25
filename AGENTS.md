# AI Travel Planner: rules for coding assistants

## Stack

- npm workspaces. `apps/api`: Express 5 on Node 22.18+, TypeScript run directly by Node (no build step).
- Vitest + supertest for tests, ESLint (typescript-eslint, type-aware), Prettier, `tsc`.
- TypeScript stays on 6.0.x: typescript-eslint 8 does not support TypeScript 7.
- Model: Anthropic `claude-haiku-5-5`, called only from `apps/api`.

## Commands

Run from the repo root. CI runs exactly these, and all four must pass before a task is done.

- `npm run lint`
- `npm run format:check` (fix with `npm run format`)
- `npm run typecheck`
- `npm test`

## Conventions

- A contract in `docs/contract/<endpoint>.md` wins over the code. Change a contract only in its own commit that says why.
- Errors are RFC 9457 problem details (`application/problem+json`). Clients branch on `type`, never on `title` or `detail`.
- Money is an integer number of dong (`...Vnd`), computed by code only.
- Relative imports end in `.ts`. No enums, namespaces or parameter properties (`erasableSyntaxOnly`).
- Commits are `operation: content` (feat, fix, refactor, test, docs, chore). Every change reaches `main` through a PR with green checks.

## Never

- Put a model key anywhere the browser can load it. Keys live in the backend only.
- Call a real model in unit or contract tests. Use a fake model client.
- Edit a test, the eval data or a validator rule to make a check pass. If one looks wrong, stop and say why.
- Send names or email addresses to a model. Only places and interests.
- Make a CI step unable to fail (`|| true`, `continue-on-error`, skipped tests).

## Permissions

Enforced for Claude Code in `.claude/settings.json`. Other tools follow this list as written.

- Allowed: read the code; run the four checks and `npm run format`; `git status`, `git diff`, `git log`; read PRs and CI runs with `gh`.
- Ask first: adding or upgrading a dependency; `git commit`, `git push`, opening or merging a PR; editing `.github/`, `apps/*/test/`, `docs/contract/`, `.claude/` or this file.
- Never: read or print `.env` or any key; force-push or push to `main`; change branch protection or repo settings; `rm -rf`; call a paid model API from a test or script.
