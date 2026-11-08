const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const current=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const baseline=fs.readFileSync(require('node:path').join(__dirname,'fixtures/original-index.html.txt'),'utf8');
test('原有所有具名函數與九個單元 ID 保留',()=>{
  const names=s=>new Set([...s.matchAll(/function\s+(\w+)\s*\(/g)].map(m=>m[1]));
  const before=names(baseline),after=names(current);
  assert.deepEqual([...before].filter(n=>!after.has(n)),[]);
  for(const tab of ['lexicon','affix','quiz','srs','wordbook','reader','speak','idea','playbook']) assert.ok(current.includes('id="panel-'+tab+'"'));
});
test('字根圖鑑、原有題庫、習語及提示詞資料逐字保留',()=>{
  const sections=[['const IELTS_WORDS = [','const QUIZ_WORDS ='],['const WORDS = [','const PREFIX_RULES ='],['const AFFIXES = {','const AFFIX_TYPES ='],['const AI_DEFAULT_PROMPTS = {','const IELTS_PART1 ='],['const IELTS_PART1 = [','function aiDefaults()'],['const IDEA_LENSES = [','function ideaBlank(topic)']];
  for(const [start,end] of sections){
    const part=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));
    assert.ok(baseline.includes(start)&&baseline.includes(end));
    assert.equal(part(current),part(baseline),start);
  }
});
test('所有舊 PWA 快捷入口保留，且新增模組列入外殼快取',()=>{
  const manifest=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../manifest.webmanifest'),'utf8'));
  assert.equal(manifest.shortcuts.length,8);
  const sw=fs.readFileSync(require('node:path').join(__dirname,'../sw.js'),'utf8');
  assert.ok(sw.includes("'./enhancements.js'"));assert.ok(sw.includes("'./app-config.js'"));
  assert.ok(sw.includes("key.startsWith('word-explorer-shell-')"));
});
