// Static server for the ops portal mockup. Run: bun serve.js  → http://127.0.0.1:8124
// Sends no-store so the browser never caches a stale build between revisions.
import { dirname } from "path";
import { fileURLToPath } from "url";
const dir = dirname(fileURLToPath(import.meta.url));
const NOCACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};
Bun.serve({
  port: 8124,
  hostname: "127.0.0.1",
  async fetch(req) {
    let p = new URL(req.url).pathname;
    if (p === "/" || p === "") p = "/index.html";
    const f = Bun.file(dir + p);
    if (await f.exists()) return new Response(f, { headers: NOCACHE });
    return new Response("Not found", { status: 404, headers: NOCACHE });
  },
});
console.log("ops-portal-mockup on http://127.0.0.1:8124 (no-store)");
