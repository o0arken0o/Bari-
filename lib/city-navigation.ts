import * as THREE from 'three';
import {world,type Footprint,type GeoPoint} from './city-architecture';

function contains(ring:THREE.Vector3[],point:THREE.Vector3){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a.z>point.z)!==(b.z>point.z)&&point.x<(b.x-a.x)*(point.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
 }
 return inside;
}

// Ground-level navigation uses published footprints and the same land boundary as the scene.
export function createWalkableArea(records:Footprint[],coast:GeoPoint[]){
 const shore=coast.map(p=>world(p.lat,p.lon));
 const land=[...shore,new THREE.Vector3(1600,0,1600),new THREE.Vector3(-1600,0,1600),new THREE.Vector3(-1600,0,-1300)];
 const grid=new Map<string,{ring:THREE.Vector3[];holes:THREE.Vector3[][]}[]>();
 for(const record of records){
  if(record.geometry.length<3)continue;
  const ring=record.geometry.map(p=>world(p.lat,p.lon)),holes=(record.holes||[]).map(r=>r.map(p=>world(p.lat,p.lon)));
  const xs=ring.map(p=>p.x),zs=ring.map(p=>p.z),minX=Math.floor(Math.min(...xs)/3),maxX=Math.floor(Math.max(...xs)/3),minZ=Math.floor(Math.min(...zs)/3),maxZ=Math.floor(Math.max(...zs)/3);
  if((maxX-minX+1)*(maxZ-minZ+1)>400)continue;
  const entry={ring,holes};for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=x+','+z;const bucket=grid.get(key)||[];bucket.push(entry);grid.set(key,bucket);}
 }
 return (p:THREE.Vector3)=>contains(land,p)&&!(grid.get(Math.floor(p.x/3)+','+Math.floor(p.z/3))||[]).some(b=>contains(b.ring,p)&&!b.holes.some(h=>contains(h,p)));
}

export function moveOnGround(from:THREE.Vector3,delta:THREE.Vector3,walkable:(p:THREE.Vector3)=>boolean){
 const result=from.clone();const steps=Math.max(1,Math.ceil(delta.length()/.015));
 const step=delta.clone().multiplyScalar(1/steps);
 for(let i=0;i<steps;i++){const next=result.clone().add(step);if(walkable(next))result.copy(next);else{const x=result.clone();x.x+=step.x;if(walkable(x))result.copy(x);const z=result.clone();z.z+=step.z;if(walkable(z))result.copy(z);}}
 return result;
}
