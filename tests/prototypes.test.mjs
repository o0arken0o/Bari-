import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const url=new URL('../lib/prototypes.ts',import.meta.url).href;
registerHooks({resolve(specifier,context,nextResolve){if(specifier==='./audit'&&context.parentURL===url)return nextResolve('./audit.ts',context);if(specifier==='./verification'&&context.parentURL===url)return nextResolve('./verification.ts',context);return nextResolve(specifier,context);}});
const {planPrototypes,buildPrototypes,publicReport,prototypeHtml}=await import(url);
const {companyQueue}=await import('../lib/company-queue.ts');
const business={id:'fixture',name:'Attività campione',category:'Hotel',lat:41.12,lon:16.87,address:'Via campione, Bari',website:'https://example.com/',source:'fixture',sourceUrl:'https://example.com/source',sourceDate:'2026-10-08',type:'hotel'};
const report=(states=['non rilevato','non rilevato','non rilevato'])=>({business,findings:['Identità e attività','Sito web nella fonte','Richiesta o prenotazione online','Informazioni in più lingue','Orari o informazioni di contatto'].map((title,index)=>({title,state:index<2?'presente':states[index-2],detail:'Fixture',url:business.website})),fetched:true,checkedAt:'2026-10-08T00:00:00.000Z',note:'Fixture',proposal:{title:'Fixture',description:'Fixture'}});

test('all three homepage gaps produce separate prototypes, not just the first',()=>{
 const built=buildPrototypes(report());assert.deepEqual(built.prototypes.map(p=>p.kind),['request','bilingual','contacts']);assert.ok(built.prototypes.every(p=>p.html&&p.qa.length===4&&p.qa.every(q=>q.passed)&&p.needsConfirmation));assert.equal(built.qa.length,12);
});
test('website omitted from the source produces a website hypothesis without assuming other gaps',()=>{
 const input={...report(['da confermare','da confermare','da confermare']),business:{...business,website:''},fetched:false};const [prototype]=planPrototypes(input);assert.equal(prototype.kind,'website');assert.match(prototype.reason,/pourrait|potrebbe/);assert.equal(planPrototypes(input).length,1);
});
test('unreachable and partial websites do not manufacture missing-service products',()=>{
 assert.deepEqual(planPrototypes({...report(),fetched:false}),[]);assert.deepEqual(planPrototypes(report(['da confermare','presente','da confermare'])),[]);
 const built=buildPrototypes(report(['presente','presente','presente']));assert.deepEqual(built.prototypes,[]);assert.equal(built.proposal.kind,'none');
});
test('an observed gap can coexist with unrelated unknown features',()=>{
 assert.deepEqual(planPrototypes(report(['da confermare','non rilevato','presente'])).map(p=>p.kind),['bilingual']);
});
test('hospitality, dining and other businesses receive different request fields',()=>{
 for(const [category,title,expected,absent]of [['Hotel','soggiorno','id="arrival"','id="time"'],['Ristoranti','tavolo','id="time"','id="departure"'],['Artigiani','preventivo','name="message"','id="guests"']]){
  const built=buildPrototypes({...report(),business:{...business,category}});const request=built.prototypes[0];assert.match(request.title,new RegExp(title));assert.ok(request.html.includes(expected));assert.ok(!request.html.includes(absent));
 }
});
test('prototype source, company text and translation payload cannot inject markup',()=>{
 const input={...report(),business:{...business,name:'<script>alert("x")</script>',category:'</script><script>alert(2)</script>',sourceUrl:'https://example.com/?a=1&b="x"'}};
 for(const p of buildPrototypes(input).prototypes){assert.ok(!p.html.includes('<script>alert('));assert.ok(!p.html.includes('</script><script>alert(2)'));assert.match(p.html,/&lt;script&gt;/);assert.match(p.html,/a=1&amp;b=&quot;x&quot;/);assert.match(p.html,/e\.preventDefault\(\)/);assert.ok(!p.html.includes('fetch('));}
});
test('artifact HTML is persisted but omitted from public mission descriptors',()=>{
 const built=buildPrototypes(report());const visible=publicReport(built);assert.ok(built.prototypes.every(p=>p.html));assert.ok(visible.prototypes.every(p=>!('html' in p)));assert.deepEqual(visible.prototypes.map(p=>p.qa),built.prototypes.map(p=>p.qa));
});
test('bilingual demo supplies English for every visible translation key',()=>{
 const input=report(['presente','non rilevato','presente']);const prototype=planPrototypes(input)[0];const html=prototypeHtml(input,prototype);const texts=JSON.parse(html.match(/const translations=(.*?);let language=/s)[1]);const keys=[...html.matchAll(/data-text="([^"]+)"/g)].map(m=>m[1]);assert.ok(keys.length>15);for(const key of keys)assert.equal(typeof texts.en[key],'string');assert.match(html,/document\.documentElement\.lang=language/);assert.match(texts.en.initial,/neither sent nor saved/);
});
test('company queue respects the parallel limit and continues after a failed company',async()=>{
 let active=0,max=0;const visited=[];
 const results=await companyQueue([0,1,2,3],2,async item=>{active++;max=Math.max(max,active);visited.push(item);try{await new Promise(resolve=>setTimeout(resolve,item===0?25:5));if(item===1)throw Error('Fixture failure');}finally{active--;}});
 assert.equal(max,2);assert.deepEqual([...visited].sort(),[0,1,2,3]);assert.deepEqual(results.map(r=>r.status),['fulfilled','rejected','fulfilled','fulfilled']);assert.equal(active,0);
});
test('serial queue preserves order, and invalid parallel settings are rejected',async()=>{
 const visited=[];await companyQueue(['a','b','c'],1,async item=>{visited.push(item);});assert.deepEqual(visited,['a','b','c']);for(const parallel of [0,5,1.5,NaN])await assert.rejects(companyQueue([0],parallel,async()=>{}));assert.deepEqual(await companyQueue([],4,async()=>{}),[]);
});
