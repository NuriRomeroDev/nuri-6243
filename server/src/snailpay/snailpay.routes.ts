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
  // body-parser tags client errors (bad JSON 400, too large 413, bad encoding 415) with a 4xx status.
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return res.status(status).json(failureResponse("invalid_request_body"));
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
