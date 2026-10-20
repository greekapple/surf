import type {SurfSpot,Surfboard,UserProfile,Forecast} from '../models/index.ts';
export const defaultProfile:UserProfile={skill:'Intermediate',region:'All regions',scale:'Face height',heightUnit:'ft',windUnit:'mph',minWave:2,maxWave:6,comfort:7,style:'All-around',breakType:'Any',character:'Any',preferredBoards:[],onboarded:false,personalization:false};
const rows:[string,string,SurfSpot['type'],SurfSpot['skill'],number,number,string,string[]][]=[
['Bolinas','Marin','Beach','Beginner',225,220,'Soft',['Currents','Shorebreak']],['Stinson Beach','Marin','Beach','Intermediate',250,240,'Peaky',['Strong currents','Shorebreak']],['Ocean Beach','San Francisco','Beach','Expert',285,270,'Powerful',['Strong currents','Heavy shorebreak']],['Linda Mar','San Mateo','Beach','Beginner',250,250,'Soft',['Currents','Crowds']],['Montara','San Mateo','Beach','Expert',275,270,'Powerful',['Strong currents','Heavy shorebreak']],['Mavericks','San Mateo','Reef','Expert',290,270,'Powerful',['Extreme surf','Rocks','Shallow reef']],['Steamer Lane','Santa Cruz','Point','Expert',250,200,'Steep',['Rocks','Strong currents','Crowds']],['Cowell’s','Santa Cruz','Point','Beginner',210,190,'Soft',['Rocks','Crowds']],['Pleasure Point','Santa Cruz','Reef','Intermediate',230,200,'Peaky',['Shallow reef','Rocks']],['Davenport','Santa Cruz','Beach','Expert',280,270,'Steep',['Strong currents','Rocks']]];
export const spots:SurfSpot[]=rows.map((r,i)=>({id:`spot-${i}`,name:r[0],region:r[1],type:r[2],skill:r[3],idealDirection:r[4],exposure:[.55,.8,1.3,.6,1.1,2.8,1,.45,.85,1.05][i],period:[9,18],tides:i%2?['Rising','High']:['Low','Rising'],seaward:r[5],character:r[6],hazards:r[7],illustrative:true,waveRange:([[1,4],[2,6],[4,10],[1,4],[3,8],[10,22],[3,8],[.5,3],[2,7],[3,8]] as [number,number][])[i],windTolerance:i%3===0?.9:1,organizationPreference:70}));
export const demoBoards:Surfboard[]=[
{id:'demo-fish',name:'Small-day fish',manufacturer:'Demo Workshop',model:'Drift (fictional)',type:'Fish',length:70,width:21,thickness:2.625,volume:36,tail:'Swallow',fins:'Twin',rocker:'Low',character:'Soft',favorite:false,demo:true},
{id:'demo-short',name:'Everyday driver',manufacturer:'Demo Workshop',model:'Arc (fictional)',type:'Performance shortboard',length:72,width:19.5,thickness:2.5,volume:30,tail:'Squash',fins:'Thruster',rocker:'High',character:'Steep',favorite:false,demo:true},
{id:'demo-long',name:'Easy cruiser',manufacturer:'Demo Workshop',model:'Glide (fictional)',type:'Longboard',length:108,width:22.5,thickness:3,volume:72,tail:'Round',fins:'Single',rocker:'Low',character:'Soft',favorite:false,demo:true},
{id:'demo-step',name:'Bigger-day option',manufacturer:'Demo Workshop',model:'Reach (fictional)',type:'Step-up',length:78,width:19.5,thickness:2.75,volume:35,rocker:'High',character:'Powerful',favorite:false,demo:true}];
export const dates=['2026-10-16','2026-10-17','2026-10-18','2026-10-19','2026-10-20','2026-10-21','2026-10-22'];
export const hours=[6,9,12,15,18];
export const forecasts:Forecast[]=spots.flatMap((s,i)=>dates.flatMap((date,day)=>hours.map((hour,t)=>({
 spotId:s.id,timestamp:`${date}T${String(hour).padStart(2,'0')}:00:00-07:00`,day,hour,
 face:+(([3.6,6.3,13,2.4,4.7,7.2,3.1][day]+[0,.3,.5,.2,-.3][t])*s.exposure).toFixed(1),
 offshore:[5,7,12,3,6,8,4][day],primary:{height:[4,6,11,2.5,5,7,3][day],direction:[250,285,300,215,270,290,235][day],period:[12,15,18,9,13,16,11][day]},
 secondary:day===3?null:{height:[1.4,2,3,0,1.7,2.4,1.2][day],direction:205+day*3,period:9},
 tertiary:day===5?{height:1,direction:180,period:7}:null,
 wind:{speed:[3,5,12,17,10][t]+i%3+(day===4?17:day===5?6:0),direction:t<2?(s.seaward+180)%360:(s.seaward+(day===6?90:0))%360,gusts:[6,8,17,23,14][t]+i%3+(day===4?20:0)},
 tide:{height:[1.2,2.8,4.7,3.2,1.5][t],stage:['Low','Rising','High','Falling','Low'][t],trend:t<2?'Rising':'Falling'},
 character:s.character,organization:[85,90,62,42,60][t]-(day===4?25:0),waterTempF:55+i%3,
 confidence:'Demo',source:'Static illustrative dataset',issuedAt:'2026-10-16T06:00:00-07:00',updatedAt:'2026-10-16T06:00:00-07:00',model:'Demo v3',horizon:day*24+hour-6,
 quality:['Simulated','Spot characteristics unverified'],kind:'prediction',
 availability:{face:true,swell:true,wind:!(day===6&&i===9&&t===4),tide:true,organization:true}
}))));
