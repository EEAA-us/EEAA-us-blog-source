import { cp, mkdir, readFile, writeFile, access, constants, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { prepareGitPublication, parseGitRepository } from "./git-publish.mjs";
import { checkGitProject, createGitPreview, promoteGitPreview } from "./vercel-publish.mjs";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowedDirectories = ["app", "components", "data", "lib", "types", "public"];
const allowedFiles = ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "eslint.config.mjs", "siteConfig.ts", "next-env.d.ts"];

function redact(value) {
  let clean = String(value);
  for (const [key, secret] of Object.entries(process.env)) {
    if (/(TOKEN|SECRET|PASSWORD|KEY)/i.test(key) && secret && secret.length >= 8) clean = clean.split(secret).join("[redacted]");
  }
  return clean;
}

export function run(command, args, cwd, timeout = 900_000, extraEnv = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...extraEnv }, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const collect = chunk => { output = (output + chunk.toString()).slice(-60_000); };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timer = setTimeout(() => { child.kill(); fail(new Error("运行超时，请检查发布日志后重试")); }, timeout);
    child.on("error", error => { clearTimeout(timer); fail(error); });
    child.on("close", code => { clearTimeout(timer); if (code === 0) done(redact(output)); else fail(new Error(redact(output))); });
  });
}

export async function stageSite(destination) {
  const stage = resolve(destination);
  if (stage === root || root.startsWith(stage + "/") || root.startsWith(stage + "\\")) throw new Error("发布目录不能覆盖工程");
  await mkdir(stage, { recursive: true });
  if ((await readdir(stage)).length) throw new Error("发布目录必须为空，避免混入上次文件");
  for (const folder of allowedDirectories) await cp(join(root, folder), join(stage, folder), { recursive: true, filter: path => !/(^|[\\/])(?:\.env[^\\/]*|node_modules|\.next|\.private)(?:[\\/]|$)/.test(path) });
  for (const filename of allowedFiles) {
    try { await access(join(root, filename), constants.R_OK); } catch { if (filename === "next-env.d.ts") continue; throw new Error(`缺少发布文件 ${filename}`); }
    await cp(join(root, filename), join(stage, filename));
  }
  // Snapshot export overlays only the explicitly public content and referenced uploads.
  const python = process.env.BLOG_PUBLISH_PYTHON || join(root, "backend", "venv", ...(process.platform === "win32" ? ["Scripts", "python.exe"] : ["bin", "python"]));
  await run(python, [join(root, "backend/scripts/export_site.py"), "--output", stage], root);
  // The local RSS remains live; only the publication copy becomes a build artifact.
  const feedPath = join(stage, "app/feed/route.ts");
  const feed = await readFile(feedPath, "utf8");
  await writeFile(feedPath, `export const dynamic = "force-static";\n${feed}`, "utf8");
  for (const page of ["app/posts/[slug]/page.tsx", "app/projects/[id]/page.tsx"]) {
    const path = join(stage, page);
    await writeFile(path, `export const dynamicParams = false;\n${await readFile(path, "utf8")}`, "utf8");
  }
  await writeFile(join(stage, ".env.production"), `NEXT_PUBLIC_CONTENT_MODE=published\n${process.env.NEXT_PUBLIC_SITE_URL ? `NEXT_PUBLIC_SITE_URL=${process.env.NEXT_PUBLIC_SITE_URL}\n` : ""}`, "utf8");
  await writeFile(join(stage, ".vercelignore"), "node_modules\n.next\nbackend\n.env*\n!.env.production\n", "utf8");
  await writeFile(join(stage, "vercel.json"), JSON.stringify({ framework: "nextjs", git: { deploymentEnabled: false } }), "utf8");
  return stage;
}

async function npm(args, cwd, extraEnv) {
  const npmCli = process.env.BLOG_NPM_CLI || join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  return run(process.execPath, [npmCli, ...args], cwd, 900_000, extraEnv);
}

export async function fetchPreview(url, path) {
  const deployment = new URL(url);
  if (deployment.protocol !== "https:" || !/^[a-zA-Z0-9-]+\.vercel\.app$/.test(deployment.hostname) || deployment.port || deployment.username || deployment.password || deployment.search || deployment.hash) {
    throw new Error("无效的Vercel预览地址，未发送预览凭据");
  }
  const target = new URL(path, deployment);
  if (target.origin !== deployment.origin) throw new Error("预览检查不能访问其他主机");
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return fetch(target, {
    headers: secret ? { "x-vercel-protection-bypass": secret } : {},
    signal: AbortSignal.timeout(30_000), redirect: "manual",
  });
}

export async function checkPreview(url, posts) {
  for (const path of ["/", "/posts", "/projects", "/photowall", "/content/index.json", ...posts.slice(0, 2).map(post => `/posts/${encodeURIComponent(post.slug)}`)]) {
    const result = await fetchPreview(url, path);
    if (!result.ok) throw new Error(`预览检查失败 ${path}: ${result.status}，未切换正式站`);
    await result.body?.cancel();
  }
}

export async function publishSite({ prepareOnly = false, destination, progress = () => {}, verifyPreview = async () => {} } = {}) {
  const stage = destination || join(root, ".publish/jobs", randomUUID());
  if (!prepareOnly) {
    for (const key of ["VERCEL_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_ORG_ID", "VERCEL_AUTOMATION_BYPASS_SECRET", "BLOG_PUBLISH_GIT_URL", "GITHUB_TOKEN", "NEXT_PUBLIC_SITE_URL", "BLOG_STATS_URL", "BLOG_STATS_ADMIN_TOKEN", "BLOG_STATS_SERVICE_TOKEN"]) {
      if (!process.env[key]) throw new Error(`尚未配置 ${key}，没有上线或改动云端数据`);
    }
    for (const key of ["NEXT_PUBLIC_SITE_URL", "BLOG_STATS_URL"]) {
      const configured = new URL(process.env[key]);
      if (/[\r\n]/.test(process.env[key]) || configured.protocol !== "https:" || configured.username || configured.password || configured.search || configured.hash) throw new Error(`${key}必须是HTTPS地址`);
    }
  }
  progress("exporting", "导出公开内容并准备独立发布目录");
  await stageSite(stage);
  const index = JSON.parse(await readFile(join(stage, "public/content/index.json"), "utf8"));
  if (index.schemaVersion !== 1 || !Array.isArray(index.posts)) throw new Error("公开内容快照格式不正确");
  progress("building", "安装生产构建依赖并验证网页");
  await npm(["ci", "--no-audit", "--no-fund"], stage);
  await npm(["run", "build"], stage, { NEXT_PUBLIC_CONTENT_MODE: "published" });
  if (prepareOnly) return { prepared: true, published: false, posts: index.posts.length, stage };
  const project = await checkGitProject(parseGitRepository(process.env.BLOG_PUBLISH_GIT_URL));
  progress("previewing", "推送独立私有部署分支并生成预览");
  const git = await prepareGitPublication(stage, { authorName: project.authorName, authorEmail: project.authorEmail, baseSha: project.baseSha });
  const preview = await createGitPreview({ ...project, ...git }, progress);
  const url = preview.url;
  await checkPreview(url, index.posts);
  // Optional task-specific checks must complete before statistics or promotion.
  await verifyPreview(url);
  // Registry initialization never resets existing cloud counts. Tokens are only service-to-service.
  progress("syncing", "同步文章登记与首次累计数字");
  const statsUrl = new URL(process.env.BLOG_STATS_URL);
  if (statsUrl.protocol !== "https:") throw new Error("云端统计必须使用HTTPS");
  const synced = await fetch(new URL("/admin/sync", statsUrl), {
    method: "POST", headers: { Authorization: `Bearer ${process.env.BLOG_STATS_ADMIN_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ revision: index.generatedAt, posts: index.posts.map(({ id, slug, title, views, likes }) => ({ id, slug, title, views, likes })) }),
    signal: AbortSignal.timeout(30_000), redirect: "error",
  });
  if (!synced.ok) throw new Error(`统计同步失败(${synced.status})，未切换正式站`);
  await synced.body?.cancel();
  if (index.posts.length) {
    const probe = await fetchPreview(url, `/api/posts/stats?ids=${index.posts[0].id}`);
    if (!probe.ok || !(await probe.json()).posts?.[index.posts[0].id]) throw new Error("统计登记已同步，但预览统计检查失败；未切换正式站");
  }
  progress("promoting", "将已验证的预览切换为正式版本");
  await promoteGitPreview(preview.id);
  return { prepared: true, published: true, posts: index.posts.length, url: process.env.NEXT_PUBLIC_SITE_URL, previewUrl: url };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  publishSite({ prepareOnly: process.argv.includes("--prepare-only"), progress: (phase, message) => console.log(`${phase}: ${message}`) })
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(redact(error.message)); process.exitCode = 1; });
}
