import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createArchitecture, world} from '../lib/city-architecture.ts';

const center=world(41.1281,16.872);
const geo=(x,z)=>({lon:16.867+x/3350,lat:41.127-z/4440});
const rectangle=(halfX,halfZ,reverse=false)=>{
 const points=[[-halfX,-halfZ],[halfX,-halfZ],[halfX,halfZ],[-halfX,halfZ]].map(([x,z])=>geo(center.x+x,center.z+z));
 return reverse?points.reverse():points;
};
const record=(id,reverse=false,holes=[])=>({id,geometry:rectangle(.3,.25,reverse),holes,tags:{'building:levels':'3'}});
const meshes=(group,kind)=>{
 const result=[];group.traverse(mesh=>{if(mesh.isMesh&&mesh.material.userData.surface===kind&&mesh.geometry.getAttribute('position').count)result.push(mesh);});return result;
};
const triangles=mesh=>{
 const positions=mesh.geometry.getAttribute('position'),normals=mesh.geometry.getAttribute('normal'),result=[];
 for(let i=0;i<positions.count;i+=3)result.push({points:[0,1,2].map(offset=>new THREE.Vector3().fromBufferAttribute(positions,i+offset)),normal:new THREE.Vector3().fromBufferAttribute(normals,i)});
 return result;
};
const dispose=group=>{
 const materials=new Set(),textures=new Set();group.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.dispose();materials.add(mesh.material);for(const texture of [mesh.material.map,mesh.material.bumpMap])if(texture)textures.add(texture);});materials.forEach(material=>material.dispose());textures.forEach(texture=>texture.dispose());
};

test('clockwise and counterclockwise pitched roofs face the sky',async()=>{
 for(const reverse of [false,true]){
  const {group}=await createArchitecture([record(10,reverse)],new THREE.Texture());
  try{
   const roofTriangles=meshes(group,'roof').flatMap(triangles);assert.equal(roofTriangles.length,4);
   roofTriangles.forEach(({normal})=>assert.ok(normal.y>.1,'pitched roof normal must face upward'));
   meshes(group,'wall').flatMap(triangles).forEach(({points,normal})=>{
    const middle=points.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).divideScalar(3).sub(center).setY(0);
    assert.ok(normal.dot(middle)>0,'outer wall must face away from the building');
   });
  }finally{dispose(group);}
 }
});

test('courtyard walls face into the courtyard and its roof remains open',async()=>{
 const {group}=await createArchitecture([record(11,true,[rectangle(.1,.08)])],new THREE.Texture());
 try{
  const walls=meshes(group,'wall').flatMap(triangles);assert.equal(walls.length,16);
  for(const {points,normal} of walls){
   const middle=points.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).divideScalar(3).sub(center).setY(0);
   const courtyard=Math.abs(middle.x)<.12&&Math.abs(middle.z)<.1;
   assert.ok(courtyard?normal.dot(middle)<0:normal.dot(middle)>0,'wall direction must respect courtyard holes');
  }
  const roofs=meshes(group,'roof').flatMap(triangles);let projectedArea=0;
  for(const {points:[a,b,c],normal} of roofs){assert.ok(normal.y>.999);projectedArea+=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))/2;}
  assert.ok(Math.abs(projectedArea-(.6*.5-.2*.16))<.00001,'roof area must exclude the courtyard');
 }finally{dispose(group);}
});

test('detail culling retains an independent window-texture facade fallback',async()=>{
 const stone=new THREE.Texture(),plaster=new THREE.Texture();const {group}=await createArchitecture([record(12)],stone,undefined,plaster);
 try{
  assert.ok(meshes(group,'wall').some(mesh=>mesh.material.map===plaster),'detail walls must use the supplied plaster');
  const [tile]=group.userData.facadeTiles;assert.ok(tile.group.children.length>0);assert.equal(tile.fallback.parent,group.userData.facadeFallbacks);assert.notEqual(tile.fallback.parent,group.userData.facades);
  tile.group.visible=false;tile.fallback.visible=true;group.userData.facades.visible=false;
  assert.equal(tile.fallback.parent.visible,true,'fallback must survive hiding the detail parent');
  const fallback=meshes(tile.fallback,'facade-fallback')[0];assert.ok(fallback);assert.equal(fallback.material.vertexColors,true);assert.equal(fallback.geometry.getAttribute('color').count,fallback.geometry.getAttribute('position').count);assert.equal(fallback.material.side,THREE.FrontSide);
 }finally{dispose(group);}
});

test('an already cancelled load does not dispose the caller-owned plaster texture',async()=>{
 const controller=new AbortController();controller.abort();const plaster=new THREE.Texture();let disposed=false;plaster.addEventListener('dispose',()=>{disposed=true;});
 await assert.rejects(createArchitecture([record(10)],new THREE.Texture(),controller.signal,plaster),error=>error.name==='AbortError');assert.equal(disposed,false);
});
