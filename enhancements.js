/* 單字探險家 v2.2 — 增量功能。原有九個單元及資料鍵保留。
 * 文件：IndexedDB 完整版本庫；無 IndexedDB 時明確提示並退回原有儲存。
 * 備份：沿用 schema 1，新增 schema-independent extra keys，舊檔仍可匯入。
 */
(function (root) {
  'use strict';
  function textHash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  }
  function validDocs(list) {
    return (Array.isArray(list) ? list : []).filter(d => d && typeof d.id === 'string' && typeof d.text === 'string').map(d => ({
      id: d.id, versionBaseId: String(d.versionBaseId || d.id.replace(/-v-[a-z0-9]+(?:-\d+)?$/, '')), name: String(d.name || '未命名文件'), text: d.text,
      at: Number(d.at) || 0, chars: d.text.length, originalName: String(d.originalName || d.name || '未命名文件'),
      rawText: typeof d.rawText === 'string' ? d.rawText : d.text
    }));
  }
  function mergeDocs(a, b) {
    const groups = new Map();
    validDocs(a).concat(validDocs(b)).forEach(d => {
      const base = d.versionBaseId || d.id.replace(/-v-[a-z0-9]+(?:-\d+)?$/, '');
      if (!groups.has(base)) groups.set(base, new Map());
      const versions = groups.get(base), old = versions.get(d.text);
      if (!old || d.at >= old.at) versions.set(d.text, Object.assign({}, d, { versionBaseId: base }));
    });
    const out = [];
    groups.forEach((versions, base) => {
      // 兩端以相同次序指定版本 ID；反向／重複同步不會增生重複版本。
      Array.from(versions.values()).sort((x, y) => textHash(x.text).localeCompare(textHash(y.text)) || x.text.localeCompare(y.text)).forEach((d, i) => {
        d.id = i === 0 ? base : base + '-v-' + textHash(d.text);
        out.push(d);
      });
    });
    return out.sort((x, y) => y.at - x.at || x.id.localeCompare(y.id));
  }

  function mergeTimedMaps(a, b) {
    const out = {};
    [a, b].forEach(src => {
      if (!src || typeof src !== 'object' || Array.isArray(src)) return;
      Object.keys(src).forEach(k => {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
        const v = src[k];
        if (v && typeof v === 'object' && (!out[k] || Number(v.updatedAt || 0) >= Number(out[k].updatedAt || 0))) out[k] = v;
      });
    });
    return out;
  }
  function nextReview(previous, remembered, now) {
    const p = previous || {};
    const stage = remembered ? Math.min((Number(p.stage) || 0) + 1, 4) : 0;
    const days = [1, 3, 7, 14, 30][stage];
    return { stage, dueAt: now + days * 86400000, updatedAt: now,
      attempts: (Number(p.attempts) || 0) + 1, right: (Number(p.right) || 0) + (remembered ? 1 : 0) };
  }
  function mergeDaily(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a.date !== b.date) return String(a.date) > String(b.date) ? a : b;
    const sessions = new Map();
    [a, b].forEach(day => (day.sessions || []).forEach(s => {
      const id = String(s.createdAt || s.id) + '|' + (s.questions || []).map(q => q.word).join(',');
      const old = sessions.get(id);
      if (!old || (s.answers || []).filter(x => x != null).length >= (old.answers || []).filter(x => x != null).length) sessions.set(id, s);
    }));
    return Object.assign({}, a, { sessions: Array.from(sessions.values()).map((s, i) => Object.assign({}, s, { id: i + 1 })),
      usedWords: Array.from(new Set([].concat(a.usedWords || [], b.usedWords || []))) });
  }
  function csvCell(value) {
    let s = String(value == null ? '' : value);
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  const api = { textHash, validDocs, mergeDocs, mergeTimedMaps, nextReview, mergeDaily, csvCell };
  root.WEUpgrade = api;
  if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = api; return; }

  const META = 'we_word_notes_v1', ADAPTIVE = 'we_adaptive_v1', PREFS = 'we_upgrade_prefs_v1';
  const prefs = () => lsGet(PREFS, {});
  const setPrefs = patch => lsSet(PREFS, Object.assign({}, prefs(), patch));
  const noteMap = () => lsGet(META, {});
  let docs = validDocs(lsGet(LS_READER, [])), database = null, storageFailure = '';
  let pendingWrites = Promise.resolve(), openingDocument = false, tagFilter = '', currentReview = null;
  let documentReadyResolve;
  const documentReady = new Promise(resolve => { documentReadyResolve = resolve; });
  const original = {
    readerGetDocs, readerSaveDocs, readerOpenSaved, readerCloseDoc, readerRender,
    gsSnapshot, gsMergeAll, gsApply, gsClientId, gsyncBoot, gsyncExportFile,
    gsUploadRemote, gsSnapCounts, gsyncCardHtml, renderWordbook, wbFiltered,
    renderSRS, addWrongWord, spRenderHome, spStage, spAiFeedbackHtml, gsSet
  };

  function warn(message) { showToast(esc(message), 'warn', 7000); }
  function saveFile(name, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function transaction(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, mode);
      let result;
      try { result = callback(tx.objectStore(storeName)); } catch (err) { reject(err); return; }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('儲存交易失敗'));
      tx.onabort = () => reject(tx.error || new Error('儲存交易中止'));
    });
  }
  function persistDocs(list, options) {
    const next = validDocs(list);
    const ids = new Set(next.map(d => d.id));
    const deleted = new Set(docs.filter(d => !ids.has(d.id)).map(d => d.id));
    docs = next;
    const copy = docs.slice();
    pendingWrites = pendingWrites.catch(() => {}).then(async () => {
      await documentReady;
      if (!database) {
        // 不截斷、不裁切；若本機空間不足就保留記憶體並提示立即下載。
        const applying = gsApplying;
        if (options && options.fromSync) gsApplying = true;
        let saved;
        try { saved = lsSet(LS_READER, copy); } finally { gsApplying = applying; }
        if (!saved) throw new Error('本機容量不足，請立即匯出文件庫；本頁開啟期間原文仍保留');
      } else {
        await transaction('documents', 'readwrite', store => {
          const request = store.getAll();
          request.onsuccess = () => {
            const merged = mergeDocs(request.result.filter(d => !deleted.has(d.id)), copy);
            store.clear(); merged.forEach(d => store.put(d));
          };
        });
      }
      storageFailure = '';
      return true;
    }).catch(err => { storageFailure = err.message; warn('文件未能永久儲存：' + err.message); return false; });
    if (!(options && options.fromSync) && prefs().includeDocuments) gsyncOnWrite(LS_READER);
    return pendingWrites;
  }
  async function bootDocuments() {
    try {
      if (!root.indexedDB) throw new Error('此瀏覽器未提供 IndexedDB，改用原有本機儲存');
      database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('word-explorer-library', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('documents')) request.result.createObjectStore('documents', { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('文件庫被其他分頁阻擋，請關閉舊分頁後重試'));
      });
      const stored = await new Promise((resolve, reject) => {
        const req = database.transaction('documents').objectStore('documents').getAll();
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      });
      docs = mergeDocs(stored, lsGet('we_documents_migrated_v1', false) ? [] : docs);
      // 舊 reader_docs 不刪除，作為首次遷移的原始備份。
      await transaction('documents', 'readwrite', store => docs.forEach(d => store.put(d)));
      lsSet('we_documents_migrated_v1', true);
    } catch (err) { storageFailure = err.message || '文件庫無法開啟'; database = null; }
    documentReadyResolve();
  }

  readerGetDocs = () => docs.slice();
  readerSaveDocs = list => persistDocs(list);
  readerOpenText = async function (name, text) {
    if (openingDocument) { warn('上一份文件仍在儲存，請稍等'); return; }
    openingDocument = true;
    try {
      await documentReady;
      const clean = readerCleanText(text);
      if (!clean) { warn('讀不到文字；掃描 PDF 需要先經 OCR 或貼上文字。'); return; }
      let preview = false;
      if (clean.length > READER_MAX_CHARS) {
        const full = await weConfirm('這份文件有 ' + clean.length.toLocaleString() + ' 個字元。完整原文會保存為新版本。\n\n完整閱讀可能較慢；可選擇只顯示前 80,000 個字元，並隨時匯出完整原文。', {
          emoji: '📄', okText: '完整閱讀並保存', cancelText: '保存原文，只預覽前段'
        });
        preview = !full;
      }
      const id = readerNewId(), at = Date.now(), originalName = String(name || '未命名文件');
      // 同名不同內容保留為新版本；不再按檔名覆寫。
      const version = docs.filter(x => x.originalName === originalName).length + 1;
      const d = { id, name: originalName + (version > 1 ? ' · 版本 ' + version : ''), originalName, text: clean, rawText: String(text), at, chars: clean.length };
      const saved = await persistDocs([d].concat(docs));
      readerOpenSaved(id);
      if (preview) {
        readerState.text = clean.slice(0, READER_MAX_CHARS);
        readerState.paras = readerState.text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
        const result = readerAnalyze(readerState.text);
        readerState.words = result.words; readerState.hard = result.hard;
        readerState.scoreMap = new Map(result.words.map(e => [e.word, e.score]));
        readerRender();
      }
      if (saved) showToast('完整原文已保存為新版本（文件庫共 ' + docs.length + ' 份）', 'info');
    } finally { openingDocument = false; }
  };
  readerOpenSaved = function (id) {
    original.readerOpenSaved(id);
    readerState.busy = ''; readerState.note = '';
    if (state.activeTab === 'reader') readerRender();
  };
  readerCloseDoc = function () { original.readerCloseDoc(); };

  // 所有原有同步類別保留，另外加入筆記、自適應進度與當日作答。
  [META, ADAPTIVE, LS_KEYS.DAILY || 'daily_quiz_record', LS_READER].forEach(k => {
    if (!GSYNC_KEYS.includes(k)) GSYNC_KEYS.push(k);
    GSYNC_KEYSET[k] = true;
  });
  gsSnapshot = function () {
    const payload = original.gsSnapshot();
    if (prefs().includeDocuments) payload.data[LS_READER] = docs.slice();
    else delete payload.data[LS_READER];
    payload.features = { version: '2.2', documentsIncluded: !!prefs().includeDocuments };
    return payload;
  };
  gsMergeAll = function (a, b) {
    const out = original.gsMergeAll(a, b), A = a || {}, B = b || {};
    [META, ADAPTIVE].forEach(k => { if (A[k] || B[k]) out[k] = mergeTimedMaps(A[k], B[k]); });
    const dailyKey = LS_KEYS.DAILY || 'daily_quiz_record';
    if (A[dailyKey] || B[dailyKey]) out[dailyKey] = mergeDaily(migrateDailyRecord(A[dailyKey]), migrateDailyRecord(B[dailyKey]));
    if (A[LS_READER] || B[LS_READER]) out[LS_READER] = mergeDocs(A[LS_READER], B[LS_READER]);
    return out;
  };
  gsApply = function (data) {
    if (!data || typeof data !== 'object') return 0;
    const plain = Object.assign({}, data); delete plain[LS_READER];
    const count = original.gsApply(plain);
    if (data[LS_READER]) persistDocs(mergeDocs(docs, data[LS_READER]), { fromSync: true });
    const daily = data[LS_KEYS.DAILY || 'daily_quiz_record'];
    if (daily && daily.date === todayKey()) state.daily = daily;
    return count + (data[LS_READER] ? 1 : 0);
  };
  gsClientId = function () {
    const configured = String((root.WORD_EXPLORER_CONFIG || {}).googleClientId || '').trim();
    return original.gsClientId() || (/^[0-9A-Za-z._-]+\.apps\.googleusercontent\.com$/.test(configured) ? configured : '');
  };
  gsyncBoot = function () { documentReady.then(() => original.gsyncBoot()); };
  gsUploadRemote = async function (payload) {
    // 關閉文件備份時，保留雲端原有文件，避免單次設定造成遠端內容消失。
    if (!prefs().includeDocuments) {
      const found = await gsFindRemoteFile();
      if (found) {
        const remote = await gsDownloadRemote(found.id);
        if (remote && remote.data && remote.data[LS_READER]) {
          payload = Object.assign({}, payload, { data: Object.assign({}, payload.data, { [LS_READER]: remote.data[LS_READER] }) });
        }
      }
    }
    return original.gsUploadRemote(payload);
  };
  let lastExportAt = Number(prefs().lastExportAt || 0);
  gsyncExportFile = async function () {
    await documentReady; await pendingWrites;
    original.gsyncExportFile(); lastExportAt = Date.now(); setPrefs({ lastExportAt });
    if (state.activeTab === 'wordbook') renderWordbook();
  };
  gsyncImportFile = async function (file) {
    if (!file) return;
    try {
      await documentReady;
      const parsed = JSON.parse(await file.text());
      const data = parsed && parsed.data ? parsed.data : parsed;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('不是有效的備份物件');
      const known = GSYNC_KEYS.filter(k => Object.prototype.hasOwnProperty.call(data, k));
      if (!known.length) throw new Error('找不到可識別的學習資料');
      if (Object.prototype.hasOwnProperty.call(data, LS_READER) && !Array.isArray(data[LS_READER])) throw new Error('文件資料格式錯誤');
      const incomingDocs = validDocs(data[LS_READER]);
      const books = Array.isArray(data[LS_WORDBOOK]) ? data[LS_WORDBOOK].length : 0;
      const ok = await weConfirm('還原預覽：\n單詞 ' + books + ' 個；文件版本 ' + incomingDocs.length + ' 份；資料類別 ' + known.length + ' 種。\n\n將與現有資料合併，不會清空現有紀錄。同名文件保留不同版本。', { emoji: '📤', okText: '確認合併', cancelText: '取消還原' });
      if (!ok) return;
      const local = gsSnapshot().data; local[LS_READER] = docs.slice();
      gsApply(gsMergeAll(local, data)); await pendingWrites;
      showToast(storageFailure ? '學習資料已合併；文件未能儲存，請立即匯出。' : '備份已合併，現有資料保留。', storageFailure ? 'warn' : 'info');
      renderWordbook();
    } catch (err) { warn('無法還原：' + err.message); }
  };

  function bytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB'; }
  function time(value) { return value ? new Date(value).toLocaleString('zh-Hant') : '尚未有成功紀錄'; }
  function card(title, body) { return '<section class="we-card we-upgrade-card"><h3>' + title + '</h3>' + body + '</section>'; }
  function button(label, action, extra) { return '<button type="button" class="we-btn we-btn-ghost we-btn-sm" data-upgrade="' + action + '" ' + (extra || '') + '>' + label + '</button>'; }
  function dataNotice() {
    return '<p class="upgrade-note">文件解析及筆記預設在本機。翻譯會把選取文字送到翻譯服務；AI 會把題目、答案或選取上下文送到目前 AI 供應商。語音辨識可能由瀏覽器供應商連線處理。<a href="privacy-policy.html">資料使用說明</a></p>';
  }
  gsyncCardHtml = function () {
    const base = original.gsyncCardHtml(), s = gsGet();
    const extra = card('🛡️ 備份範圍與保存狀態',
      '<p>學習備份：單詞本、錯題、查詢、統計、字根進度、想法、口說文字紀錄、單字歷史、常錯字、筆記標籤、自適應複習及當日測驗。</p>' +
      '<label class="upgrade-check"><input type="checkbox" id="up-backup-docs" ' + (prefs().includeDocuments ? 'checked' : '') + '> 把完整閱讀文件加入 JSON 備份及 Google 同步（可能較大）</label>' +
      '<p>文件：' + docs.length + ' 個版本；儲存方式：' + (database ? 'IndexedDB 完整文件庫' : '本機儲存備援') + '。</p>' +
      '<p id="up-storage">正在估算此網站儲存用量…</p>' +
      '<p>最近成功同步：' + esc(time(s.lastSyncAt)) + '<br>最近產生備份下載：' + esc(time(lastExportAt)) + '（完成下載請在瀏覽器確認）</p>' +
      '<p>不包含 API 金鑰、暫存錄音及可重新產生的查字快取。本機快照另沿用原有六類範圍。</p>' +
      (storageFailure ? '<p role="alert">⚠️ ' + esc(storageFailure) + '</p>' : '') +
      (gsClientId() ? '<p>✅ Google 登入設定已就緒，可使用上方登入按鈕。</p>' : '<p>Google 登入尚未設定；可先用離線備份，或使用原有手動設定。</p>') + dataNotice());
    return base + extra;
  };
  function updateStorage() {
    const el = document.getElementById('up-storage');
    if (!el) return;
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(x => {
        if (el.isConnected) el.textContent = '此網站儲存用量：約 ' + bytes(x.usage || 0) + '／瀏覽器配額 ' + bytes(x.quota || 0) + '（含快取）。';
      }).catch(() => { el.textContent = '瀏覽器未能提供容量估算；建議定期下載備份。'; });
    } else el.textContent = '此瀏覽器未提供容量估算；建議定期下載備份。';
  }
  function readerTools() {
    const target = document.getElementById('reader-body');
    if (!target || target.querySelector('#up-reader-tools')) return;
    const section = document.createElement('div'); section.id = 'up-reader-tools';
    const selected = docs.find(d => d.id === readerState.docId);
    section.innerHTML = card('📚 完整文件庫 · ' + docs.length + ' 個版本',
      '<p>同名文件保留新版本；不再自動裁切為四份。' + (selected && readerState.text.length < selected.text.length ? '目前只預覽前段，完整原文仍在文件庫。' : '') + '</p>' +
      '<div class="upgrade-actions">' + button('📥 匯出整個文件庫', 'export-docs') +
      '<label class="we-btn we-btn-ghost we-btn-sm">📤 匯入文件庫<input type="file" id="up-doc-import" accept="application/json,.json" hidden></label>' +
      (selected ? button('📄 匯出完整原文 TXT', 'export-text') + button('📖 開啟完整原文', 'full-text') : '') + '</div>' +
      '<p class="upgrade-note">完整文件庫匯出不需要 Google；請妥善保存下載檔。舊版只剩前段的文件無法自動恢復已截斷部分。</p>' + dataNotice() +
      (storageFailure ? '<p role="alert">⚠️ ' + esc(storageFailure) + '</p>' : ''));
    target.prepend(section);
  }
  readerRender = function () { original.readerRender(); readerTools(); };

  wbFiltered = function () {
    const all = original.wbFiltered();
    return tagFilter ? all.filter(e => ((noteMap()[e.word.toLowerCase()] || {}).tags || []).includes(tagFilter)) : all;
  };
  function wordTools() {
    const box = document.getElementById('wordbook-body');
    if (!box || wbState.reviewing) return;
    const tags = Array.from(new Set(Object.values(noteMap()).flatMap(m => m.tags || []))).sort();
    const tools = document.createElement('div');
    tools.innerHTML = card('🏷️ 主題標籤、筆記與匯出', '<div class="upgrade-actions"><label>主題標籤 <select id="up-tag-filter"><option value="">全部標籤</option>' + tags.map(t => '<option ' + (t === tagFilter ? 'selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>' +
      button('📥 匯出目前篩選 CSV', 'export-csv') + button('📥 匯出 Anki TSV', 'export-anki') + '</div><p class="upgrade-note">保留原有搜尋、來源及排序；Anki 可按欄位匯入英文、釋義、例句、筆記及標籤。</p>');
    box.prepend(tools);
    box.querySelectorAll('[data-wb-row]').forEach(row => {
      const word = row.getAttribute('data-wb-row'), meta = noteMap()[word.toLowerCase()] || {};
      const node = document.createElement('div'); node.className = 'upgrade-word-note';
      node.innerHTML = '<p>' + (meta.tags || []).map(t => '<span class="upgrade-tag">' + esc(t) + '</span>').join(' ') + '</p>' +
        (meta.note ? '<p>' + esc(meta.note) + '</p>' : '') + (meta.example ? '<p lang="en">' + esc(meta.example) + '</p>' : '') +
        button('✍️ 編輯標籤／筆記／例句', 'note', 'data-word="' + esc(word) + '"');
      row.append(node);
    });
  }
  renderWordbook = function () { original.renderWordbook(); wordTools(); updateStorage(); };
  function editNote(word) {
    const meta = noteMap()[word.toLowerCase()] || {};
    const dialog = document.createElement('dialog'); dialog.className = 'upgrade-dialog';
    dialog.innerHTML = '<form method="dialog"><h3>✍️ ' + esc(word) + '</h3>' +
      '<label>標籤（以逗號分隔）<input name="tags" value="' + esc((meta.tags || []).join(', ')) + '"></label>' +
      '<label>我的筆記<textarea name="note">' + esc(meta.note || '') + '</textarea></label>' +
      '<label>例句<textarea name="example">' + esc(meta.example || '') + '</textarea></label>' +
      '<div class="upgrade-actions"><button class="we-btn" value="save">儲存筆記</button><button class="we-btn we-btn-ghost" value="cancel">取消</button></div></form>';
    document.body.append(dialog); dialog.showModal();
    dialog.addEventListener('close', () => {
      if (dialog.returnValue === 'save') {
        const form = dialog.querySelector('form'), map = noteMap();
        map[word.toLowerCase()] = { tags: Array.from(new Set(form.elements.tags.value.split(/[,，]/).map(x => x.trim()).filter(Boolean))), note: form.elements.note.value, example: form.elements.example.value, updatedAt: Date.now() };
        lsSet(META, map); renderWordbook();
      }
      dialog.remove();
    });
  }

  function adaptiveMap() { return lsGet(ADAPTIVE, {}); }
  function seedAdaptive() {
    const map = adaptiveMap(); let changed = false;
    getWrongDb().forEach(w => {
      const key = w.word.toLowerCase();
      if (!map[key]) { map[key] = { stage: 0, attempts: 0, right: 0, dueAt: (Number(w.last_wrong_at || w.timestamp) || Date.now()) + 86400000, updatedAt: Date.now() }; changed = true; }
    });
    if (changed) lsSet(ADAPTIVE, map);
    return map;
  }
  addWrongWord = function () {
    const result = original.addWrongWord.apply(this, arguments);
    const key = String(arguments[0] || '').toLowerCase();
    if (prefs().adaptiveEnabled && key) { const map = adaptiveMap(); map[key] = nextReview(map[key], false, Date.now()); lsSet(ADAPTIVE, map); }
    return result;
  };
  function renderAdaptive() {
    const box = document.getElementById('srs-body');
    if (!box) return;
    box.querySelector('#up-adaptive')?.remove();
    const map = seedAdaptive(), due = Object.values(map).filter(x => x.dueAt <= Date.now()).length;
    const section = document.createElement('div'); section.id = 'up-adaptive';
    section.innerHTML = card('🌱 可選自適應加練',
      '<label class="upgrade-check"><input type="checkbox" id="up-adaptive-enabled" ' + (prefs().adaptiveEnabled ? 'checked' : '') + '> 啟用較早回問與延長複習間隔</label>' +
      '<p>加練間隔為 1 → 3 → 7 → 14 → 30 天；未記住則回到 1 天。原有七天錯題本及精通規則完整保留。</p>' +
      '<p id="up-adaptive-count">到期加練：' + due + ' 個；已排程：' + Object.keys(map).length + ' 個。</p>' +
      '<div class="upgrade-actions">' + button('開始到期加練', 'adaptive-due', prefs().adaptiveEnabled ? '' : 'disabled') + button('立即加練薄弱字', 'adaptive-weak', prefs().adaptiveEnabled ? '' : 'disabled') + '</div><div id="up-adaptive-session"></div>');
    box.prepend(section);
  }
  renderSRS = function () { original.renderSRS(); renderAdaptive(); };
  function beginAdaptive(weak) {
    const map = seedAdaptive(), bank = wbGetAll(), wrong = getWrongDb();
    const words = new Map(bank.map(e => [e.word.toLowerCase(), e])); wrong.forEach(e => { if (!words.has(e.word.toLowerCase())) words.set(e.word.toLowerCase(), e); });
    const list = Array.from(words.values()).filter(e => weak ? ((e.review || {}).right || 0) < ((e.review || {}).wrong || 0) + 1 : map[e.word.toLowerCase()] && map[e.word.toLowerCase()].dueAt <= Date.now());
    if (!list.length) { showToast('目前沒有需要加練的單字。', 'info'); return; }
    currentReview = { list: shuffle(list), index: 0, revealed: false }; paintAdaptive();
  }
  function paintAdaptive() {
    const box = document.getElementById('up-adaptive-session');
    if (!box || !currentReview) return;
    const item = currentReview.list[currentReview.index];
    if (!item) {
      const map = adaptiveMap(), counter = document.getElementById('up-adaptive-count');
      if (counter) counter.textContent = '到期加練：' + Object.values(map).filter(x => x.dueAt <= Date.now()).length + ' 個；已排程：' + Object.keys(map).length + ' 個。';
      box.innerHTML = '<p role="status">✅ 本輪加練完成，新的到期時間已保存。</p>'; currentReview = null; return; }
    box.innerHTML = '<div class="upgrade-practice"><p>第 ' + (currentReview.index + 1) + '／' + currentReview.list.length + ' 個</p><h4 lang="en">' + esc(item.word) + '</h4>' +
      button('🔊 聽發音', 'adaptive-speak') + (currentReview.revealed ? '<p>' + esc(item.meaning || '未有釋義，可到查字頁補充') + '</p><div class="upgrade-actions">' + button('😎 記住了', 'adaptive-yes') + button('🤔 還沒記住', 'adaptive-no') + '</div>' : button('👀 顯示答案', 'adaptive-reveal')) + button('結束加練', 'adaptive-end') + '</div>';
  }

  // 獨立的本機錄音回放，不取代語音辨識、不將錄音上傳。
  let recorder = null, stream = null, recordChunks = [], audioUrl = '', recording = false, micRequest = false, recordTimer = null, recorderView;
  function audioTools() {
    const box = document.getElementById('panel-speak');
    if (!box || box.querySelector('#up-audio-tools')) return;
    if (!recorderView) {
      recorderView = document.createElement('div'); recorderView.id = 'up-audio-tools';
      recorderView.innerHTML = card('🎧 本機錄音回放與評分說明',
        '<p>本機分數是辨識文字吻合度；AI 四項回饋主要根據轉錄與文字統計，均屬練習參考，並非音素、重音或語調分析。</p>' +
        '<p>下方錄音獨立於原有辨識功能。按下才要求麥克風權限；最多錄五分鐘，完成後可回放及下載。聲音只留在此頁記憶體，不加入雲端備份。</p>' +
        '<div class="upgrade-actions">' + button('🎙️ 開始本機錄音', 'record-start') + button('⏹️ 停止並回放', 'record-stop', 'disabled') + '</div><p id="up-record-status" role="status">尚未錄音</p><audio id="up-record-audio" controls hidden></audio><a id="up-record-download" hidden>下載錄音</a>' + dataNotice());
    }
    box.insertBefore(recorderView, document.getElementById('speak-ai-status'));
  }
  async function startAudio() {
    if (recording || micRequest) return;
    const status = document.getElementById('up-record-status');
    if (!navigator.mediaDevices?.getUserMedia || !root.MediaRecorder) { status.textContent = '此瀏覽器不支援本機錄音；原有手動輸入及辨識模式仍可使用。'; return; }
    micRequest = true; document.querySelector('[data-upgrade="record-start"]').disabled = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (state.activeTab !== 'speak') { stream.getTracks().forEach(t => t.stop()); stream = null; return; }
      recordChunks = []; const chunks = recordChunks; recorder = new MediaRecorder(stream);
      const activeRecorder = recorder;
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const type = activeRecorder.mimeType || 'audio/webm', blob = new Blob(chunks, { type });
        audioUrl = URL.createObjectURL(blob);
        api.lastRecording = { blob: blob, type: type, at: Date.now() };
        root.dispatchEvent(new CustomEvent('we-recorded'));
        const audio = recorderView.querySelector('#up-record-audio'), link = recorderView.querySelector('#up-record-download');
        audio.src = audioUrl; audio.hidden = false; link.href = audioUrl; link.download = 'speaking-' + Date.now() + (type.includes('mp4') ? '.m4a' : type.includes('ogg') ? '.ogg' : '.webm'); link.hidden = false;
        recorderView.querySelector('#up-record-status').textContent = '錄音已完成，可回放或下載；關閉此頁會清除暫存聲音。';
      };
      recorder.onerror = () => { stopAudio(); status.textContent = '錄音中斷，請重試；原有辨識功能仍保留。'; };
      recorder.start(); recording = true; status.textContent = '🔴 本機錄音中…（最多五分鐘）';
      recorderView.querySelector('[data-upgrade="record-stop"]').disabled = false;
      recordTimer = setTimeout(stopAudio, 300000);
    } catch (err) {
      stream?.getTracks().forEach(t => t.stop()); stream = null;
      status.textContent = '無法錄音：' + (err.name === 'NotAllowedError' ? '麥克風未獲允許；可使用原有手動輸入。' : err.message);
    } finally { micRequest = false; recorderView.querySelector('[data-upgrade="record-start"]').disabled = recording; }
  }
  function stopAudio() {
    clearTimeout(recordTimer);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach(t => t.stop()); stream = null; recording = false;
    if (recorderView) { recorderView.querySelector('[data-upgrade="record-start"]').disabled = false; recorderView.querySelector('[data-upgrade="record-stop"]').disabled = true; }
  }
  spRenderHome = function () { original.spRenderHome(); audioTools(); };
  spStage = function () { original.spStage.apply(this, arguments); audioTools(); };
  spAiFeedbackHtml = function () { return '<p class="upgrade-note">🧾 AI 文字練習回饋：根據轉錄內容估計，並非正式成績或直接聲學分析。</p>' + original.spAiFeedbackHtml.apply(this, arguments); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && recording) stopAudio(); });
  const oldSwitchTab = switchTab;
  switchTab = function (tab) { if (tab !== 'speak' && recording) stopAudio(); oldSwitchTab(tab); };
  root.addEventListener('pagehide', () => { stopAudio(); if (audioUrl) URL.revokeObjectURL(audioUrl); });

  document.addEventListener('change', async event => {
    const el = event.target;
    if (el.id === 'up-backup-docs') {
      setPrefs({ includeDocuments: el.checked });
      showToast(el.checked ? '之後的 JSON 備份及 Google 同步會包含完整文件。' : '之後不再上傳新文件；既有雲端版本保留。', 'info');
      if (el.checked) gsyncOnWrite(LS_READER);
    }
    if (el.id === 'up-adaptive-enabled') { setPrefs({ adaptiveEnabled: el.checked }); renderSRS(); }
    if (el.id === 'up-tag-filter') { tagFilter = el.value; renderWordbook(); }
    if (el.id === 'up-doc-import' && el.files[0]) {
      const file = el.files[0]; el.value = '';
      try {
        if (file.size > 100 * 1024 * 1024) throw new Error('檔案超過 100 MB，請分批匯入');
        const parsed = JSON.parse(await file.text()), incoming = validDocs(parsed.documents || parsed.data?.[LS_READER]);
        if (!incoming.length) throw new Error('找不到有效文件版本');
        const ok = await weConfirm('將合併 ' + incoming.length + ' 個文件版本，現有 ' + docs.length + ' 個版本保留。', { okText: '合併文件', cancelText: '取消' });
        if (ok) { await documentReady; const saved = await persistDocs(mergeDocs(docs, incoming)); if (saved) showToast('文件庫已合併', 'info'); readerRender(); }
      } catch (err) { warn(err.message); }
    }
  });
  document.addEventListener('click', async event => {
    const el = event.target.closest('[data-upgrade]'); if (!el || el.disabled) return;
    const action = el.dataset.upgrade;
    if (action === 'note') editNote(el.dataset.word);
    if (action === 'export-docs') { await documentReady; await pendingWrites; saveFile('word-explorer-documents-' + todayKey() + '.json', JSON.stringify({ app: 'word-explorer', schema: 1, exportedAt: Date.now(), documents: docs }, null, 2), 'application/json'); }
    if (action === 'export-text') { const d = docs.find(x => x.id === readerState.docId); if (d) saveFile(d.name.replace(/\.[^.]+$/, '') + '.txt', d.rawText || d.text); }
    if (action === 'full-text') { const d = docs.find(x => x.id === readerState.docId); if (d) readerOpenSaved(d.id); }
    if (action === 'export-csv' || action === 'export-anki') {
      const list = wbFiltered(), meta = noteMap();
      if (!list.length) { warn('目前篩選沒有單字可匯出'); return; }
      const rows = list.map(e => { const m = meta[e.word.toLowerCase()] || {}; return [e.word, e.meaning || '', m.example || '', m.note || '', (m.tags || []).join(' ')]; });
      if (action === 'export-csv') saveFile('wordbook-' + todayKey() + '.csv', '\uFEFF' + [['英文', '釋義', '例句', '筆記', '標籤']].concat(rows).map(row => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
      else saveFile('wordbook-anki-' + todayKey() + '.tsv', '#separator:Tab\n#html:false\n' + rows.map(row => row.map(v => String(v).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n'), 'text/tab-separated-values;charset=utf-8');
    }
    if (action === 'adaptive-due' || action === 'adaptive-weak') beginAdaptive(action === 'adaptive-weak');
    if (action === 'adaptive-speak' && currentReview) speak(currentReview.list[currentReview.index].word);
    if (action === 'adaptive-reveal' && currentReview) { currentReview.revealed = true; paintAdaptive(); }
    if ((action === 'adaptive-yes' || action === 'adaptive-no') && currentReview && currentReview.revealed) {
      const item = currentReview.list[currentReview.index], key = item.word.toLowerCase(), map = adaptiveMap();
      map[key] = nextReview(map[key], action === 'adaptive-yes', Date.now()); lsSet(ADAPTIVE, map);
      currentReview.index++; currentReview.revealed = false; paintAdaptive();
    }
    if (action === 'adaptive-end') { currentReview = null; renderAdaptive(); }
    if (action === 'record-start') startAudio();
    if (action === 'record-stop') stopAudio();
  });

  document.addEventListener('DOMContentLoaded', async () => {
    const style = document.createElement('style'); style.textContent = `
      .we-upgrade-card{padding:1.2rem;margin-bottom:1rem;color:#454056}
      .we-upgrade-card h3{font-weight:850;font-size:1.1rem;margin-bottom:.6rem;color:#4F32C4}
      .we-upgrade-card p{font-size:.9rem;line-height:1.75;margin:.45rem 0}
      .upgrade-note{font-size:.8rem!important;color:#625b75;line-height:1.7}
      .upgrade-note a{color:#4F32C4;text-decoration:underline}
      .upgrade-actions{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin:.7rem 0}
      .upgrade-check{display:flex;gap:.6rem;align-items:flex-start;font-weight:700;margin:.8rem 0;line-height:1.7}
      .upgrade-check input{margin-top:.4rem;width:1.1rem;height:1.1rem;accent-color:#6C4BF6}
      .upgrade-word-note{margin-top:.8rem;border-top:1px solid #E4E2EF;padding-top:.7rem;font-size:.9rem;white-space:pre-wrap}
      .upgrade-tag{background:#EEE8FF;color:#4F32C4;padding:.2rem .5rem;border-radius:1rem}
      .upgrade-dialog{border:2px solid #E4E2EF;border-radius:1.2rem;padding:1.4rem;width:min(94vw,34rem);max-height:90vh}
      .upgrade-dialog::backdrop{background:#28213c99}.upgrade-dialog h3{font-size:1.2rem;font-weight:800;margin-bottom:1rem}
      .upgrade-dialog label{display:block;font-weight:700;margin:.7rem 0}
      .upgrade-dialog input,.upgrade-dialog textarea,#up-tag-filter{display:block;width:100%;border:2px solid #C9C3DC;border-radius:.6rem;padding:.6rem;color:#3C3A4A;background:white}
      .upgrade-dialog textarea{min-height:6rem}.upgrade-practice{padding:1rem;border:2px solid #C9C3DC;border-radius:1rem}
      .upgrade-practice h4{font-size:1.5rem;font-weight:800}#up-record-audio{width:100%;margin:.7rem 0}
      #up-record-download{color:#4F32C4;text-decoration:underline;font-weight:700}
      [data-upgrade]:focus-visible,.upgrade-dialog :focus-visible{outline:3px solid #00B4A6;outline-offset:3px}
      @media(max-width:480px){.we-upgrade-card{padding:1rem}.upgrade-actions{align-items:stretch}.upgrade-actions button{min-height:44px}}
    `; document.head.append(style);
    await documentReady;
    if (state.activeTab === 'reader') readerRender();
    if (state.activeTab === 'wordbook') renderWordbook();
    if (state.activeTab === 'speak') audioTools();
  });
  bootDocuments();
  api.documentReady = documentReady;
  api.flushDocuments = () => pendingWrites;
  api.getDocuments = () => docs.slice();
})(typeof window === 'undefined' ? globalThis : window);

/* v2.3 UI / 學習流程；載入失敗仍可使用原有九個單元。 */
(function(){
  if(typeof document==='undefined'||typeof document.createElement!=='function')return;
  const css=document.createElement('link');css.rel='stylesheet';css.href='experience.css';document.head.append(css);
  const js=document.createElement('script');js.src='experience.js';js.async=true;js.onerror=function(){console.warn('新版導覽載入失敗，原有單元仍可使用。');};document.head.append(js);
})();
