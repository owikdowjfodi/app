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
