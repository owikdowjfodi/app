/* 公開部署設定；此檔不能放 API 金鑰、client secret 或 access token。
 * 網站擁有人只需填一次 OAuth Web client ID，訪客即可按 Google 登入。
 * 在 Google Cloud Console 啟用 Drive API、設定同意畫面及授權 origin。
 * 未設定時仍保留原有手動 OAuth 設定與離線 JSON 備份。
 */
window.WORD_EXPLORER_CONFIG = Object.assign({
  googleClientId: ''
}, window.WORD_EXPLORER_CONFIG || {});
