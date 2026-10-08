import type {BrowserCheck,Report} from './audit';
import {requiredBrowserChecks} from './verification';
type Mission={id:string;status:string;report:Report};
// Native validation moves focus: keep those browser interactions sequential,
// while website collection and prototype construction can run in parallel.
let browserQueue:Promise<unknown>=Promise.resolve();
function checkFrame(url:string,viewport:'mobile'|'desktop'){
 const task=browserQueue.then(()=>inspectFrame(url,viewport));browserQueue=task.catch(()=>undefined);return task;
}
async function inspectFrame(url:string,viewport:'mobile'|'desktop'):Promise<{key:string;passed:boolean}[]>{
 const iframe=document.createElement('iframe'),runId=crypto.randomUUID(),previous=document.activeElement;
 iframe.title='Verifica automatica della demo';iframe.setAttribute('sandbox','allow-scripts allow-forms');iframe.setAttribute('aria-hidden','true');iframe.tabIndex=-1;
 Object.assign(iframe.style,{position:'fixed',left:'-100000px',top:'0',width:viewport==='mobile'?'390px':'1280px',height:'900px',border:'0',opacity:'0',pointerEvents:'none'});
 return new Promise(resolve=>{
  let done=false;const finish=(checks:{key:string;passed:boolean}[])=>{if(done)return;done=true;clearTimeout(timeout);window.removeEventListener('message',receive);iframe.remove();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});resolve(checks);};
  const receive=(event:MessageEvent)=>{if(event.source!==iframe.contentWindow)return;if(event.data?.type==='bari-prototype-qa-ready'){iframe.contentWindow?.postMessage({type:'bari-prototype-qa',runId,viewport},'*');return;}if(event.data?.type!=='bari-prototype-qa-result'||event.data.runId!==runId)return;const raw=event.data.checks;if(!Array.isArray(raw)||raw.length>12)return;finish(raw.filter(check=>check&&typeof check.key==='string'&&typeof check.passed==='boolean'));};
  const timeout=setTimeout(()=>finish([]),20000);window.addEventListener('message',receive);iframe.onload=()=>iframe.contentWindow?.postMessage({type:'bari-prototype-qa',runId,viewport},'*');iframe.src=url;document.body.appendChild(iframe);
 });
}
export async function verifyMission<T extends Mission>(mission:T):Promise<T>{
 if(mission.report.verificationVersion!==1||!mission.report.prototypes?.length||mission.status==='completed')return mission;
 const results=[];
 for(const prototype of mission.report.prototypes){
  const url='/api/missions?artifact='+encodeURIComponent(mission.id)+'&prototype='+prototype.id+'&preview=1&qa=1';
  const mobile=await checkFrame(url,'mobile'),desktop=await checkFrame(url,'desktop'),expected=requiredBrowserChecks(mission.report,prototype);
  const checks:BrowserCheck[]=expected.map(key=>({key,title:key,passed:key==='mobile-layout'?mobile.find(q=>q.key===key)?.passed===true:key==='desktop-layout'?desktop.find(q=>q.key===key)?.passed===true:mobile.find(q=>q.key===key)?.passed===true&&desktop.find(q=>q.key===key)?.passed===true}));results.push({prototypeId:prototype.id,checks});
 }
 const response=await fetch('/api/missions/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({missionId:mission.id,revision:mission.report.verificationRevision,results})});const result=await response.json() as T&{error?:string};if(!response.ok)throw Error(result.error||'Verifica non salvata. Puoi riprovarla dalla missione.');if(result.status==='review'&&result.report.repairAttempts===1&&result.report.verificationRevision!==mission.report.verificationRevision)return verifyMission(result);return result;
}
