import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
import {world} from '../lib/city-architecture.ts';

// Node's native TypeScript loader needs an extension for this bundler-resolved import.
// Keep the production import unchanged and scope the resolver to that one module.
const lifeUrl=new URL('../lib/city-life.ts',import.meta.url).href;
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='./city-architecture'&&context.parentURL===lifeUrl)return nextResolve('./city-architecture.ts',context);
 return nextResolve(specifier,context);
}});
const {createWalkingRoutes,moveAlongRoute}=await import(lifeUrl);
const A={lat:41.127,lon:16.867},B={lat:41.127,lon:16.868},C={lat:41.128,lon:16.868};
const D={lat:41.13,lon:16.871},E={lat:41.131,lon:16.871};
const point=geo=>world(geo.lat,geo.lon);
const street=(...geometry)=>({kind:'pedestrian',geometry});
const close=(actual,expected)=>assert.ok(actual.distanceTo(expected)<1e-9,`${actual.toArray()} differs from ${expected.toArray()}`);

test('a connected route follows the street bend and reaches both endpoints',()=>{
 const routes=createWalkingRoutes([street(A,B),street(B,C)]),route=routes(point(A),point(C)),out=new THREE.Vector3();
 assert.equal(route.reachable,true);
 const firstLeg=point(A).distanceTo(point(B)),secondLeg=point(B).distanceTo(point(C));
 assert.ok(Math.abs(route.length-firstLeg-secondLeg)<1e-9);
 assert.ok(route.length>point(A).distanceTo(point(C)));
 moveAlongRoute(route,0,out);close(out,point(A));
 moveAlongRoute(route,firstLeg/route.length,out);close(out,point(B));
 moveAlongRoute(route,1,out);close(out,point(C));
 assert.ok(Number.isFinite(route.angle));
});

test('two disconnected street components hold at the start rather than crossing the gap',()=>{
 const routes=createWalkingRoutes([street(A,B),street(D,E)]),from=point(A),route=routes(from,point(E)),out=new THREE.Vector3();
 assert.equal(route.reachable,false);
 assert.equal(route.length,0);
 assert.equal(route.points.length,1);
 for(const progress of [0,.5,1]){assert.equal(moveAlongRoute(route,progress,out),0);close(out,from);}
 from.addScalar(100);close(route.points[0],point(A));
});

test('an absent walkable network returns a safe stationary route',()=>{
 for(const roads of [[],[{kind:'motorway',geometry:[A,B]}],[{kind:'trunk',geometry:[A,B]}]]){
  const route=createWalkingRoutes(roads)(point(A),point(C)),out=new THREE.Vector3();
  assert.equal(route.reachable,false);
  assert.equal(route.length,0);
  moveAlongRoute(route,1,out);close(out,point(A));
 }
});

test('a reachable zero-length route remains finite at every progress value',()=>{
 const routes=createWalkingRoutes([street(A,A)]),route=routes(point(A),point(A)),out=new THREE.Vector3();
 assert.equal(route.reachable,true);
 assert.equal(route.length,0);
 for(const progress of [-1,0,.5,1,2]){assert.ok(Number.isFinite(moveAlongRoute(route,progress,out)));close(out,point(A));}
});

test('street routes support reverse travel and clamp progress to the endpoints',()=>{
 const route=createWalkingRoutes([street(A,B,C)])(point(C),point(A)),out=new THREE.Vector3();
 assert.equal(route.reachable,true);
 moveAlongRoute(route,-1,out);close(out,point(C));
 moveAlongRoute(route,2,out);close(out,point(A));
});

test('nearest returns a copy and cannot move the underlying street graph',()=>{
 const routes=createWalkingRoutes([street(A,B)]),near=routes.nearest(point(A));
 close(near,point(A));near.addScalar(100);
 close(routes.nearest(point(A)),point(A));
 const route=routes(point(A),point(B));
 assert.equal(route.reachable,true);
 assert.ok(Math.abs(route.length-point(A).distanceTo(point(B)))<1e-9);
});
