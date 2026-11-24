// Diffuse ambient cubes: six directional irradiances at each point of a 3-D grid.
// In the atlas, columns select a direction and rows select a height slice.
const probeLookupGLSL = /* glsl */ `
const vec3 gridSize=vec3(23,12,19);
const vec3 gridLo=vec3(${worlds[studyId]?.gridLo || [-4.26,.035,-2.51]}), gridHi=vec3(${worlds[studyId]?.gridHi || [4.32,4.16,4.60]});
const vec3 ballProbe=vec3(${(worlds[studyId]?.probe || [1.62,.79,.83]).join(',')}), floorProbe=vec3(${(worlds[studyId]?.floorProbe || [-.25,.22,1.48]).join(',')});
const vec2 panoramaSize=vec2(384,192);
uniform sampler2D diffuseAtlas, ballPanorama, floorPanorama;

vec3 irradianceSlice(vec3 g,float axis,float y) {
  vec2 texel=vec2(axis*gridSize.x+g.x,y*gridSize.z+g.z)+0.5;
  vec3 v=texture2D(diffuseAtlas,texel/(gridSize.xz*vec2(6,gridSize.y))).rgb;
  return 2.5*v*v;
}
vec3 irradianceAxis(vec3 g,float axis) {
  float y=floor(g.y);
  return mix(irradianceSlice(g,axis,y),irradianceSlice(g,axis,min(y+1.0,gridSize.y-1.0)),fract(g.y));
}
vec3 storedIrradiance(vec3 p,vec3 n) {
  vec3 g=clamp((p+0.045*n-gridLo)/(gridHi-gridLo),0.0,1.0)*(gridSize-1.0);
  vec3 v=vec3(0.0);
  if(abs(n.x)>0.001) v+=n.x*n.x*irradianceAxis(g,n.x>0.0 ? 0.0 : 1.0);
  if(abs(n.y)>0.001) v+=n.y*n.y*irradianceAxis(g,n.y>0.0 ? 2.0 : 3.0);
  if(abs(n.z)>0.001) v+=n.z*n.z*irradianceAxis(g,n.z>0.0 ? 4.0 : 5.0);
  return v;
}
vec3 storedReflection(vec3 p,vec3 d,bool onBall,bool withGI) {
  // Approximate parallax by projecting the lookup onto the studio bounds.
  vec3 farT=max((vec3(${worlds[studyId]?.reflectionLo || [-4.30,0,-2.55]})-p)*inverseDir(d),(vec3(${worlds[studyId]?.reflectionHi || [4.6,5.8,5]})-p)*inverseDir(d));
  float t=max(0.001,min(min(farT.x,farT.y),farT.z));
  vec3 v=normalize(p+t*d-(onBall ? ballProbe : floorProbe));
  vec2 uv=vec2(atan(v.z,v.x)/(2.0*PI)+0.5,asin(clamp(v.y,-1.0,1.0))/PI+0.5);
  uv.y=(clamp(uv.y,0.5/panoramaSize.y,1.0-0.5/panoramaSize.y)+(withGI ? 1.0 : 0.0))*0.5;
  vec4 e=onBall ? texture2D(ballPanorama,uv) : texture2D(floorPanorama,uv);
  return 12.0*e.rgb*e.rgb${worlds[studyId]?.openSky ? '+e.a*sky(v)' : ''};
}
`;

// Diffuse receivers see only fixed geometry during baking. Reflection probes
// capture the original exhibit and keep separate GI-on and GI-off images.
function bakeStudioProbes(T, renderer, scene, camera, quad, makeMaterial, liveUniforms, geometryUniforms, atmosphereUniforms, previous, rebakeDiffuse) {
  const fixed = { ...geometryUniforms, ...atmosphereUniforms, sceneTime:{value:0}, staticOnly: { value: true }, stageOffset: { value: 0 }, hideMetal: { value: false } };
  const target = (w,h) => new T.WebGLRenderTarget(w,h,{
    type:T.UnsignedByteType, minFilter:T.LinearFilter, magFilter:T.LinearFilter,
    depthBuffer:false, stencilBuffer:false
  });
  const diffuseSamples = world.model ? 32 : 128, directSamples = world.model ? 4 : 16;
  const [volume,ball,floor]=previous?.targets || [target(23*6,19*12),target(384,384),target(384,384)];
  for(const env of [ball,floor]) env.texture.wrapS=T.RepeatWrapping;
  const bakeVolume=makeMaterial(roomTransportGLSL+probeLookupGLSL+`
    void main(){
      vec2 pixel=floor(gl_FragCoord.xy);
      int axis=int(floor(pixel.x/gridSize.x));
      vec3 cell=vec3(mod(pixel.x,gridSize.x),floor(pixel.y/gridSize.z),mod(pixel.y,gridSize.z));
      vec3 p=mix(gridLo,gridHi,cell/(gridSize-1.0));
      vec3 n=vec3(0);
      n[axis/2]=mod(float(axis),2.0)<0.5 ? 1.0 : -1.0;
      vec3 total=vec3(0);
      for(int i=0;i<${diffuseSamples};i++){
        sequenceIndex=float(i);
        total+=bounceLight(p,n,2.0);
      }
      gl_FragColor=vec4(sqrt(clamp(total/(${diffuseSamples}.0*2.5),0.0,1.0)),1);
    }
  `,fixed);
  const captureUniforms={ ...fixed, staticOnly:{value:false}, lightmapMeta:liveUniforms.lightmapMeta, surfaceLightmap:liveUniforms.surfaceLightmap, diffuseAtlas:{ value:volume.texture }, ballPanorama:{ value:null },
    floorCapture:{ value:false } };
  const capture=makeMaterial(roomTransportGLSL+probeLookupGLSL+lightmapLookupGLSL+localVolumeGLSL+`
    uniform bool floorCapture;
    void main(){
      bool withGI=gl_FragCoord.y>=panoramaSize.y;
      vec2 uv=vec2(gl_FragCoord.x,mod(gl_FragCoord.y,panoramaSize.y))/panoramaSize;
      float lon=(uv.x-0.5)*2.0*PI, lat=(uv.y-0.5)*PI;
      vec3 d=vec3(cos(lat)*cos(lon),sin(lat),cos(lat)*sin(lon));
      vec3 o=floorCapture ? floorProbe : ballProbe;
      Hit h=trace(o,d); vec3 color;
      if(h.material==0) color=${world.openSky ? 'vec3(0)' : 'sky(d)'};
      else if(h.material==LIGHT) color=lampRadiance;
      else{
        vec3 p=o+d*h.t, n=faceforward(h.n,d,h.n);
        Surface s=surface(h.material,p,n);
        vec3 diffuse=vec3(0);
        for(int j=0;j<${directSamples};j++){ sequenceIndex=float(j); diffuse+=directIrradiance(p,n,pairSample(1.0)); }
        color=emission(h.material,p,n)+s.color*(diffuse/${directSamples}.0+(withGI ? bakedIrradiance(h,p,n) : vec3(0)));
        if(floorCapture && h.material==METAL){
          float f=pow(1.0-max(dot(-d,n),0.0),5.0);
          color+=mix(s.specular,vec3(1),f)*storedReflection(p,reflect(d,n),true,withGI);
        }
      }
      vec4 medium=vec4(0);
      for(int i=0;i<6;i++){
        sequenceIndex=float(i);
        float stratum=(float(i)+pairSample(31.0).x)/6.0;
        medium+=volumeSegment(o,d,h.t,vec3(stratum,pairSample(41.0)));
      }
      color=(medium.rgb+medium.a*color)/6.0;
      // Preserve sky visibility so animated clouds can appear in a fixed reflection probe.
      gl_FragColor=vec4(sqrt(clamp(color/12.0,0.0,1.0)),h.material==0 ? medium.a/6.0 : 0.0);
    }
  `,captureUniforms);
  const oldTarget=renderer.getRenderTarget(), oldMaterial=quad.material;
  function draw(material, output) {
    quad.material=material;
    renderer.setRenderTarget(output);
    renderer.render(scene,camera);
  }
  let layout=previous?.layout, lightmap=previous?.targets[3];
  let bakeSurface, rawLightmap, filter;
  try {
    if(!layout){
      layout=createLightmapLayout(T,renderer,draw,makeMaterial,fixed);
      lightmap=target(layout.width,layout.height);
      liveUniforms.lightmapMeta.value=layout.metadata;
      liveUniforms.surfaceLightmap.value=lightmap.texture;
    }
    if(!previous || rebakeDiffuse){
      draw(bakeVolume,volume);
      const prefix='#define BAKING_SURFACES\n#define LM_SAMPLES '+(world.model ? 64 : 192)+'\n';
      bakeSurface=makeMaterial(prefix+roomTransportGLSL+probeLookupGLSL+lightmapLookupGLSL+surfaceBakeGLSL,
        {...fixed,lightmapMeta:liveUniforms.lightmapMeta,lightmapChartIDs:{value:layout.chartMap}});
      rawLightmap=target(layout.width,layout.height);
      draw(bakeSurface,rawLightmap);
      filter=makeMaterial(filterLightmapGLSL,{rawLightmap:{value:rawLightmap.texture},
        lightmapMeta:liveUniforms.lightmapMeta,lightmapChartIDs:{value:layout.chartMap}});
      draw(filter,lightmap);
    }
    captureUniforms.hideMetal.value=true;
    draw(capture,ball);
    captureUniforms.hideMetal.value=false;
    captureUniforms.floorCapture.value=true;
    captureUniforms.ballPanorama.value=ball.texture;
    draw(capture,floor);
    liveUniforms.diffuseAtlas.value=volume.texture;
    liveUniforms.ballPanorama.value=ball.texture;
    liveUniforms.floorPanorama.value=floor.texture;
  } catch(error) {
    if(!previous){
      for(const textureTarget of [volume,ball,floor,lightmap]) textureTarget?.dispose();
      layout?.dispose();
      liveUniforms.lightmapMeta.value=null;
      liveUniforms.surfaceLightmap.value=null;
    }
    throw error;
  } finally {
    quad.material=oldMaterial;
    renderer.setRenderTarget(oldTarget);
    bakeSurface?.dispose();
    rawLightmap?.dispose();
    if(rawLightmap){
      // Only the final irradiance and chart rectangles are sampled each frame.
      layout.chartMap.dispose();
      layout.chartMap.needsUpdate=true;
    }
    filter?.dispose();
    bakeVolume.dispose();
    capture.dispose();
  }
  return {layout,targets:[volume,ball,floor,lightmap]};
}
