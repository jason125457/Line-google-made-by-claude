@AGENTS.md

## Claude Code 補充

- 共用規則（架構、地雷 1～6、設計規範）在 AGENTS.md；目前進度、已做決定與待辦在 `docs/HANDOFF.md`，接手先讀。本檔只放 Claude 特有事項。
- 改完一定跑 `npm test` 與 `npm run build`（含 `tsc`）。畫面改動要在手機寬度與桌機寬度各看一次，並開隱私模式確認新金額有被模糊。
- 推到 `main` 就會由 Cloudflare Pages 自動上線到正式站。未經使用者同意不推 `main`，在分支上做完交給使用者確認。
- `npm run gas:deploy` 需要使用者電腦上的 clasp 登入，而且會更新 LINE 機器人連的線上部署：由使用者執行，或逐次取得同意。改了 `gas/Code.gs` 但還沒部署時，在 `docs/HANDOFF.md` 註明。
- 這個 repo 是公開的：GAS 網址、部署 ID、scriptId、Token、LINE userId、真實帳目都不能出現在程式、文件、測試或 commit 訊息裡。範例資料只用 `demoData.ts` 那種擬真假資料。
- commit：英文 Conventional Commits（`feat:`、`fix:`、`chore:`、`docs:`），通常不加 scope。
- 新增或改動會踩雷的行為時，把規則補進 AGENTS.md 對應的地雷或設計規範，不要寫在這裡。
