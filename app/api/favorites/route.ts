import {getChatGPTUser} from '@/app/chatgpt-auth';
import {missionDb} from '@/lib/missions';
import catalogText from '@/data/catalog.json?raw';
const knownIds=new Set((JSON.parse(catalogText) as {id:string}[]).map(b=>b.id));
const headers={'Cache-Control':'no-store'};
export const dynamic='force-dynamic';
export async function GET(){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Accedi per usare le preferite.'},{status:401,headers});
 try{const rows=await missionDb().prepare('SELECT business_id FROM business_favorites WHERE owner=? ORDER BY created_at DESC,business_id').bind(user.userId).all<{business_id:string}>();if(!rows.success)throw Error();return Response.json({ids:rows.results.map(r=>r.business_id)}, {headers});}catch{return Response.json({error:'Preferite non disponibili. Riprova.'},{status:503,headers});}
}
export async function PUT(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Accedi per salvare le aziende preferite.'},{status:401,headers});
 let body:unknown;try{const raw=await request.text();if(raw.length>1024)throw Error();body=JSON.parse(raw);}catch{return Response.json({error:'Richiesta non valida.'},{status:400,headers});}
 if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Richiesta non valida.'},{status:400,headers});
 const value=body as Record<string,unknown>;
 if(Object.keys(value).sort().join(',')!=='businessId,saved'||typeof value.businessId!=='string'||!knownIds.has(value.businessId)||typeof value.saved!=='boolean')return Response.json({error:'Indica un’azienda del catalogo.'},{status:400,headers});
 try{
  const db=missionDb();if(value.saved){
   const result=await db.prepare('INSERT INTO business_favorites(owner,business_id,created_at) SELECT ?,?,? WHERE (SELECT count(*) FROM business_favorites WHERE owner=?)<200 ON CONFLICT(owner,business_id) DO NOTHING').bind(user.userId,value.businessId,new Date().toISOString(),user.userId).run();if(!result.success)throw Error();
   const exists=await db.prepare('SELECT business_id FROM business_favorites WHERE owner=? AND business_id=?').bind(user.userId,value.businessId).first();if(!exists)return Response.json({error:'Hai raggiunto 200 aziende preferite. Rimuovine una prima di aggiungerne altre.'},{status:409,headers});
  }else{const result=await db.prepare('DELETE FROM business_favorites WHERE owner=? AND business_id=?').bind(user.userId,value.businessId).run();if(!result.success)throw Error();}
  return Response.json({businessId:value.businessId,saved:value.saved},{headers});
 }catch{return Response.json({error:'Preferita non salvata. Riprova.'},{status:503,headers});}
}
