import type {SurfSpot,Surfboard,UserProfile,Forecast} from '../models/index.ts';
export const defaultProfile:UserProfile={skill:'Intermediate',region:'All regions',scale:'Face height',heightUnit:'ft',windUnit:'mph',minWave:2,maxWave:6,comfort:7,style:'All-around',breakType:'Any',character:'Any',preferredBoards:[],onboarded:false,setupState:'new',personalization:false,previewRegions:false};
const rows:[string,string,SurfSpot['type'],SurfSpot['skill'],number,number,string,string[]][]=[
['Bolinas','Marin','Beach','Beginner',225,220,'Soft',['Currents','Shorebreak']],['Stinson Beach','Marin','Beach','Intermediate',250,240,'Peaky',['Strong currents','Shorebreak']],['Ocean Beach','San Francisco','Beach','Expert',285,270,'Powerful',['Strong currents','Heavy shorebreak']],['Linda Mar','San Mateo','Beach','Beginner',250,250,'Soft',['Currents','Crowds']],['Montara','San Mateo','Beach','Expert',275,270,'Powerful',['Strong currents','Heavy shorebreak']],['Mavericks','San Mateo','Reef','Expert',290,270,'Powerful',['Extreme surf','Rocks','Shallow reef']],['Steamer Lane','Santa Cruz','Point','Expert',250,200,'Steep',['Rocks','Strong currents','Crowds']],['Cowell’s','Santa Cruz','Point','Beginner',210,190,'Soft',['Rocks','Crowds']],['Pleasure Point','Santa Cruz','Reef','Intermediate',230,200,'Peaky',['Shallow reef','Rocks']],['Davenport','Santa Cruz','Beach','Expert',280,270,'Steep',['Strong currents','Rocks']]];
export const spots:SurfSpot[]=rows.map((r,i)=>({id:`spot-${i}`,name:r[0],region:r[1],type:r[2],skill:r[3],idealDirection:r[4],exposure:[.55,.8,1.3,.6,1.1,2.8,1,.45,.85,1.05][i],period:[9,18],tides:i%2?['Rising','High']:['Low','Rising'],seaward:r[5],character:r[6],hazards:r[7],illustrative:true,waveRange:([[1,4],[2,6],[4,10],[1,4],[3,8],[10,22],[3,8],[.5,3],[2,7],[3,8]] as [number,number][])[i],windTolerance:i%3===0?.9:1,organizationPreference:70}));
// The example quiver: four real retail models (user decision 2026-11-11; src/data/referenceBoards.ts for the traced outlines and the sources), shown
// as "Example board (retail model)". Dimensions as published (Seaside, Inferno 72, Ghost checked against the maker's site 2026-11-11; the Wavestorm
// is the retailer's listing, marked unverified in its notes);
// rocker, rails, wave ranges and the board's character are not published, so they stay unset (the category's typical values are used). Never an exact replica.
const MODELLED='Example board: typical size and shape for its type · approximate';
const EX='Example board with typical dimensions for its type. Replace it with your own board to get a match you can rely on.';
export const demoBoards:Surfboard[]=[
{id:'demo-fish',name:'Small-day fish',manufacturer:'',model:'Example',type:'Fish',length:71,width:22.75,thickness:2.75,volume:41.1,tail:'Swallow',fins:'Quad',construction:'EPS / epoxy',favorite:false,demo:true,specificationSource:MODELLED,notes:EX},
{id:'demo-short',name:'Everyday shortboard',manufacturer:'',model:'Example',type:'Performance shortboard',length:70,width:19.25,thickness:2.625,volume:29.4,tail:'Squash',fins:'Thruster',construction:'Carbon-reinforced',favorite:false,demo:true,specificationSource:MODELLED,notes:EX},
{id:'demo-long',name:'Soft-top cruiser',manufacturer:'',model:'Example',type:'Soft-top',length:96,width:22.5,thickness:3.25,volume:86,tail:'Round',fins:'Thruster',construction:'Soft-top',favorite:false,demo:true,specificationSource:MODELLED,notes:EX},
{id:'demo-step',name:'Bigger-day option',manufacturer:'',model:'Example',type:'Step-up',length:78,width:20.5,thickness:3,volume:40.1,tail:'Squash',fins:'Thruster',favorite:false,demo:true,specificationSource:MODELLED,notes:EX}];
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
