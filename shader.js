const world = worlds[studyId] || {};
const vec3Literal = values => 'vec3(' + values.map(value => Number(value).toFixed(4)).join(',') + ')';
const archMoving = /* glsl */ `  vec3 localOrigin=o-vec3(stageOffset,0,0);
  boxHit(h,localOrigin,d,inv,vec3(-2.67,0,-1.04),vec3(0.08,2.98,-0.48),ARCH);
  archLining(h,localOrigin,d,inv);
`;
const archStatic = /* glsl */ `
  boxHit(h,o,d,inv,vec3(-2.90,0,-0.48),vec3(-2.46,1.26,1.0),STEP);
  boxHit(h,o,d,inv,vec3(-2.46,0,-0.48),vec3(-2.03,0.84,1.0),STEP);
  boxHit(h,o,d,inv,vec3(-2.03,0,-0.48),vec3(-1.60,0.42,1.0),STEP);
  if(!hideMetal) ellipsoidHit(h,o,d,vec3(1.62,.79,.83),vec3(.79),METAL);
`;
const archSurfaces = /* glsl */ `  if(m==METAL) return Surface(vec3(0.043),vec3(0.88,0.90,0.92));
  if(m==ARCH) return Surface(vec3(0.75,0.077,0.034)*(0.96+0.08*speck),vec3(0));
  if(m==STEP) return Surface(vec3(0.85,0.83,0.77)*(0.96+0.08*speck),vec3(0));
  if(m==FLOOR){
    if(!staticOnly && onArchPlatform(p))
      return Surface(vec3(0.83,0.052,0.019)*(0.96+0.08*speck),vec3(0));
    bool inlay=p.x>-3.42 && p.x<3.45 && p.z>0.62 && p.z<4.05;
    float seam=joints(uv-vec2(-3.42,0.62),vec2(1.145,1.143),0.007);
    if(inlay) return Surface(vec3(0.058,0.069,0.069)*(0.80+0.27*speck)*mix(0.50,1.0,seam),vec3(0.41)*seam);
    return Surface(vec3(0.62,0.60,0.55)*(0.95+0.10*speck),vec3(0));
  }
  float seam=joints(uv+vec2(0.44,0.08),vec2(2.20,2.05),0.010);
  vec2 hole=(fract((uv+vec2(0.18,0.32))/vec2(1.10,1.025))-0.5)*vec2(1.10,1.025);
  float dimple=mix(0.62,1.0,smoothstep(0.012,0.026,length(hole)));
  return Surface(vec3(0.66,0.64,0.59)*(0.97+0.06*speck)*mix(0.72,1.0,seam)*dimple,vec3(0));`;
// Analytic scene in metres. Each query finds the nearest hit in world space.
const roomTransportGLSL = /* glsl */ `
precision highp float;
uniform vec2 resolution;
uniform mat4 cameraWorld;
uniform float tanHalfFov, sampleNumber, historyCount, sceneTime, motionDelta;
uniform bool useGI, useReflections, bakedMode, hideMetal, staticOnly;
uniform float stageOffset;
float sequenceIndex;
uniform sampler2D previousFrame;
varying vec2 screenUV;

const float FAR = 1000.0, EPS = 0.001, PI = 3.14159265;
const int PLASTER = 1, ARCH = 2, STEP = 3, METAL = 4, FLOOR = 5, LIGHT = 6;
const int LACQUER=7, SIGN=8, TRIM=9, WINDOWMAT=10, DARK=11, ACCENT=12, PRINTMAT=13;
const vec3 lamp = ${vec3Literal(world.lamp || [-2.5,5.8,2.6])};
const vec2 lampSize = vec2(4.0, 2.6);
const vec3 lampRadiance = ${vec3Literal(world.radiance || [12,11.65,11.15])};
struct Hit { float t; vec3 n; int material; int receiver; };
struct Surface { vec3 color; vec3 specular; };

void recordReceiver(inout Hit hit,float t,vec3 n,int material,int receiver) {
  if(t>EPS && t<hit.t) hit=Hit(t,n,material,receiver);
}
void recordHit(inout Hit hit,float t,vec3 n,int material) {
  recordReceiver(hit,t,n,material,-1);
}
vec3 inverseDir(vec3 d) {
  return vec3(d.x < 0.0 ? -1.0 : 1.0, d.y < 0.0 ? -1.0 : 1.0, d.z < 0.0 ? -1.0 : 1.0) / max(abs(d), vec3(0.0000001));
}
vec3 faceNormal(vec3 p, vec3 lo, vec3 hi) {
  vec3 q = (2.0*p-lo-hi)/(hi-lo);
  vec3 a = abs(q);
  if (a.x > a.y && a.x > a.z) return vec3(sign(q.x),0,0);
  if (a.y > a.z) return vec3(0,sign(q.y),0);
  return vec3(0,0,sign(q.z));
}
bool inOpening(vec3 p) {
  vec2 q = vec2(p.x + 1.29, max(p.y - 1.20, 0.0));
  return dot(q,q) < 0.78*0.78;
}
void boxHit(inout Hit h, vec3 o, vec3 d, vec3 inv, vec3 lo, vec3 hi, int m) {
  vec3 a=(lo-o)*inv, b=(hi-o)*inv, nearT=min(a,b), farT=max(a,b);
  float entry=max(max(nearT.x,nearT.y),nearT.z), leave=min(min(farT.x,farT.y),farT.z);
  if (leave < max(entry,EPS) || entry > h.t) return;
  float t=entry>EPS ? entry : leave;
  vec3 p=o+d*t;
  if (m == ARCH && inOpening(p)) {
    t=leave; p=o+d*t;
    if (inOpening(p)) return;
  }
  recordHit(h,t,faceNormal(p,lo,hi),m);
}
void archLining(inout Hit h, vec3 o, vec3 d, vec3 inv) {
  // Inner surface of a semicircular tunnel, continued by two vertical jambs.
  vec2 q=o.xy-vec2(-1.29,1.20);
  float a=dot(d.xy,d.xy), b=dot(q,d.xy), c=dot(q,q)-0.78*0.78;
  float disc=b*b-a*c;
  for(int side=0;side<2;side++){
    float s=side==0 ? -1.0 : 1.0;
    float t=(-1.29+s*0.78-o.x)*inv.x;
    vec3 p=o+d*t;
    if(p.y>=0.0 && p.y<=1.20 && p.z>=-1.04 && p.z<=-0.48)
      recordHit(h,t,vec3(-s,0,0),ARCH);
    if(disc>=0.0 && a>0.000001){
      t=(-b+s*sqrt(disc))/a; p=o+d*t;
      if(p.y>=1.20 && p.z>=-1.04 && p.z<=-0.48)
        recordHit(h,t,vec3(-normalize(p.xy-vec2(-1.29,1.20)),0),ARCH);
    }
  }
}
// Closed circular cylinder joining endpoints a and b.
void rodHit(inout Hit h,vec3 o,vec3 d,vec3 a,vec3 b,float r,int m) {
  vec3 axis=normalize(b-a), q=o-a;
  float rayAxis=dot(d,axis), originAxis=dot(q,axis), len=length(b-a);
  vec3 rd=d-rayAxis*axis, radial=q-originAxis*axis;
  float aa=dot(rd,rd), bb=dot(rd,radial), cc=dot(radial,radial)-r*r;
  float disc=bb*bb-aa*cc;
  if(disc>=0.0 && aa>.000001) {
    for(int j=0;j<2;j++){
      float t=(-bb+(j==0 ? -1.0 : 1.0)*sqrt(disc))/aa;
      float y=originAxis+t*rayAxis;
      if(y>=0.0 && y<=len) recordHit(h,t,normalize(radial+t*rd),m);
    }
  }
  if(abs(rayAxis)>.000001) {
    for(int j=0;j<2;j++){
      float t=(float(j)*len-originAxis)/rayAxis;
      vec3 cap=radial+t*rd;
      if(dot(cap,cap)<=r*r) recordHit(h,t,j==0 ? -axis : axis,m);
    }
  }
}
void ellipsoidHit(inout Hit h,vec3 o,vec3 d,vec3 center,vec3 radii,int m){
  vec3 q=(o-center)/radii, v=d/radii;
  float a=dot(v,v), b=dot(q,v), c=dot(q,q)-1.0, disc=b*b-a*c;
  if(disc<0.0) return;
  float t=(-b-sqrt(disc))/a;
  if(t<=EPS) t=(-b+sqrt(disc))/a;
  recordHit(h,t,normalize((q+t*v)/radii),m);
}
${studyId==='arch' ? `bool onArchPlatform(vec3 p){
  return p.x-stageOffset>-3.42 && p.x-stageOffset<.64 && p.z>-2.55 && p.z<.62;
}` : ''}
${world.boatLift ? `float boatLift(){
  return ${world.boatLift}*(sin(sceneTime*1.55)+.24*sin(sceneTime*2.61));
}` : ''}
${world.shapeHelpers || ''}
${lightmapStaticGeometry(world, archStatic)}
Hit trace(vec3 o, vec3 d) {
  vec3 inv=inverseDir(d);
  Hit h=Hit(FAR,vec3(0),0,-1);
  if(d.y<0.0) recordReceiver(h,-o.y*inv.y,vec3(0,1,0),FLOOR,0);
${world.sun ? '' : `  if(d.z<0.0) recordReceiver(h,(-2.55-o.z)*inv.z,vec3(0,0,1),PLASTER,1);
  if(d.x<0.0) recordReceiver(h,(-4.30-o.x)*inv.x,vec3(1,0,0),PLASTER,2);
  if(d.y>0.0){
    float t=(lamp.y-o.y)*inv.y;
    if(all(lessThan(abs((o+d*t-lamp).xz),0.5*lampSize))) recordHit(h,t,vec3(0,-1,0),LIGHT);
  }
`}
  traceStatic(h,o,d,inv);
  if(!staticOnly){
    float staticDistance=h.t;
    ${studyId==='arch' ? archMoving : world.movingGeometry || ''}
    if(h.t<staticDistance) h.receiver=-1;
    ${studyId==='arch' ? 'if(h.receiver==0 && onArchPlatform(o+d*h.t)) h.receiver=-1;' : ''}
  }
  return h;
}
float grain(vec2 p) {
  vec3 q=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));
  q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z);
}
float joints(vec2 uv,vec2 size,float width){
  vec2 s=abs(fract(uv/size+0.5)-0.5)*size;
  return smoothstep(0.0,width,min(s.x,s.y));
}
${world.helpers || ''}
Surface surface(int m, vec3 p, vec3 n) {
  vec2 uv=abs(n.y)>0.5 ? p.xz : (abs(n.z)>0.5 ? p.xy : p.zy);
  float speck=grain(floor(uv*190.0));
${world.surface || archSurfaces}
}
vec3 emission(int m,vec3 p,vec3 n) { ${world.emission || 'return vec3(0);'} }
${studyId==='neon' || studyId==='tram' ? `
vec2 dripSlopes(vec2 p){
  vec2 cell=floor(p), center=.35+.3*vec2(grain(cell+3.1),grain(cell+9.2));
  vec2 offset=fract(p)-center;
  float radius=length(offset);
  float age=fract(sceneTime*(.24+.11*grain(cell+2.5))+grain(cell+17.1));
  float ring=radius-age*.34;
  float envelope=exp(-1750.0*ring*ring)*smoothstep(.0,.12,age)*(1.0-smoothstep(.50,.94,age));
  return .061*offset/max(.01,radius)*sin(142.0*ring)*envelope;
}` : ''}
vec3 mirrorNormal(int m,vec3 p,vec3 n,float reflectivity) { ${world.normal || 'return n;'} }
${skyLookupGLSL(world)}
// Randomized low-discrepancy samples. Each pixel keeps its own sequence.
vec2 pairSample(float stream) {
  vec2 p=gl_FragCoord.xy+vec2(stream*41.0,stream*97.0);
  vec2 shift=vec2(grain(p),grain(p+vec2(103.7,62.9)));
  vec2 rate = stream==0.0 ? vec2(0.75487767,0.56984029) :
              (mod(stream,6.0)==1.0 ? vec2(0.61803399,0.41421356) :
              (mod(stream,6.0)==2.0 ? vec2(0.81917251,0.67104361) : vec2(0.54970048,0.45070053)));
  return fract(shift+(sequenceIndex+0.5)*rate);
}
vec3 directIrradiance(vec3 p, vec3 n, vec2 uv) {
${world.direct || (world.sun ? `
  vec3 sunDirection=normalize(${vec3Literal(world.sun)});
  vec3 tangent=normalize(cross(sunDirection,vec3(0,1,0)));
  float radius=0.014*sqrt(uv.x), angle=2.0*PI*uv.y;
  vec3 l=normalize(sunDirection+radius*(cos(angle)*tangent+sin(angle)*cross(tangent,sunDirection)));
  float incident=max(dot(l,n),0.0);
  vec3 light=${vec3Literal(world.fill)}*(0.63+0.37*max(0.0,n.y));
  if(incident>0.0 && trace(p+n*EPS*3.0,l).material==0) light+=${vec3Literal(world.radiance)}*incident*cloudSunlight();
  return light;
` : `  vec3 delta=lamp+vec3((uv.x-0.5)*lampSize.x,0,(uv.y-0.5)*lampSize.y)-p;
  float dist=length(delta); vec3 l=delta/dist;
  float geometry=max(dot(l,n),0.0)*max(l.y,0.0)/(dist*dist);
  vec3 light=${vec3Literal(world.fill || [.047,.05,.055])}; // Fixed, neutral studio fill in every mode.
  if(geometry>0.0 && trace(p+n*EPS*3.0,l).t>=dist-0.012)
    light+=lampRadiance*(lampSize.x*lampSize.y/PI)*geometry;
  return light;`)}

}
vec3 cosineDirection(vec3 n, vec2 uv) {
  float r=sqrt(uv.x), a=2.0*PI*uv.y;
  vec3 tangent=normalize(cross(abs(n.y)<0.9 ? vec3(0,1,0) : vec3(1,0,0),n));
  return r*cos(a)*tangent+r*sin(a)*cross(n,tangent)+sqrt(1.0-uv.x)*n;
}
vec3 bounceLight(vec3 p,vec3 n,float stream) {
  vec3 direction=cosineDirection(n,pairSample(stream));
  vec3 origin=p+n*(3.0*EPS);
  Hit b=trace(origin,direction);
  // The emitter is already sampled by directIrradiance.
  ${world.openSky ? 'if(b.material==0 && physicalSky) return .28*sky(direction);' : ''}
  if(b.material==0 || b.material==LIGHT) return vec3(0);
  vec3 q=origin+direction*b.t;
  vec3 normal=${world.model ? 'faceforward(b.n,direction,b.n)' : 'b.n'};
  return emission(b.material,q,normal)+surface(b.material,q,normal).color*directIrradiance(q,normal,pairSample(stream+1.0));
}
`;
const localVolumeGLSL = volumeTransportGLSL(world);
const roomTraceShader = roomTransportGLSL + probeLookupGLSL + lightmapLookupGLSL + localVolumeGLSL + /* glsl */ `
${lightingGeometryGLSL}
${primaryResolveGLSL}
uniform bool reconstructLighting;
vec3 radiance(vec3 origin,vec3 direction,out float guide,out float response){
  guide=0.0;
  // Response is inverse seconds. Stationary indoor surfaces keep progressive sampling.
  response=${world.openSky ? '(volumeClouds ? .8 : 0.0)' : '0.0'};
  vec3 result=vec3(0), weight=vec3(1);
  for(int depth=0;depth<3;depth++){
    Hit h=trace(origin,direction);
    if(depth==0){
      guide=(float(h.material)+0.9*min(h.t/22.0,1.0))/${world.model ? '80.0' : studyId==='arch' ? '8.0' : '16.0'};
      ${world.boatLift ? `bool boat=h.receiver<0 && h.material!=0 && h.material!=LIGHT;
      guide=.48*guide+(boat ? .52 : 0.0);
      if(boat) response=10.0;` : ''}
    }
    vec3 mediumSamples=vec3(pairSample(31.0+float(depth)).x,pairSample(41.0+float(depth)));
    vec3 primaryGI=vec3(0);
    vec4 medium;
    if(depth==0 && reconstructLighting)
      resolvePrimary(h,origin,direction,mediumSamples,primaryGI,medium);
    else medium=volumeSegment(origin,direction,h.t,mediumSamples);
    result+=weight*medium.rgb;
    weight*=medium.a;
    if(h.material==0){
      ${world.openSky ? 'if(volumeClouds) response=max(response,7.0);' : ''}
      result+=weight*sky(direction); break;
    }
    if(h.material==LIGHT){ result+=weight*lampRadiance; break; }
    vec3 p=origin+direction*h.t;
    vec3 n=faceforward(h.n,direction,h.n);
    Surface s=surface(h.material,p,n);
    ${world.openSky ? 'if(h.material==FLOOR && s.specular.x>.09) response=max(response,10.0);' : ''}
    ${studyId==='vinyl' ? 'if(h.material==PRINTMAT) response=30.0;' : ''}
    ${studyId==='bookshop' ? 'if(h.material>=16 && texelFetch(paintTable,address(4*(h.material-16)+1),0).x==8.0) response=8.0;' : ''}
    float stream=6.0*float(depth);
    vec3 diffuse=directIrradiance(p,n,pairSample(1.0+stream));
    if(useGI){
      if(bakedMode) diffuse+=bakedIrradiance(h,p,n);
      else if(depth==0 && reconstructLighting) diffuse+=primaryGI;
      else diffuse+=bounceLight(p,n,2.0+stream);
    }
    result+=weight*(emission(h.material,p,n)+s.color*diffuse);
    if(!useReflections || s.specular.x<0.001 || depth==2) break;
    float grazing=pow(1.0-max(dot(-direction,n),0.0),5.0);
    weight*=mix(s.specular,vec3(1),grazing);
    direction=reflect(direction,mirrorNormal(h.material,p,n,s.specular.x));
    if(bakedMode) {
      result+=weight*storedReflection(p,direction,h.material==METAL,useGI);
      break;
    }
    origin=p+n*EPS*3.0;
  }
  return result;
}
void main(){
  sequenceIndex=sampleNumber;
  // A fresh view has no subpixel history yet. Keep silhouettes and their
  // reflections on a stable pixel grid until the next accumulation sample.
  vec2 jitter=historyCount<.5 ? vec2(0) : pairSample(0.0)-.5;
  vec2 pixel=(gl_FragCoord.xy+jitter)/resolution;
  vec2 ndc=pixel*2.0-1.0;
  vec3 ray=normalize(mat3(cameraWorld)*vec3(ndc*vec2(resolution.x/resolution.y,1)*tanHalfFov,-1));
  float guide,response;
  vec3 sampleColor=radiance(cameraWorld[3].xyz,ray,guide,response);
  // The bounded encoding also supports devices with only 8-bit render targets.
  vec3 encoded=min(sampleColor/4.0,vec3(1));
  vec4 last=texture2D(previousFrame,screenUV);
  float blend=max(1.0/(historyCount+1.0),1.0-exp(-motionDelta*response));
  ${world.boatLift ? 'if(motionDelta>0.0 && (guide>.5)!=(last.a>.5)) blend=1.0;' : ''}
  vec3 accumulated=historyCount<.5 ? encoded : mix(last.rgb,encoded,blend);
  gl_FragColor=vec4(accumulated,guide);
}
`;
const roomDisplayShader = /* glsl */ `
uniform sampler2D image;
uniform vec2 resolution;
uniform float samples;
varying vec2 screenUV;
void main() {
  // A depth- and colour-aware preview filter suppresses Monte Carlo noise.
  vec4 center=texture2D(image,screenUV);
  vec3 sum=vec3(0); float total=0.0;
  float radius=mix(1.7,1.0,min(samples/100.0,1.0));
  for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++){
    vec2 offset=vec2(x,y);
    vec4 neighbor=texture2D(image,screenUV+offset*radius/resolution);
    vec3 dc=neighbor.rgb-center.rgb;
    float w=exp(-0.24*dot(offset,offset)-36.0*dot(dc,dc)-400.0*abs(neighbor.a-center.a));
    sum+=neighbor.rgb*w; total+=w;
  }
  vec3 c=(sum/total)*4.0;
  c=clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14),0.0,1.0);
  gl_FragColor=vec4(mix(1.055*pow(c,vec3(1.0/2.4))-0.055,12.92*c,step(c,vec3(0.0031308))),1);
}
`;
