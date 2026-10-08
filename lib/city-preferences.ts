import type {CityQuality} from '@/app/city-scene';
let fallback:CityQuality='auto';
const key='bari-city-quality',event='bari-quality-change';
export function readQuality():CityQuality{try{const value=localStorage.getItem(key);if(value==='auto'||value==='light'||value==='high')return value;}catch{}return fallback;}
export const serverQuality=():CityQuality=>'auto';
export function subscribeQuality(listener:()=>void){const changed=(e:StorageEvent)=>{if(e.key===key||e.key===null)listener();};window.addEventListener('storage',changed);window.addEventListener(event,listener);return()=>{window.removeEventListener('storage',changed);window.removeEventListener(event,listener);};}
export function saveQuality(value:CityQuality){fallback=value;try{localStorage.setItem(key,value);}catch{}window.dispatchEvent(new Event(event));}
