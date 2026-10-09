export type Business={id:string;name:string;category:string;lat:number|null;lon:number|null;address:string;website:string;source:string;sourceUrl:string;sourceDate:string;type:string;openingHours?:string;cin?:string;locationNote?:string};
export type Finding={title:string;state:'presente'|'non rilevato'|'da confermare';detail:string;url:string;evidence?:{url:string;excerpt:string}[]};
export type AuditedPage={url:string;title:string;state:'read'|'partial'|'failed';excerpt:string};
export type AgentBrief={kind:PrototypeKind;title:string;reason:string;pageUrls:string[];headline:string;headlineEn:string;intro:string;introEn:string;features:string[]};
export type AgentAnalysis={status:'ready'|'not_configured'|'unavailable'|'no_opportunity';model?:string;summary:string;briefs:AgentBrief[];checkedAt:string};
export type BrowserCheck={key:string;title:string;passed:boolean};
export type BrowserVerification={version:1;engine:'browser';checkedAt:string;checks:BrowserCheck[]};
export type PrototypeKind='website'|'request'|'bilingual'|'contacts';
export type Prototype={id:PrototypeKind;kind:PrototypeKind;title:string;reason:string;needsConfirmation:boolean;qa:{title:string;passed:boolean}[];html?:string;brief?:AgentBrief;browser?:BrowserVerification};
export type Report={business:Business;findings:Finding[];fetched:boolean;checkedAt:string;note:string;proposal:{title:string;description:string;kind?:string;trigger?:string};qa?:{title:string;passed:boolean}[];prototypes?:Prototype[];crawl?:{pages:AuditedPage[];limit:number;coverage:'sampled'|'partial'|'unavailable'};agents?:AgentAnalysis;verificationVersion?:1;verificationRevision?:string;repairAttempts?:number};
export function publicUrl(raw:string){try{const u=new URL(raw);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||!u.hostname.includes('.')||/^[\d.]+$/.test(u.hostname)||u.hostname.includes(':')||/(^|\.)(localhost|local|internal|test|invalid|arpa|lan|home|corp|onion)$/.test(u.hostname)||!/\.(?:[a-z]{2,}|xn--[a-z0-9-]+)\.?$/.test(u.hostname))return null;return u;}catch{return null;}}
async function boundedPage(raw:string,signal?:AbortSignal,origin?:string){
 let u=publicUrl(raw);if(!u)throw new Error('Indirizzo non utilizzabile');
 for(let i=0;i<3;i++){
  if(origin&&u.origin!==origin)throw new Error('Pagina esterna al sito');
  const res=await fetch(u.href,{redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(7000)]):AbortSignal.timeout(7000),headers:{'User-Agent':'BariAgentCity/2.0 public website review','Accept':'text/html'}});
  if(res.status>=300&&res.status<400){const next=publicUrl(new URL(res.headers.get('location')||'',u).href);if(!next||(origin&&next.origin!==origin))throw new Error('Reindirizzamento non utilizzabile');u=next;continue;}
  if(!res.ok||!/^text\/html(?:\s*;|\s*$)/i.test(res.headers.get('content-type')||''))throw new Error('Pagina non disponibile');
  const reader=res.body?.getReader();let html='',bytes=0,truncated=false;const decoder=new TextDecoder();
  if(reader)while(true){
   const p=await reader.read();if(p.done)break;
   const remaining=250000-bytes;const prefix=p.value.subarray(0,remaining);
   html+=decoder.decode(prefix,{stream:true});bytes+=prefix.length;
   if(p.value.length>remaining){truncated=true;await reader.cancel();break;}
  }
  html+=decoder.decode();return {html,url:u.href,truncated};
 }
 throw new Error('Troppi reindirizzamenti');
}
export function pageEvidence(html:string){
 // Ignore code, hidden templates and comments; retain visible text and actual links/language attributes.
 const clean=html.replace(/<!--[\s\S]*?(?:-->|$)/g,' ').replace(/<(script|style|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,' ');
 const attributes=[...clean.matchAll(/\b(href|lang|hreflang)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(m=>`${m[1]}="${m[2]??m[3]??m[4]}"`).join(' ');
 return clean.replace(/<[^>]*(?:>|$)/g,' ')+' '+attributes;
}
function cleanText(html:string){return pageEvidence(html).replace(/\s+/g,' ').trim();}
const linkPattern=/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a\s*>/gi;
export function relevantLinks(html:string,base:string):string[]{
 const origin=new URL(base).origin;const found=new Map<string,number>();
 const clean=html.replace(/<!--[\s\S]*?(?:-->|$)/g,' ').replace(/<(script|style|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,' ');
 for(const match of clean.matchAll(linkPattern)){
  const raw=(match[1]??match[2]??match[3]).replace(/&amp;/gi,'&');let url:URL;
  try{const candidate=publicUrl(new URL(raw,base).href);if(!candidate||candidate.origin!==origin)continue;url=candidate;}catch{continue;}
  if(/\.(?:pdf|jpg|jpeg|png|webp|gif|svg|zip|css|js|xml)$/i.test(url.pathname)||/\/(?:logout|signout|login|admin|wp-admin|cart|checkout|delete|unsubscribe)(?:\/|$)/i.test(url.pathname)||/privacy|cookie|terms|condizioni/i.test(url.pathname))continue;
  if([...url.searchParams.keys()].some(key=>!['lang','language','locale'].includes(key)))continue;
  url.hash='';if(url.href===new URL(base).href.split('#')[0])continue;
  const label=cleanText(match[4]);const reference=url.pathname+' '+url.search+' '+label;
  const score=/contatt|contact|prenot|book|reserv/i.test(reference)?3:/servizi|services|menu|camere|rooms|offerta|about|chi.siamo|english|lingu|\/en(?:\/|$)|lang=en/i.test(reference)?2:0;
  if(score)found.set(url.href,Math.max(score,found.get(url.href)||0));
 }
 return [...found].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([url])=>url);
}

export async function auditBusiness(b:Business):Promise<Report>{
 const findings:Finding[]=[{title:'Identità e attività',state:'presente',detail:`${b.type} · ${b.address||'Indirizzo non indicato nella fonte'}`,url:b.sourceUrl}];
 const pages:AuditedPage[]=[],evidencePages:{url:string;text:string}[]=[];const limit=6;const deadline=AbortSignal.timeout(24000);let fetched=false,partial=false,checkedUrl=b.website;
 let note='Analisi preliminare delle fonti pubbliche. Il bisogno commerciale richiede conferma del titolare.';
 if(b.website){
  try{
   const home=await boundedPage(b.website,deadline);checkedUrl=home.url;fetched=true;
   const visited=new Set([home.url,b.website]);let queue=relevantLinks(home.html,home.url);
   const keep=(page:{html:string;url:string;truncated:boolean})=>{const text=cleanText(page.html);const title=cleanText(page.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'Pagina del sito').slice(0,160);pages.push({url:page.url,title,state:page.truncated?'partial':'read',excerpt:text.slice(0,2000)});evidencePages.push({url:page.url,text});if(page.truncated)partial=true;};
   keep(home);
   while(queue.length&&pages.length<limit&&!deadline.aborted){
    const next=queue.filter(url=>!visited.has(url)).slice(0,Math.min(2,limit-pages.length));if(!next.length)break;
    next.forEach(url=>visited.add(url));queue=queue.filter(url=>!visited.has(url));
    const settled=await Promise.allSettled(next.map(url=>boundedPage(url,deadline,new URL(home.url).origin)));
    settled.forEach((result,index)=>{if(result.status==='fulfilled'){const page=result.value;if(visited.has(page.url)&&page.url!==next[index])return;visited.add(page.url);keep(page);queue.push(...relevantLinks(page.html,page.url).filter(url=>!visited.has(url)));}else{pages.push({url:next[index],title:'Pagina non disponibile',state:'failed',excerpt:''});partial=true;}});
    queue=[...new Set(queue)];
   }
   if(deadline.aborted&&queue.length)partial=true;
   note+=` Controllate ${evidencePages.length} pagine pubbliche (massimo ${limit}), selezionate per servizi, contatti, richieste e lingue. È un campione: pagine interne non collegate e funzioni caricate soltanto via JavaScript possono sfuggire.`;
   if(partial)note+=' Il sito è stato letto solo in parte: pagine irraggiungibili o oltre il limite di 250 KB. Le funzioni non individuate restano da confermare.';
  }catch{pages.push({url:b.website,title:'Sito non disponibile',state:'failed',excerpt:''});note+=' Il sito non è stato raggiunto: nessuna conclusione sulle sue funzioni.';}
 }
 findings.push({title:'Sito web nella fonte',state:b.website?'presente':'non rilevato',detail:b.website?'Indirizzo pubblicato nella fonte.':'Il campo non è compilato: non significa che l’azienda non abbia un sito.',url:b.website||b.sourceUrl});
 const checks=[['Richiesta o prenotazione online',/\b(?:book(?:ing)?|prenot(?:a|are|azione|azioni)|octorate|reserv(?:e|ation|ations)|whatsapp)\b/i],['Informazioni in più lingue',/\bhreflang\s*=|\blang=["']en(?:[-"'])|\/en(?:\/|["'])|\b(?:english|deutsch)\b/i],['Orari o informazioni di contatto',/\b(?:orari(?:o)?|opening|contatt(?:i|o|a|aci)|contacts?)\b|(?:tel|mailto):/i]] as const;
 for(const [title,re]of checks){
  const matches=evidencePages.filter(page=>re.test(page.text));const present=matches.length>0;
  const evidence=matches.slice(0,2).map(page=>{const index=page.text.search(re);return {url:page.url,excerpt:page.text.slice(Math.max(0,index-60),index+180)};});
  findings.push({title,state:present?'presente':fetched&&!partial?'non rilevato':'da confermare',detail:present?'Indizio trovato nelle pagine controllate, con fonte collegata.':partial?'Il sito è stato letto solo in parte: nessuna conclusione sull’assenza di questa funzione.':fetched?'Non individuato nelle pagine controllate; potrebbe essere altrove.':'Servono una pagina accessibile o informazioni del titolare.',url:evidence[0]?.url||checkedUrl||b.sourceUrl,evidence});
 }
 const [booking,languages,contact]=findings.slice(2);const kind=!fetched||partial?'profile':booking.state==='non rilevato'?'request':languages.state==='non rilevato'?'bilingual':contact.state==='non rilevato'?'contacts':'feedback';
 const title=kind==='profile'?'Demo scheda dei servizi':kind==='bilingual'?'Demo di accoglienza bilingue':kind==='contacts'?'Demo informazioni e contatti':kind==='feedback'?'Demo di raccolta feedback':['Hotel','B&B e case vacanza'].includes(b.category)?'Demo di richiesta soggiorno':['Ristoranti','Bar e caffè'].includes(b.category)?'Demo di richiesta tavolo':'Demo di richiesta preventivo';
 const trigger=kind==='profile'?'Dati insufficienti per individuare una carenza: prima raccogliere le informazioni dal titolare.':kind==='request'?booking.title+' non rilevata nelle pagine controllate.':kind==='bilingual'?languages.title+' non rilevate nelle pagine controllate.':kind==='contacts'?contact.title+' non rilevati nelle pagine controllate.':'Le funzioni cercate risultano presenti. Proposta esplorativa per raccogliere feedback dei clienti, senza una carenza accertata.';
 return {business:b,findings,fetched,checkedAt:new Date().toISOString(),note,proposal:{title,kind,trigger,description:trigger+' È un’ipotesi da validare con l’azienda prima di sviluppare un prodotto commerciale.'},crawl:{pages,limit,coverage:!fetched?'unavailable':partial?'partial':'sampled'}};
}
export function demoHtml(r:Report){
 const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const messageLabel=r.proposal.kind==='feedback'?'Come possiamo migliorare il servizio?':r.proposal.kind==='profile'?'Quali servizi vuoi presentare?':'La tua richiesta';
 const bilingual=r.proposal.kind==='bilingual';
 const languageScript=bilingual?`let english=false;const translations={it:{prototype:'PROTOTIPO DIMOSTRATIVO · BARI AGENT CITY',title:'Demo di accoglienza bilingue',name:'Il tuo nome',message:'La tua richiesta',button:'Prova la richiesta',source:'Fonte pubblica dell’attività',initial:'Demo locale: i dati non vengono inviati o salvati. Nessuna affiliazione dichiarata con l’azienda.',completed:'Richiesta di prova completata. Questo esempio non invia dati all’azienda.'},en:{prototype:'DEMONSTRATION PROTOTYPE · BARI AGENT CITY',title:'Bilingual welcome demo',name:'Your name',message:'Your request',button:'Try the request',source:'Public source for this business',initial:'Local demo: information is neither sent nor saved. No affiliation with the business is claimed.',completed:'Test request completed. This example does not send information to the business.'}};function updateLanguage(){const text=translations[english?'en':'it'];document.documentElement.lang=english?'en':'it';document.getElementById('prototype').textContent=text.prototype;document.getElementById('demo-title').textContent=text.title;document.querySelector('label[for=name]').textContent=text.name;document.querySelector('label[for=message]').textContent=text.message;document.querySelector('#request button').textContent=text.button;document.getElementById('source').textContent=text.source;document.getElementById('result').textContent=submitted?text.completed:text.initial;document.getElementById('language').textContent=english?'Italiano':'English';document.title=text.title+' — '+document.querySelector('h1').textContent;}document.getElementById('language').addEventListener('click',()=>{english=!english;updateLanguage();});`:'';
 return `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(r.proposal.title)} — ${escape(r.business.name)}</title><style>body{margin:0;background:#f4f2ea;color:#152e38;font:17px system-ui}main{box-sizing:border-box;width:calc(100% - 24px);max-width:640px;margin:8vh auto;padding:clamp(20px,5vw,36px);background:white;border-radius:24px}small{color:#55726d}h1{font-size:clamp(26px,7vw,38px);overflow-wrap:anywhere}label{display:block;margin:18px 0 8px}input,textarea,button{font:inherit;box-sizing:border-box;width:100%;padding:14px;border:1px solid #bbc7c4;border-radius:8px}button{background:#12665b;color:white;cursor:pointer;margin-top:20px}aside{padding:16px;background:#f4f2ea;border-radius:12px;margin-top:24px}</style><main><small id="prototype">PROTOTIPO DIMOSTRATIVO · BARI AGENT CITY</small><h1>${escape(r.business.name)}</h1>${bilingual?'<button type="button" id="language">English</button>':''}<p id="demo-title">${escape(r.proposal.title)}</p><form id="request"><label for="name">Il tuo nome</label><input id="name" required autocomplete="name"><label for="email">Email</label><input id="email" type="email" required autocomplete="email"><label for="message">${escape(messageLabel)}</label><textarea id="message" required rows="4"></textarea><button>Prova la richiesta</button></form><aside id="result" role="status">Demo locale: i dati non vengono inviati o salvati. Nessuna affiliazione dichiarata con l’azienda.</aside><p><a id="source" href="${escape(r.business.sourceUrl)}">Fonte pubblica dell’attività</a></p></main><script>let submitted=false;document.getElementById('request').addEventListener('submit',function(e){e.preventDefault();submitted=true;${bilingual?'updateLanguage();':"document.getElementById('result').textContent='Richiesta di prova completata. Questo esempio non invia dati all’azienda.';"}});${languageScript}</script></html>`;
}
