import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function loadWithRequestDeadline() {
  const source = await readFile(resolve(projectRoot, "lib/bounded-request.ts"), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = { exports: {}, module: { exports: {} }, AbortSignal };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(javascript, sandbox, { filename: "lib/bounded-request.ts" });
  return sandbox.module.exports.withRequestDeadline;
}

async function withTimeoutKeepAlive(timeoutMs, action) {
  const keepAlive = setTimeout(() => {}, timeoutMs + 100);
  try { return await action(); }
  finally { clearTimeout(keepAlive); }
}

test("returns the work result when it completes before the deadline", async () => {
  const withRequestDeadline = await loadWithRequestDeadline();
  const controller = new AbortController();
  const result = await withRequestDeadline(controller.signal, 200, async (signal) => {
    assert.equal(signal.aborted, false);
    return { value: 42 };
  });

  assert.deepEqual(result, { value: 42 });
});

test("rejects when work never returns", async () => {
  const withRequestDeadline = await loadWithRequestDeadline();
  const controller = new AbortController();

  await withTimeoutKeepAlive(30, async () => {
    await assert.rejects(
      withRequestDeadline(controller.signal, 15, () => new Promise(() => {})),
      (error) => error?.name === "TimeoutError",
    );
  });
});

test("deadline covers response body parsing after fetch returns headers", async () => {
  const withRequestDeadline = await loadWithRequestDeadline();
  const controller = new AbortController();
  let receivedHeaders = false;
  const fetchMock = async (_url, _options) => {
    receivedHeaders = true;
    return { json: () => new Promise(() => {}) };
  };

  await withTimeoutKeepAlive(30, async () => {
    await assert.rejects(
      withRequestDeadline(controller.signal, 15, async (signal) => {
        const response = await fetchMock("/weather", { signal });
        return response.json();
      }),
      (error) => error?.name === "TimeoutError",
    );
  });

  assert.equal(receivedHeaders, true);
});

test("rejects with the external abort reason", async () => {
  const withRequestDeadline = await loadWithRequestDeadline();
  const controller = new AbortController();
  const reason = new Error("request superseded");
  const request = withRequestDeadline(controller.signal, 200, () => new Promise(() => {}));

  controller.abort(reason);
  await assert.rejects(request, (error) => error === reason);
});

test("a pre-aborted signal skips work and creates no unhandled rejection", async () => {
  const withRequestDeadline = await loadWithRequestDeadline();
  const controller = new AbortController();
  const reason = new Error("already cancelled");
  controller.abort(reason);
  let workCalled = false;
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);

  try {
    await assert.rejects(
      withRequestDeadline(controller.signal, 15, () => {
        workCalled = true;
        return Promise.reject(new Error("work must not run"));
      }),
      (error) => error === reason,
    );
    await new Promise((resolveNext) => setImmediate(resolveNext));
  } finally {
    process.removeListener("unhandledRejection", onUnhandled);
  }

  assert.equal(workCalled, false);
  assert.deepEqual(unhandled, []);
});

test("preserves ordinary work failures", async () => {
  const withRequestDeadline = await loadWithRequestDeadline();
  const controller = new AbortController();
  const failure = new TypeError("invalid response");

  await assert.rejects(
    withRequestDeadline(controller.signal, 200, async () => { throw failure; }),
    (error) => error === failure,
  );
});
