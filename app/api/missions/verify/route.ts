import {getChatGPTUser} from '@/app/chatgpt-auth';
import {missionDb} from '@/lib/missions';
import type {Report} from '@/lib/audit';
import {publicReport,hasPrototype} from '@/lib/prototypes';
import {validateBrowserResults,verifiedReport,repairPrototypeLayouts} from '@/lib/verification';
import {commercialDraft} from '@/lib/commercial';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Accedi per salvare la verifica.'},{status:401});
 let data:unknown;try{const text=await request.text();if(text.length>20000)throw Error();data=JSON.parse(text);}catch{return Response.json({error:'Risultati di verifica non validi.'},{status:400});}
 if(!data||typeof data!=='object'||Array.isArray(data))return Response.json({error:'Risultati di verifica non validi.'},{status:400});
 const body=data as Record<string,unknown>;
 if(Object.keys(body).sort().join(',')!=='missionId,results,revision'||typeof body.missionId!=='string'||body.missionId.length>256||typeof body.revision!=='string'||body.revision.length!==36)return Response.json({error:'Indica la missione e la versione della verifica.'},{status:400});
 try{
  const db=missionDb();const row=await db.prepare('SELECT * FROM missions WHERE id=? AND owner=?').bind(body.missionId,user.userId).first<{id:string;status:string;report:string;business_name:string;created_at:string}>();
  if(!row)return Response.json({error:'Missione non trovata.'},{status:404});if(!['review','completed'].includes(row.status))return Response.json({error:'Attendi la costruzione dei prototipi.'},{status:409});
  let report=JSON.parse(row.report) as Report;if(report.verificationVersion!==1||report.verificationRevision!==body.revision)return Response.json({error:'La demo è cambiata. Ripeti la verifica sulla nuova versione.'},{status:409});
  const verified=validateBrowserResults(body.results,report);if(!verified)return Response.json({error:'Servono tutti i controlli per ogni prototipo.'},{status:400});
  report.prototypes=report.prototypes?.map(p=>({...p,browser:verified.get(p.id)}));report=repairPrototypeLayouts(report);const status=report.verificationRevision===body.revision&&verifiedReport(report)?'completed':'review';
  const saved=await db.prepare("UPDATE missions SET report=?,status=? WHERE id=? AND owner=? AND json_extract(report,'$.verificationRevision')=? AND status IN ('review','completed')").bind(JSON.stringify(report),status,row.id,user.userId,body.revision).run();
  if(!saved.success)throw Error('Archivio non disponibile');if(saved.meta?.changes!==1)return Response.json({error:'La demo è cambiata. Ripeti la verifica.'},{status:409});
  const runtime=env as unknown as {SALES_SENDER_EMAIL?:string};const sender=runtime.SALES_SENDER_EMAIL||process.env.SALES_SENDER_EMAIL||'';
  return Response.json({id:row.id,status,report:publicReport(report),business_name:row.business_name,created_at:row.created_at,commercial:status==='completed'&&hasPrototype(report)?commercialDraft(report,sender):undefined},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Verifica non salvata. Riprova dalla missione.'},{status:503});}
}
