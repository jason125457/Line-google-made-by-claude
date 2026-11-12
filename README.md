# 💎 個人財務視覺化儀表板 (Personal Finance Dashboard)

> 基於 **React 18 + TypeScript + Tailwind CSS + Vite** 打造的現代 Fintech 風格個人財務儀表板。  
> 支援同步連線 **Google 試算表 (LINE Bot 記帳數據)**，自帶 **Demo 示範模式**，並支援透過 **Cloudflare Pages** 免費全球 CDN 部署。

[![Deploy with Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=flat&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ 核心特色

- 💬 **用 LINE 自然語言記帳**：傳「午餐 120」「午餐 120 飲料 50」「昨天晚餐 180」即可寫入 Google 試算表。
  - 簡單的「項目 金額」由規則直接解析、秒回；含日期、分攤、運算或新品項時才交給 Gemini（3.5 / 3.1 Flash-Lite → 2.5 Flash 備援鏈）。
  - 「撤銷」刪除上一筆（先比對內容才刪）、「我的ID」查詢 userId 以設定白名單。
- ☁️ **Google 試算表同步**：前端以 `doGet?v=2` 讀取已正規化的資料（台北時區日期、數字金額）；開啟時先顯示快取、背景再同步，並顯示「最後同步：幾分鐘前」。
- 🎯 **自訂預算**：在試算表「預算設定」分頁填各類別每月預算即生效；未設定的類別以近半年平均推估「參考」值。
- 📈 **本月累計支出走勢**：每日累計 vs 上月同期 vs 預算進度，標示今天位置，並從第 5 天起延伸月底推估線。
- 📊 **月度支出趨勢**：柱狀（預設）／走勢雙視圖，進行中月份特別標示；點擊月份或類別即可連動篩選明細。
- 🧮 **4 大指標卡**：本月支出（對比上月同期）、半年均線、最高單筆、月底推估。
- 💰 **首屏「本月還可以花」**：剩餘預算、每天可花多少、預算條上標出今天應到的位置；手機另附最近 5 筆。
- 🗓️ **消費月曆與月度回顧**：每日熱圖（相對自己的日均）、最大一筆、最常記項目、連續記帳天數。
- 🙈 **隱私模式**：一鍵模糊全站金額。
- 📅 **每月花費分析分頁**：各類別堆疊柱狀圖與月份摘要卡片。
- 🎭 **Demo 示範模式**：未連線時顯示擬真範例資料，保護隱私。
- 🎨 **設計 Token**：顏色集中於 `src/theme/tokens.ts`，Tailwind 與圖表共用（暖米白底、青綠主色、深色側欄 + 金色強調）。

---

## 🏗️ 專案結構

```text
account_web/
├── gas/Code.gs                 # Google Apps Script 後端（LINE doPost + 儀表板 doGet）
├── public/
│   ├── manifest.json           # PWA 設定
│   └── sw.js                   # Network-first Service Worker
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx         # 桌機側欄導覽、同步狀態
│   │   ├── BottomNav.tsx       # 手機／平板底部導覽列
│   │   ├── CalendarPage.tsx    # 消費月曆熱圖
│   │   ├── ReviewPage.tsx      # 月度回顧
│   │   ├── TopGreetingBar.tsx  # 問候語、同步狀態、分析月份選擇
│   │   ├── MonthOverviewCard.tsx  # 首屏：本月還可以花、每天可花、預算進度
│   │   ├── MetricCards.tsx     # 4 大指標卡
│   │   ├── ExpenseCharts.tsx   # 月度趨勢 + 類別甜甜圈圖（可 Drill-down）
│   │   ├── MonthCumulativeChart.tsx # 本月累計支出走勢
│   │   ├── BudgetProgressPanel.tsx  # 類別預算進度與本月洞察
│   │   ├── TransactionList.tsx # 交易明細（搜尋、排序、分頁）
│   │   ├── MonthlyBreakdownPage.tsx # 每月花費分析頁（延遲載入）
│   │   ├── DashboardSkeleton.tsx    # 首次載入骨架畫面
│   │   └── SyncModal.tsx       # Google Apps Script 連線設定
│   ├── constants/              # 五大分類、分類圖示、導覽項目
│   ├── hooks/                  # useNow（相對時間）、useToday（跨日自動換月）
│   ├── theme/tokens.ts         # 顏色 Token（唯一來源）
│   ├── types/finance.ts        # TypeScript 資料介面
│   ├── utils/                  # GAS 連線與正規化、日期、財務計算、洞察、LocalStorage
│   │   └── __tests__/          # Vitest 回歸測試
│   ├── App.tsx                 # 狀態管理
│   └── index.css               # 全域樣式
├── tailwind.config.ts          # 由 src/theme/tokens.ts 產生語意色 class
└── vite.config.ts              # Vite 打包與測試設定
```

---

## ⚙️ 後端（Google Apps Script）設定

1. 第一次設定 clasp：到 https://script.google.com/home/usersettings 開啟 Apps Script API，執行 `npx clasp login`，再依 `.clasp.json.example`、`.gas-deploy.json.example` 建立 `.clasp.json`（專案 ID）與 `.gas-deploy.json`（網頁應用程式部署 ID）。這兩個檔案已被 gitignore。
2. 「專案設定 → 指令碼屬性」填入：`LINE_CHANNEL_ACCESS_TOKEN`、`GEMINI_API_KEY`、`API_SECRET_TOKEN`、（選填）`SPREADSHEET_ID`、`ALLOWED_USER_IDS`。
3. （選填）在編輯器執行一次 `setupBudgetSheet` 建立「預算設定」分頁。
4. 之後每次修改 `gas/Code.gs`，執行 `npm run gas:deploy -- 這次改了什麼`：自動推送程式、建立新版本並更新**同一個**部署，網址不變；LINE Webhook 與前端都連這個網址。
5. 在前端「雲端連線設定」貼上網址與 `API_SECRET_TOKEN`（每個裝置各設定一次）。

---

## 🚀 本地開發指南

### 1. 複製專案與安裝依賴
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd account_web
npm install
```

### 2. 啟動本地開發伺服器
```bash
npm run dev
```
啟動後瀏覽器打開 `http://localhost:5173` 即可即時預覽。

### 3. 編譯生產環境檔案 (Build)
```bash
npm run build
```
產出的正式靜態檔案將儲存在 `dist/` 目錄中。

### 4. 執行測試
```bash
npm test
```
涵蓋金額千分位、時區月份、日期格式、預算與累計走勢等計算。

---

## ☁️ Cloudflare Pages 自動部署設定 (CI/CD)

本專案強烈建議透過 **GitHub + Cloudflare Pages** 連動，每次你修改程式碼推送到 GitHub，網站就會在 30 秒內全自動編譯發布！

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 進入 **Workers & Pages** ➜ 點選 **Create** ➜ 切換到 **Pages**。
3. 點選 **Connect to Git（連線至 Git）**。
4. 選取你的 GitHub 倉庫。
5. 填寫建置設定（Build Settings）：
   - **Framework preset（框架預設）**：選擇 **`Vite`**
   - **Build command（建置指令）**：`npm run build`
   - **Build output directory（輸出目錄）**：`dist`
6. 點擊 **Save and Deploy（儲存並部署）** 即可！

---

## 🔒 隱私與安全性 (Security & Privacy)

1. **不在本站保存帳務**：本專案為純前端 SPA；帳務由瀏覽器向使用者指定的 Google Apps Script 讀取，Cloudflare Pages 不保存帳務內容。
2. **私密資料隔離**：本專案已在 `.gitignore` 中嚴格排除 `*.xlsx`、`*.csv` 與敏感檔案，絕不會將個人財務明細誤推至 GitHub 公開倉庫。
3. **金鑰本地化**：Google Apps Script 的 `API_SECRET_TOKEN` 與 Web App 網址僅儲存於使用者個人的手機/電腦 `localStorage` 中。

---

## 📄 授權條款

本專案採 [MIT License](LICENSE) 授權開源，歡迎自由使用與修改。
