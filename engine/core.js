// wang-motion engine core — deterministic, loop-exact card-motion renderer (Three.js)
// A template is a pure function of time: layout(ctx) -> array of card states.
import * as THREE from './vendor/three.module.js';
import { M, E, normParams, hash, deviceInfo } from './lib.js';

export { THREE };
import { adaptCards, mainRatio } from './adapt.js'; // v10.2
import { timelineInfo, timeMap, applyIntro, scalePost, scaleParticles, visibleCount, normIntro, normSpeed } from './intro.js';
export { timelineInfo, timeMap, normIntro, normSpeed };

// ---------- card shader ----------
const cardVert = /* glsl */`
uniform float uBend;      // curvature (1/radius) around local Y axis, world units^-1
uniform float uBendX;     // curvature around local X axis
uniform vec2 uSize;
uniform float uShear;     // vertical shear: local y += x*shear (parallelogram cards, helix ribbons)
varying vec2 vUv;
varying vec3 vN;
varying float vFacing;
#ifdef FX_FOIL
varying vec3 vVp;
#endif
#ifdef GLYPH
uniform vec2 uGOff;       // X1: glyph box centre relative to the card anchor (advance centre, cap middle)
#endif
#ifdef FOG
varying float vFogD;      // X8: view depth for fog
#endif
#ifdef CURL
uniform vec4 uCurl;       // X6 page curl: travel dir (x,y, card-local), fold position f along dir, cylinder radius
varying vec3 vCurl;       // x: d - f (flat along-dir distance past the fold, >0 = still flat), y: wrap angle / pi (0 flat .. 1 flap), z: local normal z
#endif
void main(){
  vUv = uv;
  vec3 p = vec3(position.xy*uSize, 0.0); // world-sized local plane
#ifdef GLYPH
  p.xy += uGOff;
#endif
  p.y += p.x * uShear;
  vec3 n = vec3(0.,0.,1.);
#ifdef CURL
  { // X6: points behind the moving fold line wrap a cylinder (axis on the fold, lying on the card) and lie flipped beyond it
    vec2 dir = uCurl.xy; float f = uCurl.z, r = max(uCurl.w, 1e-4);
    float d = dot(p.xy, dir); float sA = f - d; float th = 0.0, dn = d, z = 0.0;
    if (sA > 0.0) {
      if (sA < 3.14159265*r) { th = sA / r; dn = f - r*sin(th); z = r*(1.0 - cos(th)); }
      else { th = 3.14159265; dn = f + (sA - 3.14159265*r); z = 2.0*r; }
    }
    p.xy += dir*(dn - d); p.z = z;
    n = vec3(dir*sin(th), cos(th));
    vCurl = vec3(d - f, th/3.14159265, cos(th));
  }
#else
  if (abs(uBend) > 1e-5) {
    float r = 1.0/uBend; float a = p.x / r;
    p = vec3(sin(a)*r, p.y, (cos(a)-1.0)*r);
    n = vec3(sin(a), 0., cos(a));
  }
  if (abs(uBendX) > 1e-5) {
    float r = 1.0/uBendX; float a = p.y / r;
    p = vec3(p.x, sin(a)*r, p.z + (cos(a)-1.0)*r);
    n = normalize(vec3(n.x, sin(a), n.z*cos(a)));
  }
#endif
  vN = normalize(normalMatrix * n);
  vec4 mv = modelViewMatrix * vec4(p,1.0);
#ifdef FX_FOIL
  vVp = mv.xyz;
#endif
#ifdef FOG
  vFogD = -mv.z;
#endif
  gl_Position = projectionMatrix * mv;
}`;
const cardFrag = /* glsl */`
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uColor;
uniform vec2 uSize;        // card world size
uniform float uRadius;     // corner radius, world units
uniform float uOpacity;
uniform float uBright;     // multiplier (back fade / shading)
uniform vec4 uUvRect;      // sub-rect of (cover-fitted) media
uniform vec2 uCover;       // cover scale for media
uniform vec2 uCoverOff;
uniform float uMirrorBack; // 1 = show mirrored image on back face, 0 = dark back
uniform vec4 uMask;        // type, a, b, soft   type:0 none,1 line,2 circle,3 rect-reveal
uniform vec4 uMask2;
uniform float uBorder;     // border width world
uniform vec3 uBorderColor;
uniform float uSheen;      // specular sheen strength
uniform float uSat;        // saturation
uniform float uBlurLod;
uniform float uRim;
uniform vec4 uEdge;      // edge highlight lines: x=left/right, y=top, z=bottom strength, w=line width (world)
uniform vec4 uLight;     // X7 light card: type (0 off,1 radial,2 linear,3 beam,4 ring,5 streak), angle, ringR, ringW
uniform vec4 uLight2;    // beam fade, beam spread, falloff exponent, -
uniform vec4 uStopC[4];  // gradient stops: linear rgb + alpha
uniform float uStopP[4]; // stop positions 0..1 (ascending)
uniform float uStopN;    // stop count
uniform float uPremul;   // output mode: 0 straight alpha, 1 premultiplied (screen), 2 multiply
varying vec2 vUv;
varying vec3 vN;
#ifdef CLIP
uniform vec4 uClip;        // X2: rounded-rect clip in card-local world units: centre offset (x,y), half size (z,w)
uniform float uClipR;
#endif
#ifdef DECO
uniform vec4 uDeco;        // X2: procedural laptop deck (keyboard well, keys, trackpad); x = key colour luma
#endif
#ifdef GLYPH
// ---- X1 glyph text cards: SDF atlas mask (compiled only for glyph cards) ----
uniform sampler2D uGlyph;  // R8 SDF atlas page, 0.5 = contour, >0.5 inside
uniform vec4 uGRect;       // atlas uv rect of this glyph box (u0,v0,u1,v1)
uniform vec4 uGPar;        // x: world units per unit SDF value (2*R*k*s), y: outline width world (0 = fill)
uniform vec4 uGScreen;     // screen-space fill rect in gl coords (x0,y0,x1,y1), 0..1
uniform vec2 uGRes;        // framebuffer size px
#endif
#ifdef FOG
// ---- X8 depth fog (compiled only when camera() returns fog) ----
uniform vec3 uFogColor;    // linear rgb
uniform vec2 uFogRange;    // near, far (view depth, world units)
varying float vFogD;
float fogF(){ return clamp((vFogD - uFogRange.x) / max(uFogRange.y - uFogRange.x, 1e-5), 0.0, 1.0); }
#endif
vec4 lightColor(vec2 uv){
  vec2 q = uv - 0.5; float ca = cos(uLight.y), sa = sin(uLight.y);
  vec2 r = vec2(dot(q, vec2(ca, sa)), dot(q, vec2(-sa, ca))); // along, across
  float ty = uLight.x; float t; float fade = 1.0;
  if (ty < 1.5) t = length(q*2.0);                                                  // radial: 0 centre -> 1 card edge
  else if (ty < 2.5) t = r.x / (abs(ca)*0.5 + abs(sa)*0.5) * 0.5 + 0.5;             // linear along angle
  else if (ty < 3.5) { float al = clamp(r.x/(abs(ca)*0.5 + abs(sa)*0.5)*0.5 + 0.5, 0.0, 1.0);  // beam/cone: source at the -angle end
    t = abs(r.y*2.0) / max(mix(uLight2.y, 1.0, al), 1e-3); fade = 1.0 - uLight2.x*al; }
  else if (ty < 4.5) t = abs(length(q*2.0) - uLight.z) / max(uLight.w, 1e-3);      // ring
  else t = abs(r.y*2.0) / max(1e-3, 1.0 - abs(r.x*2.0));                            // streak: lens shape along angle
  t = clamp(t, 0.0, 1.0);
  if (uLight2.z > 0.0 && uLight2.z != 1.0) t = pow(t, uLight2.z);
  vec4 c = uStopC[0];
  for (int i = 1; i < 4; i++) {
    if (float(i) < uStopN && t > uStopP[i-1]) c = mix(uStopC[i-1], uStopC[i], clamp((t - uStopP[i-1]) / max(uStopP[i] - uStopP[i-1], 1e-5), 0.0, 1.0));
  }
  c.a *= max(fade, 0.0);
  return c;
}
float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
#ifdef CURL
// ---- X6 page curl (compiled only for curled cards) ----
uniform vec4 uCurl;        // dir.xy, fold f, radius
uniform vec4 uCurl2;       // flap length beyond the cylinder, fold shading, crest sheen, cast-shadow strength (x peel ramp)
uniform vec4 uCurlB;       // back colour (linear rgb), mode: 0 mirror, 1 paper/colour, 2 media
uniform vec4 uCurlT;       // back tint rgb + amount
uniform sampler2D uCurlMap; uniform vec4 uCurlCov; // back media + cover scale.xy / offset.zw
varying vec3 vCurl;
#endif
#ifdef DECO
// X2 laptop deck: card +y = hinge side. Keyboard well with 6x14 keys (space bar row), trackpad below.
float decoCov(float d){ float a = fwidth(d) + 1e-6; return 1.0 - smoothstep(-a, a, d); }
vec3 decoKeys(vec2 p, vec3 base){
  vec2 hs = uSize*0.5; vec3 col = base; vec3 keyC = vec3(uDeco.x);
  vec2 kc = vec2(0.0, hs.y*0.36), kh = vec2(hs.x*0.83, hs.y*0.47);
  float dw = sdRound(p - kc, kh, hs.y*0.035);
  col = mix(col, base*0.80, decoCov(dw));
  vec2 inset = kh*vec2(0.985, 0.965); vec2 cs = inset*2.0/vec2(14.0, 6.0);
  vec2 lp = (p - kc + inset)/cs;                       // cell coords, y 0 = front row
  vec2 ci = floor(lp); vec2 f = (fract(lp) - 0.5)*cs;
  vec2 hk = cs*0.5*vec2(0.80, 0.74); float ky = 0.0;
  if (ci.y > 4.5) { hk.y *= 0.55; ky = cs.y*0.18; }    // thin function row
  if (ci.y < 0.5 && ci.x > 3.5 && ci.x < 9.5) { f.x = p.x - kc.x + inset.x - 6.5*cs.x - cs.x*0.5; hk.x = cs.x*3.0 - cs.x*0.08; } // space bar
  float dk = sdRound(f - vec2(0.0, ky), hk, min(hk.x, hk.y)*0.22);
  float inK = step(0.0, ci.x)*step(ci.x, 13.0)*step(0.0, ci.y)*step(ci.y, 5.0);
  col = mix(col, keyC, decoCov(dk)*inK);
  vec2 tc = vec2(0.0, -hs.y*0.53), th = vec2(hs.x*0.25, hs.y*0.33);
  float dt = sdRound(p - tc, th, hs.y*0.05);
  col = mix(col, base*0.93, decoCov(dt));
  col = mix(col, base*0.70, decoCov(abs(dt) - hs.y*0.004));
  return col; }
#endif

#ifdef FX_ON
// ---- X5 card FX + X10 fade mask (compiled only when a card uses them; see Engine.applyFx) ----
uniform sampler2D uMap2; uniform vec2 uCover2; uniform vec2 uCoverOff2;
uniform vec4 uMix;  uniform vec4 uMix2; uniform vec4 uMixC;   // mix, amt, edge|freq, seed ; cx, cy, scale, - ; edge colour + glow
uniform vec4 uDis;  uniform vec4 uDisC;                       // dissolve p, scale, edge, seed ; edge colour + glow
uniform vec4 uDisp; uniform vec2 uDispC;                      // displace amp, freq, phase, - ; centre
uniform float uPix; uniform vec2 uRgb; uniform vec2 uDirB; uniform vec3 uRadB;
uniform float uFoil; uniform vec3 uDuoA; uniform vec3 uDuoB; uniform float uDuoAmt; uniform vec4 uTint;
uniform vec4 uSmear; uniform vec3 uScan; uniform float uBarrel;
uniform vec4 uShape; uniform vec4 uShape2; uniform vec3 uShapeC; // r, rot, soft, outline ; cx, cy, invert, - ; outline colour
uniform vec4 uFade;                                              // angle, from, to, -
#ifdef FX_FOIL
varying vec3 vVp;
#endif
vec2 gDx, gDy, gDx2, gDy2, gRgbO; float gGlow, gLine, gBar; vec3 gGlowC;
float fxH(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float fxN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(fxH(i), fxH(i+vec2(1.0,0.0)), f.x), mix(fxH(i+vec2(0.0,1.0)), fxH(i+vec2(1.0,1.0)), f.x), f.y); }
float fxF(vec2 p){ return (fxN(p)*0.5 + fxN(p*2.03+vec2(7.1,3.3))*0.25 + fxN(p*4.07+vec2(1.7,9.2))*0.125)/0.875; }
vec2 fxAsp(){ return uSize/max(uSize.x,uSize.y); }   // card uv -> units where the long side = 1
vec2 fxM1(vec2 c){ vec2 m = uUvRect.xy + c*(uUvRect.zw-uUvRect.xy); return (m-0.5)*uCover+0.5+uCoverOff; }
vec3 fxS1(vec2 c){ return textureGrad(uMap, fxM1(c), gDx, gDy).rgb; }
#ifdef FX_MAP2
vec2 fxM2(vec2 c){ vec2 m = uUvRect.xy + c*(uUvRect.zw-uUvRect.xy); return (m-0.5)*uCover2+0.5+uCoverOff2; }
vec3 fxS2(vec2 c){ return textureGrad(uMap2, fxM2(c), gDx2, gDy2).rgb; }
#endif
vec2 fxBlurAt(vec2 c, float f){ vec2 o = vec2(0.0);
#ifdef FX_DIRBLUR
  o += vec2(cos(uDirB.y), sin(uDirB.y)) * uDirB.x / fxAsp() * (f - 0.5);
#endif
#ifdef FX_RADBLUR
  o += (uRadB.yz - c) * uRadB.x * f;
#endif
  return c + o; }
vec3 fxG1(vec2 c){
#if defined(FX_DIRBLUR) || defined(FX_RADBLUR)
  vec3 acc = vec3(0.0); for (int k = 0; k < 8; k++) { vec2 cc = fxBlurAt(c, float(k)/7.0);
  #ifdef FX_RGB
    acc += vec3(fxS1(cc + gRgbO).r, fxS1(cc).g, fxS1(cc - gRgbO).b);
  #else
    acc += fxS1(cc);
  #endif
  } return acc * 0.125;
#else
  #ifdef FX_RGB
  return vec3(fxS1(c + gRgbO).r, fxS1(c).g, fxS1(c - gRgbO).b);
  #else
  return fxS1(c);
  #endif
#endif
}
#ifdef FX_MAP2
vec3 fxG2(vec2 c){
#if defined(FX_DIRBLUR) || defined(FX_RADBLUR)
  vec3 acc = vec3(0.0); for (int k = 0; k < 8; k++) { vec2 cc = fxBlurAt(c, float(k)/7.0);
  #ifdef FX_RGB
    acc += vec3(fxS2(cc + gRgbO).r, fxS2(cc).g, fxS2(cc - gRgbO).b);
  #else
    acc += fxS2(cc);
  #endif
  } return acc * 0.125;
#else
  #ifdef FX_RGB
  return vec3(fxS2(c + gRgbO).r, fxS2(c).g, fxS2(c - gRgbO).b);
  #else
  return fxS2(c);
  #endif
#endif
}
#endif
#ifdef FX_SHAPE
float fxDot2(vec2 v){ return dot(v,v); }
float fxHex(vec2 p, float r){ const vec3 k = vec3(-0.866025404,0.5,0.577350269); p = abs(p); p -= 2.0*min(dot(k.xy,p),0.0)*k.xy; p -= vec2(clamp(p.x, -k.z*r, k.z*r), r); return length(p)*sign(p.y); }
float fxStar(vec2 p, float r, float rf){ const vec2 k1 = vec2(0.809016994375, -0.587785252292); const vec2 k2 = vec2(-k1.x,k1.y);
  p.x = abs(p.x); p -= 2.0*max(dot(k1,p),0.0)*k1; p -= 2.0*max(dot(k2,p),0.0)*k2; p.x = abs(p.x); p.y -= r;
  vec2 ba = rf*vec2(-k1.y,k1.x) - vec2(0.0,1.0); float h = clamp(dot(p,ba)/dot(ba,ba), 0.0, r); return length(p-ba*h) * sign(p.y*ba.x-p.x*ba.y); }
float fxHeart(vec2 p){ p.x = abs(p.x); if (p.y+p.x > 1.0) return sqrt(fxDot2(p-vec2(0.25,0.75))) - 0.35355339;
  return sqrt(min(fxDot2(p-vec2(0.0,1.0)), fxDot2(p-0.5*max(p.x+p.y,0.0)))) * sign(p.x-p.y); }
float fxCross(vec2 p, vec2 b){ p = abs(p); p = (p.y>p.x) ? p.yx : p.xy; vec2 q = p - b; float k = max(q.y,q.x); vec2 w = (k>0.0) ? q : vec2(b.y-p.x,-k); return sign(k)*length(max(w,0.0)); }
#endif
// alpha-only effects (shape mask, fade mask, dissolve), card uv space like the classic masks
float fxAlpha(){ float a = 1.0; gGlow = 0.0; gLine = 0.0; gBar = 1.0; gGlowC = vec3(1.0);
#ifdef FX_FADE
  { vec2 dir = vec2(cos(uFade.x), sin(uFade.x)); float proj = dot(vUv-0.5, dir) / (abs(dir.x)*0.5+abs(dir.y)*0.5) * 0.5 + 0.5;
    float t = clamp((proj - uFade.y) / (uFade.z - uFade.y), 0.0, 1.0); a *= 1.0 - t*t*(3.0-2.0*t); }
#endif
#ifdef FX_SHAPE
  { vec2 q = (vUv - uShape2.xy) * fxAsp() * 2.0; float cr = cos(uShape.y), sr = sin(uShape.y); q = vec2(cr*q.x + sr*q.y, -sr*q.x + cr*q.y);
    float r = uShape.x; float d;
  #if FX_SHAPE == 0
    d = length(q) - r;
  #elif FX_SHAPE == 1
    d = (abs(q.x)+abs(q.y))*0.70710678 - r;
  #elif FX_SHAPE == 2
    d = fxHex(q, r);
  #elif FX_SHAPE == 3
    d = fxStar(q, r, 0.45);
  #elif FX_SHAPE == 4
    d = fxHeart(q/(r*2.0) + vec2(0.0, 0.5)) * r * 2.0;
  #elif FX_SHAPE == 5
    d = fxCross(q, vec2(r, r*0.36));
  #else
    vec2 bq = abs(q) - vec2(r); d = length(max(bq,0.0)) + min(max(bq.x,bq.y),0.0);
  #endif
    float sf = max(uShape.z, fwidth(d));
    float ow = uShape.w;
    if (uShape2.z > 0.5) { a *= smoothstep(-sf, sf, d); gLine = smoothstep(-sf, sf, d) * (1.0 - smoothstep(ow-sf, ow+sf, d)) * step(1e-6, ow); }
    else { a *= 1.0 - smoothstep(-sf, sf, d); gLine = (1.0 - smoothstep(-sf, sf, d)) * smoothstep(-ow-sf, -ow+sf, d) * step(1e-6, ow); } }
#endif
#ifdef FX_DISSOLVE
  { float n = fxF(vUv*fxAsp()*uDis.y + uDis.w*7.31); float e = max(uDis.z, 1e-3); float t = uDis.x*(1.0+e);
    float k = smoothstep(t - e, t, n); a *= k;
    gGlow = k * (1.0 - smoothstep(t, t + e, n)) * min(1.0, uDis.x*20.0) * uDisC.a; gGlowC = uDisC.rgb; }
#endif
  return a; }
vec2 fxWarp(vec2 c){
#ifdef FX_BARREL
  { vec2 q = c - 0.5; c = 0.5 + q*(1.0 + uBarrel*(dot(q,q)*4.0 - 1.0)*0.5);
    vec2 e = min(c, 1.0 - c); float fw = max(length(fwidth(c)), 1e-4); gBar = smoothstep(-fw, fw, min(e.x, e.y)); }
#endif
#ifdef FX_DISPLACE
  { float amp = uDisp.x, fr = uDisp.y, ph = uDisp.z; vec2 A = fxAsp();
  #if FX_DISPLACE == 0
    c.x += amp / A.x * sin((c.y*A.y*fr + ph) * 6.2831853);
  #elif FX_DISPLACE == 1
    { vec2 d = (c - uDispC)*A; float r = length(d); c += (r > 1e-5 ? d/r : vec2(0.0)) * amp * sin((r*fr - ph) * 6.2831853) / A; }
  #elif FX_DISPLACE == 2
    { vec2 d = (c - uDispC)*A; float r = length(d); float an = amp * pow(max(0.0, 1.0 - r*fr), 2.0); float ca = cos(an), sa = sin(an);
      c = uDispC + vec2(ca*d.x - sa*d.y, sa*d.x + ca*d.y) / A; }
  #elif FX_DISPLACE == 3
    c += (vec2(fxN(c*A*fr + vec2(ph, 3.1)), fxN(c*A*fr + vec2(11.7, ph))) - 0.5) * 2.0 * amp / A;
  #else
    c.x += amp / A.x * (fxN(vec2(c.x*A.x*fr*2.0, c.y*A.y*fr*0.6 - ph)) - 0.5) * 2.0;
    c.y += amp / A.y * 0.4 * (fxN(vec2(c.x*A.x*fr*2.0 + 5.0, c.y*A.y*fr*0.6 - ph)) - 0.5);
  #endif
  }
#endif
#ifdef FX_SMEAR
  { vec2 bs = uSmear.z / fxAsp(); vec2 bi = floor(c/bs); float sd = uSmear.y;
    if (fxH(bi + vec2(sd*1.37, sd*0.71)) < uSmear.x) {
      vec2 mv = vec2(fxH(bi + vec2(13.1, sd)), fxH(bi + vec2(sd, 71.7))) - 0.5;
      vec2 l = fract(c/bs); c = (bi + l*0.3)*bs - mv * uSmear.w / fxAsp(); } }
#endif
#ifdef FX_PIX
  { vec2 N = vec2(uPix, uPix*uSize.y/uSize.x); c = (floor(c*N) + 0.5) / N; }
#endif
  return c; }
vec3 fxSample(vec2 uv){
  float lb = exp2(uBlurLod);
  vec2 m1 = fxM1(uv); gDx = dFdx(m1)*lb; gDy = dFdy(m1)*lb;
#ifdef FX_MAP2
  vec2 m2 = fxM2(uv); gDx2 = dFdx(m2)*lb; gDy2 = dFdy(m2)*lb;
#endif
#ifdef FX_PIX
  { float fp = max(max(abs(dFdx(uv.x)), abs(dFdy(uv.x))), 1e-6); float k = max(1.0, 0.5/(uPix*fp)); gDx *= k; gDy *= k;
  #ifdef FX_MAP2
    gDx2 *= k; gDy2 *= k;
  #endif
  }
#endif
#ifdef FX_RGB
  gRgbO = vec2(cos(uRgb.y), sin(uRgb.y)) * uRgb.x / fxAsp();
#endif
  vec2 c = fxWarp(uv);
  vec3 col;
#ifdef FX_MAP2
  float m = uMix.x;
  #if FX_MIXMODE == 0
  col = mix(fxG1(c), fxG2(c), m);
  #elif FX_MIXMODE == 1
  { float n = fxF(c*fxAsp()*uMix2.z + uMix.w*7.31); float e = max(uMix.z, 1e-3); float t = m*(1.0+e);
    float k1 = smoothstep(t - e, t, n); col = mix(fxG2(c), fxG1(c), k1);
    gGlow = max(gGlow, k1 * (1.0 - smoothstep(t, t + e, n)) * min(1.0, m*20.0) * uMixC.a); gGlowC = uMixC.rgb; }
  #elif FX_MIXMODE == 2
  { vec3 b = fxG2(c); float l = dot(b, vec3(0.299,0.587,0.114)); float e = max(uMix.z, 1e-3); float t = m*(1.0+e);
    col = mix(fxG1(c), b, 1.0 - smoothstep(t - e, t, l)); }
  #elif FX_MIXMODE == 3
  { vec2 A = fxAsp(); vec2 v = (vec2(fxN(c*A*uMix2.z + vec2(3.1, uMix.w)), fxN(c*A*uMix2.z + vec2(uMix.w, 11.7))) - 0.5) * 2.0 * uMix.y / A;
    float e = m*m*(3.0-2.0*m); col = mix(fxG1(c + v*e), fxG2(c - v*(1.0-e)), e); }
  #elif FX_MIXMODE == 4
  { vec2 bs = 1.0 / (uMix2.z * fxAsp()); vec2 bi = floor(c/bs); float h = fxH(bi + vec2(uMix.w, uMix.w*0.37));
    float near = (1.0 - smoothstep(0.0, 0.15, abs(h - m)));
    vec2 off = (vec2(fxH(bi + vec2(5.3, 1.0)), fxH(bi + vec2(9.1, 2.0))) - 0.5) * uMix.y / fxAsp() * near;
    col = mix(fxG1(c + off), fxG2(c + off), step(h, m)); }
  #elif FX_MIXMODE == 5
  { vec2 A = fxAsp(); vec2 d = (c - uMix2.xy)*A; float r = length(d); float w = sin(3.14159265*m);
    vec2 o = (r > 1e-5 ? d/r : vec2(0.0)) * sin((r*uMix.z - m*2.0) * 6.2831853) * uMix.y * w / A;
    col = mix(fxG1(c + o), fxG2(c + o), m*m*(3.0-2.0*m)); }
  #else
  { vec2 A = fxAsp(); vec2 d = (c - uMix2.xy)*A; float r = length(d); float an = uMix.y * sin(3.14159265*m) * pow(max(0.0, 1.0 - r/0.75), 2.0);
    float ca = cos(an), sa = sin(an); vec2 cc = uMix2.xy + vec2(ca*d.x - sa*d.y, sa*d.x + ca*d.y) / A;
    col = mix(fxG1(cc), fxG2(cc), m*m*(3.0-2.0*m)); }
  #endif
#else
  col = fxG1(c);
#endif
  return col; }   // barrel edge (gBar) is applied to alpha in main(): bulged screen, no black bezel
// colour effects on the card colour (media or flat)
vec3 fxPost(vec3 col){
#ifdef FX_DUO
  { float l = dot(col, vec3(0.299,0.587,0.114)); col = mix(col, mix(uDuoA, uDuoB, l), uDuoAmt); }
#endif
#ifdef FX_TINT
  col = mix(col, col*uTint.rgb, uTint.a);
#endif
#ifdef FX_FOIL
  { vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; vec3 vd = normalize(-vVp); float l = dot(col, vec3(0.299,0.587,0.114));
    float h = fract(dot(n.xy, vec2(1.7,-1.3)) + dot(vd.xy, vec2(2.3,1.1)) + vUv.x*0.55 + vUv.y*0.85);
    vec3 rb = 0.5 + 0.5*cos(6.2831853*(h + vec3(0.0, 0.33, 0.67)));
    float g = fract(vUv.x*0.6 - vUv.y*0.45 + n.x*1.3 + n.y*0.9); g = pow(1.0 - abs(g*2.0 - 1.0), 8.0);
    col = mix(col, col*0.55 + rb*0.6, uFoil*(0.3 + 0.7*l)) + uFoil*g*0.35; }
#endif
#ifdef FX_SCAN
  { float s = 0.5 + 0.5*sin((vUv.y*uScan.y + uScan.z) * 6.2831853); col *= (1.0 - uScan.x*0.6*s) * (1.0 + uScan.x*0.2); }
#endif
  return col; }
#endif
void main(){
  vec2 p = (vUv-0.5)*uSize;
  float d = sdRound(p, uSize*0.5, min(uRadius, min(uSize.x,uSize.y)*0.5));
  float aa = fwidth(d)*1.0 + 1e-5;
  float alpha = 1.0 - smoothstep(-aa, aa, d);
  // masks (in card uv space 0..1)
  if (uMask.x > 0.5 && uMask.x < 1.5) { // line: dir angle a, progress b (0..1 covers), soft
    vec2 dir = vec2(cos(uMask.y), sin(uMask.y));
    float proj = dot(vUv-0.5, dir) / (abs(dir.x)*0.5+abs(dir.y)*0.5) * 0.5 + 0.5; // 0..1 across
    alpha *= 1.0 - smoothstep(uMask.z - uMask.w, uMask.z + uMask.w, proj);
  } else if (uMask.x > 1.5 && uMask.x < 2.5) { // circle: center (uMask2.xy), radius b
    float r = length((vUv-uMask2.xy)*uSize/max(uSize.x,uSize.y));
    alpha *= 1.0 - smoothstep(uMask.z - uMask.w, uMask.z + uMask.w, r);
  } else if (uMask.x > 2.5) { // rect: x0,y0,x1,y1 in uMask2
    vec2 lo = uMask2.xy, hi = uMask2.zw;
    float e = uMask.w + 1e-4;
    float ax = smoothstep(lo.x-e, lo.x+e, vUv.x) * (1.0 - smoothstep(hi.x-e, hi.x+e, vUv.x));
    float ay = smoothstep(lo.y-e, lo.y+e, vUv.y) * (1.0 - smoothstep(hi.y-e, hi.y+e, vUv.y));
    alpha *= ax*ay;
  }
  vec2 uv = vUv;
  bool back = !gl_FrontFacing;
  if (back && uMirrorBack < -0.5) uv.x = 1.0 - uv.x; // -1 = un-mirror back
  vec2 muv = uUvRect.xy + uv*(uUvRect.zw - uUvRect.xy);
  muv = (muv - 0.5) * uCover + 0.5 + uCoverOff;
  // sample BEFORE discard: derivatives must be computed in uniform control flow (fixes 1px seams at mask edges)
  vec3 texc = texture2D(uMap, muv, uBlurLod).rgb;
#ifdef CURL
  vec3 curlTex; { vec2 q = (vUv - 0.5)*uSize; q -= 2.0*dot(q, uCurl.xy)*uCurl.xy; vec2 cu = q/uSize + 0.5; // back un-mirrored across the fold
    vec2 cm = uUvRect.xy + cu*(uUvRect.zw - uUvRect.xy); curlTex = texture2D(uCurlMap, (cm - 0.5)*uCurlCov.xy + 0.5 + uCurlCov.zw, uBlurLod).rgb; }
#endif
#ifdef GLYPH
  { vec2 gu = uUvRect.xy + vUv*(uUvRect.zw - uUvRect.xy);
    float sd = (texture2D(uGlyph, uGRect.xy + gu*(uGRect.zw - uGRect.xy)).r - 0.5) * uGPar.x;   // signed distance, world, + inside
    float px = max(length(vec2(dFdx(sd), dFdy(sd))), 1e-7);                                       // world units per pixel along the gradient
    float ga = clamp(0.5 + sd/px, 0.0, 1.0);
    if (uGPar.y > 0.0) ga = clamp(0.5 + (sd + uGPar.y*0.5)/px, 0.0, 1.0) - clamp(0.5 + (sd - uGPar.y*0.5)/px, 0.0, 1.0);
    alpha *= ga; }
  #ifdef GLYPH_SCREEN
  { vec2 su = (gl_FragCoord.xy/uGRes - uGScreen.xy) / (uGScreen.zw - uGScreen.xy);
    texc = texture2D(uMap, (su - 0.5)*uCover + 0.5 + uCoverOff, uBlurLod).rgb; }
  #endif
#endif
#ifdef FX_ON
  alpha *= fxAlpha();
  #ifndef GLYPH_SCREEN
  if (uHasMap > 0.5) { texc = fxSample(uv); alpha *= gBar; }
  #endif
#endif
#ifdef CLIP
  { float dc = sdRound(p - uClip.xy, uClip.zw, min(uClipR, min(uClip.z, uClip.w))); float ac = fwidth(dc) + 1e-6; alpha *= 1.0 - smoothstep(-ac, ac, dc); }
#endif
  if (alpha <= 0.002) discard;
  if (uLight.x > 0.5) { // X7 light card: colour + alpha from gradient, no media/back/border/sheen
    vec4 lc = lightColor(vUv);
    gl_FragColor = vec4(lc.rgb * uBright, alpha * lc.a * uOpacity);
#ifdef FOG
    gl_FragColor.a *= 1.0 - fogF();
#endif
    #include <colorspace_fragment>
    if (uPremul > 1.5) gl_FragColor = vec4(mix(vec3(1.0), gl_FragColor.rgb, gl_FragColor.a), 1.0);
    else if (uPremul > 0.5) gl_FragColor.rgb *= gl_FragColor.a;
    return;
  }
  vec3 col = uColor;
  if (uHasMap > 0.5) col = texc;
#ifdef DECO
  col = decoKeys(p, col);
#endif
#ifdef FX_ON
  col = fxPost(col);
#endif
  float lum = dot(col, vec3(0.299,0.587,0.114));
  col = mix(vec3(lum), col, uSat);
  if (back && uMirrorBack < 0.5) col = col*0.15;
#ifdef CURL
  { if (back) { if (uCurlB.w > 1.5) col = curlTex; else if (uCurlB.w > 0.5) col = uCurlB.rgb;
      col = mix(col, uCurlT.rgb, uCurlT.a); }
    float th = vCurl.y; float onC = step(1e-4, th) * (1.0 - step(0.9999, th));
    float facing = back ? -vCurl.z : vCurl.z;                    // 1 where the visible side faces the card normal (flat page / flat flap)
    col *= mix(1.0, 0.30 + 0.70*pow(max(facing, 0.0), 0.7), uCurl2.y*onC);   // fold shading by cylinder normal
    if (back) col += uCurl2.z*0.32*exp(-pow((th - 0.74)/0.09, 2.0));        // sheen band at the crest
    if (vCurl.x > 0.0) col *= 1.0 - uCurl2.w*0.5*(1.0 - smoothstep(uCurl2.x, uCurl2.x + uCurl.w*3.0, vCurl.x)); } // shadow cast on the flat page
#endif
  // border
  if (uBorder > 0.0) { float bd = smoothstep(-uBorder-aa, -uBorder+aa, d); col = mix(col, uBorderColor, bd); }
  // sheen
  if (uSheen > 0.0) {
    vec3 n = normalize(vN); if (back) n = -n;
    float s = pow(vUv.y,2.0)*0.30;
    col += uSheen * s;
  }
  col *= uBright;
  if (uEdge.x + uEdge.y + uEdge.z > 0.0) {
    vec2 hs = uSize*0.5; float lw = uEdge.w; float rr = min(uRadius, min(hs.x,hs.y));
    float bandX = 1.0 - smoothstep(lw*0.6, lw*1.4, hs.x - abs(p.x));
    float bandT = 1.0 - smoothstep(lw*0.6, lw*1.4, abs(hs.y - p.y - lw*1.6));
    float bandB = 1.0 - smoothstep(lw*0.6, lw*1.4, hs.y + p.y);
    float inY = smoothstep(hs.y - rr*0.6, hs.y - rr*1.2 - lw, abs(p.y));
    float inX = smoothstep(hs.x - rr*0.6, hs.x - rr*1.2 - lw, abs(p.x));
    float e = max(uEdge.x*bandX*inY*(0.45+0.55*(1.0-vUv.y)), max(uEdge.y*bandT*inX, uEdge.z*bandB*inX));
    col = mix(col, vec3(1.0), clamp(e,0.0,1.0));
  }
  if (uRim > 0.0) { float e = smoothstep(-aa*2.5, -aa*0.5, d) * smoothstep(0.12, 0.0, vUv.y); col = mix(col, vec3(1.0), e*uRim); }
#ifdef FX_ON
  col = mix(col, gGlowC, clamp(gGlow, 0.0, 1.0));
  #ifdef FX_SHAPE
  col = mix(col, uShapeC, gLine);
  #endif
#endif
#ifdef FOG
  col = mix(col, uFogColor, fogF());
#endif
  gl_FragColor = vec4(col, alpha*uOpacity);
  #include <colorspace_fragment>
  if (uPremul > 1.5) gl_FragColor = vec4(mix(vec3(1.0), gl_FragColor.rgb, gl_FragColor.a), 1.0);
  else if (uPremul > 0.5) gl_FragColor.rgb *= gl_FragColor.a;
}`;

const shadowFrag = /* glsl */`
uniform vec2 uSize; uniform float uRadius; uniform float uSoft; uniform float uOpacity;
varying vec2 vUv;
float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
void main(){
  vec2 pad = vec2(uSoft*2.0);
  vec2 p = (vUv-0.5)*(uSize+pad*2.0);
  float d = sdRound(p, uSize*0.5, uRadius);
  float a = 1.0 - smoothstep(-uSoft, uSoft*1.6, d);
  gl_FragColor = vec4(0.0,0.0,0.0, a*uOpacity);
}`;
const shadowVert = /* glsl */`varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `;

// ---------- X9 slab thickness: side walls (rounded-rect strip, built in the vertex shader) + optional flat back cap (CAP) ----------
// wall geometry attribute `position` = (corner k 0..3, angle a, zf 0 front / 1 back); front edge = the card outline at z=0, back at -depth
const slabVert = /* glsl */`
uniform vec2 uSize; uniform float uRadius; uniform float uDepth; uniform vec2 uOff;
uniform float uBend; uniform float uBendX; uniform float uShear;
varying vec2 vUv; varying vec3 vN; varying vec3 vVp;
#ifdef FOG
varying float vFogD;
#endif
void main(){
  vec2 hs = uSize*0.5; float r = min(uRadius, min(hs.x, hs.y));
#ifdef CAP
  vec3 p = vec3(position.xy*uSize + uOff, 0.0); vec2 nd = vec2(0.0); float zf = 1.0; vUv = uv;
#else
  float k = position.x; float a = position.y; float zf = position.z;
  vec2 sg = vec2((k < 0.5 || k > 2.5) ? 1.0 : -1.0, (k < 1.5) ? 1.0 : -1.0);
  vec2 nd = vec2(cos(a), sin(a));
  vec3 p = vec3(sg*(hs - r) + nd*r + uOff, 0.0);
  vUv = (p.xy - uOff)/uSize + 0.5;
#endif
  p.y += p.x*uShear;
  vec3 fn = vec3(0.0, 0.0, 1.0); vec3 n = vec3(nd, 0.0);
  if (abs(uBend) > 1e-5) { float R = 1.0/uBend; float an = p.x/R; p = vec3(sin(an)*R, p.y, (cos(an)-1.0)*R); fn = vec3(sin(an), 0.0, cos(an)); n = vec3(n.x*cos(an), n.y, -n.x*sin(an)); }
  if (abs(uBendX) > 1e-5) { float R = 1.0/uBendX; float an = p.y/R; p = vec3(p.x, sin(an)*R, p.z + (cos(an)-1.0)*R); fn = normalize(vec3(fn.x, sin(an), fn.z*cos(an))); n = normalize(vec3(n.x, n.y*cos(an), n.z - n.y*sin(an))); }
  p -= fn*uDepth*zf;
#ifdef CAP
  n = -fn;
#endif
  vN = normalize(normalMatrix*n);
  vec4 mv = modelViewMatrix*vec4(p, 1.0); vVp = mv.xyz;
#ifdef FOG
  vFogD = -mv.z;
#endif
  gl_Position = projectionMatrix*mv;
}`;
const slabFrag = /* glsl */`
uniform vec2 uSize; uniform float uRadius; uniform vec3 uColor; uniform float uOpacity;
uniform float uMode;      // 0 flat colour, 1 media sampled at the nearest card edge (blurred), 2 media average
uniform sampler2D uMap; uniform vec4 uUvRect; uniform vec2 uCover; uniform vec2 uCoverOff; uniform float uLod;
uniform vec4 uShade;      // x colour multiplier, y directional light amount, z specular, w bright
varying vec2 vUv; varying vec3 vN; varying vec3 vVp;
#ifdef FOG
uniform vec3 uFogColor; uniform vec2 uFogRange; varying float vFogD;
#endif
float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
void main(){
  float alpha = 1.0;
#ifdef CAP
  { vec2 p = (vUv-0.5)*uSize; float d = sdRound(p, uSize*0.5, min(uRadius, min(uSize.x, uSize.y)*0.5)); float aa = fwidth(d) + 1e-5; alpha = 1.0 - smoothstep(-aa, aa, d); }
#endif
  vec2 muv = uUvRect.xy + clamp(vUv, 0.0, 1.0)*(uUvRect.zw - uUvRect.xy); muv = (muv - 0.5)*uCover + 0.5 + uCoverOff;
  vec3 tx = texture2D(uMap, uMode > 1.5 ? vec2(0.5) : muv, uMode > 1.5 ? 14.0 : uLod).rgb;
  if (alpha <= 0.002) discard;
  vec3 col = uColor;
  if (uMode > 0.5) col *= tx;
  col *= uShade.x;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 L = normalize(vec3(-0.35, 0.75, 0.55));
  col *= mix(1.0, 0.42 + 0.78*max(dot(n, L), 0.0), uShade.y);
  vec3 V = normalize(-vVp); vec3 Hh = normalize(L + V);
  col += uShade.z*pow(max(dot(n, Hh), 0.0), 28.0)*0.6;
  col *= uShade.w;
#ifdef FOG
  col = mix(col, uFogColor, clamp((vFogD - uFogRange.x)/max(uFogRange.y - uFogRange.x, 1e-5), 0.0, 1.0));
#endif
  gl_FragColor = vec4(col, alpha*uOpacity);
  #include <colorspace_fragment>
}`;
function slabGeometry(N = 10) {
  const pos = [], idx = [], ring = 4 * (N + 1);
  for (let zf = 0; zf < 2; zf++) for (let k = 0; k < 4; k++) for (let j = 0; j <= N; j++) pos.push(k, (k + j / N) * Math.PI / 2, zf);
  for (let i = 0; i < ring; i++) { const i1 = (i + 1) % ring; idx.push(i, ring + i, ring + i1, i, ring + i1, i1); } // outward-facing CCW
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
// X2 device defaults
const DEV_COLOR = { phone: '#1d1d20', tablet: '#2b2b2f', laptop: '#c8cacf', watch: '#1d1d20', crt: '#d8d0bd', browser: '#2a2b2f' };
const DEV_PASS_SKIP = new Set(['device', 'w', 'h', 'x', 'y', 'z', 'rx', 'ry', 'rz', 'order', 's', 'opacity', 'deviceColor', 'bezelColor', 'hinge', 'island', 'gloss', 'glossAngle',
  'chrome', 'orient', 'shadow', 'layer', 'depthWrite', 'depthTest', 'mirrorY', 'thickness', 'screenCards', 'screenColor', 'screenBright', 'screenFx', 'bright', 'strap', 'fade',
  'sideColor', 'sideSpec', 'sideShade', 'sideLight', 'back', 'frameColor', 'radius', 'radiusW', 'radiusMul', 'sheen', 'rim', 'edgeX', 'edgeTop', 'edgeBottom', 'edgeW', 'bend', 'bendX', 'shear', 'hidden', 'led']);

// ---------- background ----------
const bgFrag = /* glsl */`
uniform int uType; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uAngle; uniform float uRadial;
uniform sampler2D uMap; uniform vec2 uCover; uniform float uDim; uniform float uTime; uniform float uAnim;
varying vec2 vUv;
void main(){
  vec3 c = uC1;
  if (uType==1){
    vec2 d = vec2(cos(uAngle), sin(uAngle));
    float t = dot(vUv-0.5, d) + 0.5;
    if (uRadial>0.5) t = clamp(length(vUv-0.5)*1.6,0.,1.);
    if (uAnim>0.0){ t += 0.08*sin(6.2831853*uTime + vUv.x*3.0); }
    t = clamp(t,0.,1.);
    c = t<0.5 ? mix(uC1,uC2,t*2.0) : mix(uC2,uC3,(t-0.5)*2.0);
  } else if (uType==2){
    c = texture2D(uMap, (vUv-0.5)*uCover+0.5).rgb * uDim;
  } else if (uType==3){ // mesh aurora
    vec2 q = vUv; float t = uTime*6.2831853;
    float a = sin(q.x*3.0+t)*0.5+0.5, b = sin(q.y*4.0-t+1.3)*0.5+0.5, e = sin((q.x+q.y)*2.5+t*0.5+2.0)*0.5+0.5;
    c = uC1*(1.0-a*0.6) + uC2*b*0.6 + uC3*e*0.5;
  }
  gl_FragColor = vec4(c,1.0);
  #include <colorspace_fragment>
}`;

// post (grain, vignette)
const postFrag = /* glsl */`
uniform sampler2D tDiffuse; uniform float uGrain; uniform float uVig; uniform float uSeed; uniform float uAb; uniform vec2 uRes;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))+uSeed)*43758.5453); }
void main(){
  vec2 uv = vUv;
  vec3 c;
  if (uAb>0.0){ vec2 o=(uv-0.5)*uAb*0.01; c = vec3(texture2D(tDiffuse,uv+o).r, texture2D(tDiffuse,uv).g, texture2D(tDiffuse,uv-o).b); }
  else c = texture2D(tDiffuse, uv).rgb;
  if (uVig>0.0){ float v = smoothstep(0.85, 0.2, length(uv-0.5)*1.25); c *= mix(1.0, v, uVig); }
  if (uGrain>0.0){ c += (h(uv*uRes)-0.5)*uGrain*0.07; }
  gl_FragColor = vec4(c,1.0);
  #include <colorspace_fragment>
}`;


// ---------- X4a template post-FX (only run when the template returns `post`; else the pass is skipped entirely) ----------
const tplPostFrag = /* glsl */`
uniform sampler2D tDiffuse; uniform vec2 uRes;
uniform float uChroma;           // radial chromatic aberration (fraction of half-diagonal)
uniform vec4 uGlitch;            // amount, block (frac of height), rgb, seed
uniform vec4 uScan;              // amount, lines (count over height), roll, -
uniform vec4 uFlash;             // rgb, amount
uniform vec4 uTint;              // rgb, amount
uniform vec4 uGrade;             // saturation, contrast, brightness, on
uniform vec4 uBloom;             // X4b: amount, -, -, - (glow texture tBloom built by the bloom passes)
uniform sampler2D tBloom;
uniform float uBarrel;           // X4b: CRT bulge amount (black outside)
uniform vec4 uTrack;             // X4b: amount, band centre y (0 = bottom), band height, seed
uniform vec2 uNoise;             // X4b: amount, seed
uniform float uLeakN;            // X4b: number of light leaks (0..4)
uniform vec4 uLeakP[4];          // x, y (frame uv, y up), radius (frac of height), alpha
uniform vec3 uLeakC[4];
varying vec2 vUv;
float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float hq(vec2 p, float sd){ p += vec2(mod(sd, 251.0)*61.7, mod(sd, 241.0)*23.3); vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 tap(vec2 uv, vec2 o){ return vec3(texture2D(tDiffuse,uv+o).r, texture2D(tDiffuse,uv).g, texture2D(tDiffuse,uv-o).b); }
void main(){
  vec2 uv = vUv; vec2 split = vec2(0.0); float inv = 0.0; float edge = 1.0; float trw = 0.0;
  if (uBarrel > 0.0){                                             // X4b: CRT bulge, corners fall outside -> black
    vec2 cc = uv-0.5; vec2 pa = cc*vec2(uRes.x/uRes.y, 1.0); float k = uBarrel*0.5/(0.25*(uRes.x*uRes.x/(uRes.y*uRes.y))+0.25); // corners scaled by 1 + amount/2
    uv = 0.5 + cc*(1.0 + k*dot(pa, pa));
    vec2 px = min(uv, 1.0-uv)*uRes; edge = clamp(min(px.x, px.y)/1.5, 0.0, 1.0);
    vec2 ev = min(uv, 1.0-uv); edge *= mix(1.0, smoothstep(0.0, 0.06, ev.x)*smoothstep(0.0, 0.06, ev.y)*0.35+0.65, clamp(uBarrel*3.0, 0.0, 1.0));
  }
  vec2 suv = uv;                                                  // screen-space (warped) uv for scanlines/noise
  if (uTrack.x > 0.0){                                            // X4b: VHS tracking band
    float d = (suv.y - uTrack.y)/max(uTrack.z, 1e-3); trw = exp(-d*d*4.0);
    float ln = floor(suv.y*uRes.y*0.5);
    uv.x += uTrack.x*trw*(0.035*(hq(vec2(ln, 3.0), uTrack.w)-0.3) + 0.02*sin(d*9.0 + uTrack.w));
  }
  if (uChroma > 0.0) split += (uv-0.5)*uChroma;
  if (uGlitch.x > 0.0){
    float a = uGlitch.x, sd = uGlitch.w, bh = max(uGlitch.y, 0.002);
    vec2 cell = vec2(floor(uv.x / (bh*3.0*uRes.y/uRes.x)), floor(uv.y / bh));
    float row = hh(vec2(cell.y, sd*1.37+3.1));
    float on = step(row, a*0.55);                                  // whole band shifts
    float blk = hh(cell + sd*7.31); float onb = step(blk, a*0.25); // individual blocks shift harder
    float dx = (hh(vec2(cell.y, sd+11.7))-0.5)*0.16*a*on + (hh(cell+sd*2.9+5.0)-0.5)*0.3*a*onb;
    float ln = floor(uv.y*uRes.y*0.5); dx += (hh(vec2(ln, sd*3.3+1.0))-0.5)*0.012*a*step(hh(vec2(ln*0.37, sd+9.0)), a*0.35); // scanline jitter
    uv.x += dx;
    split.x += uGlitch.z*a*0.018*(on+onb+0.25)*sign(hh(vec2(cell.y, sd+21.0))-0.5+1e-4);
    inv = step(hh(cell+sd*5.13+17.0), a*0.02);                   // rare inverted blocks
  }
  vec3 c = (split.x != 0.0 || split.y != 0.0) ? tap(uv, split) : texture2D(tDiffuse, uv).rgb;
  if (inv > 0.0) c = vec3(1.0) - clamp(c, 0.0, 1.0);
  if (uBloom.x > 0.0) c += texture2D(tBloom, uv).rgb*uBloom.x;
  if (uGrade.w > 0.0){
    vec3 g = pow(max(c, 0.0), vec3(1.0/2.2));
    float l = dot(g, vec3(0.2126,0.7152,0.0722));
    g = mix(vec3(l), g, uGrade.x); g = (g-0.5)*uGrade.y+0.5; g *= uGrade.z;
    c = pow(max(g, 0.0), vec3(2.2));
  }
  if (uTint.w > 0.0) c = mix(c, c*uTint.rgb*1.6, uTint.w);
  if (uLeakN > 0.0){                                              // X4b: additive soft radial light leaks
    for (int i = 0; i < 4; i++){ if (float(i) >= uLeakN) break;
      vec4 L = uLeakP[i]; vec2 d = (suv - L.xy)*vec2(uRes.x/uRes.y, 1.0)/max(L.z, 1e-3);
      float f = exp(-dot(d, d)*2.2); c += uLeakC[i]*L.w*f*(0.75 + 0.25*f); }
  }
  if (uTrack.x > 0.0){                                            // band: bright noisy streaks + slight wash
    vec2 pq = floor(suv*uRes*vec2(0.25, 0.5)); float n = hq(pq, uTrack.w + 7.0);
    float st = step(1.0 - 0.18*trw*min(uTrack.x, 1.5), hq(vec2(floor(pq.y), floor(pq.x*0.12)), uTrack.w + 13.0));
    float l = dot(c, vec3(0.2126,0.7152,0.0722)); c = mix(c, vec3(l), 0.45*trw*min(uTrack.x, 1.0));
    c += (vec3(n*n)*0.35*trw + st*0.8*n)*min(uTrack.x, 1.0);
  }
  if (uNoise.x > 0.0){ float n = hq(floor(suv*uRes), uNoise.y); c = mix(c, vec3(n*n), clamp(uNoise.x, 0.0, 1.0)); }
  if (uScan.x > 0.0){ float s = 0.5+0.5*sin((suv.y*uScan.y + uScan.z)*6.2831853); c *= 1.0 - uScan.x*0.55*(1.0-s); }
  if (uFlash.w > 0.0) c += uFlash.rgb*uFlash.w;
  if (uBarrel > 0.0) c *= edge;
  gl_FragColor = vec4(c,1.0);
  #include <colorspace_fragment>
}`;

// X4b bloom: bright pass (2x2 box downsample into a half-res RT) + separable 9-tap gaussian
const bloomBrightFrag = /* glsl */`
uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uThresh; varying vec2 vUv;
vec3 bp(vec2 o){ vec3 c = texture2D(tDiffuse, vUv + o*uTexel).rgb; float l = max(max(c.r, c.g), c.b); return c*max(l - uThresh, 0.0)/max(l, 1e-4); }
void main(){ gl_FragColor = vec4(0.25*(bp(vec2(-0.5,-0.5)) + bp(vec2(0.5,-0.5)) + bp(vec2(-0.5,0.5)) + bp(vec2(0.5,0.5))), 1.0); }`;
const bloomBlurFrag = /* glsl */`
uniform sampler2D tDiffuse; uniform vec2 uStep; varying vec2 vUv;
void main(){ vec3 s = texture2D(tDiffuse, vUv).rgb*0.2270270;
  s += (texture2D(tDiffuse, vUv + uStep*1.3846154).rgb + texture2D(tDiffuse, vUv - uStep*1.3846154).rgb)*0.3162162;
  s += (texture2D(tDiffuse, vUv + uStep*3.2307692).rgb + texture2D(tDiffuse, vUv - uStep*3.2307692).rgb)*0.0702703;
  gl_FragColor = vec4(s, 1.0); }`;

// normalise a template `post` object into uniform values; returns null when every effect is off
function normTplPost(P) {
  if (!P) return null;
  const num = (v) => (typeof v === 'number' ? v : v && typeof v === 'object' ? (v.amount ?? v.amt ?? 0) : 0);
  const o = { chroma: 0, glitch: [0, 0.04, 0.6, 0], scan: [0, 140, 0], flash: [1, 1, 1, 0], tint: [1, 1, 1, 0], grade: [1, 1, 1, 0] };
  let any = false;
  const ch = num(P.chroma); if (ch > 0) { o.chroma = ch; any = true; }
  const gl = P.glitch; const ga = num(gl); if (ga > 0) { o.glitch = [ga, gl.block ?? 0.04, gl.rgb ?? 0.6, gl.seed ?? 0]; any = true; }
  const sc = P.scan; const sa = num(sc); if (sa > 0) { o.scan = [sa, (sc && sc.lines) ?? 140, (sc && sc.roll) ?? 0]; any = true; }
  const fl = P.flash; const fa = num(fl); if (fa > 0) { const c = new THREE.Color((fl && fl.color) || '#ffffff'); o.flash = [c.r, c.g, c.b, fa]; any = true; }
  const ti = P.tint; if (ti) { const col = typeof ti === 'string' ? ti : Array.isArray(ti) ? ti[0] : ti.color; const ta = typeof ti === 'string' ? 1 : Array.isArray(ti) ? (ti[1] ?? 1) : num(ti) || (ti.amount === undefined && ti.amt === undefined ? 1 : 0);
    if (col && ta > 0) { const c = new THREE.Color(col); o.tint = [c.r, c.g, c.b, ta]; any = true; } }
  const gr = P.grade; if (gr) { const v = [gr.sat ?? 1, gr.contrast ?? 1, gr.bright ?? 1]; if (v[0] !== 1 || v[1] !== 1 || v[2] !== 1) { o.grade = [...v, 1]; any = true; } }
  // X4b
  o.bloom = [0, 0.7, 0.02]; o.barrel = 0; o.track = [0, 0.5, 0.08, 0]; o.noise = [0, 0]; o.leak = [];
  const bl = P.bloom; const ba = num(bl); if (ba > 0) { o.bloom = [ba, (bl && bl.threshold) ?? 0.7, (bl && bl.radius) ?? 0.02]; any = true; }
  const br = num(P.barrel); if (br > 0) { o.barrel = br; any = true; }
  const tr = P.tracking; const tra = num(tr); if (tra > 0) { const y = (tr && (tr.pos ?? tr.y)) ?? 0.5; o.track = [tra, y, (tr && tr.h) ?? 0.08, (tr && tr.seed) ?? Math.floor(y * 997)]; any = true; }
  const nz = P.noise; const na = num(nz); if (na > 0) { o.noise = [na, (nz && nz.seed) ?? 0]; any = true; }
  if (P.leak) for (const L of (Array.isArray(P.leak) ? P.leak : [P.leak])) {
    if (!L || o.leak.length >= 4) continue; const a = L.a ?? L.amount ?? 0; if (!(a > 0)) continue;
    let x = L.x, y = L.y; if (x === undefined || y === undefined) { const ang = L.angle ?? 0, ps = L.pos ?? 0.5; x = 0.5 + Math.cos(ang) * (ps - 0.5) * 1.6; y = 0.5 + Math.sin(ang) * (ps - 0.5) * 1.6; }
    const c = new THREE.Color(L.color || '#ff8a3c'); o.leak.push([x, y, L.r ?? 0.6, a, c.r, c.g, c.b]); any = true;
  }
  return any ? o : null;
}

// ---------- X3b particle shaders (one THREE.Points per group; SHAPE define: 0 dot, 1 bokeh, 2 spark) ----------
// X3c: optional defines MEDIA (colour *= media texture at per-particle aUV) and FOG (camera fog); absent = exact X3b shader.
const partVert = /* glsl */`
attribute float aSize; attribute float aOpacity; attribute float aAngle; attribute vec3 aColor;
uniform float uProj; // pixels per world unit at view depth 1 (H/2 * P[1][1])
varying vec3 vColor; varying float vOpacity; varying float vAngle;
#ifdef MEDIA
attribute vec2 aUV; uniform sampler2D uMedia; uniform float uMediaLod;
#endif
#ifdef FOG
varying float vFogD;
#endif
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float z = -mv.z; float px = aSize * uProj / max(z, 1e-4);
  vColor = aColor; vAngle = aAngle;
#ifdef MEDIA
  vColor *= textureLod(uMedia, aUV, uMediaLod).rgb;
#endif
#ifdef FOG
  vFogD = z;
#endif
  vOpacity = aOpacity * clamp(px * px / 2.25, 0.0, 1.0); // sub-pixel points fade instead of flickering
  gl_PointSize = (z <= 1e-4 || aOpacity <= 0.0) ? 0.0 : max(px, 1.5);
}`;
const partFogGlsl = /* glsl */`
#ifdef FOG
uniform vec3 uFogColor; uniform vec2 uFogRange; varying float vFogD;
float fogF(){ return clamp((vFogD - uFogRange.x) / max(uFogRange.y - uFogRange.x, 1e-5), 0.0, 1.0); }
#endif
`;
// FOG: additive groups fade out with depth; normal-blend groups mix toward the fog colour (like cards)
const partFogApply = /* glsl */`
#ifdef FOG
#if ADD == 1
  oc.a *= 1.0 - fogF();
#else
  oc.rgb = mix(oc.rgb, uFogColor, fogF());
#endif
#endif
`;
const partFrag = /* glsl */`
varying vec3 vColor; varying float vOpacity; varying float vAngle;${partFogGlsl}
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0; q.y = -q.y; float r = length(q); float a;
#if SHAPE == 1
  a = (1.0 - smoothstep(0.86, 1.0, r)) * (0.5 + 0.5 * smoothstep(0.55, 0.93, r)); // bokeh: disc, brighter rim, soft edge
#elif SHAPE == 2
  float c = cos(vAngle), s = sin(vAngle); vec2 w = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
  float st = max(exp(-abs(w.y) * 16.0) * (1.0 - abs(w.x)), exp(-abs(w.x) * 16.0) * (1.0 - abs(w.y))); // spark: 4-point star
  a = clamp(st + exp(-r * r * 14.0), 0.0, 1.0) * (1.0 - smoothstep(0.9, 1.0, r));
#else
  a = 1.0 - smoothstep(0.3, 1.0, r); a *= a; // dot: soft disc
#endif
  if (a * vOpacity < 0.002) discard;
#ifdef FOG
  vec4 oc = vec4(vColor, a * vOpacity);${partFogApply}
  gl_FragColor = oc;
#else
  gl_FragColor = vec4(vColor, a * vOpacity);
#endif
  #include <colorspace_fragment>
}`;
// ---------- X3c instanced particle shaders (one InstancedMesh-style draw per group; SHAPE: 3 quad, 4 streak, 5 petal) ----------
// Unit plane per instance, billboarded in view space, rotated by aAngle (+ spin tumble for petal/quad), streak stretched by aLen.
const instVert = /* glsl */`
attribute vec3 aPos; attribute float aSize; attribute float aOpacity; attribute float aAngle; attribute float aLen; attribute float aSpin; attribute vec3 aColor;
uniform float uProj;
varying vec3 vColor; varying float vOpacity; varying vec2 vQ; varying float vLen; varying float vShade;
#ifdef MEDIA
attribute vec2 aUV; uniform sampler2D uMedia; uniform float uMediaLod;
#endif
#ifdef FOG
varying float vFogD;
#endif
void main(){
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  float z = -mv.z; float px = aSize * uProj / max(z, 1e-4);
  float sz = aSize * max(1.0, 1.5 / max(px, 1e-4));                 // never thinner than 1.5 px; alpha fades instead
  float L = (SHAPE == 4) ? max(aLen, 1.0) : 1.0;
  float tumble = (SHAPE == 4) ? 1.0 : cos(aSpin);                   // spin: tumble around the long axis (petal/quad)
  vShade = (SHAPE == 4) ? 1.0 : 0.72 + 0.28 * abs(tumble);
  vec2 lp = position.xy * 2.0;                                       // -1..1
  vec2 off = vec2(lp.x * L, lp.y * max(abs(tumble), 0.12)) * sz * 0.5;
  float c = cos(aAngle), s = sin(aAngle);
  mv.xy += vec2(c * off.x - s * off.y, s * off.x + c * off.y);
  gl_Position = projectionMatrix * mv;
  vQ = lp; vLen = L; vColor = aColor;
#ifdef MEDIA
  vColor *= textureLod(uMedia, aUV, uMediaLod).rgb;
#endif
#ifdef FOG
  vFogD = z;
#endif
  vOpacity = (z <= 1e-4) ? 0.0 : aOpacity * clamp(px * px / 2.25, 0.0, 1.0);
}`;
const instFrag = /* glsl */`
varying vec3 vColor; varying float vOpacity; varying vec2 vQ; varying float vLen; varying float vShade;${partFogGlsl}
void main(){
  vec2 q = vQ; float a; vec3 col = vColor * vShade;
#if SHAPE == 4
  // streak: soft capsule along +x (head), radius 1 in size units, fading tail towards -x
  vec2 p = vec2(q.x * vLen, q.y); float d = length(vec2(max(abs(p.x) - (vLen - 1.0), 0.0), p.y));
  float body = 1.0 - smoothstep(0.25, 1.0, d);
  float t = clamp((p.x + vLen) / (2.0 * vLen), 0.0, 1.0);          // 0 tail .. 1 head
  a = body * body * t * t; col *= 1.0 + 0.6 * exp(-d * d * 8.0) * t;
#elif SHAPE == 5
  // petal: teardrop along x (round end -x, point +x) with a soft edge and centre vein shading
  float x = q.x; float hw = 0.62 * (1.0 - x) * sqrt(max(1.0 - x * x, 0.0));
  float e = abs(q.y) - hw; a = 1.0 - smoothstep(-0.1, 0.02, e);
  a *= smoothstep(-1.0, -0.9, x);
  col *= 0.82 + 0.18 * clamp(1.0 - abs(q.y) / max(hw, 1e-3), 0.0, 1.0);
#else
  // quad: soft-edged square (confetti / pixels)
  float m = max(abs(q.x), abs(q.y)); a = 1.0 - smoothstep(0.82, 1.0, m);
#endif
  if (a * vOpacity < 0.002) discard;
  vec4 oc = vec4(col, a * vOpacity);${partFogApply}
  gl_FragColor = oc;
  #include <colorspace_fragment>
}`;
const PART_SHAPES = { dot: 0, bokeh: 1, spark: 2, quad: 3, streak: 4, petal: 5 }; const PART_MAX = 6000;
const accFrag = /* glsl */`uniform sampler2D tDiffuse; uniform float uW; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tDiffuse,vUv).rgb*uW, 1.0);} `;
const quadVert = /* glsl */`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0);} `;

function hex(c){ return new THREE.Color(c || '#000'); }

// X5 / X10 card FX tables
const FX_MIXMODES = { fade: 0, crossfade: 0, dissolve: 1, luma: 2, displace: 3, blocks: 4, ripple: 5, swirl: 6 };
//                 fade  dissolve luma displace blocks ripple swirl
const FX_MIX_AMT = [0, 0, 0, 0.12, 0.08, 0.03, 2.5];
const FX_MIX_EDGE = [0, 0.08, 0.15, 0, 0, 4, 0];
const FX_MIX_SCALE = [0, 5, 0, 3, 10, 0, 0];
const FX_DISP = { wave: 0, ripple: 1, swirl: 2, noise: 3, heat: 4 };
const FX_DISP_FREQ = [3, 4, 1.4, 3, 6];
const FX_SHAPES = { circle: 0, diamond: 1, hexagon: 2, hex: 2, star: 3, heart: 4, plus: 5, cross: 5, square: 6, rect: 6 };
// shape size per unit "radius" so p=1 covers the card = 1 / inscribed radius of the SDF at r=1 (+ small margin):
// circle/diamond/hex/square 1, star(rf .45) 1/0.45=2.22, heart 1/0.707=1.41, plus 1/0.509=1.96
const FX_SHAPE_K = [1, 1, 1, 2.3, 1.45, 2.05, 1];
function fxUniforms() {
  const v2 = (a = 0, b = 0) => ({ value: new THREE.Vector2(a, b) }), v3 = (a = 0, b = 0, c = 0) => ({ value: new THREE.Vector3(a, b, c) }), v4 = (a = 0, b = 0, c = 0, d = 0) => ({ value: new THREE.Vector4(a, b, c, d) });
  return { uMap2: { value: null }, uCover2: v2(1, 1), uCoverOff2: v2(), uMix: v4(), uMix2: v4(0.5, 0.5, 5, 0), uMixC: v4(1, 1, 1, 0), uDis: v4(), uDisC: v4(1, 1, 1, 0),
    uDisp: v4(), uDispC: v2(0.5, 0.5), uPix: { value: 0 }, uRgb: v2(), uDirB: v2(), uRadB: v3(0, 0.5, 0.5), uFoil: { value: 0 }, uDuoA: v3(), uDuoB: v3(1, 1, 1), uDuoAmt: { value: 1 },
    uTint: v4(1, 1, 1, 0), uSmear: v4(0, 0, 0.06, 0.15), uScan: v3(0, 140, 0), uBarrel: { value: 0 }, uShape: v4(), uShape2: v4(0.5, 0.5, 0, 0), uShapeC: v3(1, 1, 1), uFade: v4(Math.PI / 2, 0, 1, 0) };
}

// ---------- X1 glyph atlas helpers ----------
const GLYPH_CAP = 128;    // atlas raster: cap height in px
const GLYPH_R = 16;       // SDF spread in px (outline up to 2R/CAP = 0.25 of cap height)
const GLYPH_ATLAS = 2048; // atlas page size (R8)
export const WM_FONTS = { inter: false, sc: false };
// register vendored fonts (call once before configure). 'Inter' resolves to the vendored variable Inter as family 'WM Inter',
// so existing canvas overlays (which name 'Inter' literally) keep their old fallback rendering.
export async function loadFonts(base = new URL('./vendor/fonts/', import.meta.url)) {
  if (typeof FontFace === 'undefined') return WM_FONTS;
  const reg = async (key, fam, file) => { if (WM_FONTS[key]) return;
    try { const ff = new FontFace(fam, `url(${new URL(file, base)})`, { weight: '100 900' }); await ff.load(); document.fonts.add(ff); WM_FONTS[key] = true; }
    catch (e) { console.warn(`[wm] ${fam} not loaded, falling back to system fonts`, e && e.message); } };
  // X8: vendored variable Noto Sans SC (GB2312 subset, wght 100-900) = real bold CJK for glyph cards (fallback after Inter)
  await Promise.all([reg('inter', 'WM Inter', 'InterVariable.ttf'), reg('sc', 'WM Noto Sans SC', 'NotoSansSC-GB2312-VF.ttf')]);
  return WM_FONTS;
}
const _INF = 1e20;
function _edt1d(grid, off, stride, len, f, v, z) {
  v[0] = 0; z[0] = -_INF; z[1] = _INF; for (let q = 0; q < len; q++) f[q] = grid[off + q * stride];
  for (let q = 1, k = 0, s = 0; q < len; q++) {
    do { const r = v[k]; s = (f[q] - f[r] + q * q - r * r) / (q - r) / 2; } while (s <= z[k] && --k > -1);
    k++; v[k] = q; z[k] = s; z[k + 1] = _INF;
  }
  for (let q = 0, k = 0; q < len; q++) { while (z[k + 1] < q) k++; const r = v[k]; grid[off + q * stride] = f[r] + (q - r) * (q - r); }
}
function _edt(grid, w, h, f, v, z) { for (let x = 0; x < w; x++) _edt1d(grid, x, w, h, f, v, z); for (let y = 0; y < h; y++) _edt1d(grid, y * w, 1, w, f, v, z); }
// RGBA (white text on transparent) -> R8 signed distance field, 0.5 at the contour, + inside, spread R px (TinySDF-style subpixel init)
function glyphSDF(rgba, w, h, R, SS = 1) {
  const n = w * h, go = new Float32Array(n), gi = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = rgba[i * 4 + 3] / 255;
    if (a >= 1) { go[i] = 0; gi[i] = _INF; } else if (a <= 0) { go[i] = _INF; gi[i] = 0; }
    else { const d = 0.5 - a; go[i] = d > 0 ? d * d : 0; gi[i] = d < 0 ? d * d : 0; } }
  const m = Math.max(w, h), f = new Float64Array(m), v = new Uint16Array(m), z = new Float64Array(m + 1);
  _edt(go, w, h, f, v, z); _edt(gi, w, h, f, v, z);
  const ow = w / SS, oh = h / SS, out = new Uint8Array(ow * oh), inv = 1 / (SS * SS * SS); // distance in hi-res px / SS = atlas px
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    let acc = 0; for (let yy = 0; yy < SS; yy++) { const row = (y * SS + yy) * w + x * SS; for (let xx = 0; xx < SS; xx++) acc += Math.sqrt(go[row + xx]) - Math.sqrt(gi[row + xx]); }
    const d = acc * inv; out[y * ow + x] = Math.max(0, Math.min(255, Math.round(255 * (0.5 - d / (2 * R))))); }
  return out;
}

export const RATIOS = { '16:9': [16, 9], '4:3': [4, 3], '1:1': [1, 1], '4:5': [4, 5], '3:4': [3, 4], '9:16': [9, 16], '21:9': [21, 9], '2:3': [2, 3], '3:2': [3, 2] };
// v10.2 每个模板的换形方式（实测得出，见 docs/adapt.md）。没列出的 = 'area'
export const ADAPT_MAP = {'focus-slider': 'fit', 'mosaic-marquee': 'fit', 'bento-reshuffle': 'fit', 'column-drift': 'fit', 'flip-grid': 'fit', 'grid-reveal': 'fit', 'spotlight-zoom': 'fit', 'ticker-loop': 'fit', 'ticker-tilt': 'fit', 'glow-sweep-grid': 'fit', 'grid-dive': 'fit', 'lens-orbit': 'fit', 'spread-columns': 'fit', 'spread-rows': 'fit', 'triple-scene': 'fit', 'pop-grid': 'fit', 'wheel-spin-bottom': 'fit', 'feed-scroll': 'fit', 'planet-rings': 'ratio', 'pop-parade': 'fit', 'stairway': 'fit', 'hero-reel': 'fit', 'whip-pan': 'fit', 'focus-shift': 'fit', 'fan-shuffle': 'fit'}; // 排得很紧的网格 / 跑马灯：缩进原卡片框，换形后不重叠
const CARD_RATIOS = { 'auto': null, '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16, '3:2': 1.5, '2:3': 2 / 3 };

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
    this.bgScene = new THREE.Scene(); this.ovScene = new THREE.Scene();
    this.ovCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -10, 10);
    this.flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.media = []; // {tex, w, h, video}
    this.pool = []; this.shadowPool = [];
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.shadowGroup = new THREE.Group(); this.scene.add(this.shadowGroup);
    this.geo = new THREE.PlaneGeometry(1, 1, 48, 24);
    this.geoCurl = new THREE.PlaneGeometry(1, 1, 96, 96); // X6: curled cards swap to this high-res plane
    this.bgMat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: bgFrag, depthWrite: false, depthTest: false,
      uniforms: { uType: { value: 0 }, uC1: { value: hex('#0e0e12') }, uC2: { value: hex('#1b1b24') }, uC3: { value: hex('#0e0e12') }, uAngle: { value: Math.PI / 2 }, uRadial: { value: 0 }, uMap: { value: null }, uCover: { value: new THREE.Vector2(1, 1) }, uDim: { value: 1 }, uTime: { value: 0 }, uAnim: { value: 0 } } });
    this.bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMat); this.bgScene.add(this.bgMesh);
    this.overlays = [];
    this.spec = {};
  }

  async loadMedia(urls) {
    const loader = new THREE.TextureLoader();
    this.media = await Promise.all(urls.map(async (u) => {
      const isVid = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
      if (isVid) {
        const v = document.createElement('video'); v.src = u; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
        await new Promise((r, j) => { v.onloadeddata = r; v.onerror = j; });
        const tex = new THREE.VideoTexture(v); tex.colorSpace = THREE.SRGBColorSpace;
        return { tex, w: v.videoWidth, h: v.videoHeight, video: v };
      }
      const tex = await loader.loadAsync(u); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
      return { tex, w: tex.image.width, h: tex.image.height };
    }));
    if (!this.media.length) this.media = [this.placeholder(0)];
  }
  placeholder(i) {
    const c = document.createElement('canvas'); c.width = 800; c.height = 600; const g = c.getContext('2d');
    const hues = [220, 260, 300, 340, 20, 160, 190, 40];
    const gr = g.createLinearGradient(0, 0, 800, 600); gr.addColorStop(0, `hsl(${hues[i % 8]},60%,55%)`); gr.addColorStop(1, `hsl(${hues[i % 8] + 40},60%,25%)`);
    g.fillStyle = gr; g.fillRect(0, 0, 800, 600); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return { tex, w: 800, h: 600, placeholder: true };
  }

  setSize(w, h) { this.W = w; this.H = h; this.renderer.setSize(w, h, false); this.aspect = w / h;
    this.rtA = new THREE.WebGLRenderTarget(w, h, { samples: 4, type: THREE.HalfFloatType }); this.rtAcc = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    if (this.postMat) this.postMat.uniforms.uRes.value.set(w, h);
  }

  configure(spec, template) {
    this.spec = spec; this.tpl = template;
    this._focus = null; // v10.2 焦点：spec.focus = [[x,y] | null, ...]（0..1，按素材顺序；0.5,0.5 = 居中）
    if (Array.isArray(spec.focus) && spec.focus.some((f) => Array.isArray(f))) this._focus = spec.focus.map((f) => (Array.isArray(f) && f.length >= 2 ? [Math.min(1, Math.max(0, +f[0])), Math.min(1, Math.max(0, +f[1]))] : null));
    const p = {};
    for (const [k, d] of Object.entries(template.params || {})) p[k] = d.default;
    Object.assign(p, normParams(spec.params || {}, template.params || {}));
    this.baseParams = p;
    const bg = spec.background || {};
    const u = this.bgMat.uniforms;
    u.uType.value = { color: 0, gradient: 1, image: 2, aurora: 3 }[bg.type || 'color'] ?? 0;
    u.uC1.value = hex(bg.color || (bg.colors && bg.colors[0]) || template.background || '#0d0d11');
    u.uC2.value = hex((bg.colors && bg.colors[1]) || bg.color || '#1a1a22');
    u.uC3.value = hex((bg.colors && (bg.colors[2] || bg.colors[0])) || bg.color || '#0d0d11');
    u.uAngle.value = ((bg.angle ?? 90) * Math.PI) / 180; u.uRadial.value = bg.radial ? 1 : 0; u.uAnim.value = bg.animate ? 1 : 0;
    u.uDim.value = bg.dim ?? 1;
    if (u.uType.value === 2 && this.bgTex) { const ia = this.bgTex.image.width / this.bgTex.image.height; const a = this.aspect; u.uMap.value = this.bgTex; u.uCover.value.set(ia > a ? a / ia : 1, ia > a ? 1 : ia / a); }
    const fx = spec.fx || {};
    this.fx = { motionBlur: fx.motionBlur ?? 0, shutter: fx.shutter ?? 0.5, grain: fx.grain ?? 0, vignette: fx.vignette ?? 0, aberration: fx.aberration ?? 0 };
    if (!this.postMat) {
      this.postMat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: postFrag, depthTest: false, depthWrite: false,
        uniforms: { tDiffuse: { value: null }, uGrain: { value: 0 }, uVig: { value: 0 }, uSeed: { value: 0 }, uAb: { value: 0 }, uRes: { value: new THREE.Vector2(this.W, this.H) } } });
      this.postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat); this.postScene = new THREE.Scene(); this.postScene.add(this.postQuad);
      this.accMat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: accFrag, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, uniforms: { tDiffuse: { value: null }, uW: { value: 1 } } });
      this.accScene = new THREE.Scene(); this.accScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.accMat));
    }
    if (template.setup) template.setup(this.makeCtx(0));
    this.tl = timelineInfo(spec, spec.duration || 16, template.id); // v10 timeline (speed + intro)
  }

  async setBackgroundImage(url) { if (!url) return; this.bgTex = await new THREE.TextureLoader().loadAsync(url); this.bgTex.colorSpace = THREE.SRGBColorSpace; }

  // evaluate keyframed params at time t (seconds)
  paramsAt(t) {
    const p = { ...this.baseParams };
    const kf = this.spec.keyframes || {};
    for (const [k, frames] of Object.entries(kf)) {
      if (!frames || !frames.length) continue;
      const fs = [...frames].sort((a, b) => a[0] - b[0]);
      if (t <= fs[0][0]) { p[k] = fs[0][1]; continue; }
      if (t >= fs[fs.length - 1][0]) { p[k] = fs[fs.length - 1][1]; continue; }
      for (let i = 0; i < fs.length - 1; i++) if (t >= fs[i][0] && t <= fs[i + 1][0]) {
        const a = fs[i], b = fs[i + 1]; const ease = E[a[2] || 'inOutCubic'] || E.inOutCubic; const f = ease((t - a[0]) / (b[0] - a[0]));
        p[k] = (typeof a[1] === 'number') ? a[1] + (b[1] - a[1]) * f : (f < 0.5 ? a[1] : b[1]);
      }
    }
    return p;
  }

  makeCtx(t) {
    const spec = this.spec; const dur = spec.duration || 16;
    const u = ((t / dur) % 1 + 1) % 1;
    const p = this.paramsAt(t);
    const n = Math.max(1, spec.count || this.media.length);
    const pad = (p.padding ?? spec.padding ?? 6) / 100;
    const view = { w: this.aspect, h: 1 }; // world size of the frame at z=0
    const inner = { w: this.aspect * (1 - pad * 2), h: 1 - pad * 2 };
    const crKey = spec.cardRatio || p.cardRatio || 'auto';
    if (crKey === 'media') this._mR = mainRatio(this.media); // v10.2: 跟随素材 = 本批主比例
    const ratioOf = (i) => {
      if (crKey === 'media') { if (spec.cardMix === 'own') { const m = this.media[i % this.media.length]; return m && !m.placeholder ? m.w / m.h : this._mR; } return this._mR; }
      const r = CARD_RATIOS[crKey];
      if (r) return r; const m = this.media[i % this.media.length]; return m ? m.w / m.h : 4 / 3;
    };
    // X0: title text. spec.text[0].content wins; fallback = the template's `text` param. Templates with usesTitle animate it themselves.
    const tx0 = spec.text ? (Array.isArray(spec.text) ? spec.text[0] : spec.text) : null;
    const title = String((tx0 && tx0.content != null && tx0.content !== '') ? tx0.content : (p.text ?? ''));
    const words = title.split(/\s+/).filter(Boolean);
    const adaptMode = crKey === 'media' ? (this.tpl.adapt || ADAPT_MAP[this.tpl.id] || 'area') : null; // v10.2
    return { t, u, dur, p, n, view, inner, aspect: this.aspect, ratioOf, adaptMode, media: this.media, M, E, spec, pad, isPortrait: this.aspect < 1, title, words, titleSpec: tx0 || null,
      glyphs: (str, o) => this.glyphs(str, o), device: (type, o) => deviceInfo(type, o) }; // X2: device geometry (lib.js deviceInfo) // X1: synchronous glyph metrics (browser canvas, cached);
  }

  getCard(i) {
    if (!this.pool[i]) {
      const mat = new THREE.ShaderMaterial({ vertexShader: cardVert, fragmentShader: cardFrag, transparent: true, side: THREE.DoubleSide, extensions: { derivatives: true },
        uniforms: { uMap: { value: null }, uHasMap: { value: 0 }, uColor: { value: new THREE.Color('#888') }, uSize: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 0.02 }, uOpacity: { value: 1 }, uBright: { value: 1 },
          uUvRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uCover: { value: new THREE.Vector2(1, 1) }, uCoverOff: { value: new THREE.Vector2(0, 0) }, uMirrorBack: { value: 1 }, uBend: { value: 0 }, uBendX: { value: 0 },
          uMask: { value: new THREE.Vector4(0, 0, 0, 0) }, uMask2: { value: new THREE.Vector4(0, 0, 1, 1) }, uBorder: { value: 0 }, uBorderColor: { value: new THREE.Color('#fff') }, uSheen: { value: 0 }, uSat: { value: 1 }, uBlurLod: { value: 0 }, uRim: { value: 0 }, uEdge: { value: new THREE.Vector4(0, 0, 0, 0.004) }, uShear: { value: 0 },
          uLight: { value: new THREE.Vector4(0, 0, 0.7, 0.25) }, uLight2: { value: new THREE.Vector4(0.6, 0.35, 1, 0) }, uStopC: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(1, 1, 1, 1)) }, uStopP: { value: [0, 1, 1, 1] }, uStopN: { value: 0 }, uPremul: { value: 0 }, ...fxUniforms(),
          uGlyph: { value: null }, uGRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uGPar: { value: new THREE.Vector4(0, 0, 0, 0) }, uGOff: { value: new THREE.Vector2(0, 0) }, uGScreen: { value: new THREE.Vector4(0, 0, 1, 1) }, uGRes: { value: new THREE.Vector2(1, 1) },
          uFogColor: { value: new THREE.Color(0, 0, 0) }, uFogRange: { value: new THREE.Vector2(1, 10) },
          uClip: { value: new THREE.Vector4(0, 0, 1, 1) }, uClipR: { value: 0 }, uDeco: { value: new THREE.Vector4(0.012, 0, 0, 0) },
          uCurl: { value: new THREE.Vector4(-1, 0, -1, 0.05) }, uCurl2: { value: new THREE.Vector4(0, 1, 1, 1) }, uCurlB: { value: new THREE.Vector4(0.9, 0.88, 0.84, 1) }, uCurlT: { value: new THREE.Vector4(1, 1, 1, 0) },
          uCurlMap: { value: null }, uCurlCov: { value: new THREE.Vector4(1, 1, 0, 0) } } }); // X6
      const m = new THREE.Mesh(this.geo, mat); m.frustumCulled = false; m.userData.fxKey = ''; this.group.add(m); this.pool[i] = m;
    }
    return this.pool[i];
  }
  getShadow(i) {
    if (!this.shadowPool[i]) {
      const mat = new THREE.ShaderMaterial({ vertexShader: shadowVert, fragmentShader: shadowFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uSize: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 0.02 }, uSoft: { value: 0.03 }, uOpacity: { value: 0.5 } } });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.frustumCulled = false; this.shadowGroup.add(m); this.shadowPool[i] = m;
    }
    return this.shadowPool[i];
  }

  // X7: light-card uniforms. L = { type, stops:[[pos,'#hex',alpha]...] | color, angle, r, width, fade, spread, falloff }
  applyLight(U, L) {
    if (!L) { U.uLight.value.x = 0; return; }
    const type = { radial: 1, linear: 2, beam: 3, ring: 4, streak: 5 }[L.type || 'radial'] || 1;
    const defAngle = type === 3 ? -Math.PI / 2 : 0;
    U.uLight.value.set(type, L.angle ?? defAngle, L.r ?? 0.7, L.width ?? 0.3);
    U.uLight2.value.set(L.fade ?? 0.6, L.spread ?? 0.35, L.falloff ?? 1, 0);
    let stops = L.stops;
    if (!stops || !stops.length) { const col = L.color || '#ffffff'; stops = type === 2 ? [[0, col, 1], [1, col, 0]] : [[0, col, 1], [1, col, 0]]; }
    stops = stops.slice(0, 4).map((s) => (Array.isArray(s) ? s : [s.pos ?? s.p ?? 0, s.color ?? '#fff', s.alpha ?? s.a ?? 1])).sort((a, b) => a[0] - b[0]);
    const tmp = this._lc || (this._lc = new THREE.Color());
    for (let k = 0; k < 4; k++) { const s = stops[Math.min(k, stops.length - 1)]; tmp.set(s[1] ?? '#fff'); U.uStopC.value[k].set(tmp.r, tmp.g, tmp.b, s[2] ?? 1); U.uStopP.value[k] = s[0] ?? 0; }
    U.uStopN.value = stops.length;
  }
  // X7: per-card blend mode. 'normal' (default) | 'add' | 'screen' | 'multiply'
  applyBlend(mat, U, mode) {
    if (mode === 'add') { mat.blending = THREE.AdditiveBlending; U.uPremul.value = 0; }
    else if (mode === 'screen') { mat.blending = THREE.CustomBlending; mat.blendEquation = THREE.AddEquation; mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneMinusSrcColorFactor; U.uPremul.value = 1; }
    else if (mode === 'multiply') { mat.blending = THREE.CustomBlending; mat.blendEquation = THREE.AddEquation; mat.blendSrc = THREE.DstColorFactor; mat.blendDst = THREE.ZeroFactor; U.uPremul.value = 2; }
    else { mat.blending = THREE.NormalBlending; U.uPremul.value = 0; }
  }
  // X7: world rect {x,y,z,w,h} covering the whole frame on the plane at depth z (for leaks/flashes); assumes a plane facing +z
  fullFrame(z = 0, margin = 1.04) {
    const cam = this.camera; const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    const tHalf = Math.tan((cam.fov * Math.PI) / 360);
    let cx = cam.position.x, cy = cam.position.y, d = Math.abs(cam.position.z - z);
    if (Math.abs(fwd.z) > 1e-3) { const k = (z - cam.position.z) / fwd.z; if (k > 0) { cx += fwd.x * k; cy += fwd.y * k; d = k; } }
    const tilt = 1 / Math.max(0.35, Math.abs(fwd.z)); // oblique cameras see a stretched footprint
    const h = 2 * tHalf * d * margin * tilt;
    return { x: cx, y: cy, z, w: h * this.aspect, h };
  }

  // X6 page curl. c.curl = { p|amount 0..1, angle (travel direction of the fold, card-local, default PI = peel from the right edge leftwards),
  //   radius (world, default 12% of the short side), axisOffset, back: 'paper'|'mirror'|'media2'|'#hex', media, paper, backTint, shade, sheen, shadow }
  // returns the peeled arc length (0 = flat, card renders like a plain card except for the high-res mesh)
  applyCurl(m, U, c, W, H, fullA) {
    const cu = c.curl; const a = cu.angle ?? Math.PI, dx = Math.cos(a), dy = Math.sin(a);
    const E = Math.abs(dx) * W / 2 + Math.abs(dy) * H / 2; const r = Math.max(1e-4, cu.radius ?? 0.12 * Math.min(W, H));
    const pp = cu.p ?? cu.amount ?? 0;
    const f = -E + pp * (2 * E + Math.PI * r) + (cu.axisOffset ?? 0); const peel = Math.max(0, f + E);
    U.uCurl.value.set(dx, dy, f, r);
    U.uCurl2.value.set(Math.max(0, peel - Math.PI * r), cu.shade ?? 1, cu.sheen ?? 1, (cu.shadow ?? 1) * M.clamp(peel / (r * 0.8)));
    const col = this._cuc || (this._cuc = new THREE.Color());
    let back = cu.back ?? 'paper'; let mode = 1;
    if (back === 'mirror') mode = 0; else if (back === 'media2' || back === 'media') mode = 2;
    else { col.set(back === 'paper' ? (cu.paper ?? '#f2eee6') : back); U.uCurlB.value.set(col.r, col.g, col.b, 1); }
    if (mode !== 1) U.uCurlB.value.w = mode;
    if (mode === 2) { const n = this.media.length; const bi = cu.media ?? c.media2 ?? ((c.media ?? 0) + 1); const md2 = this.media[((bi % n) + n) % n]; const ma2 = md2.w / md2.h;
      U.uCurlMap.value = md2.tex; if (ma2 > fullA) U.uCurlCov.value.set(fullA / ma2, 1, 0, 0); else U.uCurlCov.value.set(1, ma2 / fullA, 0, 0); }
    else if (!U.uCurlMap.value) U.uCurlMap.value = U.uMap.value || this.media[0]?.tex || null;
    const bt = cu.backTint; if (bt) { const t = typeof bt === 'string' ? [bt, 0.35] : bt; col.set(t[0]); U.uCurlT.value.set(col.r, col.g, col.b, t[1] ?? 0.35); } else U.uCurlT.value.w = 0;
    if (m.geometry !== this.geoCurl) m.geometry = this.geoCurl;
    return peel;
  }

  // X5 card FX / X10 fade mask: each effect is a shader #define, so a card without effects runs the exact classic shader.
  applyFx(m, U, c, hasMap2, W, H, gd = null) {
    const d = {}; const col = this._fxc || (this._fxc = new THREE.Color());
    const amtOf = (v, k = 'amt') => (v == null || v === false ? 0 : typeof v === 'number' ? v : (v[k] ?? 0));
    if (hasMap2) {
      const mode = FX_MIXMODES[c.mixMode || 'fade'] ?? 0; const o = c.mixOpts || {};
      d.FX_MAP2 = 1; d.FX_MIXMODE = mode;
      U.uMix.value.set(c.mix, o.amt ?? FX_MIX_AMT[mode], o.edge ?? o.freq ?? FX_MIX_EDGE[mode], o.seed ?? 0);
      U.uMix2.value.set(o.cx ?? 0.5, o.cy ?? 0.5, o.scale ?? FX_MIX_SCALE[mode], 0);
      if (o.edgeColor) { col.set(o.edgeColor); U.uMixC.value.set(col.r, col.g, col.b, o.glow ?? 1); } else U.uMixC.value.w = 0;
    }
    const ds = c.dissolve; if (ds && (ds.p ?? 0) > 0) {
      d.FX_DISSOLVE = 1; U.uDis.value.set(ds.p, ds.scale ?? 5, ds.edge ?? 0.08, ds.seed ?? 0);
      if (ds.edgeColor) { col.set(ds.edgeColor); U.uDisC.value.set(col.r, col.g, col.b, ds.glow ?? 1); } else U.uDisC.value.w = 0;
    }
    const dp = c.displace; if (dp && (dp.amp ?? 0) !== 0) {
      const ty = FX_DISP[dp.type || 'wave'] ?? 0; d.FX_DISPLACE = ty;
      U.uDisp.value.set(dp.amp, dp.freq ?? FX_DISP_FREQ[ty], dp.phase ?? 0, 0); U.uDispC.value.set(dp.cx ?? 0.5, dp.cy ?? 0.5);
    }
    if ((c.pixelate ?? 0) > 0) { d.FX_PIX = 1; U.uPix.value = c.pixelate; }
    const rg = amtOf(c.rgbSplit); if (rg) { d.FX_RGB = 1; U.uRgb.value.set(rg, c.rgbSplit.angle ?? 0); }
    const db = amtOf(c.dirBlur); if (db) { d.FX_DIRBLUR = 1; U.uDirB.value.set(db, c.dirBlur.angle ?? 0); }
    const rb = amtOf(c.radialBlur); if (rb) { d.FX_RADBLUR = 1; U.uRadB.value.set(rb, c.radialBlur.cx ?? 0.5, c.radialBlur.cy ?? 0.5); }
    if ((c.foil ?? 0) > 0) { d.FX_FOIL = 1; U.uFoil.value = c.foil; }
    const du = c.duotone; if (du) {
      const a = Array.isArray(du) ? du : [du.dark, du.light, du.amt];
      if ((a[2] ?? 1) > 0) { d.FX_DUO = 1; col.set(a[0] || '#000'); U.uDuoA.value.set(col.r, col.g, col.b); col.set(a[1] || '#fff'); U.uDuoB.value.set(col.r, col.g, col.b); U.uDuoAmt.value = a[2] ?? 1; }
    }
    const ti = c.tint; if (ti) {
      const a = typeof ti === 'string' ? [ti, 1] : Array.isArray(ti) ? ti : [ti.color, ti.amt];
      if ((a[1] ?? 1) > 0) { d.FX_TINT = 1; col.set(a[0] || '#fff'); U.uTint.value.set(col.r, col.g, col.b, a[1] ?? 1); }
    }
    const sm = c.smear; if (sm && (sm.amt ?? 0) > 0) { d.FX_SMEAR = 1; U.uSmear.value.set(sm.amt, sm.seed ?? 0, sm.block ?? 0.06, sm.scale ?? 0.15); }
    const sc = amtOf(c.scan); if (sc) { d.FX_SCAN = 1; U.uScan.value.set(sc, c.scan.lines ?? 140, c.scan.roll ?? 0); }
    if (c.barrel) { d.FX_BARREL = 1; U.uBarrel.value = c.barrel; }
    const sh = c.shapeMask; if (sh && (sh.invert ? (sh.p ?? 0) > 0 : (sh.p ?? 0) < 1)) {
      const st = FX_SHAPES[sh.shape || 'circle'] ?? 0; d.FX_SHAPE = st;
      const cx = sh.cx ?? 0.5, cy = sh.cy ?? 0.5, M = Math.max(W, H), ax = (W / M) * 2, ay = (H / M) * 2;
      let R = 0; for (const ux of [0, 1]) for (const uy of [0, 1]) R = Math.max(R, Math.hypot((ux - cx) * ax, (uy - cy) * ay));
      const soft = sh.soft ?? 0.004; const pp = sh.p ?? 0;
      U.uShape.value.set(pp <= 0 ? -1 : pp * (R * FX_SHAPE_K[st] * 1.02 + soft + (sh.outline ?? 0)), sh.rot ?? 0, soft, sh.outline ?? 0);
      U.uShape2.value.set(cx, cy, sh.invert ? 1 : 0, 0); col.set(sh.outlineColor || '#ffffff'); U.uShapeC.value.set(col.r, col.g, col.b);
    }
    const fd = c.fade || (c.mask && c.mask.type === 'fade' ? c.mask : null); if (fd) {
      const from = fd.from ?? 0; let to = fd.to ?? 1; if (Math.abs(to - from) < 1e-4) to = from + 1e-4;
      d.FX_FADE = 1; U.uFade.value.set(fd.angle ?? Math.PI / 2, from, to, 0);
    }
    let key = ''; for (const k in d) key += k + '=' + d[k] + ';';
    if (key) d.FX_ON = 1;
    if (gd) for (const k in gd) { d[k] = gd[k]; key += k + '=' + gd[k] + ';'; } // X1 glyph defines (no FX_ON)
    if (this._fog) { d.FOG = 1; key += 'FOG;'; U.uFogColor.value.copy(this._fog.color); U.uFogRange.value.set(this._fog.near, this._fog.far); } // X8 (no FX_ON)
    if (m.userData.fxKey !== key) { m.material.defines = d; m.material.needsUpdate = true; m.userData.fxKey = key; }
  }

  // ---------- X1 glyph text: font metrics + SDF atlas ----------
  // Font stack: the requested family first ('Inter' -> the vendored variable Inter, registered as 'WM Inter'), then CJK fallbacks.
  fontStack(font) {
    const f = String(font || 'Inter'); const fam = (f === 'Inter' && WM_FONTS.inter) ? 'WM Inter' : ((f === 'Noto Sans SC' || f === 'Noto Sans CJK SC') && WM_FONTS.sc) ? 'WM Noto Sans SC' : f;
    const q = (n) => (/^(serif|sans-serif|monospace|system-ui|cursive)$/.test(n) ? n : '"' + n.replace(/"/g, '') + '"');
    const tail = ['WM Inter', 'WM Noto Sans SC', 'Noto Sans CJK SC', 'Noto Sans SC', 'WenQuanYi Zen Hei', 'Liberation Sans', 'DejaVu Sans', 'sans-serif'].filter((n) => n !== fam && (n !== 'WM Inter' || WM_FONTS.inter) && (n !== 'WM Noto Sans SC' || WM_FONTS.sc));
    return [fam, ...tail].map(q).join(', ');
  }
  glyphCtx() { if (!this._g2d) { const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 512; this._g2d = cv.getContext('2d', { willReadFrequently: true }); } return this._g2d; }
  // per (font, weight): font px so that the cap height ('H') is GLYPH_CAP px
  fontInfo(font, weight) {
    const key = (font || 'Inter') + '|' + (weight ?? 700); this._fonts ||= {};
    if (this._fonts[key]) return this._fonts[key];
    const g = this.glyphCtx(); const stack = this.fontStack(font); g.font = `${weight ?? 700} 200px ${stack}`;
    const cap200 = g.measureText('H').actualBoundingBoxAscent || 145;
    const px = (GLYPH_CAP * 200) / cap200;
    return (this._fonts[key] = { key, stack, px, css: `${weight ?? 700} ${px.toFixed(3)}px ${stack}` });
  }
  // ctx.glyphs: pure metrics (synchronous canvas measureText, cached). World units; block centred on (0,0); y = cap middle of the line.
  glyphs(str, o = {}) {
    const h = o.h ?? 0.1, tr = o.tracking ?? 0, align = o.align || 'center', lineH = o.lineH ?? 1.6, maxW = o.maxW ?? Infinity;
    const ck = JSON.stringify([String(str ?? ''), o.font || 'Inter', o.weight ?? 700, h, tr, align, lineH, maxW === Infinity ? 0 : maxW]);
    this._gm ||= new Map(); const hit = this._gm.get(ck); if (hit) return hit;
    const F = this.fontInfo(o.font, o.weight); const g = this.glyphCtx(); g.font = F.css; g.fontKerning = 'normal';
    const k = h / GLYPH_CAP; const mw = (t) => g.measureText(t).width;
    const lineW = (t) => mw(t) * k + tr * h * Math.max(0, Array.from(t).length - 1);
    const lines = [];
    for (const para of String(str ?? '').split('\n')) {
      const ws = para.split(/ +/); let cur = '';
      for (const wd of ws) { const nx = cur ? cur + ' ' + wd : wd; if (cur && lineW(nx) > maxW) { lines.push(cur); cur = wd; } else cur = nx; }
      lines.push(cur);
    }
    const L = lines.length, lh = lineH * h; const widths = lines.map(lineW); const blockW = Math.max(0, ...widths);
    const glyphs = [], words = [];
    lines.forEach((ln, li) => {
      const y = ((L - 1) / 2) * lh - li * lh;
      const x0 = align === 'left' ? -blockW / 2 : align === 'right' ? blockW / 2 - widths[li] : -widths[li] / 2;
      const chars = Array.from(ln); let pre = '', wStart = null, wText = '';
      const flushWord = (endX) => { if (wText) words.push({ text: wText, x: (wStart + endX) / 2, y, w: endX - wStart, i: words.length, line: li }); wText = ''; wStart = null; };
      chars.forEach((ch, ci) => {
        const pen = x0 + mw(pre) * k + tr * h * ci;
        if (/\s/.test(ch)) flushWord(pen - (ci ? tr * h : 0));
        else { const adv = mw(ch) * k; if (wStart == null) wStart = pen; wText += ch;
          glyphs.push({ ch, x: pen + adv / 2, y, w: adv, i: glyphs.length, line: li, word: words.length, col: ci }); }
        pre += ch;
      });
      flushWord(x0 + widths[li]);
    });
    const res = { glyphs, words, width: blockW, height: (L - 1) * lh + h, lines: L, h, font: o.font || 'Inter', weight: o.weight ?? 700 };
    this._gm.set(ck, res); return res;
  }
  // rasterise one text entry (a glyph or a whole word) into the SDF atlas; cached by font|weight|text
  glyphEntry(text, font, weight) {
    const F = this.fontInfo(font, weight); const key = F.key + '|' + text; this._ge ||= new Map();
    const hit = this._ge.get(key); if (hit) return hit;
    const g = this.glyphCtx(); g.font = F.css; g.fontKerning = 'normal';
    const mt = g.measureText(text); const R = GLYPH_R, P = R + 2;
    const bl = Math.ceil(Math.max(mt.actualBoundingBoxLeft, 0)), br = Math.ceil(Math.max(mt.actualBoundingBoxRight, 1));
    const asc = Math.ceil(Math.max(mt.actualBoundingBoxAscent, 1)), desc = Math.ceil(Math.max(mt.actualBoundingBoxDescent, 0));
    const cw = Math.min(GLYPH_ATLAS, bl + br + P * 2), chh = Math.min(GLYPH_ATLAS, asc + desc + P * 2);
    // supersampled raster (SS x) -> exact-ish distances -> box-downsampled to atlas px: removes the contour wobble of a 1x SDF
    const SS = cw * chh > 160000 ? 2 : 4, W2 = cw * SS, H2 = chh * SS;
    if (g.canvas.width < W2 || g.canvas.height < H2) { g.canvas.width = Math.max(g.canvas.width, W2); g.canvas.height = Math.max(g.canvas.height, H2); }
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W2, H2); g.setTransform(SS, 0, 0, SS, 0, 0);
    g.font = F.css; g.fontKerning = 'normal'; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillText(text, P + bl, P + asc);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const img = g.getImageData(0, 0, W2, H2).data;
    const sdf = glyphSDF(img, W2, H2, R, SS);
    // place: shelf packing on a 32-px grid (identical mip phase wherever a glyph lands -> order-independent pixels)
    const A = GLYPH_ATLAS, aw = Math.ceil(cw / 32) * 32, ah = Math.ceil(chh / 32) * 32;
    this._gp ||= [];
    let pg = this._gp[this._gp.length - 1];
    const newPage = () => { const data = new Uint8Array(A * A); const tex = new THREE.DataTexture(data, A, A, THREE.RedFormat, THREE.UnsignedByteType);
      tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.anisotropy = 8; tex.unpackAlignment = 1;
      const p = { data, tex, x: 0, y: 0, rowH: 0 }; this._gp.push(p); return p; };
    if (!pg) pg = newPage();
    if (pg.x + aw > A) { pg.x = 0; pg.y += pg.rowH; pg.rowH = 0; }
    if (pg.y + ah > A) { pg = newPage(); }
    const X = pg.x, Y = pg.y; pg.x += aw; pg.rowH = Math.max(pg.rowH, ah);
    for (let r = 0; r < chh; r++) { const dst = (Y + chh - 1 - r) * A + X; pg.data.set(sdf.subarray(r * cw, r * cw + cw), dst); } // atlas row 0 = v 0 = bottom
    pg.tex.needsUpdate = true;
    const adv = mt.width;
    // box in pen coords (px, y up): x0 = -(P+bl), y top = P+asc. Anchor = (adv/2, cap/2).
    const x0 = -(P + bl), yTop = P + asc;
    const e = { tex: pg.tex, uv: [X / A, Y / A, (X + cw) / A, (Y + chh) / A], wpx: cw, hpx: chh, cx: x0 + cw / 2 - adv / 2, cy: yTop - chh / 2 - GLYPH_CAP / 2, adv };
    this._ge.set(key, e); return e;
  }
  // card geometry for a glyph card: world size of the (uv sub-rect of the) padded glyph box + offset from the anchor
  glyphCard(c) {
    const e = this.glyphEntry(String(c.text), c.font, c.weight); const cap = c.h ?? 0.1; const k = cap / GLYPH_CAP;
    const u = c.uv || [0, 0, 1, 1]; const fw = u[2] - u[0], fh = u[3] - u[1];
    const ox = (e.cx + e.wpx * ((u[0] + u[2]) / 2 - 0.5)) * k, oy = (e.cy + e.hpx * ((u[1] + u[3]) / 2 - 0.5)) * k;
    return { tex: e.tex, uv: e.uv, w: e.wpx * fw * k, h: e.hpx * fh * k, offX: ox, offY: oy, sd: 2 * GLYPH_R * k, cap, adv: e.adv * k, pad: (GLYPH_R + 2) * k };
  }

  layoutFrame(t, P = null) {
    const ctx = this.makeCtx(t);
    const p = ctx.p; const tpl = this.tpl;
    // camera
    const cam = Object.assign({ fov: null, perspective: p.perspective ?? 18, x: 0, y: 0, z: null, lookX: 0, lookY: 0, lookZ: 0, roll: 0 }, tpl.camera ? tpl.camera(ctx) : {});
    const fov = cam.fov ?? (6 + (cam.perspective) * 1.6); // perspective% -> fov degrees
    this.camera.fov = fov; this.camera.aspect = this.aspect;
    const dist = 0.5 / Math.tan((fov * Math.PI) / 360);
    this.camera.position.set(cam.x, cam.y, cam.z ?? dist);
    if (cam.rollAxis === 'view') { this.camera.up.set(0, 1, 0); this.camera.lookAt(cam.lookX, cam.lookY, cam.lookZ); if (cam.roll) this.camera.rotateZ(-cam.roll); } // X8: roll about the view axis (path cameras)
    else { this.camera.up.set(Math.sin(cam.roll), Math.cos(cam.roll), 0);
    this.camera.lookAt(cam.lookX, cam.lookY, cam.lookZ); }
    // X8 fog: { color (default = background colour), near, far } in view depth; null/absent = off (classic shaders)
    const fg = cam.fog; if (fg && (fg.far ?? 0) > (fg.near ?? 0)) { this._fogC ||= new THREE.Color();
      if (fg.color) this._fogC.set(fg.color); else this._fogC.copy(this.bgMat.uniforms.uC1.value);
      this._fog = { color: this._fogC, near: fg.near ?? 0, far: fg.far }; this._fogMW = false; } else this._fog = null;
    this.camera.near = 0.01; this.camera.far = 400; this.camera.updateProjectionMatrix();
    ctx.camDist = dist;
    ctx.fullFrame = (z = 0, margin = 1.04) => this.fullFrame(z, margin);
    const _lo = tpl.layout(ctx) || []; // X3b: layout may return { cards, particles } (array still accepted)
    let cards = Array.isArray(_lo) ? _lo : (_lo.cards || []); let particles = Array.isArray(_lo) ? null : _lo.particles;
    if ((this.spec.cardRatio || p.cardRatio) === 'media' && this.media.length) { // v10.2 自适应（其余情况不经过这里）
      const md = this.media; cards = adaptCards(cards, ctx, { R: this._mR, mode: ctx.adaptMode || 'area', fit: this.spec.fit || 'blur', fitColor: this.spec.fitColor,
        mixed: this.spec.cardMix === 'own', ratioOfMedia: (i) => { const m = md[((i % md.length) + md.length) % md.length]; return m && !m.placeholder ? m.w / m.h : this._mR; } }); }
    let _fxA = 1; // v10 intro layer (P = intro progress on the frozen start pose; null = untouched v9 path)
    if (P != null) { this.camera.updateMatrixWorld(); const r = applyIntro(cards, P, this.tl.intro, this.camera, THREE); cards = r.cards; _fxA = r.fxA; if (particles) particles = scaleParticles(particles, _fxA); }
    this._introFx = _fxA; this._rawCards = Array.isArray(_lo) ? _lo : (_lo.cards || []);
    this._hasGrp = false; cards = this.expandDevices(cards, ctx); // X2: device cards -> body + screen + details (no-op without devices)
    if (this.slabPool) for (const S of this.slabPool) if (S) { S.walls.visible = false; S.cap.visible = false; S.capM.visible = false; S.on = false; S.gN = 0; if (S.glayers) for (const o of S.glayers) o.visible = false; } // X9
    this._tplPost = normTplPost((!Array.isArray(_lo) && _lo.post) || (tpl.post ? tpl.post(ctx) : null)); // X4a
    if (_fxA < 1 && this._tplPost) this._tplPost = scalePost(this._tplPost, _fxA);
    const gRadius = (p.cornerRadius ?? this.spec.cornerRadius ?? 3) / 100; // fraction of card min side
    const shadowOn = this.spec.shadow ?? p.shadow ?? tpl.shadow ?? true;
    const sheen = this.spec.sheen ?? p.sheen ?? tpl.sheen ?? 0;
    let i = 0;
    for (; i < cards.length; i++) {
      const c = cards[i]; const m = this.getCard(i); const U = m.material.uniforms;
      if (c.hidden || (c.opacity ?? 1) <= 0.001) { m.visible = false; this.getShadow(i).visible = false; continue; }
      m.visible = true;
      const L = c.light || null; // X7 light card
      const G = (c.text != null && c.text !== '') ? this.glyphCard(c) : null; // X1 glyph text card (w/h = padded glyph box)
      const w = G ? G.w : (c.w ?? 0.3), h = G ? G.h : (c.h ?? (L ? w : w / ctx.ratioOf(c.media ?? i)));
      m.position.set(c.x || 0, c.y || 0, c.z || 0);
      m.rotation.set(c.rx || 0, c.ry || 0, c.rz || 0, c.order || 'YXZ');
      const s = c.s ?? 1; m.scale.set(1, c.mirrorY ? -1 : 1, 1); // X10: mirrorY = reflected copy (true mirror of the whole card)
      U.uSize.value.set(w * s, h * s);
      if (c.radiusW != null) U.uRadius.value = c.radiusW * s; else // X2/X9: absolute corner radius (world units)
      { const rOld = (c.radius ?? gRadius) * Math.min(w, h) * s * (c.radiusMul ?? 1) * 3.2;
        // animos corner radius is frame-relative (~1.7% of frame short side at 3%). Cap large cards to that; small cards keep the card-relative value.
        const rFrame = (c.radius ?? gRadius) * 0.8 * Math.min(this.aspect, 1) * s;
        U.uRadius.value = ((L || G) && c.radius == null) ? 0 : (c.radiusMul != null || c.radius != null || tpl.radiusMode === 'card') ? rOld : Math.min(rOld, rFrame); }
      U.uOpacity.value = c.opacity ?? 1; U.uBright.value = c.bright ?? 1;
      // bend expressed in card-local units; geometry is unit plane scaled -> convert
      U.uBend.value = (c.bend || 0); U.uBendX.value = (c.bendX || 0); U.uShear.value = c.shear || 0;
      // X5: media2 + mix. mix<=0 -> media only, mix>=1 -> media2 only (both zero-cost); in between the card blends the two
      const flat = !!L || (G ? c.mediaFill == null : !!(c.color && !c.useMedia)); const mixV = c.mix ?? 0;
      const useM2 = c.media2 != null && !flat && mixV > 0 && mixV < 1;
      const mi = (((c.media2 != null && !flat && mixV >= 1) ? c.media2 : (G ? (c.mediaFill ?? 0) : (c.media ?? i))) % this.media.length + this.media.length) % this.media.length;
      const md = this.media[mi];
      this.applyLight(U, L);
      this.applyBlend(m.material, U, c.blend ?? (L ? 'add' : 'normal'));
      if (L) { U.uHasMap.value = 0; }
      else if (G ? c.mediaFill == null : (c.color && !c.useMedia)) { U.uHasMap.value = 0; U.uColor.value.set(G ? (c.color ?? '#ffffff') : c.color); }
      else { U.uHasMap.value = 1; U.uMap.value = md.tex; }
      const uvr = c.uv || [0, 0, 1, 1]; U.uUvRect.value.set(uvr[0], uvr[1], uvr[2], uvr[3]);
      // cover-fit: card region aspect vs media aspect
      const regA = (w / h) * ((uvr[3] - uvr[1]) / (uvr[2] - uvr[0])) * 1; // aspect of full virtual card
      const fullA = c.fullAspect ?? (w / h) / ((uvr[2] - uvr[0]) / (uvr[3] - uvr[1]));
      const ma = md.w / md.h;
      if (ma > fullA) U.uCover.value.set(fullA / ma, 1); else U.uCover.value.set(1, ma / fullA);
      if (c.zoom) U.uCover.value.multiplyScalar(1 / c.zoom);
      U.uCoverOff.value.set(c.panX || 0, c.panY || 0);
      if (this._focus && c.panX == null && c.panY == null) { const f = this._focus[mi]; if (f) U.uCoverOff.value.set((f[0] - 0.5) * Math.max(0, 1 - U.uCover.value.x), (0.5 - f[1]) * Math.max(0, 1 - U.uCover.value.y)); } // v10.2 焦点
      if (useM2) { const md2 = this.media[((c.media2 % this.media.length) + this.media.length) % this.media.length]; const ma2 = md2.w / md2.h; U.uMap2.value = md2.tex;
        if (ma2 > fullA) U.uCover2.value.set(fullA / ma2, 1); else U.uCover2.value.set(1, ma2 / fullA);
        const z2 = c.zoom2 ?? c.zoom; if (z2) U.uCover2.value.multiplyScalar(1 / z2);
        U.uCoverOff2.value.set(c.panX2 ?? c.panX ?? 0, c.panY2 ?? c.panY ?? 0); }
      let gd = null;
      if (G) { // X1: atlas page + rect, SDF scale, anchor offset; mediaFill 'screen' (default) cover-fits the media to a frame rect
        const s2 = s; U.uGlyph.value = G.tex; U.uGRect.value.set(...G.uv); U.uGOff.value.set(G.offX * s2, G.offY * s2);
        U.uGPar.value.set(G.sd * s2, Math.max(0, c.outline || 0) * G.cap * s2, 0, 0); U.uGRes.value.set(this.W, this.H);
        gd = { GLYPH: 1 };
        if (c.mediaFill != null && (c.fillUv ?? 'screen') === 'screen') {
          gd.GLYPH_SCREEN = 1; const r = c.fillRect || [0, 0, 1, 1]; U.uGScreen.value.set(r[0], 1 - r[3], r[2], 1 - r[1]);
          const ra = ((r[2] - r[0]) * this.W) / Math.max(1e-6, (r[3] - r[1]) * this.H);
          if (ma > ra) U.uCover.value.set(ra / ma, 1); else U.uCover.value.set(1, ma / ra);
          if (c.zoom) U.uCover.value.multiplyScalar(1 / c.zoom);
        }
      }
      if (c._clip) { const k = c._clip; U.uClip.value.set(k[0] - (G ? G.offX * s : 0), k[1] - (G ? G.offY * s : 0), k[2], k[3]); U.uClipR.value = k[4] ?? 0; (gd ||= {}).CLIP = 1; } // X2 screen clip
      if (c._deco) { U.uDeco.value.x = c._decoKey ?? 0.012; (gd ||= {}).DECO = 1; } // X2 laptop deck
      U.uMirrorBack.value = c.mirrorBack === false ? 0 : (c.mirrorBack === 'unmirror' ? -1 : 1);
      const curlPeel = (!L && c.curl) ? this.applyCurl(m, U, c, w * s, h * s, fullA) : -1; // X6 page curl (-1 = no curl)
      if (curlPeel >= 0) { (gd ||= {}).CURL = 1; U.uMirrorBack.value = 1; } else if (m.geometry !== this.geo) m.geometry = this.geo;
      const mk = c.mask; if (mk) { U.uMask.value.set({ line: 1, circle: 2, rect: 3 }[mk.type] || 0, mk.angle ?? 0, mk.p ?? mk.r ?? 0, mk.soft ?? 0.002); U.uMask2.value.set(...(mk.rect || [mk.cx ?? 0.5, mk.cy ?? 0.5, 1, 1])); } else U.uMask.value.set(0, 0, 0, 0);
      this.applyFx(m, U, c, useM2, w * s, h * s, gd);
      U.uBorder.value = (c.border && !G) ? c.border * Math.min(w, h) : 0; if (c.borderColor) U.uBorderColor.value.set(c.borderColor);
      U.uSheen.value = c.sheen ?? sheen; U.uSat.value = c.sat ?? 1; U.uRim.value = G ? 0 : (c.rim ?? tpl.rim ?? 0); U.uBlurLod.value = c.blur ?? 0;
      if (G) U.uEdge.value.set(0, 0, 0, 0.004); else U.uEdge.value.set(c.edgeX ?? tpl.edgeX ?? 0, c.edgeTop ?? tpl.edgeTop ?? 0, c.edgeBottom ?? tpl.edgeBottom ?? 0, c.edgeW ?? tpl.edgeW ?? 0.004);
      m.renderOrder = c.order2 ?? (c.layer ?? 0) * 1000 + ((c._grp ? c._grp.z : c.z) || 0) * 10; // X2: device parts use the body's z
      m.material.depthWrite = L ? (c.depthWrite ?? false) : (c.depthWrite ?? (curlPeel > 0 ? true : (tpl.depthWrite ?? false))); // X6: a curled card self-occludes
      m.material.depthTest = (c.depthTest ?? tpl.depthTest ?? true);
      m.userData.grp = c._grp || null; m.userData.sub = c._sub || 0; // X2: device parts sort as one unit
      const thick = (!L && (c.thickness ?? 0) > 0) ? c.thickness : 0; // X9
      if (thick) this.updateSlab(i, m, c, U, w * s, h * s, s, G, thick);
      // shadow
      const sh = this.getShadow(i);
      const shOp = G ? 0 : (c.shadow ?? (L ? 0 : (shadowOn ? (tpl.shadowOpacity ?? 0.45) : 0))) * (c.opacity ?? 1);
      if (shOp > 0.001 && !c.bend && !c.bendX && !(curlPeel > 0)) {
        sh.visible = true; const soft = Math.min(w, h) * s * 0.12;
        sh.position.copy(m.position); sh.rotation.copy(m.rotation); sh.translateZ(-0.002 - thick); sh.translateY(-soft * 0.5);
        sh.scale.set(w * s + soft * 4, h * s + soft * 4, 1);
        sh.material.uniforms.uSize.value.set(w * s, h * s); sh.material.uniforms.uRadius.value = U.uRadius.value; sh.material.uniforms.uSoft.value = soft; sh.material.uniforms.uOpacity.value = shOp;
        if (this._fog) { if (!this._fogMW) { this.camera.updateMatrixWorld(); this._fogMW = true; } const vz = -(this._fogV ||= new THREE.Vector3()).copy(sh.position).applyMatrix4(this.camera.matrixWorldInverse).z;
          sh.material.uniforms.uOpacity.value = shOp * (1 - M.clamp((vz - this._fog.near) / Math.max(1e-5, this._fog.far - this._fog.near))); }
        sh.renderOrder = m.renderOrder - 0.5;
      } else sh.visible = false;
    }
    for (; i < this.pool.length; i++) { this.pool[i].visible = false; if (this.shadowPool[i]) this.shadowPool[i].visible = false; }
    // depth sort (painter) for transparent cards: farther first
    if (!(tpl.depthWrite)) {
      const v = new THREE.Vector3(); const camPos = this.camera.position;
      const vis = this.pool.filter((m) => m.visible);
      vis.forEach((m) => { if (m.userData.fixed) return; });
      const sorted = this._hasGrp
        ? vis.map((m, k) => ({ m, d: v.copy(m.userData.grp || m.position).distanceToSquared(camPos), ro: m.renderOrder, sb: m.userData.sub || 0 })).sort((a, b) => (Math.floor(a.ro / 1000) - Math.floor(b.ro / 1000)) || (b.d - a.d) || (a.sb - b.sb))
        : vis.map((m, k) => ({ m, d: v.copy(m.position).distanceToSquared(camPos), ro: m.renderOrder })).sort((a, b) => (Math.floor(a.ro / 1000) - Math.floor(b.ro / 1000)) || (b.d - a.d));
      sorted.forEach((o, k) => { o.m.renderOrder = k * 2 + 1; const idx = this.pool.indexOf(o.m); if (this.shadowPool[idx]) this.shadowPool[idx].renderOrder = k * 2; });
    }
    if (this.slabPool) this.orderSlabs(!tpl.depthWrite); // X9
    if (particles || this._parts) this.layoutParticles(ctx, particles || []);
    this.bgMat.uniforms.uTime.value = ctx.u;
    if (tpl.background && tpl.backgroundFn) tpl.backgroundFn(ctx, this.bgMat.uniforms);
    this.drawOverlays(ctx);
    return ctx;
  }


  // ---------- X9 slab thickness ----------
  getSlab(i) {
    if (!this.slabPool) { this.slabPool = []; this.slabGroup = new THREE.Group(); this.scene.add(this.slabGroup); this.slabGeo = slabGeometry(10); }
    if (!this.slabPool[i]) {
      const mk = (cap) => new THREE.ShaderMaterial({ vertexShader: slabVert, fragmentShader: slabFrag, defines: cap ? { CAP: 1 } : {}, transparent: true,
        side: cap ? THREE.DoubleSide : THREE.FrontSide, extensions: { derivatives: true },
        uniforms: { uSize: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 0 }, uDepth: { value: 0.01 }, uOff: { value: new THREE.Vector2() }, uBend: { value: 0 }, uBendX: { value: 0 }, uShear: { value: 0 },
          uColor: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 1 }, uMode: { value: 0 }, uMap: { value: null }, uUvRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uCover: { value: new THREE.Vector2(1, 1) },
          uCoverOff: { value: new THREE.Vector2() }, uLod: { value: 4 }, uShade: { value: new THREE.Vector4(0.6, 1, 0, 1) }, uFogColor: { value: new THREE.Color() }, uFogRange: { value: new THREE.Vector2(1, 10) } } });
      const walls = new THREE.Mesh(this.slabGeo, mk(false)), cap = new THREE.Mesh(this.geo, mk(true)), capM = new THREE.Mesh(this.geo, null);
      for (const o of [walls, cap, capM]) { o.frustumCulled = false; o.visible = false; this.slabGroup.add(o); }
      this.slabPool[i] = { walls, cap, capM, facing: true, on: false, fogKey: '' };
    }
    return this.slabPool[i];
  }
  // c.thickness (world) -> walls around the card outline from z=0 back to -thickness, plus the back cap (media / side colour / hex)
  updateSlab(i, m, c, U, W, H, s, G, th) {
    const S = this.getSlab(i); const { walls, cap, capM } = S; const wu = walls.material.uniforms, cu = cap.material.uniforms;
    let sw = W, sh = H, ox = 0, oy = 0, rad = U.uRadius.value;
    if (G) { const pd = G.pad * s; sw = Math.max(1e-4, W - 2 * pd); sh = Math.max(1e-4, H - 2 * pd); ox = G.offX * s; oy = G.offY * s; rad = c.radiusW != null ? c.radiusW * s : 0; }
    const media = U.uHasMap.value > 0.5 && !G; const sc = c.sideColor;
    let mode = 0, shade = c.sideShade ?? 0.6; const col = this._slc || (this._slc = new THREE.Color());
    if (sc && sc !== 'auto') { col.set(sc); shade = c.sideShade ?? 1; }
    else if (media) { mode = 1; col.setRGB(1, 1, 1); }
    else col.copy(U.uColor.value);
    const back = c.back ?? (media ? 'media' : 'side');
    if (G) return this.glyphStack(S, m, c, U, th, col, shade); // glyph slabs: extruded copies of the glyph (true silhouette)
    const fogKey = this._fog ? 'F' : '';
    if (S.fogKey !== fogKey) { for (const mt of [walls.material, cap.material]) { if (this._fog) mt.defines.FOG = 1; else delete mt.defines.FOG; mt.needsUpdate = true; } S.fogKey = fogKey; }
    for (const [mesh, uu, isCap] of [[walls, wu, false], [cap, cu, true]]) {
      if (isCap && back === 'media') continue;
      mesh.position.copy(m.position); mesh.rotation.copy(m.rotation); mesh.scale.copy(m.scale);
      uu.uSize.value.set(sw, sh); uu.uRadius.value = rad; uu.uDepth.value = th; uu.uOff.value.set(ox, oy);
      uu.uBend.value = U.uBend.value; uu.uBendX.value = U.uBendX.value; uu.uShear.value = U.uShear.value;
      let md = mode; uu.uColor.value.copy(col);
      if (isCap && back !== 'side') { md = 0; uu.uColor.value.set(back); }
      else if (isCap && md === 1) md = 2; // media-coloured cap = average colour of the image
      uu.uMode.value = md;
      if (md > 0) { uu.uMap.value = U.uMap.value; uu.uUvRect.value.copy(U.uUvRect.value); uu.uCover.value.copy(U.uCover.value); uu.uCoverOff.value.copy(U.uCoverOff.value); uu.uLod.value = c.sideBlur ?? 4; }
      uu.uShade.value.set(isCap && back !== 'side' && !(sc && sc !== 'auto') ? 1 : shade, c.sideLight ?? 1, c.sideSpec ?? 0, U.uBright.value);
      uu.uOpacity.value = U.uOpacity.value;
      if (this._fog) { uu.uFogColor.value.copy(this._fog.color); uu.uFogRange.value.set(this._fog.near, this._fog.far); }
      mesh.material.depthWrite = m.material.depthWrite; mesh.material.depthTest = m.material.depthTest;
    }
    // facing: is the front (+z) of the card towards the camera? (the hidden cap is skipped; walls are back-face culled)
    const n = (this._sln ||= new THREE.Vector3()).set(0, 0, 1).applyQuaternion(m.quaternion);
    const dv = (this._sld ||= new THREE.Vector3()).copy(this.camera.position).sub(m.position);
    S.facing = n.dot(dv) > 0; S.on = true; walls.visible = true;
    if (back === 'media') { capM.material = m.material; capM.position.copy(m.position); capM.rotation.copy(m.rotation); capM.scale.copy(m.scale); capM.translateZ(-th); capM.visible = !S.facing; }
    else cap.visible = !S.facing;
  }
  // X9 glyph thickness: N flat copies of the glyph (side colour) stacked from z=0 back to -th, all sharing one cloned glyph material
  glyphStack(S, m, c, U, th, col, shade) {
    if (!S.gmat) { S.gmat = m.material.clone(); S.glayers = []; S.gkey = ''; }
    const g = S.gmat, gu = g.uniforms;
    for (const k of ['uGlyph', 'uGRect', 'uGPar', 'uGOff', 'uSize', 'uRadius', 'uUvRect', 'uOpacity', 'uBend', 'uBendX', 'uShear', 'uMask', 'uMask2', 'uFogColor', 'uFogRange']) {
      const v = U[k].value; if (v && typeof v.copy === 'function' && !v.isTexture) gu[k].value.copy(v); else gu[k].value = v; }
    gu.uHasMap.value = 0; gu.uColor.value.copy(col).multiplyScalar(shade); gu.uBright.value = U.uBright.value; gu.uLight.value.x = 0; gu.uEdge.value.set(0, 0, 0, 0.004);
    gu.uRim.value = 0; gu.uSheen.value = 0; gu.uBorder.value = 0; gu.uSat.value = 1; gu.uMirrorBack.value = -1; gu.uPremul.value = 0; gu.uBlurLod.value = 0;
    const d = { GLYPH: 1 }; if (this._fog) d.FOG = 1; const key = this._fog ? 'GF' : 'G';
    if (S.gkey !== key) { g.defines = d; g.needsUpdate = true; S.gkey = key; }
    g.blending = THREE.NormalBlending; g.depthWrite = m.material.depthWrite; g.depthTest = m.material.depthTest;
    const N = Math.max(2, Math.min(48, Math.ceil(th * this.H * 1.5)));
    while (S.glayers.length < N) { const o = new THREE.Mesh(this.geo, g); o.frustumCulled = false; o.visible = false; this.slabGroup.add(o); S.glayers.push(o); }
    S.glayers.forEach((o, k) => { if (k >= N) { o.visible = false; return; } o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale); o.translateZ(-th * (k + 1) / N); o.visible = true; });
    S.gN = N;
    const n = (this._sln ||= new THREE.Vector3()).set(0, 0, 1).applyQuaternion(m.quaternion);
    const dv = (this._sld ||= new THREE.Vector3()).copy(this.camera.position).sub(m.position);
    S.facing = n.dot(dv) > 0; S.on = true;
  }
  // painter: walls just before their card when the front faces the camera; otherwise card, walls, back cap (convex slab = correct order)
  orderSlabs(painter) {
    for (let i = 0; i < this.slabPool.length; i++) { const S = this.slabPool[i]; if (!S || !S.on) continue;
      const ro = this.pool[i].renderOrder;
      if (S.gN) { for (let k = 0; k < S.gN; k++) { const f = (k + 1) / S.gN; S.glayers[k].renderOrder = !painter ? ro : S.facing ? ro - 0.05 - 0.4 * f : ro + 0.05 + 0.4 * f; } continue; }
      const capO = S.capM.visible ? S.capM : S.cap;
      if (!painter) { S.walls.renderOrder = ro; capO.renderOrder = ro; continue; }
      if (S.facing) S.walls.renderOrder = ro - 0.4; else { S.walls.renderOrder = ro + 0.3; capO.renderOrder = ro + 0.6; } }
  }

  // ---------- X2 device frames ----------
  // A card with `device` expands into ordinary cards (body slab, screen, island/notch, gloss, ...) that share the body's sort key.
  expandDevices(cards, ctx) {
    let any = false; for (const c of cards) if (c && c.device) { any = true; break; }
    if (!any) return cards;
    const out = []; for (const c of cards) { if (c && c.device) this.expandDevice(c, ctx, out); else out.push(c); }
    this._hasGrp = true; return out;
  }
  expandDevice(c, ctx, out) {
    const type = c.device; const I = deviceInfo(type, c); const s = c.s ?? 1;
    const u = (c.w ?? (c.h != null ? c.h * I.aspect : 0.3)) * s; // outer body width (laptop: lid width)
    const P = new THREE.Vector3(c.x || 0, c.y || 0, c.z || 0);
    const Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(c.rx || 0, c.ry || 0, c.rz || 0, c.order || 'YXZ'));
    const mir = !!c.mirrorY; const camP = this.camera.position; const op = c.opacity ?? 1; const br = c.bright ?? 1;
    const devCol = c.deviceColor ?? DEV_COLOR[type] ?? DEV_COLOR.phone;
    const frameCol = c.frameColor ?? ('#' + new THREE.Color(devCol).lerp(new THREE.Color('#a4a6ad'), type === 'crt' || type === 'laptop' ? 0 : 0.22).getHexString()); // metal band
    const zs = 0.002 * u; let sub = 0; const parts = [];
    const common = { layer: c.layer, opacity: op, depthWrite: c.depthWrite, depthTest: c.depthTest, mirrorY: c.mirrorY || undefined, _grp: P, shadow: 0 };
    // frame F = { c: Vector3 device-local centre, q: local Quaternion | null }
    const wq = (F) => { if (!F.q) return Q; const ql = F.q.clone(); if (mir) { ql.x = -ql.x; ql.z = -ql.z; } return Q.clone().multiply(ql); };
    const loc = (F, lx, ly, lz) => { const v = new THREE.Vector3(lx, ly, lz); if (F.q) v.applyQuaternion(F.q); v.add(F.c); if (mir) v.y = -v.y; return v.applyQuaternion(Q).add(P); };
    const faces = (F, nrm = [0, 0, 1]) => { const n = new THREE.Vector3(...nrm).applyQuaternion(wq(F)); const p = loc(F, 0, 0, 0); return n.dot(camP.clone().sub(p)) > 0; };
    const put = (F, lx, ly, lz, props) => { const p = loc(F, lx, ly, lz); let rot;
      if (F.q) { const e = new THREE.Euler().setFromQuaternion(wq(F), 'YXZ'); rot = { rx: e.x, ry: e.y, rz: e.z, order: 'YXZ' }; } else rot = { rx: c.rx || 0, ry: c.ry || 0, rz: c.rz || 0, order: c.order || 'YXZ' };
      const o = { ...common, ...props, x: p.x, y: p.y, z: p.z, ...rot }; parts.push(o); return o; };
    // vertical fade (reflections): re-map the body's fade range onto each part's own uv
    const fadeFor = (cy, ch, bh) => { const f = c.fade; if (!f) return undefined; if (Math.abs((f.angle ?? Math.PI / 2) - Math.PI / 2) > 1e-3 || !bh) return f;
      const v0 = (cy - ch / 2 + bh / 2) / bh; return { angle: Math.PI / 2, from: ((f.from ?? 0) - v0) * bh / ch, to: ((f.to ?? 1) - v0) * bh / ch }; };
    // screen + screen cards + gloss on a panel frame (body front at z=0 of the frame)
    const scrSrc = {}; for (const k in c) if (!DEV_PASS_SKIP.has(k)) scrSrc[k] = c[k];
    const panel = (F, dims, opt) => {
      const { bw, bh, R, sx, sy, sw, sh, sr } = dims; const front = faces(F); const hid = !front;
      const fb = opt.fadeH;
      if (c.screenCards) {
        put(F, sx, sy, zs, { color: c.screenColor ?? '#000000', useMedia: false, w: sw, h: sh, radiusW: sr, bright: br, hidden: hid, fade: fadeFor(sy, sh, fb), _clip: opt.clip ? [opt.clip[0] - sx, opt.clip[1] - sy, opt.clip[2], opt.clip[3], opt.clip[4]] : undefined });
        c.screenCards.forEach((q, k) => { if (!q) return;
          const lx = sx + (q.x || 0) * sw, ly = sy + (q.y || 0) * sh;
          const qw = (q.w ?? 1) * sw; const isText = q.text != null && q.text !== '';
          const qh = isText ? (q.h ?? 0.08) * sh : (q.h != null ? q.h * sh : (q.w == null ? sh : qw / ctx.ratioOf(q.media ?? k)));
          const full = Math.abs(qw - sw) < 1e-6 && Math.abs(qh - sh) < 1e-6 && !q.x && !q.y;
          const props = { ...q, w: qw, h: qh, opacity: op * (q.opacity ?? 1), bright: br * (q.bright ?? 1), hidden: hid || q.hidden, layer: c.layer, shadow: 0,
            _clip: [sx - lx, sy - ly, sw / 2, sh / 2, sr], fade: fadeFor(ly, qh, fb) };
          if (isText) delete props.w; else if (q.radius == null && q.radiusW == null && full) props.radiusW = sr;
          put(F, lx, ly, zs * (1.5 + k * 0.02), props); });
      } else {
        const sp = { ...scrSrc, ...(opt.screenDefaults || {}), ...(c.screenFx || {}), w: sw, h: sh, radiusW: opt.clip ? 0 : sr, bright: br * (c.screenBright ?? 1), hidden: hid, fade: fadeFor(sy, sh, fb) };
        if (opt.clip) sp._clip = [opt.clip[0] - sx, opt.clip[1] - sy, opt.clip[2], opt.clip[3], opt.clip[4]];
        if (sp.media == null) sp.media = 0;
        put(F, sx, sy, zs, sp);
      }
      for (const d of (opt.details || [])) put(F, d.x, d.y, zs * 2.5, { useMedia: false, hidden: hid, bright: br, ...d.p, fade: fadeFor(d.y, d.p.h, fb) });
      const gl = c.gloss ?? opt.gloss ?? 0.1;
      if (gl > 0 && !hid) { const gr = opt.glossRect || [0, 0, bw, bh, R]; const sweep = M.clamp((c.ry || 0) * 0.9 + (c.rx || 0) * 0.45, -1.2, 1.2) * gr[2] * 0.45;
        put(F, gr[0] - sweep, gr[1], zs * 3, { light: { type: 'linear', angle: c.glossAngle ?? -0.85, stops: [[0, '#ffffff', 0], [0.47, '#ffffff', 0.9], [0.56, '#ffffff', 0.32], [1, '#ffffff', 0]] },
          blend: 'add', w: gr[2] * 2.6, h: gr[3], opacity: op * gl, radiusW: 0, _clip: [sweep, 0, gr[2] / 2, gr[3] / 2, gr[4]], fade: fadeFor(gr[1], gr[3], fb) }); }
      return front;
    };
    const O = { c: new THREE.Vector3(0, 0, 0), q: null };
    if (type === 'laptop') {
      const lean = I.lean; const ql = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), lean);
      const qd = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      const DK = { c: new THREE.Vector3(0, I.deck.cy * u, I.deck.cz * u), q: qd };
      const LD = { c: new THREE.Vector3(0, I.lid.cy * u, I.lid.cz * u), q: ql };
      const bh = I.h * u, R = I.radius * u, lidD = (c.thickness ?? I.depth * u);
      const kl = (new THREE.Color(devCol).r + new THREE.Color(devCol).g + new THREE.Color(devCol).b) / 3;
      put(DK, 0, 0, 0, { color: devCol, useMedia: false, w: I.deck.w * u, h: I.deck.d * u, radiusW: R * 0.8, thickness: I.deck.t * u, sideColor: devCol, sideShade: 0.92, sideSpec: c.sideSpec ?? 0.5,
        back: devCol, shadow: c.shadow, bright: br, _deco: 'keys', _decoKey: kl > 0.3 ? 0.012 : 0.006 });
      put(LD, 0, 0, 0, { color: c.bezelColor ?? '#0a0a0c', useMedia: false, w: u, h: bh, radiusW: R, thickness: lidD, sideColor: devCol, sideShade: 0.95, sideSpec: c.sideSpec ?? 0.5, back: devCol, bright: br });
      const S = I.scr; const N = I.notch;
      panel(LD, { bw: u, bh, R, sx: S.cx * u, sy: S.cy * u, sw: S.w * u, sh: S.h * u, sr: S.r * u }, { fadeH: 0, gloss: 0.07,
        glossRect: [0, 0, u, bh, R],
        details: c.island === false ? [] : [{ x: S.cx * u, y: S.cy * u + S.h * u / 2, p: { color: c.bezelColor ?? '#0a0a0c', w: N.w * u, h: N.h * u * 2, radiusW: N.h * u * 0.6 } }] });
    } else {
      const bw = u, bh = I.h * u, R = I.radius * u, D = c.thickness ?? I.depth * u; const S = I.scr;
      const dims = { bw, bh, R, sx: S.cx * u, sy: S.cy * u, sw: S.w * u, sh: S.h * u, sr: S.r * u };
      const front = faces(O);
      const light = c.chrome === 'light';
      const bez = c.bezelColor ?? (type === 'crt' ? '#' + new THREE.Color(devCol).multiplyScalar(0.86).getHexString() : type === 'browser' ? (light ? '#e8e8eb' : devCol) : '#070708');
      const body = { color: bez, useMedia: false, w: bw, h: bh, radiusW: R, shadow: c.shadow, bright: br, fade: fadeFor(0, bh, bh) };
      if (D > 0) Object.assign(body, { thickness: D, sideColor: type === 'browser' ? bez : frameCol, sideShade: type === 'crt' ? 0.9 : 1, sideSpec: c.sideSpec ?? (type === 'crt' ? 0.1 : 0.55), back: type === 'browser' ? bez : devCol });
      const straps = [];
      if (type === 'watch' && c.strap !== false) { const st = I.strap, sc = typeof c.strap === 'string' ? c.strap : '#2c2c31';
        for (const sg of [1, -1]) straps.push([0, sg * (bh / 2 + st.h * u / 2 - 0.06 * u), -D * 0.5, { color: sc, useMedia: false, w: st.w * u, h: st.h * u, radiusW: 0.06 * u, thickness: 0.07 * u, sideColor: sc, sideShade: 0.8, back: sc, bright: br, fade: fadeFor(sg * (bh / 2 + st.h * u / 2), st.h * u, bh) }]); }
      if (front) { for (const a of straps) put(O, ...a); put(O, 0, 0, 0, body); } else { put(O, 0, 0, 0, body); for (const a of straps) put(O, ...a); }
      if (type === 'watch') { const cr = I.crown; const QC = { c: new THREE.Vector3(bw / 2 + cr.w * u, bh * 0.16, -D * 0.5), q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2) };
        put(QC, 0, 0, 0, { color: frameCol, useMedia: false, w: cr.d * u, h: cr.h * u, radiusW: cr.h * u * 0.3, thickness: cr.w * u, sideColor: frameCol, sideSpec: 0.6, back: devCol, bright: br, hidden: !faces(QC) }); }
      const details = []; const opt = { fadeH: bh, details };
      if (I.island && c.island !== false) details.push({ x: I.island.cx * u, y: I.island.cy * u, p: { color: '#000000', w: I.island.w * u, h: I.island.h * u, radiusW: Math.min(I.island.w, I.island.h) * u / 2 } });
      if (I.cam) details.push({ x: I.cam.cx * u, y: I.cam.cy * u, p: { color: '#18181c', w: I.cam.d * u, h: I.cam.d * u, radiusW: I.cam.d * u / 2 } });
      if (type === 'crt') { opt.screenDefaults = { barrel: 0.1, scan: { amt: 0.3, lines: 110 } }; opt.glossRect = [dims.sx, dims.sy, dims.sw, dims.sh, dims.sr]; opt.gloss = 0.12;
        if (c.led !== false) details.push({ x: bw * 0.36, y: -bh / 2 + (bh / 2 + dims.sy - dims.sh / 2) * 0.5 + 0, p: { color: '#5dff8a', w: 0.018 * u, h: 0.018 * u, radiusW: 0.009 * u } }); }
      if (type === 'browser') { const bar = I.bar * u; const by = bh / 2 - bar / 2; opt.gloss = 0; opt.clip = [0, 0, bw / 2, bh / 2, R];
        ['#ff5f57', '#febc2e', '#28c840'].forEach((cl, k) => details.push({ x: -bw / 2 + bar * (0.55 + k * 0.42), y: by, p: { color: cl, w: bar * 0.26, h: bar * 0.26, radiusW: bar * 0.13 } }));
        details.push({ x: 0, y: by, p: { color: light ? '#d6d6da' : '#3a3b40', w: bw * 0.42, h: bar * 0.5, radiusW: bar * 0.25 } }); }
      if (type === 'watch' || type === 'phone' || type === 'tablet') opt.glossRect = [0, 0, bw, bh, R];
      panel(O, dims, opt);
    }
    for (const o of parts) { o._sub = sub++; out.push(o); }
  }

  // ---------- X3b/X3c particles ----------
  // groups: [{ count, seed, shape 'dot'|'bokeh'|'spark' (Points) | 'quad'|'streak'|'petal' (instanced quads), sampleMedia: idx,
  //   fn(k, rnd, ctx) -> {x,y,z,size,opacity,color,angle,len,spin,uvX,uvY} | null, blend 'add'|'normal', depthTest, order }]
  // Each group slot keeps a Points entry and an instanced entry (buffers reused, grown on demand); the unused one is hidden.
  partEntry(gi, inst, n) {
    const P = this._parts; const slot = (P[gi] ||= {}); const kind = inst ? 'i' : 'p'; let e = slot[kind];
    if (e && e.cap >= n) return e;
    if (e) { this._partGroup.remove(e.obj); e.geo.dispose(); }
    const cap = Math.max(1, n); let geo; const A = inst ? THREE.InstancedBufferAttribute : THREE.BufferAttribute;
    if (inst) { const pl = new THREE.PlaneGeometry(1, 1); geo = new THREE.InstancedBufferGeometry(); geo.index = pl.index; geo.setAttribute('position', pl.attributes.position); geo.setAttribute('uv', pl.attributes.uv); }
    else geo = new THREE.BufferGeometry();
    const mk = (k, d) => { const a = new A(new Float32Array(cap * d), d); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); return a; };
    e = { cap, geo, inst, pos: mk(inst ? 'aPos' : 'position', 3), col: mk('aColor', 3), size: mk('aSize', 1), op: mk('aOpacity', 1), ang: mk('aAngle', 1), uv: mk('aUV', 2), mats: {} };
    if (inst) { e.len = mk('aLen', 1); e.spin = mk('aSpin', 1); e.obj = new THREE.Mesh(geo, null); } else e.obj = new THREE.Points(geo, null);
    e.obj.frustumCulled = false; this._partGroup.add(e.obj); slot[kind] = e; return e;
  }
  layoutParticles(ctx, groups) {
    const P = (this._parts ||= []); let budget = PART_MAX; let gi = 0;
    if (!this._partGroup) { this._partGroup = new THREE.Group(); this.scene.add(this._partGroup); this._partCol = new Map(); }
    const proj = this.H * 0.5 * this.camera.projectionMatrix.elements[5]; const fog = this._fog;
    for (; gi < groups.length; gi++) {
      const g = groups[gi] || {}; const n = Math.max(0, Math.min(budget, (g.count | 0))); budget -= n;
      const shape = PART_SHAPES[g.shape] ?? 0; const inst = shape >= 3; const add = (g.blend ?? 'add') === 'add';
      const e = this.partEntry(gi, inst, n); const slot = P[gi]; const other = slot[inst ? 'p' : 'i']; if (other) other.obj.visible = false;
      const md = (g.sampleMedia != null && this.media.length) ? this.media[((g.sampleMedia | 0) % this.media.length + this.media.length) % this.media.length] : null;
      const key = shape + (md ? 'M' : '') + (fog ? 'F' + (add ? 'a' : 'n') : '');
      let mat = e.mats[key];
      if (!mat) { const defines = { SHAPE: shape }; if (md) defines.MEDIA = 1; if (fog) { defines.FOG = 1; defines.ADD = add ? 1 : 0; }
        mat = e.mats[key] = new THREE.ShaderMaterial({ vertexShader: inst ? instVert : partVert, fragmentShader: inst ? instFrag : partFrag, defines,
          transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uProj: { value: 1 }, uMedia: { value: null }, uMediaLod: { value: 0 },
            uFogColor: { value: new THREE.Color(0, 0, 0) }, uFogRange: { value: new THREE.Vector2(1, 10) } } }); }
      e.obj.material = mat; mat.uniforms.uProj.value = proj;
      if (md) { mat.uniforms.uMedia.value = md.tex; mat.uniforms.uMediaLod.value = md.video ? 0 : Math.max(0, Math.log2(Math.max(md.w, md.h) / Math.max(1, Math.sqrt(n))) - 1); }
      if (fog) { mat.uniforms.uFogColor.value.copy(fog.color); mat.uniforms.uFogRange.value.set(fog.near, fog.far); }
      mat.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending; mat.depthTest = g.depthTest ?? true;
      e.obj.renderOrder = g.order ?? (1e6 + gi); e.obj.visible = n > 0;
      const pa = e.pos.array, ca = e.col.array, sa = e.size.array, oa = e.op.array, aa = e.ang.array, ua = e.uv.array;
      const la = inst ? e.len.array : null, spa = inst ? e.spin.array : null; const seed = g.seed ?? gi;
      for (let k = 0; k < n; k++) {
        const rnd = (j = 0) => hash(k * 16 + j, seed);
        const q = g.fn ? g.fn(k, rnd, ctx) : null;
        if (!q || (q.opacity ?? 1) <= 0) { oa[k] = 0; sa[k] = 0; pa[k * 3] = pa[k * 3 + 1] = pa[k * 3 + 2] = 0; continue; }
        pa[k * 3] = q.x || 0; pa[k * 3 + 1] = q.y || 0; pa[k * 3 + 2] = q.z || 0;
        sa[k] = q.size ?? 0.01; oa[k] = q.opacity ?? 1; aa[k] = q.angle || 0;
        const c = this.partColor(q.color ?? g.color ?? '#ffffff'); ca[k * 3] = c[0]; ca[k * 3 + 1] = c[1]; ca[k * 3 + 2] = c[2];
        if (md) { ua[k * 2] = q.uvX ?? 0.5; ua[k * 2 + 1] = q.uvY ?? 0.5; }
        if (inst) { la[k] = q.len ?? 1; spa[k] = q.spin || 0; }
      }
      const attrs = [e.pos, e.col, e.size, e.op, e.ang]; if (md) attrs.push(e.uv); if (inst) attrs.push(e.len, e.spin);
      if (inst) e.geo.instanceCount = n; else e.geo.setDrawRange(0, n);
      for (const a of attrs) { a.needsUpdate = true; a.clearUpdateRanges?.(); a.addUpdateRange?.(0, n * a.itemSize); }
    }
    for (; gi < P.length; gi++) { if (P[gi].p) P[gi].p.obj.visible = false; if (P[gi].i) P[gi].i.obj.visible = false; }
  }
  // hex/css string -> cached linear rgb; [r,g,b] arrays are sRGB 0..1
  partColor(c) {
    if (Array.isArray(c)) { const t = (this._pc ||= new THREE.Color()).setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [t.r, t.g, t.b]; }
    let v = this._partCol.get(c); if (!v) { const t = new THREE.Color(c); v = [t.r, t.g, t.b]; this._partCol.set(c, v); } return v;
  }

  // ---------- overlays: text + logo ----------
  async setupOverlays(spec, logoUrl) {
    for (const o of this.overlays) this.ovScene.remove(o.mesh);
    this.overlays = [];
    const texts = spec.text ? (Array.isArray(spec.text) ? spec.text : [spec.text]) : [];
    for (const tx of texts.slice(this.tpl?.usesTitle ? 1 : 0)) { // X0: usesTitle templates animate text[0] themselves
      const c = document.createElement('canvas'); const g = c.getContext('2d');
      const size = Math.round((tx.size ?? 6) / 100 * this.H);
      const font = `${tx.weight ?? 700} ${size}px ${tx.font ?? 'Inter, "Noto Sans CJK SC", "PingFang SC", sans-serif'}`;
      g.font = font; const lines = String(tx.content ?? '').split('\n');
      const tw = Math.max(...lines.map((l) => g.measureText(l).width)) + size; const th = size * 1.25 * lines.length + size * 0.5;
      c.width = Math.ceil(tw); c.height = Math.ceil(th); g.font = font; g.fillStyle = tx.color ?? '#fff'; g.textBaseline = 'middle'; g.textAlign = 'center';
      if (tx.shadow !== false) { g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = size * 0.3; }
      lines.forEach((l, k) => g.fillText(l, c.width / 2, size * 0.25 + size * 1.25 * (k + 0.5)));
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.scale.set(c.width / this.H, c.height / this.H, 1); mesh.renderOrder = 10; this.ovScene.add(mesh);
      this.overlays.push({ mesh, cfg: tx, kind: 'text', base: mesh.scale.clone() });
    }
    if (logoUrl) {
      const tex = await new THREE.TextureLoader().loadAsync(logoUrl); tex.colorSpace = THREE.SRGBColorSpace; const L = spec.logo || {};
      const hgt = (L.size ?? 8) / 100; const a = tex.image.width / tex.image.height;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, opacity: L.opacity ?? 1 }));
      mesh.scale.set(hgt * a, hgt, 1); mesh.renderOrder = 11; this.ovScene.add(mesh); this.overlays.push({ mesh, cfg: L, kind: 'logo', base: mesh.scale.clone() });
    }
    const a = this.aspect; this.ovCam.left = -a / 2; this.ovCam.right = a / 2; this.ovCam.top = 0.5; this.ovCam.bottom = -0.5; this.ovCam.updateProjectionMatrix();
  }
  drawOverlays(ctx) {
    const a = this.aspect;
    const anchor = { 'top-left': [-1, 1], top: [0, 1], 'top-right': [1, 1], left: [-1, 0], center: [0, 0], right: [1, 0], 'bottom-left': [-1, -1], bottom: [0, -1], 'bottom-right': [1, -1] };
    for (const o of this.overlays) {
      const cfg = o.cfg; const [ax, ay] = anchor[cfg.position || (o.kind === 'logo' ? 'top-left' : 'center')] || [0, 0];
      const m = 0.06; const bs = o.base || o.mesh.scale; const sw = bs.x, sh = bs.y;
      let x = ax * (a / 2 - m - sw / 2), y = ay * (0.5 - m - sh / 2);
      x += (cfg.x ?? 0) / 100 * a; y += (cfg.y ?? 0) / 100;
      let op = cfg.opacity ?? 1;
      const anim = cfg.animate || 'none'; const t = ctx.t, dur = ctx.dur;
      const inD = cfg.in ?? 0.8; const enter = E.outCubic(M.clamp((t - (cfg.delay ?? 0)) / inD, 0, 1));
      if (anim === 'fade') op *= enter; else if (anim === 'rise') { op *= enter; y -= (1 - enter) * 0.05; } else if (anim === 'pop') { const e = M.clamp((t - (cfg.delay ?? 0)) / inD, 0, 1); op *= Math.min(1, e * 2.5); const k = e >= 1 ? 1 : 0.6 + 0.4 * E.outBack(e); o.mesh.scale.set(bs.x * k, bs.y * k, 1); }
      else if (anim === 'loop-fade') { op *= M.clamp(Math.min(t / 0.6, (dur - t) / 0.6), 0, 1); }
      if (this._introFx !== undefined && this._introFx < 1) op *= this._introFx;
      o.mesh.position.set(x, y, 0); o.mesh.material.opacity = op;
    }
  }

  async syncVideos(t) {
    const vids = this.media.filter((m) => m.video); if (!vids.length) return;
    await Promise.all(vids.map((m) => new Promise((res) => { const v = m.video; const tt = t % (v.duration || 1);
      // always flag the texture: with requestVideoFrameCallback three.js only uploads on presented frames, so an un-seeked frame (t=0, k*duration) stayed black
      const done = () => { if (v.readyState >= 2) m.tex.needsUpdate = true; res(); };
      if (Math.abs(v.currentTime - tt) < 1e-3) return done(); v.onseeked = done; v.currentTime = tt; })));
  }

  renderScene(target) {
    const r = this.renderer; r.setRenderTarget(target); r.autoClear = false; r.clear();
    r.render(this.bgScene, this.flatCam); r.clearDepth(); r.render(this.scene, this.camera); r.render(this.ovScene, this.ovCam);
  }

  // render frame at time t (seconds) to canvas
  async renderAt(t, fps = 30) {
    await this.syncVideos(t);
    const mb = this.fx.motionBlur | 0;
    if (mb > 1) {
      const r = this.renderer; r.setRenderTarget(this.rtAcc); r.setClearColor(0x000000, 1); r.clear();
      let pp = null;
      for (let k = 0; k < mb; k++) {
        const tt = t + ((k / (mb - 1)) - 0.5) * this.fx.shutter / fps; this.layoutFrame(((tt % this.spec.duration) + this.spec.duration) % this.spec.duration);
        if (k === (mb >> 1)) pp = this._tplPost; // X4a: post of the middle sub-frame, applied after accumulation (stays crisp)
        this.renderScene(this.rtA); this.accMat.uniforms.tDiffuse.value = this.rtA.texture; this.accMat.uniforms.uW.value = 1 / mb;
        r.setRenderTarget(this.rtAcc); r.autoClear = false; r.render(this.accScene, this.flatCam);
      }
      if (pp) this.finishTpl(this.rtAcc.texture, t, pp); else this.post(this.rtAcc.texture, t);
    } else {
      this.layoutFrame(t); const pp = this._tplPost;
      if (pp) { this.renderScene(this.rtA); this.finishTpl(this.rtA.texture, t, pp); }
      else if (this.fx.grain || this.fx.vignette || this.fx.aberration) { this.renderScene(this.rtA); this.post(this.rtA.texture, t); }
      else this.renderScene(null);
    }
  }
  // ---------- v10 timeline rendering (wall-clock seconds T; speed + intro) ----------
  // Plain loops at 1x go through the untouched v9 renderAt, so pixels match v9 exactly.
  introVisible(t) { // visible cards of the start pose at template time t (stagger -> whole fallback, wm info, web UI)
    this.layoutFrame(t); this.camera.updateMatrixWorld(); return visibleCount(this._rawCards || [], this.camera, THREE);
  }
  async renderAtTime(T, fps = 30) {
    const tl = this.tl; const m = timeMap(T, tl);
    if (!tl.on && tl.speed === 1) return this.renderAt(m.t, fps);
    await this.syncVideos(m.t);
    return this._renderTL(T, m, fps);
  }
  renderTimeSync(T, fps = 30) {
    const tl = this.tl; const m = timeMap(T, tl);
    if (!tl.on && tl.speed === 1) return this.renderSync ? this.renderSync(m.t, fps) : this.renderAt(m.t, fps);
    return this._renderTL(T, m, fps);
  }
  _renderTL(T, m, fps) {
    const D = this.spec.duration || 16; const wrap = (x) => (x == null ? x : ((x % D) + D) % D);
    const mb = this.fx.motionBlur | 0;
    if (mb > 1) {
      const r = this.renderer; r.setRenderTarget(this.rtAcc); r.setClearColor(0x000000, 1); r.clear();
      let pp = null;
      for (let k = 0; k < mb; k++) {
        const TT = T + ((k / (mb - 1)) - 0.5) * this.fx.shutter / fps; // shutter in wall time -> template time scales with speed
        const mm = timeMap(Math.max(0, TT), this.tl); this.layoutFrame(wrap(mm.t), mm.P);
        if (k === (mb >> 1)) pp = this._tplPost;
        this.renderScene(this.rtA); this.accMat.uniforms.tDiffuse.value = this.rtA.texture; this.accMat.uniforms.uW.value = 1 / mb;
        r.setRenderTarget(this.rtAcc); r.autoClear = false; r.render(this.accScene, this.flatCam);
      }
      if (pp) this.finishTpl(this.rtAcc.texture, m.t, pp); else this.post(this.rtAcc.texture, m.t);
    } else {
      this.layoutFrame(m.t, m.P); const pp = this._tplPost;
      if (pp) { this.renderScene(this.rtA); this.finishTpl(this.rtA.texture, m.t, pp); }
      else if (this.fx.grain || this.fx.vignette || this.fx.aberration) { this.renderScene(this.rtA); this.post(this.rtA.texture, m.t); }
      else this.renderScene(null);
    }
  }
  // X4a: template post pass; chains into the global grain/vignette pass when that is also on
  finishTpl(tex, t, pp) {
    if (!this.tplPostMat) {
      this.tplPostMat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: tplPostFrag, depthTest: false, depthWrite: false,
        uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2() }, uChroma: { value: 0 }, uGlitch: { value: new THREE.Vector4() },
          uScan: { value: new THREE.Vector4() }, uFlash: { value: new THREE.Vector4() }, uTint: { value: new THREE.Vector4() }, uGrade: { value: new THREE.Vector4() },
          uBloom: { value: new THREE.Vector4() }, tBloom: { value: null }, uBarrel: { value: 0 }, uTrack: { value: new THREE.Vector4() }, uNoise: { value: new THREE.Vector2() },
          uLeakN: { value: 0 }, uLeakP: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, uLeakC: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) } } });
      this.tplPostScene = new THREE.Scene(); this.tplPostScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.tplPostMat));
    }
    const U = this.tplPostMat.uniforms; U.tDiffuse.value = tex; U.uRes.value.set(this.W, this.H); U.uChroma.value = pp.chroma;
    U.uGlitch.value.fromArray(pp.glitch); U.uScan.value.set(pp.scan[0], pp.scan[1], pp.scan[2], 0); U.uFlash.value.fromArray(pp.flash); U.uTint.value.fromArray(pp.tint); U.uGrade.value.fromArray(pp.grade);
    const r = this.renderer;
    // X4b
    U.uBarrel.value = pp.barrel; U.uTrack.value.fromArray(pp.track); U.uNoise.value.fromArray(pp.noise); U.uLeakN.value = pp.leak.length;
    pp.leak.forEach((L, i) => { U.uLeakP.value[i].set(L[0], L[1], L[2], L[3]); U.uLeakC.value[i].set(L[4], L[5], L[6]); });
    U.uBloom.value.set(pp.bloom[0], 0, 0, 0); U.tBloom.value = pp.bloom[0] > 0 ? this.bloomPass(tex, pp.bloom[1], pp.bloom[2]) : null;
    const gp = this.fx.grain || this.fx.vignette || this.fx.aberration;
    if (gp) { if (!this.rtB || this.rtB.width !== this.W || this.rtB.height !== this.H) { this.rtB?.dispose(); this.rtB = new THREE.WebGLRenderTarget(this.W, this.H, { type: THREE.HalfFloatType }); }
      r.setRenderTarget(this.rtB); r.autoClear = true; r.render(this.tplPostScene, this.flatCam); this.post(this.rtB.texture, t); }
    else { r.setRenderTarget(null); r.autoClear = true; r.render(this.tplPostScene, this.flatCam); }
  }
  // X4b: half-res bloom (RTs + materials allocated on first use only); returns the blurred glow texture
  bloomPass(tex, thresh, radius) {
    const w = Math.max(1, this.W >> 1), h = Math.max(1, this.H >> 1), r = this.renderer;
    if (!this.bloomMats) {
      const mk = (frag, uni) => new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: frag, depthTest: false, depthWrite: false, uniforms: uni });
      const bright = mk(bloomBrightFrag, { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 0.7 } });
      const blur = mk(bloomBlurFrag, { tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() } });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bright); const scene = new THREE.Scene(); scene.add(quad);
      this.bloomMats = { bright, blur, quad, scene };
    }
    if (!this.rtBl1 || this.rtBl1.width !== w || this.rtBl1.height !== h) {
      this.rtBl1?.dispose(); this.rtBl2?.dispose();
      const o = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
      this.rtBl1 = new THREE.WebGLRenderTarget(w, h, o); this.rtBl2 = new THREE.WebGLRenderTarget(w, h, o);
    }
    const B = this.bloomMats; r.autoClear = true;
    B.quad.material = B.bright; B.bright.uniforms.tDiffuse.value = tex; B.bright.uniforms.uTexel.value.set(1 / this.W, 1 / this.H); B.bright.uniforms.uThresh.value = thresh;
    r.setRenderTarget(this.rtBl1); r.render(B.scene, this.flatCam);
    // sigma ≈ radius·H (full-res px) = radius·h half-res px; the 9-tap kernel has sigma ≈ 2·step; >1.5 texel steps split into 2 iterations
    let step = Math.max(0.5, radius * h / 2); const it = step > 1.5 ? (step > 4 ? 3 : 2) : 1; step /= Math.sqrt(it);
    B.quad.material = B.blur;
    for (let i = 0; i < it; i++) {
      B.blur.uniforms.tDiffuse.value = this.rtBl1.texture; B.blur.uniforms.uStep.value.set(step / w, 0); r.setRenderTarget(this.rtBl2); r.render(B.scene, this.flatCam);
      B.blur.uniforms.tDiffuse.value = this.rtBl2.texture; B.blur.uniforms.uStep.value.set(0, step / h); r.setRenderTarget(this.rtBl1); r.render(B.scene, this.flatCam);
    }
    return this.rtBl1.texture;
  }
  post(tex, t) {
    const u = this.postMat.uniforms; u.tDiffuse.value = tex; u.uGrain.value = this.fx.grain; u.uVig.value = this.fx.vignette; u.uAb.value = this.fx.aberration; u.uSeed.value = (t * 37.13) % 100;
    const r = this.renderer; r.setRenderTarget(null); r.autoClear = true; r.render(this.postScene, this.flatCam);
  }
}
