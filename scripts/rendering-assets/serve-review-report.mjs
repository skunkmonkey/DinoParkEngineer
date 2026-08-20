import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const reportPath = resolve(repositoryRoot, "assets/manifests/review-report.html");
const allowedSources = new Set(["mvp-source-sheet-r1.png", "mvp-source-sheet-r2.png", "mvp-source-sheet-r3.png"]);
const host = "127.0.0.1";
const port = 4174;

const server = createServer(async (request, response) => {
  if (request.method !== "GET") {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Asset review report not found.");
    return;
  }
  try {
    const sourceName = request.url?.startsWith("/source/") ? request.url.slice("/source/".length) : undefined;
    const isSource = sourceName !== undefined && allowedSources.has(sourceName);
    if (request.url !== "/review-report.html" && !isSource) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Asset review resource not found.");
      return;
    }
    const report = await readFile(isSource ? resolve(repositoryRoot, "assets/source", sourceName) : reportPath);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": isSource ? "image/png" : "text/html; charset=utf-8",
    });
    response.end(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown report read failure.";
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(`Generate the report before serving it: ${message}`);
  }
});

server.listen(port, host, () => {
  console.log(`Asset review report: http://${host}:${port}/review-report.html`);
});
