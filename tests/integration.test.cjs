const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function app(seed={}){
  const memory=new Map(Object.entries(seed).map(([k,v])=>[k,JSON.stringify(v)]));
  const scheduled=[];
  const ctx={console:{log(){},warn(){}},document:{getElementById(){return null},querySelector(){return null},querySelectorAll(){return []},addEventListener(){}},navigator:{},location:{protocol:'file:',hash:''},addEventListener(){},setTimeout(fn,ms){scheduled.push(ms);return scheduled.length},clearTimeout(){},setInterval(){},clearInterval(){},URL,Blob,AbortController,Date,Math,Promise,Map,Set,localStorage:{getItem(k){return memory.get(k)??null},setItem(k,v){memory.set(k,v)}}};
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function lsGet('));
  vm.runInContext(inline,ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../enhancements.js'),'utf8'),ctx);
  return {ctx,memory,scheduled};
}
test('真實主程式與新增模組相容；舊文件在無 IndexedDB 時仍可保存超過四份',async()=>{
  const {ctx}=app({reader_docs:[{id:'old',name:'old.txt',text:'Legacy English text.',at:1}]});
  await ctx.WEUpgrade.documentReady;
  for(let i=0;i<5;i++) await ctx.readerOpenText('new.txt','Version '+i+' of an English document.');
  await ctx.WEUpgrade.flushDocuments();
  assert.equal(ctx.WEUpgrade.getDocuments().length,6);
  assert.ok(ctx.WEUpgrade.getDocuments().some(d=>d.id==='old'));
});
test('真實備份程式可選文件、排除金鑰，且從同步套用文件不會循環排程同步',async()=>{
  const {ctx,memory,scheduled}=app({reader_docs:[{id:'old',name:'old',text:'Original.',at:1}],gsync_settings:{email:'test@example.invalid',auto:true},we_upgrade_prefs_v1:{includeDocuments:true},ai_settings:{apiKey:'TEST_ONLY_NOT_A_REAL_KEY'}});
  await ctx.WEUpgrade.documentReady;
  const snapshot=ctx.gsSnapshot();
  assert.equal(snapshot.data.reader_docs.length,1);assert.ok(!('ai_settings' in snapshot.data));
  const before=scheduled.filter(x=>x===6000).length;
  ctx.gsApply({reader_docs:[{id:'new',name:'remote',text:'Remote.',at:2}]});
  await ctx.WEUpgrade.flushDocuments();
  assert.equal(ctx.WEUpgrade.getDocuments().length,2);
  assert.equal(scheduled.filter(x=>x===6000).length,before);
  memory.set('we_upgrade_prefs_v1',JSON.stringify({includeDocuments:false}));
  assert.ok(!('reader_docs' in ctx.gsSnapshot().data));
});
test('長文前段預覽不會裁掉完整整理後文字或抽取原文',async()=>{
  const {ctx}=app();await ctx.WEUpgrade.documentReady;
  ctx.weConfirm=async()=>false;
  const raw='123\n\n'+'English document. '.repeat(5000)+'END_OF_DOCUMENT';
  await ctx.readerOpenText('long.txt',raw);
  const stored=ctx.WEUpgrade.getDocuments()[0];
  assert.ok(stored.text.length>80000);assert.equal(stored.rawText,raw);assert.ok(stored.text.endsWith('END_OF_DOCUMENT'));
  assert.equal(vm.runInContext('readerState.text.length',ctx),80000);
});
