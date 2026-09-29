import express from "express";

export const app = express();

app.disable("x-powered-by");

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
