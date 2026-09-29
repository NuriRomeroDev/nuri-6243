import express, { Router } from "express";
import type { ErrorRequestHandler } from "express";
import { setTimeout } from "node:timers/promises";
import {
  failureResponse,
  processCharge,
  type OutcomeKind,
} from "./snailpay.service.js";

const HTTP_STATUS: Record<OutcomeKind, number> = {
  approved: 201,
  malformed: 400,
  invalid: 422,
  declined: 402,
  unavailable: 503,
  timeout: 504,
};

const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) return next(err);
  const type = (err as { type?: string } | null)?.type;
  if (type === "entity.parse.failed" || type === "entity.too.large") {
    return res
      .status(type === "entity.too.large" ? 413 : 400)
      .json(failureResponse("invalid_request_body"));
  }
  console.error(err);
  res.status(500).json(failureResponse("internal_error"));
};

export function snailpayRouter({ timeoutDelayMs = 10_000 } = {}): Router {
  const router = Router();
  router.use(express.json({ limit: "10kb" }));
  router.post("/charge", async (req, res) => {
    const outcome = processCharge(req.body);
    // ponytail: timer keeps running if the client aborts; harmless for a mock
    if (outcome.kind === "timeout") await setTimeout(timeoutDelayMs);
    res.status(HTTP_STATUS[outcome.kind]).json(outcome.response);
  });
  router.use(errorHandler);
  return router;
}
