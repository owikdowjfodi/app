const test = require('node:test');
const assert = require('node:assert/strict');
const {mergeDocs, nextReview, mergeTimedMaps, mergeDaily, csvCell} = require('../enhancements.js');

test('文件合併保留超過四份及完整長文；同 ID 衝突保留兩版本', () => {
  const long = 'English paragraph. '.repeat(6000);
  const a = Array.from({length:6}, (_,i) => ({id:'d'+i, name:'same.txt', text:long+i, at:i+1}));
  const b = [{id:'d0', name:'same.txt', text:'remote edit', at:9}];
  const out = mergeDocs(a,b);
  assert.equal(out.length,7);
  assert.ok(out.some(d=>d.text===long+'0'));
  assert.ok(out.some(d=>d.text==='remote edit'));
  assert.equal(mergeDocs(out,b).length,7);
  assert.equal(mergeDocs(b,out).length,7);
  assert.equal(mergeDocs(mergeDocs(b,out),out).length,7);
  assert.ok(out.some(d=>d.text.length>80000));
});
test('文件合併去重，跳過不合法文件，保留中文檔名及內容', () => {
  const d={id:'x', name:'文章.txt', text:'完整內容', at:1};
  assert.deepEqual(mergeDocs([d],[d,null,{id:'no-text'}]).map(x=>x.text), ['完整內容']);
});
test('自適應間隔逐步延長，忘記後回到一天且保留作答數', () => {
  const now=1000000;
  let state=nextReview(null,false,now);
  assert.equal(state.dueAt,now+86400000);
  for(const days of [3,7,14,30,30]) {state=nextReview(state,true,now);assert.equal(state.dueAt,now+days*86400000);}
  state=nextReview(state,false,now);
  assert.equal(state.stage,0);assert.equal(state.attempts,7);assert.equal(state.right,5);
});
test('同步筆記及複習排程採較新版本，不丟棄另一端獨有資料', () => {
  const out=mergeTimedMaps({one:{updatedAt:2,note:'新'},two:{updatedAt:1}}, {one:{updatedAt:1,note:'舊'},three:{updatedAt:1}});
  assert.equal(out.one.note,'新');assert.equal(Object.keys(out).length,3);
  assert.equal({}.polluted,undefined);
});
test('當日測驗合併不同場次並保留較完整作答；日期不同取較新', () => {
  const a={date:'2026-11-08',sessions:[{id:1,createdAt:1,questions:[{word:'alpha'}],answers:[]}],usedWords:['alpha']};
  const b={date:'2026-11-08',sessions:[{id:1,createdAt:1,questions:[{word:'alpha'}],answers:[true]},{id:2,createdAt:2,questions:[{word:'beta'}],answers:[]}],usedWords:['alpha','beta']};
  const out=mergeDaily(a,b);
  assert.equal(out.sessions.length,2);assert.deepEqual(out.sessions[0].answers,[true]);
  assert.deepEqual(out.usedWords,['alpha','beta']);
  assert.equal(mergeDaily(a,{date:'2026-11-09'}).date,'2026-11-09');
});
test('CSV 保留逗號、引號和換行，並防止筆記被當成試算表公式', () => {
  assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');
  assert.equal(csvCell('=SUM(1,2)'), '"\'=SUM(1,2)"');
});
