import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
if (!command) {
  console.error("Usage: node scripts/run-vinext.mjs <dev|build|start> [...args]");
  process.exitCode = 1;
} else {
  const vinextCli = fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url));
  const child = spawn(process.execPath, [vinextCli, command, ...process.argv.slice(3)], {
    stdio: "inherit",
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || ".wrangler/wrangler.log",
    },
  });

  child.on("error", (error) => {
    console.error(`Unable to start vinext: ${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
}
