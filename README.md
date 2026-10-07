一个可以自行部署、按喜好调整外观的博客项目，用于记录与分享内容。提供文章阅读、相册和项目展示，支持自定义封面、配色与动态效果，配有内容管理后台。

可以搭配插画、动态封面与桌宠，打造偏二次元风格的个人空间，也可以通过更换素材与配色调整为其他风格。

基于 Next.js、FastAPI 和 Vue 构建。访客浏览站点，站长通过管理后台编辑内容；站点名称、个人介绍和外观可按自己的需要配置。

## 效果参考

[在线示例](https://shiguang-blog-five.vercel.app/)：使用本项目搭建，可参考页面布局、动态封面与整体视觉效果。

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

本轮实际使用 Node.js 24、Python 3.13 和 pnpm 12.3.4 验证。管理后台声明支持 pnpm 9 及以上；新安装建议使用已验证的版本。根目录的 `package-lock.json` 是前台依赖的锁文件；管理后台使用自己的 `pnpm-lock.yaml`。首次安装依赖：

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

## 内容与发布模式

默认前台开发模式通过本机后端读取动态内容。静态发布模式需要先用后端导出公开内容快照，并在发布构建中使用 `NEXT_PUBLIC_CONTENT_MODE=published`。项目提供 `npm run publish:prepare` 和 `npm run publish:site` 入口；它们涉及快照导出和独立发布流程，细节与所需环境变量以 `scripts/publish-site.mjs` 为准。不要把本地数据库或未经筛选的上传目录复制到静态站点。

导航头像旁的 GitHub 图标、首页个人卡片和关于页的“开源项目”使用同一个仓库地址，默认指向本项目。可在 `siteConfig.ts` 修改，或通过 `NEXT_PUBLIC_SOURCE_REPOSITORY_URL` 覆盖；设为空字符串时隐藏入口。后续版本沿用同一仓库和 Releases。不要把私有部署仓库当作公开源码仓库。

## 基础素材与可选功能

替换 `public/images/site-logo.png` 可修改导航图标；站点名称、个人介绍、头像、封面和仓库地址等在 `siteConfig.ts` 配置。源码包中的文章与项目初始为空，默认使用静态占位图、系统字体，音乐歌单与动态媒体目录为空，桌宠关闭。请用自己拥有使用权的内容与素材替换默认配置。动态视频/GIF与桌宠接口保留；需要自行提供有授权的媒体以及桌宠运行资源，默认包不包含游戏角色模型。首次访问与重置偏好的封面/桌宠默认值由 `initialAppearance` 控制，已保存的访客选择不会被覆盖。

未配置云端统计时，后台工作台会显示线上统计不可用，相应接口返回 503；本地内容管理仍可使用。小说阅读器、地图底图、音乐等外部服务也需要各自的服务或网络条件。

## 素材与许可

根目录 MIT 许可适用于本项目自有代码。第三方依赖和后台模板各自遵循其上游许可证；请保留相应许可证和 `NOTICE.md`。包内占位媒体不代表你可以将自己的内容作为素材发布。动态上传、头像、封面和可切换字体功能仍需由部署者提供有使用权的素材。详情见 [NOTICE.md](NOTICE.md)。

安全问题请阅读 [SECURITY.md](SECURITY.md)。版本记录见 [CHANGELOG.md](CHANGELOG.md)。

## 开发检查

安装前后台依赖后，在根目录运行 `node --test scripts/tests/*.test.mjs`、`npx next typegen`、`npx tsc --noEmit`、`npm run lint` 和 `npm run build`；后台执行 `pnpm typecheck`、`pnpm build`。后端隔离测试使用随机测试密钥和临时 SQLite，见 `.github/workflows/ci.yml`。不使用真实数据库或重置内容来验证代码。
