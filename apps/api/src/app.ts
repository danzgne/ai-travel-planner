import express from "express";
import type { AppDeps } from "./plans/types.ts";

export function createApp(_deps?: AppDeps) {
  void _deps;
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
