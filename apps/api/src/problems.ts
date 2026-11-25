import type { Response } from "express";

const problems = {
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

type PointerDetail = { pointer: string; detail: string };
type Extensions = {
  validation: { errors: PointerDetail[] };
  "plan-invalid": { violations: (PointerDetail & { code: string })[] };
  "revision-conflict": { currentRevision: number };
};

export function sendProblem<Slug extends keyof typeof problems>(
  res: Response,
  slug: Slug,
  detail: string,
  ...fields: Slug extends keyof Extensions ? [Extensions[Slug]] : []
) {
  const [status, title] = problems[slug];
  res
    .status(status)
    .type("application/problem+json")
    .json({
      type: `https://ai-travel-planner.example/problems/${slug}`,
      title,
      status,
      detail,
      ...fields[0],
    });
}

export function sendNotFound(res: Response) {
  sendProblem(res, "not-found", "The requested resource was not found.");
}
