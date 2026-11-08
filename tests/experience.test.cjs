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
