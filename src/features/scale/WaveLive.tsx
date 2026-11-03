import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {ATLAS_BANDS, type Atlas, type AtlasMeta, blendAtlas, bucketIdFor, bucketsFor, facePoint, loadAtlas, profileAt, scaleAtlas, stageAt, stripX, surferX, withPeriod} from './waveAtlas';
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
  p+=N*foam*((lump-.35)*.14+(big-.4)*.2*onBall)*uFace;
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
  return c+uSunCol*pow(max(dot(r,uSun),0.),90.)*.7; }   // the sun's halo in the reflection: tighter than before, so the trough is not one cream streak
// wind chop and capillary ripples: octaves of C1 value noise with analytic slopes (smooth, no grid squares, no long parallel bands),
// stretched across the wind and drifting; each octave fades once it gets near a pixel, and what fades becomes roughness
float hq(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 noised(vec2 x){ vec2 i=floor(x), f=fract(x); vec2 u=f*f*f*(f*(f*6.-15.)+10.), du=30.*f*f*(f*(f-2.)+1.);
  float a=hq(i), b=hq(i+vec2(1.,0.)), c=hq(i+vec2(0.,1.)), d=hq(i+vec2(1.,1.));
  return vec3(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y, du*(vec2(b-a,c-a)+(a-b-c+d)*u.yx)); }
vec3 chopN(vec2 p, float t, float px, float k0, float a0, int n){
  vec2 g=vec2(0.); float a=a0, k=k0, lost=0., tot=0.; mat2 rot=mat2(.8,.6,-.6,.8);
  vec2 q=p;
  for (int i=0;i<10;i++){ if (i>=n) break;
    vec2 st=vec2(q.x,q.y*1.8)*k+vec2(t*.13*float(i+1),-t*.21*sqrt(float(i+1)));   // longer across the wind than along it
    vec3 nd=noised(st); float fade=1.-smoothstep(.06,.5,px*k), sl=a;
    g+=rot*(nd.yz*vec2(1.,1.8))*a*fade; lost+=sl*sl*(1.-fade); tot+=sl*sl;
    q=rot*q; k*=1.9; a*=.62; }
  return vec3(g,lost/max(tot,1e-6));
}
vec3 chop(vec2 p, float t, float px){ return chopN(p,t,px,.45,.055,8); }
vec3 farChop(vec2 p, float t, float px){ return chopN(p+vec2(91.,37.),t*.6,px,.06,.05,8); }
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
  vec3 cn=chop(pf,t,px), cf=farChop(vL.xz,t,px);
  float far=smoothstep(35.,140.,dist)*(1.-onFace);
  vec2 g=mix(cn.xy*(1.-.25*onFace)*(1.+onFace*bigF*3.)*uChop,cf.xy*(.6+.4*uChop),far);   // uChop: the hour's wind (glassy offshore .. onshore chop)
  float rough=mix(cn.z,cf.z,far);                               // slope detail too fine to draw: a rougher, blurrier reflection instead
  // draining lines on the face just before it breaks: long streaks down the face that drift up with the water
  float pre=smoothstep(.8,2.2,vS)*(1.-smoothstep(4.6,6.2,vS))*onFace*front;
  float st=(vnoise(vec2(vL.x*2.6, arc*.22-t*.35))*.65+vnoise(vec2(vL.x*7.1, arc*.5-t*.5))*.35)*smoothstep(.3,.8,vnoise(vec2(vL.x*.9, arc*1.2+3.)));
  vec3 N=normalize(N0-vec3(g.x,0.,g.y)+vec3((st-.3)*.22*pre,0.,0.));
  float nv=max(dot(N,V),0.), fres=.02+.98*pow(1.-nv,5.);
  vec3 R=reflect(-V,N); R.y=abs(R.y); vec3 sky=mix(skyCol(R),skyCol(normalize(R+vec3(0.,.35,0.))),rough*.7);
  fres*=1.-.35*rough;
  // body colour by thickness: thick water deep blue-green to near black, thin water turquoise where light comes through
  float back=smoothstep(-.1,.9,dot(-V,uSun)), sunUp=uDirect;
  // front face: deep blue-green to near black at the thick base, lighter up the face; the back of the wave stays sea-coloured
  float hf=clamp(vW.y/F,0.,1.2);
  vec3 face=mix(uDeep,uBody,smoothstep(.0,.75,hf))*mix(.8,1.,smoothstep(3.,.8,thick));
  float fw=max(onFace,smoothstep(.05,.45,hf))*front;
  vec3 body=mix(uSea*mix(1.,.82,smoothstep(.05,.6,hf)*(1.-front)),face,fw);
  float glow=clamp(thin*(.4+.6*back*sunUp)*(.4+.6*front)*mix(.55,1.,uAmb),0.,1.)*.8;
  float tube=smoothstep(-.1,-.6,N0.y)*smoothstep(.2,.6,hf);                // the ceiling of the tube: in its own shadow
  body=mix(body,uTurq*(.75+.35*back),glow*.9);
  body*=(.94+.14*st*pre+.04*(1.-pre))*(1.-.5*tube*(1.-glow));
  body*=uAmb*(.75+.35*mix(.55,clamp(dot(N,uSun)*.5+.5,0.,1.),uDirect));
  vec3 col=mix(body,sky,clamp(fres,0.,1.)*.62);
  // sun glint: broad and soft, from the large-scale normal; almost none on the face (no glitter)
  vec3 Ns=normalize(N0-vec3(g.x,0.,g.y)*.5); vec3 Hh=normalize(V+uSun);
  col+=uSunCol*pow(max(dot(Ns,Hh),0.),220.)*.55*(1.-.85*onFace);
  // foam: the atlas foam (lip, foam ball, spill), lumpy and aerated, grey in its cavities and on its underside
  vec3 q=vL/(.22*F)+vec3(0.,-t*.35,t*.25);
  float lump=n3(q)*.6+n3(q*2.3+7.)*.3+n3(q*5.3+3.)*.1;
  float cov=smoothstep(.22,.62,foam*(.75+.6*lump));
  cov=max(cov,smoothstep(.78,.95,foam));                                    // the landed section and foam ball are solid white: no dark holes ("teeth") where a lump dips
  // a spilling forecast (uBreak 1): the crest tumbles a ragged band of foam down the top of the front face of the breaking section, the
  // open face below it stays green; a plunging one (0) keeps the atlas's clean thrown lip. Only where the section has started to break.
  // a solid fringe along the very top, its lower edge ragged (low-frequency lumps), so it reads as one tumbling crest and not as flecks
  float rag=n3(q*.45+vec3(2.,0.,0.))*.6+n3(q*1.1+5.)*.4;
  float spillBand=smoothstep(.58-.22*rag,.88-.1*rag,hf)*front*smoothstep(uPitch-1.4,uPitch+.2,vS)*uBreak;
  cov=max(cov,spillBand);
  vec3 Nf=normalize(N0+vec3(n3(q*1.7+1.)-.5,0.,n3(q*1.7+9.)-.5)*1.4);
  float bigS=n3(vL/(.75*F)+vec3(3.,-t*.12,t*.1));                         // the same big heads the vertex shader pushes out
  float occl=smoothstep(.18,.82,lump*.55+bigS*.45), lit=mix(.6,clamp(dot(Nf,uSun)*.55+.55,0.,1.),uDirect);
  float under=smoothstep(-.35,.45,N0.y);
  float base=mix(.6,1.,smoothstep(.0,.45*F,vW.y));                          // greyer where the foam sits low in the water
  vec3 fcol=mix(uFoamShade,uFoam,pow(clamp(occl*.65+lit*.45-.15,0.,1.),1.4)*mix(.45,1.,under)*base)*uAmb*mix(vec3(1.),uTop/max(max(uTop.r,uTop.g),max(uTop.b,.01)),.3*(1.-uDirect));
  col=mix(col,fcol,cov);
  // lacy foam: trails behind the broken section and a decaying band inside, thinning into lace with age
  // (only where the section has already broken: nothing on the clean water in front of the pocket)
  float behind=smoothstep(.1*uBl,.3*uBl,vL.x)*exp(-max(vL.z,0.)/(uFlowZ*3.+4.*F))*step(0.,vL.z);
  float broken=1.-smoothstep(1.4*uBl,2.6*uBl,vL.x);
  float lm=broken*behind*(1.-cov)*(1.-onFace)*(uSpill>.5?1.2:1.)*uStrip;   // nothing has broken when there is no strip (swell-only hour)
  if (lm>.02){
    vec2 w=E+vec2(vnoise(E*.3),vnoise(E*.3+5.))*2.5;                 // warp: organic, not a honeycomb
    float sc=1./max(F*.45,.5);
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
let surferCache: Promise<THREE.Group> | null = null;
/** An atlas by file id; null when the file is missing (a breaker variant that was not built). Resolved atlases are kept for synchronous use. */
const getAtlas = (id: string) => { let p = atlasCache.get(id); if (!p) { p = loadAtlas(ATLAS_ROOT, id).then((a) => { ready.set(id, a); return a; }, () => null); atlasCache.set(id, p); } return p; };
/** The surfer model's own height (m); the drawn surfer is scaled to the person's height. */
export const SURFER_MODEL_M = 1.75;
const loadSurfer = () => (surferCache ??= loader.loadAsync(LIVE_ROOT + 'surfer.glb').then((g) => g.scene).catch((e) => { surferCache = null; throw e; }));

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
const N_LIP = 700, N_BACK = 520, N_MIST = 240, N_BLAST = 420, SPRAY_N = N_LIP + N_BACK + N_MIST + N_BLAST;
interface Spray {pts: THREE.Points; pos: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; size: Float32Array; alpha: Float32Array; lip: Float32Array; crest: Float32Array; mist: Float32Array; blast: Float32Array}
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
    const spMat = new THREE.ShaderMaterial({uniforms: {uScale: {value: 600}, uAmb: u.uAmb}, vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, transparent: true, depthWrite: false});
    const size = () => { const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); spMat.uniforms.uScale.value = (h * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); };
    const ro = new ResizeObserver(size); ro.observe(el);

    const makeSpray = (): Spray => {
      const n = SPRAY_N, pos = new Float32Array(n * 3), life = new Float32Array(n), max = new Float32Array(n).fill(1), size = new Float32Array(n), alpha = new Float32Array(n), vel = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) life[i] = -Math.random() * 2;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aA', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
      const pts = new THREE.Points(g, spMat); pts.frustumCulled = false; const e = new Float32Array(0); return {pts, pos, vel, life, max, size, alpha, lip: e, crest: e, mist: e, blast: e};
    };
    const R = Math.random;
    let faceM = 1.5, pow = 1, back = 0;
    const stepSpray = (sp: Spray, dt: number, H: number) => {
      const big = Math.min(1, H / 4), sq = Math.sqrt(H) * pow;
      for (let i = 0; i < SPRAY_N; i++) {
        const kind = i < N_LIP ? 0 : i < N_LIP + N_BACK ? 1 : i < N_LIP + N_BACK + N_MIST ? 2 : 3, src = kind === 0 ? sp.lip : kind === 1 ? sp.crest : kind === 2 ? sp.mist : sp.blast, m = src.length / 3, j = i * 3;
        if (!m || (kind === 1 && back <= 0)) { sp.alpha[i] = 0; continue; }
        sp.life[i] -= dt;
        if (sp.life[i] <= 0) {
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
          } else { // mist over the whitewater
            sp.pos[j] += (R() - 0.5) * 1.2; sp.pos[j + 1] += R() * 0.3 * H; sp.vel[j] = (R() - 0.5) * 0.3; sp.vel[j + 1] = 0.1 + R() * 0.3; sp.vel[j + 2] = (R() - 0.3) * 0.5;
            sp.max[i] = sp.life[i] = 2 + R() * 2; sp.size[i] = (0.5 + R() * 0.6) * (0.5 + 0.4 * H);
          }
        }
        const gr = kind === 0 ? 4.5 : kind === 1 ? 1.2 : kind === 3 ? 3.2 : 0; if (kind === 3) sp.size[i] *= 1 + dt * 0.9;
        sp.vel[j + 1] -= gr * dt; if (kind === 1) { sp.vel[j + 2] += 0.6 * dt; sp.size[i] *= 1 + dt * 0.3; } if (kind === 2) sp.size[i] *= 1 + dt * 0.2;
        sp.pos[j] += sp.vel[j] * dt; sp.pos[j + 1] += sp.vel[j + 1] * dt; sp.pos[j + 2] += sp.vel[j + 2] * dt;
        const t = Math.max(0, sp.life[i]) / sp.max[i], env = Math.min(1, (1 - t) * 6) * Math.min(1, t * 2.5);
        sp.alpha[i] = sp.life[i] > 0 ? env * (kind === 0 ? 0.075 : kind === 1 ? (0.008 + 0.03 * big) * back : kind === 3 ? 0.3 : 0.07 + 0.03 * big) : 0;
      }
      const g = sp.pts.geometry; (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true; (g.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true; (g.getAttribute('aA') as THREE.BufferAttribute).needsUpdate = true;
    };
    let placed: 'none' | 'surf' | 'swell' = 'none', token = 0, pending: WaveSpec | null = null, live0 = false;
    const C = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1), Ci = C.clone().invert(), bb = new THREE.Box3(), Mb = new THREE.Matrix4(), Ms = new THREE.Matrix4(), Rx = new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(16)), My = new THREE.Matrix4().makeScale(1, -1, 1);
    const placeCamera = (mode: 'surf' | 'swell', tx: number, H: number, far: number) => {
      const d = mode === 'surf' ? 4.5 + H * 2.6 : 14 + far * 0.25, sx = dir === 'right' ? -1 : 1;
      if (placed !== mode) {
        placed = mode;
        // from the channel on the shoulder, eye just under the lip (a surf photographer's water shot: the lip stands against the sky, the horizon sits high)
        // (eye 0.7 H + 0.55 m: 2.8 m under a 10 ft face, 1.1 m beside a waist-high one, so a small wave is not seen from above and flattened)
        if (mode === 'surf') { controls.target.set(sx * tx, H * 0.55, 0); camera.position.set(sx * (tx - 0.7 * d), H * 0.7 + 0.55, -0.72 * d); }
        else { controls.target.set(0, 0, far * 0.3); camera.position.set(-0.3 * d, 2.2 + 1.2 * H, -0.6 * d); } // low over the water, so the swell lines read as lines
      } else if (mode === 'surf') { tmp.copy(camera.position).sub(controls.target); controls.target.set(sx * tx, H * 0.5, 0); camera.position.copy(controls.target).add(tmp); }
      controls.update(); sync();
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
      if (surfer) {
        // the surfer: 1.75 m, at the bottom of the open face (a bottom turn) on the open shoulder, facing the wave (frontside), board nose down the
        // line (-x). The exported model faces the beach, so it is mirrored across the crest plane (y -> -y in the model frame), which turns it to face
        // the wave with the right foot forward: a goofy-foot frontside stance on a left. A right is the whole frame mirrored (regular-foot frontside).
        const [fy, fz] = facePoint(atlas, sx, 0.1);
        const k = surferRef.current / SURFER_MODEL_M; // T-099: drawn at the person's height (uniform scale about the model's feet)
        Mb.makeTranslation(sx, fy + 0.2, fz - 0.03).multiply(Rx).multiply(My).multiply(Ms.makeScale(k, k, k));
        surfer.matrix.copy(C).multiply(Mb).multiply(Ci); surfer.visible = true; surfer.updateMatrixWorld(true);
        bb.setFromObject(surfer); el.dataset.surfer = JSON.stringify(bb.min.toArray().concat(bb.max.toArray()).map((n) => Math.round(n * 100) / 100));
      }
      if (spray) { const e = emitters(atlas); spray.lip = e.lip; spray.crest = e.crest; spray.mist = e.mist; spray.blast = e.blast; spray.pts.visible = true; }
      placeCamera('surf', sx * 0.4, H, 0);
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
          const s = res[res.length - 1] as THREE.Group | null; if (!s) throw new Error('no surfer');
          surfer = s.clone(true); surfer.matrixAutoUpdate = false; group.add(surfer);
          surfer.traverse((o) => { const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mm && 'emissiveIntensity' in mm) mm.emissiveIntensity = 0.15; }); setBoard(boardRef.current);
        }
        if (!spray) { spray = makeSpray(); group.add(spray.pts); }
        if (pending && pending.faceM !== null && !composeAtlas(pending.faceM, pending.breaker, pending.periodS).atlas) throw new Error('atlas missing');
        go();
      }).catch(() => { if (!disposed && my === token) cb.current.onFail?.(); });
    };
    const setDir = (d: 'left' | 'right') => {
      if (d === dir) return; dir = d; group.scale.x = d === 'right' ? -1 : 1; group.updateMatrixWorld(true);
      camera.position.x *= -1; controls.target.x *= -1; controls.update(); sync(); el.dataset.dir = d;
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
    if (import.meta.env.DEV) (window as unknown as {__wave?: unknown}).__wave = {camera, controls, uniforms: u, sync, setWave, setDir}; // dev-only hook for camera-scripted QA shots (setWave: draw any spec)

    // render loop: only while visible and the tab is shown
    let frames = 0, statAt = performance.now(), visible = true, raf = 0, last = performance.now(), t0 = last, worst = 0;
    const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) kick(); }); io.observe(el);
    const frame = (now: number) => {
      raf = 0; if (disposed || !visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000); worst = Math.max(worst, now - last); last = now; u.uTime.value = (now - t0) / 1000;
      controls.update(); if (spray && spray.pts.visible) stepSpray(spray, dt, faceM); renderer.render(scene, camera); frames++;
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
      strip.geometry.dispose(); sea.geometry.dispose(); spray?.pts.geometry.dispose(); tex.value?.dispose(); if (custom) { custom.geometry.dispose(); (custom.material as THREE.Material).dispose(); }
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
