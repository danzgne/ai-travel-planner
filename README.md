# AI Travel Planner

Class project for CSC13114 (23KTPM1): an agent that builds a day-by-day schedule and spending plan for a trip in Ho Chi Minh City, working only through backend tools.

## Layout

- `apps/api`: the backend (Express 5, TypeScript run directly by Node).
- `AGENTS.md`: rules and permissions for coding assistants (`CLAUDE.md` imports it).
- `AI-LOG.md`: what the assistants did, and what we kept, changed or rejected.

## Requirements

- Node.js 22.18 or newer (CI uses the version in `.nvmrc`)
- npm

## Setup

```bash
npm ci
```

## Checks

Each check is one command. CI (`.github/workflows/ci.yml`) runs these exact commands on every pull request, on `main` and on `pa*` tags.

| Check        | Command                |
| ------------ | ---------------------- |
| Lint         | `npm run lint`         |
| Format check | `npm run format:check` |
| Type check   | `npm run typecheck`    |
| Tests        | `npm test`             |

`npm run format` rewrites files to match the formatter. CI also scans the full git history for secrets with gitleaks.

## Model and secrets

- The agent uses Anthropic `claude-haiku-5-5`, called only from `apps/api`. The key never reaches the browser.
- The Anthropic API key belongs to its own Claude Console workspace with a spend limit of **$5 per month**, so a runaway loop cannot cost more than that.
- Copy `.env.example` to `.env` and fill it in. `.env` is git-ignored, and CI scans the whole git history for secrets.

## Run the API

```bash
npm run dev
```

The API listens on `http://localhost:3000` (set `PORT` to change it).
