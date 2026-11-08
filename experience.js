/* v2.3：在原有九個單元之上增加導覽、學習流程與本機保存，不替換原題庫。 */
(function (root) {
  'use strict';
  const keys = { settings:'we_experience_v23', reading:'we_reading_v23', draft:'we_idea_draft_v23', versions:'we_idea_versions_v23', activity:'we_activity_v23', flow:'we_learning_flow_v23' };
  function mergeMaps(a,b) {
    const out={};
    [a,b].forEach(src=>Object.keys(src||{}).forEach(k=>{
      if(['__proto__','prototype','constructor'].includes(k))return;
      const v=src[k];if(v&&typeof v==='object'&&(!out[k]||Number(v.updatedAt||v.at||0)>=Number(out[k].updatedAt||out[k].at||0)))out[k]=v;
    }));return out;
  }
  function mergeReading(a,b) {
    const out=mergeMaps(a,b);
    Object.keys(out).forEach(k=>{out[k]=Object.assign({},out[k],{marks:mergeMaps(a?.[k]?.marks,b?.[k]?.marks),notes:mergeMaps(a?.[k]?.notes,b?.[k]?.notes)});});return out;
  }
  function draftSignature(d) {return JSON.stringify([d?.topic||'',d?.lens||{}]);}
  function completedLenses(d) {return ['social','economic','cultural','env','global'].filter(k=>String(d?.lens?.[k]||'').trim()).length;}
  function recentEvents(events,now) {return Object.values(events||{}).filter(e=>e&&Number(e.at)>now-7*86400000&&Number(e.at)<=now);}
  const api={keys,mergeMaps,mergeReading,draftSignature,completedLenses,recentEvents};root.WEExperience=api;
  if(typeof document==='undefined'){if(typeof module!=='undefined')module.exports=api;return;}
  function boot(){
    if(document.body.classList.contains('ex-ready'))return;
    document.body.classList.add('ex-ready');
    const get=(k,d)=>lsGet(k,d), put=(k,v)=>lsSet(k,v), copy=o=>JSON.parse(JSON.stringify(o));
    const settings=()=>get(keys.settings,{font:16,line:1.85,theme:'light',goal:10});
    const fmt=t=>new Date(t).toLocaleString('zh-Hant',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    const btn=(label,action,attrs='')=>'<button type="button" class="we-btn we-btn-ghost we-btn-sm" data-ex="'+action+'" '+attrs+'>'+label+'</button>';
    const card=(title,body)=>'<section class="ex-card"><h3>'+title+'</h3>'+body+'</section>';
    const nav=[['today','☀️','今日學習'],['lexicon','🔍','查字與翻譯'],['quiz','📝','每日測驗'],['srs','🧠','錯題與複習'],['wordbook','📒','我的單詞本'],['reader','📄','閱讀文件'],['speak','🎤','口說練習'],['affix','🔤','字根圖鑑'],['idea','💡','想法五稜鏡'],['playbook','📚','雅思攻略']];
    let applyingExperience=false;
    let saveTimer,readTimer,scrollTimer,lastVersionAt=0,miniQuiz=null,audioRender=0;
    let audioUrls=[];
    let selectedPara=0;
    const original={switchTab,renderWordbook,renderSRS,readerRender,readerOpenSaved,readerCloseDoc,renderIdea,spRenderHome,spStartMode,spSaveRecord,spStage,wbAnswer,checkQuizAnswer,gsyncCardHtml,gsSnapshot,gsMergeAll,gsApply};
    function activity(kind,word,correct){const all=get(keys.activity,{}),at=Date.now(),id=at.toString(36)+Math.random().toString(36).slice(2,9);all[id]={id,at,updatedAt:at,kind,word:word||'',correct};put(keys.activity,all);}
    function saveSettings(patch){put(keys.settings,Object.assign({},settings(),patch));applyAppearance();}
    function applyAppearance(){const s=settings();document.documentElement.style.setProperty('--ex-font',Math.max(14,Math.min(22,Number(s.font)||16))+'px');document.documentElement.style.setProperty('--ex-line',Math.max(1.5,Math.min(2.5,Number(s.line)||1.85)));document.documentElement.dataset.theme=s.theme==='system'?(root.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):(s.theme||'light');}
    function modal(html){const d=document.createElement('dialog');d.className='ex-dialog';d.innerHTML=html;document.body.append(d);d.showModal();d.addEventListener('close',()=>d.remove());return d;}
    function details(node,title){if(!node||node.parentElement?.classList.contains('ex-details'))return;const d=document.createElement('details');d.className='ex-details';const summary=document.createElement('summary');summary.textContent=title;node.before(d);d.append(summary);const body=document.createElement('div');d.append(body);body.append(node);return d;}
    function navState(){document.querySelectorAll('[data-ex-tab]').forEach(b=>{if(b.dataset.exTab===state.activeTab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});}
    function renderShell(){
      const side=document.createElement('aside');side.className='ex-sidebar';side.setAttribute('aria-label','學習單元');side.innerHTML='<div class="ex-brand"><b>🦊</b> 單字探險家</div><nav>'+nav.map(n=>'<button type="button" data-ex-tab="'+n[0]+'"><span>'+n[1]+'</span>'+n[2]+'</button>').join('')+'</nav><footer>每天一點，慢慢變熟練。<br>v2.3 · 學習資料預設保存在裝置</footer>';document.body.append(side);
      const bottom=document.createElement('nav');bottom.className='ex-mobile';bottom.setAttribute('aria-label','常用學習功能');bottom.innerHTML=[['lexicon','🔍','查字'],['srs','🧠','複習'],['reader','📄','閱讀'],['speak','🎤','口說']].map(n=>'<button type="button" data-ex-tab="'+n[0]+'"><b>'+n[1]+'</b>'+n[2]+'</button>').join('')+'<button type="button" data-ex="all"><b>☰</b>全部</button>';document.body.append(bottom);
      const header=document.querySelector('body>header>div');if(header){const actions=document.createElement('div');actions.className='ex-head-actions';actions.innerHTML='<button type="button" class="ex-icon-btn" data-ex-tab="today">☀️ 今日</button><button type="button" class="ex-icon-btn" data-ex="appearance" aria-label="開啟閱讀與外觀設定">Aa 設定</button>';header.append(actions);}
      const drawer=document.getElementById('nav-list');if(drawer){const b=document.createElement('button');b.type='button';b.className='we-nav-item';b.dataset.exTab='today';b.textContent='☀️ 今日學習';drawer.prepend(b);}
      const today=document.createElement('section');today.id='panel-today';today.className='ex-today hidden';document.querySelector('main').prepend(today);
      const flow=document.createElement('div');flow.id='ex-flow';flow.hidden=true;document.querySelector('main').prepend(flow);
      const version=document.getElementById('nav-version');if(version)version.textContent='v2.3';
    }
    function renderToday(){
      const box=document.getElementById('panel-today');if(!box)return;
      const bank=wbGetAll(),buckets=getSrsBuckets(),allEvents=get(keys.activity,{}),week=recentEvents(allEvents,Date.now());
      const dayStart=new Date();dayStart.setHours(0,0,0,0);const done=week.filter(e=>e.at>=dayStart.getTime()).length,goal=Math.max(1,Number(settings().goal)||10);
      const reading=get(keys.reading,{}),docs=readerGetDocs(),lastDoc=docs.slice().sort((a,b)=>(reading[b.id]?.updatedAt||b.at)-(reading[a.id]?.updatedAt||a.at))[0];
      const draft=get(keys.draft,null),recentMode=get(keys.settings,{}).lastMode;
      const primary=buckets.due.length?['開始今日複習','due']:lastDoc?['繼續上次閱讀','resume-doc']:['查一個新單字','goto-search'];
      const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);d.setHours(0,0,0,0);return {at:d.getTime(),label:(d.getMonth()+1)+'/'+d.getDate(),n:week.filter(e=>e.at>=d.getTime()&&e.at<new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime()).length};});const max=Math.max(1,...days.map(d=>d.n));
      const weak=bank.filter(e=>((e.review||{}).right||0)<((e.review||{}).wrong||0)+1).slice(0,5);
      box.innerHTML='<div class="ex-hero"><span class="ex-eyebrow">YOUR DAILY EXPLORATION</span><h2 class="ex-title">今日，學多一點。</h2><p class="ex-lead">由一個單字、一段文章開始。把學過的字，變成你用得到的英文。</p><button type="button" class="we-btn" data-ex="'+primary[1]+'">'+primary[0]+' →</button></div>'+
        '<div class="ex-stats"><div class="ex-stat"><strong>'+buckets.due.length+'</strong><span>到期錯題</span></div><div class="ex-stat"><strong>'+bank.length+'</strong><span>已收錄單字</span></div><div class="ex-stat"><strong>'+done+'</strong><span>今日練習次數</span></div></div>'+
        '<div class="ex-grid">'+card('🎯 今日小目標','<p>已完成 <b>'+done+' / '+goal+'</b> 次練習</p><div class="ex-progress" role="progressbar" aria-label="今日練習目標" aria-valuenow="'+Math.min(done,goal)+'" aria-valuemin="0" aria-valuemax="'+goal+'"><i style="width:'+Math.min(100,done/goal*100)+'%"></i></div><p class="ex-muted">測驗作答、翻卡及口說完成會記錄；由 v2.3 開始統計。</p>'+btn('調整目標','appearance')+btn('用我的單字做測驗','mini-start'))+
        card('↗ 接住上次繼續',
          (lastDoc?'<p><b>'+esc(lastDoc.name)+'</b><br><small>第 '+((reading[lastDoc.id]?.para||0)+1)+' 段 · '+(reading[lastDoc.id]?.notes?Object.keys(reading[lastDoc.id].notes).length:0)+' 則筆記</small></p>'+btn('繼續閱讀','resume-doc'):'<p class="ex-muted">貼上或上傳一篇英文文章，開始你的閱讀紀錄。</p>'+btn('開啟閱讀器','goto-reader'))+
          (recentMode?btn('繼續口說練習','resume-speak'):'')+(draft?.draft?btn('繼續五稜鏡草稿','resume-idea'):''))+'</div>'+
        '<div class="ex-grid" style="margin-top:1rem">'+card('📈 最近七天','<div class="ex-week">'+days.map(d=>'<div class="ex-day"><div class="ex-bars"><i style="--h:'+Math.max(4,d.n/max*70)+'px"></i></div><b>'+d.n+'</b>'+d.label+'</div>').join('')+'</div><p class="ex-muted">練習 '+week.length+' 次 · 新增 '+bank.filter(e=>e.addedAt>Date.now()-7*86400000).length+' 個單字。圖表只包含新版已記錄的練習，並非補估過往數字。</p>')+
        card('🌱 下一步練甚麼',weak.length?'<p>先鞏固呢幾個仲未記牢嘅字：</p><p>'+weak.map(e=>'<button type="button" class="upgrade-tag" data-ex="lookup" data-word="'+esc(e.word)+'">'+esc(e.word)+'</button>').join(' ')+'</p>'+btn('練薄弱字','weak-review'):'<p>先讀一小段文章，收錄想學嘅字，再試用佢造句。</p>'+btn('開始閱讀','goto-reader'))+'</div>'+
        '<section class="ex-card" style="margin-top:1rem"><h3>全部學習單元</h3><div class="ex-links">'+nav.filter(n=>n[0]!=='today').map(n=>'<button type="button" class="ex-link" data-ex-tab="'+n[0]+'">'+n[1]+' '+n[2]+'</button>').join('')+'</div></section><div id="ex-mini-quiz" style="margin-top:1rem"></div>';
      if(miniQuiz)paintMini();
    }
    function renderFlow(){const box=document.getElementById('ex-flow'),f=get(keys.flow,{});if(!box)return;box.hidden=!f.docId||!['lexicon','wordbook','quiz','speak','idea'].includes(state.activeTab);box.className='ex-flow';box.innerHTML='<span>📄 '+esc(f.docName||'閱讀文章')+(f.word?' · '+esc(f.word):'')+'</span>'+btn('返回文章','back-reader')+btn('收藏單字','collect-word')+btn('測驗','mini-start')+btn('口說造句','flow-speak')+btn('五角度構思','flow-idea');}
    switchTab=function(tab){
      if(state.activeTab==='reader')saveReadingPosition();
      if(state.activeTab==='idea')saveDraft(true);
      if(tab==='today'){original.switchTab('lexicon');document.getElementById('panel-lexicon').classList.add('hidden');state.activeTab='today';document.getElementById('panel-today').classList.remove('hidden');history.replaceState(null,'','#today');renderToday();}
      else{document.getElementById('panel-today').classList.add('hidden');original.switchTab(tab);}
      navState();renderFlow();closeNav();
    };
    const hash=()=>{if(location.hash==='#today'&&state.activeTab!=='today')switchTab('today');};root.addEventListener('hashchange',hash);
    gsyncCardHtml=function(){return '<details class="ex-details"><summary>☁️ 備份與資料管理 · '+(gsGet().lastSyncAt?'最近同步 '+fmt(gsGet().lastSyncAt):'尚未有同步紀錄')+'</summary><div>'+original.gsyncCardHtml()+'</div></details>';};
    renderWordbook=function(){original.renderWordbook();document.querySelectorAll('[data-wb-row]').forEach(row=>{const e=row.dataset.wbRow,extra=document.createElement('div');extra.className='ex-context-action';extra.innerHTML='<button type="button" data-ex="lookup" data-word="'+esc(e)+'">完整查字</button><button type="button" data-ex="word-speak" data-word="'+esc(e)+'">用這個字口說造句 →</button>';row.append(extra);});};
    renderSRS=function(){original.renderSRS();const target=[...document.querySelectorAll('#srs-body p')].find(p=>p.textContent.includes('測試與維護工具'));if(target)details(target.closest('.we-card'),'🛠️ 進階與維護工具');};
    function groupSpeak(){
      const home=document.getElementById('speak-home');if(!home)return;
      const modes=[...home.querySelectorAll('[data-sp-mode]')];
      if(modes.length&&!home.querySelector('.ex-modes')){
        const parent=modes[0].parentElement;const groups=[['考試模擬',['mock1','mock2','mock3','full']],['發音與聽力',['shadow','drill','dictation','aiword']],['自由與情境練習',['roleplay','free']]];
        groups.forEach(([title,ids])=>{const section=document.createElement('section');section.className='ex-modes';const heading=document.createElement('h3');heading.textContent=title;section.append(heading);const grid=document.createElement('div');grid.className='ex-mode-grid';section.append(grid);ids.forEach(id=>{const b=modes.find(x=>x.dataset.spMode===id);if(b)grid.append(b);});parent.before(section);});parent.hidden=true;
        const recent=settings().lastMode;if(recent){const p=document.createElement('div');p.className='ex-inline';p.innerHTML=btn('↗ 繼續上次模式','resume-speak');home.prepend(p);}
      }
      const tools=document.getElementById('up-audio-tools');if(tools){details(tools,'🎧 本機錄音工具與評分說明');if(!tools.querySelector('[data-ex="save-audio"]')){const b=document.createElement('div');b.className='ex-inline';b.innerHTML=btn('💾 保存到我的錄音','save-audio',root.WEUpgrade.lastRecording?'':'disabled');tools.append(b);}}
      renderAudioLibrary();
    }
    spRenderHome=function(){original.spRenderHome();groupSpeak();};
    spStage=function(){original.spStage.apply(this,arguments);groupSpeak();renderFlow();};
    spStartMode=function(mode){saveSettings({lastMode:mode});original.spStartMode(mode);};
    spSaveRecord=function(rec){original.spSaveRecord(rec);activity('speaking',rec?.question||'',null);};
    wbAnswer=function(ok){const word=wbState.queue?.[wbState.idx]?.word;original.wbAnswer(ok);if(word)activity('review',word,!!ok);};
    checkQuizAnswer=function(){const session=currentSession(),before=session?.answers?.length||0;original.checkQuizAnswer();if((session?.answers?.length||0)>before){const answer=session.answers.at(-1);activity('quiz',answer.word,answer.correct);}};
    function saveDraft(version){
      const d=ideaState.draft;if(applyingExperience||!d)return;const has=String(d.topic||'').trim()||Object.values(d.lens||{}).some(x=>String(x).trim());
      const at=Date.now();const stored=put(keys.draft,{draft:copy(d),updatedAt:at});
      if(has&&(version||at-lastVersionAt>60000)){const all=get(keys.versions,{}),signature=draftSignature(d),last=Object.values(all).filter(v=>v.draft?.id===d.id).sort((a,b)=>b.at-a.at)[0];if(!last||draftSignature(last.draft)!==signature){const id=at.toString(36)+Math.random().toString(36).slice(2,7);all[id]={id,draft:copy(d),at,updatedAt:at};put(keys.versions,all);}lastVersionAt=at;}
      const status=document.getElementById('ex-draft-status');if(status)status.textContent=stored?'已自動儲存 · '+fmt(at):'儲存失敗，請先匯出備份並檢查裝置空間';updateIdeaProgress();
    }
    function updateIdeaProgress(){const n=completedLenses(ideaState.draft),el=document.getElementById('ex-idea-progress');if(el)el.textContent='已完成 '+n+' / 5 個角度';}
    function improveIdea(){
      const box=document.getElementById('idea-body');if(!box)return;
      box.querySelectorAll('.id-lens').forEach((node,i)=>{if(node.parentElement.classList.contains('ex-lens'))return;const d=document.createElement('details');d.className='ex-lens';d.open=i===0;const h=node.querySelector('h4'),s=document.createElement('summary');s.textContent=h?.textContent?.trim()||'構思角度';node.before(d);d.append(s,node);});
      const grid=box.querySelector('.ex-lens')?.parentElement;if(grid){grid.classList.remove('sm:grid-cols-2');grid.classList.add('ex-lenses');}
      const bar=document.createElement('div');bar.className='ex-sticky-save';bar.innerHTML='<div><strong id="ex-idea-progress"></strong><p id="ex-draft-status">草稿會自動儲存在這台裝置</p></div>'+btn('展開全部','idea-expand')+btn('草稿版本','idea-versions')+btn('儲存至想法庫','idea-save');box.append(bar);updateIdeaProgress();
    }
    renderIdea=function(){original.renderIdea();improveIdea();if(ideaState.draft)saveDraft(false);};
    function showVersions(){saveDraft(true);const list=Object.values(get(keys.versions,{})).sort((a,b)=>b.at-a.at);const d=modal('<h3>草稿版本與前後對照</h3><p class="ex-muted">恢復前會保存目前草稿；原有想法庫不受影響。</p><label>選擇版本<select id="ex-version"><option value="">請選擇</option>'+list.map(v=>'<option value="'+esc(v.id)+'">'+esc(fmt(v.at)+' · '+(v.draft.topic||'未命名').slice(0,45))+'</option>').join('')+'</select></label><div id="ex-version-compare"></div><div class="ex-inline">'+btn('恢復所選版本','restore-version')+'<button class="we-btn we-btn-ghost" data-ex="close-dialog">關閉</button></div>');d.querySelector('select').addEventListener('change',()=>{const v=list.find(x=>x.id===d.querySelector('select').value);if(!v)return;const now=ideaState.draft;d.querySelector('#ex-version-compare').innerHTML='<p><b>目前題目</b><br>'+esc(now?.topic||'')+'</p><p><b>版本題目</b><br>'+esc(v.draft.topic||'')+'</p>'+IDEA_LENSES.map(l=>'<div class="ex-note"><b>'+esc(l.name)+'</b><p>目前：'+esc(now?.lens?.[l.id]||'（空白）')+'</p><p>版本：'+esc(v.draft.lens?.[l.id]||'（空白）')+'</p></div>').join('');});}
    function readingEntry(){return get(keys.reading,{})[readerState.docId]||{para:0,marks:{},notes:{}};}
    function updateReading(patch){if(!readerState.docId)return;const all=get(keys.reading,{});all[readerState.docId]=Object.assign({},readingEntry(),patch,{updatedAt:Date.now()});put(keys.reading,all);}
    function saveReadingPosition(){if(state.activeTab!=='reader'||!readerState.docId)return;const doc=document.getElementById('rd-doc');if(!doc)return;const rect=doc.getBoundingClientRect();const node=document.elementFromPoint(Math.max(10,Math.min(innerWidth-10,rect.left+rect.width/2)),Math.min(innerHeight-100,160));const para=node?.closest?.('.rd-para');if(para)selectedPara=Number(para.dataset.rdP)||0;updateReading({para:selectedPara});}
    function resumeDoc(id){const d=readerGetDocs().find(x=>x.id===id);if(!d){showToast('文件未在這台裝置，請先匯入文件庫。','warn');return;}switchTab('reader');readerOpenSaved(id);}
    function restorePosition(){const saved=readingEntry(),i=Math.min(saved.para||0,Math.max(0,readerState.paras.length-1));selectedPara=i;requestAnimationFrame(()=>document.querySelector('#rd-doc [data-rd-p="'+i+'"]')?.scrollIntoView({block:'start'}));}
    readerOpenSaved=function(id){original.readerOpenSaved(id);restorePosition();};
    readerCloseDoc=function(){saveReadingPosition();original.readerCloseDoc();};
    function readingTools(){
      const box=document.getElementById('reader-body');if(!box)return;
      details(document.getElementById('up-reader-tools'),'📚 文件庫管理、匯入與匯出 · '+readerGetDocs().length+' 個版本');
      if(!readerState.docId||!readerState.text)return;
      const entry=readingEntry(),n=readerState.paras.length;selectedPara=Math.min(selectedPara,Math.max(0,n-1));
      const tools=document.createElement('section');tools.className='ex-card ex-read-tools';tools.innerHTML='<div class="ex-inline"><strong>閱讀進度</strong><span class="ex-muted">'+Math.round((Math.min(entry.para||0,n-1)+1)/Math.max(1,n)*100)+'% · '+n+' 段</span>'+btn('繼續上次位置','read-resume')+'</div><div class="ex-inline"><label>段落 <input id="ex-read-para" type="number" min="1" max="'+n+'" value="'+(selectedPara+1)+'" aria-label="閱讀段落編號"></label>'+btn('前往','read-jump')+btn('標記／取消重點','read-mark')+btn('加閱讀筆記','read-note')+'</div><details><summary>我的句子收藏與閱讀筆記（'+Object.keys(entry.notes||{}).length+'）</summary>'+Object.values(entry.notes||{}).sort((a,b)=>b.at-a.at).map(note=>'<div class="ex-note"><button type="button" data-ex="note-jump" data-para="'+note.para+'">第 '+(note.para+1)+' 段 ↗</button><p>'+esc(note.text)+'</p></div>').join('')+'</details>';box.prepend(tools);
      document.querySelectorAll('#rd-doc .rd-para').forEach(node=>node.classList.toggle('ex-marked',!!entry.marks?.[node.dataset.rdP]?.on));
    }
    readerRender=function(){original.readerRender();readingTools();};
    document.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(saveReadingPosition,650);},{passive:true});
    function captureFlow(target){const word=target.closest('[data-rd-word]');if(!word||!readerState.docId)return;const para=word.closest('[data-rd-p]'),i=Number(para?.dataset.rdP)||0;selectedPara=i;updateReading({para:i});put(keys.flow,{docId:readerState.docId,docName:readerState.name,para:i,word:word.dataset.rdWord,sentence:readerSentenceAt(readerState.paras[i]||'',word.dataset.rdWord),updatedAt:Date.now()});renderFlow();}
    function flowSpeak(word){const f=get(keys.flow,{});const w=word||f.word;if(!w){showToast('先喺文章點一個字，或喺單詞本選字。','info');return;}spStartCustom('Use the word "'+w+'" in your answer. Explain a situation where you would use it.'+(f.sentence?' Context: '+f.sentence:''));}
    function beginMini(){
      const words=wbGetAll().filter(e=>e.meaning);if(words.length<2){switchTab('wordbook');wbStartReview(false);return;}
      const f=get(keys.flow,{}),pool=shuffle(words),first=pool.find(x=>x.word.toLowerCase()===String(f.word||'').toLowerCase());if(first)pool.splice(pool.indexOf(first),1),pool.unshift(first);
      miniQuiz={items:pool.slice(0,5),index:0,right:0,answered:false};switchTab('today');document.getElementById('ex-mini-quiz')?.scrollIntoView({block:'start'});
    }
    function paintMini(){const box=document.getElementById('ex-mini-quiz');if(!box||!miniQuiz)return;const q=miniQuiz.items[miniQuiz.index];if(!q){box.innerHTML=card('✅ 收藏字測驗完成','<p>答對 '+miniQuiz.right+' / '+miniQuiz.items.length+' 題。單字同原本嘅每日測驗進度都保留。</p>'+btn('口說用一用','flow-speak')+btn('返回文章','back-reader')+btn('再練一輪','mini-start'));return;}const other=shuffle(wbGetAll().filter(x=>x.meaning&&x.meaning!==q.meaning)).slice(0,3).map(x=>x.meaning);miniQuiz.options=shuffle([...new Set([q.meaning,...other])]);box.innerHTML=card('📒 用我的單字做測驗','<p class="ex-muted">第 '+(miniQuiz.index+1)+' / '+miniQuiz.items.length+' 題 · 不改動原每日題庫</p><h4 style="font-size:1.6rem;font-weight:800">'+esc(q.word)+'</h4>'+miniQuiz.options.map((o,i)=>'<button type="button" class="ex-quiz-option" data-ex="mini-answer" data-choice="'+i+'">'+esc(o)+'</button>').join('')+'<div id="ex-mini-feedback" role="status"></div>');}
    // 新文字類別加入既有備份；錄音不自動進入 JSON 或 Google 同步。
    [keys.reading,keys.draft,keys.versions,keys.activity].forEach(k=>{if(!GSYNC_KEYS.includes(k))GSYNC_KEYS.push(k);GSYNC_KEYSET[k]=true;});
    gsMergeAll=function(a,b){const out=original.gsMergeAll(a,b),A=a||{},B=b||{};[keys.versions,keys.activity].forEach(k=>{if(A[k]||B[k])out[k]=mergeMaps(A[k],B[k]);});if(A[keys.reading]||B[keys.reading])out[keys.reading]=mergeReading(A[keys.reading],B[keys.reading]);if(A[keys.draft]||B[keys.draft])out[keys.draft]=(Number(A[keys.draft]?.updatedAt)||0)>(Number(B[keys.draft]?.updatedAt)||0)?A[keys.draft]:B[keys.draft];return out;};
    gsApply=function(data){let n;applyingExperience=true;try{n=original.gsApply(data);}finally{applyingExperience=false;}if(data?.[keys.draft]?.draft){ideaState.draft=copy(get(keys.draft).draft);if(state.activeTab==='idea')renderIdea();}if(state.activeTab==='today')renderToday();return n;};
    // 使用者主動保存的聲音使用獨立本機資料庫，無麥克風時仍能使用其他功能。
    const audioDB=new Promise(resolve=>{if(!root.indexedDB){resolve(null);return;}const request=indexedDB.open('word-explorer-recordings',1);request.onupgradeneeded=()=>request.result.createObjectStore('audio',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);request.onblocked=()=>resolve(null);});
    async function audioTransaction(mode,fn){const db=await audioDB;if(!db)throw new Error('此瀏覽器無法永久保存錄音；請使用原有下載錄音。');return new Promise((resolve,reject)=>{const tx=db.transaction('audio',mode);let value;const request=fn(tx.objectStore('audio'));if(request){request.onsuccess=()=>value=request.result;}tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
    async function renderAudioLibrary(){const panel=document.getElementById('panel-speak');if(!panel)return;const seq=++audioRender;let rows;try{rows=(await audioTransaction('readonly',s=>s.getAll())).sort((a,b)=>b.at-a.at);}catch(err){rows=[];}if(seq!==audioRender)return;audioUrls.forEach(u=>URL.revokeObjectURL(u));audioUrls=[];panel.querySelector('#ex-audio-library')?.remove();const section=document.createElement('details');section.id='ex-audio-library';section.className='ex-details';section.innerHTML='<summary>🎙️ 我的錄音（'+rows.length+'）· 本機保存</summary><div><p class="ex-muted">先展開錄音工具錄製，再按「保存到我的錄音」。可用同一題目命名，對照第一次與重練；錄音不包括在學習 JSON／Google 備份。</p>'+rows.map(r=>{const url=URL.createObjectURL(r.blob);audioUrls.push(url);return '<article class="ex-audio-row"><b>'+esc(r.label)+'</b><p class="ex-muted">'+esc(fmt(r.at))+' · '+Math.round(r.blob.size/1024)+' KB</p><audio controls preload="none" src="'+url+'"></audio><a class="ex-muted" href="'+url+'" download="'+esc(r.id)+'.'+(r.type.includes('mp4')?'m4a':r.type.includes('ogg')?'ogg':'webm')+'">下載錄音</a> '+btn('移除此錄音','delete-audio','data-id="'+esc(r.id)+'"')+'</article>';}).join('')+'</div>';panel.append(section);}
    root.addEventListener('we-recorded',()=>{const b=document.querySelector('[data-ex="save-audio"]');if(b)b.disabled=false;});
    document.addEventListener('input',event=>{
      if(event.target.matches('#id-topic,[data-id-lens]')){const s=document.getElementById('ex-draft-status');if(s)s.textContent='儲存中…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveDraft(false),700);updateIdeaProgress();}
    });
    document.addEventListener('click',event=>{captureFlow(event.target);if(event.target.closest('#idea-body [data-id],#idea-body [data-id-load],#idea-body [data-id-topic],#idea-body [data-id-use]')){saveDraft(true);setTimeout(()=>saveDraft(false),0);}},{capture:true});
    document.addEventListener('click',async event=>{
      const tab=event.target.closest('[data-ex-tab]');if(tab){switchTab(tab.dataset.exTab);return;}
      const b=event.target.closest('[data-ex]');if(!b||b.disabled)return;const action=b.dataset.ex;
      if(action==='all')openNav();
      if(action==='appearance'){const s=settings();const d=modal('<h3>閱讀與外觀設定</h3><label>字級（14–22）<input name="font" type="range" min="14" max="22" value="'+(s.font||16)+'"></label><label>行距<input name="line" type="range" min="1.5" max="2.5" step="0.05" value="'+(s.line||1.85)+'"></label><label>外觀<select name="theme"><option value="light">明亮</option><option value="dark">深色</option><option value="system">跟隨系統</option></select></label><label>每日練習目標<input name="goal" type="number" min="1" max="100" value="'+(s.goal||10)+'"></label><p class="ex-muted">只影響這台裝置；設定即時儲存，所有原有單元保留。</p><button class="we-btn" data-ex="close-dialog">完成</button>');d.querySelector('[name=theme]').value=s.theme||'light';d.addEventListener('input',()=>{saveSettings({font:Number(d.querySelector('[name=font]').value),line:Number(d.querySelector('[name=line]').value),theme:d.querySelector('[name=theme]').value,goal:Math.max(1,Math.min(100,Number(d.querySelector('[name=goal]').value)||10))});if(state.activeTab==='today')renderToday();});}
      if(action==='close-dialog')b.closest('dialog')?.close();
      if(action==='goto-search')switchTab('lexicon');if(action==='goto-reader')switchTab('reader');
      if(action==='due'){switchTab('srs');if(getSrsBuckets().due.length)startReviewChallenge();}
      if(action==='weak-review'){switchTab('wordbook');wbStartReview(true);}
      if(action==='resume-doc'){const all=get(keys.reading,{}),d=readerGetDocs().sort((a,b)=>(all[b.id]?.updatedAt||b.at)-(all[a.id]?.updatedAt||a.at))[0];if(d)resumeDoc(d.id);}
      if(action==='resume-speak'){switchTab('speak');spStartMode(settings().lastMode||'shadow');}
      if(action==='resume-idea')switchTab('idea');
      if(action==='lookup'){switchTab('lexicon');document.getElementById('word-input').value=b.dataset.word;handleSearch();}
      if(action==='word-speak')flowSpeak(b.dataset.word);
      if(action==='back-reader'){const f=get(keys.flow,{});if(f.docId)resumeDoc(f.docId);else switchTab('reader');}
      if(action==='collect-word'){const f=get(keys.flow,{});if(f.word){const cached=cacheGet(f.word);wbAdd(f.word,cached||{meaning:zhGet(f.word)||''},'reader');showToast('已收進單詞本，原文位置保留。','info');}}
      if(action==='flow-speak')flowSpeak();
      if(action==='flow-idea'){const f=get(keys.flow,{});ideaFromAnswer('Explain the significance of '+(f.word||'this topic')+'.',f.sentence||'');}
      if(action==='idea-expand')document.querySelectorAll('.ex-lens').forEach(d=>d.open=true);
      if(action==='idea-save'){saveDraft(true);document.querySelector('[data-id="save"]')?.click();}
      if(action==='idea-versions')showVersions();
      if(action==='restore-version'){const dialog=b.closest('dialog'),id=dialog.querySelector('#ex-version').value,v=get(keys.versions,{})[id];if(!v){showToast('請先選擇一個版本。','info');return;}saveDraft(true);ideaState.draft=copy(v.draft);renderIdea();saveDraft(true);dialog.close();}
      if(['read-jump','read-mark','read-note','read-resume','note-jump'].includes(action)){
        const input=document.getElementById('ex-read-para');selectedPara=action==='note-jump'?Number(b.dataset.para):action==='read-resume'?(readingEntry().para||0):Math.max(0,Math.min(readerState.paras.length-1,Number(input?.value||1)-1));
        if(action==='read-mark'){const marks=Object.assign({},readingEntry().marks),key=String(selectedPara);marks[key]={on:!marks[key]?.on,updatedAt:Date.now()};updateReading({marks,para:selectedPara});readerRender();}
        if(action==='read-note'){const d=modal('<h3>第 '+(selectedPara+1)+' 段 · 閱讀筆記</h3><label>收藏句子／重點筆記<textarea id="ex-reading-note"></textarea></label><div class="ex-inline">'+btn('保存筆記','save-reading-note','data-para="'+selectedPara+'"')+'<button class="we-btn we-btn-ghost" data-ex="close-dialog">取消</button></div>');d.querySelector('textarea').value=root.getSelection()?.toString()||'';}
        else{updateReading({para:selectedPara});document.querySelector('#rd-doc [data-rd-p="'+selectedPara+'"]')?.scrollIntoView({block:'start'});}
      }
      if(action==='save-reading-note'){const d=b.closest('dialog'),text=d.querySelector('textarea').value.trim();if(!text)return;const notes=Object.assign({},readingEntry().notes),at=Date.now(),id=at.toString(36)+Math.random().toString(36).slice(2,7);notes[id]={id,para:Number(b.dataset.para)||0,text,at,updatedAt:at};updateReading({notes});d.close();readerRender();}
      if(action==='mini-start')beginMini();
      if(action==='mini-answer'&&miniQuiz&&!miniQuiz.answered){miniQuiz.answered=true;const q=miniQuiz.items[miniQuiz.index],ok=miniQuiz.options[Number(b.dataset.choice)]===q.meaning;if(ok)miniQuiz.right++;else addWrongWord(q.word,{meaning:q.meaning});wbAdd(q.word,{meaning:q.meaning},ok?'quiz_right':'quiz_wrong');activity('collection-quiz',q.word,ok);document.getElementById('ex-mini-feedback').innerHTML='<p>'+(ok?'✅ 答對了':'答案：'+esc(q.meaning))+'</p>'+btn('下一題','mini-next');}
      if(action==='mini-next'&&miniQuiz){miniQuiz.index++;miniQuiz.answered=false;paintMini();}
      if(action==='save-audio'){const recording=root.WEUpgrade.lastRecording;if(!recording){showToast('請先完成一段本機錄音。','info');return;}const d=modal('<h3>保存到我的錄音</h3><label>題目／練習名稱<input id="ex-audio-label" placeholder="例如：環境題 · 第一次"></label><p class="ex-muted">只保存到這台裝置。保留原有下載功能；Google／JSON 備份不包含聲音。</p>'+btn('保存錄音','confirm-audio')+' '+btn('取消','close-dialog'));d.querySelector('input').value=get(keys.flow,{}).word||'';}
      if(action==='confirm-audio'){try{const r=root.WEUpgrade.lastRecording;if(!r)throw new Error('暫存錄音已不存在');const d=b.closest('dialog'),at=Date.now(),row={id:'audio-'+at.toString(36)+Math.random().toString(36).slice(2,6),label:d.querySelector('input').value.trim()||'口說練習',at,type:r.type,blob:r.blob};await audioTransaction('readwrite',s=>s.put(row));activity('saved-audio',row.label,null);d.close();await renderAudioLibrary();document.getElementById('ex-audio-library').open=true;showToast('錄音已保存在這台裝置，可重開後對照播放。','info');}catch(err){showToast(esc(err.message),'warn');}}
      if(action==='delete-audio'){if(await weConfirm('永久移除這一段本機錄音？其他練習紀錄與單字保留。',{danger:true,okText:'移除錄音',cancelText:'保留'})){try{await audioTransaction('readwrite',s=>s.delete(b.dataset.id));renderAudioLibrary();}catch(err){showToast(esc(err.message),'warn');}}}
    });
    root.addEventListener('pagehide',()=>{saveDraft(true);saveReadingPosition();audioUrls.forEach(u=>URL.revokeObjectURL(u));});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){saveDraft(true);saveReadingPosition();}});
    renderShell();applyAppearance();const saved=get(keys.draft,null);if(saved?.draft)ideaState.draft=copy(saved.draft);
    if(!location.hash||location.hash==='#today')switchTab('today');else{const tab=state.activeTab;if(tab==='reader')readerRender();if(tab==='wordbook')renderWordbook();if(tab==='speak')spRenderHome();if(tab==='idea')renderIdea();navState();}
    root.WEUpgrade.documentReady.then(()=>{if(state.activeTab==='today')renderToday();if(state.activeTab==='reader')readingTools();});
    root.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(settings().theme==='system')applyAppearance();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(typeof window==='undefined'?globalThis:window);
