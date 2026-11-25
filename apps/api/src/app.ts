import express, { type ErrorRequestHandler } from "express";
import { savePlans } from "./plans/save.ts";
import { createPlanStore } from "./plans/store.ts";
import type { AppDeps } from "./plans/types.ts";
import { sendNotFound, sendProblem } from "./problems.ts";

export function createApp(
  deps: AppDeps = {
    verifyToken: () => undefined,
    store: createPlanStore(),
    readPlaces: () => Promise.reject(new Error("Place data adapter is not configured")),
    readForecast: () => Promise.reject(new Error("Forecast adapter is not configured")),
  },
) {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const api = express.Router();
  api.use(savePlans(deps));
  api.use((_req, res) => sendNotFound(res));
  const handleError: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof URIError && "status" in error && error.status === 400) {
      sendNotFound(res);
      return;
    }
    sendProblem(res, "internal", "The request could not be completed.");
  };
  api.use(handleError);
  app.use("/v1", api);

  return app;
}
