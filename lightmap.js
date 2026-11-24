// A convex primitive has a unique visible surface for each signed axial projection.
// Store its six charts separately. Parallel planes (including different shelves)
// therefore never share texels. Dynamic hits carry receiver -1.
function lightmapStaticGeometry(world, defaultGeometry) {
  if (world.model) return `
    void traceStatic(inout Hit h,vec3 o,vec3 d,vec3 inv) {
      ${world.geometry}
    }
    #ifdef BAKING_SURFACES
    void traceReceiver(inout Hit h,vec3 o,vec3 d,int id) {
      visitTree(h,o,d,inverseDir(d),id-3,id-2);
    }
    #endif`;

  const geometry = world.geometry || defaultGeometry;
  const primitives = [
    ['boxHit', 'vec3 inv,vec3 lo,vec3 hi,int m', 'inv,lo,hi,m', 'lo', 'hi'],
    ['rodHit', 'vec3 a,vec3 b,float r,int m', 'a,b,r,m', 'min(a,b)-vec3(r)', 'max(a,b)+vec3(r)'],
    ['ellipsoidHit', 'vec3 c,vec3 r,int m', 'c,r,m', 'c-r', 'c+r'],
    ['rockShelf', 'vec3 c,vec2 s,float height,float taper,float angle,int m',
      'c,s,height,taper,angle,m', 'c-vec3(1.16*s.x,0,1.16*s.y)', 'c+vec3(1.16*s.x,height,1.16*s.y)']
  ];
  const mapped = source => source.replace(/\b(boxHit|rodHit|ellipsoidHit|rockShelf|butte)\(/g,'lm_$1(');
  const wrappers = primitives.filter(([name]) => geometry.includes(name) || (name==='rockShelf' && geometry.includes('butte')))
    .map(([name, signature, args, lo, hi]) => `
    void lm_${name}(inout Hit h,vec3 o,vec3 d,${signature}){
      int id=lmNext++;
      #ifdef READING_BOUNDS
        if(id==lmWanted){lmFound=true; lmLo=${lo}; lmHi=${hi};}
      #else
        #ifdef BAKING_SURFACES
          if(lmWanted>=0 && lmWanted!=id) return;
        #endif
        float before=h.t;
        ${name}(h,o,d,${args});
        if(h.t<before) h.receiver=id;
      #endif
    }`).join('\n');
  return `
    int lmNext, lmWanted=-1;
    #ifdef READING_BOUNDS
    vec3 lmLo,lmHi; bool lmFound=false;
    #endif
    ${wrappers}
    ${geometry.includes('butte') ? mapped(butteGeometry) : ''}
    void traceStatic(inout Hit h,vec3 o,vec3 d,vec3 inv){
      lmNext=3;
      ${mapped(geometry)}
    }
    #ifdef BAKING_SURFACES
    void traceReceiver(inout Hit h,vec3 o,vec3 d,int id){
      lmWanted=id; traceStatic(h,o,d,inverseDir(d)); lmWanted=-1;
    }
    #endif`;
}

// Ask the analytic scene itself for primitive bounds. This small readback happens
// once, so loops, material reuse and procedural placements match the tracing code.
function analyticLightmapBounds(T, renderer, draw, makeMaterial, uniforms) {
  const shader = '#define READING_BOUNDS\n' + roomTransportGLSL + `
    void main(){
      lmWanted=int(gl_FragCoord.x)+3;
      Hit h=Hit(FAR,vec3(0),0,-1);
      traceStatic(h,vec3(0),vec3(1),vec3(1));
      int lane=int(gl_FragCoord.y);
      float v=lane<3 ? lmLo[lane] : lmHi[lane-3];
      uint bits=floatBitsToUint(lmFound ? v : 0.0);
      gl_FragColor=vec4(uvec4(bits,bits>>8u,bits>>16u,bits>>24u)&255u)/255.0;
    }`;
  const material=makeMaterial(shader,uniforms);
  let capacity=64;
  try {
    for(;;){
      const target=new T.WebGLRenderTarget(capacity,6,{depthBuffer:false,stencilBuffer:false});
      const bytes=new Uint8Array(capacity*6*4);
      try {
        draw(material,target);
        renderer.readRenderTargetPixels(target,0,0,capacity,6,bytes);
      } finally { target.dispose(); }
      const view=new DataView(bytes.buffer), bounds=[];
      for(let i=0;i<capacity;i++){
        const values=Array.from({length:6},(_,k)=>view.getFloat32(4*(k*capacity+i),true));
        if(values.every(value=>value===0)) return bounds;
        bounds.push({id:i+3,lo:values.slice(0,3),hi:values.slice(3)});
      }
      if(capacity>=renderer.capabilities.maxTextureSize) throw new Error('Static lightmap bounds exceed the WebGL texture limit.');
      capacity=Math.min(2*capacity,renderer.capabilities.maxTextureSize);
    }
  } finally {material.dispose();}
}

function createLightmapLayout(T, renderer, draw, makeMaterial, uniforms) {
  const lo=world.reflectionLo || [-4.30,0,-2.55], hi=world.reflectionHi || [4.6,5.8,5];
  const bounds=[{id:0,lo:[lo[0],0,lo[2]],hi:[hi[0],0,hi[2]],plane:2}];
  if(!world.sun) bounds.push(
    {id:1,lo:[lo[0],0,-2.55],hi:[hi[0],hi[1],-2.55],plane:4},
    {id:2,lo:[-4.3,0,lo[2]],hi:[-4.3,hi[1],hi[2]],plane:0});
  if(world.model){
    const {nodes,movingRoot}=world.model;
    for(let node=0;node<movingRoot;node++){
      const at=node*8;
      if(nodes[at+3]!==0) bounds.push({id:node+3,lo:nodes.slice(at,at+3),hi:nodes.slice(at+4,at+7)});
    }
  } else bounds.push(...analyticLightmapBounds(T,renderer,draw,makeMaterial,uniforms));

  const density=world.model ? 7 : 12; // texels per metre, within the authored scene bounds
  const charts=[], axes=[[1,2],[0,2],[0,1]];
  for(const shape of bounds){
    for(let face=0;face<6;face++){
      if(shape.plane!==undefined && face!==shape.plane) continue;
      const [u,v]=axes[face>>1];
      const size=k=>Math.max(1,Math.ceil((shape.hi[k]-shape.lo[k])*density));
      charts.push({id:shape.id,face,w:size(u),h:size(v)});
    }
  }
  charts.sort((a,b)=>b.h-a.h || b.w-a.w);
  const area=charts.reduce((sum,c)=>sum+c.w*c.h,0);
  const width=Math.max(...charts.map(c=>c.w),2**Math.ceil(Math.log2(Math.sqrt(area))));
  let x=0,y=0,row=0;
  for(const c of charts){
    if(x+c.w>width){y+=row;x=0;row=0;}
    c.x=x;c.y=y;x+=c.w;row=Math.max(row,c.h);
  }
  const height=y+row;
  if(Math.max(width,height)>renderer.capabilities.maxTextureSize) throw new Error('Lightmap atlas exceeds the WebGL texture limit.');
  const dataWidth=512, objectCount=bounds[bounds.length-1].id+1;
  const metaHeight=Math.ceil(objectCount*8/dataWidth);
  const meta=new Float32Array(dataWidth*metaHeight*4);
  const chartIDs=new Uint8Array(width*height*4);
  for(const s of bounds){meta.set(s.lo,s.id*32);meta.set(s.hi,s.id*32+4);}
  for(const c of charts){
    const key=c.id*8+c.face+1;
    meta.set([c.x,c.y,c.w,c.h],c.id*32+(2+c.face)*4);
    for(let j=0;j<c.h;j++) for(let i=0;i<c.w;i++){
      const at=((c.y+j)*width+c.x+i)*4;
      chartIDs[at]=key&255; chartIDs[at+1]=(key>>8)&255; chartIDs[at+2]=key>>16;
    }
  }
  function texture(data,w,h,type){
    const tex=new T.DataTexture(data,w,h,T.RGBAFormat,type);
    tex.needsUpdate=true;
    return tex;
  }
  const metadata=texture(meta,dataWidth,metaHeight,T.FloatType);
  const chartMap=texture(chartIDs,width,height,T.UnsignedByteType);
  return {width,height,metadata,chartMap,dispose(){metadata.dispose();chartMap.dispose();}};
}

const lightmapLookupGLSL = /* glsl */ `
uniform highp sampler2D lightmapMeta, surfaceLightmap;
vec4 chartData(int id,int lane){
  int i=id*8+lane;
  return texelFetch(lightmapMeta,ivec2(i%512,i/512),0);
}
vec2 chartAxes(vec3 p,int axis){
  if(axis==0) return p.yz;
  if(axis==1) return p.xz;
  return p.xy;
}
int chartFace(vec3 n){
  vec3 a=abs(n);
  int axis=a.x>a.y && a.x>a.z ? 0 : (a.y>a.z ? 1 : 2);
  return 2*axis+(n[axis]<0.0 ? 1 : 0);
}
vec3 bakedIrradiance(Hit h,vec3 p,vec3 n){
  if(h.receiver<0) return storedIrradiance(p,n);
  int face=chartFace(n),axis=face/2;
  vec3 lo=chartData(h.receiver,0).xyz,hi=chartData(h.receiver,1).xyz;
  vec2 uv=chartAxes((p-lo)/max(hi-lo,vec3(.00001)),axis);
  // Infinite ground and room planes only have finite lightmap coverage.
  if(any(lessThan(uv,vec2(-.0001))) || any(greaterThan(uv,vec2(1.0001)))) return storedIrradiance(p,n);
  vec4 rect=chartData(h.receiver,2+face);
  if(rect.z<=0.0) return storedIrradiance(p,n);
  vec2 pixel=rect.xy+clamp(uv*rect.zw,vec2(.5),rect.zw-.5);
  vec4 tap=texture2D(surfaceLightmap,pixel/vec2(textureSize(surfaceLightmap,0)));
  if(tap.a<.01) return storedIrradiance(p,n);
  vec3 encoded=tap.rgb/tap.a;
  vec3 indirect=4.0*encoded*encoded;
  if(h.receiver<3){
    // Blend into probes only on open ends of infinite planes. Floor/wall
    // junctions inside the room need the full surface resolution.
    vec2 edge=min(uv,1.0-uv);
    vec2 metres=edge*chartAxes(hi-lo,axis);
    if(${worlds[studyId]?.sun ? 'false' : 'true'}){
      metres=vec2(1.0-uv.x,1.0-uv.y)*chartAxes(hi-lo,axis);
    }
    float fade=smoothstep(0.0,.35,min(metres.x,metres.y));
    if(fade<1.0) indirect=mix(storedIrradiance(p,n),indirect,fade);
  }
  return indirect;
}`;

const surfaceBakeGLSL = /* glsl */ `
uniform highp sampler2D lightmapChartIDs;
void main(){
  ivec3 bytes=ivec3(texelFetch(lightmapChartIDs,ivec2(gl_FragCoord.xy),0).rgb*255.0+.5);
  int key=bytes.x+256*bytes.y+65536*bytes.z-1;
  gl_FragColor=vec4(0);
  if(key<0) return;
  int id=key/8,face=key%8,axis=face/2;
  vec3 lo=chartData(id,0).xyz,hi=chartData(id,1).xyz;
  vec4 rect=chartData(id,2+face);
  vec2 uv=(gl_FragCoord.xy-rect.xy)/rect.zw;
  vec3 fraction=axis==0 ? vec3(0,uv) : (axis==1 ? vec3(uv.x,0,uv.y) : vec3(uv,0));
  vec3 p=mix(lo,hi,fraction),n=vec3(0);
  n[axis]=face%2==0 ? 1.0 : -1.0;
  if(id>=3){
    vec3 start=p;
    start[axis]=n[axis]>0.0 ? hi[axis]+.02 : lo[axis]-.02;
    Hit h=Hit(FAR,vec3(0),0,-1);
    traceReceiver(h,start,-n,id);
    if(h.material==0) return;
    p=start-n*h.t;
    n=faceforward(h.n,-n,h.n);
  }
  vec3 total=vec3(0);
  for(int i=0;i<LM_SAMPLES;i++){
    sequenceIndex=float(i);
    total+=bounceLight(p,n,2.0);
  }
  gl_FragColor=vec4(sqrt(clamp(total/(4.0*float(LM_SAMPLES)),0.0,1.0)),1);
}`;

// Average in linear light, within one receiver chart. Empty edge texels never
// darken the valid samples; their coverage is used again during bilinear lookup.
const filterLightmapGLSL = /* glsl */ `
precision highp float;
uniform highp sampler2D rawLightmap, lightmapChartIDs, lightmapMeta;
void main(){
  ivec2 pixel=ivec2(gl_FragCoord.xy);
  ivec3 bytes=ivec3(texelFetch(lightmapChartIDs,pixel,0).rgb*255.0+.5);
  int key=bytes.x+256*bytes.y+65536*bytes.z-1;
  gl_FragColor=vec4(0);
  if(key<0) return;
  int lane=(key/8)*8+2+(key%8);
  ivec4 rect=ivec4(texelFetch(lightmapMeta,ivec2(lane%512,lane/512),0));
  vec3 sum=vec3(0);float weights=0.0;
  for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++){
    ivec2 q=clamp(pixel+ivec2(x,y),rect.xy,rect.xy+rect.zw-1);
    vec4 sampleValue=texelFetch(rawLightmap,q,0);
    float w=exp(-.55*float(x*x+y*y))*sampleValue.a;
    sum+=w*sampleValue.rgb*sampleValue.rgb;
    weights+=w;
  }
  if(weights>0.0) gl_FragColor=vec4(sqrt(sum/weights),1);
}`;
