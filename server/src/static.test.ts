import express from "express";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { serveClient } from "./static.js";

const dist = mkdtempSync(join(tmpdir(), "client-dist-"));
writeFileSync(join(dist, "index.html"), "<!doctype html><title>app</title>");
writeFileSync(join(dist, "app.js"), "console.log(1)");

const app = express();
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
serveClient(app, dist);

describe("serveClient", () => {
  it("serves built assets", async () => {
    const res = await request(app).get("/app.js");
    expect(res.status).toBe(200);
    expect(res.text).toContain("console.log");
  });

  it("falls back to index.html for client routes", async () => {
    const res = await request(app).get("/anything");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>app</title>");
  });

  it("keeps API routes and unknown API paths out of the fallback", async () => {
    expect((await request(app).get("/api/health")).body).toEqual({
      status: "ok",
    });
    expect((await request(app).get("/api/nope")).status).toBe(404);
  });

  it("does nothing when the build folder is missing", async () => {
    const bare = express();
    serveClient(bare, join(dist, "missing"));
    expect((await request(bare).get("/")).status).toBe(404);
  });
});
