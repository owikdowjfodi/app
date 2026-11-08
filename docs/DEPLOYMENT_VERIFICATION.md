# 正式部署驗證 — 2.2

驗證時間：2026-11-08 19:32:20 HKT。

- 網址：<https://owikdowjfodi.github.io/app/index.html>
- 程式 commit：`f3b390cdb88edd3f48783e9371ff9fbfd73ec00a`
- 原始基準：`4660956332c143035deffb5a7f9b2358c484b62e`
- GitHub Pages：[執行紀錄](https://github.com/owikdowjfodi/app/actions/runs/42476040436)，completed / success。
- `main` 採預期父 commit 核對及非強制更新，沒有覆寫原有歷史。
- 瀏覽器正式頁面顯示「單字探險家 v2.2」及「完整文件庫」，亦保留原有九個單元導覽。

## 正式檔案核對

| 檔案 | SHA-256 | 與測試版一致 |
| --- | --- | --- |
| index.html | `ce7e030efdca27ccb616976427070542d9af20ce51b45ef2dd0d6b7a2e682b70` | 是 |
| enhancements.js | `6e7bbed838c7b1c85810c7b08320d9919482864ca702fc715e5fd213505b52cd` | 是 |
| app-config.js | `c460268f422213ca40ec4240a154d5d93d4f6a62f14b736c1b76d3eb2d5693b0` | 是 |
| sw.js | `4dd022eeeaf1d9107aad993df142fefdb78153e8f2055311abe565e96ed02c96` | 是 |
| privacy-policy.html | `dab6dce86c187c29bdf229f5c7df3626fe141611e6b2d23d7d420edf716b3b22` | 是 |

## 驗證界線

正式部署驗證確認程式發佈及頁面載入；不是再次操作使用者的私人學習資料。先前的 12 項測試及功能操作結果見 TEST_REPORT.md。未錄製真實麥克風、未設定 Google OAuth、未消耗私人 AI 額度，這些界線仍然適用。

若裝置仍顯示舊頁，可先重新整理／完全關閉後再開啟網站。不要以清除網站資料作為更新步驟，避免移除本機學習紀錄。
