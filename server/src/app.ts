import express from "express";
import { snailpayRouter } from "./snailpay/snailpay.routes.js";

export const app = express();

app.disable("x-powered-by");

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/snailpay", snailpayRouter());
