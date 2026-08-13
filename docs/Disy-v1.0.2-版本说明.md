# DisyLab v1.0.2 版本说明

发布日期：2026-08-13

## 本次更新

- 项目版本号统一更新为 `1.0.2`（package.json、package-lock.json、vite 版权 banner、index.html 与 site/index.html 元数据、sourceShield 与 localDb 内版本标记、NOTICE / 商业授权说明 / README）。
- **API 连接管理 UI 重做**：
  - 连接级总开关（侧边栏电源按钮）：一键启用 / 停用某条连接，停用后其全部模型立即从所有选择器消失，当前选中失效时自动回退首个可用模型。
  - 软断开 vs 删除：新增「断开链接」（保留 API Key、模型列表与连接，仅从所有选择器隐藏，可一键「重新链接」恢复）与「删除连接」（`window.confirm` 二次确认）。
  - 修复断开态点「保存当前连接」会偷偷自动重连的 bug——一旦显式断开，除非点「重新链接」否则保持断开。
  - 修复详情头部图标按钮因 CSS 特异性冲突始终纵向排列的问题，现红/绿/红三个 26px 圆形 icon button 左右并排。
- **模型目录增强**：
  - 通用厂商模型补齐注册表 `VENDOR_MODEL_SUPPLEMENTS`：为 APIYI（Seedance）、即梦/火山 Ark、OpenAI（Sora）等 `/v1/models` 不枚举视频模型的厂商做本地清单兜底，GRS 走 `catalogOnly` 跳过网络请求。
  - 拉取模型后自动预勾选公认好用的文本（gemini/gpt）与图像（nano/image2）模型，并自动优选默认模型；设置弹窗 baseUrl+key 齐备且未拉过时去抖 600ms 自动拉取一次。
  - 节点编辑器模型下拉去掉厂商名，仅保留 `ID: xxx`。
- 统一 `isConnectionUsable()` 作为「连接是否可用」的唯一口径，所有模型聚合处（节点编辑器、欢迎区、Agent 抽屉）统一过滤，断连/停用厂商即时同步剔除。

## 功能与兼容性

本版本延续 v1.0.1 的数据格式与兼容性约定。详细功能边界请参阅 [v1.0.1 版本说明](Disy-v1.0.1-版本说明.md)。

## 已知限制

- 视频生成工作流（Seedance / Sora）目前仅目录可见，尚未实现真正生成（AgentPanel 标注「视频（暂未开放）」），排 Roadmap 下一版。
- 厂商补齐清单为静态数据，厂商更新模型 id 时需手动更新 `src/imageApi.ts` 的注册表。

## 授权提示

本项目不采用 MIT、Apache-2.0 等开源许可证。除 GitHub 公开仓库服务所必需的查看与 fork 权限外，所有权利均由版权所有者保留。任何商业使用、售卖、出租、白标、再分发或基于本项目提供收费服务，均须事先取得书面许可。

完整条款请参阅仓库根目录的 [中文授权声明](../LICENSE.zh-CN.md)、[英文许可证](../LICENSE)、[权利标记](../NOTICE.md)与[商业授权说明](../COMMERCIAL-LICENSE.md)。
