# 2.3 交付及 GitHub 狀態

更新時間：2026-11-08T13:43:46+00:00。

- 已上傳原 repository main，程式 commit `4c5f343698a502ea831ad016ce86a203fbbd3d2f`。
- [GitHub Pages 執行紀錄](https://github.com/owikdowjfodi/app/actions/runs/42486173445)：completed / success。
- [正式網站](https://owikdowjfodi.github.io/app/index.html) 已在瀏覽器顯示 v2.3、今日頁及全部九個原單元入口。
- 七份正式程式檔與通過測試的檔案 SHA-256 一致；index.html 與 2.2 不變。
- UI 六項及閱讀／草稿／串接／錄音庫／統計增強已加入。16 項自動測試通過。
- Google OAuth ID 仍待提供；真實 Android／麥克風／Google Drive 同步未實測，詳見 TEST_REPORT.md。
- 完整 2.3 ZIP 包含原始碼、測試、全部改動文件及完整性清單；舊 2.2 ZIP 留存。

以下為 2.2 歷史交付紀錄。

---

# 交付及 GitHub 狀態

更新時間：2026-11-08 19:32:20 HKT。

## 目前狀態：已上傳並部署

- 使用者已完成 ChatGPT Codex Connector 安裝，授權範圍選定 `owikdowjfodi/app`。
- 原先 `403 Resource not accessible by integration` 的安裝授權阻礙已解除；GitHub 寫入成功。
- 新版 2.2 已提交至原 repository 的 `main`。
- 程式 commit：`f3b390cdb88edd3f48783e9371ff9fbfd73ec00a`。
- GitHub Pages 執行紀錄：[pages build and deployment](https://github.com/owikdowjfodi/app/actions/runs/42476040436)，結果 success。
- 正式網址：<https://owikdowjfodi.github.io/app/index.html>。
- 已比較正式網站的 index.html、enhancements.js、app-config.js、sw.js、privacy-policy.html，全部與通過測試的原始檔相同。
- 已在正式瀏覽器看到 2.2 版號及新增完整文件庫，原有九個單元入口仍存在。

## 交付內容

完整 ZIP 包含網站全部原檔、新增程式、原版測試基準及所有改動文件。12 項自動測試通過；詳見 TEST_REPORT.md 及 FEATURE_PRESERVATION.md。此次上傳後另補部署記錄文件，不改變已驗證的網站程式。

## 歷史紀錄

首次交付時尚未安裝 GitHub App，帳號雖有 admin／push 權限，整合寫入仍回 403。其後使用者登入 GitHub、親自確認 Install & Authorize，完成指定 repository 安裝。此檔已更新為目前成功狀態；之前的檔案版本保留歷史。

## Google 登入仍需設定

共用 OAuth 設定支援已實作，但尚未提供有效 Google OAuth Web client ID，因此不能宣稱 Google 一鍵登入已完成真帳號驗證。GitHub 授權不會替代 Google OAuth 設定。原有手動設定及 JSON 備份仍可使用，詳見 DEPLOYMENT_AND_ROLLBACK.md。
