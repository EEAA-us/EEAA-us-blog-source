import test from "node:test";
import assert from "node:assert/strict";
import { checkGitProject, createGitPreview, promoteGitPreview, vercelRequest } from "../vercel-publish.mjs";
import { checkPreview, fetchPreview } from "../publish-site.mjs";

async function mockedFetch(responses, action) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (!responses.length) throw new Error("Unexpected platform request");
    const response = responses.shift();
    return Response.json(response.body, { status: response.status || 200 });
  };
  try { await action(calls); } finally { globalThis.fetch = original; }
}

test("private repository and matching Vercel project are required before push", async () => {
  await mockedFetch([
    { body: { id: 7, private: true, permissions: { push: true }, default_branch: "main" } },
    { body: { id: 4, login: "owner" } },
    { body: { name: "blog", link: { type: "github", repoId: 7, productionBranch: "main" }, targets: { production: { meta: { githubCommitSha: "a".repeat(40) } } } } },
  ], async () => {
    const project = await checkGitProject({ owner: "owner", name: "blog" });
    assert.equal(project.repoId, "7");
    assert.equal(project.authorEmail, "4+owner@users.noreply.github.com");
    assert.equal(project.baseSha, "a".repeat(40));
  });
  await mockedFetch([{ body: { private: false, permissions: { push: true } } }], async calls => {
    await assert.rejects(checkGitProject({ owner: "owner", name: "blog" }), /私有仓库/);
    assert.equal(calls.length, 1);
  });
});

test("deployment request uses Git snapshot and does not request production", async () => {
  await mockedFetch([{ body: { id: "dpl_test", url: "blog-preview.vercel.app", readyState: "READY", target: "preview" } }], async calls => {
    const preview = await createGitPreview({ repoId: "7", projectName: "blog", sha: "abc", branch: "blog-publish-example" });
    assert.equal(preview.url, "https://blog-preview.vercel.app");
    const payload = JSON.parse(calls[0].init.body);
    assert.deepEqual(payload.gitSource, { type: "github", repoId: "7", sha: "abc", ref: "blog-publish-example" });
    assert.equal(payload.target, undefined);
    assert.equal(payload.files, undefined);
  });
});

test("preview errors stop before promotion", async () => {
  await mockedFetch([{ body: { id: "dpl_test", readyState: "ERROR" } }], async calls => {
    await assert.rejects(createGitPreview({ repoId: "7", projectName: "blog", sha: "abc", branch: "preview" }), /构建失败/);
    assert.equal(calls.length, 1);
  });
});

test("promotion verifies the production deployment ID", async () => {
  await mockedFetch([
    { body: { id: "dpl_test", name: "blog", readyState: "READY", target: null } },
    { body: { id: "dpl_production", readyState: "READY", target: "production" } },
    { body: {} },
    { body: { targets: { production: { id: "dpl_production" } } } },
  ], async calls => {
    await promoteGitPreview("dpl_test");
    assert.deepEqual(JSON.parse(calls[1].init.body), { deploymentId: "dpl_test", name: "blog", target: "production", autoAssignCustomDomains: false });
    assert.match(calls[2].url, /\/promote\/dpl_production/);
    assert.equal(calls[2].init.body, "{}");
    assert.equal(calls.length, 4);
  });
});

test("failed production rebuild keeps the current production domain", async () => {
  await mockedFetch([
    { body: { id: "dpl_test", name: "blog", readyState: "READY" } },
    { body: { id: "dpl_failed", readyState: "ERROR", target: "production" } },
  ], async calls => {
    await assert.rejects(promoteGitPreview("dpl_test"), /正式构建失败/);
    assert.equal(calls.length, 2);
  });
});

test("preview login redirects cannot count as a website check", async () => {
  await mockedFetch([{ status: 302, body: {} }], async calls => {
    await assert.rejects(checkPreview("https://blog-preview.vercel.app", []), /预览检查失败/);
    assert.equal(calls[0].init.redirect, "manual");
    assert.equal(calls.length, 1);
  });
});

test("Vercel credentials cannot be sent to another host", async () => {
  await mockedFetch([], async calls => {
    await assert.rejects(vercelRequest("https://example.test/steal"), /无效/);
    assert.equal(calls.length, 0);
  });
});

test("protected preview pages and statistics use a header without following redirects", async () => {
  const previous = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "test-preview-secret";
  try {
    await mockedFetch(Array.from({ length: 6 }, () => ({ body: {} })), async calls => {
      await checkPreview("https://blog-preview.vercel.app", []);
      const response = await fetchPreview("https://blog-preview.vercel.app", "/api/posts/stats?ids=1");
      await response.body.cancel();
      assert.equal(calls.length, 6);
      for (const call of calls) {
        assert.equal(call.init.headers["x-vercel-protection-bypass"], "test-preview-secret");
        assert.equal(call.init.redirect, "manual");
        assert.ok(!call.url.includes("test-preview-secret"));
      }
    });
    await mockedFetch([{ status: 302, body: {} }], async () => {
      await assert.rejects(checkPreview("https://blog-preview.vercel.app", []), /预览检查失败/);
    });
  } finally {
    if (previous === undefined) delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    else process.env.VERCEL_AUTOMATION_BYPASS_SECRET = previous;
  }
});

test("preview credentials cannot leave the deployment host", async () => {
  await mockedFetch([], async calls => {
    for (const url of ["https://example.test", "http://blog-preview.vercel.app", "https://user:pass@blog-preview.vercel.app", "https://blog-preview.vercel.app:8443"]) {
      await assert.rejects(fetchPreview(url, "/"), /无效/);
    }
    await assert.rejects(fetchPreview("https://blog-preview.vercel.app", "https://example.test"), /其他主机/);
    assert.equal(calls.length, 0);
  });
});
