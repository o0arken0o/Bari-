import type {Business,Report} from '@/lib/audit';
import type {CommercialDraft} from '@/lib/commercial';

export type Mission={id:string;status:string;report:Report;business_name?:string;created_at?:string;commercial?:CommercialDraft};
export type BatchRow={business:Business;status:'queued'|'working'|'verifying'|'ready'|'error';mission?:Mission;error?:string};
export type Catalog={osm:Business[];aret:Business[];rentals?:Business[];updatedAt:string};
export type MissionArchive={missions:Mission[];sender:string;aiConfigured:boolean};

export const missionLabel=(m:Mission)=>m.status==='completed'?(m.report.prototypes===undefined?'Demo pronta':m.report.prototypes.length?m.report.prototypes.length+' prototipi pronti':'Analisi conclusa · nessun prototipo'):m.report.verificationVersion===1?'Demo costruite · verifica da completare':'Verifica da completare';

export async function missionArchive(signal?:AbortSignal):Promise<MissionArchive>{
 const response=await fetch('/api/missions',{signal});
 const value=await response.json() as {missions?:Mission[];sender?:string;aiConfigured?:boolean;error?:string};
 if(!response.ok)throw Error(value.error||'Archivio non disponibile. Riprova.');
 if(!Array.isArray(value.missions))throw Error('Archivio non disponibile. Riprova.');
 return {missions:value.missions,sender:value.sender||'',aiConfigured:value.aiConfigured===true};
}
