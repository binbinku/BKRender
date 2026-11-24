// Reproject primary diffuse irradiance and in-scattered light separately.
// Surface materials, emission and reflected rays are shaded at output resolution.
const lightingGeometryGLSL = /* glsl */ `
uniform sampler2D diffuseHistory, diffuseGeometry, volumeHistory;
uniform vec2 diffuseSize;

int surfaceKey(Hit h) {
  // Small primitive/material fingerprint alongside the depth and normal tests.
  if(h.material==0) return 0;
  return 1+(13*(h.receiver+1)+167*h.material)%255;
}
vec2 octSign(vec2 v) { return mix(vec2(-1),vec2(1),step(vec2(0),v)); }
vec4 encodeDiffuseSurface(vec3 n,float depth,int key) {
  n/=abs(n.x)+abs(n.y)+abs(n.z);
  vec2 oct=n.z>=0.0 ? n.xy : (1.0-abs(n.yx))*octSign(n.xy);
  uvec2 normalBits=uvec2(round((oct*.5+.5)*63.0));
  uint z=uint(round(log2(1.0+depth)*409.5));
  // RGBA8: 12 bits for the octahedral normal, 12 for log depth, 8 for the key.
  return vec4(uvec4(normalBits.x*4u+((z>>8u)&3u),normalBits.y*4u+(z>>10u),z&255u,uint(key)))/255.0;
}
struct LightingFootprint {
  vec2 uv, tangent;
  vec3 normal, viewNormal;
  float depth, planeDot;
  int key;
};
LightingFootprint lightingFootprint(vec3 p,vec3 n,int key,mat4 cameraPose,vec2 tangent) {
  mat3 worldToView=transpose(mat3(cameraPose));
  vec3 v=worldToView*(p-cameraPose[3].xyz);
  float depth=-v.z;
  vec3 viewNormal=worldToView*n;
  vec2 uv=.5+.5*v.xy/(max(depth,.0001)*tangent);
  return LightingFootprint(uv,tangent,n,viewNormal,depth,dot(viewNormal,v)/max(depth,.0001),key);
}
vec2 geometryWeights(LightingFootprint f,ivec2 pixel) {
  if(any(lessThan(pixel,ivec2(0))) || any(greaterThanEqual(pixel,ivec2(diffuseSize)))) return vec2(0);
  uvec4 bits=uvec4(round(texelFetch(diffuseGeometry,pixel,0)*255.0));
  uint z=bits.z+((bits.x&3u)<<8u)+((bits.y&3u)<<10u);
  float depth=exp2(float(z)/409.5)-1.0;
  // The air path is continuous across different materials at similar depths.
  float dz=abs(depth-f.depth);
  float airWeight=1.0-smoothstep(.008,.04,dz/max(f.depth,.1));
  if(int(bits.w)!=f.key || dz>max(.08,.06*f.depth)) return vec2(0,airWeight);
  vec2 oct=vec2(bits.xy>>2u)*(2.0/63.0)-1.0;
  vec3 n=vec3(oct,1.0-abs(oct.x)-abs(oct.y));
  if(n.z<0.0) n.xy=(1.0-abs(n.yx))*octSign(n.xy);
  float normalWeight=smoothstep(.88,.98,dot(f.normal,normalize(n)));
  // Compare distance from the receiver's plane, allowing sloped floors to match.
  vec2 delta=((vec2(pixel)+.5)/diffuseSize-f.uv)*2.0*f.tangent;
  float planeError=abs((depth-f.depth)*f.planeDot+depth*dot(f.viewNormal.xy,delta));
  float tolerance=.003+.0016*f.depth;
  return vec2(normalWeight*(1.0-smoothstep(tolerance,2.0*tolerance,planeError)),airWeight);
}
vec3 readIrradiance(vec3 encoded) { return encoded/max(1.0-encoded,vec3(.001)); }
`;

const primaryResolveGLSL = /* glsl */ `
void resolvePrimary(Hit hit,vec3 eye,vec3 ray,vec3 mediumSamples,out vec3 diffuse,out vec4 medium) {
  vec3 p=eye+ray*hit.t;
  vec3 n=hit.material==0 ? -ray : faceforward(hit.n,ray,hit.n);
  vec2 tangent=tanHalfFov*vec2(resolution.x/resolution.y,1);
  LightingFootprint f=lightingFootprint(p,n,surfaceKey(hit),cameraWorld,tangent);
  vec2 grid=f.uv*diffuseSize-.5;
  ivec2 center=ivec2(floor(grid+.5));
  bool gatherGI=useGI && !bakedMode && hit.material!=0 && hit.material!=LIGHT;
  diffuse=vec3(0);
  medium=vec4(0);
  vec2 weights=vec2(0);
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    ivec2 pixel=center+ivec2(x,y);
    vec2 match=geometryWeights(f,pixel);
    vec2 offset=abs(vec2(pixel)-grid);
    float gaussian=exp(-.65*dot(offset,offset));
    if(gatherGI && match.x>0.0){
      vec4 sampleGI=texelFetch(diffuseHistory,pixel,0);
      float bilinear=max(1.0-offset.x,0.0)*max(1.0-offset.y,0.0);
      float confidence=smoothstep(2.0,16.0,sampleGI.a*255.0);
      float w=match.x*mix(gaussian,bilinear,confidence);
      diffuse+=readIrradiance(sampleGI.rgb)*w;
      weights.x+=w;
    }
    if(volumeLight && match.y>0.0){
      float w=match.y*gaussian;
      vec4 air=texelFetch(volumeHistory,pixel,0);
      medium+=vec4(readIrradiance(air.rgb),air.a)*w;
      weights.y+=w;
    }
  }
  // A subpixel receiver may be absent from the lighting buffer.
  if(weights.x>.001) diffuse/=weights.x;
  else if(gatherGI) diffuse=bounceLight(p,n,2.0);
  if(weights.y>.001) medium/=weights.y;
  else medium=volumeSegment(eye,ray,hit.t,mediumSamples);
}
`;

function createLightingHistory(T, makeMaterial, uniforms, floatTargets, draw) {
  const pass = makeMaterial(roomTransportGLSL + localVolumeGLSL + lightingGeometryGLSL + /* glsl */ `
    uniform mat4 previousCamera;
    uniform vec2 previousTangent;
    uniform bool historyValid;
    layout(location=1) out highp vec4 geometryOut;
    layout(location=2) out highp vec4 volumeOut;

    void main() {
      vec2 tangent=tanHalfFov*vec2(resolution.x/resolution.y,1);
      vec3 ray=normalize(mat3(cameraWorld)*vec3((screenUV*2.0-1.0)*tangent,-1));
      vec3 eye=cameraWorld[3].xyz;
      Hit h=trace(eye,ray);
      vec3 p=eye+ray*h.t, n=h.material==0 ? -ray : faceforward(h.n,ray,h.n);
      int key=surfaceKey(h);
      geometryOut=encodeDiffuseSurface(n,dot(eye-p,cameraWorld[2].xyz),key);

      vec3 history=vec3(0), oldAir=vec3(0);
      float support=0.0, age=0.0;
      LightingFootprint f=lightingFootprint(p,n,key,previousCamera,previousTangent);
      bool stable=${world.boatLift ? 'motionDelta==0.0 || h.receiver>=0 || h.material==0 || h.material==LIGHT' : 'true'};
      if(historyValid && stable && f.depth>0.0 && all(greaterThanEqual(f.uv,vec2(0))) && all(lessThan(f.uv,vec2(1)))){
        vec2 grid=f.uv*diffuseSize-.5;
        ivec2 base=ivec2(floor(grid));
        vec2 sub=fract(grid);
        for(int y=0;y<=1;y++) for(int x=0;x<=1;x++){
          ivec2 pixel=base+ivec2(x,y);
          vec2 interp=mix(1.0-sub,sub,vec2(x,y));
          float w=interp.x*interp.y*geometryWeights(f,pixel).x;
          if(w<=.0001) continue;
          vec4 sampleGI=texelFetch(diffuseHistory,pixel,0);
          history+=readIrradiance(sampleGI.rgb)*w;
          if(volumeLight) oldAir+=readIrradiance(texelFetch(volumeHistory,pixel,0).rgb)*w;
          age+=sampleGI.a*255.0*w;
          support+=w;
        }
      }
      if(support>.1){
        history/=support;
        oldAir/=support;
        // Limited, partially visible history yields quickly to fresh lighting.
        age=min(age,motionDelta>0.0 ? min(31.0,1.0/(exp(2.0*motionDelta)-1.0)) : 63.0);
      } else { age=0.0; }
      int rays=age<1.0 ? 4 : 1;
      vec3 irradiance=vec3(0);
      if(useGI && !bakedMode && h.material!=0 && h.material!=LIGHT) for(int i=0;i<4;i++){
        if(i>=rays) break;
        sequenceIndex=sampleNumber+float(i)*193.0;
        irradiance+=bounceLight(p,n,2.0);
      }
      float lengthNow=age+float(rays);
      irradiance=(history*age+irradiance)/lengthNow;
      gl_FragColor=vec4(irradiance/(1.0+irradiance),lengthNow/255.0);
      volumeOut=vec4(0,0,0,1);
      if(volumeLight){
        int strata=age<1.0 ? 8 : 4;
        vec4 air=vec4(0);
        for(int i=0;i<8;i++){
          if(i>=strata) break;
          sequenceIndex=sampleNumber+float(i)*157.0;
          float t=(float(i)+pairSample(31.0).x)/float(strata);
          air+=volumeSegment(eye,ray,h.t,vec3(t,pairSample(41.0)));
        }
        air/=float(strata);
        // Even on the same receiver a translated camera sees a different shaft.
        float travel=distance(eye,previousCamera[3].xyz);
        float airAge=min(age,10.0)*exp(-2.0*travel);
        air.rgb=mix(air.rgb,oldAir,airAge/(airAge+float(strata)));
        volumeOut=vec4(air.rgb/(1.0+air.rgb),air.a);
      }
    }
  `, {...uniforms, previousCamera:{value:uniforms.cameraWorld.value.clone()},
    previousTangent:{value:new T.Vector2(1,1)}, historyValid:{value:false}});

  const targets = Array.from({length:2}, () => {
    const target = new T.WebGLRenderTarget(1,1,{count:3,
      type:floatTargets ? T.HalfFloatType : T.UnsignedByteType,
      minFilter:T.NearestFilter, magFilter:T.NearestFilter, depthBuffer:false, stencilBuffer:false});
    target.textures[1].type=T.UnsignedByteType;
    return target;
  });
  let index=0;
  return {
    reset() { pass.uniforms.historyValid.value=false; },
    release() {
      for(const target of targets) target.dispose();
      pass.uniforms.historyValid.value=false;
      uniforms.diffuseHistory.value=null;
      uniforms.diffuseGeometry.value=null;
      uniforms.volumeHistory.value=null;
    },
    render() {
      const width=Math.ceil(uniforms.resolution.value.x/2), height=Math.ceil(uniforms.resolution.value.y/2);
      const input=targets[1-index], output=targets[index];
      if(output.width!==width || output.height!==height){
        for(const target of targets) target.setSize(width,height);
        pass.uniforms.historyValid.value=false;
      }
      uniforms.diffuseSize.value.set(width,height);
      uniforms.diffuseHistory.value=input.textures[0];
      uniforms.diffuseGeometry.value=input.textures[1];
      uniforms.volumeHistory.value=input.textures[2];
      draw(pass,output);
      uniforms.diffuseHistory.value=output.textures[0];
      uniforms.diffuseGeometry.value=output.textures[1];
      uniforms.volumeHistory.value=output.textures[2];
      pass.uniforms.previousCamera.value.copy(uniforms.cameraWorld.value);
      pass.uniforms.previousTangent.value.set(uniforms.resolution.value.x/uniforms.resolution.value.y,1)
        .multiplyScalar(uniforms.tanHalfFov.value);
      pass.uniforms.historyValid.value=true;
      index=1-index;
    }
  };
}
