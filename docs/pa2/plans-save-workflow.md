# PA2 steps 1 and 2 for plan saves

[PR #3](https://github.com/danzgne/ai-travel-planner/pull/3) targets `main` from `feat/plans-save`. The [endpoint contract](../contract/post-plans-save.md) defines the expected behavior.

## Step 1. Show that the test check blocks a merge

1. Push [3f58906](https://github.com/danzgne/ai-travel-planner/commit/3f58906bb3f072b118dbb13c065b8e7c341815f9). This commit gives `createApp` injectable dependencies and adds an in-memory store. All four local checks pass. The save route is absent.
2. Push [3eba514](https://github.com/danzgne/ai-travel-planner/commit/3eba514b717e057b10189fc08ebe7c5d66a24d4d) with only [the contract test file](../../apps/api/test/contract/plans-save.test.ts). Open the PR for review with the failing commit at its head. The tests seed an in-memory store and inject fake tokens, places, and forecast data.
3. Wait for the [red CI run](https://github.com/danzgne/ai-travel-planner/actions/runs/45680538157). The contract assertions fail and the health test passes. GitHub reports one failing required check and disables the merge button. [Screenshot of the blocked merge](plans-save-blocked.webp).

## Step 2. Implement the route on the same PR

1. Implement the contract in [5ffcaf0](https://github.com/danzgne/ai-travel-planner/commit/5ffcaf0adc7c437a36f1060f7fd3f017a3a94e40). Only API source files change. The handler checks auth and ownership before parsing JSON. It looks up replays before acquiring a save lock and commits the plan and response snapshot together.
2. Run the four commands from the repository root. All 42 tests pass, including the existing health test.

   ```text
   npm run lint
   npm run format:check
   npm run typecheck
   npm test
   ```

3. Push the implementation and verify its [CI run](https://github.com/danzgne/ai-travel-planner/actions/runs/45681012230). Push this workflow record in a separate commit.
4. After all five required checks pass on the final head, merge with **Create a merge commit** to retain the red and green commits in the history of `main`. The merged implementation is the base for Member B's step 3.

The server accepts dependencies through `createApp(deps)`. Its standalone defaults reject bearer tokens until a verifier is wired in. The contract suite supplies the verifier, the store, and the place and forecast readers. It exercises the HTTP route without a model call.
