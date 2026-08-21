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
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.5-77bdf2" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178c6" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646cff" />
</p>

> [!IMPORTANT]
> **DisyLab 是原始碼公開可見（source-available）的專有軟體，不是開源軟體。** 未經著作權人事先書面許可，不得商用、販售、出租、白標、再散布、再授權，或將本專案及其修改版本用於收費服務。詳見[中文授權聲明](LICENSE.zh-CN.md)與[英文授權條款](LICENSE)。

## v1.0.5 新增功能

- **Skill 系統**：圖片與文字節點可透過 `/` 開啟 Skill，支援即時執行、參數化設定、自訂 Skill 匯入管理與安全驗證。
- **漫畫分鏡工作流**：從內容拆解、版式選擇、構圖確認到素材生成形成可持續編輯的節點流程。
- **檔案工具箱**：新增圖片、影片與 PDF 的輕量處理入口。
- **個人中心與專案管理**：統一專案首頁、搜尋、列表／宮格、批次選取與匯入匯出。
- **互動與穩定性修復**：修復遮罩穿透、彈窗層級、小地圖拖曳與 Skill 面板可讀性問題。

## 核心能力

- 無限畫布、節點連線與多畫布專案管理。
- 文字、上傳、圖片、影片與 Agent 節點。
- 圖片生成、影片生成、剪輯、裁剪與截幀。
- 工作流範本、靈感庫、資產庫與生成歷史。
- 本機優先儲存與 `.disy` 專案匯入／匯出。
- 可在介面中自行設定需要的 API 連線。
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

- **下一小版本**：多語言以及深色／淺色模式切換。
- **D-Motion**：輕量化動效製作工作空間。
- **D-Board**：可手繪、頭腦風暴、流程圖、表格與多格式匯出（包含 PDF）的思考白板。
- 前後端分離暫不推進；桌面版在大版本之後同步推出，音訊生成將於後續逐步加入。

## 授權

Copyright © 2026 Ash / Tya. All rights reserved. 詳見 [LICENSE](LICENSE)、[LICENSE.zh-CN.md](LICENSE.zh-CN.md) 與 [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)。
