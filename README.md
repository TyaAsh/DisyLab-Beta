<p align="center">
  <img src="./public/disy-logo.png" width="96" alt="Disy Logo" />
</p>

<h1 align="center">Disy 无限可能</h1>

<p align="center">
  无限自由想象，世界由你创造。
</p>

<p align="center">
  面向设计师、电商视觉工作者和内容创作者的 AI 无限画布。
  在同一张画布中组织灵感、提示词、参考图和生成结果，让创作过程看得见、连得起、接得上。
</p>

<p align="center">
  <a href="https://disy-infinite.netlify.app">在线体验</a>
  ·
  <a href="#核心能力">核心能力</a>
  ·
  <a href="#快速开始">快速开始</a>
  ·
  <a href="#项目文档">项目文档</a>
  ·
  <a href="#开发沟通">开发沟通</a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.2.0-77bdf2" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178c6" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646cff" />
</p>

> 当前版本为 v0.2.0。项目、画布、资产、历史和 Agent 会话默认保存在本机浏览器中，生成能力需要使用者配置兼容的 API 连接。

## 在线体验

访问：[https://disy-infinite.netlify.app](https://disy-infinite.netlify.app)

体验版适合测试画布、节点、连线、资产库和生成工作流。首次使用 AI 生成功能前，需要在右上角 API 设置中填写自己的接口地址和 API Key。

请勿使用来源不明的共享 Key，也不要把私人 Key 写入源码、截图或公开 Issue。

## Disy 是什么

很多 AI 创作工具只留下最终结果，而灵感、参考图、提示词和生成过程散落在不同窗口里。

Disy 希望把这些内容重新放回一张可以持续生长的画布：

- 文本节点记录灵感与提示词。
- 上传节点保存参考素材。
- 图像节点承接生成任务与多个结果版本。
- 连线表达素材、提示词和结果之间的关系。
- 资产库沉淀可复用的节点与组合。
- 历史记录帮助找回生成结果和定位失败原因。

它不是一个只负责“点一下生成”的输入框，而是一间能够保留创作上下文的 AI 工作台。

## 核心能力

| 能力 | 当前实现 |
|---|---|
| 无限画布 | 画布平移、缩放、网格、小地图、框选和空白画布快捷创建。 |
| 多类型节点 | 文本、图像生成、上传图片和组合节点，可拖拽、复制、删除、打组和解组。 |
| 可视化连接 | 用连线组织提示词、参考图和生成节点，选中连接提供明确反馈。 |
| 文本与图像生成 | 支持兼容 OpenAI 风格的 `chat/completions` 与 `images/generations` 接口。 |
| 多 API 连接 | 可维护多个 API 连接、获取模型目录，并按文本、图像、视频和音频能力分类。 |
| 参考图工作流 | 通过画布连线或手动选择添加参考图，在提示词中显示可移除的引用标签。 |
| 图像结果管理 | 支持多张生成结果、结果切换、放大画廊、滚轮浏览和下载。 |
| 资产库 | 保存单节点或节点组合，支持文件夹、搜索、上传、拖回画布和批量下载/删除。 |
| 生成与输出历史 | 记录生成图片、模型、提示词、请求状态、错误详情和请求 ID。 |
| 本地优先 | IndexedDB 保存画布项目，localStorage 保存资产与历史，API Key 仅存于当前浏览器会话。 |
| 项目级创作设置 | 支持风格参考图、全局提示词后缀、画布名称和本地保存状态。 |
| 多项目与多画布 | 一个项目可创建、切换、重命名、复制和删除多个画布；项目之间的数据和生成历史相互隔离。 |
| Agent 对话工作台 | 左侧 Disy Logo 打开右侧 Agent；支持多轮对话、会话新建/切换/删除、独立选择对话模型和生图模型。 |
| Agent 参考图 | 在对话框中使用 `@` 或“从画布选择”引用已生成/上传图片，引用显示在输入框内并保持光标位置。 |
| Agent 确认生图 | Agent 先输出可编辑的图像方案，用户在对话框确认后才创建待生成节点并发起一次生图请求。 |
| 完整项目包 | 以 `.disy` 导出/导入项目、多个画布、资产、文件夹、生成历史、输出历史和 Agent 会话；导出包不包含 API Key。 |

更完整的功能边界和版本信息见 [版本功能与技术说明](docs/Disy-v0.1.0-版本功能与技术说明.md)。

## 当前版本边界

Disy v0.2.0 聚焦于浏览器端的个人创作闭环，目前尚未提供：

- 账号注册、登录和用户权限。
- 云端项目同步与多人实时协作。
- 服务端 API Key 托管和公共生成额度。
- 完整的视频、音频生成工作流。
- 可跨设备同步的资产库和 Agent 会话。

当前前端会直接请求使用者配置的模型服务，因此目标服务必须允许浏览器跨域访问。若要向大量用户提供共享生成额度，需要先增加服务端代理、身份校验、限流、费用控制和内容安全机制。

## 技术栈

| 技术 | 用途 |
|---|---|
| React 19 + TypeScript 6 | UI、组件与严格类型检查 |
| Vite 8 | 开发服务器与生产构建 |
| React Flow 12 | 无限画布、节点、连线和视图控制 |
| Zustand 5 | API 配置等共享状态 |
| Framer Motion / Motion | 弹窗、面板、画廊和状态过渡 |
| GSAP | 画布与界面序列动效 |
| Lucide React | UI 图标 |
| IndexedDB / localStorage / sessionStorage | 本地项目、资产、历史和会话密钥 |
| Netlify | Web 体验版部署 |

当前实际安装版本可查看 [版本功能与技术说明](docs/Disy-v0.1.0-版本功能与技术说明.md#3-技术栈与版本)。

## 快速开始

### 环境要求

- Node.js 22 LTS（推荐）
- npm
- 支持现代 Web API 的 Chrome 或 Edge

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

默认地址：`http://127.0.0.1:1420/`

### 检查与构建

```bash
# TypeScript 类型检查
npm run typecheck

# 生产构建
npm run build

# 本地预览生产构建
npm run preview
```

生产文件输出到 `dist/`。

## API 配置

点击界面右上角的 API 入口，新建连接并填写：

1. 连接名称。
2. API Base URL，例如 `https://your-api-endpoint.com/v1`。
3. API Key。
4. 获取模型目录并启用需要的模型。
5. 分别选择文本模型和图像模型。

公开连接信息保存在 localStorage，API Key 保存在 sessionStorage。关闭浏览器会话后可能需要重新填写 Key。

## 项目结构

```text
src/
├─ App.tsx             # 画布、节点、资产、历史和设置主界面
├─ imageApi.ts         # 模型、文本生成、图像生成与错误处理
├─ localDb.ts          # IndexedDB 项目、画布、会话与工作区存储
├─ projectPackage.ts   # .disy 项目包导入导出与校验
├─ AgentPanel.tsx      # 右侧 Agent 对话、引用和确认生图面板
├─ store.ts            # Zustand 状态与 API 配置
├─ styles.css          # 核心样式
└─ theme-custom.css    # 品牌、字体和可读性覆盖层

docs/                  # 可公开的版本与功能文档
public/                # 公共静态资源
netlify.toml           # Netlify 构建与 SPA 回退配置
```

## 项目文档

- [v0.1.0 版本功能与技术说明](docs/Disy-v0.1.0-版本功能与技术说明.md)

## Roadmap

后续版本计划加入：

- 云端项目同步、账号和多人协作。
- 节点搜索和快速定位。
- 风格化、分镜、人设图和场景设定图预设。
- Skill 添加与创作工作流扩展。
- 视频生成、首尾帧和视频资产管理。
- 桌面端应用，增强本地文件访问、离线资产管理与系统级创作体验。
- 打通 Web 端与桌面端的项目导入、导出和双向传递。
- 服务端任务、账号、云同步与分享协作。

路线图会根据真实创作体验和测试反馈持续调整。

## 部署

项目已经包含 `netlify.toml`。构建完成后可执行：

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

## 开发沟通

欢迎反馈使用体验、交互问题、模型兼容情况和创作需求。

**小红书：Disy宇宙电波**

反馈问题时，建议附上：

- 操作步骤与预期结果。
- 浏览器和系统版本。
- 问题截图或录屏。
- 使用的模型名称；请勿附带 API Key。

## License

当前仓库尚未附加开源许可证，默认不代表授权复制、再分发、白标销售或商业使用。后续如开放特定范围的使用或协作，会在仓库中提供明确的 LICENSE 文件。
