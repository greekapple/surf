import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {ATLAS_BANDS, type Atlas, type AtlasMeta, blendAtlas, breakX, bucketIdFor, bucketsFor, facePoint, loadAtlas, profileAt, scaleAtlas, stageAt, stripX, surferX, waterHeightAt, withPeriod} from './waveAtlas';
import {type WaveSpec, sameSpec, windLook} from './waveSpec';
import {type Lighting, lightingAt} from './solar';
import {boardGeometry, boardShape} from './boardMesh';
import {loadOutline} from '../quiver/outline';
import type {Surfboard} from '../../models/index';

/** Real-time 3D wave (T-062, wave-v3, forecast-driven): a plain grid whose vertex shader samples a break-cycle profile atlas by (u along
 *  the profile, stage(x, t)), so the wave peaks, feathers, pitches, lands and collapses into a foam ball down the line; an endless sea
 *  with the set waves out the back, a water shader coloured by thickness, a surfer (a 1.75 m model scaled to the person's height, T-099), lip spray, back-spray and mist, and full
 *  orbit control. The frame moves with the peel (the surfer stays put, the water streams past). The wave is the selected spot-hour's
 *  forecast: the face height is the estimate's centre (the two size buckets around it blended), the breaker type, swell period and wind
 *  relation shape it, and the peel direction can be flipped (left/right). An illustration of that hour, approximate, never a measurement.
 *  Loaded lazily; Spin360 stays the fallback (no WebGL, reduced motion, or no atlas files). */
const BASE = import.meta.env.BASE_URL ?? '/';
export const LIVE_ROOT = BASE + 'media/scale3d-live/';
export const ATLAS_ROOT = BASE + 'media/scale3d-atlas/';
/** The light comes from the sun's position at the spot and hour (P5a); null keeps a neutral daylight. */
export interface LiveLight {spotId: string; iso: string}

const SUN = new THREE.Vector3(0.15, 0.3, -0.94).normalize();
const HORIZON = new THREE.Color('#dde4e6'), SKY_TOP = new THREE.Color('#86a3bb');

const NOISE = /* glsl */ `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
float h3(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1.,0.,0.)),f.x),mix(h3(i+vec3(0.,1.,0.)),h3(i+vec3(1.,1.,0.)),f.x),f.y),
             mix(mix(h3(i+vec3(0.,0.,1.)),h3(i+vec3(1.,0.,1.)),f.x),mix(h3(i+vec3(0.,1.,1.)),h3(i+vec3(1.,1.,1.)),f.x),f.y),f.z); }`;

// Along-crest maths: keep in step with stageAt / ampAt / sections in waveAtlas.ts.
const ALONG = /* glsl */ `
uniform float uTime, uFace, uNS, uNP, uPitch, uDb, uBed, uSh, uBl, uCyc, uX0, uX1;
float sections(float x, float t){ float lam=.32*uBl, ts=.55*uCyc; return .28*sin(6.2831853*(x/lam-t/ts))*smoothstep(-.1*lam,.25*lam,x)*(1.-smoothstep(.55*uBl,uBl,x)); }
float stageAt(float x, float t){
  float s;
  if (x<0.) { float d=uDb+uBed*(-x), g=uDb/d, g0=uDb/(uDb+uBed*uSh); s=uPitch*pow(clamp((g-g0)/(1.-g0),0.,1.),1.6); }
  else s=uPitch+(uNS-1.-uPitch)*clamp(x/uBl,0.,1.);
  return clamp(s+sections(x,t),0.,uNS-1.);
}
float ampAt(float x){
  float a;
  if (x<0.) { float d=uDb+uBed*(-x), pk=exp(-pow(x/(.55*uSh),2.)); a=pow(uDb/d,.25)*(.42+.58*pk); }
  else a=1.-.35*smoothstep(.5*uBl,1.25*uBl,x);
  float F=max(uFace,.6); a*=1.+.05*sin(x*.37/F+1.3)+.035*sin(x*.91/F+4.1);
  return a*smoothstep(uX0,.7*uX0,x)*(1.-smoothstep(.7*uX1,uX1,x));
}`;

const STRIP_VS = /* glsl */ `
precision highp float;
uniform sampler2D uAtlas;
${ALONG}
${NOISE}
varying vec3 vW; varying vec3 vN; varying vec4 vA; varying float vS; varying vec3 vL;
// manual bilinear with full-precision weights (hardware filtering quantises them to 1/256, which shows as banding along the crest)
vec4 atl(float u, float s, float row0){
  float fu=clamp(u,0.,1.)*(uNP-1.), fs=clamp(s,0.,uNS-1.);
  int i0=int(floor(fu)), j0=int(floor(fs)); int i1=min(i0+1,int(uNP)-1), j1=min(j0+1,int(uNS)-1); float du=fu-float(i0), ds=fs-float(j0); int r=int(row0);
  vec4 a=mix(texelFetch(uAtlas,ivec2(i0,j0+r),0),texelFetch(uAtlas,ivec2(i1,j0+r),0),du);
  vec4 b=mix(texelFetch(uAtlas,ivec2(i0,j1+r),0),texelFetch(uAtlas,ivec2(i1,j1+r),0),du);
  return mix(a,b,ds);
}
vec4 at0(float u,float s){ return atl(u,s,0.); }
vec4 at1(float u,float s){ return atl(u,s,uNS); }
vec3 P(float x, float u, float t){ vec4 a=at0(u,stageAt(x,t)); return vec3(x, a.y*ampAt(x), -a.x); }
void main(){
  float x=position.x, u=position.y, t=uTime;
  float s=stageAt(x,t), am=ampAt(x);
  vec4 a=at0(u,s), b=at1(u,s);
  vec3 p=vec3(x, a.y*am, -a.x);
  float h=max(.05,.2*uFace); vec3 D=(P(x+h,u,t)-P(x-h,u,t))/(2.*h);
  vec3 Np=normalize(vec3(0., b.w, -b.z*am));
  vec3 N=normalize(Np-dot(Np,D)*vec3(1.,0.,0.));
  // the foam ball: lumpy, churning, cauliflower-like (bigger lumps on bigger waves)
  float foam=a.w*smoothstep(.02,.3,am);
  vec3 q=p/(.22*max(uFace,.5))+vec3(.0,-t*.35,t*.25);
  float big=n3(p/(.75*max(uFace,.5))+vec3(3.,-t*.12,t*.1));            // cauliflower heads a good fraction of the face height
  float lump=n3(q)*.65+n3(q*2.3+7.)*.35;
  float onBall=smoothstep(.12*uFace,.4*uFace,p.y);                       // big heads only on the foam ball itself, not the thin skirt ahead
  // only the solid foam is lumpy: displacing the thin aerated skirt at the foot of the ball folded it into bright vertical slivers ("teeth")
  p+=N*foam*smoothstep(.35,.75,a.w)*((lump-.35)*.14+(big-.4)*.2*onBall)*uFace;
  // vL: the crest frame (x along the crest, the shoulder at -x); vW: the world, which may be the crest frame mirrored (a right)
  vL=p; vW=(modelMatrix*vec4(p,1.)).xyz; vN=normalize(mat3(modelMatrix)*N); vA=vec4(a.z*smoothstep(0.,.25,am), foam, b.y, b.x); vS=s;
  gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);
}`;

// The sea around the strip: set waves out the back (lifted ridges, sharper crests, fading near the strip so the seam is flat water).
const SEA_VS = /* glsl */ `
precision highp float;
uniform float uTime, uFace, uLb, uX0, uX1, uY0, uY1, uSetH, uStrip;
varying vec3 vW; varying vec3 vN; varying vec4 vA; varying float vS; varying vec3 vL;
float rectMask(vec2 p){ float dx=max(max(uX0-p.x,p.x-uX1),0.), dz=max(max(-uY1-p.y,p.y+uY0),0.); return smoothstep(0.,10.+4.*uFace,length(vec2(dx,dz))); }
float sets(vec2 p){
  float z=0.;
  for (int k=0;k<4;k++){ float fk=float(k);
    float zc=-uY0+uLb*(.65+fk)+.00005*p.x*p.x*(1.+.5*fk);
    float d=p.y-zc, w=d<0.?.26*uLb:.42*uLb;           // front (beach side) steeper than the back
    float c=cos(clamp(d/w,-1.,1.)*1.5707963);
    float A=uSetH*(1.-.21*fk)*(.62+.38*sin(p.x*.011*(1.+.4*fk)+fk*1.9))*(1.-smoothstep(500.,1400.,abs(p.x)));
    z+=A*c*c*c;
  }
  z*=mix(1.,rectMask(p),uStrip);   // no breaking strip (offshore-only hour): the swell lines run through unbroken
  // the wave's own line carries on past both strip ends as a swell ridge (rising from flat water at the seam), so the shoulder and
  // the far end read as part of a longer swell line, not a crest that stops
  float ex=max(uX0-p.x,p.x-uX1);
  if (ex>0.) {
    float d=p.y-(-.15*uFace)-.00003*ex*ex, w=d<0.?.2*uLb:.36*uLb, c=cos(clamp(d/w,-1.,1.)*1.5707963);
    float A=uFace*.34*smoothstep(0.,.35*abs(uX0),ex)*(1.-smoothstep(350.,1200.,ex))*(.75+.25*sin(ex*.02+1.));
    z+=A*c*c*c*uStrip;
  }
  return z;
}
void main(){
  vec2 p=position.xz; float e=.6;
  float z=sets(p), zx=sets(p+vec2(e,0.)), zz=sets(p+vec2(0.,e));
  bool under=uStrip>.5&&p.x>uX0+.01&&p.x<uX1-.01&&p.y>-uY1+.01&&p.y<-uY0-.01;   // under the strip: tucked away below it
  if (under) z=-.8*uFace-.4;
  vN=normalize(mat3(modelMatrix)*vec3(-(zx-z)/e,1.,-(zz-z)/e));
  vL=vec3(p.x,z,p.y); vW=(modelMatrix*vec4(vL,1.)).xyz; vA=vec4(0.,0.,0.,40.); vS=0.;
  gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);
}`;

const WATER_FS = /* glsl */ `
precision highp float;
uniform float uTime, uFace, uFlowX, uFlowZ, uBl, uPitch, uLand, uFog, uSpill, uChop, uStrip, uBreak;
uniform vec3 uSun, uHorizon, uTop, uDeep, uBody, uTurq, uFoam, uFoamShade, uSea, uSunCol, uGlow;
uniform float uAmb, uDirect;
varying vec3 vW; varying vec3 vN; varying vec4 vA; varying float vS; varying vec3 vL;
${NOISE}
vec2 h22(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float cellEdge(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8., d2=8.;
  for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y)); vec2 r=g+h22(i+g)-f; float d=dot(r,r); if (d<d1){ d2=d1; d1=d; } else if (d<d2) d2=d; }
  return sqrt(d2)-sqrt(d1); }
vec3 skyCol(vec3 r){ float h=clamp(r.y,0.,1.); vec3 c=mix(uHorizon,uTop,pow(h,.55));
  vec2 sh=normalize(uSun.xz+1e-5), rh=normalize(r.xz+1e-5); c+=uGlow*pow(max(dot(sh,rh),0.),3.)*pow(1.-h,3.);   // warm glow low toward the sun (golden hour, twilight)
  return c+uSunCol*pow(max(dot(r,uSun),0.),140.)*.3; }   // the sun's halo in the reflection: tight and faint (a broad one drew one cream streak along the trough)
// wind chop and capillary ripples: octaves of C1 value noise with analytic slopes (smooth, no grid squares, no long parallel bands),
// stretched across the wind and drifting; each octave fades once it gets near a pixel, and what fades becomes roughness
float hq(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 noised(vec2 x){ vec2 i=floor(x), f=fract(x); vec2 u=f*f*f*(f*(f*6.-15.)+10.), du=30.*f*f*(f*(f-2.)+1.);
  float a=hq(i), b=hq(i+vec2(1.,0.)), c=hq(i+vec2(0.,1.)), d=hq(i+vec2(1.,1.));
  return vec3(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y, du*(vec2(b-a,c-a)+(a-b-c+d)*u.yx)); }
vec3 chopN(vec2 p, float t, float px, float k0, float a0, int n, float str){
  vec2 g=vec2(0.); float a=a0, k=k0, lost=0., tot=0.; mat2 rot=mat2(.8,.6,-.6,.8);
  vec2 q=p;
  for (int i=0;i<10;i++){ if (i>=n) break;
    vec2 st=vec2(q.x,q.y*str)*k+vec2(t*.13*float(i+1),-t*.21*sqrt(float(i+1)));   // longer across the wind than along it (str 1: isotropic)
    vec3 nd=noised(st); float fade=1.-smoothstep(.06,.5,px*k), sl=a;
    g+=rot*(nd.yz*vec2(1.,str))*a*fade; lost+=sl*sl*(1.-fade); tot+=sl*sl;
    q=rot*q; k*=1.9; a*=.62; }
  return vec3(g,lost/max(tot,1e-6));
}
vec3 chop(vec2 p, float t, float px, float str){ return chopN(p,t,px,.45,.055,8,str); }
vec3 farChop(vec2 p, float t, float px){ return chopN(p+vec2(91.,37.),t*.6,px,.06,.05,8,1.8); }
void main(){
  float t=uTime, F=max(uFace,.3);
  vec3 V=normalize(cameraPosition-vW); float dist=length(cameraPosition-vW);
  float thin=vA.x, foam=vA.y, arc=vA.z, thick=vA.w;
  vec3 N0=normalize(vN);
  float steep=1.-clamp(N0.y,0.,1.), onFace=smoothstep(.15,.6,steep);
  float front=smoothstep(-.1,.4,-N0.z);                       // facing the beach
  vec2 E=vec2(vL.x-uFlowX*t, vL.z-uFlowZ*t);                    // water that is still on the earth streams past the peeling frame (crest frame)
  float px=length(fwidth(vW.xz))+1e-4;
  // wind texture and capillary chop: three scales, stretched across the wind, weaker on the steep face
  // on the face the chop follows the surface (along the crest x, up the profile), so it reads as chop lines, not rings
  // (b) on big faces the chop lines scale with the face and get stronger
  float bigF=smoothstep(1.5,5.,F);
  vec2 pf=vec2(E.x, mix(E.y,-arc+t*.6,smoothstep(.25,.6,steep)))/mix(1.,.6+.13*F,onFace);
  // on the face the texture is isotropic and fine (a dimpled, drained surface, not wind lines across it): no stretch, smaller cells
  vec3 cn=chop(pf*mix(1.,1.7,onFace),t,px,mix(1.8,1.,onFace)), cf=farChop(vL.xz,t,px);
  float far=smoothstep(35.,140.,dist)*(1.-onFace);
  vec2 g=mix(cn.xy*(1.-.25*onFace)*(1.+onFace*bigF*3.)*uChop,cf.xy*(.6+.4*uChop),far);   // uChop: the hour's wind (glassy offshore .. onshore chop)
  // dimples on the face that ride up with the water (there even on a glassy day: the face is never a mirror)
  float dmp=n3(vec3(vL.x*4.5, arc*4.5-t*2.2, 1.))-.5, dmp2=n3(vec3(vL.x*11.+3., arc*11.-t*4., 7.))-.5;
  g+=vec2(dmp*.06+dmp2*.03, (dmp*.05+dmp2*.03))*onFace*(1.-smoothstep(.03,.12,px));
  float rough=mix(cn.z,cf.z,far);                               // slope detail too fine to draw: a rougher, blurrier reflection instead
  // draining lines on the face just before it breaks: long streaks down the face that drift up with the water (brightness only: tilting the
  // normal across x drew bright vertical slivers where the face steepens near the foot of the break)
  float pre=smoothstep(.8,2.2,vS)*(1.-smoothstep(4.6,6.2,vS))*onFace*front*(1.-smoothstep(.05,.3,foam));
  float st=(vnoise(vec2(vL.x*2.6, arc*.22-t*.35))*.65+vnoise(vec2(vL.x*7.1, arc*.5-t*.5))*.35)*smoothstep(.3,.8,vnoise(vec2(vL.x*.9, arc*1.2+3.)));
  vec3 N=normalize(N0-vec3(g.x,0.,g.y)+vec3((st-.3)*.07*pre,0.,0.));
  float nv=max(dot(N,V),0.), fres=.02+.98*pow(1.-nv,5.);
  vec3 R=reflect(-V,N); R.y=abs(R.y); vec3 sky=mix(skyCol(R),skyCol(normalize(R+vec3(0.,.35,0.))),rough*.7);
  fres*=1.-.35*rough;
  fres*=1.-.85*smoothstep(.04,.35,foam);                        // aerated water is matte: no mirror slivers in the foam skirt at the foot of the ball
  fres*=1.-.7*smoothstep(.3,.8,thin)*smoothstep(uPitch-1.,uPitch+.3,vS);   // the thrown lip too (it drew as a smooth cream sheet with bright ribs)
  // body colour by thickness: thick water deep blue-green to near black, thin water turquoise where light comes through
  float back=smoothstep(-.1,.9,dot(-V,uSun)), sunUp=uDirect;
  // front face: deep blue-green to near black at the thick base, lighter up the face; the back of the wave stays sea-coloured
  float hf=clamp(vW.y/F,0.,1.2);
  vec3 face=mix(uDeep,uBody,smoothstep(.0,.75,hf))*mix(.8,1.,smoothstep(3.,.8,thick));
  float fw=max(onFace,smoothstep(.05,.45,hf))*front;
  vec3 body=mix(uSea*mix(1.,.82,smoothstep(.05,.6,hf)*(1.-front)),face,fw);
  float glow=clamp(thin*(.4+.6*back*sunUp)*(.4+.6*front)*mix(.55,1.,uAmb),0.,1.)*.8;
  float tube=smoothstep(-.1,-.6,N0.y)*smoothstep(.2,.6,hf);                // the ceiling of the tube: in its own shadow
  body=mix(body,uTurq*(.75+.35*back),glow*.9*(1.-.6*tube));             // the ceiling of the tube stays dark even where the lip is thin
  // backlit face (Ocean Beach, sun behind the wave): the upper half of the open face lights up yellow-green where the water is thinnest
  float lit0=onFace*front*smoothstep(.3,.85,hf)*(.25+.75*back)*uDirect*smoothstep(3.,1.,thick);
  body=mix(body,vec3(.46,.78,.42)*uAmb,lit0*.4);
  body*=(.94+.14*st*pre+.04*(1.-pre))*(1.-.5*tube*(1.-glow));
  body*=uAmb*(.75+.35*mix(.55,clamp(dot(N,uSun)*.5+.5,0.,1.),uDirect));
  vec3 col=mix(body,sky,clamp(fres,0.,1.)*.62);
  // sun glint: broad and soft, from the large-scale normal; almost none on the face (no glitter)
  vec3 Ns=normalize(N0-vec3(g.x,0.,g.y)*.5); vec3 Hh=normalize(V+uSun);
  col+=uSunCol*pow(max(dot(Ns,Hh),0.),220.)*.55*(1.-.85*onFace);
  // foam: the atlas foam (lip, foam ball, spill), lumpy and aerated, grey in its cavities and on its underside
  vec3 q=vL/(.22*F)+vec3(0.,-t*.35,t*.25);
  float lump=n3(q)*.6+n3(q*2.3+7.)*.3+n3(q*5.3+3.)*.1;
  // cauliflower: cells of foam (bright heads, grey-turquoise seams between them), churning; projected on the two planes the surface
  // faces (one planar projection stretched the cells into vertical veins on the steep ball); too fine to draw -> flat
  float cs=1./(.11*F), fineOk=1.-smoothstep(.04,.2,px*cs);
  float fine=n3(q*4.+vec3(1.,2.,3.));
  float head=.5;
  if ((foam>.02||thin>.3)&&fineOk>.01){
    float wy=abs(N0.y)+.05, wz=abs(N0.z)+.05;
    vec2 wp=vec2(n3(q*1.3+vec3(9.,2.,4.)),n3(q*1.3+vec3(1.,7.,5.)))-.5;     // warp: irregular froth, not a honeycomb
    vec2 cxz=vec2(vL.x, vL.z)*cs+wp*1.4+vec2(t*.5,-t*.9), cxy=vec2(vL.x, vW.y)*cs+wp*1.4+vec2(t*.5,t*.7);
    float seam=(cellEdge(cxz)*wy+cellEdge(cxy)*wz)/(wy+wz);
    head=smoothstep(.0,.55,seam+.25*fine)*fineOk+.5*(1.-fineOk); }   // 0 on a seam, ~1 at a head's domed centre
  // the edge: ragged and hard, with holes where green water shows through (not an airbrushed fade); the core is solid
  float edge=foam*(.7+.4*lump)*(.8+.4*fine);
  float cov=smoothstep(.28,.46,edge);
  cov=max(cov,smoothstep(.85,.97,foam));                                    // the landed section and foam ball core are solid
  // the thrown lip: once it pitches, its thin water is feathering white (ragged, with holes), not a smooth translucent sheet with bright ribs
  float lipW=smoothstep(.35,.75,thin*(.7+.6*fine))*smoothstep(uPitch-1.1,uPitch+.3,vS)*smoothstep(.2,.5,hf);
  cov=max(cov,lipW);
  // a spilling forecast (uBreak 1): the crest tumbles a ragged band of foam down the top of the front face of the breaking section, the
  // open face below it stays green; a plunging one (0) keeps the atlas's clean thrown lip. Only where the section has started to break.
  // a fringe along the top whose depth varies along the crest, its lower edge ragged with holes, so it reads as tumbling foam and not as a band
  float rag=n3(q*.45+vec3(2.,0.,0.))*.6+n3(q*1.1+5.)*.4;
  float along=smoothstep(.2,.8,vnoise(vec2(vL.x*.22/F+t*.1, 4.)));
  float spillBand=smoothstep(.55-.3*rag-.12*along,.88-.1*rag,hf)*front*smoothstep(uPitch-1.4,uPitch+.2,vS)*uBreak;
  float holes=n3(q*1.5+vec3(4.,1.,8.))*.7+rag*.3;
  spillBand*=mix(1.,smoothstep(.32,.5,holes),.8*(1.-smoothstep(.62,.82,hf)));   // rounded turquoise holes along its lower edge only; solid above
  cov=max(cov,spillBand);
  vec3 Nf=normalize(N0+vec3(n3(q*1.7+1.)-.5,0.,n3(q*1.7+9.)-.5)*1.4);
  float bigS=n3(vL/(.75*F)+vec3(3.,-t*.12,t*.1));                         // the same big heads the vertex shader pushes out
  float occl=smoothstep(.18,.82,lump*.55+bigS*.45), lit=mix(.6,clamp(dot(Nf,uSun)*.55+.55,0.,1.),uDirect);
  float under=smoothstep(-.35,.45,N0.y);
  float base=mix(.6,1.,smoothstep(.0,.45*F,vW.y));                          // greyer where the foam sits low in the water
  // seams between the heads: grey where the foam is deep, turquoise water showing through near the edge and in the thin skirt
  float deep=smoothstep(.5,.95,foam);
  vec3 seamCol=mix(uTurq*.8*uAmb,uFoamShade*uAmb,deep);
  // foam scatters light, so even its shaded side is light; the big heads and the underside carry the shadow (grey pockets between them)
  float bright=clamp(occl*.55+lit*.45+.15,0.,1.)*mix(.5,1.,under)*base;
  vec3 fcol=mix(seamCol,mix(uFoamShade,uFoam,bright)*uAmb,mix(.62,1.,head))*mix(vec3(1.),uTop/max(max(uTop.r,uTop.g),max(uTop.b,.01)),.3*(1.-uDirect));
  col=mix(col,fcol,cov);
  // lacy foam: trails behind the broken section and a decaying band inside, thinning into lace with age
  // (only where the section has already broken: nothing on the clean water in front of the pocket)
  float behind=smoothstep(.1*uBl,.3*uBl,vL.x)*exp(-max(vL.z,0.)/(uFlowZ*3.+4.*F))*step(0.,vL.z);
  float broken=1.-smoothstep(1.4*uBl,2.6*uBl,vL.x);
  // the trough in front: the previous wave's lace (a thin white web on dark water) instead of a smooth pale reflection streak
  float trough=(1.-onFace)*smoothstep(.0,.15*F,-vL.z)*(1.-smoothstep(1.5*F+2.,6.*F+10.,-vL.z))*(1.-smoothstep(.05,.3,hf))*.1;
  float lm=max(broken*behind,trough)*(1.-cov)*(1.-onFace)*(uSpill>.5?1.2:1.)*uStrip;   // nothing has broken when there is no strip (swell-only hour)
  if (lm>.02){
    vec2 w=E+vec2(vnoise(E*.3),vnoise(E*.3+5.))*2.5;                 // warp: organic, not a honeycomb
    float sc=1./max(F*.3,.5);
    float ce=cellEdge(w*1.1*sc)*.6+cellEdge(w*2.9*sc+3.)*.4;
    float fpatch=smoothstep(.5,.8,vnoise(E*.12*sc)*.7+vnoise(E*.5*sc+4.)*.3+.3*lm);  // foam patches, fewer with age
    float lace=fpatch*(1.-smoothstep(.02,.07+.12*lm,ce));                          // thin threads with holes: lace
    lace=mix(lace,fpatch*.2,smoothstep(.12,.45,px*2.9*sc));                        // once the threads are sub-pixel: an even haze, no speckle
    lace*=smoothstep(.03,.4,lm);
    col=mix(col,uFoam*(.82+.12*lit)*uAmb,clamp(lace,0.,1.)*.85*(1.-smoothstep(150.,500.,dist)));
  }
  float fog=1.-exp(-pow(dist*uFog,2.)); col=mix(col,uHorizon*.99,clamp(fog,0.,1.));
  gl_FragColor=vec4(col,1.);
  #include <colorspace_fragment>
}`;

const SKY_VS = `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*viewMatrix*vec4(position+cameraPosition,1.); gl_Position.z=gl_Position.w; }`;
const SKY_FS = `uniform vec3 uHorizon,uTop,uSun,uSunCol,uGlow; varying vec3 vD; void main(){ float h=clamp(vD.y,0.,1.); vec3 c=mix(uHorizon,uTop,pow(h,.5));
vec2 sh=normalize(uSun.xz+1e-5), rh=normalize(vD.xz+1e-5); c+=uGlow*pow(max(dot(sh,rh),0.),3.)*pow(1.-h,3.);
c+=uSunCol*(pow(max(dot(vD,uSun),0.),24.)*.5+pow(max(dot(vD,uSun),0.),900.)*3.); gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`;
const SPRAY_VS = `attribute float aSize; attribute float aA; varying float vA; uniform float uScale; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); float px=aSize*uScale/max(-mv.z,.1); vA=aA*smoothstep(2.,7.,px); gl_PointSize=clamp(px,2.,180.); gl_Position=projectionMatrix*mv; }`; // tiny sprites fade out: no glitter
const SPRAY_FS = `uniform float uAmb; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=exp(-d*d*3.)*smoothstep(1.,.7,d); gl_FragColor=vec4(vec3(.95,.97,.98)*uAmb,a*vA);
#include <colorspace_fragment>
}`;

const loader = new GLTFLoader();
const atlasCache = new Map<string, Promise<Atlas | null>>(), ready = new Map<string, Atlas>();
let surferCache: Promise<{scene: THREE.Group; clips: THREE.AnimationClip[]}> | null = null;
/** An atlas by file id; null when the file is missing (a breaker variant that was not built). Resolved atlases are kept for synchronous use. */
const getAtlas = (id: string) => { let p = atlasCache.get(id); if (!p) { p = loadAtlas(ATLAS_ROOT, id).then((a) => { ready.set(id, a); return a; }, () => null); atlasCache.set(id, p); } return p; };
/** The surfer model's own standing height (m, printed by build_surfer.py); the drawn surfer is scaled to the person's height. */
export const SURFER_MODEL_M = 1.751;
const loadSurfer = () => (surferCache ??= loader.loadAsync(LIVE_ROOT + 'surfer.glb').then((g) => ({scene: g.scene, clips: g.animations})).catch((e) => { surferCache = null; throw e; }));
/** The ride line (wave-round3, spec 2026-11-03-surfer-motion): waypoints by clip phase [phase, x offset from surferX in face heights
 *  (+ toward the pocket), height fraction on the face (0 trough .. 1 crest)]. One smooth closed loop per clip: trim mid-face -> drop and
 *  pull out toward the shoulder -> the bottom turn at the foot of the face -> climb back toward the pocket -> the top turn in the upper
 *  third just under the lip -> back down -> a pump -> trim. The waypoint phases are the clip's key frames (build_surfer.py RIDE), so the
 *  body's compression and lean land on the turns. The same line every hour; only its speed follows the wave cycle. */
const RIDE_WP: [number, number, number][] = [[0, -0.45, 0.34], [0.12, -0.6, 0.22], [0.26, -0.85, 0.1], [0.4, -0.72, 0.28], [0.52, -0.42, 0.5], [0.6, -0.24, 0.66], [0.7, -0.32, 0.42], [0.84, -0.44, 0.24], [1, -0.45, 0.34]];
const RIDE_MOVES: [number, string][] = [[0.17, 'trim'], [0.36, 'bottom'], [0.5, 'trim'], [0.68, 'top'], [0.78, 'trim'], [0.9, 'pump'], [1.01, 'trim']];
const moveAt = (ph: number) => RIDE_MOVES.find(([p]) => ph < p)?.[1] ?? 'trim';
/** Cubic Hermite through the waypoints (Catmull-Rom tangents in phase, closed): velocity-continuous (dx, frac) at phase ph. */
function splineAt(ph: number): [number, number] {
  const W = RIDE_WP, n = W.length - 1;   // W[n] repeats W[0] one phase later
  let k = 0; while (k < n - 1 && W[k + 1][0] <= ph) k++;
  const p0 = W[k], p1 = W[k + 1], pm = k > 0 ? W[k - 1] : [W[n - 1][0] - 1, W[n - 1][1], W[n - 1][2]], pp = k + 1 < n ? W[k + 2] : [W[1][0] + 1, W[1][1], W[1][2]];
  const h = p1[0] - p0[0], s = (ph - p0[0]) / h, s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  const out: [number, number] = [0, 0];
  for (let c = 1; c <= 2; c++) { const m0 = (p1[c] - pm[c]) / (p1[0] - pm[0]), m1 = (pp[c] - p0[c]) / (pp[0] - p0[0]); out[c - 1] = h00 * p0[c] + h10 * h * m0 + h01 * p1[c] + h11 * h * m1; }
  return out;
}
/** The face is rideable up to where it is steeper than this (the lip and the cavity under it are not): the ride line is clamped under it. */
const RIDE_CAP = THREE.MathUtils.degToRad(78), LEAN_MAX = THREE.MathUtils.degToRad(18), TILT_MAX = THREE.MathUtils.degToRad(42), G = 9.81;
const NT = 128;
/** The ride line sampled by time for one clip loop (period T s): along-crest x and height fraction (clamped into the face's rideable
 *  envelope and at least one face height ahead of the break, then smoothed), their first and second time derivatives, and the heading. */
interface RideTable {T: number; x: Float32Array; fr: Float32Array; vx: Float32Array; vh: Float32Array; ax: Float32Array; ah: Float32Array; yaw: Float32Array; maxFr: Float32Array}
function buildRide(atlas: Atlas, sx: number, T: number, flowX: number): RideTable {
  const m = atlas.meta, H = m.face_m, x = new Float32Array(NT), fr = new Float32Array(NT), maxFr = new Float32Array(NT);
  let xbMin = Infinity; for (let k = 0; k < 24; k++) xbMin = Math.min(xbMin, breakX(m, m.cycle_s * k / 24));
  for (let i = 0; i < NT; i++) { const [dx, f] = splineAt(i / NT); x[i] = Math.min(sx + dx * H, xbMin - 1.0 * H); fr[i] = f; }
  // the rideable envelope: the highest fraction whose face slope stays under RIDE_CAP through the cycle's pulses (bisection), per sample
  for (let i = 0; i < NT; i++) {
    let best = 1;
    for (let k = 0; k < 4; k++) {
      const t = m.cycle_s * (k + 0.5) / 4; let lo = 0.03, hi = 0.95;
      for (let j = 0; j < 7; j++) { const mid = (lo + hi) / 2; if (facePoint(atlas, x[i], mid, t)[2] <= RIDE_CAP) lo = mid; else hi = mid; }
      best = Math.min(best, lo);
    }
    maxFr[i] = best; fr[i] = Math.min(fr[i], best - 0.05);
  }
  const smooth = (a: Float32Array, passes: number) => { const b = new Float32Array(NT); for (let p = 0; p < passes; p++) { for (let i = 0; i < NT; i++) b[i] = 0.25 * a[(i + NT - 1) % NT] + 0.5 * a[i] + 0.25 * a[(i + 1) % NT]; a.set(b); } };
  smooth(fr, 4); smooth(x, 2);
  const dt = T / NT, vx = new Float32Array(NT), vh = new Float32Array(NT), ax = new Float32Array(NT), ah = new Float32Array(NT), yaw = new Float32Array(NT);
  for (let i = 0; i < NT; i++) {
    const a = (i + NT - 1) % NT, b = (i + 1) % NT;
    vx[i] = (x[b] - x[a]) / (2 * dt); vh[i] = H * (fr[b] - fr[a]) / (2 * dt); ax[i] = (x[b] - 2 * x[i] + x[a]) / (dt * dt); ah[i] = H * (fr[b] - 2 * fr[i] + fr[a]) / (dt * dt);
    const slope = facePoint(atlas, x[i], fr[i], null)[2], vz = vh[i] / Math.max(0.3, Math.tan(slope));
    yaw[i] = Math.atan2(vz, vx[i] - flowX);   // the heading over the water (crest frame: the water streams at flowX toward the break)
  }
  return {T, x, fr, vx, vh, ax, ah, yaw, maxFr};
}
const lerpT = (a: Float32Array, i: number, f: number) => a[i] + (a[(i + 1) % NT] - a[i]) * f;
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** A critically damped spring toward a moving target (nothing snaps): the closed-form step, stable for any dt (an explicit Euler step
 *  blew up at w·dt > 2, e.g. a stiff spring through a 50 ms frame). */
class Spring {
  x = 0; v = 0;
  set(x: number) { this.x = x; this.v = 0; }
  step(target: number, dt: number, w: number) {
    const e = Math.exp(-w * dt), x0 = this.x - target, k = (this.v + w * x0) * dt;
    this.x = (x0 + k) * e + target; this.v = (this.v - k * w) * e; return this.x;
  }
}
/** Dev/QA: the rider this instant (crest frame, m): the board tail's position, the gap between the board's bottom centre and the water
 *  (contact_m), the gap of its lowest point (low_m, negative = a rail or the tail in the water), the distance ahead of the break point
 *  (ahead_m, negative = behind), the clip's current move (trim | bottom | top | pump), the height fraction on the face (frac, 0 trough ..
 *  1 crest), the board's heading against its measured velocity over the water (heading_err_deg), the board centre on the canvas
 *  (screen, fractions 0..1 from the top left), the along-crest velocity in the crest frame (vx_mps) and over the water (v_water_mps, + down
 *  the line: the crest frame moves with the peel, so x oscillates while the water-relative speed never reverses). */
export interface RiderSample {x: number; y: number; z: number; contact_m: number; low_m: number; ahead_m: number; move: string; frac: number; heading_err_deg: number; screen: [number, number]; vx_mps: number; v_water_mps: number}

/** The atlas for a face height from the loaded buckets: the two buckets around it blended; below or above the range the end bucket
 *  scaled. Always the bucket family's own atlas: the "-spilling" variants draw the whole section as a wall of whitewater with no open
 *  face (wave-look round 1), so the forecast's breaker type shapes the water shader (uBreak) instead of swapping the geometry.
 *  Null until both buckets are loaded; `need` lists the file ids to load. */
export function composeAtlas(faceM: number, _breaker: WaveSpec['breaker'], periodS: number | null): {atlas: Atlas | null; need: string[]; bucket: string} {
  const b = bucketsFor(faceM), B = ATLAS_BANDS;
  const pick = (i: number) => ready.get(B[i].id) ?? null;
  const need = [...new Set([B[b.lo].id, B[b.hi].id])];
  const lo = pick(b.lo), hi = pick(b.hi), bucket = b.w < 0.5 ? B[b.lo].id : B[b.hi].id;
  if (!lo || !hi) return {atlas: null, need, bucket};
  const a = b.lo === b.hi ? scaleAtlas(lo, faceM / B[b.lo].faceM) : blendAtlas(lo, hi, b.w);
  return {atlas: withPeriod(a, periodS), need, bucket};
}

// fixed vertex counts: an hour change rewrites positions in place (no geometry churn), the index never changes
const NX = 384, NU = 160, TAIL_L = 46, TAIL_R = 62, SEA_IN = 42, SEA_Z1 = 18, SEA_Z2 = 40, SEA_TAIL = 26, SEA_FAR = 2600;
const SEA_NX = 2 * SEA_TAIL + SEA_IN + 2, SEA_NZ = 2 * SEA_TAIL + SEA_Z1 + 2 + SEA_Z2;
/** Along-crest sample x for the strip: fine and uniform around the surfer and the break, quadratic tails to the strip ends. */
function crestX(m: AtlasMeta, xs: number, out: Float32Array) {
  const [x0, x1] = stripX(m), H = m.face_m, a = Math.max(x0, xs - 10 * H - 6), b = Math.min(x1, 0.6 * m.break_len_m + 6 * H), nf = NX - TAIL_L - TAIL_R;
  for (let i = 0; i < TAIL_L; i++) { const t = 1 - i / TAIL_L; out[i] = a - (a - x0) * t * t; }
  for (let i = 0; i < nf; i++) out[TAIL_L + i] = a + (b - a) * i / (nf - 1);
  for (let i = 1; i <= TAIL_R; i++) { const t = i / TAIL_R; out[TAIL_L + nf + i - 1] = b + (x1 - b) * t * t; }
}
function stripGeometry(): THREE.BufferGeometry {
  const pos = new Float32Array(NX * NU * 3), idx = new Uint32Array((NX - 1) * (NU - 1) * 6); let k = 0;
  for (let i = 0; i < NX; i++) for (let j = 0; j < NU; j++) pos[(i * NU + j) * 3 + 1] = j / (NU - 1);
  for (let i = 0; i < NX - 1; i++) for (let j = 0; j < NU - 1; j++) { const a = i * NU + j, b = a + NU; idx[k++] = a; idx[k++] = b; idx[k++] = a + 1; idx[k++] = a + 1; idx[k++] = b; idx[k++] = b + 1; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setIndex(new THREE.BufferAttribute(idx, 1)); return g;
}
const crestBuf = new Float32Array(NX);
function setStripX(g: THREE.BufferGeometry, m: AtlasMeta, xs: number) {
  crestX(m, xs, crestBuf); const p = g.getAttribute('position') as THREE.BufferAttribute, arr = p.array as Float32Array;
  for (let i = 0; i < NX; i++) { const x = crestBuf[i]; for (let j = 0; j < NU; j++) arr[(i * NU + j) * 3] = x; }
  p.needsUpdate = true;
}
/** Sea grid axes: inset lines 2 cm inside the strip's edges (the sea drops away right at the seam), uniform inside, geometric tails to the horizon. */
const seaXs = new Float32Array(SEA_NX), seaZs = new Float32Array(SEA_NZ);
function seaAxes(m: AtlasMeta) {
  const [x0, x1] = stripX(m), zA = -m.y1_m, zB = -m.y0_m, zC = zB + 4.5 * m.Lb_m, r = 1.22, geo = (i: number) => (r ** i - 1) / (r ** SEA_TAIL - 1);
  const xs = seaXs, zs = seaZs; let k = 0;
  for (let i = SEA_TAIL; i >= 1; i--) xs[k++] = x0 - (x0 + SEA_FAR) * geo(i);
  xs[k++] = x0; xs[k++] = x0 + 0.02; for (let i = 1; i < SEA_IN - 1; i++) xs[k++] = x0 + 0.02 + (x1 - x0 - 0.04) * i / (SEA_IN - 1); xs[k++] = x1 - 0.02; xs[k++] = x1;
  for (let i = 1; i <= SEA_TAIL; i++) xs[k++] = x1 + (SEA_FAR - x1) * geo(i);
  k = 0;
  for (let i = SEA_TAIL; i >= 1; i--) zs[k++] = zA - (zA + SEA_FAR) * geo(i);
  zs[k++] = zA; zs[k++] = zA + 0.02; for (let i = 1; i < SEA_Z1 - 1; i++) zs[k++] = zA + 0.02 + (zB - zA - 0.04) * i / (SEA_Z1 - 1); zs[k++] = zB - 0.02; zs[k++] = zB;
  for (let i = 1; i <= SEA_Z2; i++) zs[k++] = zB + (zC - zB) * i / SEA_Z2;
  for (let i = 1; i <= SEA_TAIL; i++) zs[k++] = zC + (SEA_FAR - zC) * geo(i);
}
function seaGeometry(): THREE.BufferGeometry {
  const pos = new Float32Array(SEA_NX * SEA_NZ * 3), idx = new Uint32Array((SEA_NX - 1) * (SEA_NZ - 1) * 6); let k = 0;
  for (let i = 0; i < SEA_NX - 1; i++) for (let j = 0; j < SEA_NZ - 1; j++) { const a = i * SEA_NZ + j, b = a + SEA_NZ; idx[k++] = a; idx[k++] = a + 1; idx[k++] = b; idx[k++] = a + 1; idx[k++] = b + 1; idx[k++] = b; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setIndex(new THREE.BufferAttribute(idx, 1)); return g;
}
function setSea(g: THREE.BufferGeometry, m: AtlasMeta) {
  seaAxes(m); const p = g.getAttribute('position') as THREE.BufferAttribute, arr = p.array as Float32Array;
  for (let i = 0; i < SEA_NX; i++) for (let j = 0; j < SEA_NZ; j++) { const k = (i * SEA_NZ + j) * 3; arr[k] = seaXs[i]; arr[k + 2] = seaZs[j]; }
  p.needsUpdate = true;
}

// spray: lip spray off the pitching lip, offshore back-spray off the feathering crest, soft mist over the whitewater, the landing burst
const N_LIP = 700, N_BACK = 520, N_MIST = 240, N_BLAST = 420, N_TAIL = 220, SPRAY_N = N_LIP + N_BACK + N_MIST + N_BLAST + N_TAIL;
interface Spray {pts: THREE.Points; pos: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; size: Float32Array; alpha: Float32Array; lip: Float32Array; crest: Float32Array; mist: Float32Array; blast: Float32Array; tail: Float32Array; tailVel: Float32Array; tailOn: number}
/** Emitters from the atlas (static stage): crest-frame points (x, up, -y). */
function emitters(a: Atlas) {
  const m = a.meta, H = m.face_m, lip: number[] = [], crest: number[] = [], mist: number[] = [], blast: number[] = [], spill = m.breaker === 'spilling';
  const xa = surferX(m) - 2 * H, xb = 0.95 * m.break_len_m;
  for (let k = 0; k < 90; k++) {
    const x = xa + (xb - xa) * k / 89, s = stageAt(m, x, 0, false), p = profileAt(a, x, 0, 96, false);
    let ci = 0; for (let i = 1; i < 96; i++) if (p.z[i] > p.z[ci]) ci = i;
    const zc = p.z[ci]; if (zc < 0.15 * H) continue;
    if (s > 1.2 && s < m.stage_pitch + 0.6) crest.push(x, zc, -p.y[ci]);
    const lipOn = spill ? s > 2.5 && s < 5.5 : s > m.stage_pitch - 0.6 && s < m.stage_land + 0.3;
    if (lipOn) { let ti = ci; for (let i = ci; i < 96; i++) if (p.z[i] > 0.4 * zc && p.y[i] > p.y[ti]) ti = i; lip.push(x, p.z[ti], -p.y[ti]); }
    if (s > (spill ? 4 : m.stage_land)) for (let i = ci; i < 96; i++) if (p.foam[i] > 0.6 && p.z[i] > 0.35 * zc) mist.push(x, p.z[i], -p.y[i]);
    // where the lip lands (plunging, 8 ft and up): the most shoreward foamy water of the landing section
    if (!spill && H >= 1.8 && s > m.stage_land - 0.4 && s < m.stage_land + 1.2) { let li = -1; for (let i = ci; i < 96; i++) if (p.foam[i] > 0.5 && (li < 0 || p.y[i] > p.y[li])) li = i; if (li >= 0) blast.push(x, Math.max(0.05, p.z[li]), -p.y[li]); }
  }
  return {lip: new Float32Array(lip), crest: new Float32Array(crest), mist: new Float32Array(mist), blast: new Float32Array(blast)};
}
export function WaveLive({wave, poster, alt, onReady, onFail, board, light, surferM = SURFER_MODEL_M}: {wave: WaveSpec; poster: string; alt: string; onReady?: () => void; onFail?: () => void; board?: Surfboard | null; light?: LiveLight | null; /** T-099: the person's height (m); the 1.75 m model is scaled to it */ surferM?: number}) {
  const host = useRef<HTMLDivElement>(null), api = useRef<{setWave: (w: WaveSpec) => void; setDir: (d: 'left' | 'right') => void; setLight: (l: Lighting | null) => void; setBoard: (b: Surfboard | null) => void} | null>(null), cb = useRef({onReady, onFail});
  cb.current = {onReady, onFail};
  const [live, setLive] = useState(false);
  const boardRef = useRef(board ?? null); boardRef.current = board ?? null;
  const surferRef = useRef(surferM); surferRef.current = surferM;
  const waveRef = useRef(wave); waveRef.current = wave;
  const lighting = light ? lightingAt(light.spotId, light.iso) : null, lightRef = useRef(lighting); lightRef.current = lighting;
  useEffect(() => {
    const el = host.current; if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, powerPreference: 'high-performance'}); } catch { cb.current.onFail?.(); return; }
    // 1.5 px per CSS px is enough for water; a full Retina 2x costs most of the frame on an 8 GB M2 at full-screen width
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5); renderer.setPixelRatio(dpr); renderer.setClearColor(HORIZON);
    const canvas = renderer.domElement; canvas.className = 'live-canvas'; canvas.setAttribute('aria-hidden', 'true'); el.appendChild(canvas);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 4 / 3, 0.1, 6000);
    const tex = {value: null as THREE.DataTexture | null};
    const u = {
      uTime: {value: 0}, uFace: {value: 1.5}, uNS: {value: 12}, uNP: {value: 96}, uPitch: {value: 4}, uLand: {value: 6}, uDb: {value: 2}, uBed: {value: 0.03}, uSh: {value: 40}, uBl: {value: 40}, uCyc: {value: 6},
      uX0: {value: -60}, uX1: {value: 60}, uY0: {value: -14}, uY1: {value: 5}, uLb: {value: 57}, uFlowX: {value: 4}, uFlowZ: {value: 3}, uSpill: {value: 0}, uAtlas: tex, uSetH: {value: 0.5}, uStrip: {value: 1}, uChop: {value: 0.7}, uBreak: {value: 0},
      uSun: {value: SUN.clone()}, uHorizon: {value: HORIZON.clone()}, uTop: {value: SKY_TOP.clone()}, uFog: {value: 0.0036}, uSunCol: {value: new THREE.Color('#fff3df')}, uGlow: {value: new THREE.Color(0, 0, 0)}, uAmb: {value: 1}, uDirect: {value: 1},
      // water: a dark green-grey base with a greener face and a bright, slightly yellow-green glow where the lip goes thin (Ocean Beach photos:
      // the face is olive-green against a grey-blue sea, never teal); foam reads white, its cavities a light grey, not slate
      uDeep: {value: new THREE.Color('#06201f')}, uBody: {value: new THREE.Color('#1c5a4e')}, uTurq: {value: new THREE.Color('#4cc49a')}, uSea: {value: new THREE.Color('#163f46')},
      uFoam: {value: new THREE.Color('#f3f6f5')}, uFoamShade: {value: new THREE.Color('#8a979c')},
    };
    const stripMat = new THREE.ShaderMaterial({uniforms: u, vertexShader: STRIP_VS, fragmentShader: WATER_FS, side: THREE.DoubleSide});
    const seaMat = new THREE.ShaderMaterial({uniforms: u, vertexShader: SEA_VS, fragmentShader: WATER_FS});
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 24, 12), new THREE.ShaderMaterial({uniforms: {uHorizon: u.uHorizon, uTop: u.uTop, uSun: u.uSun, uSunCol: u.uSunCol, uGlow: u.uGlow}, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false}));
    sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
    const hemi = new THREE.HemisphereLight(0xdfeaf2, 0x2b5d70, 1.1); scene.add(hemi); const sun = new THREE.DirectionalLight(0xfff1dc, 2.2); sun.position.copy(SUN).multiplyScalar(50); scene.add(sun);
    // the crest frame: x along the crest with the shoulder at -x (a left); a right is this frame mirrored (scale.x = -1), surfer included
    const group = new THREE.Group(); scene.add(group);
    const strip = new THREE.Mesh(stripGeometry(), stripMat), sea = new THREE.Mesh(seaGeometry(), seaMat); strip.frustumCulled = sea.frustumCulled = false; strip.visible = sea.visible = false; group.add(strip, sea);
    let custom: THREE.Mesh | null = null, surfer: THREE.Object3D | null = null, spray: Spray | null = null, disposed = false, dir: 'left' | 'right' = 'left';
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false; controls.minPolarAngle = THREE.MathUtils.degToRad(10); controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
    controls.minDistance = 2.2; controls.maxDistance = 70; controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.9; controls.touches = {ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE};
    const sph = new THREE.Spherical(), tmp = new THREE.Vector3();
    const sync = () => { sph.setFromVector3(tmp.copy(camera.position).sub(controls.target)); el.dataset.az = String(Math.round(THREE.MathUtils.radToDeg(sph.theta) * 10) / 10); el.dataset.polar = String(Math.round(THREE.MathUtils.radToDeg(sph.phi) * 10) / 10); el.dataset.dist = String(Math.round(sph.radius * 100) / 100); };
    controls.addEventListener('change', sync);
    controls.addEventListener('start', () => { dragUntil = Infinity; });
    controls.addEventListener('end', () => { dragUntil = performance.now() + 3000; camS[0].set(controls.target.x); camS[1].set(controls.target.y); camS[2].set(controls.target.z); });
    const spMat = new THREE.ShaderMaterial({uniforms: {uScale: {value: 600}, uAmb: u.uAmb}, vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, transparent: true, depthWrite: false});
    const size = () => { const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); spMat.uniforms.uScale.value = (h * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); };
    const ro = new ResizeObserver(size); ro.observe(el);

    const makeSpray = (): Spray => {
      const n = SPRAY_N, pos = new Float32Array(n * 3), life = new Float32Array(n), max = new Float32Array(n).fill(1), size = new Float32Array(n), alpha = new Float32Array(n), vel = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) life[i] = -Math.random() * 2;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aA', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
      const pts = new THREE.Points(g, spMat); pts.frustumCulled = false; const e = new Float32Array(0); return {pts, pos, vel, life, max, size, alpha, lip: e, crest: e, mist: e, blast: e, tail: new Float32Array(3), tailVel: new Float32Array(3), tailOn: 0};
    };
    const R = Math.random;
    let faceM = 1.5, pow = 1, back = 0;
    const stepSpray = (sp: Spray, dt: number, H: number) => {
      const big = Math.min(1, H / 4), sq = Math.sqrt(H) * pow;
      for (let i = 0; i < SPRAY_N; i++) {
        const kind = i < N_LIP ? 0 : i < N_LIP + N_BACK ? 1 : i < N_LIP + N_BACK + N_MIST ? 2 : i < N_LIP + N_BACK + N_MIST + N_BLAST ? 3 : 4;
        const src = kind === 0 ? sp.lip : kind === 1 ? sp.crest : kind === 2 ? sp.mist : kind === 3 ? sp.blast : sp.tail, m = src.length / 3, j = i * 3;
        if (!m || (kind === 1 && back <= 0)) { sp.alpha[i] = 0; continue; }
        sp.life[i] -= dt;
        if (sp.life[i] <= 0) {
          if (kind === 4 && (sp.tailOn <= 0 || R() > sp.tailOn)) { sp.alpha[i] = 0; sp.life[i] = 0.05; continue; }   // tail spray only through the top turn
          const k = (R() * m | 0) * 3;
          sp.pos[j] = src[k] + (R() - 0.5) * (kind === 0 ? 1.2 : 0.4); sp.pos[j + 1] = src[k + 1]; sp.pos[j + 2] = src[k + 2];
          if (kind === 0) { // lip spray: soft puffs thrown forward and down off the lip, spread along it (not dotted lines under each emitter), a few blown back
            sp.vel[j] = (R() - 0.5) * 0.9; sp.vel[j + 1] = (R() - 0.3) * 1.2 * sq; sp.vel[j + 2] = -(0.4 + R() * 1.2) * sq * (R() < 0.15 ? -0.6 : 1);
            sp.max[i] = sp.life[i] = 0.35 + R() * 0.7; sp.size[i] = (0.09 + R() * 0.16) * (0.6 + 0.3 * H);
          } else if (kind === 1) { // offshore back-spray: lifted off the crest, carried up and seaward, a soft veil on big days
            sp.pos[j + 1] += R() * 0.08 * H; sp.vel[j] = (R() - 0.5) * 0.5; sp.vel[j + 1] = (0.5 + R() * 1.0) * Math.sqrt(H); sp.vel[j + 2] = (0.8 + R() * 1.8) * Math.sqrt(H) * (0.6 + 0.6 * back);
            sp.max[i] = sp.life[i] = 1.0 + R() * 1.4; sp.size[i] = (0.25 + R() * 0.35) * (0.5 + 0.35 * H);
          } else if (kind === 3) { // the explosion where the lip lands: a thick white burst up and forward out of the impact
            sp.pos[j + 1] += R() * 0.2 * H; sp.vel[j] = (R() - 0.5) * 1.6 * sq; sp.vel[j + 1] = (0.8 + R() * 1.6) * sq; sp.vel[j + 2] = -(0.3 + R() * 1.4) * sq;
            sp.max[i] = sp.life[i] = 0.7 + R() * 1.0; sp.size[i] = (0.14 + R() * 0.3) * sq;
          } else if (kind === 4) { // the rider's tail spray at the top turn: water leaving the tail with the board's velocity plus a kick up and
            // back, then left behind as the water streams past (it is water: it keeps the flow, so it trails the rider down the line) under gravity
            const f = 0.6 + 0.5 * Math.min(1.5, Math.sqrt(surferRef.current / SURFER_MODEL_M));
            sp.vel[j] = sp.tailVel[0] + 0.6 * u.uFlowX.value + (R() + 0.1) * 1.4 * f; sp.vel[j + 1] = sp.tailVel[1] * 0.5 + (1.4 + R() * 2.6) * f; sp.vel[j + 2] = sp.tailVel[2] * 0.5 - (0.2 + R() * 1.8) * f;
            sp.max[i] = sp.life[i] = 0.35 + R() * 0.6; sp.size[i] = 0.08 + R() * 0.2;
          } else { // mist over the whitewater
            sp.pos[j] += (R() - 0.5) * 1.2; sp.pos[j + 1] += R() * 0.3 * H; sp.vel[j] = (R() - 0.5) * 0.3; sp.vel[j + 1] = 0.1 + R() * 0.3; sp.vel[j + 2] = (R() - 0.3) * 0.5;
            sp.max[i] = sp.life[i] = 2 + R() * 2; sp.size[i] = (0.5 + R() * 0.6) * (0.5 + 0.4 * H);
          }
        }
        const gr = kind === 0 ? 4.5 : kind === 1 ? 1.2 : kind === 3 ? 3.2 : kind === 4 ? 7 : 0; if (kind === 3) sp.size[i] *= 1 + dt * 0.9;
        sp.vel[j + 1] -= gr * dt; if (kind === 1) { sp.vel[j + 2] += 0.6 * dt; sp.size[i] *= 1 + dt * 0.3; } if (kind === 2) sp.size[i] *= 1 + dt * 0.2;
        sp.pos[j] += sp.vel[j] * dt; sp.pos[j + 1] += sp.vel[j + 1] * dt; sp.pos[j + 2] += sp.vel[j + 2] * dt;
        const t = Math.max(0, sp.life[i]) / sp.max[i], env = Math.min(1, (1 - t) * 6) * Math.min(1, t * 2.5);
        sp.alpha[i] = sp.life[i] > 0 ? env * (kind === 0 ? 0.075 : kind === 1 ? (0.008 + 0.03 * big) * back : kind === 3 ? 0.3 : kind === 4 ? 0.28 : 0.07 + 0.03 * big) : 0;
      }
      const g = sp.pts.geometry; (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true; (g.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true; (g.getAttribute('aA') as THREE.BufferAttribute).needsUpdate = true;
    };
    let placed: 'none' | 'surf' | 'swell' = 'none', token = 0, pending: WaveSpec | null = null, live0 = false;
    const bb = new THREE.Box3(), Mb = new THREE.Matrix4(), Ms = new THREE.Matrix4();
    // the rider: a skinned model with `ride` (loop) and `still` clips, placed on the face every frame along the ride line (RIDE_WP): the
    // board points along its velocity over the water, banks with the face and leans into each turn; the body follows from the clip plus
    // procedural layers (head and shoulders leading the heading, arms balancing the lean) on damped springs
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mixer: THREE.AnimationMixer | null = null, rideAct: THREE.AnimationAction | null = null, rideDur = 4, cur: {atlas: Atlas; sx: number; ride: RideTable} | null = null;
    let rider: RiderSample | null = null, riderAt = 0;
    const pt = new THREE.Vector3(), boardBox = new THREE.Box3();
    const F = new THREE.Vector3(), N = new THREE.Vector3(), U = new THREE.Vector3(), Rv = new THREE.Vector3(), Av = new THREE.Vector3(), posV = new THREE.Vector3(), prevPos = new THREE.Vector3(), prevTail = new THREE.Vector3(), noseV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), axQ = new THREE.Quaternion(), axV = new THREE.Vector3();
    const leadS = new Spring(), leanS = new Spring(), torsoS = new Spring(), camS = [new Spring(), new Spring(), new Spring()];
    let bones: {torso: THREE.Object3D | null; spine: THREE.Object3D | null; neck: THREE.Object3D | null; head: THREE.Object3D | null; armL: THREE.Object3D | null; armR: THREE.Object3D | null} | null = null;
    let haveVel = false, lastPlace = 0, follow = true, dragUntil = 0;
    /** The board object and its bounds in its own frame. The v3 asset's Board is a Group of child meshes (one per material), a quiver board a
     *  single Mesh, so the bounds are the union of every mesh under it (Codex P1 on 9682084: reading .geometry on the Group threw). Cached. */
    const boardBounds = new WeakMap<THREE.Object3D, THREE.Box3>();
    const boardOf = (): {obj: THREE.Object3D; box: THREE.Box3} | null => {
      const obj = custom ?? surfer?.getObjectByName('Board'); if (!obj) return null;
      let box = boardBounds.get(obj);
      if (!box) {
        const b = new THREE.Box3(), inv = new THREE.Matrix4(), m = new THREE.Matrix4(); obj.updateMatrixWorld(true); inv.copy(obj.matrixWorld).invert();
        obj.traverse((c) => { const mesh = c as THREE.Mesh; if (!mesh.isMesh || !mesh.geometry) return; const g = mesh.geometry; if (!g.boundingBox) g.computeBoundingBox();
          b.union(g.boundingBox!.clone().applyMatrix4(m.multiplyMatrices(inv, mesh.matrixWorld))); });
        if (b.isEmpty()) return null; box = b; boardBounds.set(obj, box);
      }
      return {obj, box};
    };
    /** Board-to-water gaps (m, crest frame): at the board's bottom centre, and the lowest of the tail, nose and both rails. */
    const contactM = (t: number): [number, number] => {
      if (!surfer || !cur) return [0, 0];
      const bd = boardOf(); if (!bd) return [0, 0];
      const mesh = bd.obj, bx = bd.box; boardBox.copy(bx);
      const pts: [number, number, number][] = [[0, bx.min.y, 0], [bx.max.x - 0.03, bx.min.y + 0.03, 0], [bx.min.x + 0.15, bx.min.y + 0.08, 0], [0, bx.min.y, bx.max.z - 0.02], [0, bx.min.y, bx.min.z + 0.02]];
      let centre = 0, low = Infinity;
      pts.forEach((p, i) => { pt.set(p[0], p[1], p[2]); mesh.localToWorld(pt); group.worldToLocal(pt); const gap = pt.y - waterHeightAt(cur!.atlas, pt.x, pt.z, t); if (i === 0) centre = gap; low = Math.min(low, gap); });
      return [centre, low];
    };
    /** Rotate a bone about a world-space axis through its head (the rotation expressed in its parent's frame, premultiplied). */
    const rotBone = (b: THREE.Object3D | null, axisWorld: THREE.Vector3, rad: number) => {
      if (!b || !b.parent || Math.abs(rad) < 1e-4) return;
      b.parent.getWorldQuaternion(tmpQ).invert(); axV.copy(axisWorld).applyQuaternion(tmpQ).normalize(); axQ.setFromAxisAngle(axV, rad); b.quaternion.premultiply(axQ);
    };
    const UP = new THREE.Vector3(0, 1, 0);
    const placeRider = (t: number, dt: number) => {
      if (!surfer || !cur || !surfer.visible) return;
      const {atlas, sx, ride} = cur, m = atlas.meta, H = m.face_m;
      const ph = reduced || !rideAct ? 0.3 : (rideAct.time / rideDur) % 1;
      // the ride line this instant (time-sampled table, linear between samples): along-crest x, height fraction, velocity, acceleration
      const fi = ph * NT, i0 = Math.floor(fi) % NT, f = fi - Math.floor(fi);
      const x = lerpT(ride.x, i0, f), frac = lerpT(ride.fr, i0, f), vx = lerpT(ride.vx, i0, f), vh = lerpT(ride.vh, i0, f), axx = lerpT(ride.ax, i0, f), ahh = lerpT(ride.ah, i0, f);
      const xb = breakX(m, t), [fy, fz, slope] = facePoint(atlas, x, frac, t);
      const k = surferRef.current / SURFER_MODEL_M; Ms.makeScale(k, k, k);
      // the board's heading: its velocity over the water (the water streams at uFlowX toward the break in this frame; up the face it moves
      // with the wave), from the ride line's position on the actual surface a frame either side. Crest frame: x along the crest, y up, z seaward.
      const dph = 1 / (30 * ride.T), ph0 = (ph - dph + 1) % 1, ph1 = (ph + dph) % 1, j0 = Math.floor(ph0 * NT) % NT, j1 = Math.floor(ph1 * NT) % NT;
      const [fy0, fz0] = facePoint(atlas, lerpT(ride.x, j0, ph0 * NT - Math.floor(ph0 * NT)), lerpT(ride.fr, j0, ph0 * NT - Math.floor(ph0 * NT)), t - 1 / 30);
      const [fy1, fz1] = facePoint(atlas, lerpT(ride.x, j1, ph1 * NT - Math.floor(ph1 * NT)), lerpT(ride.fr, j1, ph1 * NT - Math.floor(ph1 * NT)), t + 1 / 30);
      const tanS = Math.max(0.3, Math.tan(slope)), flowX = u.uFlowX.value;
      F.set(vx - flowX, (fz1 - fz0) * 15, -(fy1 - fy0) * 15); if (F.lengthSq() < 1e-6) F.set(-1, 0, 0); F.normalize();
      // the deck normal: the face normal made perpendicular to the heading, leaned into the turn by the lateral acceleration (atan(a/g), capped
      // so a rail never buries more than 15 cm), so the board banks with the face and carves into both turns
      N.set(0, Math.cos(slope), -Math.sin(slope)); U.copy(N).addScaledVector(F, -N.dot(F)).normalize(); Rv.crossVectors(F, U);
      Av.set(axx, ahh, ahh / tanS); const lean = leanS.step(THREE.MathUtils.clamp(Math.atan2(0.65 * Av.dot(Rv), G), -LEAN_MAX, LEAN_MAX), dt, 14);
      U.multiplyScalar(Math.cos(lean)).addScaledVector(Rv, Math.sin(lean)).normalize(); Rv.crossVectors(F, U).normalize();
      const tilt = Math.acos(THREE.MathUtils.clamp(U.y, -1, 1));   // the deck's tilt from upright (the torso counters part of it below)
      // the model: nose at -x, deck up +y, facing the wave; a right mirrors the whole frame (group.scale.x = -1)
      posV.set(x, fz, -fy);
      Mb.makeBasis(noseV.copy(F).negate(), U, Rv.clone().negate()).setPosition(posV).multiply(Ms);
      surfer.matrix.copy(Mb); surfer.updateMatrixWorld(true);
      // the board's bottom centre on the water; a rail deeper than 14 cm lifts it that little (a turn engages a rail). The inputs (ride line,
      // lean, face) are continuous, so this is too: no per-frame search, no steps
      const [gc, gl] = contactM(t), shift = Math.max(-gc, -0.14 - gl);
      if (Math.abs(shift) > 0.002) { posV.y += shift; Mb.setPosition(posV); surfer.matrix.copy(Mb); surfer.updateMatrixWorld(true); }
      // the body: the head and shoulders lead the heading by 0.2 s (from the ride line's heading ahead), the arms counter the lean
      const yawNow = lerpT(ride.yaw, i0, f), j = Math.floor(((ph + 0.2 / ride.T) % 1) * NT) % NT, lead = leadS.step(THREE.MathUtils.clamp(wrapPi(ride.yaw[j] - yawNow), -0.5, 0.5), dt, 12);
      if (bones && !reduced) {
        // on a steep face the board goes near-vertical with the legs; the torso stays up over the board (a real rider bends at the hips and
        // knees rather than lying along the wall): the torso root counters most of the deck tilt beyond TILT_MAX, eased so it never snaps
        const over = torsoS.step(Math.max(0, tilt - TILT_MAX), dt, 10);
        if (over > 1e-3) { axV.crossVectors(U, UP).normalize(); rotBone(bones.torso, axV, over); }
        rotBone(bones.spine, UP, lead * 0.35); rotBone(bones.neck, UP, lead * 0.25); rotBone(bones.head, UP, lead * 0.4);
        rotBone(bones.armL, F, -lean * 0.35); rotBone(bones.armR, F, -lean * 0.35);
        surfer.updateMatrixWorld(true);
      }
      // the tail (crest frame) and its velocity: the top-turn spray leaves from here, with the board
      const bd = boardOf();
      if (spray && bd) {
        pt.set(bd.box.max.x - 0.03, bd.box.min.y + 0.03, 0); bd.obj.localToWorld(pt); group.worldToLocal(pt);
        if (haveVel && dt > 0) { spray.tailVel[0] = (pt.x - prevTail.x) / dt; spray.tailVel[1] = (pt.y - prevTail.y) / dt; spray.tailVel[2] = (pt.z - prevTail.z) / dt; }
        prevTail.copy(pt); spray.tail[0] = pt.x; spray.tail[1] = pt.y; spray.tail[2] = pt.z;
        const move = moveAt(ph); spray.tailOn = move === 'top' ? THREE.MathUtils.smoothstep(Math.abs(lean), 0.12, 0.3) : 0;
      }
      // the measured velocity of the board centre (for the heading check) and the sample
      let headErr = 0, vxM = vx;
      if (haveVel && dt > 0) { vxM = (posV.x - prevPos.x) / dt; noseV.set(vxM - flowX, (posV.y - prevPos.y) / dt, (posV.z - prevPos.z) / dt); if (noseV.lengthSq() > 0.04) headErr = THREE.MathUtils.radToDeg(F.angleTo(noseV)); }
      prevPos.copy(posV); haveVel = true; lastPlace = t;
      const gap = gc + shift, lowGap = gl + shift;
      probe = {ph, frac, x, fy, fz, slope, xb, lean, lead, gap, lowGap, vx, vh, maxFrac: lerpT(ride.maxFr, i0, f)};
      return {x, y: fz, z: -fy, xb, move: moveAt(ph), frac, headErr, vx: vxM, vWater: flowX - vxM};
    };
    let probe: Record<string, number> | null = null;
    /** Dev: the placement this frame plus each board contact point (crest frame) and the water under it. */
    const probeRider = () => {
      if (!surfer || !cur) return null; const t = u.uTime.value; surfer.updateMatrixWorld(true);
      const bd = boardOf(); if (!bd) return null;
      const mesh = bd.obj, bx = bd.box; const pts: Record<string, [number, number, number]> = {tail: [bx.max.x - 0.03, bx.min.y + 0.03, 0], nose: [bx.min.x + 0.15, bx.min.y + 0.08, 0], railA: [0, bx.min.y, bx.max.z - 0.02], railB: [0, bx.min.y, bx.min.z + 0.02]};
      const out: Record<string, unknown> = {...probe, bbox: [bx.min.toArray(), bx.max.toArray()]};
      for (const [n, p] of Object.entries(pts)) { pt.set(p[0], p[1], p[2]); mesh.localToWorld(pt); group.worldToLocal(pt); out[n] = {x: pt.x, y: pt.y, z: pt.z, water: waterHeightAt(cur.atlas, pt.x, pt.z, t)}; }
      pt.set(0, 0, 0); mesh.localToWorld(pt); group.worldToLocal(pt); out.origin = {x: pt.x, y: pt.y, z: pt.z, water: waterHeightAt(cur.atlas, pt.x, pt.z, t)};
      const o = pt.clone(); for (const [n, ax] of [['nodeX', [1, 0, 0]], ['nodeY', [0, 1, 0]], ['nodeZ', [0, 0, 1]]] as const) { pt.set(ax[0], ax[1], ax[2]); mesh.localToWorld(pt); group.worldToLocal(pt); pt.sub(o); out[n] = [pt.x, pt.y, pt.z]; }
      out.F = F.toArray(); out.U = U.toArray(); out.N = N.toArray(); out.over = torsoS.x;
      if (bones?.torso && bones.spine) { const a = new THREE.Vector3(), c = new THREE.Vector3(); bones.torso.getWorldPosition(a); bones.spine.getWorldPosition(c); group.worldToLocal(a); group.worldToLocal(c); out.torsoDir = c.sub(a).normalize().toArray(); }
      return out;
    };
    /** Dev/QA sample (every frame in dev, ~100 ms otherwise): the board's tail in the crest frame, its gap to the water, how far ahead of the
     *  break point, the move, the height fraction, the heading error, the canvas position and the along-crest speeds. */
    const sampleRider = (t: number, r: {x: number; y: number; z: number; xb: number; move: string; frac: number; headErr: number; vx: number; vWater: number}) => {
      if (!surfer || !cur) return;
      const bd = boardOf(); if (!bd) return;
      const mesh = bd.obj, bx = bd.box;
      pt.set(bx.max.x - 0.03, bx.min.y + 0.03, 0); mesh.localToWorld(pt); group.worldToLocal(pt);
      const r3 = (n: number) => Math.round(n * 1000) / 1000, [gc, gl] = contactM(t);
      pt.set(0, 0, 0); mesh.localToWorld(pt); pt.project(camera);
      rider = {x: r3(prevTail.x), y: r3(prevTail.y), z: r3(prevTail.z), contact_m: r3(gc), low_m: r3(gl), ahead_m: r3(r.xb - r.x), move: r.move, frac: r3(r.frac), heading_err_deg: Math.round(r.headErr * 10) / 10, screen: [r3((pt.x + 1) / 2), r3((1 - pt.y) / 2)], vx_mps: r3(r.vx), v_water_mps: r3(r.vWater)};
      if (import.meta.env.DEV) el.dataset.rider = JSON.stringify(rider);
    };
    const placeCamera = (mode: 'surf' | 'swell', tx: number, H: number, far: number) => {
      // surf: the wave with the rider in it (the rider about 40% in from the shoulder side, wave and person both readable), from the water
      // on the beach side a little down the line, eye just under the lip; a narrow (phone) frame backs off further. Once placed, the follow
      // camera (frame loop) tracks the rider; while the follow is paused by a drag, an hour change re-centres as before.
      const d = mode === 'surf' ? (5.5 + H * 2.8) * (camera.aspect < 1 ? 1.35 : 1) : 14 + far * 0.25, sx = dir === 'right' ? -1 : 1;
      if (placed !== mode) {
        placed = mode;
        // eye a little above the lip looking slightly down (polar ~78 deg), so a vertical drag has travel both ways (T-062: the old eye-level
        // placement sat 2 deg from the polar clamp)
        if (mode === 'surf') { controls.target.set(sx * tx, H * 0.5, 0); camera.position.set(sx * (tx - 0.42 * d), H * 0.5 + 0.22 * d, -0.95 * d); }
        else { controls.target.set(0, 0, far * 0.3); camera.position.set(-0.3 * d, 2.2 + 1.2 * H, -0.6 * d); } // low over the water, so the swell lines read as lines
        camS[0].set(controls.target.x); camS[1].set(controls.target.y); camS[2].set(controls.target.z);
      } else if (mode === 'surf' && !(follow && performance.now() > dragUntil)) { tmp.copy(camera.position).sub(controls.target); controls.target.set(sx * tx, H * 0.5, 0); camera.position.copy(controls.target).add(tmp); camS[0].set(controls.target.x); camS[1].set(controls.target.y); camS[2].set(controls.target.z); }
      controls.update(); sync();
    };
    /** The follow camera: a critically damped spring carries the orbit target (and the camera with it, so the orbit angles hold) toward a
     *  point a little toward the break from the rider, like a filmer tracking a ride; the rider stays readable, the wave peels past. Paused
     *  while the person drags or zooms and for 3 s after. */
    const followCamera = (dt: number) => {
      if (!surfer || !cur || !surfer.visible || placed !== 'surf' || !follow || performance.now() < dragUntil) return;
      const H = cur.atlas.meta.face_m, sgn = dir === 'right' ? -1 : 1;
      tmp.copy(prevPos); group.localToWorld(tmp); tmp.x += sgn * 0.45 * H; tmp.y += 0.22 * H;
      const w = 2 * Math.PI / 1.4, nx = camS[0].step(tmp.x, dt, w), ny = camS[1].step(tmp.y, dt, w), nz = camS[2].step(tmp.z, dt, w);
      tmp.set(nx - controls.target.x, ny - controls.target.y, nz - controls.target.z);
      controls.target.add(tmp); camera.position.add(tmp);
    };
    /** Draw a spec from already-loaded atlases: table, uniforms, strip/sea positions, surfer, spray emitters. Synchronous and allocation-light. */
    const apply = (w: WaveSpec) => {
      const look = windLook(w.wind); u.uChop.value = look.chop; back = look.back; pow = w.periodS && w.periodS > 4 ? Math.min(1.35, Math.max(0.7, Math.sqrt(w.periodS / 13))) : 1;
      if (w.faceM === null) {
        // no breaking-wave estimate: unbroken swell lines at the offshore height (labelled by the stage), no strip, no surfer
        const T = w.periodS && w.periodS > 4 ? w.periodS : 12, Lb = T * Math.sqrt(9.81 * 10), Hs = w.offshoreM && w.offshoreM > 0 ? w.offshoreM : 0.25;
        const m = {...(ready.get('4-6')?.meta ?? ({} as AtlasMeta)), face_m: Hs, Lb_m: Lb, y0_m: -0.5 * Lb, y1_m: 5, break_len_m: 40, shoulder_len_m: 40} as AtlasMeta;
        u.uStrip.value = 0; u.uSetH.value = Hs; u.uLb.value = Lb; u.uFace.value = Hs; const [x0, x1] = stripX(m); u.uX0.value = x0; u.uX1.value = x1; u.uY0.value = m.y0_m; u.uY1.value = m.y1_m;
        setSea(sea.geometry, m); sea.visible = true; strip.visible = false; if (surfer) surfer.visible = false; if (spray) spray.pts.visible = false;
        faceM = Hs; placeCamera('swell', 0, Hs, Lb); el.dataset.mode = w.offshoreM ? 'swell' : 'none'; el.dataset.face = ''; delete el.dataset.surfer; delete el.dataset.breaker;
        return;
      }
      const c = composeAtlas(w.faceM, w.breaker, w.periodS); if (!c.atlas) return;
      const atlas = c.atlas, m = atlas.meta, H = m.face_m; faceM = H;
      if (tex.value && tex.value.image.width === m.points && tex.value.image.height === 2 * m.stages) { (tex.value.image.data as Float32Array).set(atlas.data); tex.value.needsUpdate = true; }
      else { tex.value?.dispose(); const t = new THREE.DataTexture(atlas.data.slice(), m.points, 2 * m.stages, THREE.RGBAFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; tex.value = t; }
      const [x0, x1] = stripX(m);
      u.uFace.value = H; u.uNS.value = m.stages; u.uNP.value = m.points; u.uPitch.value = m.stage_pitch; u.uLand.value = m.stage_land; u.uDb.value = m.depth_break_m; u.uBed.value = m.bed_along_per_m;
      u.uSh.value = m.shoulder_len_m; u.uBl.value = m.break_len_m; u.uCyc.value = m.cycle_s; u.uX0.value = x0; u.uX1.value = x1; u.uY0.value = m.y0_m; u.uY1.value = m.y1_m; u.uLb.value = m.Lb_m;
      u.uFlowX.value = Math.min(m.peel_speed_mps, 6); u.uFlowZ.value = Math.min(m.celerity_mps, 4); u.uSpill.value = m.breaker === 'spilling' ? 1 : 0; u.uSetH.value = 0.36 * H; u.uStrip.value = 1;
      u.uBreak.value = w.breaker === 'spilling' ? 1 : w.breaker === 'plunging' ? 0 : m.breaker === 'spilling' ? 1 : 0;   // the forecast's breaker type, the bucket family's when unknown
      const sx = surferX(m);
      setStripX(strip.geometry, m, sx); setSea(sea.geometry, m); strip.visible = sea.visible = true;
      // the ride line for this wave: the clip loops a whole number of times per wave cycle (twice on a long cycle), so the line is sampled
      // for that loop period; its x and height are clamped into the face's rideable envelope and ahead of the break once, not per frame
      const loops = Math.max(1, Math.round(m.cycle_s / rideDur));
      cur = {atlas, sx, ride: buildRide(atlas, sx, m.cycle_s / loops, u.uFlowX.value)}; haveVel = false;
      if (surfer) {
        // the rider (scaled to the person's height, T-099) rides the open face ahead of the pocket, facing the wave (frontside), board nose down
        // the line (-x): a goofy-foot stance on a left; a right is the whole frame mirrored (regular-foot frontside). Placed each frame by placeRider.
        if (rideAct) rideAct.timeScale = rideDur * loops / m.cycle_s;
        surfer.visible = true; placeRider(u.uTime.value, 1 / 60); surfer.updateMatrixWorld(true);
        bb.setFromObject(surfer); el.dataset.surfer = JSON.stringify(bb.min.toArray().concat(bb.max.toArray()).map((n) => Math.round(n * 100) / 100));
      }
      if (spray) { const e = emitters(atlas); spray.lip = e.lip; spray.crest = e.crest; spray.mist = e.mist; spray.blast = e.blast; spray.pts.visible = true; }
      placeCamera('surf', (sx - 0.5 * H) * 0.62, H, 0);   // between the rider's line (half a face height out on the shoulder) and the break, nearer the rider
      el.dataset.mode = 'surf'; el.dataset.face = String(Math.round(H * 100) / 100); el.dataset.breaker = w.breaker ?? m.breaker; el.dataset.atlasFamily = m.breaker; el.dataset.atlasBytes = String(atlas.data.byteLength);
    };
    /** The latest spec wins: applied at once when its buckets are loaded, otherwise after they load (the first call also loads the surfer). */
    const setWave = (w: WaveSpec) => {
      pending = w; const my = ++token;
      const need = w.faceM === null ? [] : composeAtlas(w.faceM, w.breaker, w.periodS).need;
      // the surfer is only needed (and only a failure) for a breaking wave; an offshore-only hour renders its swell without it
      const needSurfer = !surfer && w.faceM !== null, waits: Promise<unknown>[] = need.filter((id) => !ready.has(id)).map(getAtlas); if (needSurfer) waits.push(loadSurfer());
      const go = () => { if (disposed || my !== token || !pending) return; apply(pending); if (!live0) { live0 = true; setLive(true); cb.current.onReady?.(); } };
      if (!waits.length) { go(); return; }
      Promise.all(waits).then((res) => {
        if (disposed || my !== token) return;
        if (needSurfer && !surfer) {
          const s = res[res.length - 1] as {scene: THREE.Group; clips: THREE.AnimationClip[]} | null; if (!s) throw new Error('no surfer');
          surfer = cloneSkinned(s.scene) as THREE.Group; surfer.matrixAutoUpdate = false; group.add(surfer);
          surfer.traverse((o) => { const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mm && 'emissiveIntensity' in mm) mm.emissiveIntensity = 0.15; (o as THREE.Mesh).frustumCulled = false; }); setBoard(boardRef.current);
          const bone = (n: string) => surfer!.getObjectByName(n) ?? null;
          bones = {torso: bone('spine_01'), spine: bone('spine_03'), neck: bone('neck_01'), head: bone('head'), armL: bone('upperarm_l'), armR: bone('upperarm_r')};
          const ride = THREE.AnimationClip.findByName(s.clips, 'ride'), still = THREE.AnimationClip.findByName(s.clips, 'still');
          if (ride || still) {
            mixer = new THREE.AnimationMixer(surfer);
            if (reduced && still) mixer.clipAction(still).play();          // reduced motion: the still bottom-turn pose
            else if (ride) { rideDur = ride.duration; rideAct = mixer.clipAction(ride); rideAct.setLoop(THREE.LoopRepeat, Infinity).play(); }
            else if (still) mixer.clipAction(still).play();
            el.dataset.clips = s.clips.map((c) => c.name).join(',');
          }
        }
        if (!spray) { spray = makeSpray(); group.add(spray.pts); }
        if (pending && pending.faceM !== null && !composeAtlas(pending.faceM, pending.breaker, pending.periodS).atlas) throw new Error('atlas missing');
        go();
      }).catch(() => { if (!disposed && my === token) cb.current.onFail?.(); });
    };
    const setDir = (d: 'left' | 'right') => {
      if (d === dir) return; dir = d; group.scale.x = d === 'right' ? -1 : 1; group.updateMatrixWorld(true);
      camera.position.x *= -1; controls.target.x *= -1; camS[0].set(controls.target.x); camS[1].set(controls.target.y); camS[2].set(controls.target.z); controls.update(); sync(); el.dataset.dir = d;
      if (surfer && surfer.visible) { bb.setFromObject(surfer); el.dataset.surfer = JSON.stringify(bb.min.toArray().concat(bb.max.toArray()).map((n) => Math.round(n * 100) / 100)); }
    };
    el.dataset.dir = dir;
    // P5a: the hour's light (sun direction and colour, sky, twilight dimming)
    const setLight = (l: Lighting | null) => {
      const c = (v: [number, number, number]) => new THREE.Color().setRGB(v[0], v[1], v[2], THREE.SRGBColorSpace);
      if (!l) { u.uSun.value.copy(SUN); u.uSunCol.value.set('#fff3df'); u.uHorizon.value.copy(HORIZON); u.uTop.value.copy(SKY_TOP); u.uGlow.value.setRGB(0, 0, 0); u.uAmb.value = 1; u.uDirect.value = 1; }
      else {
        u.uSun.value.set(l.sun[0], l.sun[1], l.sun[2]).normalize(); u.uSunCol.value.copy(c(l.sunColor)); u.uHorizon.value.copy(c(l.horizon)); u.uTop.value.copy(c(l.top)); u.uAmb.value = l.ambient;
        u.uDirect.value = Math.min(1, Math.max(...l.sunColor)); u.uGlow.value.copy(c(l.glow));
      }
      renderer.setClearColor(u.uHorizon.value); sun.position.copy(u.uSun.value).multiplyScalar(50);
      sun.intensity = l ? l.dirIntensity : 2.2; sun.color.copy(l ? c(l.sunColor).multiplyScalar(1 / Math.max(0.05, Math.max(...l.sunColor))) : new THREE.Color(0xfff1dc));
      if (l) { hemi.color.copy(c(l.hemiSky)); hemi.groundColor.copy(c(l.hemiGround)); hemi.intensity = l.hemiIntensity; } else { hemi.color.set(0xdfeaf2); hemi.groundColor.set(0x2b5d70); hemi.intensity = 1.1; }
      el.dataset.sunEl = l ? String(Math.round(l.elevation * 10) / 10) : ''; el.dataset.light = l ? l.phase : 'neutral';
    };
    // P5b: the selected Quiver board replaces the model's board at its true size, the deck under the feet where the model's was
    const setBoard = (b: Surfboard | null) => {
      if (!surfer) return;
      if (custom) { custom.parent?.remove(custom); custom.geometry.dispose(); (custom.material as THREE.Material).dispose(); custom = null; }
      const orig = surfer.getObjectByName('Board'); if (!orig) return;
      orig.visible = !b; delete el.dataset.board; if (!b) return;
      const g = boardGeometry(boardShape(b, loadOutline(b.id)?.hw ?? null)), geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3)); geo.setIndex(g.indices); geo.computeVertexNormals();
      let base: THREE.Material | null = null; orig.traverse((o) => { const mm = (o as THREE.Mesh).material as THREE.Material | undefined; if (mm && !base) base = mm; });
      const mat: THREE.Material = base ? (base as THREE.Material).clone() : new THREE.MeshStandardMaterial({color: 0xf2f0ea, roughness: 0.45}); mat.side = THREE.DoubleSide;
      custom = new THREE.Mesh(geo, mat); custom.name = 'QuiverBoard'; custom.position.copy(orig.position); custom.quaternion.copy(orig.quaternion); custom.scale.copy(orig.scale);
      orig.parent?.add(custom); surfer.updateMatrixWorld(true);
      geo.computeBoundingBox(); const bx = geo.boundingBox!; el.dataset.board = JSON.stringify({id: b.id, length_m: Math.round((bx.max.x - bx.min.x) * 1000) / 1000, width_m: Math.round((bx.max.z - bx.min.z) * 1000) / 1000});
    };
    api.current = {setWave, setDir, setLight, setBoard};
    setLight(lightRef.current);
    if (import.meta.env.DEV) (window as unknown as {__wave?: unknown}).__wave = {camera, controls, uniforms: u, sync, setWave, setDir, setBoard, rider: () => rider, probe: probeRider, surfer: () => surfer}; // dev-only hook for camera-scripted QA shots (setWave: draw any spec; rider: the last RiderSample)

    // render loop: only while visible and the tab is shown
    let frames = 0, statAt = performance.now(), visible = true, raf = 0, last = performance.now(), t0 = last, worst = 0;
    const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) kick(); }); io.observe(el);
    const frame = (now: number) => {
      raf = 0; if (disposed || !visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000); worst = Math.max(worst, now - last); last = now; u.uTime.value = (now - t0) / 1000;
      mixer?.update(dt); const r = placeRider(u.uTime.value, dt); followCamera(dt); controls.update(); if (spray && spray.pts.visible) stepSpray(spray, dt, faceM); renderer.render(scene, camera); frames++;
      if (r && now - riderAt > (import.meta.env.DEV ? 30 : 100)) { riderAt = now; sampleRider(u.uTime.value, r); } // dev: ~30 Hz for the QA harness (sampling every frame caused GC hitches: 1% low 53.5)
      if (now - statAt > 1000) { el.dataset.fps = String(Math.round(frames * 1000 / (now - statAt))); el.dataset.worstMs = String(Math.round(worst)); el.dataset.geoms = String(renderer.info.memory.geometries); el.dataset.textures = String(renderer.info.memory.textures); frames = 0; worst = 0; statAt = now; }
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const vis = () => { if (!document.hidden) kick(); }; document.addEventListener('visibilitychange', vis);
    size(); setDir(waveRef.current.direction); setWave(waveRef.current); kick();
    for (const b of ATLAS_BANDS) void getAtlas(b.id); // warm every bucket (18 KB each) so hour changes are instant
    const onLost = (e: Event) => { e.preventDefault(); cb.current.onFail?.(); }; canvas.addEventListener('webglcontextlost', onLost);
    return () => {
      disposed = true; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', vis); canvas.removeEventListener('webglcontextlost', onLost); controls.dispose();
      mixer?.stopAllAction(); strip.geometry.dispose(); sea.geometry.dispose(); spray?.pts.geometry.dispose(); tex.value?.dispose(); if (custom) { custom.geometry.dispose(); (custom.material as THREE.Material).dispose(); }
      stripMat.dispose(); seaMat.dispose(); spMat.dispose(); sky.geometry.dispose(); (sky.material as THREE.Material).dispose(); renderer.dispose(); canvas.remove(); api.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useRef(wave);
  useEffect(() => { if (prev.current !== wave && !sameSpec(prev.current, wave)) api.current?.setWave(wave); prev.current = wave; }, [wave]);
  useEffect(() => { api.current?.setDir(wave.direction); }, [wave.direction]);
  useEffect(() => { api.current?.setLight(lightRef.current); }, [light?.spotId, light?.iso]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevSurfer = useRef(surferM);
  useEffect(() => { if (prevSurfer.current !== surferM) api.current?.setWave(waveRef.current); prevSurfer.current = surferM; }, [surferM]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.setBoard(boardRef.current); }, [board?.id, board?.length, board?.width, board?.thickness, board?.type]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={'live' + (live ? ' is-live' : '')} data-state={live ? 'live' : 'loading'} data-band={bucketIdFor(wave.faceM)} data-dir={wave.direction} data-mode={wave.faceM === null ? (wave.offshoreM ? 'swell' : 'none') : 'surf'} role="group" aria-label={`3D view, ${alt}. Drag to orbit, scroll or pinch to zoom.`}>
      <img className="live-poster" src={poster} alt="" aria-hidden="true" draggable={false} />
      <div ref={host} className="live-host" />
    </div>
  );
}
export default WaveLive;
