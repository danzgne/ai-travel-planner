import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { createPlanStore } from "../../src/plans/store.ts";
import type { AppDeps, Place, Plan, Stop, Trip } from "../../src/plans/types.ts";

const date = "2026-11-26";
const firstStop: Stop = {
  placeId: 101,
  arriveAt: "09:00",
  leaveAt: "10:00",
  items: [
    { menuItemId: 512, userId: 3, qty: 1 },
    { menuItemId: 512, userId: 8, qty: 2 },
  ],
};
const group: Trip = {
  kind: "group",
  budgetVnd: 500_000,
  members: [
    { userId: 3, capVnd: 200_000 },
    { userId: 8, capVnd: 150_000 },
  ],
};

function setup(
  options: { stops?: Stop[]; trip?: Trip; saved?: boolean; deps?: Partial<AppDeps> } = {},
) {
  const plan: Plan = {
    id: 42,
    tripId: 7,
    authorId: 3,
    revision: 4,
    savedRevision: options.saved ? 3 : null,
    savedAt: options.saved ? "2026-11-25T08:15:00.000Z" : null,
    days: [{ date, stops: options.stops ?? [firstStop] }],
  };
  const store = createPlanStore(new Map([[42, plan]]), new Map([[7, options.trip ?? group]]));
  const indoor: Place = {
    outdoor: false,
    hours: new Map([[date, [{ opens: "08:00", closes: "18:00" }]]]),
    menu: new Map([[512, 45_000]]),
  };
  const app = createApp({
    store,
    verifyToken: (token) =>
      new Map([
        ["token-user-3", 3],
        ["token-user-8", 8],
        ["token-user-9", 9],
      ]).get(token),
    readPlaces: () =>
      Promise.resolve({
        places: new Map([
          [101, indoor],
          [102, { ...indoor, outdoor: true }],
          [103, indoor],
        ]),
        travelMinutes: new Map([
          [
            101,
            new Map([
              [102, 20],
              [103, 15],
            ]),
          ],
        ]),
      }),
    readForecast: () =>
      Promise.resolve(
        new Map([
          [
            date,
            new Map([
              [9, 70],
              [10, 60],
            ]),
          ],
        ]),
      ),
    ...options.deps,
  });
  const post = (token: string | null = "token-user-3", id = "42") => {
    const req = request(app).post(`/v1/plans/${id}/save`);
    return token === null ? req : req.set("Authorization", `Bearer ${token}`);
  };
  return { app, plan, store, post };
}

const expected = {
  "invalid-json": [400, "Malformed JSON"],
  validation: [400, "Invalid request"],
  unauthenticated: [401, "Authentication required"],
  "not-plan-author": [403, "Not the plan's author"],
  "not-found": [404, "Not found"],
  "save-in-progress": [409, "Save in progress"],
  "revision-conflict": [409, "Plan has changed"],
  "plan-invalid": [422, "Plan breaks the rules"],
  internal: [500, "Internal error"],
  "validator-unavailable": [503, "Cannot validate now"],
} as const;

const anyDetail: unknown = expect.any(String);
const utcTimestamp: unknown = expect.stringMatching(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
);

function problem(res: Response, slug: keyof typeof expected) {
  const [status, title] = expected[slug];
  expect(res.status).toBe(status);
  expect(res.get("Content-Type")).toMatch(/^application\/problem\+json\b/);
  const body: unknown = res.body;
  expect(body).toMatchObject({
    type: `https://ai-travel-planner.example/problems/${slug}`,
    title,
    status,
  });
  if (
    typeof body !== "object" ||
    body === null ||
    !("detail" in body) ||
    typeof body.detail !== "string"
  ) {
    throw new Error("Expected a string detail");
  }
  expect(body.detail).not.toMatch(
    /\n|token-user-|(?:[a-z]:[\\/]|\/(?:tmp|home|Users)\/)|secret-diagnostic/i,
  );
  return body;
}

describe("POST /v1/plans/{planId}/save", () => {
  it.each([null, "unknown"])("challenges unauthenticated requests with token %s", async (token) => {
    const res = await setup().post(token).send({ revision: 4 });
    problem(res, "unauthenticated");
    expect(res.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("gives outsiders the same response for a shared plan and a missing plan", async () => {
    const { post } = setup({ saved: true });
    const hidden = await post("token-user-9").send({ revision: 4 });
    const missing = await post("token-user-9", "999").send({ revision: 4 });
    expect(problem(hidden, "not-found")).toEqual(problem(missing, "not-found"));
  });

  it.each([
    [false, "not-found"],
    [true, "not-plan-author"],
  ] as const)("enforces ownership when previously saved is %s", async (saved, slug) => {
    problem(await setup({ saved }).post("token-user-8").send({ revision: 4 }), slug);
  });

  it.each(["abc", "0", "-1"])("rejects invalid plan ID %s", async (id) => {
    problem(await setup().post("token-user-3", id).send({ revision: 4 }), "not-found");
  });

  it("uses problem details for an unknown v1 path", async () => {
    problem(await request(setup().app).get("/v1/missing"), "not-found");
  });

  it("rejects malformed JSON from the author", async () => {
    problem(await setup().post().type("json").send("{"), "invalid-json");
  });

  it.each([
    [null, false, "unauthenticated"],
    ["token-user-8", false, "not-found"],
    ["token-user-8", true, "not-plan-author"],
  ] as const)(
    "checks rights before malformed JSON for %s (previously saved %s)",
    async (token, saved, slug) => {
      problem(await setup({ saved }).post(token).type("json").send("{"), slug);
    },
  );

  it.each([
    ["[]", "application/json"],
    ['"x"', "application/json"],
    ["null", "application/json"],
    ['{"revision":4}', "text/plain"],
  ])("validates the body %s with media type %s", async (body, contentType) => {
    const res = await setup().post().set("Content-Type", contentType).send(body);
    expect(problem(res, "validation")).toMatchObject({
      errors: [{ pointer: "", detail: anyDetail }],
    });
  });

  it.each([{}, { revision: 0 }, { revision: "4" }, { revision: 1.5 }])(
    "validates the revision in %j",
    async (body) => {
      const res = await setup().post().send(body);
      expect(problem(res, "validation")).toMatchObject({
        errors: [{ pointer: "/revision", detail: anyDetail }],
      });
    },
  );

  it("saves authoritative prices and shares the plan with the trip", async () => {
    const { post } = setup();
    const res = await post().send({ revision: 4, futureField: true });
    expect(res.status).toBe(200);
    expect(res.get("Content-Type")).toMatch(/^application\/json\b/);
    expect(res.get("Idempotent-Replayed")).toBeUndefined();
    expect(res.body).toEqual({
      id: 42,
      tripId: 7,
      authorId: 3,
      revision: 4,
      savedRevision: 4,
      status: "saved",
      savedAt: utcTimestamp,
      days: [
        {
          date,
          stops: [
            {
              ...firstStop,
              items: firstStop.items.map((item) => ({ ...item, unitPriceVnd: 45_000 })),
            },
          ],
        },
      ],
      spending: {
        budgetVnd: 500_000,
        totalVnd: 135_000,
        members: [
          { userId: 3, spentVnd: 45_000, limitVnd: 150_000 },
          { userId: 8, spentVnd: 90_000, limitVnd: 150_000 },
        ],
      },
    });
    problem(await post("token-user-8").send({ revision: 4 }), "not-plan-author");
  });

  it.each([
    {
      trip: { kind: "individual", ownerId: 3, budgetVnd: 100_000 } satisfies Trip,
      limitVnd: 100_000,
    },
    {
      trip: {
        kind: "group",
        budgetVnd: 100_000,
        members: [{ userId: 3, capVnd: null }],
      } satisfies Trip,
      limitVnd: null,
    },
  ])("uses the spending limit for a $trip.kind trip", async ({ trip, limitVnd }) => {
    const { post } = setup({ trip, stops: [{ ...firstStop, items: firstStop.items.slice(0, 1) }] });
    const res = await post().send({ revision: 4 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      spending: { members: [{ userId: 3, spentVnd: 45_000, limitVnd }] },
    });
  });

  it("replays the original successful body before and after an edit", async () => {
    let forecastReads = 0;
    const { post, store, plan } = setup({
      deps: {
        readForecast: () => {
          forecastReads++;
          return Promise.resolve(new Map());
        },
      },
    });
    const original = await post().send({ revision: 4 });
    expect(original.status).toBe(200);
    const replay = await post().send({ revision: 4 });
    expect(replay.status).toBe(200);
    expect(replay.get("Idempotent-Replayed")).toBe("true");
    expect(replay.body).toEqual(original.body);
    const stored = store.getPlan(42);
    expect(stored).toBeDefined();
    store.seedPlan({
      ...stored,
      ...plan,
      revision: 5,
      days: [],
      savedRevision: 4,
      savedAt: stored?.savedAt ?? null,
    });
    const editedReplay = await post().send({ revision: 4 });
    expect(editedReplay.status).toBe(200);
    expect(editedReplay.get("Idempotent-Replayed")).toBe("true");
    expect(editedReplay.body).toEqual(original.body);
    expect(forecastReads).toBe(1);
  });

  it("rejects a second save while the first waits for forecast", async () => {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const { post } = setup({
      deps: {
        readForecast: async () => {
          entered.resolve();
          await release.promise;
          return new Map();
        },
      },
    });
    const first = post()
      .send({ revision: 4 })
      .then((res) => res);
    try {
      expect(await Promise.race([entered.promise.then(() => true), first.then(() => false)])).toBe(
        true,
      );
      problem(await post().send({ revision: 4 }), "save-in-progress");
    } finally {
      release.resolve();
      await first;
    }
    expect((await first).status).toBe(200);
  });

  it("reports currentRevision and leaves a rejected revision eligible for a later save", async () => {
    const { post, store, plan } = setup();
    const conflict = await post().send({ revision: 5 });
    expect(problem(conflict, "revision-conflict")).toHaveProperty("currentRevision", 4);
    expect(store.getPlan(42)).toEqual(plan);
    store.seedPlan({ ...plan, revision: 5 });
    const saved = await post().send({ revision: 5 });
    expect(saved.status).toBe(200);
    expect(saved.get("Idempotent-Replayed")).toBeUndefined();
  });

  const validatorCases = [
    { code: "empty-plan", pointer: "/days", stops: [] },
    {
      code: "unknown-place",
      pointer: "/days/0/stops/0/placeId",
      stops: [{ ...firstStop, placeId: 999 }],
    },
    {
      code: "unknown-item",
      pointer: "/days/0/stops/0/items/0/menuItemId",
      stops: [{ ...firstStop, items: [{ menuItemId: 0, userId: 3, qty: 1 }] }],
    },
    {
      code: "unknown-member",
      pointer: "/days/0/stops/0/items/0/userId",
      stops: [{ ...firstStop, items: [{ menuItemId: 512, userId: 9, qty: 1 }] }],
    },
    { code: "bad-times", pointer: "/days/0/stops/0", stops: [{ ...firstStop, leaveAt: "09:00" }] },
    { code: "closed", pointer: "/days/0/stops/0", stops: [{ ...firstStop, arriveAt: "07:50" }] },
    {
      code: "travel-time",
      pointer: "/days/0/stops/1",
      stops: [
        firstStop,
        { ...firstStop, placeId: 103, arriveAt: "10:10", leaveAt: "11:00", items: [] },
      ],
    },
    { code: "rain", pointer: "/days/0/stops/0", stops: [{ ...firstStop, placeId: 102 }] },
    {
      code: "over-member-limit",
      pointer: "/spending/members/1",
      stops: [{ ...firstStop, items: [{ menuItemId: 512, userId: 8, qty: 4 }] }],
    },
    {
      code: "over-group-total",
      pointer: "/spending/totalVnd",
      stops: [firstStop],
      trip: { ...group, budgetVnd: 130_000 },
    },
  ];
  it.each(validatorCases)(
    "reports $code and its pointer",
    async ({ code, pointer, stops, trip }) => {
      const res = await setup({ stops, trip }).post().send({ revision: 4 });
      expect(problem(res, "plan-invalid")).toHaveProperty("violations", [
        { code, pointer, detail: anyDetail },
      ]);
    },
  );

  it("reports multiple violations in plan order and keeps the plan private", async () => {
    const { post, store, plan } = setup({
      stops: [
        { ...firstStop, arriveAt: "07:30", leaveAt: "08:30" },
        { ...firstStop, placeId: 102, items: [] },
      ],
    });
    const res = await post().send({ revision: 4 });
    expect(problem(res, "plan-invalid")).toHaveProperty("violations", [
      { code: "closed", pointer: "/days/0/stops/0", detail: anyDetail },
      { code: "rain", pointer: "/days/0/stops/1", detail: anyDetail },
    ]);
    expect(store.getPlan(42)).toEqual(plan);
    problem(await post("token-user-8").send({ revision: 4 }), "not-found");
  });

  it.each(["readPlaces", "readForecast"] as const)(
    "returns a retryable error when %s fails",
    async (reader) => {
      const { post, store, plan } = setup({
        deps: {
          [reader]: () => Promise.reject(new Error("secret-diagnostic")),
        },
      });
      const res = await post().send({ revision: 4 });
      problem(res, "validator-unavailable");
      expect(res.get("Retry-After")).toMatch(/^\d+$/);
      expect(store.getPlan(42)).toEqual(plan);
    },
  );

  it("returns the same generic detail for distinct store failures", async () => {
    const store = createPlanStore();
    const fail = (diagnostic: string) =>
      setup({
        deps: {
          store: {
            ...store,
            getPlan: () => {
              throw new Error(diagnostic);
            },
          },
        },
      })
        .post()
        .send({ revision: 4 });
    const first = problem(await fail("secret-diagnostic /tmp/private"), "internal");
    const second = problem(await fail("another private error"), "internal");
    expect(first).toEqual(second);
  });
});
