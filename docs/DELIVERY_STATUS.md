# 交付及 GitHub 狀態

日期：2026-11-08（香港時間）。

## 已完成

- 在原 repository 的完整公開原始碼上完成 2.2 增量修改；功能方面第 1–6 項的程式與配套文件已交付。
- 保留原有主要與次要功能、資料、題庫、圖示與 PWA 入口。
- 十二項自動測試通過；文件庫、長文、筆記、CSV、JSON 備份及合併、可選加練、查字與測驗切頁已作瀏覽器抽查。
- 完整更新包包括網站全部原檔及本次新增程式、測試、原版測試基準與所有改動文件。

## GitHub 上傳阻礙

使用者已明確允許自動上傳。GitHub 連線確認登入帳號為 repository 擁有人，並回傳 repository 的 admin／push 權限；但透過整合建立 Git blob 時回覆：

`403 — Resource not accessible by integration`

另查詢可管理 GitHub App installations 沒有回傳安裝項目。這表示目前整合仍無法執行所需的寫入；不能把帳號有管理權限當作整合已有寫入權限。

本次沒有成功更新 GitHub branch ref，也沒有更新公開網址。不要將本機預覽或本地 commit 當成已發佈版本。

## 繼續自動上傳所需

在 GitHub 的已安裝 GitHub Apps／ChatGPT 相關連線設定，確認 `owikdowjfodi/app` 被納入授權範圍，並確認該整合有 **Contents: read and write**。若沒有安裝項目，需完成 repository 的 GitHub App 安裝／授權；若有待接受的權限更新，需由帳號擁有人完成。

不要把私人 token 或密碼貼進對話或檔案。授權完成後可以沿用本次改動，先確認 main 最新版本，再提交並驗證 GitHub Pages 發佈。

也可由擁有人自行將更新包內容提交至原 repository；維持原 Pages 設定，並把全部新腳本一起更新。

## Google 登入所欠設定

共用 OAuth 設定支援已實作，但尚未提供真實 Web client ID；因此不能宣稱 Google 一鍵登入已完成真帳號驗證。詳見 `DEPLOYMENT_AND_ROLLBACK.md`。原手動 OAuth 與離線備份可繼續使用。
