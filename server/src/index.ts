import { fileURLToPath } from "node:url";
import { app } from "./app.js";
import { serveClient } from "./static.js";

// In production the client build sits next to the server; in dev Vite serves it instead.
serveClient(app, fileURLToPath(new URL("../../client/dist", import.meta.url)));

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () =>
  console.log(`API listening on http://localhost:${port}`),
);
