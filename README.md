# 🦊 單字探險家 Word Explorer

> 用網路大數據即時拆解英文單字 —— 免安裝、免註冊、免後端，打開網頁就能用。

一個**單一 HTML 檔案**的英文單字深度學習系統：即時連網查詢釋義與字源、輸入時就自動拆解詞綴、拼錯字自動修正、習語整體辨識、每日可無限輪次測驗，以及依照遺忘曲線排程的 7 天自動複習。整個網站沒有後端，所有學習紀錄都存在**你自己的瀏覽器**裡。

📲 同時是標準 **PWA**：用 Android Chrome 打開就能「加到主畫面」變成 App；要正式上架 Google Play 也不需安裝任何開發工具鏈（詳見 [`PLAY_STORE_GUIDE.md`](PLAY_STORE_GUIDE.md)）。

🔗 **線上官網**：`https://<你的帳號>.github.io/<repo名稱>/`　←　部署完成後請把這段換成實際網址

---

## ✨ 功能

### 1️⃣ 單字深度查詢與結構拆解
- **即時連網查詢**：任何英文單字都能查，不限預設清單，當下抓取 Wiktionary 開放語料庫
- **卡片 A — 釋義**：繁體中文釋義、詞性、英文原義、美式／英式音標（IPA）
- **卡片 B — 歷史根源**：從拉丁語／希臘語演變至今的語源故事，可展開英文原文對照
- **卡片 C — 視覺化拆解**：把單字拆成前綴（青）＋詞根（薄荷綠）＋後綴（金黃），點標籤解鎖每個詞綴的含義與演變邏輯
- 🔊 **發音**：美式／英式切換，使用瀏覽器內建 Web Speech API

### 2️⃣ 拼寫自動修正（打錯字也查得到）
- 輸入的單字在標準詞庫**完全找不到**時自動啟動，容許 1～2 個字母的錯誤（打錯／漏打／多打／順序顛倒）
- 以 **Levenshtein 編輯距離**即時推算最可能的正確單字，**直接以正確單字查詢並顯示翻譯**
- 畫面同時給出溫馨提示（「✨ 為您顯示『telepathy』的翻譯…相似度約 86%」），並保留「🔍 我確定要查原字」與其他候選字按鈕，**永遠尊重使用者的最終決定**
- 修正過的錯字會建立對照快取，下次查到同一個錯字零延遲直跳正解

### 3️⃣ 習語／成語感應（整句視為一個整體）
- 內建 55 筆慣用語詞庫，**輸入含多於一個單字時第一時間比對完整輸入**
- 命中固定習語（例如 `bite the bullet`）→ **整句當成一個整體解釋**，給出整體中文意思、字面直譯、例句與由來
- **不會**拆成 bite / the / bullet 分別解釋，畫面也會明講「已把整句當成一個整體」；想個別看某個字仍可**自己點開**（絕不自動拆解）
- 不是習語時才退回一般短句翻譯流程

### 4️⃣ 進階拆字與詞綴分析（輸入時即時感應）
- 打字的**當下**就顯示拆字結果，不必按查詢
- 清楚列出構詞元件：**詞首（Prefix）**標形＋含義＋解釋（如 `un-` 表否定）、**字根（Root）**核心字源含義、**詞尾（Suffix）**字尾特徵與詞性轉變（如 `-able` 表「能夠…的」、形容詞）
- 每段都能展開看演變邏輯，並提供「舉一反三」按鈕列出同前綴／同後綴的字
- 結合本地詞綴規則庫（37 條前綴＋27 條後綴）與線上 Wiktionary 語源原文雙重佐證

### 5️⃣ 每日單字測驗（可以練很多輪）
- 每天自動抽出 5 題「4 選 1」，答對時進度條流暢滑動 20%
- **打破一天只能練一次的限制**：同一天想練幾輪就練幾輪
- **動態排除機制**：後續每一輪抽到的單字**絕對不與前幾輪重複**；今天的新字全部練完時會顯示「🏁 今天的題庫全部練完了」並可重置
- 成績頁顯示本輪分數、各輪徽章與今日累計
- 遊戲化全螢幕反饋底欄：答對薄荷綠、答錯玫瑰粉＋打氣標語
- 答錯的單字**立刻**寫入錯題本並蓋上 `Date.now()` 時間戳

### 6️⃣ 智慧錯題本與 7 天自動複習
- 錯題分兩區：「🌟 一週到期！強制複習區」與「孵化中的錯題」（附倒數計時）
- 滿 7 天自動升為 `due_for_review`，配紅色閃爍標籤
- 複習時**連續答對 1 次**才升為 `mastered` 並移出佇列；答錯則時間戳重設，重新關 7 天
- 開頁時若有到期單字，吉祥物**小狐**會跳 Toast 提醒
- 附「⏩ 時光機」測試鈕、📤 匯出 JSON 備份、🗑️ 重置

---

## 🔒 隱私

- **沒有後端、沒有資料庫、沒有帳號系統、沒有追蹤碼**
- 你的所有紀錄（錯題、時間戳、進度、查詢快取）只存在**你瀏覽器的 localStorage**
- 沒有任何資料會上傳到任何伺服器，站長也看不到你的學習紀錄
- 換裝置、換瀏覽器、或清除瀏覽器資料 → 紀錄不會跟著走。請用「📤 匯出 JSON」自行備份
- ⚠️ 注意：localStorage 以「網站網址」為界，日後若更改 repo 名稱或改用自訂網域，舊紀錄不會跟著搬家

---

## 🧠 資料從哪來

| 來源 | 用途 |
|---|---|
| [Wiktionary 開放語料 API](https://en.wiktionary.org/w/api.php) | 語源、音標、詞性、英文定義、同義詞、習語由來 |
| [Datamuse](https://api.datamuse.com/) | 詞性、英文定義、同義詞、拼字建議（備援） |
| [Google 翻譯端點](https://translate.googleapis.com/translate_a/single) | 繁體中文釋義、語源中譯、整句翻譯 |
| [MyMemory](https://api.mymemory.translated.net/) | 翻譯備援 |

全部免 API Key、免註冊，由瀏覽器**直接**呼叫，不經過任何中間伺服器 —— 所以**不會消耗任何 AI token，也不會產生費用**。

> ⚠️ **中文釋義來自機器翻譯**，準確度不如專業詞典；畫面上都附有「英文原義」可對照。

---

## 🚀 部署到 GitHub Pages

### 方法 A：用瀏覽器上傳（最快，不必安裝任何工具）

1. 登入 GitHub → 右上角 **+** → **New repository**
2. Repository name 隨意（例如 `word-explorer`），設為 **Public** → **Create repository**
   - 免費帳號的 Pages 只能從 **public** repo 發布
3. 點 **uploading an existing file** → 把下列檔案／資料夾一起拖進去 → **Commit changes**
   - `index.html`（網站本體）
   - `manifest.webmanifest`、`sw.js`（PWA 必需，App 安裝與離線開啟靠這兩個）
   - `privacy-policy.html`（上架 Google Play 必需）
   - `icons/`（**整個資料夾**，9 張 App 圖示）
   - `README.md`、`LICENSE`、`.nojekyll`
   - `.nojekyll` 是空檔案，用來請 GitHub Pages 跳過 Jekyll 處理
   - ⚠️ GitHub 的拖曳上傳**不會**帶到以小數點開頭的檔案（`.nojekyll`），請改用 **Add file → Create new file** 手動建立一個內容空白的 `.nojekyll`
4. 進入 repo 的 **Settings** → 左側 **Pages**
5. **Source** 選 `Deploy from a branch`；**Branch** 選 `main`、資料夾選 `/ (root)` → **Save**
6. 等 1～2 分鐘，網址就是：`https://<你的帳號>.github.io/<repo名稱>/`
   - PWA 安裝與 Service Worker **只在 `https://` 下生效**（`file://` 直接開不會註冊），所以請用這個網址測試

### 方法 B：命令列

```bash
git init
git add .
git commit -m "feat: 單字探險家"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo名稱>.git
git push -u origin main
```

推送後同樣到 Settings → Pages 開啟即可。

> 💡 這個 repo 是「使用者網站」還是「專案網站」都可以；`index.html` 放在根目錄就能被直接開啟。

---

## 📱 變成手機 App（PWA ／ Google Play）

這個專案已經**準備好上架 Google Play**。它同時是一個標準的 **PWA**，所以：

- **使用者不必進商店**：用 Android Chrome 打開官網，選單就會出現「**安裝應用程式**」，按下去就變成桌面 App
- **要正式上架**：走 **PWA + TWA** 路線，用 [PWABuilder](https://www.pwabuilder.com/) 產生已簽章的 `.aab`，**完全不需要安裝 Java、Android SDK 或 Android Studio**

### 已為上架做好的設定

| 檔案 | 作用 |
|---|---|
| `manifest.webmanifest` | PWA 設定：App 名稱、圖示（192/512，含 maskable）、獨立視窗模式、兩個深層連結捷徑（`#quiz`、`#srs`） |
| `sw.js` | Service Worker：離線可開啟、讓 Chrome 認定可安裝。**跨網域 API 完全不攔截**，不影響查詢 |
| `icons/` | 9 個由程式產生的 PNG（含 Play 用的 512×512 圖示與 1024×500 精選圖），零外部素材、無授權問題 |
| `privacy-policy.html` | Play 強制要求的隱私權政策頁 |
| `weConfirm()` | 自製 App 內彈窗，取代 `window.confirm()`——它在 Android WebView 中會靜默失效 |
| `applyHashRoute()` | 支援 `#quiz` / `#srs` / `#lexicon` 深層連結，App 捷徑才能直達分頁 |

### 完整上架流程

| 文件 | 內容 |
|---|---|
| **[`PLAY_STORE_GUIDE.md`](PLAY_STORE_GUIDE.md)** | 從 GitHub Pages → PWABuilder → Play Console → 12 位測試者 14 天 → 正式發布的**逐步教學**，含常見問題排解 |
| **[`STORE_LISTING.md`](STORE_LISTING.md)** | 可直接複製貼上的商店文案：App 名稱、簡短說明、完整說明、版本說明、截圖指引 |

### 🎨 品牌識別（100% 原創）

所有視覺元素都是為本專案原創設計的，**沒有使用任何第三方的商標、外觀、圖庫或字型素材**：

| 元素 | 內容 |
|---|---|
| 主色「**探險紫**」 | `#6C4BF6`（立體底邊 `#4F32C4`、漸層亮端 `#9B85FF`） |
| 次要色「**嚮導青**」 | `#00B4A6`（深色 `#00907F`） |
| 吉祥物「**小狐**」 | 🦊 由 `tools/make-icons.js` 以幾何圖形從零繪製（圓形／圓角矩形／多邊形 + 超取樣反鋸齒），不是 emoji 圖庫也不是向量素材 |
| 名稱 | 單字探險家 Word Explorer |
| 介面風格 | 圓角立體粗底邊框（按下會下沉）＋全螢幕反饋底欄，屬通用遊戲化設計手法 |

要換色只需動三處：`index.html` 的 `:root` 變數（`:70`～`:80`，主色在 `:71`）、`manifest.webmanifest` 的 `theme_color`、`privacy-policy.html` 的 `:root`；改完執行 `node tools/make-icons.js` 重繪全部圖示。

### 上架前必讀的兩個風險

1. **Google 翻譯非官方端點**：`translate.googleapis.com` 未公開文件化，公開發布可能違反其服務條款。建議改以 MyMemory 官方 API 為主
2. **14 天硬性等待**：2023-11-13 之後註冊的**個人**開發者帳號，必須先跑「12 位測試者連續 14 天」的封閉測試。整體上架時程約 **4～6 週**

### 重新產生圖示

圖示是用純 Node 程式從零畫出來的（零套件相依）：

```bash
node tools/make-icons.js
```

改色或改造型後執行這行，`icons/` 會全部重繪。

---

## 🛠 本機使用

直接雙擊 `index.html` 就能用，不需要伺服器。若想模擬線上環境：

```bash
npx serve .
# 或
python -m http.server 8000
```

---

## ⚙️ 常用設定

行號對應目前的 `index.html`（版本 1.3）。

| 我想改… | 去哪改（`index.html`） |
|---|---|
| 把 7 天複習改成 **10 秒**方便測試 | `REVIEW_INTERVAL_MS`（:524），測試版寫在下方註解（:527） |
| 每日測驗每輪題數（預設 5 題） | `DAILY_QUIZ_SIZE`（:530） |
| 每輪最多連網抓幾個字的釋義 | `QUIZ_POOL_FETCH`（:565） |
| 題庫池單字清單（192 個） | `WORD_POOL`（:588） |
| 習語／慣用語詞庫（55 筆） | `IDIOMS`（:2411） |
| 詞綴規則庫 | `PREFIX_RULES`（:839）、`SUFFIX_RULES`（:879） |
| 拼錯時容許幾個字母的錯誤 | `spellTolerance()`（:2302） |
| 即時拆字的防抖延遲（預設 320ms） | `LIVE_ANALYSIS_DELAY_MS`（:569） |
| 最近查詢紀錄保留筆數（預設 12） | `HISTORY_MAX_ITEMS`（:568） |
| 習語／句子輸入長度上限（預設 200 字） | `PHRASE_MAX_CHARS`（:570） |
| 查詢快取有效期（預設 30 天） | `DICT_CACHE_TTL_MS`（:563） |
| **品牌色票**（主色／次要色／答對答錯色） | `index.html` 的 `:root` CSS 變數（`:70`～`:80`）；Tailwind 用的是同一組（`:42`～`:56`） |
| App 名稱／圖示設定 | `manifest.webmanifest`（名稱、圖示、主題色） |
| 離線快取版本（改了網頁就要 +1） | `sw.js` 的 `VERSION` |
| 上架用的隱私政策內容 | `privacy-policy.html`（記得換掉範例信箱） |
| App 圖示的顏色與造型 | `tools/make-icons.js`，改完執行 `node tools/make-icons.js` |

---

## ⚠️ 已知限制

- **需要網路**：離線時會降級到內建的離線備用語料（12 個字）並在畫面明確告示，不會假裝有資料
- **免費服務有額度**：這些公開 API 有依 IP 的合理使用限制。程式已用 30 天快取大幅降低請求量，並在多來源之間自動接力；若被限流只會暫時查不到，不會產生任何費用
- **翻譯品質**：機器翻譯，僅供理解參考
- **Tailwind 使用 Play CDN**：方便單檔攜帶，但官方不建議用於正式產品。若流量變大，建議改成預先編譯的 CSS

---

## 📝 更新紀錄

### v1.3
- 🎨 **全面去品牌化**：主色改為原創「探險紫 `#6C4BF6`」、次要色「嚮導青 `#00B4A6`」，全部色票重新設計
- 🦊 吉祥物改為原創角色**小狐**（9 張 App 圖示與 Play 精選圖全部重繪）
- 🔧 CSS 變數與類別由 `duo-*` 改名為 `we-*`，Tailwind 色票命名空間同步改為 `we`
- 📝 `manifest.webmanifest`、`privacy-policy.html` 的色票與吉祥物同步更新

### v1.2
- ✨ **可安裝為手機 App**：新增 `manifest.webmanifest`、`sw.js`（Service Worker）、9 個 PNG 圖示
- ✨ 新增**隱私權政策頁**（`privacy-policy.html`），符合 Google Play 上架要求
- ✨ 新增**深層連結**：`#quiz` / `#srs` / `#lexicon`，App 捷徑可直達分頁
- 🐛 修正 `window.confirm()` 在 Android WebView 中會**靜默回傳 false** 導致 5 個按鈕失效的問題，改用自製彈窗 `weConfirm()`
- 📝 新增 `PLAY_STORE_GUIDE.md`（上架完整指南）與 `STORE_LISTING.md`（商店文案）

### v1.1
- ✨ 新增**拼寫自動修正**（Levenshtein 編輯距離，容許 1～2 個字母錯誤）
- ✨ 新增**習語／成語感應**（55 筆詞庫，整句視為一個整體，不拆字）
- ✨ 新增**輸入時即時拆字**（320ms 防抖，詞首／字根／詞尾三段含義）
- ✨ 每日測驗升級為**多輪次**，並以動態排除機制保證各輪不重複出題
- 🐛 修正使用者按下「我確定要查原字」後仍被自動導向正字的問題

### v1.0
- 首個公開版本：連網查詢、結構拆解、每日測驗、7 天自動複習

---

## 📄 授權

MIT License，詳見 [LICENSE](LICENSE)。歡迎自由使用、修改、再散布。

## 🙏 致謝

- 資料來源：[Wiktionary](https://www.wiktionary.org/)（CC BY-SA）、[Datamuse](https://www.datamuse.com/api/)、[MyMemory](https://mymemory.translated.net/)
- App 圖示、吉祥物「小狐」與整套配色均為本專案**原創設計**，未使用任何第三方商標或素材
