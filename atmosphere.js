// Sky distances are in kilometres. The local participating medium uses scene metres.
const scatteringPhaseGLSL = /* glsl */ `
float henyeyGreenstein(float cosine, float g) {
  float den = 1.0 + g*g - 2.0*g*cosine;
  return (1.0-g*g) / (4.0*PI*den*sqrt(den));
}
`;

function skyParameters(world) {
  return `
    const vec3 skyLightDir = normalize(${vec3Literal(world.sun || world.lamp)});
    const float skyIntensity = ${(world.skyIntensity || 1).toFixed(3)};
    vec3 clearGradient(vec3 d) {
      return mix(${vec3Literal(world.skyLow)}, ${vec3Literal(world.skyHigh)}, smoothstep(-.02,.48,d.y));
    }
  `;
}

// A distant cloud field has negligible parallax over a metre-scale study.
// Integrate it once into a hemispherical radiance map shared by every ray.
function makeSkyShader(world) {
  return /* glsl */ `
precision highp float;
varying vec2 screenUV;
uniform bool physicalSky, volumeClouds;
uniform float cloudTime;
const float PI=3.14159265, earthRadius=6360.0;
const vec3 betaR=vec3(.00580,.01350,.03310);
const float betaM=.004;
${skyParameters(world)}
${scatteringPhaseGLSL}

float shellExit(vec3 p,vec3 d,float radius) {
  float b=dot(p,d);
  float c=(radius-length(p))*(radius+length(p));
  return max(0.0,-b+sqrt(max(0.0,b*b+c)));
}
vec2 airDensity(vec3 p) {
  return exp(-max(length(p)-earthRadius,0.0)/vec2(8.0,1.2));
}
vec3 extinction(vec2 column) {
  return betaR*column.x + vec3(betaM*1.12)*column.y;
}
vec3 airRadiance(vec3 o,vec3 d) {
  float distance=shellExit(o,d,earthRadius+80.0);
  float mu=dot(d,skyLightDir);
  float rayleigh=3.0*(1.0+mu*mu)/(16.0*PI);
  float mie=henyeyGreenstein(mu,.76);
  vec2 column=vec2(0);
  vec3 light=vec3(0);
  for(int i=0;i<16;i++){
    // Shorter segments near the observer resolve the dense aerosol layer.
    float a=float(i)/16.0, b=float(i+1)/16.0;
    float ds=distance*(b*b-a*a);
    vec3 p=o+d*(distance*a*a+.5*ds);
    vec2 local=airDensity(p)*ds;
    float sunLength=shellExit(p,skyLightDir,earthRadius+80.0);
    vec2 sunColumn=vec2(0);
    for(int j=0;j<6;j++){
      float u=float(j)/6.0, v=float(j+1)/6.0;
      sunColumn+=airDensity(p+skyLightDir*(.5*(u*u+v*v)*sunLength))*((v*v-u*u)*sunLength);
    }
    light+=exp(-extinction(column+.5*local+sunColumn))*(betaR*local.x*rayleigh+betaM*local.y*mie);
    column+=local;
  }
  return 16.0*skyIntensity*light;
}

float hash3(vec3 p) {
  p=fract(p*vec3(.1031,.1030,.0973));
  p+=dot(p,p.yxz+33.33);
  return fract((p.x+p.y)*p.z);
}
float cloudNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),
                 mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
                 mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float cloudDensity(vec3 p) {
  float h=(length(p)-earthRadius-1.35)/1.8;
  if(h<=0.0 || h>=1.0) return 0.0;
  vec3 q=vec3(p.x*.92,h*1.35,p.z*.92)+vec3(7.2,2.7,11.8);
  // Advect the density field in kilometres; the observer, sun and horizon stay fixed.
  q.xz-=cloudTime*vec2(.024,.009);
  float cover=cloudNoise(vec3(q.x*.49,3.1,q.z*.49));
  float body=.55*cloudNoise(q)+.26*cloudNoise(q*2.13)+.13*cloudNoise(q*5.17)+.06*cloudNoise(q*10.43);
  float profile=smoothstep(.0,.20,h)*(1.0-smoothstep(.46,1.0,h));
  return 7.0*max(0.0,body-${(world.cloudThreshold || .67).toFixed(3)}+(cover-.5)*.34+.12*profile)*profile;
}
vec4 cloudLayer(vec3 o,vec3 d,vec3 background) {
  float start=shellExit(o,d,earthRadius+1.35);
  float end=shellExit(o,d,earthRadius+3.15);
  // Distant banks fade into the intervening atmosphere at grazing angles.
  float aerial=exp(-.022*start);
  if(aerial<.012) return vec4(background,1);
  float ds=(end-start)/32.0, trans=1.0;
  vec3 light=vec3(0);
  float phase=henyeyGreenstein(dot(d,skyLightDir),.56);
  for(int i=0;i<32;i++){
    vec3 p=o+d*(start+(float(i)+.5)*ds);
    float density=cloudDensity(p);
    if(density<=.0001) continue;
    float sunStep=shellExit(p,skyLightDir,earthRadius+3.15)/5.0;
    float sunDepth=0.0;
    for(int j=0;j<5;j++) sunDepth+=cloudDensity(p+skyLightDir*((float(j)+.5)*sunStep))*sunStep;
    float stepT=exp(-2.8*density*ds);
    vec3 ambient=mix(vec3(.25,.32,.43),vec3(.66,.76,.88),clamp((length(p)-earthRadius-1.35)/1.8,0.0,1.0));
    vec3 source=skyIntensity*(ambient+vec3(1.0,.95,.85)*(13.0*phase+.9)*exp(-2.8*sunDepth));
    light+=trans*(1.0-stepT)*source;
    trans*=stepT;
    if(trans<.008) break;
  }
  return vec4(mix(background,light+trans*background,aerial),trans);
}
void main(){
  float lon=(screenUV.x-.5)*2.0*PI, lat=screenUV.y*.5*PI;
  vec3 d=vec3(cos(lat)*cos(lon),sin(lat),cos(lat)*sin(lon));
  vec3 o=vec3(0,earthRadius+.01,0);
  vec3 clear=physicalSky ? airRadiance(o,d) : clearGradient(d);
  vec4 sky=volumeClouds ? cloudLayer(o,d,clear) : vec4(clear,1);
  gl_FragColor=vec4(sky.rgb/(1.0+sky.rgb),sky.a);
}
`;
}

function skyLookupGLSL(world) {
  if (!world.openSky) return `vec3 sky(vec3 d) {
    return mix(${vec3Literal(world.skyLow || [.15,.18,.19])},${vec3Literal(world.skyHigh || [.83,.91,1])},smoothstep(-.1,.8,d.y));
  }`;
  return /* glsl */ `
  ${skyParameters(world)}
  uniform sampler2D skyMap,nextSkyMap;
  uniform float skyBlend;
  uniform bool physicalSky, volumeClouds;
  vec4 skySample(vec3 d) {
    vec2 uv=vec2(atan(d.z,d.x)/ (2.0*PI)+.5,asin(clamp(d.y,0.0,1.0))*2.0/PI);
    vec4 first=texture2D(skyMap,uv);
    if(skyBlend==0.0) return first;
    return mix(first,texture2D(nextSkyMap,uv),skyBlend);
  }
  float cloudSunlight() { return volumeClouds ? skySample(skyLightDir).a : 1.0; }
  vec3 sky(vec3 d) {
    vec4 env=skySample(d);
    vec3 background=env.rgb/max(vec3(.001),1.0-env.rgb);
    if(physicalSky) background+=vec3(9,8.6,7.7)*skyIntensity*env.a*smoothstep(.999982,.999993,dot(d,skyLightDir));
    ${world.horizon || 'return background;'}
  }`;
}

function volumeTransportGLSL(world) {
  const sunlight = world.openSky && world.sun;
  const ambient = world.fill || [.14,.13,.12];
  return /* glsl */ `
uniform bool volumeFog, volumeLight;
${scatteringPhaseGLSL}
vec3 localEmitter(vec3 p,vec3 ray,vec3 target,vec3 intensity,float g) {
  vec3 delta=target-p;
  float dist=max(length(delta),.001);
  vec3 l=delta/dist;
  if(trace(p,l).t<dist-.025) return vec3(0);
  return intensity*henyeyGreenstein(dot(ray,l),g)/(1.0+dist*dist);
}
vec3 volumeSource(vec3 p,vec3 ray,vec2 uv) {
  ${world.volumeSource || (sunlight ? `
    if(trace(p,skyLightDir).material!=0) return vec3(0);
    return ${vec3Literal(world.radiance)}*PI*henyeyGreenstein(dot(ray,skyLightDir),.35)*cloudSunlight();` : `
    vec3 target=lamp+vec3(uv.x-.5,0,uv.y-.5)*vec3(lampSize.x,0,lampSize.y);
    float cosine=max(0.0,normalize(target-p).y);
    return localEmitter(p,ray,target,lampRadiance*lampSize.x*lampSize.y*cosine,.30);`)}
}
// Integrate exponential height fog exactly. A sample drawn in optical depth
// estimates the shadowed single-scattering source along the same segment.
vec4 volumeSegment(vec3 o,vec3 ray,float hitDistance,vec3 samples) {
  if(!volumeFog && !volumeLight) return vec4(0,0,0,1);
  float len=min(hitDistance,${world.openSky ? '75.0' : '34.0'});
  const float height=${world.openSky ? '3.8' : '4.5'};
  float sigma=(volumeFog ? ${world.openSky ? '.013' : '.018'} : .005)*exp(-max(o.y,0.0)/height);
  if(sigma<1e-8 || len<=0.0) return vec4(0,0,0,1);
  float k=ray.y/height;
  bool levelRay=abs(k*len)<.001;
  float tau=levelRay ? sigma*len : sigma*(1.0-exp(-k*len))/k;
  float trans=exp(-tau);
  vec3 source=volumeFog ? ${vec3Literal(ambient)}*1.45 : vec3(0);
  if(volumeLight){
    float sampleTau=-log(max(.000001,1.0-samples.x*(1.0-trans)));
    float t=levelRay ? sampleTau/sigma : -log(max(.000001,1.0-k*sampleTau/sigma))/k;
    source+=volumeSource(o+ray*clamp(t,0.0,len),ray,samples.yz);
  }
  return vec4(.94*(1.0-trans)*source,trans);
}
`;
}
