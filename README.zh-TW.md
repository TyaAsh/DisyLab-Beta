<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-black.png" />
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/logo-white.png" />
    <img src="docs/assets/logo-white.png" width="520" alt="DisyLab Logo" />
  </picture>
</p>

<h1 align="center">DisyLab</h1>

<p align="center">
  <a href="README.md">简体中文</a> · 繁體中文 · <a href="README.en.md">English</a>
</p>

<p align="center">
  <strong>讓角色、參考素材、提示詞與每一次嘗試，都留在同一張會持續生長的畫布上。</strong>
</p>

<p align="center">
  為設計師、電商視覺工作者與內容創作者打造的本機優先 AI 無限畫布。
</p>

<p align="center">
  <a href="https://disylab.pages.dev">線上體驗</a> ·
  <a href="https://tyaash.github.io/DisyLab-Canvas/">專案官網</a> ·
  <a href="#快速開始">快速開始</a> ·
  <a href="#發展路線">發展路線</a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.4-77bdf2" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178c6" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646cff" />
</p>

> [!IMPORTANT]
> **DisyLab 是原始碼公開可見（source-available）的專有軟體，不是開源軟體。** 未經著作權人事先書面許可，不得商用、販售、出租、白標、再散布、再授權，或將本專案及其修改版本用於收費服務。詳見[中文授權聲明](LICENSE.zh-CN.md)與[英文授權條款](LICENSE)。

## v1.0.4 新增功能

- **工作流系統**：新增工作流範本庫、分類、搜尋、流暢動效、畫布匯入與可重用節點流程。
- **完整影片工作流**：支援文字生成影片、圖片生成影片、首尾幀、圖片參考與全能參考模式，參數會依模型能力限制。
- **影片編輯**：新增剪輯台、九宮格裁剪、當前幀／首幀／尾幀擷取、全螢幕預覽、下載與影片資產管理。
- **影片 Agent 方案**：Agent 可先提出可確認的影片方案，再建立影片節點並執行；專案風格預設也能參與支援參考圖的影片模式。
- **iOS 26 玻璃視覺**：節點、編輯器、懸浮工具列、選單與彈窗統一採用高可讀性的霧面玻璃語言，並完善圖層與 Esc 關閉行為。
- **多平台部署 relay**：Cloudflare Pages、Netlify 與 Vercel 均提供 APIYI 影片任務、輪詢與媒體回傳入口。

## 核心能力

- 無限畫布、節點連線與多畫布專案管理。
- 文字、上傳、圖片、影片與 Agent 節點。
- 圖片生成、影片生成、剪輯、裁剪與截幀。
- 工作流範本、靈感庫、資產庫與生成歷史。
- 本機優先儲存與 `.disy` 專案匯入／匯出。
- API Key 獨立保存，不寫入匯出的專案包。

## 快速開始

需要 Node.js 22.12 或更新版本。

```bash
npm install
npm run dev
```

正式建置：

```bash
npm run typecheck
npm run build
```

## 發展路線

- **3D 預演台**：在正式生成前預演鏡頭、場景、角色站位與空間關係。
- **Skill 整合**：把可重用的專業能力接入 Agent 與結構化創作工作流。
- **多語言與主題系統**：更多介面語言以及深色／淺色模式將逐步開放。
- **平台工程**：前後端分離與桌面版正在開發中。

## 授權

Copyright © 2026 Ash / Tya. All rights reserved. 詳見 [LICENSE](LICENSE)、[LICENSE.zh-CN.md](LICENSE.zh-CN.md) 與 [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)。
