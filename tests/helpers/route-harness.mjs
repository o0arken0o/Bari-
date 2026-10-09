// Loads Next route handlers under Node: stubs the Workers runtime, next/headers and bundler-only imports,
// and backs D1 with an in-memory SQLite database that uses the real migrations.
import {registerHooks} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=new URL('../../',import.meta.url);
export const runtime={env:{},headers:new Headers()};
const stubs={
 'cloudflare:workers':'export const env=globalThis.__bariRuntime.env;',
 'next/headers':'export const headers=async()=>globalThis.__bariRuntime.headers;',
 'next/navigation':'export const redirect=()=>{throw new Error("redirect");};'
};
globalThis.__bariRuntime=runtime;
registerHooks({
 resolve(specifier,context,next){
  if(stubs[specifier])return {url:'bari-stub:'+specifier,shortCircuit:true};
  if(specifier.endsWith('?raw'))return {url:new URL(specifier.slice(2,-4),root).href+'?raw',shortCircuit:true,format:'module'};
  if(specifier.startsWith('@/')){const path=specifier.slice(2);return next(new URL(/\.\w+$/.test(path)?path:path+'.ts',root).href,context);}
  if(specifier.startsWith('.')&&!/\.\w+$/.test(specifier))return next(specifier+'.ts',context);
  return next(specifier,context);
 },
 load(url,context,next){
  if(url.startsWith('bari-stub:'))return {format:'module',shortCircuit:true,source:stubs[url.slice(10)]};
  if(url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(readFileSync(fileURLToPath(url.slice(0,-4)),'utf8'))};
  return next(url,context);
 }
});

function d1(db){
 const statement=(sql,params=[])=>({
  bind:(...values)=>statement(sql,values),
  run:async()=>{const r=db.prepare(sql).run(...params);return {success:true,meta:{changes:Number(r.changes)}};},
  first:async()=>db.prepare(sql).get(...params)??null,
  all:async()=>({success:true,results:db.prepare(sql).all(...params)})
 });
 return {prepare:sql=>statement(sql)};
}
export function freshDb(){
 const db=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('drizzle/',root)).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(new URL('drizzle/'+file,root),'utf8').replaceAll('--> statement-breakpoint',''));
 return {db,binding:d1(db)};
}
export function signIn(userId){runtime.headers=userId?new Headers({'oai-authenticated-user-id':userId,'oai-authenticated-user-email':userId+'@example.com'}):new Headers();}
export const load=path=>import(pathToFileURL(fileURLToPath(new URL(path,root))).href);
export const json=(method,body)=>new Request('http://localhost/api',{method,headers:{'Content-Type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)});
