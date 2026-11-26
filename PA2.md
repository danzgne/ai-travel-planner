# PA#2: Harness and quality gate

AI Travel Planner, CSC13114 (23KTPM1).

| What                        | Link                                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository                  | https://github.com/danzgne/ai-travel-planner                                                                                                                                                                                                                                                                                                |
| Protected-branch settings   | Screenshots [1](docs/pa2/branch-protection-1.webp), [2](docs/pa2/branch-protection-2.webp), [3](docs/pa2/branch-protection-3.webp). The settings page itself (admins only): https://github.com/danzgne/ai-travel-planner/settings/branches                                                                                                  |
| PR a red check stopped      | [PR #3](https://github.com/danzgne/ai-travel-planner/pull/3). The tests-only commit `3eba514` failed `test` ([red run](https://github.com/danzgne/ai-travel-planner/actions/runs/45680538157)) and the merge was blocked ([screenshot](docs/pa2/plans-save-blocked.webp))                                                                   |
| Commit that turned it green | [`5ffcaf0`](https://github.com/danzgne/ai-travel-planner/commit/5ffcaf0adc7c437a36f1060f7fd3f017a3a94e40), code only, no test changes ([green run](https://github.com/danzgne/ai-travel-planner/actions/runs/45681012230)). PR #3 was then merged with a merge commit                                                                       |
| CI run for the `pa2` tag    | https://github.com/danzgne/ai-travel-planner/actions?query=branch%3Apa2                                                                                                                                                                                                                                                                     |
| Deliberate contract break   | [PR #5](https://github.com/danzgne/ai-travel-planner/pull/5), closed without merging. It removed the idempotent replay in code only, and `test` failed on "POST /v1/plans/{planId}/save > replays the original successful body before and after an edit" ([red run](https://github.com/danzgne/ai-travel-planner/actions/runs/45750788014)) |

Branch protection was turned on right after the first commit (`9e88817`). Every later commit on `main` is a pull request merge.

## Where to look

- Contract: [docs/contract/post-plans-save.md](docs/contract/post-plans-save.md)
- Contract tests: [apps/api/test/contract/plans-save.test.ts](apps/api/test/contract/plans-save.test.ts)
- Rules file and permissions: [AGENTS.md](AGENTS.md) (`CLAUDE.md` imports it) and [.claude/settings.json](.claude/settings.json). Rules learned from incidents: [PR #6](https://github.com/danzgne/ai-travel-planner/pull/6), rewritten by hand in [PR #7](https://github.com/danzgne/ai-travel-planner/pull/7)
- Checks: README "Checks" and [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Plan-save workflow notes: [docs/pa2/plans-save-workflow.md](docs/pa2/plans-save-workflow.md) and [docs/pa2/plans-save-logic.md](docs/pa2/plans-save-logic.md)
- AI log: [AI-LOG.md](AI-LOG.md)
