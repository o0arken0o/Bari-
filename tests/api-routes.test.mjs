import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {runtime,freshDb,signIn,load,json}from './helpers/route-harness.mjs';

const favorites=await load('app/api/favorites/route.ts');
const missions=await load('app/api/missions/route.ts');
const verify=await load('app/api/missions/verify/route.ts');
const catalog=JSON.parse((await import('node:fs')).readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
// A business without a website keeps the audit offline and deterministic.
const offline=catalog.filter(b=>!b.website).slice(0,6);
let store;
beforeEach(()=>{store=freshDb();runtime.env.DB=store.binding;signIn('alice');});
const insertMission=(id,owner,status,report={},createdAt=new Date().toISOString())=>store.db.prepare('INSERT INTO missions VALUES (?,?,?,?,?,?,?)').run(id,owner,'b','Demo',status,JSON.stringify(report),createdAt);

test('favorites require sign-in',async()=>{
 signIn(null);
 assert.equal((await favorites.GET()).status,401);
 assert.equal((await favorites.PUT(json('PUT',{businessId:offline[0].id,saved:true}))).status,401);
});
test('favorites can be saved, listed and removed per owner',async()=>{
 const [a,b]=offline;
 assert.equal((await favorites.PUT(json('PUT',{businessId:a.id,saved:true}))).status,200);
 assert.equal((await favorites.PUT(json('PUT',{businessId:a.id,saved:true}))).status,200,'saving twice is idempotent');
 assert.equal((await favorites.PUT(json('PUT',{businessId:b.id,saved:true}))).status,200);
 assert.deepEqual((await (await favorites.GET()).json()).ids.sort(),[a.id,b.id].sort());
 signIn('bob');
 assert.deepEqual((await (await favorites.GET()).json()).ids,[],'other users see nothing');
 signIn('alice');
 assert.equal((await favorites.PUT(json('PUT',{businessId:a.id,saved:false}))).status,200);
 assert.deepEqual((await (await favorites.GET()).json()).ids,[b.id]);
});
test('favorites reject malformed requests and unknown businesses',async()=>{
 for(const body of ['not json','[]',{businessId:offline[0].id},{businessId:'nope',saved:true},{businessId:offline[0].id,saved:'yes'},{businessId:offline[0].id,saved:true,extra:1},'x'.repeat(2000)])
  assert.equal((await favorites.PUT(json('PUT',body))).status,400,JSON.stringify(body).slice(0,60));
});
test('favorites stop at 200 per owner',async()=>{
 const stmt=store.db.prepare('INSERT INTO business_favorites VALUES (?,?,?)');
 for(let i=0;i<200;i++)stmt.run('alice','fake-'+i,new Date().toISOString());
 const response=await favorites.PUT(json('PUT',{businessId:offline[0].id,saved:true}));
 assert.equal(response.status,409);
 signIn('bob');
 assert.equal((await favorites.PUT(json('PUT',{businessId:offline[0].id,saved:true}))).status,200);
});
test('favorites report storage failures as 503',async()=>{
 runtime.env.DB={prepare:()=>{throw new Error('down');}};
 assert.equal((await favorites.GET()).status,503);
});

test('missions require sign-in and a single valid action',async()=>{
 signIn(null);
 assert.equal((await missions.GET(new Request('http://localhost/api/missions'))).status,401);
 assert.equal((await missions.POST(json('POST',{businessId:offline[0].id}))).status,401);
 signIn('alice');
 for(const body of ['nope','[]',{},{businessId:''},{businessId:5},{businessId:offline[0].id,approveId:'x'},{other:'x'},{businessId:'x'.repeat(300)}])
  assert.equal((await missions.POST(json('POST',body))).status,400,JSON.stringify(body).slice(0,60));
 assert.equal((await missions.POST(json('POST',{businessId:'missing'}))).status,400);
});
test('an offline business yields a website prototype to review and is stored for its owner only',async()=>{
 const response=await missions.POST(json('POST',{businessId:offline[0].id}));
 assert.equal(response.status,200);
 const mission=await response.json();
 assert.equal(mission.status,'review');
 assert.equal(mission.report.prototypes[0].kind,'website');
 assert.equal(mission.report.prototypes[0].html,undefined,'public reports omit the HTML');
 const list=await (await missions.GET(new Request('http://localhost/api/missions'))).json();
 assert.deepEqual(list.missions.map(m=>m.id),[mission.id]);
 signIn('bob');
 assert.deepEqual((await (await missions.GET(new Request('http://localhost/api/missions'))).json()).missions,[]);
});
test('at most four analyses per minute per owner',async()=>{
 for(const b of offline.slice(0,4))assert.equal((await missions.POST(json('POST',{businessId:b.id}))).status,200);
 assert.equal((await missions.POST(json('POST',{businessId:offline[4].id}))).status,429);
 signIn('bob');
 assert.equal((await missions.POST(json('POST',{businessId:offline[4].id}))).status,200);
});
test('simultaneous requests cannot exceed the limit',async()=>{
 const statuses=(await Promise.all(offline.map(b=>missions.POST(json('POST',{businessId:b.id}))))).map(r=>r.status);
 assert.equal(statuses.filter(s=>s===200).length,4);
 assert.equal(statuses.filter(s=>s===429).length,2);
});
test('stale pending reservations are removed before a new analysis',async()=>{
 insertMission('old','alice','pending',{},new Date(Date.now()-3600000).toISOString());
 insertMission('fresh','alice','pending');
 assert.equal((await missions.POST(json('POST',{businessId:offline[0].id}))).status,200);
 const ids=store.db.prepare('SELECT id FROM missions').all().map(r=>r.id);
 assert.ok(!ids.includes('old'));assert.ok(ids.includes('fresh'));
});
test('pending missions are hidden from the archive',async()=>{
 insertMission('p','alice','pending');
 assert.deepEqual((await (await missions.GET(new Request('http://localhost/api/missions'))).json()).missions,[]);
});
test('approving requires ownership and a finished analysis',async()=>{
 insertMission('p','alice','pending');
 assert.equal((await missions.POST(json('POST',{approveId:'p'}))).status,409);
 assert.equal((await missions.POST(json('POST',{approveId:'unknown'}))).status,404);
 signIn('bob');
 assert.equal((await missions.POST(json('POST',{approveId:'p'}))).status,404);
});
test('prototype downloads are withheld until verification, and scoped to the owner',async()=>{
 const mission=await (await missions.POST(json('POST',{businessId:offline[0].id}))).json();
 const get=(q,user='alice')=>{signIn(user);return missions.GET(new Request('http://localhost/api/missions?'+q));};
 assert.equal((await get('artifact='+mission.id)).status,404,'review missions are not downloadable');
 store.db.prepare("UPDATE missions SET status='completed' WHERE id=?").run(mission.id);
 const html=await get('artifact='+mission.id+'&preview=1');
 assert.equal(html.status,200);
 assert.match(html.headers.get('Content-Security-Policy'),/connect-src 'none'/);
 assert.match(html.headers.get('Content-Security-Policy'),/form-action 'none'/);
 assert.equal(html.headers.get('Cache-Control'),'no-store');
 assert.match(await html.text(),/^<!doctype html>/);
 assert.match(html.headers.get('Content-Disposition'),/^inline/);
 assert.match((await get('artifact='+mission.id)).headers.get('Content-Disposition'),/^attachment/);
 assert.equal((await get('artifact='+mission.id+'&prototype=nope')).status,404);
 assert.equal((await get('artifact='+mission.id,'bob')).status,404,'other owners get nothing');
 const proposal=await get('artifact='+mission.id+'&format=proposal');
 assert.match(await proposal.text(),/PROPOSTA PRELIMINARE/);
});

test('verification validates its payload, ownership and revision',async()=>{
 const mission=await (await missions.POST(json('POST',{businessId:offline[0].id}))).json();
 const revision=mission.report.verificationRevision;
 signIn('alice');
 assert.equal((await verify.POST(json('POST','nope'))).status,400);
 assert.equal((await verify.POST(json('POST',{missionId:mission.id,results:[]}))).status,400);
 assert.equal((await verify.POST(json('POST',{missionId:mission.id,revision:'x',results:[]}))).status,400);
 assert.equal((await verify.POST(json('POST',{missionId:'missing',revision:'0'.repeat(36),results:[]}))).status,404);
 assert.equal((await verify.POST(json('POST',{missionId:mission.id,revision:'0'.repeat(36),results:[]}))).status,409,'stale revision');
 assert.equal((await verify.POST(json('POST',{missionId:mission.id,revision,results:[]}))).status,400,'every prototype needs results');
 signIn('bob');
 assert.equal((await verify.POST(json('POST',{missionId:mission.id,revision,results:[]}))).status,404);
});
test('complete passing browser results complete the mission',async()=>{
 const mission=await (await missions.POST(json('POST',{businessId:offline[0].id}))).json();
 const {requiredBrowserChecks}=await load('lib/verification.ts');
 const report=JSON.parse(store.db.prepare('SELECT report FROM missions WHERE id=?').get(mission.id).report);
 const results=report.prototypes.map(p=>({prototypeId:p.id,checks:requiredBrowserChecks(report,p).map(key=>({key,passed:true}))}));
 const response=await verify.POST(json('POST',{missionId:mission.id,revision:report.verificationRevision,results}));
 assert.equal(response.status,200);
 const done=await response.json();
 assert.equal(done.status,'completed');
 assert.ok(done.commercial);
 assert.equal(store.db.prepare('SELECT status FROM missions WHERE id=?').get(mission.id).status,'completed');
});
test('a failed functional check keeps the mission in review',async()=>{
 const mission=await (await missions.POST(json('POST',{businessId:offline[0].id}))).json();
 const {requiredBrowserChecks}=await load('lib/verification.ts');
 const report=JSON.parse(store.db.prepare('SELECT report FROM missions WHERE id=?').get(mission.id).report);
 const results=report.prototypes.map(p=>({prototypeId:p.id,checks:requiredBrowserChecks(report,p).map(key=>({key,passed:key!=='local-submit'}))}));
 const done=await (await verify.POST(json('POST',{missionId:mission.id,revision:report.verificationRevision,results}))).json();
 assert.equal(done.status,'review');
});
