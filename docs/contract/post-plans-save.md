# `POST /v1/plans/{planId}/save`: contract, version 1

AI Travel Planner · frozen 25 Nov 2026

Save is the step that shares a schedule with the group. Before it, only the plan's author sees the plan. After it, every member of the trip does. The validator runs one last time here, in the backend, and a plan it rejects is never shared.

This file is the specification. `apps/api/test/contract/plans-save.test.ts` checks the code against it. If the code and this file disagree, the code is wrong. If this file is wrong, change it in its own commit that says why, never quietly.

## 1. Conventions

- The endpoint lives under `/v1`. Requests and responses are JSON, UTF-8.
- **Money is an integer number of dong**: every field ending in `Vnd`.
- Ids are positive integers.
- `date` is `YYYY-MM-DD` and times of day are `HH:MM` (24-hour), both in Ho Chi Minh City time (UTC+7). Timestamps such as `savedAt` are ISO 8601 in UTC, e.g. `2026-11-25T08:15:00.000Z`.
- Clients ignore response fields they do not know. The server ignores request fields it does not know.

## 2. Who may call it

The caller sends `Authorization: Bearer <token>`, the access token issued at sign-in.

A plan belongs to one trip. The **members of a trip** are its owner for an individual trip, or every member of the group for a group trip. The **author** is the member who created the plan.

A caller **can see** a plan when they are its author, or when they are a member of its trip and the plan has been saved at least once (`savedRevision` is not `null`).

| Caller                                                                                      | Result                                                |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| No token, or a token that is invalid or expired                                             | `401 unauthenticated`                                 |
| Cannot see the plan (not a trip member, or a member looking at a plan that was never saved) | `404 not-found`, exactly as if the plan did not exist |
| Can see the plan but is not its author                                                      | `403 not-plan-author`                                 |
| The author                                                                                  | the save goes ahead                                   |

Only the author saves. Another member who wants to change a shared plan asks the author, or makes their own plan.

## 3. Request

```http
POST /v1/plans/42/save HTTP/1.1
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "revision": 4 }
```

| Field      | Rule                                                                                 |
| ---------- | ------------------------------------------------------------------------------------ |
| `revision` | integer, at least 1. The revision of the plan the user reviewed before pressing Save |

A request without `Content-Type: application/json`, or a body that is valid JSON but not an object, is a `validation` error with pointer `""`.

## 4. Response: the Plan

`200 OK`, `Content-Type: application/json`, the Plan as saved:

```json
{
  "id": 42,
  "tripId": 7,
  "authorId": 3,
  "revision": 4,
  "status": "saved",
  "savedRevision": 4,
  "savedAt": "2026-11-25T08:15:00.000Z",
  "days": [
    {
      "date": "2026-12-05",
      "stops": [
        {
          "placeId": 101,
          "arriveAt": "09:00",
          "leaveAt": "10:30",
          "items": [
            { "menuItemId": 512, "userId": 3, "qty": 1, "unitPriceVnd": 45000 },
            { "menuItemId": 512, "userId": 8, "qty": 2, "unitPriceVnd": 45000 }
          ]
        }
      ]
    }
  ],
  "spending": {
    "budgetVnd": 4000000,
    "totalVnd": 135000,
    "members": [
      { "userId": 3, "spentVnd": 45000, "limitVnd": 800000 },
      { "userId": 8, "spentVnd": 90000, "limitVnd": 800000 }
    ]
  }
}
```

| Field                         | Rule                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `revision`                    | goes up by 1 on every edit. Save does not change it                                                                                      |
| `status`                      | `"saved"` when `savedRevision` equals `revision`, otherwise `"draft"`                                                                    |
| `savedRevision`, `savedAt`    | `null` until the first save. Set by each successful save                                                                                 |
| `days`                        | in date order. `stops` in time order within a day                                                                                        |
| `items`                       | one line per member per menu item or ticket. `userId` is the member who pays for it                                                      |
| `unitPriceVnd`                | the item's price in the checked place data at the moment of the save. A later price change does not alter a saved revision               |
| `spending`                    | computed by code at the save, never by a model                                                                                           |
| `spending.budgetVnd`          | the group total for a group trip, or the traveller's budget for an individual trip                                                       |
| `spending.members[].spentVnd` | the sum of `unitPriceVnd × qty` over that member's item lines                                                                            |
| `spending.totalVnd`           | the sum of `spentVnd` over all members                                                                                                   |
| `spending.members[].limitVnd` | for a group trip, the lowest spending cap set by any member, or `null` when nobody set one. For an individual trip, equal to `budgetVnd` |

## 5. What a save does

The server checks, **in this order**, and stops at the first step that fails:

1. A valid bearer token, else `401 unauthenticated`.
2. `planId` is a positive integer and names a plan the caller can see, else `404 not-found`.
3. The caller is the plan's author, else `403 not-plan-author`.
4. The body is valid JSON, else `400 invalid-json`.
5. The body follows section 3, else `400 validation` listing **every** broken field.
6. **This revision was saved before** (see section 6): replay the stored response.
7. No other save of this plan is being processed, else `409 save-in-progress`.
8. `revision` equals the plan's current revision, else `409 revision-conflict`.
9. The data the validator needs can be read, else `503 validator-unavailable`.
10. The validator accepts the plan (section 7), else `422 plan-invalid` listing **every** violation.
11. The plan is saved: `savedRevision` and `savedAt` are set, prices and `spending` are fixed, and every member of the trip can now see it. **`200`** with the Plan.

Steps 1 to 10 change nothing. After a `422`, the author edits the plan (which raises `revision`) and saves the new revision.

## 6. Idempotency

A client that gets no answer (a timeout, a dropped mobile connection, a double tap) sends the same request again. That must not share the plan twice.

- The key is the pair (`planId`, `revision`). No `Idempotency-Key` header is needed.
- A successful save stores its response, in the same transaction as the save.
- A request for a revision that was already saved gets the **stored** response: status `200`, the same body, plus the header **`Idempotent-Replayed: true`**. The plan is not validated again, `savedAt` does not move, and the group is not told twice. The original response does not carry that header.
- The replay is the response of the original save, even if the plan was edited since. `GET /v1/plans/{planId}` gives its current state.
- While a save of the plan is being processed, a second save of the same plan gets `409 save-in-progress`. The client waits a moment and sends the same request again.
- **Only a `200` is stored.** A request that ends in any 4xx or 5xx stores nothing.
- Stored responses are kept as long as the plan exists.

## 7. The validator

It reads the checked place data shared by the class (places, opening hours, menus, the motorbike travel-time matrix) and the forecast. It reports **every** violation it finds, in plan order: days, then stops, then spending.

| `code`              | `pointer`                                  | When                                                                                                                       |
| ------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `empty-plan`        | `/days`                                    | the plan has no stops                                                                                                      |
| `unknown-place`     | `/days/{d}/stops/{s}/placeId`              | the place is not in the checked data, or has no opening hours or no menu                                                   |
| `unknown-item`      | `/days/{d}/stops/{s}/items/{i}/menuItemId` | the item is not on that place's menu                                                                                       |
| `unknown-member`    | `/days/{d}/stops/{s}/items/{i}/userId`     | `userId` is not a member of the trip                                                                                       |
| `bad-times`         | `/days/{d}/stops/{s}`                      | `leaveAt` is not after `arriveAt`, or the stop starts before the previous stop leaves                                      |
| `closed`            | `/days/{d}/stops/{s}`                      | the visit is not inside the place's opening hours for that date                                                            |
| `travel-time`       | `/days/{d}/stops/{s}`                      | previous stop's `leaveAt` plus the motorbike time between the two places is later than this stop's `arriveAt`              |
| `rain`              | `/days/{d}/stops/{s}`                      | the place is outdoors, the date is within the 7-day forecast, and the chance of rain is above 60% in any hour of the visit |
| `over-member-limit` | `/spending/members/{m}`                    | `limitVnd` is not `null` and `spentVnd` is above it                                                                        |
| `over-group-total`  | `/spending/totalVnd`                       | `totalVnd` is above `budgetVnd`                                                                                            |

Each violation is `{ "code", "pointer", "detail" }`. `pointer` is a JSON Pointer into the Plan as section 4 shows it.

## 8. Errors

Every 4xx or 5xx response under `/v1` is a **problem details** object (RFC 9457) with `Content-Type: application/problem+json`:

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{
  "type": "https://ai-travel-planner.example/problems/plan-invalid",
  "title": "Plan breaks the rules",
  "status": 422,
  "detail": "2 rules are broken",
  "violations": [
    { "code": "closed", "pointer": "/days/0/stops/1", "detail": "closes at 17:00, the visit ends at 18:30" },
    { "code": "over-member-limit", "pointer": "/spending/members/1", "detail": "spends 920000 against a limit of 800000" }
  ]
}
```

| Member            | Rule                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `type`            | `https://ai-travel-planner.example/problems/` followed by a slug from the table below. No other values                         |
| `title`           | the title from the table below                                                                                                 |
| `status`          | a number, equal to the HTTP status                                                                                             |
| `detail`          | one sentence about **this** occurrence. Never a stack trace, an SQL message, a file path, a token, or a person's name or email |
| `errors`          | only on `validation`: one `{ "pointer", "detail" }` per broken field (`""` for the whole body)                                 |
| `violations`      | only on `plan-invalid`: section 7                                                                                              |
| `currentRevision` | only on `revision-conflict`: the plan's revision now                                                                           |

| Slug                    | Status | Title                   | When                                                                                                                       |
| ----------------------- | ------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `invalid-json`          | 400    | Malformed JSON          | the body is not valid JSON                                                                                                 |
| `validation`            | 400    | Invalid request         | the body breaks section 3                                                                                                  |
| `unauthenticated`       | 401    | Authentication required | no bearer token, or an invalid or expired one. The response also carries `WWW-Authenticate: Bearer`                        |
| `not-plan-author`       | 403    | Not the plan's author   | the caller can see the plan but did not write it                                                                           |
| `not-found`             | 404    | Not found               | `planId` is not a positive integer, no such plan, the caller cannot see it, or no such `/v1` path                          |
| `save-in-progress`      | 409    | Save in progress        | another save of this plan has not finished                                                                                 |
| `revision-conflict`     | 409    | Plan has changed        | `revision` is not the plan's current revision                                                                              |
| `plan-invalid`          | 422    | Plan breaks the rules   | the validator rejected the plan                                                                                            |
| `internal`              | 500    | Internal error          | anything else. `detail` is a fixed, generic sentence                                                                       |
| `validator-unavailable` | 503    | Cannot validate now     | the place data or the forecast cannot be read. The response carries `Retry-After` in seconds, and the plan stays as it was |

Clients decide what to do from `type`, never from `title` or `detail`. A client that meets a `type` it does not know acts on the status class.

## 9. Changes

- **Within `/v1`, only additive changes**: a new optional request field, a new response field, a new problem type, or a new validator `code`. Clients treat an unknown `code` as a generic violation and show its `detail`.
- Anything else is `/v2`, and `/v1` keeps running until its `Sunset` date: renaming or removing a field, changing a type or a unit, changing the meaning of an existing `code` or a threshold such as the 60% rain limit, or changing who may call the endpoint.
- This file changes in its own commit, with the reason in the message, before the code and tests that follow it.

## 10. Not in this contract

- Creating and editing a plan, and `GET /v1/plans/{planId}`.
- What happens to a saved plan when a member later lowers their spending cap. That belongs to `PUT /v1/groups/{groupId}/members/{userId}/spending-cap`.
