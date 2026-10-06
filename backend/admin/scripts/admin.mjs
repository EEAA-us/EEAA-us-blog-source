import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, rename, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const [command, ...args] = process.argv.slice(2);
if (!["dev", "build"].includes(command)) throw new Error("Use admin.mjs dev or build");
const report = args.includes("--report");
const forwarded = args.filter(arg => arg !== "--report");
if (command === "build" && forwarded.some(arg => /^--(?:outDir|emptyOutDir)(?:=|$)/.test(arg))) {
  throw new Error("Build output is managed by admin.mjs");
}
const env = {
  ...process.env,
  NODE_OPTIONS: process.env.NODE_OPTIONS || `--max-old-space-size=${command === "build" ? 8192 : 4096}`,
  ...(report ? { npm_lifecycle_event: "report" } : {})
};
function run(script, argv) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [script, ...argv], { cwd: root, env, shell: false, windowsHide: true, stdio: "inherit" });
    child.once("error", fail);
    child.once("close", code => code === 0 ? done() : fail(new Error(`Admin ${command} failed (${code})`)));
  });
}
const vite = resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js");
if (command === "dev") {
  await run(vite, ["--host", "127.0.0.1", ...forwarded]);
} else {
  const suffix = randomUUID();
  const temporary = resolve(root, `.admin-build-${suffix}`);
  const backup = resolve(root, `.admin-previous-${suffix}`);
  const dist = resolve(root, "dist");
  for (const path of [temporary, backup, dist]) {
    if (!path.startsWith(root + sep)) throw new Error("Admin output escapes workspace");
  }
  let oldMoved = false;
  try {
    await run(vite, ["build", ...forwarded, "--outDir", temporary]);
    const versionScript = resolve(dirname(require.resolve("version-rocket/package.json")), "scripts/createVersionFile.js");
    await run(versionScript, [temporary]);
    await access(resolve(temporary, "index.html"));
    try { await access(dist); oldMoved = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (oldMoved) await rename(dist, backup);
    try { await rename(temporary, dist); } catch (error) {
      if (oldMoved) await rename(backup, dist);
      throw error;
    }
    if (oldMoved) await rm(backup, { recursive: true, force: true });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
