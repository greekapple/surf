import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {ATLAS_BANDS, type Atlas, type AtlasMeta, blendAtlas, breakX, bucketIdFor, bucketsFor, faceDistanceAt, facePointInto, loadAtlas, profileAt, roofAboveAt, scaleAtlas, stageAt, stripX, surferX, withPeriod} from './waveAtlas';
import {RiderSim, S, STATE_N, Spring, type Stance, isFrontside, lerpState} from './rideSim';
import {RiderBody, samplePoses} from './riderBody';
import {GlitchMonitor} from './glitchMonitor';
import {BOARD, BODY, MONITOR, POLE, RIDE, SIM, SURF_CAM, WAKE, bandBoardFt, bandFor} from './surfSceneConfig';
import type {Skill} from '../../models/index';
import {type WaveSpec, sameSpec, windLook} from './waveSpec';
import {type Lighting, lightingAt} from './solar';
import {REFERENCE_BOARD, boardCurves, type BoardParams} from './boardMesh';
import {buildBoardObject, type BoardObject} from './boardObject';
import {loadLook, waveColours} from '../quiver/looks';
import {paramsForBoard} from '../quiver/traced';
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
/** wave-proc: the break-cycle atlas from splines traced off the licensed rows (tools/blender/proc_source.py, still licensed-derived) next to
 *  the licensed one; wave-clean: the atlas from cross-sections drawn from scratch (tools/blender/clean_source.py, CLEAN-WAVE.md; no licensed
 *  input). `?atlas=proc` / `?atlas=clean` picks one while they are compared; the default stays the licensed atlas. */
const ATLAS_KIND = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('atlas') : null;
// The default wave is the clean-room atlas (tools/blender/CLEAN-WAVE.md): no licensed input. ?atlas=licensed / ?atlas=proc compare against the old TurboSquid-derived atlases where present locally.
export const ATLAS_ROOT = BASE + (ATLAS_KIND === 'proc' ? 'media/scale3d-proc/' : ATLAS_KIND === 'licensed' ? 'media/scale3d-atlas/' : 'media/scale3d-clean/');
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
// R12: a wider, gentler peak, a gentler broken drop and NO static ripple along the crest (the user's "weird little curvature": the lip
// line bent every few metres, with a hump at the break point). Keep in step with ampAt in waveAtlas.ts.
float ampAt(float x){
  float a;
  if (x<0.) { float d=uDb+uBed*(-x), pk=exp(-pow(x/(.9*uSh),2.)); a=pow(uDb/d,.25)*(.62+.38*pk); }
  else a=1.-.35*smoothstep(.35*uBl,1.25*uBl,x);   // S1 (R7): the broken section loses height within a break length
  return a*smoothstep(uX0,.7*uX0,x)*(1.-smoothstep(.7*uX1,uX1,x));
}
// S1 (R7): the crest curved in plan: the shoulder sweeps seaward (+z) away from the peak; the weight fades at both flat tails of the
// profile so the strip's edges stay put. Keep in step with bendZ / bendW in waveAtlas.ts.
float bendZ(float x){ float s=clamp(-x/(1.2*uSh),0.,1.); return .04*uSh*s*s*s*(4.-3.*s); }   // R11: 0.12 -> 0.04, see BEND_Z in waveAtlas.ts; N5: eased 4s^3-3s^4, zero slope at the end
float bendW(float u){ return smoothstep(0.,.3,u)*(1.-smoothstep(.9,1.,u)); }`;

const STRIP_VS = /* glsl */ `
precision highp float;
uniform sampler2D uAtlas;
${ALONG}
${NOISE}
varying vec3 vW; varying vec3 vN; varying vec4 vA; varying float vS; varying vec3 vL;
// manual filtering with full-precision weights (hardware filtering quantises them to 1/256, which shows as banding along the crest):
// linear along the profile, Catmull-Rom across the stage rows (wave-kink: linear put a crease across the face at every whole stage;
// keep in step with stageWeights / sample in waveAtlas.ts)
vec4 atr(int i0, int i1, float du, int j){ return mix(texelFetch(uAtlas,ivec2(i0,j),0),texelFetch(uAtlas,ivec2(i1,j),0),du); }
vec4 atl(float u, float s, float row0){
  float fu=clamp(u,0.,1.)*(uNP-1.), fs=clamp(s,0.,uNS-1.);
  int i0=int(floor(fu)), j0=int(floor(fs)), nS=int(uNS); int i1=min(i0+1,int(uNP)-1); float du=fu-float(i0), t=fs-float(j0), t2=t*t, t3=t2*t; int r=int(row0);
  return atr(i0,i1,du,max(j0-1,0)+r)*(.5*(-t3+2.*t2-t))+atr(i0,i1,du,j0+r)*(.5*(3.*t3-5.*t2+2.))+atr(i0,i1,du,min(j0+1,nS-1)+r)*(.5*(-3.*t3+4.*t2+t))+atr(i0,i1,du,min(j0+2,nS-1)+r)*(.5*(t3-t2));
}
vec4 at0(float u,float s){ return atl(u,s,0.); }
vec4 at1(float u,float s){ return atl(u,s,uNS); }
vec3 P(float x, float u, float t){ vec4 a=at0(u,stageAt(x,t)); return vec3(x, a.y*ampAt(x), -a.x+bendZ(x)*bendW(u)); }
void main(){
  float x=position.x, u=position.y, t=uTime;
  float s=stageAt(x,t), am=ampAt(x);
  vec4 a=at0(u,s), b=at1(u,s);
  vec3 p=vec3(x, a.y*am, -a.x+bendZ(x)*bendW(u));
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
uniform float uTime, uFace, uLb, uX0, uX1, uY0, uY1, uSetH, uStrip, uLdeep, uSetN, uShore, uSwellX, uCel, uSh;
varying vec3 vW; varying vec3 vN; varying vec4 vA; varying float vS; varying vec3 vL;
float bendZ(float x){ float s=clamp(-x/(1.2*uSh),0.,1.); return .04*uSh*s*s*s*(4.-3.*s); }   // R11: 0.12 -> 0.04, see BEND_Z in waveAtlas.ts; N5: eased 4s^3-3s^4, zero slope at the end
float rectMask(vec2 p){ float dx=max(max(uX0-p.x,p.x-uX1),0.), dz=max(max(-uY1-p.y,p.y+uY0),0.); return smoothstep(0.,10.+4.*uFace,length(vec2(dx,dz))); }
float whitewater(vec2 p){
  // S3: the previous wave as a line of whitewater rolling toward the beach at the broken wave's speed, shrinking into the shore-break.
  // R6 (user's recording: "white water pops up in front of the wave periodically"): it grows from nothing over its first 14 m out from
  // under the foam ball (born at full height it appeared as a detached white block past the end of the broken section); its foam is
  // drawn per fragment (WATER_FS wwFoam), not per vertex
  float span=uShore-uY1-6., tt=mod(uTime*uCel, span+30.), zc=-uY1-6.-tt;
  float life=smoothstep(0.,14.,tt)*(1.-smoothstep(.6*span,span,tt)), near=smoothstep(-20.,10.,zc+uShore);
  float d=p.y-zc, w=mix(3.,6.,min(1.,uFace/3.)), c=cos(clamp(d/w,-1.,1.)*1.5707963);
  float A=.28*uFace*life*near*(.8+.2*sin(p.x*.05+1.));
  // the shore-break: a small line dumping on the sand, pulsing with the period
  float sb=cos(clamp((p.y-(-uShore+9.+3.*sin(uTime*.5)))/4.,-1.,1.)*1.5707963); A+=.25*sb*sb*sb*(.6+.4*sin(uTime*.5));
  return A*c*c*c*uStrip;
}
float sets(vec2 p){
  float z=0., zc=-uY0+.65*uLb;
  // the next lines of the set: spaced by the swell period (1.56 T^2 far out in deep water, the bar's own Lb as they reach it), aligned to
  // the swell direction (uSwellX: the crest's slant per metre along x), lower and unbroken far out, building as they approach the bar
  for (int k=0;k<4;k++){ float fk=float(k); if (fk>=uSetN) break;
    float d=p.y-(zc+uSwellX*p.x)-.00003*p.x*p.x*(1.+.5*fk), w=d<0.?.26*uLb:.42*uLb;           // front (beach side) steeper than the back
    float c=cos(clamp(d/w,-1.,1.)*1.5707963);
    float A=uSetH*(1.-.19*fk)*(.62+.38*sin(p.x*.011*(1.+.4*fk)+fk*1.9))*(1.-smoothstep(500.,1400.,abs(p.x)));
    z+=A*c*c*c;
    zc+=mix(uLb,uLdeep,(fk+.5)/3.);
  }
  z*=mix(1.,rectMask(p),uStrip);   // no breaking strip (offshore-only hour): the swell lines run through unbroken
  // the wave's own line carries on past both strip ends as a swell ridge (rising from flat water at the seam), so the shoulder and
  // the far end read as part of a longer swell line, not a crest that stops
  float ex=max(uX0-p.x,p.x-uX1);
  if (ex>0.) {
    // S1 (R7): past the shoulder end the line carries on from the bent crest (bendZ at the strip's end) as the unbroken swell; past the
    // broken end it is spent whitewater and fades out within ~200 m (a wave that has broken does not run to the horizon at full height)
    bool sh=p.x<uX0; float d=p.y-(-.15*uFace+(sh?bendZ(uX0):0.))-.00003*ex*ex, w=d<0.?.2*uLb:.36*uLb, c=cos(clamp(d/w,-1.,1.)*1.5707963);
    float A=uFace*.34*smoothstep(0.,.35*abs(uX0),ex)*(sh?(1.-smoothstep(350.,1200.,ex)):(1.-smoothstep(40.,220.,ex)))*(.75+.25*sin(ex*.02+1.));
    z+=A*c*c*c*uStrip;
  }
  return z;
}
void main(){
  vec2 p=position.xz; float e=.6;
  float z=sets(p)+whitewater(p), zx=sets(p+vec2(e,0.))+whitewater(p+vec2(e,0.)), zz=sets(p+vec2(0.,e))+whitewater(p+vec2(0.,e));
  bool under=uStrip>.5&&p.x>uX0+.01&&p.x<uX1-.01&&p.y>-uY1+.01&&p.y<-uY0-.01;   // under the strip: tucked away below it
  if (under) z=-.8*uFace-.4;
  vN=normalize(mat3(modelMatrix)*vec3(-(zx-z)/e,1.,-(zz-z)/e));
  vL=vec3(p.x,z,p.y); vW=(modelMatrix*vec4(vL,1.)).xyz; vA=vec4(0.,0.,0.,40.); vS=0.;   // vA.w 40: the sea (the fragment shader adds the whitewater line's foam)
  gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);
}`;

const WATER_FS = /* glsl */ `
precision highp float;
uniform float uTime, uFace, uFlowX, uFlowZ, uBl, uPitch, uLand, uFog, uSpill, uChop, uStrip, uBreak, uShore, uCel, uY1;
uniform vec3 uSun, uHorizon, uTop, uDeep, uBody, uTurq, uFoam, uFoamShade, uSea, uSunCol, uGlow, uSand;
uniform float uAmb, uDirect;
varying vec3 vW; varying vec3 vN; varying vec4 vA; varying float vS; varying vec3 vL;
${NOISE}
// the previous wave's whitewater line and the shore-break foam (S3), per fragment: the same line SEA_VS lifts (keep the two in step)
float wwFoam(vec2 p){
  float span=uShore-uY1-6., tt=mod(uTime*uCel, span+30.), zc=-uY1-6.-tt;
  float life=smoothstep(0.,14.,tt)*(1.-smoothstep(.6*span,span,tt)), near=smoothstep(-20.,10.,zc+uShore);
  float d=p.y-zc, w=mix(3.,6.,min(1.,uFace/3.)), c=cos(clamp(d/w,-1.,1.)*1.5707963);
  float f=smoothstep(.15,.5,c)*life*near*smoothstep(1.,.5,abs(d)/w);
  float sb=cos(clamp((p.y-(-uShore+9.+3.*sin(uTime*.5)))/4.,-1.,1.)*1.5707963);
  return max(f,smoothstep(.3,.8,sb)*.8)*uStrip;
}
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
  if (thick>39.) foam=wwFoam(vL.xz);                            // the sea: the previous wave's line (exact per fragment; per vertex it aliased into pulsing blotches on the coarse far grid)
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
  // S2: in front of the wave the water shoals over the sandbar: lighter and more turquoise toward the beach, a sand tint through it in
  // the shallowest band; behind, out to sea, darker and cleaner (uShore: the shoreline's distance in front, crest frame)
  float shoal=smoothstep(.0,.75,-vL.z/max(uShore,1.))*(1.-onFace)*(1.-smoothstep(.0,.3,hf));
  body=mix(body,mix(uTurq*.55,uSand,smoothstep(.55,1.,-vL.z/max(uShore,1.)))*uAmb,shoal*.55);
  body*=1.-.18*smoothstep(10.,250.,vL.z)*(1.-onFace);
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
  // leftover foam: streaks behind the broken section and in the trough in front, thinning with age
  // (only where the section has already broken: nothing on the clean water in front of the pocket)
  float behind=smoothstep(.1*uBl,.3*uBl,vL.x)*exp(-max(vL.z,0.)/(uFlowZ*3.+4.*F))*step(0.,vL.z);
  float broken=1.-smoothstep(1.4*uBl,2.6*uBl,vL.x);
  float trough=(1.-onFace)*smoothstep(.0,.15*F,-vL.z)*(1.-smoothstep(1.5*F+2.,6.*F+10.,-vL.z))*(1.-smoothstep(.05,.3,hf))*.1;
  float lm=max(broken*behind,trough)*(1.-cov)*(1.-onFace)*(uSpill>.5?1.2:1.)*uStrip;   // nothing has broken when there is no strip (swell-only hour)
  if (lm>.02){
    // R6 (user's recording: grey cloudy smudges on the flats, bursts of white speckles up close): thin streaks drawn out along the water's
    // travel (z), drifting with it and dissolving slowly; too fine to draw -> gone, never an even haze (the round-5 cell web turned into
    // grey haze blobs at any normal distance and into a speckle web as the camera came near)
    vec2 w=E+vec2(vnoise(E*.3),vnoise(E*.3+5.))*2.5;                 // warp: organic
    float sc=1./max(F*.3,.5);
    float sk=vnoise(vec2(w.x*2.2*sc, w.y*.3*sc))*.6+vnoise(vec2(w.x*4.5*sc+3., w.y*.7*sc))*.4;   // R13: streaks half as fine across the crest (the user's 11.5 ft shot: seen along the crest from the beach the 4.5x / 9x streaks foreshortened into a speckled smear along the foot of the face)
    float pch=smoothstep(.5,.8,vnoise(E*.1*sc)*.7+vnoise(E*.35*sc+4.)*.3+.25*lm);   // fewer streaks with age
    float streak=pch*smoothstep(.62,.74,sk)*(1.-smoothstep(.06,.25,px*4.5*sc))*smoothstep(.03,.4,lm);
    col=mix(col,uFoam*(.82+.12*lit)*uAmb,clamp(streak,0.,1.)*.32*(1.-smoothstep(150.,500.,dist)));
  }
  float fog=1.-exp(-pow(dist*uFog,2.)); col=mix(col,uHorizon*.99,clamp(fog,0.,1.));
  gl_FragColor=vec4(col,1.);
  #include <colorspace_fragment>
}`;

// S4: the beach-break shoreline in front (crest frame -z): sand rising from the shoreline (height 0 at the water line) to low dunes, a
// darker wet band with the swash running up and sliding back, pale dry sand, dune grass tones on the ridge; the same haze as the water.
const BEACH_VS = /* glsl */ `
uniform float uTime, uShore, uFace; varying vec3 vW; varying float vH; varying vec2 vP;
${NOISE}
float sandH(vec2 p){ float d=-p.y-uShore; float h=d*.022-.35;                                       // 1:45 foreshore from 35 cm under the water line
  h+=smoothstep(60.,140.,d)*(3.5+2.5*vnoise(vec2(p.x*.012,d*.03)))+smoothstep(140.,220.,d)*2.*vnoise(vec2(p.x*.02+3.,d*.02));   // low dunes (4-8 m)
  h+=smoothstep(230.,330.,d)*(16.+10.*vnoise(vec2(p.x*.006+7.,d*.01)));                                                       // a bluff line behind them (16-26 m) so the backdrop reads from the water
  h-=.12*vnoise(vec2(p.x*.06,d*.2))*(1.-smoothstep(40.,80.,d)); return h; }
void main(){ vec4 w0=modelMatrix*vec4(position,1.); vec2 p=w0.xz; float h=sandH(p); vH=h; vP=p; vW=vec3(p.x,h,p.y); gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }`;   // the plane is a unit grid scaled and placed by its matrix: the sand is shaped in crest-frame metres
const BEACH_FS = /* glsl */ `
uniform float uTime, uShore, uFog, uAmb, uDirect; uniform vec3 uHorizon, uSun, uSand, uSandWet, uDune; varying vec3 vW; varying float vH; varying vec2 vP;
${NOISE}
void main(){
  float d=-vP.y-uShore, dist=length(cameraPosition-vW);
  // the swash: thin sheets run up the foreshore and slide back (height of the wet edge, m, breathing with the period)
  float sw=.22+.16*sin(uTime*.55+vP.x*.012)+.06*vnoise(vec2(vP.x*.05,uTime*.3)), wet=1.-smoothstep(sw,sw+.25,vH);
  vec3 col=mix(uSand,uSandWet,wet*.85);
  col=mix(col,vec3(.93,.95,.95),(1.-smoothstep(.0,.05,abs(vH-sw)))*.6*smoothstep(0.,1.,sin(uTime*.55+vP.x*.012)*.5+.5));   // the foam edge of the sheet
  col=mix(col,uDune,smoothstep(2.4,5.,vH)*(.6+.4*vnoise(vec2(vP.x*.1,d*.1))));
  col*=.94+.06*vnoise(vec2(vP.x*.4,d*.4));
  col*=uAmb*(.8+.3*mix(.6,clamp(uSun.y*.6+.5,0.,1.),uDirect));
  float fog=1.-exp(-pow(dist*uFog*.7,2.)); col=mix(col,uHorizon*.99,clamp(fog,0.,1.));   // land hazes less than the water's own fog (the beach must read from the line-up)
  gl_FragColor=vec4(col,1.);
  #include <colorspace_fragment>
}`;
// S4 (R7): the headland is a soft DARK silhouette in the haze (a hazy coast reads as a desaturated blue-grey mass a little darker than the
// horizon, never a pale sunlit cone): a dark blue-grey base toned by the ambient light, lifted toward the horizon colour by the haze with
// distance and a little more toward the skyline (the ridge top dissolves into the sky)
const HEAD_FS = /* glsl */ `uniform float uFog, uAmb; uniform vec3 uHorizon, uDune; varying vec3 vW; varying float vT; void main(){ float dist=length(cameraPosition-vW); float fog=1.-exp(-pow(dist*uFog*.9,2.));
  vec3 base=mix(vec3(.16,.2,.24),uHorizon*.45,.35)*mix(.5,1.,uAmb); vec3 c=mix(base,uHorizon*.985,clamp(fog*.72+.08*vT,0.,1.)); gl_FragColor=vec4(c,1.);   // ~30% of the dark base at the near end (500 m), a faint band far out
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
/** Dev/QA: the rider this instant (crest frame, m): the board tail's position, the gap between the board's bottom centre and the water
 *  (contact_m), the gap of its lowest point (low_m, negative = a rail or the tail in the water), the distance ahead of the break point
 *  (ahead_m, negative = behind), the clip's current move (trim | bottom | top | pump), the height fraction on the face (frac, 0 trough ..
 *  1 crest), the board's heading against its measured velocity over the water (heading_err_deg), the board centre on the canvas
 *  (screen, fractions 0..1 from the top left), the along-crest velocity in the crest frame (vx_mps) and over the water (v_water_mps, + down
 *  the line: the crest frame moves with the peel, so x oscillates while the water-relative speed never reverses), and the rider's
 *  visibility (a ride runs takeoff -> maneuvers -> kick-out, fades out, and the next one fades in at the peak). */
export interface RiderSample {x: number; y: number; z: number; contact_m: number; low_m: number; ahead_m: number; move: string; frac: number; heading_err_deg: number; screen: [number, number]; vx_mps: number; v_water_mps: number; /** 0..1: faded out between the kick-out and the next takeoff */ vis: number}

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
/** R6: uniform rows in front of the strip (SEA_FRONT rows, SEA_FRONT_M m each) before the geometric tail: the previous wave's 3-6 m line
 *  lifted on 3-9 m geometric rows aliased into blotches that pulsed as it crossed each vertex */
const SEA_FRONT = 24, SEA_FRONT_M = 2;
const SEA_NX = 2 * SEA_TAIL + SEA_IN + 2, SEA_NZ = 2 * SEA_TAIL + SEA_FRONT + SEA_Z1 + 2 + SEA_Z2;
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
  const zF = zA - SEA_FRONT * SEA_FRONT_M;
  for (let i = SEA_TAIL; i >= 1; i--) zs[k++] = zF - (zF + SEA_FAR) * geo(i);
  for (let i = 0; i < SEA_FRONT; i++) zs[k++] = zF + i * SEA_FRONT_M;
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
interface Spray {pts: THREE.Points; pos: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; size: Float32Array; alpha: Float32Array; lip: Float32Array; crest: Float32Array; mist: Float32Array; blast: Float32Array; tail: Float32Array; tailVel: Float32Array; /** the turn's outside, crest frame (the fan is thrown this way) */ tailOut: Float32Array; tailOn: number}
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
export function WaveLive({wave, poster, alt, onReady, onFail, board, light, surferM = SURFER_MODEL_M, pole = false}: {wave: WaveSpec; poster: string; alt: string; onReady?: () => void; onFail?: () => void; board?: Surfboard | null; light?: LiveLight | null; /** T-099: the person's height (m); the 1.75 m model is scaled to it */ surferM?: number; /** dev: the 6 ft scale pole */ pole?: boolean}) {
  const host = useRef<HTMLDivElement>(null), api = useRef<{setWave: (w: WaveSpec) => void; setDir: (d: 'left' | 'right') => void; setLight: (l: Lighting | null) => void; setBoard: (b: Surfboard | null) => void; setRider: (o: {skill?: Skill; seed?: number; stance?: Stance | null}) => void; setPole: (on: boolean) => void} | null>(null), cb = useRef({onReady, onFail});
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
      // Appendix S: the set spacing (deep-water wavelength), set count (quality tier), the shoreline distance in front, the swell slant, the broken wave's speed, the sand
      uLdeep: {value: 250}, uSetN: {value: 4}, uShore: {value: 220}, uSwellX: {value: 0}, uCel: {value: 5}, uSand: {value: new THREE.Color('#c9b48c')}, uSandWet: {value: new THREE.Color('#8d7d60')}, uDune: {value: new THREE.Color('#8a8a6a')},
    };
    // S6 quality tier: phones draw 2 set lines and a coarser beach (reported in data-tier, never silently dropped)
    const tier: 'full' | 'phone' = (window.innerWidth < 700 || (window.devicePixelRatio || 1) > 2.5) ? 'phone' : 'full'; u.uSetN.value = tier === 'phone' ? 2 : 4; el.dataset.tier = tier;
    const stripMat = new THREE.ShaderMaterial({uniforms: u, vertexShader: STRIP_VS, fragmentShader: WATER_FS, side: THREE.DoubleSide});
    const seaMat = new THREE.ShaderMaterial({uniforms: u, vertexShader: SEA_VS, fragmentShader: WATER_FS});
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 24, 12), new THREE.ShaderMaterial({uniforms: {uHorizon: u.uHorizon, uTop: u.uTop, uSun: u.uSun, uSunCol: u.uSunCol, uGlow: u.uGlow}, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false}));
    sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
    const hemi = new THREE.HemisphereLight(0xdfeaf2, 0x2b5d70, 1.1); scene.add(hemi); const sun = new THREE.DirectionalLight(0xfff1dc, 2.2); sun.position.copy(SUN).multiplyScalar(50); scene.add(sun);
    // the crest frame: x along the crest with the shoulder at -x (a left); a right is this frame mirrored (scale.x = -1), surfer included
    const group = new THREE.Group(); scene.add(group);
    const strip = new THREE.Mesh(stripGeometry(), stripMat), sea = new THREE.Mesh(seaGeometry(), seaMat); strip.frustumCulled = sea.frustumCulled = false; strip.visible = sea.visible = false; group.add(strip, sea);
    // S4: the beach (a grid from 60 m seaward of the shoreline to 700 m inland, positioned per wave by uShore) and a headland silhouette
    // along one side in the haze (illustrative: the generic beach-break preset, not this spot's coast)
    const beachMat = new THREE.ShaderMaterial({uniforms: u, vertexShader: BEACH_VS, fragmentShader: BEACH_FS});
    const beachGeo = new THREE.PlaneGeometry(1, 1, tier === 'phone' ? 48 : 120, tier === 'phone' ? 40 : 96); beachGeo.rotateX(-Math.PI / 2);   // xz plane, unit; scaled in setBeach
    const beach = new THREE.Mesh(beachGeo, beachMat); beach.frustumCulled = false; beach.visible = false; group.add(beach);
    const headMat = new THREE.ShaderMaterial({uniforms: u, vertexShader: 'varying vec3 vW; varying float vT; attribute float aT; void main(){ vT=aT; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }', fragmentShader: HEAD_FS, side: THREE.DoubleSide});
    const headland = new THREE.Mesh(new THREE.BufferGeometry(), headMat); headland.frustumCulled = false; headland.visible = false; group.add(headland);
    { const pts: number[] = [], ts: number[] = [], n = 40; for (let i = 0; i <= n; i++) { const f = i / n; pts.push(f, 0, 0, f, 1, 0); ts.push(0, 1); } const pos = new Float32Array(pts), idx: number[] = []; for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      headland.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); headland.geometry.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(ts), 1)); headland.geometry.setIndex(idx); }
    const setBeach = (H: number, m: AtlasMeta) => {
      const shore = 180 + 25 * H; u.uShore.value = shore;   // 150-400 m behind the break (S4), growing with the size
      beach.scale.set(2 * SEA_FAR, 1, 760); beach.position.set(0, 0, -(shore - 60) - 380); beach.visible = true;
      // the headland (R7): a long low ridge from past the broken end out along the beach, rising away from it toward a far soft summit
      // (30 -> 110 m), with gentle lumps along the skyline, set further back into the haze; a soft dark silhouette, not a pale cone
      const pa = headland.geometry.getAttribute('position') as THREE.BufferAttribute, arr = pa.array as Float32Array, n = 40, x0 = m.break_len_m * 1.45 + 260;
      for (let i = 0; i <= n; i++) { const f = i / n, x = x0 + f * 1900, rise = Math.pow(f, 0.7), hgt = Math.min(1, f * 10) * (6 + (24 + 86 * rise) * (1 - 0.35 * Math.max(0, 1 - f * 6)) * (0.9 + 0.1 * Math.sin(f * 17 + 1) + 0.06 * Math.sin(f * 41)));   /* rises out of the beach over its first 190 m (no cut edge) */ arr[i * 6] = x; arr[i * 6 + 1] = -2; arr[i * 6 + 2] = -(shore + 160 + f * 140); arr[i * 6 + 3] = x; arr[i * 6 + 4] = hgt; arr[i * 6 + 5] = -(shore + 160 + f * 140); }
      pa.needsUpdate = true; headland.visible = true;
    };
    let boardObj: BoardObject | null = null, boardHolder: THREE.Group | null = null, surfer: THREE.Object3D | null = null, spray: Spray | null = null, disposed = false, dir: 'left' | 'right' = 'left';
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false; controls.minPolarAngle = THREE.MathUtils.degToRad(10); controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
    controls.minDistance = 2.2; controls.maxDistance = 70; controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.9; controls.touches = {ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE};
    const sph = new THREE.Spherical(), tmp = new THREE.Vector3();
    const sync = () => { sph.setFromVector3(tmp.copy(camera.position).sub(controls.target)); el.dataset.az = String(Math.round(THREE.MathUtils.radToDeg(sph.theta) * 10) / 10); el.dataset.polar = String(Math.round(THREE.MathUtils.radToDeg(sph.phi) * 10) / 10); el.dataset.dist = String(Math.round(sph.radius * 100) / 100); };
    controls.addEventListener('change', sync);
    controls.addEventListener('start', () => { dragUntil = Infinity; });
    controls.addEventListener('end', () => { dragUntil = performance.now() + 3000; camS[0].set(controls.target.x); camS[1].set(controls.target.y); camS[2].set(controls.target.z); });
    const spMat = new THREE.ShaderMaterial({uniforms: {uScale: {value: 600}, uAmb: u.uAmb}, vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, transparent: true, depthWrite: false});
    // the board's wake (brief stage 6): a ribbon of the tail's last positions on the water, carried with the flow, widening and fading
    // within WAKE.lifeS, re-seated on the water each frame (the face it was left on morphs). Allocation-free per frame.
    // each sample keeps the tail's along-crest x and its height fraction v on the face (the water streams along the face's own x lines, so a
    // sample re-seated at (x - flow t, v) stays on the water; a fixed cross-shore z ran up the crest as the face bent away along the line)
    const WK = WAKE.points, wk = {pos: new Float32Array(WK * 2 * 3), a: new Float32Array(WK * 2), pts: new Float32Array(WK * 6), n: 0, head: 0, last: -1}, wkP = new Float64Array(4);   // pts: x, v, rx, rz, t, (spare)
    const wkGeo = new THREE.BufferGeometry();
    wkGeo.setAttribute('position', new THREE.BufferAttribute(wk.pos, 3).setUsage(THREE.DynamicDrawUsage)); wkGeo.setAttribute('aA', new THREE.BufferAttribute(wk.a, 1).setUsage(THREE.DynamicDrawUsage));
    { const idx = new Uint16Array((WK - 1) * 6); for (let i = 0; i < WK - 1; i++) { const a = i * 2, o = i * 6; idx[o] = a; idx[o + 1] = a + 1; idx[o + 2] = a + 2; idx[o + 3] = a + 1; idx[o + 4] = a + 3; idx[o + 5] = a + 2; } wkGeo.setIndex(new THREE.BufferAttribute(idx, 1)); }
    const wkMat = new THREE.ShaderMaterial({uniforms: {uAmb: u.uAmb}, vertexShader: 'attribute float aA; varying float vA; void main(){ vA=aA; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'uniform float uAmb; varying float vA; void main(){ gl_FragColor=vec4(vec3(.93,.96,.97)*uAmb, vA);\n#include <colorspace_fragment>\n}', transparent: true, depthWrite: false, side: THREE.DoubleSide});
    const wake = new THREE.Mesh(wkGeo, wkMat); wake.frustumCulled = false; wake.visible = false; group.add(wake);
    const wakeSample = (x: number, v: number, rx: number, rz: number, t: number) => {
      if (t - wk.last < WAKE.sampleS) return; wk.last = t; const o = wk.head * 6; wk.pts[o] = x; wk.pts[o + 1] = v; wk.pts[o + 2] = rx; wk.pts[o + 3] = rz; wk.pts[o + 4] = t;
      wk.head = (wk.head + 1) % WK; wk.n = Math.min(WK, wk.n + 1);
    };
    const stepWake = (t: number, atlas: Atlas, flowX: number) => {
      wake.visible = wk.n > 1; if (!wake.visible) return;
      for (let k = 0; k < WK; k++) {
        const i = (wk.head - wk.n + k + WK) % WK, o = i * 6, age = t - wk.pts[o + 4], life = Math.max(0, 1 - age / WAKE.lifeS), on = k >= WK - wk.n ? 1 : 0;
        const x = wk.pts[o] + flowX * age; facePointInto(atlas, x, wk.pts[o + 1], t, wkP);   // the water streams toward +x (the shader's E = x - flow t): a sample left on it is carried that way, so the trail streams behind the rider, toward the break (M10; round 4 had the sign the other way and the trail ran ahead)
        const sl = wkP[2], y = wkP[1] + Math.cos(sl) * WAKE.liftM, z = -wkP[0] - Math.sin(sl) * WAKE.liftM, w = 0.5 * (WAKE.widthM + WAKE.spreadM * (1 - life)), rx = wk.pts[o + 2] * w, rz = wk.pts[o + 3] * w;
        const q = k * 6; wk.pos[q] = x - rx; wk.pos[q + 1] = y; wk.pos[q + 2] = z - rz; wk.pos[q + 3] = x + rx; wk.pos[q + 4] = y; wk.pos[q + 5] = z + rz;
        wk.a[k * 2] = wk.a[k * 2 + 1] = WAKE.alpha * life * life * on;
      }
      (wkGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true; (wkGeo.getAttribute('aA') as THREE.BufferAttribute).needsUpdate = true;
      // M10 check (dev): the trail's first segment (the tail -> the previous sample) against the velocity over the water: it points behind
      if (import.meta.env.DEV && sim && wk.n === WK) { const a = (WK - 1) * 6, b = (WK - 3) * 6, p = wk.pos; monitor.wakeSample(t, sim.move(), (p[b] + p[b + 3]) / 2 - (p[a] + p[a + 3]) / 2, (p[b + 2] + p[b + 5]) / 2 - (p[a + 2] + p[a + 5]) / 2, st[S.WX], st[S.WZ]); }
    };
    const size = () => { const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); spMat.uniforms.uScale.value = (h * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); };
    const ro = new ResizeObserver(size); ro.observe(el);

    const makeSpray = (): Spray => {
      const n = SPRAY_N, pos = new Float32Array(n * 3), life = new Float32Array(n), max = new Float32Array(n).fill(1), size = new Float32Array(n), alpha = new Float32Array(n), vel = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) life[i] = -Math.random() * 2;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aA', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
      const pts = new THREE.Points(g, spMat); pts.frustumCulled = false; const e = new Float32Array(0); return {pts, pos, vel, life, max, size, alpha, lip: e, crest: e, mist: e, blast: e, tail: new Float32Array(3), tailVel: new Float32Array(3), tailOut: new Float32Array(3), tailOn: 0};
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
            const out = (0.8 + R() * 2.4) * f * sp.tailOn;   // thrown to the outside of the turn, more the harder the turn
            sp.vel[j] = sp.tailVel[0] + 0.6 * u.uFlowX.value + (R() + 0.1) * 1.4 * f + sp.tailOut[0] * out; sp.vel[j + 1] = sp.tailVel[1] * 0.5 + (1.4 + R() * 2.6) * f + sp.tailOut[1] * out; sp.vel[j + 2] = sp.tailVel[2] * 0.5 - (0.2 + R() * 1.8) * f + sp.tailOut[2] * out;
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
    // the rider (spec 2026-11-04 stages 2-4): a fixed-step simulation (rideSim) plans the line in wave-relative coordinates and places the
    // board on the water by the shader's own height function; the body is posed from a pose library sampled once from the clip plus
    // procedural layers (riderBody); a dev glitch monitor watches every joint and the board. No clip plays at runtime, so nothing is ever
    // premultiplied onto a stale mixer write (the round-3 popping, docs/3d/FINDINGS-2026-11-04.md).
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let sim: RiderSim | null = null, body: RiderBody | null = null, cur: {atlas: Atlas} | null = null, frontside = true;
    // the rider's materials, faded in at the takeoff and out at the kick-out (spec stage 4: a ride has a start and an end)
    const fadeMats: THREE.Material[] = []; let shownVis = -1;
    const riderOpts: {skill: Skill; seed: number; stance: Stance | null} = {skill: 'Intermediate', seed: 1, stance: null};
    const monitor = new GlitchMonitor(); monitor.warn = import.meta.env.DEV;
    const st = new Float64Array(STATE_N);
    let rider: RiderSample | null = null, riderAt = 0;
    const pt = new THREE.Vector3(), boardBox = new THREE.Box3(), ptP = new THREE.Vector3(); let probeT = 0;
    const F = new THREE.Vector3(), U = new THREE.Vector3(), Rv = new THREE.Vector3(), Zc = new THREE.Vector3(), posV = new THREE.Vector3(), prevTail = new THREE.Vector3(), noseV = new THREE.Vector3(), upR = new THREE.Vector3(), velV = new THREE.Vector3();
    let haveVel = false, follow = true, dragUntil = 0;
    const camS = [new Spring(), new Spring(), new Spring()];
    /** The board object (R16: built by the viewer, `mountBoard`) and its bounds in its own frame: the union of every mesh under it
     *  (Codex P1 on 9682084: reading .geometry on the Group threw). Cached per object. */
    const boardBounds = new WeakMap<THREE.Object3D, THREE.Box3>();
    const boardOf = (): {obj: THREE.Object3D; box: THREE.Box3} | null => {
      const obj = boardObj?.group; if (!obj || !boardObj) return null;
      let box = boardBounds.get(obj);
      if (!box) {
        // the board's box (fins included, as the R15 Quiver board's was), its floor dropped by BOARD.contactBelowM to the contact plane
        const hb = boardObj.data.bounds, L = boardObj.curves.L;
        box = new THREE.Box3(new THREE.Vector3(hb.min[0], hb.min[1] - BOARD.contactBelowM * Math.sqrt(L / 1.83), hb.min[2]), new THREE.Vector3(hb.max[0], hb.max[1], hb.max[2])); boardBounds.set(obj, box);
      }
      return {obj, box};
    };
    /** The drawn board's size for the simulation: the bounds in its own frame times its scale (the model's board is scaled to the band). */
    const simBoard = () => { const bd = boardOf(); if (bd && sim) { sim.setBoard((bd.box.max.x - bd.box.min.x) * bd.obj.scale.x, (bd.box.max.z - bd.box.min.z) * bd.obj.scale.z, bd.box.min.y * bd.obj.scale.y); sim.riderScale = surferRef.current / SURFER_MODEL_M; } };   // R12: the roof cap's crown scales with the rider
    /** No quiver board: the reference 5'10" x 19 1/4" board is scaled to the band's length (for the person's height) and width (brief part 2). */
    const fitModelBoard = (H: number) => {
      if (!boardObj || boardObj.params !== REFERENCE_BOARD) return;
      const faceFt = H / 0.3048, band = bandFor(faceFt), [lo, hi] = bandBoardFt(band, faceFt), riderFt = surferRef.current / 0.3048;
      const lenM = (lo + hi) / 2 * 0.3048 * riderFt / (5 + 10 / 12), bd = boardOf(); if (!bd) return;
      boardObj.group.scale.set(lenM / (bd.box.max.x - bd.box.min.x), 1, BOARD.bandWidthM[band.id] / (bd.box.max.z - bd.box.min.z)); boardObj.group.updateMatrixWorld(true);
      el.dataset.board = JSON.stringify({id: 'model', band: band.id, length_m: Math.round(lenM * 1000) / 1000, width_m: BOARD.bandWidthM[band.id]});
    };
    /** Board-to-face gaps (m, signed normal distance to the face, + out of the water): at the board's bottom centre, and the lowest of the tail, nose and both rails. Allocation-free. */
    const cpts = new Float64Array(15), gaps: [number, number, number] = [0, 0, 0];
    const contactM = (t: number): [number, number, number] => {
      gaps[0] = gaps[1] = gaps[2] = 0; if (!surfer || !cur) return gaps;
      const bd = boardOf(); if (!bd) return gaps;
      const mesh = bd.obj, bx = bd.box; boardBox.copy(bx);
      const P = BOARD.probe; cpts.set([0, bx.min.y, 0, bx.max.x - P.tailIn, bx.min.y + P.tailUp, 0, bx.min.x + P.noseIn, bx.min.y + P.noseUp, 0, 0, bx.min.y, bx.max.z - P.railIn, 0, bx.min.y, bx.min.z + P.railIn]);
      let low = Infinity;
      for (let i = 0; i < 5; i++) { pt.set(cpts[i * 3], cpts[i * 3 + 1], cpts[i * 3 + 2]); mesh.localToWorld(pt); group.worldToLocal(pt); const gap = faceDistanceAt(cur!.atlas, pt.x, pt.y, pt.z, t); if (i === 0) { gaps[0] = gap; const b = st[S.BRIDGE] + st[S.LIFT]; gaps[2] = b > 1e-4 ? faceDistanceAt(cur!.atlas, pt.x - st[S.NX] * b, pt.y - st[S.NY] * b, pt.z - st[S.NZ] * b, t) : gap; } low = Math.min(low, gap); }   // R8: [2] the centre with the bridge's lift taken back off (the monitor's centre check): in the hollow under a lip the lifted centre's nearest water is the lip's underside, so gap - bridge under-read by up to 0.08 m at the snap's hit
      gaps[1] = low; return gaps;
    };
    // the 6 ft scale pole (dev): 1 ft bands stood on the trough beside the rider's section
    const pole = new THREE.Group(); pole.visible = false; group.add(pole);
    { const hb = POLE.heightM / POLE.bands, cg = new THREE.CylinderGeometry(POLE.radiusM, POLE.radiusM, hb, 12), mats = [new THREE.MeshStandardMaterial({color: 0xd8322a, roughness: 0.6}), new THREE.MeshStandardMaterial({color: 0xf4f4f0, roughness: 0.6})];
      for (let i = 0; i < POLE.bands; i++) { const mm = new THREE.Mesh(cg, mats[i % 2]); mm.position.y = (i + 0.5) * hb; mm.frustumCulled = false; pole.add(mm); } }
    const poleAt = new Float64Array(3);
    const placePole = (t: number) => {
      if (!cur || !sim) return; const x = st[S.X]; facePointInto(cur.atlas, x, 0.02, t, poleAt);   // at the rider's own x (the face tapers along the crest), out on the flat in front
      pole.position.set(x, poleAt[1], -poleAt[0] - POLE.aheadM);
    };
    /** Dev: the pole's trough and top against the crest at its x (the face height the label states). */
    const poleCheck = () => {
      if (!cur || !sim) return null; const t = st[S.T], x = pole.position.x, pr = profileAt(cur.atlas, x, t, 192, true); let crest = -Infinity; for (const z of pr.z) crest = Math.max(crest, z);
      return {x, troughY: pole.position.y, topY: pole.position.y + POLE.heightM, crestY: crest, faceM: crest - pole.position.y, labelFaceM: cur.atlas.meta.face_m};
    };
    const ret = {x: 0, y: 0, z: 0, xb: 0, move: 'trim', frac: 0, headErr: 0, vx: 0, vWater: 0, vis: 1};
    const placeRider = (alpha: number, dt: number) => {
      if (!surfer || !cur || !sim || !body || !surfer.visible) return null;
      lerpState(sim.prev, sim.cur, alpha, st); const t = st[S.T]; u.uTime.value = t;   // the water is drawn at the rider's time
      F.set(st[S.FX], st[S.FY], st[S.FZ]).normalize(); U.set(st[S.UX], st[S.UY], st[S.UZ]); U.addScaledVector(F, -U.dot(F)).normalize(); Rv.crossVectors(F, U).normalize();
      posV.set(st[S.X], st[S.Y], st[S.Z]);
      const k = surferRef.current / SURFER_MODEL_M; Ms.makeScale(k, k, k);
      // the model: nose at -x, deck up +y, the chest toward +z (the wave on frontside); backside mirrors the rider across the board's long axis
      noseV.copy(F).negate(); Zc.copy(Rv); if (frontside) Zc.negate();
      Mb.makeBasis(noseV, U, Zc).setPosition(posV).multiply(Ms);
      upR.set(noseV.y, U.y, Zc.y);   // world up in the rider frame (the basis is orthonormal, mirrored or not)
      probeT = t; if (!body.faceProbe) body.faceProbe = faceProbe;   // R12: the arms' face clamp reads the water through this
      body.pose(st, {upR, roll: st[S.ROLL], lead: st[S.LEAD], comp: st[S.COMP], idleA: st[S.IDLE_A], idleB: st[S.IDLE_B], mirror: frontside ? 1 : -1, profile: sim.plan.profile, dt, turning: 1 - Math.max(0, st[S.W0])});
      if (boardObj) for (let k = 0; k < 2; k++) { const fx = body.footFT[k * 3], fz = body.footFT[k * 3 + 2]; boardObj.placeBlob(k, body.ankleT[k * 3] + 0.09 * fx, body.ankleT[k * 3 + 2] + 0.09 * fz, Math.atan2(-fx, -fz), 0.46, 0.3, st[S.VIS]); }   // R16: the contact shadows under the soles
      surfer.matrix.copy(Mb); surfer.updateMatrixWorld(true);
      if (body.posedHead) sim.setHead(body.headR.x, body.headR.y, body.headR.z, body.neckR.x, body.neckR.y, body.neckR.z);   // R12: the roof cap's crown
      const vis = st[S.VIS]; if (Math.abs(vis - shownVis) > 0.002) { shownVis = vis; for (const mm of fadeMats) { mm.opacity = vis; mm.depthWrite = vis > 0.98; } }
      const g = contactM(t), gc = g[0], gl = g[1];
      if (import.meta.env.DEV) { monitor.sample(dt, t, sim.move(), g[2], gl, 'r', sim.stats.slopeNow, frontside);
        // R11: the body-clip gate (spec item 4): each joint against the water, on the body clock; wet = inside the water body by the
        // profile-crossing parity (roofAboveAt is NaN there), which also catches the inside of the lip where the face distance is positive
        if (monitor.bodyTick(t)) for (const jn of MONITOR.bodyClipJoints) { const jb = boneCache.get(jn) ?? (boneCache.has(jn) ? null : (boneCache.set(jn, surfer.getObjectByName(jn) ?? null), boneCache.get(jn)!)); if (!jb) continue;
          pt.setFromMatrixPosition(jb.matrixWorld); group.worldToLocal(pt); const jg = faceDistanceAt(cur.atlas, pt.x, pt.y, pt.z, t), jr = roofAboveAt(cur.atlas, pt.x, pt.y, pt.z, t); bodyGaps[jn] = [Math.round(jg * 1000) / 1000, Number.isNaN(jr) ? 1 : 0, Math.round(pt.x * 100) / 100, Math.round(pt.y * 100) / 100, Math.round(pt.z * 100) / 100]; monitor.bodyClipSample(t, sim.move(), jn, jg, Number.isNaN(jr)); } }   // the bridge over a concave section is deliberate: the centre is checked with the lift taken back off (R8; was gc - bridge)
      // the tail (crest frame) and its velocity: the top-turn spray leaves from here, with the board
      const bd = boardOf();
      if (spray && bd) {
        pt.set(bd.box.max.x - 0.03, bd.box.min.y + 0.03, 0); bd.obj.localToWorld(pt); group.worldToLocal(pt);
        if (haveVel && dt > 0) { spray.tailVel[0] = (pt.x - prevTail.x) / dt; spray.tailVel[1] = (pt.y - prevTail.y) / dt; spray.tailVel[2] = (pt.z - prevTail.z) / dt; }
        prevTail.copy(pt); spray.tail[0] = pt.x; spray.tail[1] = pt.y; spray.tail[2] = pt.z;
        const mv = sim.move(), load = THREE.MathUtils.smoothstep(Math.abs(st[S.TROLL]), WAKE.sprayRoll0, WAKE.sprayRoll1) * Math.min(1, st[S.SPEED] / WAKE.spraySpeed);
        spray.tailOn = WAKE.sprayMoves.includes(mv) && vis > 0.5 ? load * sim.plan.band.spray * sim.plan.profile.carve : 0;
        const os = st[S.TROLL] > 0 ? 1 : -1; spray.tailOut[0] = Rv.x * os; spray.tailOut[1] = Rv.y * os; spray.tailOut[2] = Rv.z * os;   // the rail the deck banks away from
        if (vis > 0.5 && st[S.SPEED] > 1 && mv !== 'takeoff') wakeSample(pt.x, Math.max(0.02, st[S.V] + (pt.y - st[S.Y]) / cur.atlas.meta.face_m), Rv.x, Rv.z, t);   // the tail's height fraction: the centre's plus its drop
      }
      haveVel = true;
      // the heading against the velocity over the water (the simulation's own velocity less the water streaming along the face's x-tangent)
      velV.set(st[S.WX], st[S.WY], st[S.WZ]); const headErr = velV.lengthSq() > 0.04 ? THREE.MathUtils.radToDeg(F.angleTo(velV)) : 0;
      if (pole.visible) placePole(t);
      // the barrel check (dev): the rider's head under a water roof by at least 0.15 m (inside the lip's cavity)
      // R9: roof is NaN with the head inside the water (buried in the lip), which is not "inside the tube"; headUp = the head over the board's centre (the crouch)
      let roof = Infinity, headUp = 0; if (import.meta.env.DEV) { const hb = headBone ?? (headBone = surfer.getObjectByName('head') ?? null); if (hb) { pt.setFromMatrixPosition(hb.matrixWorld); group.worldToLocal(pt); roof = roofAboveAt(cur.atlas, pt.x, pt.y, pt.z, t); headUp = pt.y - st[S.Y]; } }
      // R11 orientation probe (dev): the board's roll against the LOCAL FACE (deg; + = the deck rolled toward the wave, the wave-side rail
      // engaged, the beach-side rail lifted) and the body against the STRINGER in the rider frame (nose -x, deck up +y, toe side +z, the
      // same frame mirrored or not): the shoulder line and the hip line (trailing -> leading, deg from the stringer; + = the chest turned
      // toward the nose), the chest's and the head's facing (deg from the toe side toward the nose; 90 = straight down the line)
      let faceRoll = 0, shoulderYaw = 0, hipYaw = 0, chestYaw = 0, headYaw = 0;
      if (import.meta.env.DEV) {
        Nv.set(st[S.NX], st[S.NY], st[S.NZ]).normalize(); Ab.crossVectors(Nv, F).normalize(); faceRoll = Math.atan2(U.dot(Ab), U.dot(Nv)) * 180 / Math.PI;
        rigInv.copy(surfer.matrixWorld).invert();
        const bone = (n: string) => { let b = boneCache.get(n); if (b === undefined) { b = surfer!.getObjectByName(n) ?? null; boneCache.set(n, b); } return b; };
        const at = (n: string, v: THREE.Vector3) => { const b = bone(n); if (!b) return false; v.setFromMatrixPosition(b.matrixWorld).applyMatrix4(rigInv); return true; };
        if (at('upperarm_r', pA) && at('upperarm_l', pB)) { pA.sub(pB); shoulderYaw = Math.atan2(-pA.z, -pA.x) * 180 / Math.PI;
          if (at('neck_01', pB) && at('spine_03', pC)) { pB.sub(pC); pC.crossVectors(pB, pA); chestYaw = Math.atan2(-pC.x, pC.z) * 180 / Math.PI; } }
        if (at('thigh_r', pA) && at('thigh_l', pB)) { pA.sub(pB); hipYaw = Math.atan2(-pA.z, -pA.x) * 180 / Math.PI; }
        // the head's facing: the bind pose's forward (+z, the face) carried by the head bone
        const hb = bone('head'); if (hb && headFwdLocal) { pA.copy(headFwdLocal).transformDirection(hb.matrixWorld).transformDirection(rigInv); headYaw = Math.atan2(-pA.x, pA.z) * 180 / Math.PI; }
      }
      probe = {t, vis, roof: Number.isFinite(roof) ? roof : -1, inTube: roof >= 0.15 && roof < 3 * cur.atlas.meta.face_m ? 1 : 0, headWet: Number.isNaN(roof) ? 1 : 0, headUp, stage: stageAt(cur.atlas.meta, st[S.X], t, true), frac: st[S.V], u: st[S.U], x: st[S.X], y: st[S.Y], z: st[S.Z], xb: sim.stats.xbNow, xbFollowed: st[S.XB], roll: st[S.ROLL], lead: st[S.LEAD], comp: st[S.COMP], gap: gc, lowGap: gl, speed: st[S.SPEED], maxFrac: sim.stats.maxFracNow, slope: sim.stats.slopeNow, yaw: st[S.YAW], hipY: body.hipY, bridge: st[S.BRIDGE], torsoPitch: body.torsoPitchDeg, torsoPitchRaw: body.torsoPitchRawDeg,
        faceRoll, shoulderYaw, hipYaw, chestYaw, headYaw, turnRoll: st[S.TROLL], lift: st[S.LIFT], yawFixHip: body.yawFixDeg[0], yawFixSh: body.yawFixDeg[1], yawFixHead: body.yawFixDeg[2], yawRawHip: body.yawRawDeg[0], yawRawSh: body.yawRawDeg[1], yawRawHead: body.yawRawDeg[2], lean: body.leanDeg, leanGate: body.leanGateNow,
        slopeCap: sim.stats.slopeCapNow, roofStand: sim.stats.roofStandNow, roofCap: sim.stats.roofCapNow, crouch: sim.stats.crouchNow, planV: sim.planV, clampL: body.clampDeg[0], clampR: body.clampDeg[1]};   // R12: the two caps, the crouch, the arms' face clamp
      ret.x = st[S.X]; ret.y = st[S.Y]; ret.z = st[S.Z]; ret.xb = sim.stats.xbNow; ret.move = sim.move(); ret.frac = st[S.V]; ret.headErr = headErr; ret.vx = st[S.VX]; ret.vWater = -st[S.WX]; ret.vis = vis;
      const between = vis < 0.05 ? '1' : '0'; if (el.dataset.between !== between) el.dataset.between = between;   // B10: the stage says the rider is paddling back, not missing
      return ret;
    };
    /** R12: a rider-frame point against the water for the body's face clamp: the signed face distance in model metres and the face normal
     *  (finite differences across the shore and up, in the crest frame) carried into the rider frame. The rig matrix of this frame (Mb). */
    const faceProbe = (xr: number, yr: number, zr: number, out: Float64Array): boolean => {
      if (!cur) return false; const k = surferRef.current / SURFER_MODEL_M;
      ptP.set(xr, yr, zr).applyMatrix4(Mb); const g = faceDistanceAt(cur.atlas, ptP.x, ptP.y, ptP.z, probeT); out[0] = g / k;
      if (g > 0.3) { out[1] = out[2] = out[3] = 0; return true; }
      const e = 0.03; let ny = (faceDistanceAt(cur.atlas, ptP.x, ptP.y + e, ptP.z, probeT) - g) / e, nz = (faceDistanceAt(cur.atlas, ptP.x, ptP.y, ptP.z + e, probeT) - g) / e; const nn = Math.hypot(ny, nz) || 1; ny /= nn; nz /= nn;
      out[1] = ny * noseV.y + nz * noseV.z; out[2] = ny * U.y + nz * U.z; out[3] = ny * Zc.y + nz * Zc.z; return true;
    };
    let probe: Record<string, number> | null = null, headBone: THREE.Object3D | null = null, headFwdLocal: THREE.Vector3 | null = null;
    const bodyGaps: Record<string, number[]> = {}, boneCache = new Map<string, THREE.Object3D | null>(), rigInv = new THREE.Matrix4(), Nv = new THREE.Vector3(), Ab = new THREE.Vector3(), pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
    /** Dev: the placement this frame plus each board contact point (crest frame) and the water under it. */
    const probeRider = () => {
      if (!surfer || !cur) return null; const t = u.uTime.value; surfer.updateMatrixWorld(true);
      const bd = boardOf(); if (!bd) return null;
      const mesh = bd.obj, bx = bd.box, P = BOARD.probe; const pts: Record<string, [number, number, number]> = {tail: [bx.max.x - P.tailIn, bx.min.y + P.tailUp, 0], nose: [bx.min.x + P.noseIn, bx.min.y + P.noseUp, 0], railA: [0, bx.min.y, bx.max.z - P.railIn], railB: [0, bx.min.y, bx.min.z + P.railIn]};
      const out: Record<string, unknown> = {...probe, bodyGaps, bbox: [bx.min.toArray(), bx.max.toArray()], frontside, stance: sim?.stance, skill: sim?.plan.skill, seed: sim?.seed, period: sim?.plan.period};
      for (const [n, p] of Object.entries(pts)) { pt.set(p[0], p[1], p[2]); mesh.localToWorld(pt); group.worldToLocal(pt); out[n] = {x: pt.x, y: pt.y, z: pt.z, gap: faceDistanceAt(cur.atlas, pt.x, pt.y, pt.z, t)}; }
      pt.set(0, 0, 0); mesh.localToWorld(pt); group.worldToLocal(pt); out.origin = {x: pt.x, y: pt.y, z: pt.z, gap: faceDistanceAt(cur.atlas, pt.x, pt.y, pt.z, t)};
      out.F = F.toArray(); out.U = U.toArray();
      return out;
    };
    /** Dev/QA sample (~30 Hz in dev, ~10 Hz otherwise): the board's tail in the crest frame, its gap to the water, how far ahead of the
     *  break point, the move, the height fraction, the heading error, the canvas position and the along-crest speeds. */
    const sampleRider = (t: number, r: {x: number; y: number; z: number; xb: number; move: string; frac: number; headErr: number; vx: number; vWater: number; vis: number}) => {
      if (!surfer || !cur) return;
      const bd = boardOf(); if (!bd) return;
      const mesh = bd.obj;
      const r3 = (n: number) => Math.round(n * 1000) / 1000, g = contactM(t), gc = g[0], gl = g[1];
      pt.set(0, 0, 0); mesh.localToWorld(pt); pt.project(camera);
      rider = {x: r3(prevTail.x), y: r3(prevTail.y), z: r3(prevTail.z), contact_m: r3(gc), low_m: r3(gl), ahead_m: r3(r.xb - r.x), move: r.move, frac: r3(r.frac), heading_err_deg: Math.round(r.headErr * 10) / 10, screen: [r3((pt.x + 1) / 2), r3((1 - pt.y) / 2)], vx_mps: r3(r.vx), v_water_mps: r3(r.vWater), vis: Math.round(r.vis * 100) / 100};
      if (import.meta.env.DEV) el.dataset.rider = JSON.stringify(rider);
    };
    const placeCamera = (mode: 'surf' | 'swell', tx: number, H: number, far: number) => {
      // surf: the wave with the rider in it (the rider about 40% in from the shoulder side, wave and person both readable), from the water
      // on the beach side a little down the line, eye just under the lip; a narrow (phone) frame backs off further. Once placed, the follow
      // camera (frame loop) tracks the rider; while the follow is paused by a drag, an hour change re-centres as before.
      // R6 (user: "the surfer's tiny", and the rider read as lying on the board): the camera is a third closer and lower (3.4 + 2.0 H, eye
      // 0.15 d above the face's middle: polar ~81.5 deg, 6.5 deg of drag travel before the 88 deg clamp) and sits further down the line on the shoulder side (the surf-photo angle), so the frontside rider's
      // pitched torso shows in profile instead of foreshortened from behind: a crouched rider on a 5 ft face is about a fifth of the frame
      // height (12 ft: an eighth) with the whole face beside him. The scale maths is untouched: the pole still measures the label's face.
      // 3d-next: the surf view on a longer lens (SURF_CAM.fov; the swell view keeps its own)
      const fov = mode === 'surf' ? SURF_CAM.fov : SURF_CAM.swellFov; if (camera.fov !== fov) { camera.fov = fov; size(); }
      const d = mode === 'surf' ? (3.4 + H * 2.0) * (camera.aspect < 1 ? 1.35 : 1) : 14 + far * 0.25, sx = dir === 'right' ? -1 : 1;
      if (placed !== mode) {
        placed = mode;
        // eye a little above the lip looking slightly down (polar ~81 deg), so a vertical drag has travel both ways (T-062: the old eye-level
        // placement sat 2 deg from the polar clamp)
        if (mode === 'surf') { controls.target.set(sx * tx, H * 0.5, 0); camera.position.set(sx * (tx - 0.75 * d), H * 0.5 + 0.15 * d, -0.66 * d); }
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
      tmp.copy(posV); group.localToWorld(tmp); tmp.x += sgn * SURF_CAM.towardCurlH * H; tmp.y += SURF_CAM.upH * H;   // 3d-next: further toward the curl (was 0.45 H), a quicker follow (was 1.4 s) for the longer lens
      const w = 2 * Math.PI / SURF_CAM.followS, nx = camS[0].step(tmp.x, dt, w), ny = camS[1].step(tmp.y, dt, w), nz = camS[2].step(tmp.z, dt, w);
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
        setSea(sea.geometry, m); sea.visible = true; strip.visible = false; if (surfer) surfer.visible = false; if (spray) spray.pts.visible = false; setBeach(Hs, m);
        faceM = Hs; placeCamera('swell', 0, Hs, Lb); el.dataset.mode = w.offshoreM ? 'swell' : 'none'; el.dataset.face = ''; el.dataset.between = '0'; delete el.dataset.surfer; delete el.dataset.breaker;
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
      // S3: the set's spacing from the forecast period (deep water 1.56 T^2, the bar's Lb at the break), the swell's slant against the beach,
      // the broken wave's speed toward the shore; S4: the shoreline
      const T = w.periodS && w.periodS > 4 ? w.periodS : m.period_s; u.uLdeep.value = 1.56 * T * T; u.uSwellX.value = Math.tan(THREE.MathUtils.degToRad(THREE.MathUtils.clamp(w.swellOffDeg ?? 0, -40, 40))) * (dir === 'right' ? -1 : 1);
      u.uCel.value = Math.min(m.celerity_mps, 7); setBeach(H, m);
      el.dataset.scene = JSON.stringify({shore_m: Math.round(u.uShore.value), set_spacing_deep_m: Math.round(u.uLdeep.value), set_spacing_bar_m: Math.round(m.Lb_m), period_s: T, sets: u.uSetN.value, tier});
      u.uBreak.value = w.breaker === 'spilling' ? 1 : w.breaker === 'plunging' ? 0 : m.breaker === 'spilling' ? 1 : 0;   // the forecast's breaker type, the bucket family's when unknown
      const sx = surferX(m);
      setStripX(strip.geometry, m, sx); setSea(sea.geometry, m); strip.visible = sea.visible = true;
      // the rider's simulation for this wave: the spec carries the skill, the hour's seed and the stance; the plan is rebuilt only when they change
      riderOpts.skill = w.skill; riderOpts.seed = w.seed; riderOpts.stance = w.stance;
      const flowX = u.uFlowX.value;
      if (!sim) sim = new RiderSim(atlas, riderOpts.skill, riderOpts.seed, flowX, riderOpts.stance, u.uTime.value); else sim.setWave(atlas, flowX, riderOpts.skill, riderOpts.seed, riderOpts.stance);
      frontside = isFrontside(sim.stance, dir); sim.frontside = frontside; cur = {atlas}; haveVel = false; wk.n = 0; wk.last = -1; body?.reseat();   // a new wave: no trail from the old one
      if (import.meta.env.DEV) monitor.reset();   // an hour change re-seats the rider: not a glitch
      el.dataset.stance = sim.stance; el.dataset.skill = sim.plan.skill; el.dataset.seed = String(sim.seed); el.dataset.frontside = frontside ? '1' : '0';
      el.dataset.styleBand = sim.plan.band.id;
      if (surfer) {
        fitModelBoard(H); simBoard();
        surfer.visible = true; sim.advance(2 / SIM.hz); placeRider(1, 1 / 60); surfer.updateMatrixWorld(true);
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
          surfer.traverse((o) => { const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mm && 'emissiveIntensity' in mm) mm.emissiveIntensity = 0.15; if (mm) { mm.transparent = true; fadeMats.push(mm); } (o as THREE.Mesh).frustumCulled = false; }); setBoard(boardRef.current);
          const ride = THREE.AnimationClip.findByName(s.clips, 'ride'), still = THREE.AnimationClip.findByName(s.clips, 'still');
          const clip = ride ?? still;
          if (clip) {
            const {bones, lib} = samplePoses(surfer, clip); body = new RiderBody(bones, lib); hookDeck(); { const bm = bodyMesh(); if (bm) body.setSole(bm); }   // R16: the soles' points for the plant
            surfer.traverse((o) => { const sm = o as THREE.SkinnedMesh; if (headFwdLocal || !sm.isSkinnedMesh) return; const i = sm.skeleton.bones.findIndex((b) => b.name === 'head'); if (i >= 0) headFwdLocal = new THREE.Vector3(0, 0, 1).transformDirection(sm.skeleton.boneInverses[i]); });   // R11: the head's forward (the face, +z in the bind pose) in the bone's frame, for the yaw layer and the probe
            body.headFwd = headFwdLocal;
            monitor.track(bones.all, surfer.getObjectByName('Board') ?? null, surfer);
            el.dataset.clips = s.clips.map((c) => c.name).join(',');
          }
        }
        if (!spray) { spray = makeSpray(); group.add(spray.pts); }
        if (pending && pending.faceM !== null && !composeAtlas(pending.faceM, pending.breaker, pending.periodS).atlas) throw new Error('atlas missing');
        go();
      }).catch(() => { if (!disposed && my === token) cb.current.onFail?.(); });
    };
    const setDir = (d: 'left' | 'right') => {
      if (d === dir) return; dir = d; group.scale.x = d === 'right' ? -1 : 1; group.updateMatrixWorld(true); if (sim) { frontside = isFrontside(sim.stance, dir); sim.frontside = frontside; el.dataset.frontside = frontside ? '1' : '0'; } if (import.meta.env.DEV) monitor.reset();   // the mirror flips every world rotation in one frame: not a glitch
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
    // R16: the viewer builds the board (boardMesh.ts buildBoard, the one function the Quiver uses too) and parents it to the `board` bone:
    // the reference 5'10" (scaled to the band) or the selected Quiver board at its true size (P5b), with the deck colour of its look.
    // The GLB-baked board of surfer-v11 and older (a 6'0" with a second formula) is dropped when present; the feet follow the drawn
    // deck through RiderBody.deckAt (the keys were planted on the reference deck, board-deck.json).
    const REF_CURVES = boardCurves(REFERENCE_BOARD), boardM = new THREE.Matrix4();
    const hookDeck = () => { if (!body || !boardObj) return; const g = boardObj.group, c = boardObj.curves; body.deckRef = REF_CURVES.deckAt; body.deckAt = (x, z) => c.deckAt(x / g.scale.x, z / g.scale.z) * g.scale.y; };
    const mountBoard = (params: BoardParams, deckColor?: number, bottomColor?: number) => {
      if (!surfer) return;
      if (!boardHolder) {
        const old = surfer.getObjectByName('Board'); if (old) old.removeFromParent();
        const bone = surfer.getObjectByName('board') ?? surfer; surfer.updateMatrixWorld(true);
        // the holder sits at the rider frame's identity under the bone (the bone is at its rest in every key): its local = inverse of the bone's rider-frame rest
        boardHolder = new THREE.Group(); boardHolder.name = 'BoardHolder'; boardM.copy(surfer.matrixWorld).invert().multiply(bone.matrixWorld).invert(); boardM.decompose(boardHolder.position, boardHolder.quaternion, boardHolder.scale); bone.add(boardHolder);
      }
      if (boardObj) { boardHolder.remove(boardObj.group, boardObj.shadows); for (const m of boardObj.materials) { const i = fadeMats.indexOf(m); if (i >= 0) fadeMats.splice(i, 1); } boardObj.dispose(); boardObj = null; }
      boardObj = buildBoardObject(params, deckColor, bottomColor); for (const m of boardObj.materials) { m.transparent = true; fadeMats.push(m); }
      boardHolder.add(boardObj.group, boardObj.shadows); surfer.updateMatrixWorld(true); hookDeck();
    };
    const setBoard = (b: Surfboard | null) => {
      if (!surfer) return;
      delete el.dataset.board;
      if (!b) { mountBoard(REFERENCE_BOARD); if (cur) fitModelBoard(cur.atlas.meta.face_m); simBoard(); return; }
      const wc = waveColours(loadLook(b)); mountBoard(paramsForBoard(b), wc.deck, wc.bottom);   // an example model: its traced outline, rocker and build
      const bx = boardObj!.data.bounds; el.dataset.board = JSON.stringify({id: b.id, length_m: Math.round((bx.max[0] - bx.min[0]) * 1000) / 1000, width_m: Math.round((bx.max[2] - bx.min[2]) * 1000) / 1000});
      simBoard();   // the sim rides the new board's bottom and rails
    };
    /** R16 dev: each foot's sole against the drawn deck (board frame): the lowest foot vertex's height over the deck under it (mm, negative =
     *  through the deck), where it is, the sole's centre, how many vertices sit more than 1 mm through, plus the deck-follow shift and tilt. */
    /** the body's skinned mesh (the hair cap is skinned too, so the one with the most vertices) */
    const bodyMesh = (): THREE.SkinnedMesh | null => { let sm: THREE.SkinnedMesh | null = null; surfer?.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && (!sm || m.geometry.getAttribute('position').count > sm.geometry.getAttribute('position').count)) sm = m; }); return sm; };
    let footVerts: {mesh: THREE.SkinnedMesh; l: number[]; r: number[]} | null = null;
    const footContact = () => {
      if (!surfer || !boardObj || !boardHolder) return null;
      if (!footVerts) {
        const sm = bodyMesh(); if (!sm) return null;
        const skinned = sm as THREE.SkinnedMesh, names = skinned.skeleton.bones.map((bn) => bn.name), si = skinned.geometry.getAttribute('skinIndex'), sw = skinned.geometry.getAttribute('skinWeight'), l: number[] = [], r: number[] = [];
        for (let i = 0; i < si.count; i++) { let wl = 0, wr = 0; for (let q = 0; q < 4; q++) { const n = names[si.getComponent(i, q)], w = sw.getComponent(i, q); if (n === 'foot_l' || n === 'ball_l') wl += w; if (n === 'foot_r' || n === 'ball_r') wr += w; } if (wl > 0.5) l.push(i); if (wr > 0.5) r.push(i); }
        footVerts = {mesh: skinned, l, r};
      }
      const inv = new THREE.Matrix4().copy(boardHolder.matrixWorld).invert(), g = boardObj.group, c = boardObj.curves, out: Record<string, unknown> = {}, v = new THREE.Vector3();
      for (const [side, list] of [['l', footVerts.l], ['r', footVerts.r]] as const) {
        let min = Infinity, mx = 0, mz = 0, sx = 0, sz = 0, below = 0;
        for (const i of list) { footVerts.mesh.getVertexPosition(i, v); v.applyMatrix4(footVerts.mesh.matrixWorld).applyMatrix4(inv); const d = v.y - c.deckAt(v.x / g.scale.x, v.z / g.scale.z) * g.scale.y; sx += v.x; sz += v.z; if (d < min) { min = d; mx = v.x; mz = v.z; } if (d < -0.001) below++; }
        out[side] = {soleToDeckMm: Math.round(min * 10000) / 10, at: [Math.round(mx * 100) / 100, Math.round(mz * 100) / 100], centre: [Math.round(sx / list.length * 100) / 100, Math.round(sz / list.length * 100) / 100], throughCount: below, verts: list.length};
      }
      out.liftMm = body ? body.footLift.map((x) => Math.round(x * 1000)) : null; out.plantedGapMm = body ? body.soleGap.map((x) => Math.round(x * 10000) / 10) : null; out.tiltDeg = body ? body.footTilt.map((x) => Math.round(x * 10) / 10) : null; out.boardScale = [Math.round(g.scale.x * 100) / 100, Math.round(g.scale.z * 100) / 100];
      return out;
    };
    /** The rider's own inputs: the profile's skill, the forecast hour's seed, the stance (null: a seeded default per spot-hour). */
    const setRider = (o: {skill?: Skill; seed?: number; stance?: Stance | null}) => {
      if (o.skill !== undefined) riderOpts.skill = o.skill; if (o.seed !== undefined) riderOpts.seed = o.seed; if (o.stance !== undefined) riderOpts.stance = o.stance;
      if (sim && cur) { sim.setWave(cur.atlas, u.uFlowX.value, riderOpts.skill, riderOpts.seed, riderOpts.stance); frontside = isFrontside(sim.stance, dir); sim.frontside = frontside; el.dataset.stance = sim.stance; el.dataset.skill = sim.plan.skill; el.dataset.seed = String(sim.seed); el.dataset.frontside = frontside ? '1' : '0'; if (import.meta.env.DEV) monitor.reset(); }
    };
    const setPole = (on: boolean) => { pole.visible = on; el.dataset.pole = on ? '1' : '0'; };
    api.current = {setWave, setDir, setLight, setBoard, setRider, setPole};
    setLight(lightRef.current);
    if (import.meta.env.DEV) (window as unknown as {__wave?: unknown}).__wave = {camera, controls, uniforms: u, sync, setWave, setDir, setBoard, setRider, setPole, setLight, rider: () => rider, probe: probeRider, footContact, board: () => boardObj, surfer: () => surfer, sim: () => sim, glitches: () => monitor.counts, resetGlitches: () => monitor.reset(), poleCheck, body: () => body, profile: (x: number, t?: number) => (cur ? profileAt(cur.atlas, x, t ?? u.uTime.value, 192, true) : null), atlasMeta: () => cur?.atlas.meta ?? null, breakX: (t?: number) => (cur ? breakX(cur.atlas.meta, t ?? u.uTime.value) : null), wake: () => ({n: wk.n, visible: wake.visible, pos: Array.from(wk.pos.slice((WK - 1) * 6)), a: Array.from(wk.a.slice(WK * 2 - 2))}), wakeMesh: wake, cfg: {BODY, RIDE, BOARD}, scene: group};   // R13: cfg: the live config objects (the limb audit switches layers off one at a time); scene: the wave group (the spray and the wake) // dev-only hook for QA: setWave draws any spec; rider is the last RiderSample; glitches the monitor's counts

    // render loop: only while visible and the tab is shown
    let frames = 0, statAt = performance.now(), visible = true, raf = 0, last = performance.now(), t0 = last, worst = 0;
    const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) kick(); }); io.observe(el);
    const frame = (now: number) => {
      raf = 0; if (disposed || !visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000); worst = Math.max(worst, now - last); last = now;
      let r: typeof ret | null = null;
      if (sim && surfer && surfer.visible && cur) { const alpha = reduced ? 1 : sim.advance(dt); r = placeRider(alpha, dt); } else u.uTime.value = (now - t0) / 1000;
      followCamera(dt); controls.update(); if (spray && spray.pts.visible) stepSpray(spray, dt, faceM); if (cur && surfer && surfer.visible) stepWake(u.uTime.value, cur.atlas, u.uFlowX.value); else wake.visible = false; renderer.render(scene, camera); frames++;
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
      boardObj?.dispose(); strip.geometry.dispose(); sea.geometry.dispose(); beach.geometry.dispose(); beachMat.dispose(); headland.geometry.dispose(); headMat.dispose(); spray?.pts.geometry.dispose(); wkGeo.dispose(); wkMat.dispose(); tex.value?.dispose();
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
  useEffect(() => { api.current?.setPole(pole); }, [pole]);
  return (
    <div className={'live' + (live ? ' is-live' : '')} data-state={live ? 'live' : 'loading'} data-band={bucketIdFor(wave.faceM)} data-dir={wave.direction} data-mode={wave.faceM === null ? (wave.offshoreM ? 'swell' : 'none') : 'surf'} role="group" aria-label={`3D view, ${alt}. Drag to orbit, scroll or pinch to zoom.`}>
      <div className="live-poster live-loading" aria-hidden="true"><span>Loading the 3D wave…</span></div>   {/* not the old pre-rendered still (`poster`): it showed a superseded wave and surfer before the live scene */}
      <div ref={host} className="live-host" />
    </div>
  );
}
export default WaveLive;
