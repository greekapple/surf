// Optional portable server/Worker adapter. Fixed public NOAA station: no arbitrary URL proxy.
const upstream='https://www.ndbc.noaa.gov/data/realtime2/46026.txt';
export function createBuoyHandler(fetcher=fetch,now=Date.now){
 let cached=null,pending=null,retryAt=0;
 return async function handle(request){
  const url=new URL(request.url),headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300'};
  if(url.pathname!=='/api/buoy/46026')return Response.json({error:'Unknown public station route.'},{status:404,headers});
  if(request.method!=='GET'&&request.method!=='OPTIONS')return Response.json({error:'GET only.'},{status:405,headers});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS'}});
  if(retryAt>now())return Response.json({error:'NOAA retry window active.'},{status:503,headers:{...headers,'Cache-Control':'no-store'}});
  try{
   if(cached&&cached.expires>now())return Response.json(cached.value,{headers});
   if(!pending)pending=(async()=>{
    const response=await fetcher(upstream,{signal:AbortSignal.timeout(10000),headers:{Accept:'text/plain'}});
    if(!response.ok){if(response.status===429)retryAt=now()+60000;throw new Error('NOAA HTTP '+response.status);}
    const reader=response.body?.getReader();if(!reader)throw new Error('Empty NOAA response.');let bytes=0;const parts=[];
    try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1000000)throw new Error('Oversized NOAA response.');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
    const combined=new Uint8Array(bytes);let offset=0;for(const p of parts){combined.set(p,offset);offset+=p.length;}const text=new TextDecoder().decode(combined);
    if(!text.startsWith('#YY')||!text.includes('WVHT'))throw new Error('Unexpected NOAA response format.');
    const value={station:'46026',text,retrievedAt:new Date(now()).toISOString(),upstream};cached={value,expires:now()+300000};return value;
   })().finally(()=>{pending=null});
   return Response.json(await pending,{headers});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'NOAA unavailable.'},{status:502,headers:{...headers,'Cache-Control':'no-store'}})}
 };
}
const handle=createBuoyHandler();
export default {fetch:handle};
