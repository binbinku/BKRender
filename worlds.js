// Each scene supplies world-space geometry and material responses to the same
// renderer and baker. Movable geometry is omitted from baked diffuse lighting.
const worlds = {
  neon: {
    openSky:true, skyIntensity:.065,
    volumeSource:`
      vec3 signPoint=vec3(-2.53+stageOffset+uv.x*2.37,1.55+uv.y,-1.20);
      float facing=max(0.0,normalize(p-signPoint).z);
      return localEmitter(p,ray,signPoint,vec3(7.3,.35,1.2)*facing,.35)
           +localEmitter(p,ray,lamp,lampRadiance*5.0,.28);`,
    lamp: [-2.5,5.8,2.6], radiance: [1.5,2.8,4.4], fill:[0.012,0.020,0.036],
    skyLow:[0.012,0.026,0.043], skyHigh:[0.16,0.26,0.41], probe:[1.69,0.46,0.60],
    geometry: `
      boxHit(h,o,d,inv,vec3(-4.2,0,-1.99),vec3(4.4,0.16,-0.60),STEP);
      boxHit(h,o,d,inv,vec3(-3.15,0.16,-2.05),vec3(-0.10,2.73,-1.92),DARK);
      boxHit(h,o,d,inv,vec3(0.20,0.43,-2.12),vec3(2.90,2.57,-1.97),WINDOWMAT);
      boxHit(h,o,d,inv,vec3(-3.3,2.73,-2.15),vec3(3.05,2.88,-1.53),TRIM);

      if(!hideMetal){
        for(int i=0;i<3;i++){
          float x=-1.72+float(i)*1.70;
          rodHit(h,o,d,vec3(x,0,0.60),vec3(x,0.83,0.60),0.075,METAL);
          rodHit(h,o,d,vec3(x,0,0.60),vec3(x,0.065,0.60),0.13,TRIM);
        }
      }`,
    movingGeometry: `
      boxHit(h,o,d,inv,vec3(-2.53+stageOffset,1.55,-1.34),vec3(-0.16+stageOffset,2.55,-1.21),SIGN);
      for(int i=0;i<2;i++){
        float x=-2.32+stageOffset+1.92*float(i);
        boxHit(h,o,d,inv,vec3(x,2.05,-1.92),vec3(x+0.05,2.12,-1.34),TRIM);
      }`,
    helpers: `
      float tube(vec2 p,vec2 a,vec2 b){
        vec2 e=b-a; return length(p-a-e*clamp(dot(p-a,e)/dot(e,e),0.0,1.0));
      }
      float letterTube(vec2 p,int letter){
        float d=5.0;
        if(letter==1){
          d=min(tube(p,vec2(.04,.03),vec2(.35,.91)),tube(p,vec2(.35,.91),vec2(.66,.03)));
          return min(d,tube(p,vec2(.16,.40),vec2(.54,.40)));
        }
        d=tube(p,vec2(.06,.03),vec2(.06,.91));
        d=min(d,tube(p,vec2(.06,.91),vec2(.39,.91)));
        d=min(d,tube(p,vec2(.06,.48),vec2(.39,.48)));
        d=min(d,abs(length(p-vec2(.39,.695))-.215)+max(.39-p.x,0.0));
        if(letter==2) return min(d,tube(p,vec2(.31,.47),vec2(.65,.03)));
        d=min(d,tube(p,vec2(.06,.04),vec2(.39,.04)));
        return min(d,abs(length(p-vec2(.39,.26))-.22)+max(.39-p.x,0.0));
      }`,
    emission: `
      if(m==WINDOWMAT && n.z>.9){
        vec2 uv=p.xy-vec2(.20,.43); vec2 f=fract(uv/vec2(.45,.70));
        if(min(min(f.x,1.0-f.x),min(f.y,1.0-f.y))>.045)
          return vec3(.12,.68,.74)*(.52+.26*sin(1.8*uv.x+.8*uv.y));
      }
      if(m!=SIGN || n.z<.9) return vec3(0);
      vec2 v=p.xy-vec2(-2.53+stageOffset,1.55);
      float frame=min(min(v.x,2.37-v.x),min(v.y,1.0-v.y));
      vec2 textPos=(v-vec2(.22,.16))/.72;
      int letter=int(floor(textPos.x/.91));
      float dist=1.0;
      if(textPos.x>=0.0 && letter<3) dist=letterTube(vec2(mod(textPos.x,.91),textPos.y),letter);
      return vec3(1.0,.055,.20)*(4.1*(1.0-smoothstep(.025,.052,dist))+.30*exp(-8.0*dist))
           + vec3(1.0,.16,.27)*1.15*(1.0-smoothstep(.012,.026,abs(frame-.065)));`,
    surface: `
      if(m==METAL) return Surface(vec3(.10,.12,.14),vec3(.64,.70,.75));
      if(m==FLOOR){
        float wetness=smoothstep(-.8,.10,sin(2.1*p.x+1.4*p.z)+.68*cos(2.4*p.z-.64*p.x));
        return Surface(vec3(.034,.047,.060)*(.8+.38*speck),vec3(.12+.55*wetness));
      }
      if(m==SIGN) return Surface(vec3(.11,.022,.046),vec3(0));
      if(m==DARK) return Surface(vec3(.17,.24,.29)*(.48+.48*smoothstep(-.72,.18,sin(61.0*p.y))),vec3(0));
      if(m==WINDOWMAT) return Surface(vec3(.075,.14,.15),vec3(0));
      if(m==STEP) return Surface(vec3(.33,.34,.36)*(.9+.15*speck),vec3(0));
      if(m==TRIM) return Surface(vec3(.055,.085,.105),vec3(0));
      float mortar=joints(uv+vec2(.22*mod(floor(uv.y/.21),2.0),0),vec2(.44,.21),.012);
      return Surface(vec3(.20,.18,.19)*mix(.45,1.0,mortar),vec3(0));`,
    normal: `
      if(m!=FLOOR) return n;
      vec2 rings=dripSlopes(p.xz)*smoothstep(.15,.51,reflectivity);
      return normalize(n+vec3(.027*sin(24.0*p.z+sin(7.0*p.x))+rings.x,0,.017*cos(15.0*p.x+22.0*p.z)+rings.y));`
  },
  pool: {
    openSky:true,
    lamp:[-2.1,5.8,2.6], radiance:[19.0,16.6,12.6], fill:[.065,.095,.11],
    skyLow:[.40,.57,.61], skyHigh:[.25,.62,.94], probe:[-1.4,1.0,.1],
    geometry: `
      boxHit(h,o,d,inv,vec3(-4.3,0,-2.55),vec3(4.0,.32,-.62),STEP);
      boxHit(h,o,d,inv,vec3(-4.3,0,-.62),vec3(-2.56,.32,4.5),STEP);
      boxHit(h,o,d,inv,vec3(2.6,0,-.62),vec3(4.6,.32,4.5),STEP);
      for(int i=0;i<4;i++){
        float x=-3.45+float(i)*2.13;
        rodHit(h,o,d,vec3(x,.32,-1.95),vec3(x,3.15,-1.95),.17,TRIM);
        rodHit(h,o,d,vec3(x,.32,-1.95),vec3(x,.44,-1.95),.24,TRIM);
      }
      boxHit(h,o,d,inv,vec3(-4.3,3.05,-2.30),vec3(3.5,3.31,-1.65),TRIM);

      boxHit(h,o,d,inv,vec3(-2.32,.32,-1.46),vec3(-1.04,.55,-.82),TRIM);
      boxHit(h,o,d,inv,vec3(-2.64,0,-.62),vec3(-1.84,.16,.62),STEP);`,
    movingGeometry: `
      vec3 center=vec3(-1.65+stageOffset,2.0,-1.13);
      rodHit(h,o,d,vec3(center.x,.32,center.z),center,.035,DARK);
      ellipsoidHit(h,o,d,center,vec3(.99,.22,.99),SIGN);`,
    surface: `
      if(m==FLOOR){
        float grout=joints(p.xz,vec2(.4),.012);
        float ripple=.5+.5*sin(11.0*p.x+2.8*sin(5.1*p.z)+13.0*p.z-1.0*sceneTime);
        return Surface(vec3(.022,.32,.31)*mix(.65,1.0,grout)*(.92+.12*ripple),vec3(.29,.36,.38));
      }
      if(m==SIGN){
        vec2 delta=p.xz-vec2(-1.65+stageOffset,-1.13);
        float wedge=mod(floor((atan(delta.y,delta.x)+PI)*12.0/(2.0*PI)),2.0);
        return Surface(mix(vec3(.88,.21,.045),vec3(.92,.50,.18),wedge),vec3(0));
      }
      if(m==DARK) return Surface(vec3(.32,.19,.065),vec3(0));
      if(m==TRIM || m==STEP) return Surface(vec3(.83,.76,.61)*(.94+.08*speck),vec3(0));
      float seam=joints(uv,vec2(.62,.3),.012);
      return Surface(vec3(.32,.55,.50)*mix(.68,1.0,seam),vec3(0));`,
    normal: `if(m==FLOOR) return normalize(vec3(.048*cos(7.2*p.x+5.6*p.z-.91*sceneTime)+.032*sin(12.0*p.z+.64*sceneTime),1.0,.068*sin(9.6*p.z-.77*sceneTime+2.8*sin(3.8*p.x)))); return n;`
  },
  vinyl: {
    lamp:[-2.0,5.8,2.2],radiance:[13.5,10.8,8.0],fill:[.064,.055,.049],
    skyLow:[.22,.18,.15],skyHigh:[.88,.79,.62],probe:[1.69,1.0,.28],floorProbe:[-.10,.77,.68],
    geometry: `
      boxHit(h,o,d,inv,vec3(-1.14,.04,-.47),vec3(2.48,.57,1.73),TRIM);
      boxHit(h,o,d,inv,vec3(-1.10,.57,-.44),vec3(2.44,.62,1.70),STEP);
      vec3 base=vec3(.26,.62,.60);
      rodHit(h,o,d,base,base+vec3(0,.10,0),.98,ACCENT);
      rodHit(h,o,d,base+vec3(0,.10,0),base+vec3(0,.125,0),.95,LACQUER);
      rodHit(h,o,d,base+vec3(0,.125,0),base+vec3(0,.145,0),.265,PRINTMAT);
      rodHit(h,o,d,base+vec3(0,.145,0),base+vec3(0,.21,0),.033,ACCENT);
      rodHit(h,o,d,vec3(1.73,.62,.06),vec3(1.73,.90,.06),.15,DARK);

      boxHit(h,o,d,inv,vec3(.91,.75,1.01),vec3(1.08,.84,1.25),DARK);
      rodHit(h,o,d,vec3(2.05,.62,1.28),vec3(2.05,.74,1.28),.13,ACCENT);

      boxHit(h,o,d,inv,vec3(2.0,0,-2.05),vec3(3.05,2.12,-1.28),WINDOWMAT);
      if(!hideMetal){
        rodHit(h,o,d,vec3(1.73,.90,-.12),vec3(1.34,.95,.84),.032,METAL);
        rodHit(h,o,d,vec3(1.34,.95,.84),vec3(.99,.81,1.12),.032,METAL);
      }`,
    movingGeometry: `
      boxHit(h,o,d,inv,vec3(-2.53+stageOffset,0,-.99),vec3(-.19+stageOffset,2.34,-.89),SIGN);`,
    surface: `
      if(m==SIGN){
        vec2 q=(p.xy-vec2(-2.53+stageOffset,0.0))/2.34;
        float dist=length((q-vec2(.58,.50))*vec2(.92,1));
        vec3 ink=vec3(.92,.20,.027);
        if(q.y>.80) ink=vec3(.95,.81,.60);
        if(q.y<.8 && dist<.47 && fract(dist*13.5)>.24) ink=vec3(.072,.035,.035);
        if(q.y>.855 && q.y<.935 && q.x>.10 && q.x<.75 && fract(19.0*q.x)<.65) ink=vec3(.22,.065,.027);
        return Surface(ink,vec3(0));
      }
      if(m==LACQUER){
        float groove=.5+.5*sin(720.0*length(p.xz-vec2(.26,.60)));
        return Surface(vec3(.016,.018,.024),vec3(.36+.26*groove));
      }
      if(m==PRINTMAT && n.y>.5){
        vec2 disc=(p.xz-vec2(.26,.60))/.265;
        float angle=sceneTime*(2.0*PI/1.8); // One revolution every 1.8 seconds.
        vec2 label=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*disc;
        float segment=smoothstep(.21,.24,dot(label,vec2(.8,-.6)));
        vec3 paper=mix(vec3(.90,.36,.035),vec3(.10,.022,.009),segment);
        float arc=(1.0-smoothstep(.036,.058,abs(length(label)-.77)))*smoothstep(.15,.22,label.x);
        float bars=step(abs(label.x+.23),.29)*max(step(abs(label.y-.38),.042),step(abs(label.y-.52),.024));
        return Surface(mix(paper,vec3(.95,.76,.43),max(arc,bars)),vec3(0));
      }
      if(m==PRINTMAT) return Surface(vec3(.90,.36,.035),vec3(0));
      if(m==METAL || m==ACCENT) return Surface(vec3(.26,.18,.08),vec3(.52,.45,.33));
      if(m==DARK) return Surface(vec3(.048,.050,.046),vec3(0));
      if(m==STEP) return Surface(vec3(.32,.30,.25)*(.96+.08*speck),vec3(0));
      if(m==WINDOWMAT && n.z>.9){
        vec2 a=p.xy-vec2(2.525,.70),b=p.xy-vec2(2.525,1.58);
        float r=min(length(a)/.417,length(b)/.235);
        if(r<1.0) return Surface(vec3(.026+.047*smoothstep(.2,.8,r)+.018*cos(30.0*r)),vec3(0));
      }
      if(m==PLASTER && n.z>.9){
        float slat=smoothstep(.00,.08,fract(5.5*p.x));
        return Surface(mix(vec3(.033,.044,.035),vec3(.19,.215,.16),slat),vec3(0));
      }
      float grainLine=.80+.14*sin(35.0*p.z+2.3*sin(2.1*p.x)+2.2*sin(8.0*p.z))+0.09*speck;
      return Surface((m==TRIM ? vec3(.22,.087,.034) : vec3(.32,.18,.086))*grainLine, vec3(0));`
  }
};
