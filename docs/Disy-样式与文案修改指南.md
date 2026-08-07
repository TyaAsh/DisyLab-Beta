# Disy 样式与文案修改指南

这份文档面向只修改界面、不修改功能逻辑的协作者。你可以安全地调整颜色、字体、字号、圆角、间距和大部分固定文案；涉及数据、生成流程、节点行为、API、下载、存储和复杂交互时，建议交给 Codex 修改。

## 1. 最常用的三个文件

| 文件 | 用途 | 建议 |
|---|---|---|
| `src/theme-custom.css` | 品牌色、字体、字号、圆角等覆盖样式 | 优先修改，风险最低 |
| `src/App.tsx` | 页面和弹窗中的大部分中文文案 | 只修改标签之间的文字，不改 JSX 结构 |
| `src/styles.css` | 全部组件的基础样式和布局 | 需要深度调整时修改，先搜索类名 |

`src/theme-custom.css` 在 `src/styles.css` 之后加载，所以相同选择器会以自定义文件为准。这样升级功能时，更容易保留你的视觉修改。

当前界面已经在该文件中设置统一可读性基线：普通文字不小于 12px，标题不超过 16px。若增加新组件，也应继续遵守这个范围。

## 2. 修改字体

### 2.1 直接使用现有字体

打开 `src/theme-custom.css`，修改：

```css
:root {
  --disy-font-family: 'Manrope', 'DM Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
```

字体按从左到右的顺序查找。用户电脑没有第一种字体时，会自动使用下一种。

### 2.2 使用在线字体

项目当前在 `src/styles.css` 第一行通过 Google Fonts 加载 `DM Sans` 和 `Manrope`。要更换在线字体，可以修改该 `@import`，并同步修改 `--disy-font-family`。

注意：部分网络环境可能无法稳定访问 Google Fonts。正式上线更推荐把获得合法授权的字体文件放到 `public/fonts/`。

### 2.3 使用本地字体

把 `.woff2` 文件放到 `public/fonts/`，然后在 `src/theme-custom.css` 中加入：

```css
@font-face {
  font-family: 'MyBrandFont';
  src: url('/fonts/my-brand-font.woff2') format('woff2');
  font-display: swap;
}

:root {
  --disy-font-family: 'MyBrandFont', 'PingFang SC', sans-serif;
}
```

发布字体前请确认网页嵌入和商业使用授权。

## 3. 修改颜色

全局颜色集中在 `src/theme-custom.css` 的 `:root`：

```css
:root {
  --accent: #ff694b;       /* 主按钮、选中状态 */
  --accent-soft: rgba(255, 105, 75, .14);
  --canvas: #070908;       /* 画布背景 */
  --surface: rgba(29, 31, 30, .88); /* 浮层 */
  --surface-strong: #1c1f1d;        /* 实体面板 */
  --ink: #f3f4f0;         /* 主文字 */
  --muted: #989d97;       /* 次要文字 */
  --line: rgba(245, 247, 242, .105); /* 边框 */
  --canvas-dot: rgba(227, 232, 224, .17); /* 画布网点 */
}
```

修改颜色后至少检查：主按钮、输入框、选中节点、错误提示、深色图片上的文字可读性。

## 4. 修改文案

当前首页空画布文案位于 `src/App.tsx` 的 `empty-canvas-state` 区域：

```tsx
<span>无限自由想象，世界由你创造</span>
```

同一区域还包含：

- `双击`
- `文本提示词`
- `图像生成`
- `上传参考图`

其他常见文案位置：

| 文案类型 | 文件 |
|---|---|
| 页面按钮、弹窗标题、空状态、提示信息 | `src/App.tsx` |
| API 请求错误说明 | `src/imageApi.ts` |
| API 模型类型和连接相关文字 | `src/store.ts`、`src/App.tsx` |
| 浏览器标签标题 | `index.html` |
| 项目介绍 | `README.md` 和 `docs/` |

查找一段文字最快的方法：

```powershell
rg -n "要查找的文字" src
```

修改 JSX 文案时，只替换 `>` 和 `<` 之间的文字，保留标签、花括号、引号、事件和属性。例如：

```tsx
<button onClick={someAction}>旧文字</button>
```

可以改成：

```tsx
<button onClick={someAction}>新文字</button>
```

不要删除 `onClick={someAction}`。

## 5. 常用界面选择器

| 目标 | CSS 选择器 |
|---|---|
| 空画布主文案 | `.empty-canvas-heading` |
| 空画布快捷按钮 | `.empty-canvas-actions button` |
| 顶部悬浮工具栏 | `.floating-chrome` |
| 节点卡片 | `.disy-node` |
| 多选操作栏 | `.selection-action-toolbar` |
| 资产库/生成历史弹窗 | `.asset-library-modal` |
| 资产缩略图 | `.asset-library-thumbnail` |
| 图片画廊 | `.library-gallery-backdrop` |
| 项目弹窗 | `.project-modal` |
| API 设置弹窗 | `.api-modal` |
| 通知提示 | `.canvas-toast` |

建议把覆盖规则写在 `src/theme-custom.css`，例如：

```css
.empty-canvas-heading {
  font-size: 16px !important;
  font-weight: 650;
  letter-spacing: .04em;
}

.asset-library-modal {
  border-radius: 26px;
}
```

字号基线为了防止旧组件回落到 7–11px，使用了 `!important`。如果自行覆盖字号，也需要加 `!important`，并保持在 12–16px 范围内；颜色、圆角、间距等其他属性不需要。

## 6. 哪些修改应交给 Codex

以下内容看起来可能只是“界面修改”，但实际会影响功能：

- 移动或删除 React 组件标签。
- 修改 `onClick`、`onChange`、`onDrop`、`onWheel` 等事件。
- 修改 `useState`、`useEffect`、数据类型和本地存储键。
- 修改节点创建、连线、生成、下载、删除、资产恢复逻辑。
- 修改 API 请求地址拼接、请求参数和密钥存储。
- 新增页面路由、登录、云同步或多人协作。

你可以先在截图上标注想要的效果，再让 Codex 实现功能层。

## 7. 修改后的检查方法

```bash
npm run typecheck
npm run build
npm run dev
```

然后至少检查：

1. 空画布、节点、编辑器和弹窗文字没有溢出。
2. 资产库、生成历史、图片画廊可以正常打开和关闭。
3. 深色背景上文字和按钮仍清楚可见。
4. 浏览器缩窄后工具栏没有遮挡关键按钮。
