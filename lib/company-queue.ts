// Each task settles independently; a failed company does not stop the others.
export async function companyQueue<T>(items:T[],parallel:number,work:(item:T,index:number)=>Promise<void>):Promise<PromiseSettledResult<void>[]>{
 if(!Number.isInteger(parallel)||parallel<1||parallel>4)throw Error('Scegli da una a quattro aziende in parallelo.');
 let next=0;const results:PromiseSettledResult<void>[]=new Array(items.length);
 await Promise.all(Array.from({length:Math.min(parallel,items.length)},async()=>{
  while(next<items.length){const index=next++;try{await work(items[index],index);results[index]={status:'fulfilled',value:undefined};}catch(reason){results[index]={status:'rejected',reason};}}
 }));
 return results;
}
