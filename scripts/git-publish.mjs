import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, writeFile, readdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

export function runGit(args, cwd, extraEnv = {}, { timeoutMs = 120_000, command = "git" } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const collect = (chunk) => { output += chunk.toString(); };
    const safeOutput = () => {
      let safe = output.trim();
      for (const [key, value] of Object.entries({ ...process.env, ...extraEnv })) {
        if (/(TOKEN|SECRET|PASSWORD|KEY|GIT_CONFIG_VALUE)/i.test(key) && value?.length >= 8) {
          safe = safe.split(value).join("[redacted]");
          if (value.startsWith("AUTHORIZATION: basic ")) safe = safe.split(value.slice(21)).join("[redacted]");
        }
      }
      return safe;
    };
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === "win32" && child.pid) {
        const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
        killer.once("error", () => child.kill("SIGKILL"));
      } else child.kill("SIGKILL");
      reject(new Error(`git ${args[0]} timed out; check the remote branch before retrying`));
    }, timeoutMs);
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code === 0) resolvePromise(safeOutput());
      else reject(new Error(`git ${args[0]} failed (exit ${code}): ${safeOutput().slice(-20_000)}`));
    });
  });
}

function repoIdentity(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password || url.search || url.hash) {
    throw new Error("BLOG_PUBLISH_GIT_URL must be an HTTPS github.com repository URL");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) throw new Error("BLOG_PUBLISH_GIT_URL must identify owner/repository");
  const repository = parts[1].replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9_.-]+$/.test(parts[0]) || !/^[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("BLOG_PUBLISH_GIT_URL contains an invalid owner or repository name");
  }
  return { owner: parts[0], name: repository, url };
}

export function parseGitRepository(value) {
  const { owner, name } = repoIdentity(value);
  return { owner, name };
}

function publishIgnoreFile() {
  return [
    "node_modules/",
    "**/node_modules/",
    ".next/",
    "**/.next/",
    ".env*",
    "**/.env*",
    "!/.env.production",
    "",
  ].join("\n");
}

export async function prepareGitCommit(stageDirectory, {
  authorName = "Blog Publisher",
  authorEmail = "blog-publisher@users.noreply.github.com",
  baseSha,
  baseRepository,
  gitEnv = {},
} = {}) {
  const stage = resolve(stageDirectory);
  const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const separator = process.platform === "win32" ? "\\" : "/";
  if (stage === sourceRoot || sourceRoot.startsWith(stage + separator)) {
    throw new Error("Publish stage cannot be the source project or one of its parent directories");
  }
  await access(stage);
  if (!authorName || /[\r\n]/.test(authorName) || !authorEmail || /[\r\n]/.test(authorEmail)) {
    throw new Error("A valid single-line git author name and email are required");
  }
  if (baseSha && (!/^[a-f0-9]{40}$/i.test(baseSha) || !baseRepository)) {
    throw new Error("Invalid publication base");
  }
  const gitPath = join(stage, ".git");
  try {
    await access(gitPath);
    throw new Error("Publish stage already contains a .git directory");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  await writeFile(join(stage, ".gitignore"), publishIgnoreFile(), "utf8");
  const branch = `blog-publish-${randomUUID()}`;
  await runGit(["init", "--initial-branch", branch], stage);
  if (baseSha) {
    await runGit(["fetch", "--no-tags", "--depth=1", baseRepository, baseSha], stage, gitEnv, { timeoutMs: 300_000 });
    await runGit(["update-ref", `refs/heads/${branch}`, baseSha], stage);
  }
  await runGit(["add", "--all"], stage);
  await runGit(["-c", `user.name=${authorName}`, "-c", `user.email=${authorEmail}`, "commit", "-m", "Publish static blog snapshot"], stage);

  const sha = await runGit(["rev-parse", "HEAD"], stage);
  const tracked = await runGit(["ls-files", "-z"], stage);
  const trackedFiles = tracked.split("\0").filter(Boolean);
  const forbidden = trackedFiles.filter((file) => /(^|[\\/])(?:node_modules|\.next)(?:[\\/]|$)/.test(file)
    || ((file === ".env.production") ? false : /(^|[\\/])\.env[^\\/]*$/i.test(file)));
  if (forbidden.length) throw new Error(`Publish commit includes ignored paths: ${forbidden.join(", ")}`);
  return { stage, branch, sha };
}

// Reuse a verified production commit from retained local publication objects.
export async function findLocalGitBase(baseSha, jobsDirectory) {
  if (!/^[a-f0-9]{40}$/i.test(baseSha || "")) return null;
  let entries;
  try { entries = await readdir(jobsDirectory, { withFileTypes: true }); } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = join(jobsDirectory, entry.name);
    try {
      await access(join(path, ".git"));
      if (await runGit(["rev-parse", "HEAD"], path) === baseSha) return path;
    } catch { /* A missing/incomplete older stage is not a publication base. */ }
  }
  return null;
}

export async function pushVerifiedCommit(commit, gitEnv, execute = runGit) {
  let pushError;
  try { await execute(["push", "--set-upstream", "origin", commit.branch], commit.stage, gitEnv, { timeoutMs: 300_000 }); }
  catch (error) { pushError = error; }
  try {
    const remote = await execute(["ls-remote", "origin", `refs/heads/${commit.branch}`], commit.stage, gitEnv, { timeoutMs: 30_000 });
    if (remote.split(/\s+/)[0] === commit.sha) return;
  } catch { /* Preserve the exact stage and branch if remote state is unknown. */ }
  throw new Error(`Publication branch was not confirmed (${commit.branch}, ${commit.sha}). Keep stage ${commit.stage} and check the remote before retrying. ${pushError?.message || "Remote SHA mismatch"}`);
}

export async function publishGitStage(stageDirectory, {
  remote = process.env.BLOG_PUBLISH_GIT_URL,
  token = process.env.GITHUB_TOKEN,
  authorName,
  authorEmail,
  baseSha,
} = {}) {
  if (!remote) throw new Error("BLOG_PUBLISH_GIT_URL is required");
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const repository = repoIdentity(remote);
  const authorization = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`;
  const gitAuthEnv = {
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: `http.${repository.url.origin}/.extraheader`,
    GIT_CONFIG_VALUE_0: authorization,
    // Never fall back to a broader saved GitHub CLI/credential-manager identity.
    GIT_CONFIG_KEY_1: "credential.helper",
    GIT_CONFIG_VALUE_1: "",
    GIT_TERMINAL_PROMPT: "0",
  };
  const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const baseRepository = baseSha
    ? await findLocalGitBase(baseSha, join(sourceRoot, ".publish/jobs")) || repository.url.href
    : undefined;
  const commit = await prepareGitCommit(stageDirectory, { authorName, authorEmail, baseSha, baseRepository, gitEnv: gitAuthEnv });
  await runGit(["remote", "add", "origin", repository.url.href], commit.stage);
  await pushVerifiedCommit(commit, gitAuthEnv);
  return { sha: commit.sha, branch: commit.branch, repo: `${repository.owner}/${repository.name}` };
}

export async function prepareGitPublication(stageDirectory, author = {}) {
  return publishGitStage(stageDirectory, author);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stage = process.argv[2];
  if (!stage) {
    console.error("Usage: node scripts/git-publish.mjs <stage-directory>");
    process.exitCode = 2;
  } else {
    publishGitStage(stage)
      .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
      .catch((error) => { console.error(error.message); process.exitCode = 1; });
  }
}
