import { env } from 'cloudflare:workers';
import { commercialDraft, commercialText } from '@/lib/commercial';
import catalogText from '@/data/catalog.json?raw';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { missionDb } from '@/lib/missions';
import { auditBusiness, demoHtml, type Business, type Report } from '@/lib/audit';
const catalog=JSON.parse(catalogText) as Business[];
export const dynamic='force-dynamic';
const sender=()=>((env as unknown as {SALES_SENDER_EMAIL?:string}).SALES_SENDER_EMAIL||process.env.SALES_SENDER_EMAIL||'');

export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Accedi per usare il laboratorio.'},{status:401});
 try{
  const params=new URL(request.url).searchParams;const artifact=params.get('artifact');
  if(artifact){
   const row=await missionDb().prepare('SELECT report,status FROM missions WHERE id=? AND owner=?').bind(artifact,user.userId).first<{report:string;status:string}>();
   if(!row||row.status!=='completed')return Response.json({error:'Demo non disponibile'},{status:404});
   const report=JSON.parse(row.report) as Report;
   if(params.get('format')==='proposal')return new Response(commercialText(report,sender()),{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="bari-proposta.txt"','Cache-Control':'no-store'}});
   return new Response(demoHtml(report),{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="bari-demo.html"','Cache-Control':'no-store'}});
  }
  const rows=await missionDb().prepare("SELECT * FROM missions WHERE owner=? AND status<>'pending' ORDER BY created_at DESC LIMIT 30").bind(user.userId).all();
  return Response.json({sender:sender(),sendingConfigured:false,missions:rows.results.map(row=>{const report=JSON.parse(row.report as string) as Report;return {...row,report,commercial:row.status==='completed'?commercialDraft(report,sender()):undefined};})},{headers:{'Cache-Control':'no-store'}});
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
   const report=JSON.parse(row.report) as Report;const html=demoHtml(report);
   report.qa=[{title:'Documento HTML generato',passed:html.startsWith('<!doctype html>')},{title:'Campi con etichette e validazione',passed:html.includes('for="email"')&&html.includes('type="email" required')},{title:'Nessun invio di dati all’azienda',passed:!html.includes('fetch(')&&html.includes('e.preventDefault()')},{title:'Fonte e natura dimostrativa dichiarate',passed:html.includes('PROTOTIPO DIMOSTRATIVO')&&html.includes(report.business.sourceUrl.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)))}];
   const completed=report.qa.every(q=>q.passed);
   await db.prepare('UPDATE missions SET status=?,report=? WHERE id=? AND owner=?').bind(completed?'completed':'review',JSON.stringify(report),row.id,user.userId).run();
   return Response.json({id:row.id,status:completed?'completed':'review',report,commercial:completed?commercialDraft(report,sender()):undefined});
  }
  const business=catalog.find(b=>b.id===value);if(!business)return Response.json({error:'Attività non trovata nel catalogo'},{status:400});
  const id=crypto.randomUUID();const createdAt=new Date().toISOString();const minuteAgo=new Date(Date.now()-60000).toISOString();
  // A single SQLite statement reserves the slot before network work, including simultaneous requests.
  const reservation=await db.prepare('INSERT INTO missions (id,owner,business_id,business_name,status,report,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM missions WHERE owner=? AND created_at>?)<4').bind(id,user.userId,business.id,business.name,'pending','{}',createdAt,user.userId,minuteAgo).run();
  if(!reservation.success||typeof reservation.meta?.changes!=='number')throw new Error('Prenotazione analisi non disponibile');
  if(reservation.meta.changes===0)return Response.json({error:'Hai già avviato quattro analisi. Attendi un minuto.'},{status:429});
  reservedId=id;
  const report=await auditBusiness(business);
  const saved=await db.prepare("UPDATE missions SET status=?,report=? WHERE id=? AND owner=? AND status='pending'").bind('review',JSON.stringify(report),id,user.userId).run();
  if(!saved.success||saved.meta?.changes!==1)throw new Error('Salvataggio analisi non disponibile');
  reservedId=undefined;
  return Response.json({id,status:'review',report,business_name:business.name,created_at:createdAt});
 }catch(error){
  if(reservedId){try{await missionDb().prepare("DELETE FROM missions WHERE id=? AND owner=? AND status='pending'").bind(reservedId,user.userId).run();}catch(cleanupError){console.error('missions reservation cleanup',cleanupError);}}
  console.error('missions write',error);return Response.json({error:'L’analisi non è stata salvata. Riprova tra poco.'},{status:503});
 }
}
