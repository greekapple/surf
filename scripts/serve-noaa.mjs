// Optional service; deploy separately and set VITE_NOAA_PROXY_URL to its /api/buoy/46026 route.
import http from 'node:http';
import worker from '../services/noaa-proxy.mjs';
const port=Number(process.env.SURF_NOAA_PORT||8788);
http.createServer(async(req,res)=>{try{const r=await worker.fetch(new Request('http://localhost:'+port+req.url,{method:req.method}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(500);res.end('Service unavailable.')}}).listen(port,'127.0.0.1',()=>process.stdout.write('NOAA adapter listening on 127.0.0.1:'+port+'\n'));
