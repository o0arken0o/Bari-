import fs from 'node:fs';
const osm=JSON.parse(fs.readFileSync('/tmp/bari_osm_public_businesses.json','utf8'));
const official=JSON.parse(fs.readFileSync('/tmp/bari_official_public_hospitality.json','utf8'));
const cat=t=>t.tourism?(t.tourism==='hotel'?'Hotel':'B&B e case vacanza'):['restaurant','fast_food','food_court'].includes(t.amenity)?'Ristoranti':['cafe','bar','pub','ice_cream'].includes(t.amenity)?'Bar e caffè':t.shop?'Negozi':t.leisure?'Sport e benessere':t.craft?'Artigiani':'Servizi';
const url=s=>{try{const u=new URL(s.startsWith('http')?s:'https://'+s);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
let seen=[];
const records=[];
for(const e of osm.elements){const t=e.tags||{},p=e.center||e;if(!t.name||!p.lat||!p.lon||['government','association','ngo','religion','political_party'].includes(t.office))continue;
const name=t.name.trim(),key=name.toLocaleLowerCase();if(seen.some(x=>x.name===key&&Math.abs(x.lat-p.lat)+Math.abs(x.lon-p.lon)<.0007))continue;seen.push({name:key,lat:p.lat,lon:p.lon});
records.push({id:`osm-${e.type}-${e.id}`,name,category:cat(t),lat:p.lat,lon:p.lon,address:[t['addr:street'],t['addr:housenumber']].filter(Boolean).join(' '),website:url(t.website||t['contact:website']||''),source:'osm',sourceUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`,type:t.tourism||t.shop||t.amenity||t.office||t.craft||t.leisure,openingHours:t.opening_hours||'',sourceDate:osm.osm3s.timestamp_osm_base});}
const rentalsSource=JSON.parse(fs.readFileSync("/tmp/bari_official_public_rentals.json","utf8"));
const mapOfficial=(source)=>source.records.map(t=>({id:'aret-'+t.codice_cin,name:t.denominazione.trim(),category:/albergh|hotel/i.test(t.tipologia)?'Hotel':'B&B e case vacanza',lat:Number(t.latitudine)||null,lon:Number(t.longitudine)||null,address:[t.via_sede_operativa,t.civico_sede_operativa].filter(Boolean).join(' '),website:url(t.sito_web||''),source:'aret',sourceUrl:official.source,type:t.tipologia,cin:t.codice_cin,sourceDate:official.sourceLastModified}));
const aret=mapOfficial(official);const rentals=mapOfficial(rentalsSource);const points=new Map();for(const r of [...aret,...rentals]){if(!r.lat||!r.lon)continue;const key=r.lat+","+r.lon;if(!points.has(key))points.set(key,new Set());points.get(key).add(r.address);}for(const r of [...aret,...rentals]){if((points.get(r.lat+","+r.lon)?.size||0)>5){r.lat=null;r.lon=null;r.locationNote="Coordinate condivise da indirizzi diversi nella fonte: posizione da verificare";}}
rentals.forEach(r=>{r.id=r.id.replace("aret-","rent-");r.category="B&B e case vacanza";});
records.sort((a,b)=>{const rank={Hotel:0,"B&B e case vacanza":1,Ristoranti:2,"Bar e caffè":3,Negozi:4};return (rank[a.category]??5)-(rank[b.category]??5)||a.name.localeCompare(b.name,"it");});
fs.mkdirSync('public/data',{recursive:true});fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('public/data/businesses.json',JSON.stringify({osm:records,aret,rentals,updatedAt:osm.osm3s.timestamp_osm_base}));
fs.writeFileSync('data/catalog.json',JSON.stringify([...records,...aret,...rentals]));
console.log(JSON.stringify({osm:records.length,aret:aret.length,geolocated:records.length+aret.filter(t=>t.lat&&t.lon).length}));
