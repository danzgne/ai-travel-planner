# Self-assessment: PA#2

Submitted by:

- 23127166, Nguyễn Hoàng Đăng
- 23127260, Tô Minh Thắng
- 23127351, Lê Minh Đức

Total we claim: 87 / 100

| Criterion                      | Max | We claim | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------ | --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Rules file                  | 15  | 13       | `AGENTS.md`: Stack, Commands, Conventions, Never. The Never list is about this product (no model key in the browser, no real model call in tests, never edit a test, the eval data or a validator rule to pass a check). Lines 35 and 36 (the last two Never rules) trace to AI-LOG 2026-11-26 "implement the plan-save endpoint" and "write the plan-save contract tests". Rewritten by hand in commit `b0c08c7` (PR #7) |
| 2. Permissions and secrets     | 10  | 9        | `AGENTS.md` "Permissions" (allowed, ask first, never), enforced in `.claude/settings.json`. `.env.example` lists every variable with no value. CI job `secrets` scans the whole history with gitleaks on every run. README "Model and secrets" states the $5 per month spend limit                                                                                                                                        |
| 3. One command for every check | 10  | 9        | README "Checks": `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`. `.github/workflows/ci.yml` runs exactly these four. The CI run for tag `pa2` (PA2.md) checks a clean checkout                                                                                                                                                                                                                   |
| 4. CI that blocks a merge      | 20  | 18       | `docs/pa2/branch-protection-1.webp` to `-3.webp`: PR required, the five checks required, up to date, no bypass. PR #3: tests-only commit `3eba514` red (run 45680538157), merge blocked (`docs/pa2/plans-save-blocked.webp`); commit `5ffcaf0` green (run 45681012230). Every commit on `main` after `9e88817` is a PR merge                                                                                              |
| 5. Contract                    | 25  | 21       | `docs/contract/post-plans-save.md`: section 2 who may call it (author only; 404 for anyone who cannot see the plan, 403 for a member who can), sections 3 and 4 request and Plan shapes with field rules, section 5 order of checks, section 6 idempotency on (`planId`, `revision`), section 7 validator codes, section 8 every problem type with its status, section 9 changes                                          |
| 6. Contract tests that bite    | 15  | 13       | `apps/api/test/contract/plans-save.test.ts`, 41 tests: all ten problem types, ownership (403 vs 404), replay with `Idempotent-Replayed`, `save-in-progress`, every validator code. Runs in the required `test` job. Tests (`3eba514`) and code (`5ffcaf0`) in separate commits. Deliberate break: PR #5, red run 45750788014                                                                                              |
| 7. AI-LOG.md                   | 5   | 4        | `AI-LOG.md`: tool and part for every task (Claude Code, Codex, Antigravity (Gemini), none). Real Changed and Rejected lines in the 2026-11-26 entries (replay aliasing the live plan, the retry key, CRLF on Windows, the hand rewrite of `AGENTS.md`)                                                                                                                                                                    |

## What we did not manage

- The validator and the contract tests run on a small fixture data set and an in-memory store. The class's shared place data arrives on 27 November, after this deadline, so nothing is tested on real opening hours, menus or travel times yet.
- The `save-in-progress` lock lives in one process's memory. It would not stop two saves running on two server instances.
- Sign-in does not exist yet. The tests use a fake token verifier, so "who may call it" is checked on fake identities only.
- The cost of one plan is not measured. The agent arrives in PA#3.
- Only two `AGENTS.md` lines come from incidents. The third one we cite (the `CLAUDE.md` import) is a design decision. Much of the scaffold and harness was kept as the assistant drafted it, as the "Changed: nothing" entries in AI-LOG show.

## What we would do differently

Write each AI-LOG entry right after the task. The entries for the contract and for this paperwork were only added at the end.
