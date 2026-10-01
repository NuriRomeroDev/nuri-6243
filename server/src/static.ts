import express, { type Express } from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Serves the built React app from the same origin as the API, so production is one service with no CORS.
export function serveClient(app: Express, dir: string): void {
  if (!existsSync(join(dir, "index.html"))) return;
  app.use(express.static(dir));
  // SPA fallback for page loads; /api paths keep their own 404s.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(join(dir, "index.html"));
  });
}
