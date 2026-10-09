一个可以自行部署、按喜好调整外观的博客项目，用于记录与分享内容。提供文章阅读、相册和项目展示，支持自定义封面、配色与动态效果，配有内容管理后台。

可以搭配插画、动态封面与桌宠，打造偏二次元风格的个人空间，也可以通过更换素材与配色调整为其他风格。

基于 Next.js、FastAPI 和 Vue 构建。访客浏览站点，站长通过管理后台编辑内容；站点名称、个人介绍和外观可按自己的需要配置。

## 功能概览

| 部分 | 提供的功能 |
| --- | --- |
| 文章阅读 | Markdown 正文、代码高亮、文章搜索与分类筛选 |
| 外观调整 | 配色、静态封面、轮播封面、视频/GIF 动态封面与访客外观偏好 |
| 内容展示 | 相册与照片预览、项目展示、关于页与个人介绍 |
| 内容管理 | 文章编辑、草稿/发布/归档状态、分类标签、相册与图片上传 |
| 可选扩展 | 音乐、桌宠与互动工具；部分功能需要额外素材或外部服务 |

项目适合维护个人记录、技术文章和作品展示。访客以浏览为主，内容由站长管理。功能的配置条件见[基础素材与可选功能](#基础素材与可选功能)。

## 效果参考

[个人博客示例](https://shiguang-blog-five.vercel.app/)：基于本项目搭建的个人站点，可参考页面布局、动态封面与整体视觉效果。

参考站点使用了站长自己的内容与素材。开源包提供基础占位素材，动态封面与桌宠所需资源由使用者自行配置，详见[基础素材与可选功能](#基础素材与可选功能)。

## 参考与致谢

本项目参考了 Shirone 的整体框架与设计，并从 Kirameku 借鉴功能思路。感谢这两个项目及其贡献者的开源工作。

- **Shirone**：[开源仓库](https://github.com/LyraVoid/Shirone) · [官方文档](https://docs.shirone.mysqil.com/) · [演示网站](https://shirone.akatsuki.codes/)
- **Kirameku**：[开源仓库](https://github.com/Xinghongia/Kirameku) · [演示网站](https://boke.hiromu.top)

管理后台基于 PureAdmin 上游模板，来源与许可说明见 [NOTICE.md](NOTICE.md)。

## 组成部分

- `app/`、`components/`、`lib/`：Next.js 前台。
- `backend/app/`：FastAPI 服务，默认使用本地 SQLite；`backend/admin/`：Vue 管理后台。
- `data/`：前台样例数据和类型；项目列表从 `app/projects/projectsData.ts` 读取，初始为空。项目的 `categorySlug` 可关联文章分类。前台项目条目不会自动从后台的分类/项目管理中同步。
- `scripts/publish-site.mjs`：为静态前台导出公开内容快照并准备独立发布目录。静态前台不能直接连接这份源码里的本地后端；若要使用动态后台，需要单独部署并配置后端。

## 本地开发

已验证的开发环境为 Node.js 24、Python 3.13 和 pnpm 12.3.4。管理后台声明支持 pnpm 9 及以上；新安装建议使用已验证的版本。先获取源码：

```sh
git clone https://github.com/EEAA-us/EEAA-us-blog-source.git
cd EEAA-us-blog-source
```

也可以下载 [Releases](https://github.com/EEAA-us/EEAA-us-blog-source/releases) 中的源码包，解压后进入项目目录。根目录的 `package-lock.json` 是前台依赖的锁文件；管理后台使用自己的 `pnpm-lock.yaml`。首次安装依赖：

```sh
npm ci
cd backend/admin
pnpm install --frozen-lockfile
cd ../..
```

Windows PowerShell 可使用相同命令；如果系统的 Python 启动器名为 `py`，下面的 `python` 命令可替换为 `py -3.13`。

### 启动后端

在项目根目录执行：

```sh
# Windows PowerShell
Copy-Item backend/.env.example backend/.env
python -m venv backend/venv
backend/venv/Scripts/python -m pip install --upgrade pip
backend/venv/Scripts/python -m pip install -r backend/requirements.lock.txt

# Linux / macOS
cp backend/.env.example backend/.env
python3.13 -m venv backend/venv
backend/venv/bin/python -m pip install --upgrade pip
backend/venv/bin/python -m pip install -r backend/requirements.lock.txt
```

上述复制环境文件的命令仅用于新安装；已有安装请保留原配置与数据。编辑 `backend/.env`，为 `SECRET_KEY` 设置仅本机使用的随机值。可在终端生成：

```sh
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

将命令输出自行粘贴到环境文件，不要提交该文件。首次运行前，在 `backend` 目录创建管理员账号：

```sh
cd backend
# Windows PowerShell
.\venv\Scripts\python.exe scripts\create_admin.py --username owner
# Linux / macOS
./venv/bin/python scripts/create_admin.py --username owner
```

按提示输入并再次确认密码。密码要求为 12–72 个 UTF-8 字节；程序不会设置通用默认密码。然后仍在 `backend` 目录启动服务：

```sh
# Windows PowerShell
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# Linux / macOS
./venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

SQLite 默认文件为 `backend/kirameku.db`，由服务创建。不要把数据库、上传目录或 `.env` 放入公开源码仓库。

### 启动管理后台与前台

在 `backend/admin` 目录复制开发环境示例并启动：

```sh
# Windows PowerShell
Copy-Item .env.example .env.local
pnpm dev
# Linux / macOS
cp .env.example .env.local
pnpm dev
```

管理后台开发服务器默认使用本机 8849 端口。另开终端，在项目根目录启动前台：

```sh
npm run dev
```

前台默认使用 3000 端口；开发配置会把 `/api` 与 `/uploads` 请求转发到本机 8000 端口的 FastAPI 服务。先启动后端，再访问前台和管理后台。

生产构建管理后台时，在 `backend/admin` 中复制 `.env.production.example` 为 `.env.production`，按需设置公开构建选项，再运行：

```sh
pnpm build
```

构建文件由 FastAPI 的 `/admin/` 路径提供。根目录前台可用 `npm run build` 构建；运行 `npm start` 前应按目标环境配置后端地址与内容模式。

### 首次使用

1. 按上述步骤启动三个服务，访问 `http://localhost:3000` 查看前台，在 `http://localhost:8849` 使用自己创建的管理员账号登录后台。
2. 修改 `siteConfig.ts` 中的站点名称、作者、个人介绍与封面；关于页正文在 `app/about/about.md`。修改源码配置后，重新构建已部署的前台才能生效。
3. 在后台“文章管理”中新建文章，填写标题与正文，可设置分类、标签和封面。先以“草稿”保存，准备公开时选择“已发布”并保存。
4. 在前台文章列表检查自己的内容。动态内容模式下从后端读取；公开快照模式下，需要重新导出并发布才能更新线上文章。

初始文章、项目与相册内容为空或使用基础占位素材，先添加自己的内容再分享站点。

动态后端对未登录访客只提供已发布文章；站长登录后可查看与编辑草稿和归档。后台选择“已发布”并保存后文章才进入公开范围，改回非公开状态后，动态接口会停止向访客提供正文。公开快照中的旧内容需要重新发布才能更新。

## 常用配置

| 位置 | 用途 |
| --- | --- |
| `siteConfig.ts` | 站点名称、作者、个人介绍、封面、社交链接与源码仓库入口 |
| `siteConfig.ts` 的 `initialAppearance` | 初次访问与重置偏好时的封面模式、动态素材地址与桌宠默认值 |
| `siteConfig.ts` 的 `heroVideoVariants` | 可选的视频适配版本：以原视频地址为键，配置 `compact`（视口≤1024）与 `standard`（≤1920）地址；更大屏幕或未配置时保留原视频，适配版失败回退原视频 |
| `app/about/about.md` | 关于页正文 |
| `app/projects/projectsData.ts` | 前台项目展示列表，初始为空 |
| `backend/.env` | 后端密钥、数据库、允许访问的来源与上传存储配置 |
| 后台“博客封面与素材”与“博客默认外观” | 站点配置、媒体目录与默认外观；公开快照模式下需重新发布 |

后台维护的配置保存在数据库中；`siteConfig.ts` 提供源码默认值，两者不会自动相互改写。前台项目列表也不会自动从后台项目管理同步。已保存的访客外观偏好可能优先于新的默认值，可通过页面的重置偏好入口查看默认效果。

## 内容与发布模式

| 模式 | 内容如何更新 | 需要运行什么 |
| --- | --- | --- |
| 动态内容模式 | 前台通过后端读取文章等内容，后台保存后可重新加载查看 | Next.js 前台与 FastAPI 后端；站长使用 Vue 管理后台 |
| 公开快照模式 | 将后端公开内容导出到独立前台发布目录，内容改动后重新发布 | 支持 Next.js 的托管环境；数据库与管理后台保留在单独的管理环境中 |

默认开发模式的 `/api` 与 `/uploads` 转发到 `127.0.0.1:8000`。如果前后端分别部署在不同主机，需要在 `next.config.ts` 调整转发目标，并核对后端 `CORS_ORIGINS` 与上传文件的访问地址。`siteConfig.apiBaseUrl` 控制浏览器内容 API 的请求前缀，不能代替所有服务端转发配置；线上前台的本机地址指托管主机。

公开快照模式使用 `NEXT_PUBLIC_CONTENT_MODE=published`。完成本地后端与内容配置后，在项目根目录运行 `npm run publish:prepare`，会导出公开内容、准备独立目录并执行前台构建；输出中的 `stage` 是准备好的目录。这个命令只准备发布文件，不推送仓库或切换线上站点。公开快照指内容来源，产物仍需按 Next.js 项目部署。

`npm run publish:site` 是 GitHub、Vercel 和云端统计配套的自动发布流程，需要自己的部署仓库、平台凭据、站点地址与统计服务配置。所需变量在 [scripts/publish-site.mjs](scripts/publish-site.mjs) 中集中检查；没有这些配置时不会完成上线。仅运行 `npm run build` 也不会自动部署网站。不要把本地数据库或未经筛选的上传目录复制到公开发布目录。

导航头像旁的 GitHub 图标、首页个人卡片和关于页的“开源项目”使用同一个仓库地址，默认指向本项目。可在 `siteConfig.ts` 修改，或通过 `NEXT_PUBLIC_SOURCE_REPOSITORY_URL` 覆盖；设为空字符串时隐藏入口。后续版本沿用同一仓库和 Releases。不要把私有部署仓库当作公开源码仓库。

## 基础素材与可选功能

替换 `public/images/site-logo.png` 可修改导航图标；站点名称、个人介绍、头像、封面和仓库地址等在 `siteConfig.ts` 配置。源码包中的文章与项目初始为空，默认使用静态占位图、系统字体，音乐歌单与动态媒体目录为空，桌宠关闭。请用自己拥有使用权的内容与素材替换默认配置。动态视频/GIF与桌宠接口保留；需要自行提供有授权的媒体以及桌宠运行资源，默认包不包含游戏角色模型。首次访问与重置偏好的封面/桌宠默认值由 `initialAppearance` 控制，已保存的访客选择不会被覆盖。

小功能提供守望先锋论坛周榜、鸣潮相关视频与搜索结果，以及 Tibo（`@thsottiaux`）公开动态的站内阅读和自动中英对照。原文先显示，机器翻译随后加载；关闭工具会取消请求。守望先锋使用暴雪官方论坛的周榜；鸣潮搜索结果不代表热度排名，搜索索引可能滞后。Tibo 仅展示公开主页可读取的近期动态，可能不完整，来源缓存最长3分钟；X 页面结构或 UAPI 搜索/翻译服务变化时会显示失败和重试，不能保证所有第三方服务持续可用。这些工具需要运行 Next.js 服务端，纯静态文件托管不提供对应接口。

游戏相册数据在 `data/game-gallery.ts`，支持原神、鸣潮、绝区零与星穹铁道。公开模板默认列表为空；添加照片时填写角色名、来源、尺寸和本地路径，并在同文件的 `albumDetails` 中设置相册标题及不重复的 ID，再运行 `npm run photos:thumbnails` 生成卡片小图。个人站的游戏图片及译名修订不随公共源码分发。

未配置云端统计时，后台工作台会显示线上统计不可用，相应接口返回 503；本地内容管理仍可使用。小说阅读器、地图底图、音乐等外部服务也需要各自的服务或网络条件。

添加自己的本地照片后，可运行 `npm run photos:thumbnails` 为 `public/images/article-covers/`、`anime-stills/`、`games/` 下的静态图片生成照片墙小图。索引保存在 `public/photo-thumbnails.json`；照片卡片和相册预览使用小图，灯箱继续使用原图。命令不覆盖原图，也不下载外部素材。模板索引默认为空；上传图片或未配置小图的地址仍沿用原加载方式。生成或更换小图后需要重新构建/发布。

## 素材与许可

根目录 MIT 许可适用于本项目自有代码。第三方依赖和后台模板各自遵循其上游许可证；请保留相应许可证和 `NOTICE.md`。包内占位媒体不代表你可以将自己的内容作为素材发布。动态上传、头像、封面和可切换字体功能仍需由部署者提供有使用权的素材。详情见 [NOTICE.md](NOTICE.md)。

安全问题请阅读 [SECURITY.md](SECURITY.md)。版本记录见 [CHANGELOG.md](CHANGELOG.md)。

## 开发检查

安装前后台依赖后，在根目录运行 `node --test scripts/tests/*.test.mjs`、`npx next typegen`、`npx tsc --noEmit`、`npm run lint` 和 `npm run build`；后台执行 `pnpm typecheck`、`pnpm build`。后端隔离测试使用随机测试密钥和临时 SQLite，见 `.github/workflows/ci.yml`。不使用真实数据库或重置内容来验证代码。

问题反馈和改进建议可提交到 [Issues](https://github.com/EEAA-us/EEAA-us-blog-source/issues)。报告问题时说明操作步骤、运行环境与错误信息，隐去账号、密钥和私人内容；提交代码改动时说明影响范围与相关检查结果。
