const test=require('node:test');
const assert=require('node:assert/strict');
const {mergeMaps,mergeReading,completedLenses,draftSignature,recentEvents}=require('../experience.js');
test('閱讀合併保留雙端筆記、較新位置及取消標記',()=>{
 const a={doc:{para:4,updatedAt:40,marks:{'1':{on:true,updatedAt:1}},notes:{a:{text:'A',at:2}}}};
 const b={doc:{para:2,updatedAt:20,marks:{'1':{on:false,updatedAt:5},'2':{on:true,updatedAt:4}},notes:{b:{text:'B',at:3}}},other:{para:7,updatedAt:50}};
 const out=mergeReading(a,b);assert.equal(out.doc.para,4);assert.equal(out.doc.marks[1].on,false);assert.deepEqual(Object.keys(out.doc.notes).sort(),['a','b']);assert.equal(out.other.para,7);assert.equal(a.doc.marks[1].on,true);
 assert.deepEqual(mergeReading(out,b),out);
});
test('版本與活動合併按時間去重，拒絕原型污染鍵',()=>{
 const a={x:{at:10,text:'old'},y:{at:30}},b=JSON.parse('{"x":{"at":20,"text":"new"},"__proto__":{"at":100,"polluted":true}}');
 const out=mergeMaps(a,b);assert.equal(out.x.text,'new');assert.ok(out.y);assert.equal(Object.hasOwn(out,'__proto__'),false);assert.equal({}.polluted,undefined);
});
test('五角度進度不計空白，草稿內容變化可識別',()=>{
 const d={topic:'Environment',lens:{social:'hello',economic:'  ',env:'green'}};assert.equal(completedLenses(d),2);assert.notEqual(draftSignature(d),draftSignature({...d,topic:'Culture'}));assert.equal(completedLenses(null),0);
});
test('七天活動忽略未來及過期數字，不推算歷史',()=>{
 const now=1000000000,week=7*86400000;
 assert.deepEqual(recentEvents({a:{at:now},b:{at:now-week},c:{at:now+1},d:{at:now-1}},now).map(x=>x.at),[now,now-1]);
});
const {paragraphIndex,flowId,mergeJourneys,clozePrompt,normalAnswer}=require('../experience.js');
test('原句填字保留原句標點、不誤遮同前綴字、答案忽略大小寫空白',()=>{
 assert.equal(clozePrompt('Park parks PARK.','park'),'＿＿＿＿ parks ＿＿＿＿.');
 assert.equal(clozePrompt('The C++ compiler.','C++'),'The C++ compiler.');
 assert.equal(normalAnswer('  Environment '),'environment');
});
test('段落位置限制在文件範圍，不接受負數或非數字',()=>{
 assert.equal(paragraphIndex(-10,3),0);assert.equal(paragraphIndex(12,3),2);assert.equal(paragraphIndex('bad',3),0);assert.equal(paragraphIndex(2.8,4),2);
});
test('不同文章、段落有獨立流程，雙端流程合併保留每一步',()=>{
 const f={docId:'a',para:1,word:'Park'},id=flowId(f);
 assert.equal(id,flowId({...f,word:'park'}));assert.notEqual(id,flowId({...f,para:2}));
 const merged=mergeJourneys({[id]:{...f,updatedAt:20,steps:{lookup:{at:10},collect:{at:20}}}},{[id]:{...f,updatedAt:30,steps:{quiz:{at:30},collect:{at:15}}}});
 assert.equal(merged[id].steps.collect.at,20);assert.equal(merged[id].steps.quiz.at,30);assert.ok(merged[id].steps.lookup);
});
test('草稿簽章涵蓋 AI 和評分，角度鍵的排列不產生假版本',()=>{
 const d={topic:'A',lens:{social:'one',env:'two'}};
 assert.equal(draftSignature(d),draftSignature({...d,lens:{env:'two',social:'one'}}));
 assert.notEqual(draftSignature(d),draftSignature({...d,ai:{answer:'saved'}}));assert.notEqual(draftSignature(d),draftSignature({...d,score:{total:10}}));
});
const {preserveDraftVersions}=require('../experience.js');
test('兩端同 ID 不同草稿都保留版本，重複合併不重複新增',()=>{
 const a={draft:{id:'same',topic:'Old',lens:{}},updatedAt:10},b={draft:{id:'same',topic:'New',lens:{}},updatedAt:20};
 const v=preserveDraftVersions({},[a,b]);assert.equal(Object.keys(v).length,2);assert.deepEqual(new Set(Object.values(v).map(e=>e.draft.topic)),new Set(['Old','New']));assert.deepEqual(preserveDraftVersions(v,[a,b]),v);
});
const {learningStats,practiceEvents,audioGroups,backupStatus,googleErrorHint}=require('../experience.js');
test('統計排除保存錄音及未知事件，按七個日曆日計算、不含未來',()=>{
 const now=+new Date(2026,10,8,20),start=+new Date(2026,10,2),e={a:{id:'a',at:start,kind:'quiz',word:'A',correct:false},b:{id:'b',at:now,kind:'saved-audio'},c:{id:'c',at:now,kind:'speaking'},d:{id:'d',at:now+1,kind:'quiz'},e:{id:'e',at:start-1,kind:'quiz',correct:true}};
 const r=learningStats(e,now);assert.equal(r.week.length,2);assert.equal(r.answers,1);assert.equal(r.right,0);assert.equal(r.speaking,1);assert.equal(practiceEvents(e,now).length,3);
});
test('改善需最後一次錯誤後連對兩次；再次答錯即返回薄弱字',()=>{
 const now=Date.now(),e={};let i=0;for(const [word,values] of [['apple',[false,true,true]],['park',[false,true]],['old',[false,true,true,false]],['new',[true,true]]])for(const correct of values){i++;e[i]={id:String(i),at:now-1000+i,kind:'quiz',word,correct};}
 const r=learningStats(e,now,{apple:{tags:['食物']},old:{tags:['科技','生活']}});assert.deepEqual(r.improved.map(e=>e.word),['apple']);assert.deepEqual(r.weak.map(e=>e.word),['old','park']);assert.equal(r.topics.find(t=>t.topic==='科技').wrong,2);assert.equal(r.topics.find(t=>t.topic==='食物').total,3);
});
test('錄音按題目與模式分組，舊錄音可用名稱分組，首次最新排序穩定',()=>{
 const rows=[{id:'b',topic:'Park',mode:'free',at:2},{id:'c',topic:'park',mode:'mock1',at:3},{id:'a',label:' park ',mode:'free',at:1}];const g=audioGroups(rows);assert.equal(g.length,2);assert.deepEqual(g[1].map(r=>r.id),['a','b']);assert.equal(rows[0].id,'b');
});
test('Google 狀態不把已填 ID 或已登入當作備份成功，失敗優先顯示',()=>{
 assert.equal(backupStatus({},''),'missing-client');assert.equal(backupStatus({},'id'),'signed-out');assert.equal(backupStatus({email:'a'},'id'),'pending');assert.equal(backupStatus({email:'a',lastSyncAt:10},'id'),'synced');assert.equal(backupStatus({email:'a',lastSyncAt:10,lastError:'403'},'id'),'error');assert.match(googleErrorHint('origin_mismatch'),/沒有 \/app/);assert.match(googleErrorHint('403'),/Drive API/);
});
