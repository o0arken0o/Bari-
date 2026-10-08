import * as THREE from 'three';
import { world, joinedNormals, type GeoPoint } from './city-architecture';

export type CityRoad = {kind?:string;name?:string;geometry?:GeoPoint[]};
type Track = {points:THREE.Vector3[];lengths:number[];length:number;angle:number};
export type WalkingRoute = Track & {reachable:boolean};
const pedestrianKinds = new Set(['pedestrian','footway','path','steps','living_street']);
const roadWidth:Record<string,number>={primary:.32,secondary:.24,tertiary:.19,residential:.14,service:.09,pedestrian:.16,footway:.07,living_street:.10};
function track(points:THREE.Vector3[]):Track {const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+points[i].distanceTo(points[i-1]));return {points,lengths,length:lengths.at(-1)||0,angle:0};}
function sample(t:Track,distance:number,out:THREE.Vector3){if(t.points.length<2){out.copy(t.points[0]);t.angle=0;return out;}let i=1;while(i<t.lengths.length-1&&t.lengths[i]<distance)i++;const a=t.points[i-1],b=t.points[i],length=t.lengths[i]-t.lengths[i-1];out.lerpVectors(a,b,length?THREE.MathUtils.clamp((distance-t.lengths[i-1])/length,0,1):0);t.angle=Math.atan2(b.x-a.x,b.z-a.z);return out;}
function instances(group:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,poses:{p:THREE.Vector3;scale?:THREE.Vector3;angle?:number;color?:number}[],shadows=true){
 const mesh=new THREE.InstancedMesh(geometry,material,poses.length),dummy=new THREE.Object3D();poses.forEach((pose,i)=>{dummy.position.copy(pose.p);dummy.scale.copy(pose.scale||new THREE.Vector3(1,1,1));dummy.rotation.set(0,pose.angle||0,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(pose.color!==undefined)mesh.setColorAt(i,new THREE.Color(pose.color));});mesh.castShadow=shadows;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);return mesh;
}

// Furniture and people are visual reconstructions, positioned along public streets/coast.
export function createCityLife(roads:CityRoad[],coast:GeoPoint[]){
 const group=new THREE.Group(),street=new THREE.Group(),life=new THREE.Group();group.add(street,life);
 const material=(color:number,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
 const metal=material(0x354b50,.55),wood=material(0x805e42),stone=material(0xe7dcca),lampMaterial=new THREE.MeshStandardMaterial({color:0xf3e7c5,emissive:0xffca71,emissiveIntensity:0,roughness:.45});
 const lampPositions:THREE.Vector3[]=[],benchPoses:{p:THREE.Vector3;angle:number}[]=[],planters:{p:THREE.Vector3}[]=[],citizenTracks:Track[]=[],trafficTracks:Track[]=[];
 const center=world(41.1265,16.874);
 for(const [index,road]of roads.entries()){
  if(!road.geometry||road.geometry.length<2)continue;
  const points=road.geometry.map(p=>world(p.lat,p.lon));if(points[0].distanceTo(center)>45)continue;
  const t=track(points);if(t.length<.3||t.length>45)continue;
  const walking=pedestrianKinds.has(road.kind||'');
  if(citizenTracks.length<140&&(walking||index%4===0)){const side=(roadWidth[road.kind||'']||.14)/2+.025;const shifted=points.map((p,i)=>{const q=points[Math.min(i+1,points.length-1)],prev=points[Math.max(i-1,0)],dir=q.clone().sub(prev).normalize();return p.clone().add(new THREE.Vector3(-dir.z*side,.018,dir.x*side));});citizenTracks.push(track(shifted));}
  if(!walking&&!['motorway','trunk','steps'].includes(road.kind||'')&&trafficTracks.length<36&&t.length>.8&&index%8===0){const shifted=points.map((p,i)=>{const q=points[Math.min(i+1,points.length-1)],prev=points[Math.max(i-1,0)],dir=q.clone().sub(prev).normalize();return p.clone().add(new THREE.Vector3(-dir.z*.025,.021,dir.x*.025));});trafficTracks.push(track(shifted));}
  if(index%4===0&&lampPositions.length<150){const q=points[1],dir=q.clone().sub(points[0]).normalize(),side=(roadWidth[road.kind||'']||.14)/2+.045;const p=points[0].clone().add(new THREE.Vector3(-dir.z*side,.015,dir.x*side));lampPositions.push(p);if(walking&&index%8===0)benchPoses.push({p:p.clone().addScaledVector(dir,.16),angle:Math.atan2(dir.x,dir.z)});}
 }
 // The source coastline is ordered northwest to southeast; land is on its left.
 const shoreline=coast.map(p=>world(p.lat,p.lon)),normals=joinedNormals(shoreline);
 const promenadeVertices:number[]=[],seaWallVertices:number[]=[];const lastFurniture=new THREE.Vector3(9999,0,0);
 const vertices=(dest:number[],a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3)=>dest.push(...a.toArray(),...b.toArray(),...c.toArray(),...a.toArray(),...c.toArray(),...d.toArray());
 for(let i=1;i<shoreline.length;i++){
  const geo=coast[i];if(geo.lat<41.118||geo.lat>41.134||geo.lon<16.871||geo.lon>16.894)continue;
  const a=shoreline[i-1],b=shoreline[i],na=normals[i-1],nb=normals[i],dir=b.clone().sub(a);if(dir.length()<.001)continue;dir.normalize();
  const p=a.clone().addScaledVector(na,.005).setY(.017),q=b.clone().addScaledVector(nb,.005).setY(.017),r=b.clone().addScaledVector(nb,.24).setY(.017),s=a.clone().addScaledVector(na,.24).setY(.017);
  vertices(promenadeVertices,p,q,r,s);vertices(seaWallVertices,p.clone().setY(-.04),q.clone().setY(-.04),q,p);
  if(a.distanceTo(lastFurniture)>.8){lastFurniture.copy(a);const inland=na.clone().normalize(),pos=a.clone().addScaledVector(inland,.17).setY(.018);lampPositions.push(pos);benchPoses.push({p:pos.clone().addScaledVector(dir,.2),angle:Math.atan2(inland.x,inland.z)});planters.push({p:pos.clone().addScaledVector(dir,-.2)});}
 }
 for(const [vertices,color]of [[promenadeVertices,0xe5e1d8],[seaWallVertices,0xa9afa9]] as [number[],number][]){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.95,side:THREE.DoubleSide}));mesh.receiveShadow=true;street.add(mesh);}
 const planted=planters.filter((_,i)=>i%3===0);
 instances(street,new THREE.CylinderGeometry(.008,.012,.17,7),material(0x796b50),planted.map(p=>({p:p.p.clone().add(new THREE.Vector3(0,.12,0))})));
 instances(street,new THREE.IcosahedronGeometry(1,2),material(0x64894d),planted.map((p,i)=>({p:p.p.clone().add(new THREE.Vector3(0,.24,0)),scale:new THREE.Vector3(.11,.08,.1),angle:i*.7})));
 instances(street,new THREE.IcosahedronGeometry(1,1),material(0x7a9a59),planted.map((p,i)=>({p:p.p.clone().add(new THREE.Vector3(.04,.25,-.03)),scale:new THREE.Vector3(.075,.055,.07),angle:i*.5})));
 instances(street,new THREE.CylinderGeometry(.005,.007,.16,6),metal,lampPositions.map(p=>({p:p.clone().add(new THREE.Vector3(0,.08,0))})));
 instances(street,new THREE.BoxGeometry(.045,.006,.025),metal,lampPositions.map(p=>({p:p.clone().add(new THREE.Vector3(.016,.163,0))})));
 instances(street,new THREE.BoxGeometry(.036,.004,.018),lampMaterial,lampPositions.map(p=>({p:p.clone().add(new THREE.Vector3(.016,.159,0))})),false);
 instances(street,new THREE.BoxGeometry(.12,.014,.038),wood,benchPoses.map(p=>({p:p.p.clone().add(new THREE.Vector3(0,.02,0)),angle:p.angle})));
 instances(street,new THREE.BoxGeometry(.12,.037,.009),wood,benchPoses.map(p=>({p:p.p.clone().add(new THREE.Vector3(Math.sin(p.angle)*-.018,.043,Math.cos(p.angle)*-.018)),angle:p.angle})));
 instances(street,new THREE.CylinderGeometry(.035,.026,.035,8),stone,planters.map(p=>({p:p.p.clone().add(new THREE.Vector3(0,.018,0))})));
 instances(street,new THREE.SphereGeometry(.03,6,5),material(0x49654c),planters.map(p=>({p:p.p.clone().add(new THREE.Vector3(0,.045,0)),scale:new THREE.Vector3(1,.6,1)})));
 const peopleMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92});
 const people=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.012,.031,2,5),peopleMaterial,citizenTracks.length),heads=new THREE.InstancedMesh(new THREE.SphereGeometry(.008,6,5),material(0xcbb29c),citizenTracks.length),legs=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.004,.019,2,4),material(0x374149),citizenTracks.length*2);people.castShadow=heads.castShadow=true;life.add(people,heads,legs);
 const colors=[0x446b72,0xeee5d6,0x9c584c,0x65754c,0xc28a49,0x4b5068];for(let i=0;i<citizenTracks.length;i++)people.setColorAt(i,new THREE.Color(colors[i%colors.length]));
 const cars=new THREE.InstancedMesh(new THREE.BoxGeometry(.065,.032,.15),new THREE.MeshStandardMaterial({color:0xffffff,metalness:.35,roughness:.3}),trafficTracks.length),glass=new THREE.InstancedMesh(new THREE.BoxGeometry(.055,.027,.076),material(0x35515e,.2),trafficTracks.length);cars.castShadow=true;life.add(cars,glass);for(let i=0;i<trafficTracks.length;i++)cars.setColorAt(i,new THREE.Color([0xe9e5dc,0x414c55,0x73574c,0x527884][i%4]));
 const dummy=new THREE.Object3D(),point=new THREE.Vector3();let lastTime=-1;
 function update(time:number,target:THREE.Vector3,distance:number,night:number){
  street.visible=distance<85;life.visible=distance<55;lampMaterial.emissiveIntensity=night*3.5;
  if(!life.visible||time===lastTime)return;lastTime=time;
  citizenTracks.forEach((t,i)=>{const travel=((time*.051+i*.231)%(t.length*2)),forward=travel<t.length;sample(t,forward?travel:t.length*2-travel,point);const angle=t.angle+(forward?0:Math.PI);dummy.position.copy(point).add(new THREE.Vector3(0,.043,0));dummy.scale.set(1,1,1);dummy.rotation.set(0,angle,0);dummy.updateMatrix();people.setMatrixAt(i,dummy.matrix);dummy.position.y=point.y+.075;dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);for(let leg=0;leg<2;leg++){dummy.position.copy(point).add(new THREE.Vector3(Math.cos(angle)*(leg?-.006:.006),.014,Math.sin(angle)*(leg?.006:-.006)));dummy.rotation.set(Math.sin(time*7+i+leg*Math.PI)*.38,angle,0);dummy.updateMatrix();legs.setMatrixAt(i*2+leg,dummy.matrix);}});
  trafficTracks.forEach((t,i)=>{sample(t,(time*.24+i*.52)%t.length,point);dummy.position.copy(point).add(new THREE.Vector3(0,.025,0));dummy.rotation.set(0,t.angle,0);dummy.updateMatrix();cars.setMatrixAt(i,dummy.matrix);dummy.position.y=point.y+.047;dummy.updateMatrix();glass.setMatrixAt(i,dummy.matrix);});
  [people,heads,legs,cars,glass].forEach(m=>{m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();});
 }
 const obstacles=[...lampPositions.map(p=>({p,radius:.035})),...benchPoses.map(b=>({p:b.p,radius:.085})),...planters.map(p=>({p:p.p,radius:.065}))];
 const clearOfFurniture=(p:THREE.Vector3,margin=0)=>!obstacles.some(o=>Math.hypot(p.x-o.p.x,p.z-o.p.z)<o.radius+margin);
 return {group,update,clearOfFurniture,people:citizenTracks.length,cars:trafficTracks.length,lamps:lampPositions.length};
}

export function createAgent(color:number){
 const group=new THREE.Group(),suit=new THREE.MeshStandardMaterial({color,roughness:.65}),dark=new THREE.MeshStandardMaterial({color:0x263a44}),skin=new THREE.MeshStandardMaterial({color:0xd4af91});
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.014,.034,3,6),suit);torso.position.y=.049;group.add(torso);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.01,8,6),skin);head.position.y=.088;group.add(head);
 const limbs:THREE.Group[]=[];
 for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.008,.026,0);const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(.005,.023,2,5),dark);mesh.position.y=-.012;leg.add(mesh);group.add(leg);limbs.push(leg);const arm=new THREE.Group();arm.position.set(side*.019,.064,0);const meshArm=new THREE.Mesh(new THREE.CapsuleGeometry(.004,.021,2,5),suit);meshArm.position.y=-.012;arm.add(meshArm);group.add(arm);limbs.push(arm);}
 const document=new THREE.Mesh(new THREE.BoxGeometry(.018,.024,.003),new THREE.MeshStandardMaterial({color:0xf6eed8}));document.position.set(.026,.045,.012);group.add(document);
 const shirt=new THREE.Mesh(new THREE.BoxGeometry(.013,.032,.004),new THREE.MeshStandardMaterial({color:0xf1ede3,roughness:.9}));shirt.position.set(0,.054,.014);group.add(shirt);const tie=new THREE.Mesh(new THREE.BoxGeometry(.003,.025,.002),dark);tie.position.set(0,.053,.017);group.add(tie);
 const hair=new THREE.Mesh(new THREE.SphereGeometry(.0105,8,5,0,Math.PI*2,0,Math.PI*.63),new THREE.MeshStandardMaterial({color:0x4b3830,roughness:1}));hair.position.set(0,.090,-.001);group.add(hair);
 for(const x of [-.0035,.0035]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.0014,4,3),dark);eye.position.set(x,.089,.009);group.add(eye);const shoe=new THREE.Mesh(new THREE.BoxGeometry(.009,.006,.014),dark);shoe.position.set(x*2,.003,.002);group.add(shoe);}
 group.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;});group.userData.limbs=limbs;
 return group;
}

export function createWalkingRoutes(roads:CityRoad[]){
 const nodes:{p:THREE.Vector3;edges:Map<number,number>}[]=[],ids=new Map<string,number>();
 for(const road of roads){if(['motorway','trunk'].includes(road.kind||''))continue;let previous=-1;for(const geo of road.geometry||[]){const key=geo.lat.toFixed(6)+','+geo.lon.toFixed(6);let id=ids.get(key);if(id===undefined){id=nodes.length;ids.set(key,id);nodes.push({p:world(geo.lat,geo.lon),edges:new Map()});}if(previous>=0&&previous!==id){const d=nodes[id].p.distanceTo(nodes[previous].p);nodes[id].edges.set(previous,d);nodes[previous].edges.set(id,d);}previous=id;}}
 function nearest(p:THREE.Vector3){let index=0,distance=Infinity;nodes.forEach((n,i)=>{const d=n.p.distanceToSquared(p);if(d<distance){distance=d;index=i;}});return index;}
 const route=(from:THREE.Vector3,to:THREE.Vector3):WalkingRoute=>{
  // Missing/disconnected street geometry cannot justify a straight line through the city.
  const stationary=():WalkingRoute=>({...track([from.clone()]),reachable:false});
  if(!nodes.length)return stationary();const start=nearest(from),end=nearest(to),cost=new Map<number,number>([[start,0]]),previous=new Map<number,number>(),visited=new Set<number>(),queue:{id:number;rank:number}[]=[{id:start,rank:0}];
  function push(value:{id:number;rank:number}){queue.push(value);let i=queue.length-1;while(i>0){const parent=(i-1)>>1;if(queue[parent].rank<=value.rank)break;queue[i]=queue[parent];i=parent;}queue[i]=value;}
  function pop(){const first=queue[0],last=queue.pop()!;if(queue.length){let i=0;while(i*2+1<queue.length){let child=i*2+1;if(child+1<queue.length&&queue[child+1].rank<queue[child].rank)child++;if(queue[child].rank>=last.rank)break;queue[i]=queue[child];i=child;}queue[i]=last;}return first;}
  while(queue.length&&visited.size<15000){const {id}=pop();if(visited.has(id))continue;visited.add(id);if(id===end)break;for(const [next,d]of nodes[id].edges){const value=(cost.get(id)||0)+d;if(value<(cost.get(next)??Infinity)){cost.set(next,value);previous.set(next,id);push({id:next,rank:value+nodes[next].p.distanceTo(nodes[end].p)});}}}
  if(!visited.has(end))return stationary();
  const positions:THREE.Vector3[]=[];let id=end;while(id!==start){positions.push(nodes[id].p.clone());id=previous.get(id)!;}positions.push(nodes[start].p.clone());positions.reverse();
  return {...track([from.clone(),...positions,to.clone()]),reachable:true};
 };
 route.nearest=(p:THREE.Vector3)=>nodes.length?nodes[nearest(p)].p.clone():p.clone();
 return route;
}

export function moveAlongRoute(route:Track,progress:number,position:THREE.Vector3){sample(route,THREE.MathUtils.clamp(progress,0,1)*route.length,position);return route.angle;}
