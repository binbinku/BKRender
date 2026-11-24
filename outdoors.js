// Outdoor environments share the original comparison controls, but light comes
// from a distant sun and the horizon stays visible to reflected rays.
const outdoorBounds = {
  openSky: true,
  gridLo: [-5.8,.04,-4.8], gridHi: [5.8,4.8,5.4],
  reflectionLo: [-12,0,-14], reflectionHi: [12,10,12]
};
const landscapeNoise = /* glsl */ `
float landHash(vec2 v) {
  vec3 q=fract(vec3(v.xyx)*vec3(.1031,.1030,.0973));
  q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z);
}
float landNoise(vec2 v) {
  vec2 i=floor(v), f=fract(v); f=f*f*(3.0-2.0*f);
  return mix(mix(landHash(i),landHash(i+vec2(1,0)),f.x),
             mix(landHash(i+vec2(0,1)),landHash(i+vec2(1,1)),f.x),f.y);
}
float ridgeNoise(float a) {
  return .55*landNoise(vec2(a*17.0,3.2))+.29*landNoise(vec2(a*47.0,9.5))
         +.16*landNoise(vec2(a*123.0,1.8));
}
`;
const trianglePrimitive = /* glsl */ `
void triangleHit(inout Hit hit,vec3 o,vec3 d,vec3 a,vec3 b,vec3 c,int material) {
  vec3 e=b-a, f=c-a, q=cross(d,f);
  float det=dot(e,q);
  if(abs(det)<.000001) return;
  vec3 delta=o-a, r=cross(delta,e);
  float u=dot(delta,q)/det, v=dot(d,r)/det;
  if(u>=0.0 && v>=0.0 && u+v<=1.0)
    recordHit(hit,dot(f,r)/det,normalize(cross(e,f)),material);
}
`;
// Slopes of a broad swell and shorter crossing waves, in world metres.
function waterNormals(flowX,flowZ,alongCreek=false) {
  return `
    if(m!=FLOOR) return n;
    vec2 bed=p.xz;
    ${alongCreek ? 'bed.y-=.23*p.x+.24*sin(1.12*p.x)+.21*sin(.41*p.x);' : ''}
    vec2 q=bed-vec2(${flowX},${flowZ})*sceneTime;
    float swell=sin(q.x*1.8+q.y*3.3);
    vec2 ripple=vec2(.014*sin(14.0*q.y+3.0*sin(1.7*q.x))+.009*cos(5.7*q.x+9.0*q.y),
                     .024*sin(12.2*q.y+1.3*cos(2.7*q.x))+.008*sin(24.0*bed.y-bed.x+.9*sceneTime));
    vec2 slope=(ripple+vec2(.013,.026)*swell)/(1.0+.012*dot(p.xz,p.xz));
    return normalize(n+vec3(slope.x,0,slope.y));`;
}

worlds.lake = {
  ...outdoorBounds, sun:[-.67,.73,.62], radiance:[1.60,1.46,1.22], fill:[.17,.24,.30],
  floorProbe:[-.20,.12,1.30], probe:[-1.30,.48,-.75],
  shapeHelpers:trianglePrimitive, helpers:landscapeNoise,
  geometry: `
    boxHit(h,o,d,inv,vec3(-3.55,.15,-.80),vec3(-2.51,.34,2.76),ACCENT);
    for(int i=0;i<4;i++){
      vec2 xz=vec2(i<2 ? -3.50 : -2.55,mod(float(i),2.0)<.5 ? -.68 : 2.63);
      rodHit(h,o,d,vec3(xz.x,-.02,xz.y),vec3(xz.x,.65,xz.y),.071,DARK);
    }`,
  movingGeometry: `
    vec3 boat=vec3(-1.28+stageOffset,boatLift(),-.80);
    vec3 q=o-boat;
    ellipsoidHit(h,q,d,vec3(0,.095,0),vec3(1.12,.235,.35),TRIM);
    ellipsoidHit(h,q,d,vec3(0,.252,0),vec3(1.015,.083,.30),STEP);
    rodHit(h,q,d,vec3(.14,.28,0),vec3(.14,2.63,0),.024,DARK);
    rodHit(h,q,d,vec3(-.94,.48,.015),vec3(.14,.55,.015),.020,DARK);
    triangleHit(h,q,d,vec3(-.94,.51,.02),vec3(.09,.57,.02),vec3(.09,2.53,.02),SIGN);
    triangleHit(h,q,d,vec3(.22,.63,-.01),vec3(.97,.42,-.01),vec3(.21,2.24,-.01),PRINTMAT);
    rodHit(h,q,d,vec3(.14,2.58,0),vec3(1.03,.28,0),.009,DARK);`,
  surface: `
    if(m==FLOOR) return Surface(vec3(.012,.075,.090),vec3(.44,.51,.54));
    if(m==SIGN) {
      float seam=smoothstep(.0,.018,abs(fract(p.y*3.9)-.5));
      vec3 cloth=mix(vec3(.63,.043,.016),vec3(.91,.090,.030),seam);
      if(p.y>1.62 && p.y<1.72) cloth=vec3(.99,.73,.42);
      return Surface(cloth,vec3(0));
    }
    if(m==PRINTMAT) return Surface(vec3(.93,.85,.66)*(.94+.06*speck),vec3(0));
    if(m==TRIM) return Surface(p.y>.21 ? vec3(.77,.62,.38) : vec3(.090,.19,.22),vec3(.09));
    if(m==STEP) return Surface(vec3(.86,.80,.65),vec3(0));
    if(m==ACCENT){
      float board=joints(p.xz,vec2(1.12,.205),.012);
      float grain=.80+.16*landNoise(vec2(p.x*3.1,p.z*65.0));
      return Surface(vec3(.35,.215,.117)*grain*mix(.40,1.0,board),vec3(0));
    }
    return Surface(vec3(.28,.21,.14),vec3(0));`,
  normal:waterNormals(.11,.08), boatLift:.035,
  skyLow:[.94,1.16,1.27], skyHigh:[.18,.51,.84],
  horizon: `
    float a=atan(d.x,-d.z), y=d.y;
    float peak=max(.174*(1.0-abs(sin((a+.36)*3.7))),.135*(1.0-abs(sin((a-.28)*4.4))));
    float ridge=.037+peak+.033*(ridgeNoise(a)-.5);
    if(y<ridge){
      float veins=landNoise(vec2(34.0*a+28.0*y,26.0*y))+.40*landNoise(vec2(a*90.0,y*87.0));
      float facet=.54+.32*sin(a*25.0-31.0*y)+.15*veins;
      vec3 granite=mix(vec3(.12,.22,.31),vec3(.45,.53,.55),clamp(facet,0.0,1.0));
      float snow=smoothstep(.102,.123,y+.026*(veins-.70)+.012*sin(39.0*a-25.0*y));
      background=mix(granite,mix(vec3(.59,.76,.85),vec3(1.30,1.32,1.23),clamp(facet,0.,1.)),snow);
    }
    float nearRidge=.023+.068*(.5+.5*sin(5.0*a+.6))+.052*(ridgeNoise(a+2.)-.4);
    if(y<nearRidge) background=mix(vec3(.085,.17,.19),vec3(.15,.29,.28),ridgeNoise(a*3.4));
    float tree=.008+.020*ridgeNoise(a*2.)+.010*(1.0-abs(fract(a*183.0)*2.0-1.0));
    if(y<tree) background=mix(vec3(.034,.096,.097),vec3(.086,.16,.14),ridgeNoise(a*7.0));
    return background;`
};

// Intersect a tapered hexagonal rock shelf. Each side clips one interval of
// the ray; the differing shelf profiles form the eroded edges of each butte.
const mesaShapes = /* glsl */ `
void rockShelf(inout Hit h,vec3 o,vec3 d,vec3 center,vec2 size,float height,float taper,float angle,int mat) {
  vec3 q=o-center; float enter=-FAR, leave=FAR; vec3 enterN=vec3(0),leaveN=vec3(0);
  for(int i=0;i<8;i++){
    float phase=angle+float(i)*1.04719755;
    vec3 n=i<6 ? vec3(cos(phase)/size.x,taper/height,sin(phase)/size.y)
               : (i==6 ? vec3(0,-1,0) : vec3(0,1,0));
    float limit=i<6 ? 1.0 : (i==6 ? 0.0 : height);
    float den=dot(n,d), dist=limit-dot(n,q);
    if(abs(den)<.000001) { if(dist<0.0) return; }
    else {
      float t=dist/den;
      if(den<0.0 && t>enter){enter=t;enterN=n;}
      if(den>0.0 && t<leave){leave=t;leaveN=n;}
    }
    if(enter>leave || leave<EPS || enter>h.t) return;
  }
  if(enter>EPS) recordHit(h,enter,normalize(enterN),mat);
  else recordHit(h,leave,normalize(leaveN),mat);
}
`;
const butteGeometry = /* glsl */ `
void butte(inout Hit h,vec3 o,vec3 d,vec3 base,vec2 size,float ht,float rot){
  rockShelf(h,o,d,base,size,ht*.29,.31,rot,LACQUER);
  rockShelf(h,o,d,base+vec3(0,ht*.28,0),size*.71,ht*.55,.22,rot+.06,LACQUER);
  rockShelf(h,o,d,base+vec3(0,ht*.82,0),size*.575,ht*.18,.19,rot-.04,TRIM);
}
`;
worlds.canyon = {
  ...outdoorBounds, cloudThreshold:.82, sun:[-.73,.48,.46],radiance:[1.59,1.28,.94],fill:[.145,.155,.185],
  floorProbe:[-.10,.18,1.6],probe:[-1.4,.65,-.40],
  shapeHelpers:trianglePrimitive+mesaShapes, helpers:landscapeNoise,
  geometry: `
    butte(h,o,d,vec3(-5.20,0,-5.55),vec2(2.15,1.42),3.75,.16);
    butte(h,o,d,vec3(3.92,0,-4.55),vec2(1.90,1.39),3.17,-.27);
    butte(h,o,d,vec3(.38,0,-8.75),vec2(1.14,.89),2.92,.35);
    butte(h,o,d,vec3(1.82,0,-9.70),vec2(.76,.69),2.02,.16);
    // Saguaros mark the dry terrace above the creek.
    for(int j=0;j<2;j++){
      vec3 foot=j==0 ? vec3(-3.58,0,-.57) : vec3(2.68,0,-2.03);
      float scale=j==0 ? .82 : .64;
      vec3 top=foot+vec3(0,1.48*scale,0);
      rodHit(h,o,d,foot,top,.088*scale,ACCENT);
      ellipsoidHit(h,o,d,top,vec3(.088,.12,.088)*scale,ACCENT);
      for(int arm=0;arm<2;arm++){
        float side=arm==0 ? -1.0 : 1.0;
        vec3 base=foot+vec3(0,(.55+float(arm)*.31)*scale,0);
        vec3 joint=base+vec3(.23*side,.14,.02)*scale;
        rodHit(h,o,d,base,joint,.058*scale,ACCENT);
        vec3 tip=joint+vec3(0,.34*scale,0);
        rodHit(h,o,d,joint,tip,.060*scale,ACCENT);
        ellipsoidHit(h,o,d,tip,vec3(.060,.082,.060)*scale,ACCENT);
      }
    }

    rockShelf(h,o,d,vec3(-2.68,0,-.47),vec2(.43,.45),.55,.38,.2,STEP);
    rockShelf(h,o,d,vec3(-2.25,0,-.11),vec2(.28,.26),.27,.31,.1,STEP);
    rockShelf(h,o,d,vec3(2.62,0,1.18),vec2(.66,.36),.32,.46,-.32,TRIM);`,
  movingGeometry: `
    vec3 q=o-vec3(-1.52+stageOffset,0,-.94);
    vec3 a=vec3(-.93,.045,.60), b=vec3(.93,.045,.60), top=vec3(0,1.33,.60);
    vec3 depth=vec3(0,0,-1.26);
    triangleHit(h,q,d,a,b,top,SIGN);
    triangleHit(h,q,d,a,top,top+depth,SIGN); triangleHit(h,q,d,a,top+depth,a+depth,SIGN);
    triangleHit(h,q,d,top,b,b+depth,SIGN); triangleHit(h,q,d,top,b+depth,top+depth,SIGN);
    triangleHit(h,q,d,a+depth,top+depth,b+depth,SIGN);
    triangleHit(h,q,d,vec3(-.38,.051,.605),vec3(.61,.051,.605),vec3(.08,1.02,.605),DARK);
    rodHit(h,q,d,top,vec3(-1.27,.045,.89),.009,PRINTMAT);`,
  surface: `
    if(m==ACCENT){
      float rib=.84+.14*cos(15.0*atan(n.z,n.x));
      return Surface(vec3(.12,.25,.13)*rib,vec3(0));
    }
    if(m==SIGN) return Surface(vec3(.96,.26,.032)*(.95+.05*speck),vec3(0));
    if(m==DARK) return Surface(vec3(.092,.050,.033),vec3(0));
    if(m==PRINTMAT || m==STEP) return Surface(vec3(.71,.61,.46)*(.95+.09*speck),vec3(0));
    if(m==FLOOR){
      float flow=p.z-(.94+.23*p.x+.24*sin(1.12*p.x)+.21*sin(.41*p.x));
      float edge=abs(flow)-(.62+.17*sin(.88*p.x))+.095*(landNoise(7.0*p.xz)-.5);
      float sand= .83+.29*landNoise(p.xz*4.0);
      if(edge<0.) return Surface(vec3(.037,.085,.073),vec3(.43));
      return Surface(mix(vec3(.33,.18,.10),vec3(.68,.41,.22),smoothstep(0.,.25,edge))*sand,vec3(0));
    }
    float bend=.085*sin(.96*p.x+.55*p.z)+.035*landNoise(p.xz*3.5);
    float bands=.5+.5*sin(27.0*(p.y+bend));
    float bandMix=.35*bands+.50*landNoise(vec2(2.1*p.x+1.3*p.z,15.0*p.y))+.12*speck;
    vec3 stone=mix(vec3(.31,.083,.043),vec3(.73,.31,.15),bandMix);
    if(n.y>.75) stone=mix(stone,vec3(.77,.46,.24),.65);
    return Surface(stone,vec3(0));`,
  normal:waterNormals(.48,.035,true),
  skyLow:[1.05,.81,.60], skyHigh:[.275,.54,.76],
  horizon: `
    float a=atan(d.x,-d.z), y=d.y;
    float farLine=.012+.052*smoothstep(.25,.66,ridgeNoise(a+.5))+.014*ridgeNoise(a*3.0);
    if(y<farLine) background=mix(vec3(.33,.21,.19),vec3(.58,.36,.28),.64+.22*ridgeNoise(a));
    return background;`
};

worlds.tram = {
  ...outdoorBounds, cloudThreshold:.72, sun:[-.70,.46,.57],radiance:[.92,.71,.56],fill:[.17,.21,.27],
  floorProbe:[-.15,.10,1.32],probe:[-.9,.87,-.60],helpers:landscapeNoise,
  geometry: `
    // Terraced street, stone platform and the overhead contact wire.
    boxHit(h,o,d,inv,vec3(-9,0,-6.3),vec3(9,.18,-1.65),STEP);
    for(int i=0;i<5;i++){
      float x=-6.3+float(i)*2.91;
      float ht=2.5+.52*mod(float(i)*3.,4.);
      float z=-4.34+.24*mod(float(i),2.);
      boxHit(h,o,d,inv,vec3(x,.18,z-1.52),vec3(x+2.54,ht,z),WINDOWMAT);
      boxHit(h,o,d,inv,vec3(x-.035,ht,z-1.55),vec3(x+2.58,ht+.095,z+.055),DARK);
      boxHit(h,o,d,inv,vec3(x-.04,.91,z),vec3(x+2.59,1.01,z+.30),ACCENT);
    }
    for(int i=0;i<2;i++){
      float x=i==0 ? -3.44 : 3.68;
      rodHit(h,o,d,vec3(x,.18,-1.90),vec3(x,2.44,-1.9),.042,DARK);
      rodHit(h,o,d,vec3(x,2.42,-1.90),vec3(x,2.42,-.64),.027,DARK);
    }
    rodHit(h,o,d,vec3(-13,2.42,-.64),vec3(13,2.42,-.64),.012,DARK);
    boxHit(h,o,d,inv,vec3(-3.03,.46,-1.96),vec3(-1.62,.55,-1.72),PRINTMAT);
    for(int i=0;i<2;i++){
      float x=-2.89+float(i)*1.10;
      boxHit(h,o,d,inv,vec3(x,.18,-1.94),vec3(x+.065,.46,-1.77),DARK);
    }
    for(int i=0;i<2;i++){
      vec3 base=i==0 ? vec3(-3.9,.18,-2.82) : vec3(2.85,.18,-2.96);
      rodHit(h,o,d,base,base+vec3(.03,1.68,0),.072,PRINTMAT);
      ellipsoidHit(h,o,d,base+vec3(-.19,1.65,.02),vec3(.52,.54,.46),LACQUER);
      ellipsoidHit(h,o,d,base+vec3(.19,1.91,-.06),vec3(.52,.58,.48),LACQUER);
      ellipsoidHit(h,o,d,base+vec3(.36,1.59,.06),vec3(.42,.41,.40),LACQUER);
    }`,
  movingGeometry: `
    vec3 q=o-vec3(-1.29+stageOffset,0,-.64);
    boxHit(h,q,d,inv,vec3(-1.42,.26,-.48),vec3(1.42,1.52,.48),SIGN);
    boxHit(h,q,d,inv,vec3(-1.46,.29,-.495),vec3(1.46,.37,.495),TRIM);
    ellipsoidHit(h,q,d,vec3(0,1.51,0),vec3(1.45,.15,.50),ACCENT);
    for(int i=0;i<2;i++){
      float x=i==0 ? -.91 : .91;
      rodHit(h,q,d,vec3(x,.22,-.39),vec3(x,.22,.39),.205,DARK);
      rodHit(h,q,d,vec3(x,.22,.39),vec3(x,.22,.405),.095,TRIM);
    }
    vec3 a=vec3(-.54,1.60,0), b=vec3(-.13,2.01,0), c=vec3(-.54,2.40,0), e=vec3(-.90,2.01,0);
    rodHit(h,q,d,a,b,.016,DARK); rodHit(h,q,d,b,c,.016,DARK);
    rodHit(h,q,d,c,e,.016,DARK); rodHit(h,q,d,e,a,.016,DARK);
    rodHit(h,q,d,c-vec3(.16,0,0),c+vec3(.16,0,0),.020,DARK);`,
  surface: `
    if(m==FLOOR){
      if(p.z< -6.2) return Surface(vec3(.135,.137,.15),vec3(0));
      float pool=landNoise(vec2(.80*p.x+.23*p.z,1.06*p.z))
                 +.20*landNoise(p.xz*3.8);
      float wet=smoothstep(.32,.68,pool);
      vec3 pigment=vec3(.071,.081,.10)*(.83+.25*speck);
      bool stripe=p.x>1.53 && p.x<3.11 && p.z>-.12 && p.z<3.8 && fract((p.z+.22)/.54)<.51;
      if(stripe) pigment=vec3(.71,.70,.60)*(.78+.20*speck);
      float rail=min(abs(p.z+.25),abs(p.z+1.03));
      if(rail<.040) return Surface(vec3(.18,.18,.16),vec3(.53));
      return Surface(pigment*mix(1.0,.62,wet),vec3(mix(.025,.55,wet)));
    }
    if(m==SIGN){
      float x=p.x-(-1.29+stageOffset);
      if(n.z>.8 && x>.68 && x<1.2 && p.y>.33 && p.y<1.41){
        float seam=min(min(abs(x-.68),abs(x-1.2)),abs(x-.94));
        if(seam<.011 || (p.y<.73 && p.y>.60 && abs(x-.89)<.014)) return Surface(vec3(.086,.093,.088),vec3(.06));
      }
      float along=abs(n.x)>.6 ? p.z+.64 : x;
      float lane=abs(n.x)>.6 ? .56 : .55;
      vec2 panel=vec2(fract((along+.23)/lane)-.5,(p.y-1.075)/.58);
      bool glazing=abs(panel.x)<.405 && abs(panel.y)<.49;
      if(glazing) {
        float glint=.45+.20*sin(16.0*along+2.0*p.y);
        return Surface(vec3(.060,.16,.18)*glint,vec3(.13));
      }
      if(p.y<.64) return Surface(vec3(.82,.14,.026),vec3(.055));
      if(p.y<.71) return Surface(vec3(.95,.75,.37),vec3(.045));
      return Surface(vec3(.82,.47,.22),vec3(.045));
    }
    if(m==WINDOWMAT){
      float block=floor((p.x+6.31)/2.91);
      vec3 facade=mix(vec3(.48,.30,.22),vec3(.22,.33,.36),mod(block,2.0));
      float along=abs(n.x)>.6 ? p.z : p.x;
      vec2 cell=fract(vec2((along+.06)/.56,(p.y-.19)/.65));
      if(cell.x>.17 && cell.x<.82 && cell.y>.19 && cell.y<.85){
        if(abs(cell.x-.5)<.023 || abs(cell.y-.61)<.025) return Surface(vec3(.075,.088,.094),vec3(0));
        return Surface(vec3(.088,.16,.20),vec3(0));
      }
      return Surface(facade*(.90+.08*speck),vec3(0));
    }
    if(m==LACQUER){
      float leaves=landNoise(p.xy*9.0+p.z*2.7)+.4*landNoise(p.zy*25.0);
      return Surface(mix(vec3(.064,.15,.096),vec3(.16,.29,.15),clamp(leaves*.77,0.0,1.0)),vec3(0));
    }
    if(m==STEP) return Surface(vec3(.39,.40,.38)*mix(.7,1.0,joints(p.xz,vec2(.65,.42),.012)),vec3(.035));
    if(m==PRINTMAT) return Surface(vec3(.56,.31,.11),vec3(0));
    if(m==ACCENT) return Surface(vec3(.30,.37,.34),vec3(0));
    if(m==TRIM) return Surface(vec3(.23,.24,.23),vec3(.13));
    return Surface(vec3(.075,.091,.091),vec3(0));`,
  emission: `
    if(m==WINDOWMAT){
      float along=abs(n.x)>.6 ? p.z : p.x;
      vec2 uv=vec2((along+.06)/.56,(p.y-.19)/.65), cell=fract(uv);
      if(cell.x>.19 && cell.x<.80 && cell.y>.21 && cell.y<.83 &&
         abs(cell.x-.5)>.023 && abs(cell.y-.61)>.025 && landHash(floor(uv))>.58)
        return vec3(.87,.51,.22)*(.60+.5*landHash(floor(uv)+3.1));
    }
    if(m==SIGN && n.x>.8 && p.y>.42 && p.y<.53 && abs(abs(p.z+.64)-.31)<.073)
      return vec3(2.7,1.85,1.01);
    return vec3(0);`,
  normal: `
    if(m!=FLOOR) return n;
    float rail=min(abs(p.z+.25),abs(p.z+1.03));
    vec2 rings=dripSlopes(p.xz)*smoothstep(.10,.42,reflectivity)*step(.04,rail);
    return normalize(n+vec3(.008*sin(24.0*p.z+7.0*p.x)+rings.x,0,.012*cos(17.0*p.z-3.0*p.x)+rings.y));`,
  skyLow:[1.06,.74,.62], skyHigh:[.23,.37,.59],
  horizon: `
    float a=atan(d.x,-d.z), y=d.y;
    float building=floor(a*33.0);
    float skyline=.026+.101*landHash(vec2(building,4.7));
    if(y<skyline) background=vec3(.18,.24,.30)*(.83+.33*landHash(vec2(building,7.1)));
    return background;`
};
