/* v2.7: pure dictionary / curriculum helpers and an explicit-end speech session. */
(function(root){
'use strict';
function key(s){return String(s||'').trim().toLowerCase();}
function dictionaryDefinitions(entries){const out=[],seen=new Set();for(const entry of Array.isArray(entries)?entries:[]){for(const m of entry.meanings||[]){for(const d of m.definitions||[]){const en=String(d.definition||'').trim(),pos=String(m.partOfSpeech||'other').trim(),id=key(pos)+'|'+key(en);if(!en||seen.has(id))continue;seen.add(id);out.push({pos,en,example:String(d.example||'').trim(),source:'Free Dictionary API / Wiktionary'});}}}return out;}
function groupDefinitions(defs){const groups=new Map();for(const d of defs||[]){if(!d?.en)continue;const pos=d.pos||'other';if(!groups.has(pos))groups.set(pos,[]);groups.get(pos).push(d);}return [...groups].map(([pos,defs])=>({pos,defs}));}
function spellingDefinition(word,defs){const w=key(word).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),leaks=new RegExp('\\b'+w+'(?:s|es|ed|ing)?\\b','i');return (defs||[]).map(d=>typeof d==='string'?d:d?.en||'').filter(en=>en&&/[a-z]/i.test(en)&&!/[\u3400-\u9fff]/.test(en)&&!leaks.test(en)).slice(0,2).join(' / ');}
function tierPool(all,rows,level){const groups={easy:new Set(),medium:new Set(),hard:new Set()};for(const r of rows||[])if(groups[r.level])groups[r.level].add(key(r.word));const unique=[...new Set((all||[]).map(key).filter(Boolean))];if(level==='legacy')return unique;return unique.filter(w=>level==='easy'?groups.easy.has(w):level==='hard'?groups.hard.has(w):!groups.easy.has(w)&&!groups.hard.has(w));}
function createSpeechSession(o,env){
 const Ctor=env.Recognition;if(!Ctor){o.onError?.('unsupported','');return null;}
 let recognizer=null,generation=0,closed=false,requested=false,suspended=false,retries=0,restartTimer=null,endTimer=null,committed='',segmentFinal='',segmentInterim='',audio=null;
 const set=env.setTimeout||setTimeout,clear=env.clearTimeout||clearTimeout;
 function join(a,b){return [a,b].filter(Boolean).join(' ').trim();}
 const text=()=>join(committed,join(segmentFinal,segmentInterim));
 function commit(){committed=text();segmentFinal='';segmentInterim='';}
 function timers(){if(restartTimer!==null)clear(restartTimer);if(endTimer!==null)clear(endTimer);restartTimer=endTimer=null;}
 function complete(reason){if(closed)return;closed=true;timers();commit();audio?.stop?.();o.onEnd?.(committed,{reason});}
 function interrupt(reason){if(closed||requested)return;suspended=true;timers();commit();try{recognizer?.abort();}catch{}recognizer=null;audio?.pause?.();o.onInterrupted?.(committed,reason);}
 function start(){if(closed||suspended||requested)return;let r;try{r=new Ctor();}catch{closed=true;audio?.stop?.();o.onError?.('init-failed',text());return;}
  const id=++generation;recognizer=r;r.lang=o.lang||'en-US';r.continuous=!!o.continuous;r.interimResults=true;r.maxAlternatives=1;
  r.onresult=ev=>{if(closed||suspended||id!==generation)return;let fin='',interim='';for(const result of Array.from(ev.results||[])){const t=String(result?.[0]?.transcript||'').trim();if(result.isFinal)fin=join(fin,t);else interim=join(interim,t);}segmentFinal=fin;segmentInterim=interim;o.onInterim?.(text());};
  r.onerror=ev=>{if(closed||suspended||id!==generation)return;const code=ev?.error||'error';if(code==='no-speech'&&o.continuous)return;if(code==='network'){interrupt(code);return;}const partial=text();closed=true;timers();try{r.abort();}catch{}audio?.stop?.();o.onError?.(code,partial);};
  r.onend=()=>{if(closed||suspended||id!==generation)return;recognizer=null;if(requested){complete('manual');return;}if(!o.continuous){complete('service-end');return;}commit();if(retries++<3){restartTimer=set(()=>{restartTimer=null;start();},250);}else interrupt('repeated-end');};
  try{r.start();}catch{interrupt('start-failed');}
 }
 const api={stop(){if(closed||requested)return;requested=true;suspended=false;timers();if(recognizer){try{recognizer.stop();}catch{complete('manual');}if(!closed)endTimer=set(()=>complete('manual'),1000);}else complete('manual');},abort(){if(closed)return;closed=true;timers();commit();try{recognizer?.abort();}catch{}audio?.stop?.();},resume(){if(closed||requested||!suspended)return false;suspended=false;retries=0;audio?.resume?.();start();return true;},interrupt,getText:text,isClosed:()=>closed};
 start();if(!closed&&o.captureAudio&&env.captureAudio){audio=env.captureAudio();if(closed)audio?.stop?.();}
 return api;
}
// Sound capture is independent of recognition restarts and is never uploaded here.
function captureLocalAudio(env,onBlob,onError){let stream=null,recorder=null,stopped=false,paused=false;const chunks=[],started=Date.now();
 const stop=()=>{stopped=true;try{if(recorder&&recorder.state!=='inactive')recorder.stop();}catch{}stream?.getTracks().forEach(t=>t.stop());};
 if(!env.mediaDevices?.getUserMedia||!env.MediaRecorder){onError?.('此瀏覽器未提供聲音錄製；文字辨識仍可使用。');return {stop};}
 env.mediaDevices.getUserMedia({audio:true}).then(s=>{if(stopped){s.getTracks().forEach(t=>t.stop());return;}stream=s;const supported=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>env.MediaRecorder.isTypeSupported?.(type));recorder=supported?new env.MediaRecorder(s,{mimeType:supported}):new env.MediaRecorder(s);recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};recorder.onstop=()=>{s.getTracks().forEach(t=>t.stop());if(chunks.length)onBlob({blob:new Blob(chunks,{type:recorder.mimeType||'audio/webm'}),type:recorder.mimeType||'audio/webm',at:Date.now(),duration:(Date.now()-started)/1000});};recorder.onerror=()=>{onError?.('聲音錄製中斷；已收到的片段會保留。');stop();};recorder.start(1000);if(paused&&recorder.state==='recording')recorder.pause();}).catch(err=>{stream?.getTracks().forEach(t=>t.stop());onError?.('未能保存聲音：'+(err.name||'error')+'；不會自動送出回答。');});
 return {stop,pause(){paused=true;try{if(recorder?.state==='recording')recorder.pause();}catch{}},resume(){paused=false;try{if(recorder?.state==='paused')recorder.resume();}catch{onError?.('聲音錄製未能繼續，請保留片段後重新錄製。');}}};
}
const api={dictionaryDefinitions,groupDefinitions,spellingDefinition,tierPool,createSpeechSession,captureLocalAudio};root.WEPractice=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
