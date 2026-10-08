import * as THREE from 'three';
import type {Footprint} from './city-architecture';
export type CameraBounds={minX:number;maxX:number;minZ:number;maxZ:number};
export function constrainTarget(camera:THREE.Vector3,target:THREE.Vector3,bounds:CameraBounds){
 const x=THREE.MathUtils.clamp(target.x,bounds.minX,bounds.maxX),z=THREE.MathUtils.clamp(target.z,bounds.minZ,bounds.maxZ);
 camera.x+=x-target.x;camera.z+=z-target.z;const changed=x!==target.x||z!==target.z;target.x=x;target.z=z;return changed;
}
function contains(ring:THREE.Vector3[],p:THREE.Vector3){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;}
export function createCameraFloor(records:Footprint[],heights:Map<string,number>){
 const grid=new Map<string,{ring:THREE.Vector3[];holes:THREE.Vector3[][];height:number}[]>();
 const position=(p:{lat:number;lon:number})=>new THREE.Vector3((p.lon-16.867)*3350,0,(41.127-p.lat)*4440);
 for(const record of records){const height=heights.get(String(record.id));if(height===undefined||record.geometry.length<3)continue;const ring=record.geometry.map(position),holes=(record.holes||[]).map(r=>r.map(position));const minX=Math.floor(Math.min(...ring.map(p=>p.x))/3),maxX=Math.floor(Math.max(...ring.map(p=>p.x))/3),minZ=Math.floor(Math.min(...ring.map(p=>p.z))/3),maxZ=Math.floor(Math.max(...ring.map(p=>p.z))/3);if((maxX-minX+1)*(maxZ-minZ+1)>400)continue;const entry={ring,holes,height};for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=x+','+z;const bucket=grid.get(key)||[];bucket.push(entry);grid.set(key,bucket);}}
 return (p:THREE.Vector3)=>{let floor=.12;for(const entry of grid.get(Math.floor(p.x/3)+','+Math.floor(p.z/3))||[]){if(contains(entry.ring,p)&&!entry.holes.some(h=>contains(h,p)))floor=Math.max(floor,entry.height+.12);}return floor;};
}

export function stopOrbitMotion(camera:THREE.PerspectiveCamera,controls:{target:THREE.Vector3;enableDamping:boolean;update:()=>unknown}){
 const position=camera.position.clone(),target=controls.target.clone(),damping=controls.enableDamping;
 try{controls.enableDamping=false;controls.update();}finally{controls.enableDamping=damping;camera.position.copy(position);controls.target.copy(target);camera.lookAt(target);}
}
export function groundPose(position:THREE.Vector3,target:THREE.Vector3){return {position:position.clone().setY(position.y-target.y),target:target.clone().setY(0)};}
