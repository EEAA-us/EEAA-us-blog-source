// Git deployments avoid Hobby's CLI source-upload size limit.
export async function vercelRequest(path, init = {}) {
  const url = new URL(path, "https://api.vercel.com");
  if (url.origin !== "https://api.vercel.com") throw new Error("无效的平台地址");
  if (process.env.VERCEL_ORG_ID?.startsWith("team_")) url.searchParams.set("teamId", process.env.VERCEL_ORG_ID);
  const result = await fetch(url, {
    ...init, headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json", ...init.headers },
    redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  if (!result.ok) throw new Error(`Vercel请求失败(${result.status})，请核对平台状态`);
  const text = await result.text();
  return text ? JSON.parse(text) : null;
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function checkGitProject(repository) {
  const response = await fetch(`https://api.github.com/repos/${repository.owner}/${repository.name}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("无法读取部署仓库，请配置专用私有仓库及权限");
  const repo = await response.json();
  if (!repo.private || !repo.permissions?.push) throw new Error("部署需要你可写入的私有仓库");
  if (!repo.default_branch || repo.default_branch.startsWith("blog-publish-")) throw new Error("部署仓库须先以main等分支创建初始README，不能使用空仓库");
  const accountResponse = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
    redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  if (!accountResponse.ok) throw new Error("无法确认GitHub发布账号");
  const account = await accountResponse.json();
  if (!account.login || !Number.isSafeInteger(account.id)) throw new Error("无效的GitHub账号结果");
  const project = await vercelRequest(`/v9/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID)}`);
  if (project.link?.type !== "github" || String(project.link.repoId) !== String(repo.id)) throw new Error("Vercel项目尚未关联对应GitHub部署仓库");
  if (project.link.productionBranch?.startsWith("blog-publish-")) throw new Error("正式分支不能使用发布预览分支名称");
  const production = project.targets?.production;
  const baseSha = production?.meta?.githubCommitSha;
  return { repoId: String(repo.id), projectName: project.name, authorName: account.login, authorEmail: `${account.id}+${account.login}@users.noreply.github.com`,
    baseSha: /^[a-f0-9]{40}$/i.test(baseSha || "") ? baseSha : undefined };
}

export async function createGitPreview({ repoId, projectName, sha, branch }, progress = () => {}) {
  let deployment = await vercelRequest("/v13/deployments", {
    method: "POST", body: JSON.stringify({
      name: projectName, project: process.env.VERCEL_PROJECT_ID,
      gitSource: { type: "github", repoId, sha, ref: branch },
      projectSettings: { framework: "nextjs", buildCommand: "npm run build", installCommand: "npm ci --no-audit --no-fund" },
    }),
  });
  if (!deployment?.id) throw new Error("平台没有返回部署ID");
  const deadline = Date.now() + 30 * 60_000;
  while (deployment.readyState !== "READY") {
    if (["ERROR", "CANCELED"].includes(deployment.readyState)) throw new Error("云端预览构建失败，未请求切换正式站");
    if (Date.now() > deadline) throw new Error("云端构建等待超时，请检查平台任务");
    progress("previewing", `云端正在构建预览：${deployment.readyState || "等待中"}`);
    await pause(10_000);
    deployment = await vercelRequest(`/v13/deployments/${encodeURIComponent(deployment.id)}`);
  }
  if (deployment.target === "production") throw new Error("预览意外成为正式部署，请检查项目分支配置");
  if (!/^[a-zA-Z0-9-]+\.vercel\.app$/.test(deployment.url)) throw new Error("平台返回了无效预览地址");
  return { id: deployment.id, url: `https://${deployment.url}` };
}

export async function promoteGitPreview(id) {
  // Preview and production use different environment variables. Vercel requires
  // a production rebuild before promotion; keep the current domain until READY.
  const preview = await vercelRequest(`/v13/deployments/${encodeURIComponent(id)}`);
  if (preview.readyState !== "READY") throw new Error("预览尚未就绪，未切换正式站");
  let production = await vercelRequest("/v13/deployments", {
    method: "POST", body: JSON.stringify({
      deploymentId: id, name: preview.name, target: "production", autoAssignCustomDomains: false,
    }),
  });
  if (!production?.id) throw new Error("平台没有返回正式构建ID，未请求切换正式站");
  const buildDeadline = Date.now() + 30 * 60_000;
  while (production.readyState !== "READY") {
    if (["ERROR", "CANCELED"].includes(production.readyState)) throw new Error("正式构建失败，未请求切换正式站");
    if (Date.now() > buildDeadline) throw new Error("正式构建等待超时，请核对平台状态");
    await pause(10_000);
    production = await vercelRequest(`/v13/deployments/${encodeURIComponent(production.id)}`);
  }
  if (production.target !== "production") throw new Error("平台未生成正式部署，未请求切换正式站");
  await vercelRequest(`/v10/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID)}/promote/${encodeURIComponent(production.id)}`, { method: "POST", body: "{}" });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const project = await vercelRequest(`/v9/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID)}`);
    if (project.targets?.production?.id === production.id) return production.id;
    await pause(3000);
  }
  throw new Error("已请求推广但未确认正式版本；请到Vercel核对，不要假定已回退");
}
