import test from 'node:test';
import assert from 'node:assert/strict';
import {auditBusiness, demoHtml, publicUrl} from '../lib/audit.ts';
import {commercialDraft} from '../lib/commercial.ts';

const business={id:'fixture',name:'Attività campione',category:'Hotel',lat:41.12,lon:16.87,address:'Bari',website:'https://example.com/',source:'fixture',sourceUrl:'https://example.com/source',sourceDate:'2026-10-08',type:'hotel'};
async function withResponse(makeResponse,run){const originalFetch=globalThis.fetch;globalThis.fetch=async()=>makeResponse();try{return await run();}finally{globalThis.fetch=originalFetch;}}
function htmlResponse(html,contentType='text/html; charset=utf-8'){return new Response(html,{headers:{'Content-Type':contentType}});}

// These tests use local fixtures; they never contact a company website.
test('unreachable website leaves features uncertain and no confirmed sales need',async()=>{
 const report=await withResponse(()=>{throw Error('Fixture network failure')},()=>auditBusiness(business));
 assert.equal(report.fetched,false);
 assert.deepEqual(report.findings.slice(2).map(f=>f.state),['da confermare','da confermare','da confermare']);
 assert.equal(report.proposal.kind,'profile');
 const draft=commercialDraft(report,'owner@example.com');
 assert.equal(draft.status,'draft');assert.equal(draft.recipient,null);
 assert.match(draft.body,/Non ho informazioni sufficienti/);
});

test('HTML content type is case insensitive, and actual link/language evidence remains visible',async()=>{
 const report=await withResponse(()=>htmlResponse('<!doctype html><html lang="en-US"><body><a href="https://booking.com/hotel">Prenota</a><a href="mailto:hello@example.com">Contatti</a></body></html>','Text/HTML; charset=UTF-8'),()=>auditBusiness(business));
 assert.equal(report.fetched,true);
 assert.deepEqual(report.findings.slice(2).map(f=>f.state),['presente','presente','presente']);
});

test('comments, scripts and style do not claim customer-visible services',async()=>{
 const report=await withResponse(()=>htmlResponse('<!doctype html><html lang="it"><body>Hotel Bari<!-- prenota english contact --><script>const features="booking english contact";</script><style>.prenota-english-contact {color:blue}</style></body></html>'),()=>auditBusiness(business));
 assert.equal(report.fetched,true);
 assert.deepEqual(report.findings.slice(2).map(f=>f.state),['non rilevato','non rilevato','non rilevato']);
});

test('unrelated words containing book do not claim a booking feature',async()=>{
 const report=await withResponse(()=>htmlResponse('<html><body>Vendiamo cookbook e notebook.</body></html>'),()=>auditBusiness(business));
 assert.equal(report.findings[2].state,'non rilevato');
});

test('a first chunk above the byte limit cannot become an empty-page missing-service diagnosis',async()=>{
 const report=await withResponse(()=>htmlResponse('<!doctype html><html><body>Informazioni parziali.'+'x'.repeat(260000)+'</body></html>'),()=>auditBusiness(business));
 assert.ok(report.findings.slice(2).every(f=>f.state==='da confermare'));
 assert.notEqual(report.proposal.kind,'request');
});

test('keywords beyond the byte cap never become evidence; partial absence remains uncertain',async()=>{
 const encoder=new TextEncoder();
 const report=await withResponse(()=>new Response(new ReadableStream({start(controller){controller.enqueue(encoder.encode('<html><body>'+'x'.repeat(250000)));controller.enqueue(encoder.encode('<a href="https://booking.com/">prenota english contact</a></body></html>'));controller.close();}}),{headers:{'Content-Type':'text/html'}}),()=>auditBusiness(business));
 assert.ok(report.findings.slice(2).every(f=>f.state==='da confermare'));
});

test('visible evidence in the retained prefix survives truncation without diagnosing other missing services',async()=>{
 const report=await withResponse(()=>htmlResponse('<html><body><a href="https://booking.com/">Prenota</a>'+'x'.repeat(260000)),()=>auditBusiness(business));
 assert.equal(report.findings[2].state,'presente');
 assert.equal(report.findings[3].state,'da confermare');
 assert.equal(report.findings[4].state,'da confermare');
 assert.equal(report.proposal.kind,'profile');
 assert.match(report.note,/solo in parte/);
});

test('a complete page exactly at the byte cap is not mistakenly marked partial',async()=>{
 const report=await withResponse(()=>htmlResponse('x'.repeat(250000)),()=>auditBusiness(business));
 assert.ok(report.findings.slice(2).every(f=>f.state==='non rilevato'));
 assert.doesNotMatch(report.note,/solo in parte/);
});

test('an unfinished script at the byte boundary cannot supply service evidence',async()=>{
 const report=await withResponse(()=>htmlResponse('<html><body>Hotel</body><script>booking english contact '+'x'.repeat(260000)),()=>auditBusiness(business));
 assert.ok(report.findings.slice(2).every(f=>f.state==='da confermare'));
});

test('generated demo escapes company text and links and declares its local behavior',()=>{
 const report={business:{...business,name:'<script>alert("x")</script>',sourceUrl:'https://example.com/?a=1&b="sample"'},findings:[],fetched:false,checkedAt:'2026-10-08T00:00:00.000Z',note:'Fixture',proposal:{title:'Demo <servizi>',kind:'profile',description:'Fixture'}};
 const html=demoHtml(report);
 assert.ok(!html.includes('<script>alert("x")</script>'));
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/PROTOTIPO DIMOSTRATIVO/);
 assert.match(html,/i dati non vengono inviati o salvati/);
 assert.match(html,/e\.preventDefault\(\)/);
 assert.match(html,/https:\/\/example\.com\/\?a=1&amp;b=&quot;sample&quot;/);
});

test('public website validation blocks direct local addresses and credentials',()=>{
 for(const value of ['http://localhost/','http://127.0.0.1/','http://[::1]/','https://private.internal/','https://user:password@example.com/','javascript:alert(1)'])assert.equal(publicUrl(value),null);
 assert.equal(publicUrl('https://example.com/').href,'https://example.com/');
});
