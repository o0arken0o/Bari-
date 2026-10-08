import * as THREE from 'three';

export type GeoPoint={lat:number;lon:number};
export type Footprint={id:number|string;geometry:GeoPoint[];holes?:GeoPoint[][];tags:Record<string,string>};
export const world=(lat:number,lon:number)=>new THREE.Vector3((lon-16.867)*3350,0,(41.127-lat)*4440);

type Surface={positions:number[];normals:number[];uvs:number[]};
const surface=():Surface=>({positions:[],normals:[],uvs:[]});
function triangle(s:Surface,a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,uv?:number[]){
 const normal=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
 s.positions.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);s.normals.push(...normal.toArray(),...normal.toArray(),...normal.toArray());s.uvs.push(...(uv||[a.x,a.z,b.x,b.z,c.x,c.z]));
}
function quad(s:Surface,a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,uv?:number[]){triangle(s,a,b,c,uv?.slice(0,6));triangle(s,a,c,d,uv?[uv[0],uv[1],uv[4],uv[5],uv[6],uv[7]]:undefined);}
// Facades are specified lower-left, lower-right, upper-right, upper-left.
// Their outward face is the reverse winding of a horizontal ledge.
function facadeQuad(s:Surface,a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,uv?:number[]){quad(s,a,d,c,b,uv?[uv[0],uv[1],uv[6],uv[7],uv[4],uv[5],uv[2],uv[3]]:undefined);}
function meshFrom(s:Surface,material:THREE.Material,shadows=true){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(s.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(s.normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(s.uvs,2));g.computeBoundingSphere();const m=new THREE.Mesh(g,material);m.castShadow=shadows;m.receiveShadow=true;return m;}
const pal=[0xf5f2e9,0xe8ddc7,0xf1e9db,0xe9d4c7,0xf4f3ec,0xdce1dc,0xdfd4bc,0xe2e5dc,0xeddfcc,0xdce1d2,0xddcfc3,0xe9e2d8];

function facadeTexture(withWindows:boolean){
 const size=256,bytes=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const index=(y*size+x)*4,noise=((x*17+y*31+x*y*3)%23)-11,v=242+noise*.5;bytes[index]=bytes[index+1]=bytes[index+2]=v;bytes[index+3]=255;
  if(withWindows){const px=x%128,py=y%128;
   if(px>=39&&px<=88&&py>=27&&py<=92){const border=px<43||px>84||py<31||py>88;bytes[index]=border?217:67+py*.12;bytes[index+1]=border?217:91+py*.09;bytes[index+2]=border?210:104+py*.07;if(px===63||px===64||py===58||py===59){bytes[index]=151;bytes[index+1]=163;bytes[index+2]=163;}}
   if(px>=36&&px<=91&&py>=93&&py<=97){bytes[index]=178;bytes[index+1]=176;bytes[index+2]=163;}
  }
 }
 const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}

function roofTexture(terracotta:boolean){
 const size=128,bytes=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const index=(y*size+x)*4,grain=((x*23+y*47+x*y*7)%19)-9;
  const seam=terracotta&&(y%32<2||(x+(Math.floor(y/32)%2)*8)%16<2);
  const v=terracotta?(seam?178:235+grain):239+grain*.65;
  bytes[index]=v;bytes[index+1]=terracotta?v-5:v;bytes[index+2]=terracotta?v-10:v;bytes[index+3]=255;
 }
 const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(16,16);texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}

export async function createArchitecture(records:Footprint[],stoneTexture:THREE.Texture,signal?:AbortSignal,plasterTexture?:THREE.Texture){
 const group=new THREE.Group(),walls=pal.map(surface),distantWalls=pal.map(surface),roofs=pal.map(surface);const generatedPlaster=plasterTexture?null:facadeTexture(false),plaster=plasterTexture||generatedPlaster!,distantFacade=facadeTexture(true),flatRoof=roofTexture(false),tiledRoof=roofTexture(true);
 const chunks=new Map<string,{x:number;z:number;fallbackWalls:Surface;fallbackColors:number[];windows:Surface;warmWindows:Surface;frames:Surface;ledges:Surface;rails:Surface;roofEquipment:Surface;doors:Surface;shutters:Surface;awnings:Surface}>();
 const centers:{id:string;x:number;z:number;height:number}[]=[];
 let footprintCount=0,windowCount=0;
 const ordered=[...records].sort((a,b)=>{const p=a.geometry[0],q=b.geometry[0];return (p.lat-41.1275)**2+(p.lon-16.874)**2-((q.lat-41.1275)**2+(q.lon-16.874)**2);});
 let lastYield=performance.now();
 const yieldToInput=async()=>{if(performance.now()-lastYield>12){await new Promise<void>(resolve=>setTimeout(resolve,0));lastYield=performance.now();}if(signal?.aborted){group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});generatedPlaster?.dispose();distantFacade.dispose();flatRoof.dispose();tiledRoof.dispose();throw new DOMException('City loading cancelled','AbortError');}};
 for(const record of ordered){
  if(signal?.aborted||performance.now()-lastYield>12)await yieldToInput();
  const points=record.geometry.map(p=>world(p.lat,p.lon));if(points.length>2&&points[0].distanceToSquared(points[points.length-1])<.00001)points.pop();if(points.length<3)continue;
  const contour=points.map(p=>new THREE.Vector2(p.x,p.z));const area=Math.abs(THREE.ShapeUtils.area(contour));if(area<.015||area>150)continue;
  // OSM ring direction varies. Normalize it before both roof and wall creation.
  if(THREE.ShapeUtils.isClockWise(contour)){points.reverse();contour.reverse();}
  const center=points.reduce((a,p)=>a.add(p),new THREE.Vector3()).multiplyScalar(1/points.length);const seed=Number(String(record.id).replace(/\D/g,''))||footprintCount;
  const gx=Math.floor(center.x/8),gz=Math.floor(center.z/8),key=gx+','+gz;let chunk=chunks.get(key);if(!chunk){chunk={x:gx*8+4,z:gz*8+4,fallbackWalls:surface(),fallbackColors:[],windows:surface(),warmWindows:surface(),frames:surface(),ledges:surface(),rails:surface(),roofEquipment:surface(),doors:surface(),shutters:surface(),awnings:surface()};chunks.set(key,chunk);}const {windows,warmWindows,frames,ledges,rails,roofEquipment,doors,shutters,awnings}=chunk;
  const oldTown=center.z<1&&center.z>-35&&center.x>-12&&center.x<46;
  const rawHeight=parseFloat(record.tags.height||'');const rawLevels=parseFloat(record.tags['building:levels']||'');
  const levels=Number.isFinite(rawLevels)?Math.max(1,Math.min(rawLevels,18)):oldTown?2+seed%3:4+seed%4;
  const height=Math.max(.12,Math.min((Number.isFinite(rawHeight)?rawHeight:levels*3.15)/25,4.3));const bucket=seed%pal.length;
  const detail=center.distanceTo(world(41.1281,16.872))<19;const base=.006,top=base+height;
  const holes=(record.holes||[]).map(r=>{const p=r.map(p=>world(p.lat,p.lon));if(p.length>2&&p[0].distanceToSquared(p[p.length-1])<.00001)p.pop();if(!THREE.ShapeUtils.isClockWise(p.map(q=>new THREE.Vector2(q.x,q.z))))p.reverse();return p;}).filter(p=>p.length>=3);const allPoints=points.concat(...holes);const indices=THREE.ShapeUtils.triangulateShape(contour,holes.map(r=>r.map(p=>new THREE.Vector2(p.x,p.z))));if(!indices.length)continue;centers.push({id:String(record.id),x:center.x,z:center.z,height:top});
  const pitched=detail&&oldTown&&seed%5===0&&points.length===4&&!holes.length&&area<2;
  if(pitched){const ridge=new THREE.Vector3(center.x,top+.08,center.z);for(let i=0;i<points.length;i++)triangle(roofs[bucket],points[i].clone().setY(top),ridge,points[(i+1)%points.length].clone().setY(top));}else for(const ids of indices){const p=ids.map(i=>new THREE.Vector3(allPoints[i].x,top,allPoints[i].z));triangle(roofs[bucket],p[0],p[2],p[1]);}
  const rings=[points,...holes];for(let ringIndex=0;ringIndex<rings.length;ringIndex++){const ring=rings[ringIndex];
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];
   const direction=b.clone().sub(a),length=direction.length();if(length<.025)continue;direction.normalize();const normal=new THREE.Vector3(direction.z,0,-direction.x);
   const a0=new THREE.Vector3(a.x,base,a.z),b0=new THREE.Vector3(b.x,base,b.z),a1=a0.clone().setY(top),b1=b0.clone().setY(top);
   const wallUV=[0,0,length*4,0,length*4,height*4,0,height*4];facadeQuad(detail?walls[bucket]:distantWalls[bucket],a0,b0,b1,a1,wallUV);
   if(detail){facadeQuad(chunk.fallbackWalls,a0,b0,b1,a1,wallUV);const color=new THREE.Color(pal[bucket]);for(let v=0;v<6;v++)chunk.fallbackColors.push(color.r,color.g,color.b);}
   // Reconstructed facade details; OSM defines the footprint, not the window layout.
   if(detail&&length>.22&&length<12){
    const cols=Math.min(14,Math.max(1,Math.floor(length/.16))),floors=Math.min(12,Math.max(1,Math.round(height/.125)));
    const step=length/(cols+1),floorStep=height/floors;
    for(let col=1;col<=cols;col++)for(let floor=0;floor<floors;floor++){
     if(windowCount>=32000)break;
     const p=a.clone().addScaledVector(direction,col*step).addScaledVector(normal,.003);p.y=base+floorStep*(floor+.57);
     const ww=Math.min(.044,step*.5),wh=Math.min(.073,floorStep*.6);
     const corners=[p.clone().addScaledVector(direction,-ww/2).add(new THREE.Vector3(0,-wh/2,0)),p.clone().addScaledVector(direction,ww/2).add(new THREE.Vector3(0,-wh/2,0)),p.clone().addScaledVector(direction,ww/2).add(new THREE.Vector3(0,wh/2,0)),p.clone().addScaledVector(direction,-ww/2).add(new THREE.Vector3(0,wh/2,0))];
     facadeQuad((seed+col+floor*7)%5===0?warmWindows:windows,corners[0],corners[1],corners[2],corners[3]);
     if(floor===0&&col%4===seed%4){
      const door=p.clone().setY(base+.047).addScaledVector(normal,.005),dw=ww*1.1;
      facadeQuad(doors,door.clone().addScaledVector(direction,-dw).setY(base),door.clone().addScaledVector(direction,dw).setY(base),door.clone().addScaledVector(direction,dw).setY(base+.094),door.clone().addScaledVector(direction,-dw).setY(base+.094));
      if(!oldTown&&seed%3===0){const back=door.clone().setY(base+.107),front=back.clone().addScaledVector(normal,.04).setY(base+.097);quad(awnings,back.clone().addScaledVector(direction,-dw*1.4),back.clone().addScaledVector(direction,dw*1.4),front.clone().addScaledVector(direction,dw*1.4),front.clone().addScaledVector(direction,-dw*1.4));}
     }
     if(oldTown&&floor>0&&(seed+col)%3===0){for(const side of [-1,1]){const sp=p.clone().addScaledVector(direction,side*ww*.85).addScaledVector(normal,.004);facadeQuad(shutters,sp.clone().addScaledVector(direction,-ww*.22).setY(p.y-wh*.55),sp.clone().addScaledVector(direction,ww*.22).setY(p.y-wh*.55),sp.clone().addScaledVector(direction,ww*.22).setY(p.y+wh*.55),sp.clone().addScaledVector(direction,-ww*.22).setY(p.y+wh*.55));}}
     const sillY=p.y-wh/2-.003,front=p.clone().addScaledVector(normal,.015);front.y=sillY;
     const back=p.clone().setY(sillY);quad(ledges,back.clone().addScaledVector(direction,-ww*.65),back.clone().addScaledVector(direction,ww*.65),front.clone().addScaledVector(direction,ww*.65),front.clone().addScaledVector(direction,-ww*.65));
     if(floor>0&&col%3===seed%3&&floors>2){const balconyWidth=ww*1.5,depth=.035,near=p.clone().setY(sillY),far=near.clone().addScaledVector(normal,depth);quad(ledges,near.clone().addScaledVector(direction,-balconyWidth),near.clone().addScaledVector(direction,balconyWidth),far.clone().addScaledVector(direction,balconyWidth),far.clone().addScaledVector(direction,-balconyWidth));facadeQuad(rails,far.clone().addScaledVector(direction,-balconyWidth),far.clone().addScaledVector(direction,balconyWidth),far.clone().addScaledVector(direction,balconyWidth).add(new THREE.Vector3(0,.025,0)),far.clone().addScaledVector(direction,-balconyWidth).add(new THREE.Vector3(0,.025,0)));}
     windowCount++;
    }
   }
   // Roof parapet instead of an oversized coloured cap.
   if(detail&&!pitched){const lipA=a1.clone().addScaledVector(normal,.009),lipB=b1.clone().addScaledVector(normal,.009);facadeQuad(frames,lipA,lipB,lipB.clone().add(new THREE.Vector3(0,.022,0)),lipA.clone().add(new THREE.Vector3(0,.022,0)));quad(ledges,a1.clone().addScaledVector(normal,-.004).setY(top+.022),b1.clone().addScaledVector(normal,-.004).setY(top+.022),lipB.clone().setY(top+.022),lipA.clone().setY(top+.022));}
   if(detail&&length>.22){const ca=a.clone().addScaledVector(normal,.006).setY(base+.113),cb=b.clone().addScaledVector(normal,.006).setY(base+.113);facadeQuad(frames,ca,cb,cb.clone().add(new THREE.Vector3(0,.009,0)),ca.clone().add(new THREE.Vector3(0,.009,0)));}
  }
  }
  if(detail&&area>.2&&seed%3===0&&holes.length===0){const x=center.x,z=center.z,h=top+.035;quad(roofEquipment,new THREE.Vector3(x-.045,h,z-.025),new THREE.Vector3(x-.045,h,z+.025),new THREE.Vector3(x+.045,h,z+.025),new THREE.Vector3(x+.045,h,z-.025));}
  footprintCount++;
 }
 for(let i=0;i<pal.length;i++){
  const wallMap=i===1||i===6?stoneTexture:plaster;const wallMaterial=new THREE.MeshStandardMaterial({color:pal[i],map:wallMap,roughness:.9,bumpMap:wallMap,bumpScale:.0008});
  const roofMap=i%4===0?tiledRoof:flatRoof;const roofMaterial=new THREE.MeshStandardMaterial({color:i%4===0?0xba8569:i%4===1?0xd6cbb6:i%4===2?0xb9c0c0:0xe3dccd,map:roofMap,bumpMap:roofMap,bumpScale:.0005,roughness:.94});
  wallMaterial.userData.mapColor=0xd1d8dc;wallMaterial.userData.surface='wall';roofMaterial.userData.mapColor=0xe0e4e7;roofMaterial.userData.surface='roof';
  const distantMaterial=new THREE.MeshStandardMaterial({color:pal[i],map:distantFacade,roughness:.9});distantMaterial.userData.mapColor=0xd1d8dc;distantMaterial.userData.surface='wall';
  for(const [s,m]of [[walls[i],wallMaterial],[distantWalls[i],distantMaterial],[roofs[i],roofMaterial]] as [Surface,THREE.Material][]){group.add(meshFrom(s,m));await yieldToInput();}
 }
 const facades=new THREE.Group(),facadeFallbacks=new THREE.Group();group.add(facades,facadeFallbacks);group.userData.facades=facades;group.userData.facadeFallbacks=facadeFallbacks;
 const warmMaterial=new THREE.MeshStandardMaterial({color:0x425663,emissive:0xffb65c,emissiveIntensity:0,metalness:.15,roughness:.35});group.userData.windowLight=warmMaterial;
 const materials={windows:new THREE.MeshStandardMaterial({color:0x426578,metalness:.2,roughness:.32,envMapIntensity:.8}),warmWindows:warmMaterial,frames:new THREE.MeshStandardMaterial({color:0xf1e8d5,roughness:.8}),ledges:new THREE.MeshStandardMaterial({color:0xe1d7c3,roughness:.8}),rails:new THREE.MeshStandardMaterial({color:0x697478,metalness:.65,roughness:.48}),roofEquipment:new THREE.MeshStandardMaterial({color:0x677273,metalness:.3,roughness:.65}),doors:new THREE.MeshStandardMaterial({color:0x3e4948,roughness:.65}),shutters:new THREE.MeshStandardMaterial({color:0x487d6a,roughness:.88}),awnings:new THREE.MeshStandardMaterial({color:0xbb604d,roughness:.92})};
 // A single colored wall mesh per tile replaces culled 3D windows. Polygon
 // offset prevents it fighting the continuously visible plaster beneath it.
 const fallbackMaterial=new THREE.MeshStandardMaterial({map:distantFacade,vertexColors:true,roughness:.9,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});fallbackMaterial.userData.mapColor=0xd1d8dc;fallbackMaterial.userData.surface='facade-fallback';
 const facadeTiles:{group:THREE.Group;fallback:THREE.Group;x:number;z:number}[]=[];
 for(const chunk of chunks.values()){const tile=new THREE.Group(),fallback=new THREE.Group();facades.add(tile);facadeFallbacks.add(fallback);fallback.visible=false;for(const key of Object.keys(materials) as (keyof typeof materials)[]){if(chunk[key].positions.length)tile.add(meshFrom(chunk[key],materials[key],key==='frames'||key==='ledges'));}if(chunk.fallbackWalls.positions.length){const fallbackMesh=meshFrom(chunk.fallbackWalls,fallbackMaterial,false);fallbackMesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(chunk.fallbackColors,3));fallback.add(fallbackMesh);}facadeTiles.push({group:tile,fallback,x:chunk.x,z:chunk.z});await yieldToInput();}group.userData.facadeTiles=facadeTiles;
 group.userData.footprints=footprintCount;group.userData.windows=windowCount;
 return {group,centers};
}

// Shared normals keep adjacent segments joined. Limit miters at acute bends.
export function joinedNormals(points:THREE.Vector3[]){
 return points.map((p,i)=>{
  const before=p.clone().sub(points[Math.max(0,i-1)]),after=points[Math.min(points.length-1,i+1)].clone().sub(p);
  if(before.lengthSq()<1e-10)before.copy(after);if(after.lengthSq()<1e-10)after.copy(before);before.normalize();after.normalize();
  const normal=new THREE.Vector3(-before.z-after.z,0,before.x+after.x);if(normal.lengthSq()<1e-8)return new THREE.Vector3(-after.z,0,after.x);
  normal.normalize();const denominator=Math.max(.4,Math.abs(normal.dot(new THREE.Vector3(-after.z,0,after.x))));return normal.multiplyScalar(Math.min(2.5,1/denominator));
 });
}

export function roadNetwork(roads:{kind?:string;geometry?:GeoPoint[]}[],stoneTexture?:THREE.Texture){
 const asphalt=surface(),major=surface(),sidewalk=surface(),lines=surface(),kerbs=surface();
 const widths:Record<string,number>={motorway:.38,trunk:.38,primary:.32,secondary:.24,tertiary:.19,residential:.14,unclassified:.14,living_street:.10,service:.09,footway:.07,pedestrian:.16,path:.045};
 const pavements=new Set(['pedestrian','footway','path','steps']);
 for(const road of roads){
  const points=(road.geometry||[]).map(p=>world(p.lat,p.lon)).filter((p,i,all)=>!i||p.distanceToSquared(all[i-1])>1e-8);if(points.length<2)continue;
  const normals=joinedNormals(points),width=widths[road.kind||'']||.14,isPedestrian=pavements.has(road.kind||''),roadSurface=width>=.24?major:asphalt;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],na=normals[i-1],nb=normals[i],direction=b.clone().sub(a),length=direction.length();direction.normalize();const normal=new THREE.Vector3(-direction.z,0,direction.x);
   const band=(s:Surface,inner:number,outer:number,y:number)=>quad(s,a.clone().addScaledVector(na,inner).setY(y),b.clone().addScaledVector(nb,inner).setY(y),b.clone().addScaledVector(nb,outer).setY(y),a.clone().addScaledVector(na,outer).setY(y));
   if(isPedestrian){band(sidewalk,-width/2-.01,width/2+.01,.012);}else{
    // A continuous pavement under the carriageway also closes junctions.
    band(sidewalk,-width/2-.048,width/2+.048,.008);band(roadSurface,-width/2,width/2,.013);
    for(const side of [-1,1])band(kerbs,side*(width/2+.003),side*(width/2+.012),.014);
   }
   if(!isPedestrian&&width>=.19){for(let t=.08;t<length;t+=.23){const start=a.clone().addScaledVector(direction,t),end=a.clone().addScaledVector(direction,Math.min(t+.09,length));quad(lines,start.clone().addScaledVector(normal,-.002).setY(.015),end.clone().addScaledVector(normal,-.002).setY(.015),end.clone().addScaledVector(normal,.002).setY(.015),start.clone().addScaledVector(normal,.002).setY(.015));}}
  }
  // Small round caps close shared endpoints without long triangular spikes.
  if(!isPedestrian)for(const p of [points[0],points.at(-1)!])for(let i=0;i<12;i++){const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2;triangle(roadSurface,p.clone().setY(.013),p.clone().add(new THREE.Vector3(Math.sin(a)*width/2,.013,Math.cos(a)*width/2)),p.clone().add(new THREE.Vector3(Math.sin(b)*width/2,.013,Math.cos(b)*width/2)));}
 }
 const group=new THREE.Group();const add=(s:Surface,color:number,mapColor:number,texture?:THREE.Texture)=>{const m=new THREE.MeshStandardMaterial({color,map:texture||null,roughness:.94,side:THREE.DoubleSide});m.userData.mapColor=mapColor;group.add(meshFrom(s,m,false));};
 add(sidewalk,0xdedbd3,0xf6f4ef,stoneTexture);add(asphalt,0x616a70,0xffffff);add(major,0x616a70,0xffe7a8);add(kerbs,0xeae7dc,0xfafafa);add(lines,0xe7e8e1,0xffffff);
 group.children.at(-1)!.userData.hideOnMap=true;return group;
}

export function coastlineLand(points:GeoPoint[],material:THREE.Material){
 const shore=points.map(p=>world(p.lat,p.lon));const shape=new THREE.Shape();shore.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));
 shape.lineTo(1600,-1600);shape.lineTo(-1600,-1600);shape.lineTo(-1600,1300);shape.closePath();const land=new THREE.Mesh(new THREE.ShapeGeometry(shape),material);land.rotation.x=-Math.PI/2;land.receiveShadow=true;return land;
}
