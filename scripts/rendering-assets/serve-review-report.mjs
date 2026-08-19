import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const reportPath = resolve(repositoryRoot, "assets/manifests/review-report.html");
const host = "127.0.0.1";
const port = 4174;

const server = createServer(async (request, response) => {
  if (request.method !== "GET" || request.url !== "/review-report.html") {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Asset review report not found.");
    return;
  }
  try {
    const report = await readFile(reportPath);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
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
