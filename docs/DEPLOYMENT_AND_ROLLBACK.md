# 部署、設定及回復 — 2.2

## 原網站

Repository：`owikdowjfodi/app`，預設分支 `main`。原網址：<https://owikdowjfodi.github.io/app/index.html>。

保持 GitHub Pages 的既有分支與路徑設定。這是靜態網站，無需安裝依賴或編譯。`index.html`、`enhancements.js`、`app-config.js`、`sw.js`、`manifest.webmanifest`、`privacy-policy.html`、`icons/` 必須一起保留。不要只更新 index.html 而遺漏新腳本。

本次使用原分支 commit 為父節點建立新 commit，更新前核對 main 尚未有其他新修改，避免覆寫使用者同期工作。GitHub Pages 發佈需另等其既有部署流程完成；成功提交不等於已完成部署。

## Google 共用登入（唯一仍需擁有人提供的設定）

在 `app-config.js` 的 `googleClientId` 填入有效的 **OAuth Web client ID**。此值是公開識別碼，不是 client secret。

Google Cloud 專案需啟用 Drive API，完成 OAuth 同意畫面與測試／正式使用者設定，授權 JavaScript origin 為 `https://owikdowjfodi.github.io`。如在其他網域測試，需另設定對應 origin；不能填 `/app` 路徑。

未提供 ID 時程式不放入假的登入設定；現有手動 OAuth 欄位與離線備份仍可使用。**不要把 Google client secret、Google access token、AI API 金鑰提交到 GitHub。**

## 使用與資料

- 舊 reader_docs 首次成功遷入 IndexedDB 後，原 localStorage 資料保留作原始副本，之後以新版文件庫為準。
- 文件預設不加入學習備份；在單詞本勾選後，下一次 JSON 備份及 Google 同步才會包含文件。
- 完整文件庫也可獨立匯出 JSON，或匯出單份 TXT。純文件匯入與學習備份還原都先顯示合併確認。
- 本機錄音只保存在當前頁記憶體；需要留存請下載，學習備份不包含聲音。
- 自適應加練預設關閉，開啟後不取代原有七天錯題本。
- Anki TSV 每列五欄：英文、釋義、例句、筆記、標籤。匯入時建立／選擇對應欄位，最後一欄可映射至 Tags；未設定模板時可先用英文與釋義兩欄。檔案宣告 Tab 分隔且不使用 HTML。

## 回復

回復網站前先下載新版學習備份，勾選文件或另匯出整個文件庫。保留下載檔，因為舊版不認識新文件庫、筆記與自適應資料。

可用 Git 建立 revert commit 回復本次程式改動；不要強制覆寫 main 的歷史。回復時仍需增加 Service Worker 版本，以免裝置持有較新的外殼快取。回復到舊版只改程式，不應清除 localStorage／IndexedDB；重新回到新版後仍可讀取新版資料。

版本回復不能恢復已被使用者手動刪除、瀏覽器清除或原舊版截斷的資料；請使用預先保存的 JSON。
