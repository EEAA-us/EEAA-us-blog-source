import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { prepareGitCommit, findLocalGitBase, pushVerifiedCommit, runGit } from "../git-publish.mjs";

test("new snapshot reuses the previous commit and records removed files", async () => {
  const root = await mkdtemp(join(tmpdir(), "blog-git-test-"));
  try {
    const old = join(root, "old"); const next = join(root, "next");
    await mkdir(old); await mkdir(next);
    await writeFile(join(old, "shared.bin"), Buffer.alloc(1024 * 1024, 42));
    await writeFile(join(old, "obsolete.txt"), "old page");
    const base = await prepareGitCommit(old);
    const remote = join(root, "remote.git");
    await runGit(["init", "--bare", remote], root);
    await runGit(["push", remote, `${base.sha}:refs/heads/main`], old);
    await writeFile(join(next, "shared.bin"), Buffer.alloc(1024 * 1024, 42));
    await writeFile(join(next, "new.txt"), "new page");
    const commit = await prepareGitCommit(next, { baseSha: base.sha, baseRepository: pathToFileURL(old).href });
    assert.equal(await runGit(["rev-parse", "HEAD^"], next), base.sha);
    assert.equal(await runGit(["rev-parse", "HEAD:shared.bin"], next), await runGit(["rev-parse", "HEAD:shared.bin"], old));
    assert.match(await runGit(["ls-tree", "--name-only", "HEAD"], next), /new.txt/);
    assert.doesNotMatch(await runGit(["ls-tree", "--name-only", "HEAD"], next), /obsolete.txt/);
    assert.equal(await findLocalGitBase(base.sha, root), old);
    assert.match(commit.branch, /^blog-publish-/);
    await runGit(["remote", "add", "origin", remote], next);
    await pushVerifiedCommit(commit, {});
    assert.equal((await runGit(["ls-remote", remote, `refs/heads/${commit.branch}`], next)).split(/\s+/)[0], commit.sha);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a failed push that actually arrived is confirmed without a second upload", async () => {
  const calls = [];
  const commit = { sha: "a".repeat(40), branch: "blog-publish-test", stage: "isolated-stage" };
  await pushVerifiedCommit(commit, {}, async args => {
    calls.push(args[0]);
    if (args[0] === "push") throw new Error("RPC disconnected");
    return `${commit.sha}\trefs/heads/${commit.branch}`;
  });
  assert.deepEqual(calls, ["push", "ls-remote"]);
});

test("a different remote SHA stops publication instead of silently passing", async () => {
  const commit = { sha: "a".repeat(40), branch: "blog-publish-test", stage: "isolated-stage" };
  await assert.rejects(pushVerifiedCommit(commit, {}, async args => args[0] === "push" ? "ok" : `${"b".repeat(40)}\trefs/heads/${commit.branch}`), /not confirmed/);
});

test("a stalled subprocess has a deadline", async () => {
  const started = Date.now();
  await assert.rejects(runGit(["-e", "setInterval(()=>{},1000)"], process.cwd(), {}, { command: process.execPath, timeoutMs: 150 }), /timed out/);
  assert.ok(Date.now() - started < 5000);
});

test("Git diagnostics redact credentials", async () => {
  const secret = "publication-secret-test";
  await assert.rejects(runGit(["-e", "console.error(process.env.GITHUB_TOKEN);process.exit(1)"], process.cwd(), { GITHUB_TOKEN: secret }, { command: process.execPath }), error => !error.message.includes(secret) && error.message.includes("[redacted]"));
});

test("successful machine-readable Git output is not truncated", async () => {
  const output = await runGit(["-e", "process.stdout.write('x'.repeat(25000))"], process.cwd(), {}, { command: process.execPath });
  assert.equal(output.length, 25000);
});
