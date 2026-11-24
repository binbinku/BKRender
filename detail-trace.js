// The static architecture and the movable exhibit each get a bounding-volume tree.
// Nodes are stored in preorder, so a ray can skip a missed subtree in one texture read pair.
function buildDetailModel(build) {
  const groups = [[], []], palette = [], records = [], nodes = [], signs = [];
  let group = 0, seed = 27429, transform = [0, 0, 0, 0];
  const add = (a,b) => a.map((v,i)=>v+b[i]);
  const sub = (a,b) => a.map((v,i)=>v-b[i]);
  const mul = (a,k) => a.map(v=>v*k);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit = a => mul(a,1/Math.hypot(...a));
  const rotate = (v,a) => [Math.cos(a)*v[0]+Math.sin(a)*v[2],v[1],-Math.sin(a)*v[0]+Math.cos(a)*v[2]];
  const point = p => add(rotate(p,transform[3]),transform);
  const coordinateAxes = [[1,0,0],[0,1,0],[0,0,1]];
  function shape(kind, center, size, mat, axes = coordinateAxes) {
    const c = point(center), basis = axes.map((v,i)=>mul(rotate(v,transform[3]),size[i]/2));
    const delta = c.map((_,i)=>basis.reduce((s,v)=>s+Math.abs(v[i]),0));
    const flat = kind === 1 && basis.every(v=>v.filter(x=>Math.abs(x)>.000001).length===1);
    let key = -1-mat;
    if (!flat) {
      key = records.length/16+1;
      const reciprocal = basis.map(v=>mul(v,1/v.reduce((s,x)=>s+x*x,0)));
      records.push(...c,kind,...reciprocal[0],mat,...reciprocal[1],0,...reciprocal[2],0);
    }
    groups[group].push({lo:sub(c,delta),hi:add(c,delta),key});
  }
  function triangle(a,b,c,mat) {
    const p = point(a), q = point(b), r = point(c), key = records.length/16+1;
    records.push(...p,4,...sub(q,p),mat,...sub(r,p),0,0,0,0,0);
    groups[group].push({lo:p.map((v,i)=>Math.min(v,q[i],r[i])-.0001),hi:p.map((v,i)=>Math.max(v,q[i],r[i])+.0001),key});
  }
  const api = {
    material(rgb, spec=0, pattern=0, glow=0) {
      palette.push(...rgb,spec,pattern,glow,0,0,0,0,0,0,0,0,0,0);
      return 15+palette.length/16;
    },
    sign(x,y,z,w,h,title,subtitle,bg,ink) {
      const m=api.material([1,1,1],0,6), i=palette.length-16;
      const c=point([x,y,z]), axis=rotate([1,0,0],transform[3]);
      palette[i+6]=signs.length; palette.splice(i+8,8,...c,w,...axis,h);
      signs.push({title,subtitle,bg,ink,w,h});
      shape(1,[x,y,z],[w,h,.025],m);
    },
    random() {seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296;},
    place(x,y,z,yaw,fn) {
      const previous=transform;
      transform=[...point([x,y,z]),previous[3]+yaw]; fn(); transform=previous;
    },
    movable(fn) {group=1; fn(); group=0;},
    box(x,y,z,w,h,d,m) {shape(1,[x,y,z],[w,h,d],m);},
    oval(x,y,z,w,h,d,m) {shape(2,[x,y,z],[w,h,d],m);},
    beam(a,b,w,d,m,cylinder=false) {
      const axis=unit(sub(b,a));
      const side=unit(cross(axis,Math.abs(axis[2])<.96 ? [0,0,1] : [1,0,0]));
      shape(cylinder ? 3 : 1,mul(add(a,b),.5),[w,Math.hypot(...sub(b,a)),d],m,[side,axis,cross(side,axis)]);
    },
    triangle,
    quad(a,b,c,d,m) {triangle(a,b,c,m);triangle(a,c,d,m);}
  };
  build(api);
  function tree(items) {
    const lo=[Infinity,Infinity,Infinity], hi=lo.map(()=>-Infinity);
    for(const item of items) for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],item.lo[k]);hi[k]=Math.max(hi[k],item.hi[k]);}
    const index=nodes.length;
    nodes.push([...lo,items.length===1 ? items[0].key : 0,...hi,0]);
    if(items.length>1){
      const span=sub(hi,lo), k=span.indexOf(Math.max(...span));
      items.sort((a,b)=>(a.lo[k]+a.hi[k])-(b.lo[k]+b.hi[k]));
      const middle=items.length>>1;
      tree(items.slice(0,middle)); tree(items.slice(middle));
    }
    nodes[index][7]=nodes.length;
  }
  tree(groups[0]);
  const movingRoot=nodes.length;
  tree(groups[1]);
  return {nodes:nodes.flat(),records,palette,signs,movingRoot,nodeCount:nodes.length};
}

function detailUniforms(T, model) {
  function atlas(values) {
    const width=512, height=Math.max(1,Math.ceil(values.length/(4*width)));
    const data=new Float32Array(4*width*height);
    data.set(values);
    const texture=new T.DataTexture(data,width,height,T.RGBAFormat,T.FloatType);
    texture.needsUpdate=true;
    return {value:texture};
  }
  const board=document.createElement('canvas');
  board.width=512; board.height=128*Math.max(model.signs.length,1);
  const ctx=board.getContext('2d');
  model.signs.forEach(({title,subtitle,bg,ink,w,h},i)=>{
    ctx.save(); ctx.translate(0,i*128);ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);
    ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.strokeRect(6,6,500,116);
    ctx.fillStyle=ink;ctx.textAlign='center';
    ctx.scale(512/(128*w/h),1);
    const width=128*w/h;
    ctx.font='bold '+(subtitle ? 66 : 79)+'px Georgia, serif';
    ctx.fillText(title,width/2,subtitle ? 77 : 91,width*.87);
    if(subtitle){ctx.font='21px Georgia, serif';ctx.fillText(subtitle,width/2,106,width*.8);}
    ctx.restore();
  });
  const labels=new T.DataTexture(new Uint8Array(ctx.getImageData(0,0,board.width,board.height).data.buffer),
    board.width,board.height,T.RGBAFormat,T.UnsignedByteType);
  labels.minFilter=T.LinearFilter; labels.magFilter=T.LinearFilter; labels.needsUpdate=true;
  return {signTable:{value:labels},nodeTable:atlas(model.nodes), shapeTable:atlas(model.records), paintTable:atlas(model.palette)};
}

function installDetailWorld(build, settings) {
  const model=buildDetailModel(build);
  return {...settings, model, shapeHelpers:trianglePrimitive+`
    uniform highp sampler2D nodeTable,shapeTable,paintTable,signTable;
    ivec2 address(int i){return ivec2(i%512,i/512);}
    void visitTree(inout Hit h,vec3 o,vec3 d,vec3 inv,int first,int end){
      int i=first;
      while(i<end){
        vec4 a=texelFetch(nodeTable,address(2*i),0), b=texelFetch(nodeTable,address(2*i+1),0);
        vec3 t0=(a.xyz-o)*inv,t1=(b.xyz-o)*inv, nearT=min(t0,t1), farT=max(t0,t1);
        float entry=max(nearT.x,max(nearT.y,nearT.z)), leave=min(farT.x,min(farT.y,farT.z));
        if(leave<max(entry,EPS) || entry>=h.t){i=int(b.w); continue;}
        i++;
        int key=int(a.w);
        if(key==0) continue;
        if(key<0){
          float t=entry>EPS ? entry : leave;
          vec3 n=entry>EPS ? -sign(d)*step(vec3(entry),nearT) : sign(d)*step(farT,vec3(leave));
          recordReceiver(h,t,normalize(n),-key-1,i+2);
          continue;
        }
        int base=4*(key-1);
        vec4 c=texelFetch(shapeTable,address(base),0), u=texelFetch(shapeTable,address(base+1),0);
        vec3 v=texelFetch(shapeTable,address(base+2),0).xyz;
        int m=int(u.w);
        if(c.w==4.0){
          float before=h.t;
          triangleHit(h,o,d,c.xyz,c.xyz+u.xyz,c.xyz+v,m);
          if(h.t<before) h.receiver=i+2;
          continue;
        }
        vec3 w=texelFetch(shapeTable,address(base+3),0).xyz;
        mat3 axes=mat3(u.xyz,v,w);
        vec3 q=(o-c.xyz)*axes, rd=d*axes, normal;
        float t;
        if(c.w==1.0){
          vec3 ri=inverseDir(rd), x=(-1.0-q)*ri,y=(1.0-q)*ri;
          vec3 en=min(x,y),ex=max(x,y);
          float enter=max(en.x,max(en.y,en.z)), exitT=min(ex.x,min(ex.y,ex.z));
          if(exitT<max(enter,EPS)) continue;
          t=enter>EPS ? enter : exitT;
          normal=enter>EPS ? -sign(rd)*step(vec3(enter),en) : sign(rd)*step(ex,vec3(exitT));
        }else{
          bool tube=c.w==3.0;
          vec3 mask=tube ? vec3(1,0,1) : vec3(1);
          float aa=dot(rd,rd*mask), bb=dot(q,rd*mask), cc=dot(q,q*mask)-1.0, disc=bb*bb-aa*cc;
          t=FAR; normal=vec3(0,1,0);
          if(disc>=0.0 && aa>1e-10){
            float root=sqrt(disc);
            for(int s=0;s<2;s++){
              float tt=(-bb+(s==0 ? -root : root))/aa;
              if(tt>EPS && tt<t && (!tube || abs(q.y+tt*rd.y)<=1.0)){
                t=tt;normal=(q+t*rd)*mask;
              }
            }
          }
          if(tube && abs(rd.y)>1e-8){
            for(int s=0;s<2;s++){
              float side=float(2*s-1),tt=(side-q.y)/rd.y;
              if(tt>EPS && tt<t && length(q.xz+tt*rd.xz)<=1.0){t=tt;normal=vec3(0,side,0);}
            }
          }
        }
        recordReceiver(h,t,normalize(axes*normal),m,i+2);
      }
    }`,
    geometry:`visitTree(h,o,d,inv,0,${model.movingRoot});`,
    movingGeometry:`visitTree(h,o-vec3(stageOffset,${settings.boatLift ? 'boatLift()' : '0.0'},0),d,inv,${model.movingRoot},${model.nodeCount});`,
    helpers:landscapeNoise,
    surface:`if(m==FLOOR){${settings.floor}}
    int k=4*(m-16); vec4 paint=texelFetch(paintTable,address(k),0);
    int pattern=int(texelFetch(paintTable,address(k+1),0).x);
    if(pattern==6){
      vec4 panel=texelFetch(paintTable,address(k+2),0),axis=texelFetch(paintTable,address(k+3),0);
      vec3 delta=p-panel.xyz;
      vec2 st=clamp(vec2(.5+dot(delta,axis.xyz)/panel.w,.5-delta.y/axis.w),.001,.999);
      st.y=(texelFetch(paintTable,address(k+1),0).z+st.y)/${Math.max(model.signs.length,1)}.0;
      return Surface(pow(texture2D(signTable,st).rgb,vec3(2.2)),vec3(0));
    }
    float factor=1.0;
    if(pattern==1){ // varnished timber with long, irregular fibres
      vec2 v=abs(n.y)>.6 ? p.xz : uv;
      factor=.76+.20*landNoise(v*vec2(2.4,16))+.09*sin(68.0*v.y+3.0*landNoise(v*4.0));
    }else if(pattern==2){ // hand-set masonry
      vec2 v=uv; v.x+=mod(floor(v.y/.27),2.0)*.34;
      factor=mix(.62,1.0,joints(v,vec2(.68,.27),.013))*(.91+.12*landNoise(uv*8.0));
    }else if(pattern==3){ // standing seams in folded metal or fired pantiles
      factor=.78+.22*smoothstep(.025,.11,abs(fract((p.x+p.z)*4.0)-.5));
    }else if(pattern==4){
      factor=.86+.17*landNoise(uv*4.6)+.04*speck;
    }else if(pattern==5){ // leaves in clusters
      factor=.62+.40*landNoise(uv*17.0)+.13*landNoise(uv*4.0);
    }
    if(pattern==8){ // Sunlit trees seen through the old translucent panes
      float sway=.066*sin(.85*sceneTime+1.4*p.x)+.018*sin(2.1*sceneTime+3.0*p.x);
      float crown=.44*sin((p.x+sway)*2.1)+.22*sin(p.x*4.6+.8)+landNoise((p.xy+vec2(sway,0))*3.1)*.72;
      float nearTree=1.0-smoothstep(.0,.15,p.y-1.43-crown);
      float farTree=1.0-smoothstep(.0,.17,p.y-2.04-.26*sin(p.x*4.1)-landNoise((p.xy+vec2(sway*.32,0))*4.8)*.44);
      return Surface(mix(mix(vec3(.56,.77,.84),vec3(.35,.48,.32),farTree),vec3(.17,.30,.18),nearTree),vec3(0));
    }
    if(pattern==7 && abs(n.y)<.4) {
      float y=fract((p.y-.405)/.51);
      float stamp=max(1.0-smoothstep(.008,.023,abs(y-.12)),1.0-smoothstep(.010,.025,abs(y-.47)));
      return Surface(mix(paint.rgb,vec3(.53,.36,.17),stamp*.86),vec3(0));
    }
    return Surface(paint.rgb*factor,vec3(paint.a));`,
    emission:`if(m<16) return vec3(0);int k=4*(m-16);
      vec2 style=texelFetch(paintTable,address(k+1),0).xy;
      if(style.x==8.0)return surface(m,p,n).color*1.12;
      float power=style.y;
      return power*texelFetch(paintTable,address(k),0).rgb;`
  };
}
