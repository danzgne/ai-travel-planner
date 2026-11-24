# AI Travel Planner

Class project for CSC13114 (23KTPM1): an agent that builds a day-by-day schedule and spending plan for a trip in Ho Chi Minh City, working only through backend tools.

## Layout

- `apps/api`: the backend (Express 5, TypeScript run directly by Node).

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

## Run the API

```bash
npm run dev
```

The API listens on `http://localhost:3000` (set `PORT` to change it).
