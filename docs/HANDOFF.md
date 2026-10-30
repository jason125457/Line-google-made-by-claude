# 開發交接紀錄（2026-10-06 ～ 2026-10-30）

> 給下一個對話 / 下一位 AI Agent：先讀 `AGENTS.md`（架構與地雷），再讀本檔（目前進度、已做決定、待辦）。

## 1. 目前狀態一覽

| 項目 | 狀態 |
|---|---|
| 前端 | `main` 最新 commit 已由 Cloudflare Pages 自動上線（網站：money.shuns.site） |
| GAS 後端 | 線上「Claude最新版」部署 = **第 56 版**，內容與 `gas/Code.gs` 一致（clasp 推送） |
| LINE Webhook / 前端 | 都連「Claude最新版」同一個部署網址；改 GAS 後網址不變 |
| 測試 | `npm test` 58 個全過；`npm run build` 通過 |
| 舊部署 | 約 30 個舊部署**未封存**（使用者決定不處理，不影響運作） |

部署方式（已設定好 clasp，憑證在使用者電腦）：

```bash
npm run gas:deploy -- 這次改了什麼   # 推送 gas/ → 建立新版本 → 更新固定部署
```

## 2. 本輪已完成（依區塊）

### GAS 後端（`gas/Code.gs`）
- LINE 白名單 `ALLOWED_USER_IDS`（已設定為使用者本人）、「我的ID」、「撤銷」（比對內容才刪）
- 一則多筆、「昨天」等日期、Gemini 結構化輸出（`responseSchema`）＋容錯解析
- 規則快速解析 `parseSimpleRecords`：簡單「項目 金額」不呼叫 Gemini；`PRIORITY_PHRASES` 修正茶几、藥燉排骨等誤判
- 模型鏈 3.5-flash-lite → 3.1-flash-lite → 2.5-flash（各自 thinking 參數）
- LockService 寫入鎖、6 小時去重、API key 改放 header
- doGet v2：正規化 `records`、`budgets`（「預算設定」分頁）、`irregular`（「不固定大額支出」分頁）
- 「月度彙總」不再由程式累加（`setupMonthlySummaryFormula` 可選）；刪除失效的 `archiveOldData` 觸發條件

### 前端
- 先顯示快取、背景同步；「最後同步：幾分鐘前」（頂部與側欄一致）
- 上月同期比較、月底推估（卡片與圖表共用 `projectMonthEnd`）
- 設計 Token：`src/theme/tokens.ts` 為唯一色彩來源；類別色經 dataviz 驗證（娛樂 amber-600、雜支深紫）
- 自訂預算（試算表「預算設定」）＋未設定時的「參考」值
- 手機首屏「本月概況」、骨架載入畫面、emoji 全換 Lucide 圖示
- 本月累計支出走勢圖（vs 上月同期、預算進度、今天標記、月底推估線）
- 每月花費分析頁重做：期間切換（近 6 月／近 12 月／年度／全部）、年度摘要與年底推估、固定順序堆疊圖、類別單獨比較、固定明細列（無浮動提示框）、各類別小圖、不固定大額支出卡片（**不計入每月數字**）
- **新頁面**：消費月曆熱圖（`CalendarPage`）、月度回顧（`ReviewPage`）
- **底部導覽列**（手機／平板）取代漢堡選單；側欄與底部導覽共用 `constants/navigation.ts`
- 移除死碼、手動補登功能、papaparse；新增 Vitest 測試；補 MIT `LICENSE`

### 2026-10-30 優化盤點・第一批
- 「全部月份」時首屏顯示 NT$0 的 bug：單月元件改吃 App 的 `focusMonth`
- 月份清單一定含本月（`buildAvailableMonths`）；`useToday` 讓跨日/跨月時自動換到新月份
- KPI 卡第一張的假折線換成真實「本月 vs 上月」累計走勢；半年均線卡進行中月份改比「均線同期」（`averageToDate`）
- 隱私模式：頂部眼睛按鈕，全站金額模糊、記在這台裝置（`.privacy-mode .tabular-nums`）
- Demo 資料日期隨今天移動（`shiftDemoDates`），Demo 提示文字不再寫「左側」
- 字型：拿掉 Google Fonts 的 Noto Sans TC（136KB 阻塞 CSS），中文改系統字
- 切回前景（或重新連網）且資料超過 5 分鐘就自動同步
- GAS：`LINE_WEBHOOK_KEY` Webhook 秘密參數（`setupWebhookKey()`），未設定時不檢查

### 試算表（使用者的「記帳」）
- 「不固定大額支出」分頁新增 C 欄「日期」，7 筆暫填 **2026/1/1（預設值，待使用者改成實際日期）**
- 「預算設定」分頁已由 `setupBudgetSheet` 建立

## 3. 使用者已做的決定（不要再提議）

- 後端**維持 Google Sheets**，不遷移資料庫
- **不做**：LINE 查詢本月狀況、每週自動摘要推播、預算「排除固定支出」切換、每月花費分析的折線圖（已移除）
- 舊部署不封存
- 前端專注改善；示意圖中 B（月曆）、C（回顧）、A 的底部導覽已實作

## 4. 可以接著做的（使用者尚未決定）

設計示意圖畫布（私人連結，使用者可開）：https://claude.ai/artifact/5cgpxd4YpfKGzoDUT9xB18

優化盤點（2026-10-30）第二批，使用者已同意方向、尚未實作：

| 項目 | 備註 |
|---|---|
| 首頁主數字改「本月還可以花」＋每天可花 | 純前端（與下表 A 同一件事） |
| 預算進度條加「今天應到的位置」刻度 | 純前端 |
| 移除死碼：Sidebar 手機抽屜、`.live-beacon`、未用的 `clsx` / `tailwind-merge`、GAS v1 與月度彙總相關、`.serena/` | |
| 類別顏色統一用 `tokens.ts`（TransactionList / BudgetProgressPanel 各有一份 Tailwind 色） | |
| Recharts（588KB）延後載入；Service Worker 清舊快取；GAS doGet 加 CacheService | 效能 |
| 靜態「理財思維」金句卡換成真洞察；明細點開可跳到試算表那一列；搜尋自動跨月 | 功能 |

| 優先 | 項目 | 備註 |
|---|---|---|
| ★ | A：首頁主數字改成「本月還可以花」＋類別預算環 | 純前端 |
| ★ | A：「AI 解析・待確認」佇列 | 需 GAS 在寫入時標記「規則／Gemini」來源（新增欄位） |
| | D：支出流向圖（Sankey）＋隱藏金額分享 | 細項需要項目歸類 |
| | E：深色模式＋可自訂首頁卡片 | Token 已集中，成本低 |
| | 跨月份搜尋明細 | 純前端 |
| | LINE：記住分類習慣、「改 150／改娛樂」修正上一筆、快速回覆分類按鈕 | 改 GAS 後用 `npm run gas:deploy` |
| | GAS doGet 加 CacheService 快取（同步 2–5 秒 → 更快） | 寫入時清快取 |

## 5. 本輪踩過的坑（下次注意）

- **GAS 部署要建立新版本**：網頁編輯器「部署」若沒選「建立新版本」只會重發舊版。現在一律用 `npm run gas:deploy`，結束後看版本號有沒有 +1。
- 判斷線上跑哪一版：Apps Script「執行項目」頁每列會顯示版本號。
- LINE「Verify」按鈕對 GAS 一定顯示 302 錯誤，屬正常，實際訊息會處理。
- clasp 在 Windows：參數含空白會被拆開；`scripts/deploy-gas.mjs` 已改為直接用 Node 執行 clasp 入口，不經 shell。
- 用瀏覽器自動化在 Google 試算表打中文會被輸入法吞掉；改用編輯器內 `document.execCommand('insertText', …)`。
- repo 是**公開**的：部署 ID、scriptId 只放在被 gitignore 的 `.clasp.json`、`.gas-deploy.json`。
- 本機預覽設定 `.claude/launch.json`（dev server，port 5173）未提交，僅本機使用。

## 6. 驗證清單（改完前端時）

```bash
npm test          # 51 tests
npm run build     # tsc + vite
```

再用預覽瀏覽器看手機（375px）與桌機（1280px）寬度：無左右溢出、底部導覽只在 < lg 出現。
