import { env } from 'cloudflare:workers';
import { commercialDraft, commercialText } from '@/lib/commercial';
import catalogText from '@/data/catalog.json?raw';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { missionDb } from '@/lib/missions';
import { auditBusiness, demoHtml, type Business, type Report } from '@/lib/audit';
import { buildPrototypes, publicReport, hasPrototype } from '@/lib/prototypes';
import {analyseWithAgents,agentConfigured,type AgentConfig} from '@/lib/agent-analysis';
const catalog=JSON.parse(catalogText) as Business[];
export const dynamic='force-dynamic';
const sender=()=>((env as unknown as {SALES_SENDER_EMAIL?:string}).SALES_SENDER_EMAIL||process.env.SALES_SENDER_EMAIL||'');
const agentConfig=():AgentConfig=>{const runtime=env as unknown as {OPENAI_API_KEY?:string;OPENAI_MODEL?:string};return {apiKey:runtime.OPENAI_API_KEY||process.env.OPENAI_API_KEY,model:runtime.OPENAI_MODEL||process.env.OPENAI_MODEL};};

export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Accedi per usare il laboratorio.'},{status:401});
 try{
  const params=new URL(request.url).searchParams;const artifact=params.get('artifact');
  if(artifact){
   const row=await missionDb().prepare('SELECT report,status FROM missions WHERE id=? AND owner=?').bind(artifact,user.userId).first<{report:string;status:string}>();
   if(!row)return Response.json({error:'Demo non disponibile'},{status:404});
   const report=JSON.parse(row.report) as Report;
   const qaPreview=row.status==='review'&&report.verificationVersion===1&&params.get('preview')==='1'&&params.get('qa')==='1'&&params.get('format')!=='proposal'&&report.prototypes?.every(p=>p.qa.every(q=>q.passed));
   if(row.status!=='completed'&&!qaPreview)return Response.json({error:'Demo non disponibile'},{status:404});
   if(!hasPrototype(report))return Response.json({error:'Questa analisi non ha individuato un prototipo da costruire.'},{status:404});
   if(params.get('format')==='proposal')return new Response(commercialText(report,sender()),{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="bari-proposta.txt"','Cache-Control':'no-store'}});
   const prototypeId=params.get('prototype');const prototype=report.prototypes?.find(p=>p.id===(prototypeId||report.prototypes?.[0]?.id));
   if((report.prototypes&&!prototype)||(prototypeId&&!prototype))return Response.json({error:'Prototipo non trovato.'},{status:404});
   const html=prototype?prototype.html:demoHtml(report);if(!html)return Response.json({error:'Documento non disponibile.'},{status:404});
   return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':`${params.get('preview')==='1'?'inline':'attachment'}; filename="bari-${prototype?.id||'demo'}.html"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-forms"}});
  }
  const rows=await missionDb().prepare("SELECT * FROM missions WHERE owner=? AND status<>'pending' ORDER BY created_at DESC LIMIT 30").bind(user.userId).all();
  return Response.json({sender:sender(),sendingConfigured:false,aiConfigured:agentConfigured(agentConfig()),missions:rows.results.map(row=>{const report=JSON.parse(row.report as string) as Report;return {...row,report:publicReport(report),commercial:row.status==='completed'&&hasPrototype(report)?commercialDraft(report,sender()):undefined};})},{headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error('missions read',error);return Response.json({error:'Archivio non disponibile. Riprova tra poco.'},{status:503});}
}

export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Accedi per avviare una missione.'},{status:401});
 let body:unknown;
 try{body=await request.json();}catch{return Response.json({error:'Invia una richiesta JSON valida.'},{status:400});}
 if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Indica una sola attività o missione.'},{status:400});
 const keys=Object.keys(body);const action=keys[0];const value=(body as Record<string,unknown>)[action];
 if(keys.length!==1||!['businessId','approveId'].includes(action)||typeof value!=='string'||!value.trim()||value.length>256)return Response.json({error:'Indica un solo businessId o approveId valido.'},{status:400});
 let reservedId:string|undefined;
 try{
  const db=missionDb();
  if(action==='approveId'){
   const row=await db.prepare('SELECT * FROM missions WHERE id=? AND owner=?').bind(value,user.userId).first<{id:string;report:string;status:string}>();
   if(!row)return Response.json({error:'Missione non trovata'},{status:404});
   if(row.status!=='review'&&row.status!=='completed')return Response.json({error:'L’analisi è ancora in corso. Attendi il documento da verificare.'},{status:409});
   let report=JSON.parse(row.report) as Report;
   if(report.prototypes!==undefined){report=buildPrototypes(report);}else{const html=demoHtml(report);report.qa=[{title:'Documento HTML generato',passed:html.startsWith('<!doctype html>')},{title:'Campi con etichette e validazione',passed:html.includes('for="email"')&&html.includes('type="email" required')},{title:'Nessun invio di dati all’azienda',passed:!html.includes('fetch(')&&html.includes('e.preventDefault()')},{title:'Fonte e natura dimostrativa dichiarate',passed:html.includes('PROTOTIPO DIMOSTRATIVO')&&html.includes(report.business.sourceUrl.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)))}];}
   const completed=(report.qa?.every(q=>q.passed)??false)&&!(report.verificationVersion===1&&report.prototypes?.length);
   await db.prepare('UPDATE missions SET status=?,report=? WHERE id=? AND owner=?').bind(completed?'completed':'review',JSON.stringify(report),row.id,user.userId).run();
   return Response.json({id:row.id,status:completed?'completed':'review',report:publicReport(report),commercial:completed&&hasPrototype(report)?commercialDraft(report,sender()):undefined},{headers:{'Cache-Control':'no-store'}});
  }
  const business=catalog.find(b=>b.id===value);if(!business)return Response.json({error:'Attività non trovata nel catalogo'},{status:400});
  // Reservations left behind by an interrupted worker would otherwise stay in the archive forever.
  await db.prepare("DELETE FROM missions WHERE owner=? AND status='pending' AND created_at<?").bind(user.userId,new Date(Date.now()-600000).toISOString()).run();
  const id=crypto.randomUUID();const createdAt=new Date().toISOString();const minuteAgo=new Date(Date.now()-60000).toISOString();
  // A single SQLite statement reserves the slot before network work, including simultaneous requests.
  const reservation=await db.prepare('INSERT INTO missions (id,owner,business_id,business_name,status,report,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM missions WHERE owner=? AND created_at>?)<4').bind(id,user.userId,business.id,business.name,'pending','{}',createdAt,user.userId,minuteAgo).run();
  if(!reservation.success||typeof reservation.meta?.changes!=='number')throw new Error('Prenotazione analisi non disponibile');
  if(reservation.meta.changes===0)return Response.json({error:'Hai già avviato quattro analisi. Attendi un minuto.'},{status:429});
  reservedId=id;
  const audit=await auditBusiness(business);const agents=await analyseWithAgents(audit,agentConfig());const report=buildPrototypes({...audit,agents});const status=report.prototypes?.length?'review':'completed';
  const saved=await db.prepare("UPDATE missions SET status=?,report=? WHERE id=? AND owner=? AND status='pending'").bind(status,JSON.stringify(report),id,user.userId).run();
  if(!saved.success||saved.meta?.changes!==1)throw new Error('Salvataggio analisi non disponibile');
  reservedId=undefined;
  return Response.json({id,status,report:publicReport(report),commercial:status==='completed'&&hasPrototype(report)?commercialDraft(report,sender()):undefined,business_name:business.name,created_at:createdAt},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  if(reservedId){try{await missionDb().prepare("DELETE FROM missions WHERE id=? AND owner=? AND status='pending'").bind(reservedId,user.userId).run();}catch(cleanupError){console.error('missions reservation cleanup',cleanupError);}}
  console.error('missions write',error);return Response.json({error:'L’analisi non è stata salvata. Riprova tra poco.'},{status:503});
 }
}
