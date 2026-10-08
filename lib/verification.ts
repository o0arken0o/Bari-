import type {BrowserCheck,BrowserVerification,Prototype,Report} from './audit';
export const checkTitles:Record<string,string>={'mobile-layout':'Layout su telefono (390 px)','desktop-layout':'Layout su computer (1280 px)',labels:'Campi con etichette associate','email-validation':'Email non valida rifiutata','local-submit':'Richiesta simulata senza operazioni di rete','local-reset':'Demo ripristinata dopo la prova',anchors:'Collegamenti interni validi','console-errors':'Nessun errore JavaScript durante le prove','stay-dates':'Partenza precedente all’arrivo rifiutata',english:'Testi e modulo in inglese',italian:'Ritorno dei testi in italiano'};
export function requiredBrowserChecks(report:Report,prototype:Prototype):string[]{
 const keys=['mobile-layout','desktop-layout','labels','email-validation','local-submit','local-reset','anchors','console-errors'];
 if(prototype.kind==='request'&&['Hotel','B&B e case vacanza'].includes(report.business.category))keys.push('stay-dates');
 if(prototype.kind==='bilingual')keys.push('english','italian');return keys;
}
export function validateBrowserResults(value:unknown,report:Report):Map<string,BrowserVerification>|null{
 if(!Array.isArray(value)||value.length!==(report.prototypes?.length||0)||value.length===0||value.length>4)return null;
 const verified=new Map<string,BrowserVerification>();
 for(const item of value){
  if(!item||typeof item!=='object'||Array.isArray(item))return null;
  const prototype=report.prototypes?.find(p=>p.id===item.prototypeId);if(!prototype||verified.has(item.prototypeId)||!Array.isArray(item.checks))return null;
  const expected=requiredBrowserChecks(report,prototype);if(item.checks.length!==expected.length)return null;const seen=new Set();const checks:BrowserCheck[]=[];
  for(const check of item.checks){if(!check||typeof check!=='object'||!expected.includes(check.key)||seen.has(check.key)||typeof check.passed!=='boolean')return null;seen.add(check.key);checks.push({key:check.key,title:checkTitles[check.key],passed:check.passed});}
  verified.set(prototype.id,{version:1,engine:'browser',checkedAt:new Date().toISOString(),checks});
 }
 return verified;
}
export function verifiedReport(report:Report){return report.prototypes?.every(p=>p.qa.every(q=>q.passed)&&p.browser?.checks.every(q=>q.passed)&&p.browser.checks.length===requiredBrowserChecks(report,p).length)??false;}
export function repairPrototypeLayouts(report:Report):Report{
 if((report.repairAttempts||0)>=1)return report;let changed=false;
 const css='<style data-bari-layout-repair>*{min-width:0!important;box-sizing:border-box!important}html,body{width:100%!important;max-width:100%!important}main,header,footer,section,form{max-width:100%!important}h1,h2,p,.wordmark{overflow-wrap:anywhere!important;white-space:normal!important}input,textarea{max-width:100%!important}.hero,.layout,.pair{grid-template-columns:minmax(0,1fr)!important}</style>';
 const prototypes=report.prototypes?.map(p=>{const failed=p.browser?.checks.filter(q=>!q.passed)||[];if(!failed.length||failed.some(q=>!['mobile-layout','desktop-layout'].includes(q.key))||!p.html?.includes('</head>'))return p;changed=true;return {...p,html:p.html.replace('</head>',css+'</head>')};});
 return changed?{...report,prototypes,repairAttempts:1,verificationRevision:crypto.randomUUID()}:report;
}

// Inert until the containing window requests checks in the user's real browser.
export const verificationScript=String.raw`
(()=>{const errors=[],runs=new Set();window.addEventListener('error',()=>errors.push('error'));window.addEventListener('unhandledrejection',()=>errors.push('rejection'));document.addEventListener('DOMContentLoaded',()=>window.parent.postMessage({type:'bari-prototype-qa-ready'},'*'));
window.addEventListener('message',event=>{if(event.source!==window.parent||event.data?.type!=='bari-prototype-qa'||typeof event.data.runId!=='string'||runs.has(event.data.runId))return;runs.add(event.data.runId);
const checks=[];const add=(key,passed)=>checks.push({key,passed:Boolean(passed)});let network=0;const originalFetch=window.fetch,originalOpen=XMLHttpRequest.prototype.open;window.fetch=()=>{network++;return Promise.reject(Error('Simulazione locale'));};XMLHttpRequest.prototype.open=function(){network++;throw Error('Simulazione locale');};
try{const form=document.getElementById('request'),result=document.getElementById('result'),email=document.getElementById('email');if(!form||!result||!email)throw Error('Modulo assente');const initial=result.textContent;const fields=[...form.querySelectorAll('input,textarea')];
add(event.data.viewport==='mobile'?'mobile-layout':'desktop-layout',document.documentElement.scrollWidth<=innerWidth+1&&fields.every(field=>{const r=field.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;}));
add('labels',fields.every(field=>field.id&&document.querySelector('label[for="'+field.id+'"]')));
const fill=(id,value)=>{const field=document.getElementById(id);if(field){field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));}};
fill('name','Prova locale');fill('message','Richiesta dimostrativa');fill('email','invalid');fill('arrival','2030-12-10');fill('departure','2030-12-12');fill('date','2030-12-10');fill('time','12:00');fill('guests','2');form.requestSubmit();add('email-validation',email.validity.typeMismatch&&result.textContent===initial);fill('email','qa@example.test');
if(document.getElementById('departure')){fill('departure','2030-12-09');form.requestSubmit();add('stay-dates',!form.checkValidity()&&result.textContent===initial);fill('departure','2030-12-12');}
let prevented=false;const observe=event=>{prevented=event.defaultPrevented;};form.addEventListener('submit',observe);form.requestSubmit();form.removeEventListener('submit',observe);add('local-submit',prevented&&result.textContent!==initial&&network===0);
const toggle=document.getElementById('language');if(toggle){toggle.click();add('english',document.documentElement.lang==='en'&&document.querySelector('label[for="name"]').textContent==='Your name'&&document.querySelector('footer').textContent.includes('No affiliation'));toggle.click();add('italian',document.documentElement.lang==='it'&&document.querySelector('label[for="name"]').textContent==='Il tuo nome');}
add('anchors',[...document.querySelectorAll('a[href^="#"]')].every(link=>document.getElementById(link.getAttribute('href').slice(1))));form.reset();fields.forEach(field=>field.dispatchEvent(new Event('input',{bubbles:true})));result.textContent=initial;add('local-reset',document.getElementById('name').value===''&&email.value===''&&result.textContent===initial);add('console-errors',errors.length===0);
}catch{add('console-errors',false);}finally{window.fetch=originalFetch;XMLHttpRequest.prototype.open=originalOpen;window.parent.postMessage({type:'bari-prototype-qa-result',runId:event.data.runId,checks},'*');}});})();`;
