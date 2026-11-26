import express, { type Request, type Response } from "express";
import { sendNotFound, sendProblem } from "../problems.ts";
import { pricePlan, tripMemberIds } from "./cost.ts";
import type { AppDeps, SavedPlan } from "./types.ts";
import { validatePlan } from "./validator.ts";

const readText = express.text({ type: "application/json" });

function readBody(req: Request, res: Response) {
  return new Promise<unknown>((resolve, reject) => {
    readText(req, res, (error?: unknown) => {
      if (error instanceof Error) reject(error);
      else if (error != null) reject(new Error("Request body could not be read"));
      else resolve(req.body);
    });
  });
}

export function savePlans(deps: AppDeps) {
  const router = express.Router();
  const { store } = deps;

  router.post("/plans/:planId/save", async (req, res) => {
    const token = /^Bearer +([^\s]+)$/i.exec(req.get("Authorization") ?? "")?.[1];
    const userId = token ? await deps.verifyToken(token) : undefined;
    if (userId === undefined) {
      res.set("WWW-Authenticate", "Bearer");
      return sendProblem(res, "unauthenticated", "A valid bearer token is required.");
    }

    const param = req.params.planId;
    const id = Number(param);
    const plan =
      /^\d+$/.test(param) && Number.isSafeInteger(id) && id > 0 ? store.getPlan(id) : undefined;
    if (!plan) return sendNotFound(res);
    if (userId !== plan.authorId) {
      if (plan.savedRevision === null) return sendNotFound(res);
      const trip = store.getTrip(plan.tripId);
      if (!trip || !tripMemberIds(trip).includes(userId)) return sendNotFound(res);
      return sendProblem(res, "not-plan-author", "Only the author can save the plan.");
    }

    let body: unknown;
    if (req.is("application/json")) {
      const raw = await readBody(req, res);
      try {
        body = JSON.parse(typeof raw === "string" ? raw : "");
      } catch {
        return sendProblem(res, "invalid-json", "The request body is not valid JSON.");
      }
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return sendProblem(res, "validation", "The request body must be a JSON object.", {
        errors: [{ pointer: "", detail: "Send a JSON object with Content-Type application/json." }],
      });
    }
    const revision = "revision" in body ? body.revision : undefined;
    if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 1) {
      return sendProblem(res, "validation", "The revision is invalid.", {
        errors: [{ pointer: "/revision", detail: "Use an integer revision of at least 1." }],
      });
    }

    if (!store.tryLock(id)) {
      return sendProblem(res, "save-in-progress", "A save is already processing this plan.");
    }

    try {
      // Reading the request body can yield while another request changes the plan.
      const current = store.getPlan(id);
      if (!current) return sendNotFound(res);
      if (current.revision !== revision) {
        return sendProblem(
          res,
          "revision-conflict",
          "The plan has changed since you reviewed it.",
          {
            currentRevision: current.revision,
          },
        );
      }
      const trip = store.getTrip(current.tripId);
      if (!trip) throw new Error("Trip missing for stored plan");
      let inputs;
      try {
        inputs = await Promise.all([deps.readPlaces(), deps.readForecast()]);
      } catch {
        res.set("Retry-After", "30");
        return sendProblem(res, "validator-unavailable", "The validation data is unavailable.");
      }
      const [data, forecast] = inputs;
      const { days, spending } = pricePlan(current, trip, data);
      const violations = validatePlan(current, data, forecast, spending);
      if (violations.length > 0) {
        return sendProblem(res, "plan-invalid", "The plan violates the itinerary rules.", {
          violations,
        });
      }

      const latest = store.getPlan(id);
      if (!latest) return sendNotFound(res);
      if (latest.revision !== revision) {
        return sendProblem(
          res,
          "revision-conflict",
          "The plan changed while it was being checked.",
          {
            currentRevision: latest.revision,
          },
        );
      }
      const saved: SavedPlan = {
        ...current,
        status: "saved",
        savedRevision: revision,
        savedAt: new Date().toISOString(),
        days,
        spending,
      };
      store.save(saved);
      res.json(saved);
    } finally {
      store.unlock(id);
    }
  });
  return router;
}
