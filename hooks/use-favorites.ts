'use client';
import {useCallback,useEffect,useState} from 'react';

type Payload={ids?:unknown;error?:unknown;businessId?:unknown;saved?:unknown};
const asPayload=(raw:unknown):Payload=>raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Payload:{};
const messageOf=(value:Payload,fallback:string)=>typeof value.error==='string'?value.error:fallback;

async function fetchFavorites(signal?:AbortSignal):Promise<string[]>{
 const response=await fetch('/api/favorites',{signal});
 const value=asPayload(await response.json());
 if(!response.ok)throw Error(messageOf(value,'Preferite non disponibili.'));
 if(!Array.isArray(value.ids)||!value.ids.every((id:unknown)=>typeof id==='string'))throw Error('Preferite non disponibili. Riprova.');
 return value.ids as string[];
}

/** Saved companies of the signed-in owner. `onError` receives write failures (reads expose `error`). */
export function useFavorites(onError:(message:string)=>void){
 const [favorites,setFavorites]=useState<string[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [pending,setPending]=useState<string[]>([]);

 const apply=useCallback((request:Promise<string[]>,signal?:AbortSignal)=>{
  request
   .then(ids=>{if(!signal?.aborted){setFavorites(ids);setError('');}})
   .catch(e=>{if(!signal?.aborted)setError(e instanceof Error?e.message:'Preferite non disponibili.');})
   .finally(()=>{if(!signal?.aborted)setLoading(false);});
 },[]);

 useEffect(()=>{
  const abort=new AbortController();
  apply(fetchFavorites(abort.signal),abort.signal);
  return()=>abort.abort();
 },[apply]);

 const refresh=useCallback(()=>{setLoading(true);setError('');apply(fetchFavorites());},[apply]);

 // The star changes only after the server confirms the exact change that was requested.
 const toggle=useCallback(async(businessId:string)=>{
  if(loading||error||pending.includes(businessId))return;
  const saved=!favorites.includes(businessId);
  setPending(prev=>[...prev,businessId]);
  try{
   const response=await fetch('/api/favorites',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({businessId,saved})});
   const value=asPayload(await response.json());
   if(!response.ok||value.businessId!==businessId||value.saved!==saved)throw Error(messageOf(value,'Preferita non salvata.'));
   setFavorites(prev=>saved?[...new Set([...prev,businessId])]:prev.filter(id=>id!==businessId));
  }catch(e){
   onError(e instanceof Error?e.message:'Preferita non salvata. Riprova.');
  }finally{
   setPending(prev=>prev.filter(id=>id!==businessId));
  }
 },[loading,error,pending,favorites,onError]);

 return {favorites,loading,error,pending,refresh,toggle};
}
