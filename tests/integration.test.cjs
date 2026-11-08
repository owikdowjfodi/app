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
test('Google 雲端下載失敗時停止同步，不上傳、不誤報成功',async()=>{
 const {ctx}=app({gsync_settings:{email:'test@example.invalid',clientId:'123-test.apps.googleusercontent.com'}});await ctx.WEUpgrade.documentReady;
 let writes=0;ctx.gsFindRemoteFile=async()=>({id:'remote'});ctx.gsDownloadRemote=async()=>{throw new Error('offline')};ctx.gsUploadRemote=async()=>{writes++;return 'remote'};
 const r=await ctx.gsyncSync({silent:true});assert.equal(r.ok,false);assert.equal(writes,0);assert.equal(ctx.gsGet().lastSyncAt,undefined);assert.match(ctx.gsGet().lastError,/offline/);
});
test('Google 備份需讀回相同內容才記錄成功；讀回不符保留失敗狀態',async()=>{
 const {ctx}=app({reader_docs:[{id:'test',name:'test.txt',text:'Test only.',at:1}],we_upgrade_prefs_v1:{includeDocuments:true},gsync_settings:{email:'test@example.invalid',clientId:'123-test.apps.googleusercontent.com'}});await ctx.WEUpgrade.documentReady;
 ctx.gsFindRemoteFile=async()=>null;let uploaded;ctx.gsUploadRemote=async p=>{uploaded=JSON.parse(JSON.stringify(p));return 'new'};ctx.gsDownloadRemote=async()=>uploaded;
 assert.equal((await ctx.gsyncSync({silent:true})).ok,true);assert.ok(ctx.gsGet().lastSyncAt);
 ctx.gsDownloadRemote=async()=>({...uploaded,data:{}});assert.equal((await ctx.gsyncSync({silent:true})).ok,false);assert.match(ctx.gsGet().lastError,/未能確認/);
});
test('Google 已存在但無效的雲端備份不會被本機資料覆寫',async()=>{
 const {ctx}=app({gsync_settings:{email:'test@example.invalid',clientId:'123-test.apps.googleusercontent.com'}});await ctx.WEUpgrade.documentReady;let writes=0;ctx.gsFindRemoteFile=async()=>({id:'remote'});ctx.gsDownloadRemote=async()=>({data:{}});ctx.gsUploadRemote=async()=>{writes++};
 assert.equal((await ctx.gsyncSync({silent:true})).ok,false);assert.equal(writes,0);assert.match(ctx.gsGet().lastError,/格式/);
});
function approvedAI(ctx,patch={}){
 const s={...ctx.aiDefaults(),provider:'custom',base:'https://qa-api.example.invalid/v1',model:'qa-model',apiKey:'QA_ONLY_NOT_A_REAL_KEY',...patch};s.allowedModels=[s.model];s.approvedConfig=ctx.aiApprovalId(s);ctx.aiSaveSettings(s);return s;
}
test('AI 預設與舊金鑰設定均不發送請求；缺金鑰不自動使用任何供應商',async()=>{
 for(const settings of [null,{provider:'pollinations',apiKey:''},{provider:'openai',apiKey:'QA_ONLY',model:'old-model'}]){
  const {ctx}=app(settings?{ai_settings:settings}:{});let calls=0;ctx.fetch=async()=>{calls++;throw new Error('must not request')};assert.equal(ctx.aiIsReady(),false);assert.equal(ctx.aiKeyless(),null);await assert.rejects(ctx.aiChat([{role:'user',content:'hello'}]));assert.equal(calls,0);
 }
});
test('AI 只呼叫本人核准的網址及單一模型，回覆 tokens 不超過使用者上限',async()=>{
 const {ctx}=app();const s=approvedAI(ctx,{maxTokens:100});let call;ctx.fetch=async(url,options)=>{call={url,options};return {ok:true,json:async()=>({choices:[{message:{content:'OK'}}]})}};
 assert.equal(ctx.aiIsReady(),true);assert.equal(await ctx.aiChat([{role:'user',content:'hello'}],{maxTokens:2000}),'OK');assert.equal(call.url,s.base+'/chat/completions');const body=JSON.parse(call.options.body);assert.equal(body.model,s.model);assert.equal(body.max_tokens,100);assert.equal(call.options.headers.Authorization,'Bearer '+s.apiKey);assert.equal(call.options.redirect,'error');
 assert.ok(!('ai_settings' in ctx.gsSnapshot().data));
});
test('更改金鑰、模型、網址、供應商或用量後，原核准失效且不發送請求',async()=>{
 const {ctx}=app();const s=approvedAI(ctx);let calls=0;ctx.fetch=async()=>{calls++};
 for(const patch of [{apiKey:'DIFFERENT_QA_KEY'},{model:'other-model'},{base:'https://other.example.invalid/v1'},{provider:'openai'},{maxTokens:400},{temperature:0.3},{allowedModels:['other-model']},{approvedConfig:''}]){ctx.aiSaveSettings({...s,...patch});assert.equal(ctx.aiIsReady(),false);await assert.rejects(ctx.aiChat([{role:'user',content:'hello'}]));}
 assert.equal(calls,0);
});
test('不接受 HTTP、含帳密或查詢參數的端點，以及偽裝供應商的網址',()=>{
 const {ctx}=app();for(const patch of [{base:'http://qa-api.example.invalid/v1'},{base:'https://name:pass@qa-api.example.invalid/v1'},{base:'https://qa-api.example.invalid/v1?key=QA'},{base:'https://qa-api.example.invalid/v1#x'},{provider:'openai',base:'https://other.example.invalid/v1'},{model:'bad model'},{provider:'pollinations'},{maxTokens:Infinity}]){approvedAI(ctx,patch);assert.equal(ctx.aiIsReady(),false);}
});
test('已核准請求失敗只呼叫一次，不重試、不切換其他模型或服務',async()=>{
 const {ctx}=app();approvedAI(ctx);let calls=0;ctx.fetch=async()=>{calls++;return {ok:false,status:401,json:async()=>({error:{message:'test rejection'}})}};await assert.rejects(ctx.aiChat([{role:'user',content:'hello'}]),/401/);assert.equal(calls,1);
});
test('Gemini 及 Claude 同樣必須核准並使用本人金鑰；停用後一律封鎖',async()=>{
 for(const provider of ['gemini','anthropic']){const {ctx}=app();const base=ctx.aiProvider(provider).base;approvedAI(ctx,{provider,base});let calls=0;ctx.fetch=async(url,options)=>{calls++;assert.equal(options.redirect,'error');if(provider==='gemini'){assert.match(url,/generateContent\?key=/);return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'OK'}]}}]})}}assert.equal(options.headers['x-api-key'],'QA_ONLY_NOT_A_REAL_KEY');return {ok:true,json:async()=>({content:[{text:'OK'}]})}};assert.equal(await ctx.aiChat([{role:'user',content:'hello'}]),'OK');const s=ctx.aiGetSettings();s.approvedConfig='';ctx.aiSaveSettings(s);await assert.rejects(ctx.aiChat([{role:'user',content:'hello'}]));assert.equal(calls,1);}
});
