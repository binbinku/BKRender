// Quays turn into a small basin behind the bridge. Each façade is modelled in
// its own local frame so the shutters, shopfronts and balconies follow the bank.
function buildCanal(g) {
  const {box,beam,oval,quad,triangle,place,material,random,sign}=g;
  const cream=material([.82,.70,.50],0,4), buff=material([.54,.40,.26],0,2);
  const marble=material([.72,.63,.45],0,4), coping=material([.49,.41,.31],0,4);
  const stuccos=[[.68,.28,.145],[.73,.51,.255],[.53,.63,.49],[.73,.43,.34],
    [.67,.60,.43],[.47,.59,.56],[.72,.53,.40]].map(c=>material(c,0,4));
  const slate=material([.19,.218,.215],0,3), tile=material([.39,.135,.061],0,3);
  const charcoal=material([.048,.067,.062]), iron=material([.072,.097,.088]);
  const shutters=[material([.078,.19,.143],0,1),material([.15,.255,.26],0,1),material([.24,.12,.068],0,1)];
  const pane=material([.071,.13,.145],.12), curtain=material([.57,.48,.34],0,4);
  const sienna=material([.59,.13,.072],0,4), linen=material([.81,.69,.48],0,4);
  const teal=material([.045,.23,.21],0,1), deep=material([.037,.125,.124],0,1);
  const timber=material([.28,.15,.069],0,1), oak=material([.43,.265,.127],0,1);
  const lamp=material([.88,.72,.40],0,0,.52), bronze=material([.37,.243,.095],.12);
  const leaf=[material([.12,.24,.075],0,5),material([.205,.32,.095],0,5),material([.082,.165,.075],0,5)];
  const flowers=[[.83,.24,.105],[.85,.62,.26],[.69,.31,.43],[.79,.64,.53]].map(c=>material(c));
  const pick=a=>a[Math.floor(random()*a.length)];
  const rod=(a,b,d,m)=>beam(a,b,d,d,m,true);
  function awning(x,y,z,width,reach,c1,c2) {
    const stripes=Math.max(5,Math.round(width/.27)|1), stripe=width/stripes;
    for(let j=0;j<stripes;j++){
      const a=x-width/2+j*stripe,b=a+stripe,m=j%2 ? c2 : c1;
      quad([a,y,z],[b,y,z],[b,y-.32,z+reach],[a,y-.32,z+reach],m);
      box((a+b)/2,y-.385,z+reach,stripe,.13,.032,m);
      oval((a+b)/2,y-.45,z+reach,stripe,.11,.035,m);
    }
    for(const dx of [-width*.48,width*.48])
      rod([x+dx,y-.70,z],[x+dx,y-.34,z+reach],.032,iron);
  }
  function flowerBox(x,y,z,width) {
    box(x,y,z,width,.17,.22,sienna);box(x,y+.08,z,width+.049,.047,.25,buff);
    for(let j=0;j<Math.ceil(width*8);j++){
      const dx=(random()-.5)*width;
      oval(x+dx,y+.15,z,.15,.15,.15,pick(leaf));
      oval(x+dx+.028,y+.21+random()*.065,z+.045,.09,.085,.087,pick(flowers));
    }
  }
  function window(x,y,z,w,h,shutter,balcony,planter) {
    box(x,y,z,w+.19,h+.19,.12,cream);
    box(x,y,z+.075,w,h,.045,charcoal);
    box(x,y,z+.11,w-.082,h-.085,.035,pane);
    box(x-w*.31,y,z+.132,w*.15,h-.09,.021,curtain);
    box(x+w*.31,y,z+.132,w*.15,h-.09,.021,curtain);
    box(x,y,z+.158,.041,h,.032,cream);box(x,y+h*.13,z+.158,w,.035,.033,cream);
    box(x,y-h*.5-.073,z+.048,w+.27,.100,.23,marble);
    for(const side of [-1,1]){
      const sx=x+side*(w*.5+.14);
      box(sx,y,z+.08,.219,h+.035,.085,shutter);
      for(let j=0;j<7;j++)box(sx,y-h*.41+j*h*.137,z+.136,.175,.027,.033,shutter);
    }
    if(balcony){
      const by=y-h*.5-.082;
      box(x,by,z+.285,w+.46,.085,.60,marble);
      for(let j=0;j<7;j++){
        const bx=x-w*.64+w*1.28*j/6;
        rod([bx,by+.03,z+.55],[bx,by+.47,z+.55],.025,iron);
      }
      for(const sy of [.16,.48]){
        box(x,by+sy,z+.55,w*1.35,.032,.036,iron);
        for(const side of [-1,1])box(x+side*w*.65,by+sy,z+.3,.033,.033,.52,iron);
      }
    }
    if(planter)flowerBox(x,y-h*.5+.013,z+(balcony ? .48 : .21),w*.74);
  }
  const stores=[
    ['FIORI','BOTTEGA BOTANICA','#415a47','#f2d28b'],['PANETTERIA','FORNO A LEGNA','#663c30','#efcf91'],
    ['CAFFÈ','TORREFAZIONE','#295455','#edd6a2'],['CARTA','LIBRI  •  STAMPE','#514936','#eddebd'],
    ['AL PONTE','LOCANDA','#864536','#f3ddb1'],['EMPORIO','DAL 1926','#334c43','#f3d799']
  ];
  function house(x,z,yaw,w,h,depth,index,roofPeak=false) {
    place(x,0,z,yaw,()=>{
      const base=.97, body=stuccos[index%stuccos.length], sh=shutters[index%3], roof=index%3 ? tile : slate;
      box(0,(h+base)/2,-depth/2,w,h-base,depth,body);
      box(0,1.14,.02,w+.045,.36,.13,buff);
      box(0,2.76,.035,w+.105,.115,.14,cream);
      for(const cx of [-w*.5+.079,w*.5-.079]){
        for(let j=0;j<Math.floor((h-.99)/.34);j++)
          box(cx,1.15+j*.34,.026,j%2 ? .17 : .235,.30,.115,marble);
      }
      const shop=stores[index%stores.length];
      box(0,1.81,.093,w*.76,1.62,.11,sh);
      for(const s of [-1,0,1]){
        box(s*w*.236,1.82,.165,w*.21,1.38,.061,pane);
        box(s*w*.236,1.57,.204,w*.205,.043,.041,oak);
      }
      box(0,1.16,.21,w*.69,.255,.086,sh);
      sign(0,2.58,.17,w*.77,.342,shop[0],shop[1],shop[2],shop[3]);
      if(index%3!==1)awning(0,2.38,.19,w*.83,.61,index%2 ? teal : sienna,linen);
      const rows=h>5.38 ? 2 : 1, cols=w>3.5 ? 3 : 2, ww=Math.min(.64,w/(cols*1.76));
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
        const wx=(c-(cols-1)/2)*w/(cols+.10), wy=3+(h-3)*(r+.48)/rows;
        window(wx,wy,.059,ww,Math.min(.95,(h-3)/rows*.63),sh,(index+c+r)%4===0,(index+c*2+r)%3===0);
      }
      box(0,h-.10,.025,w+.17,.12,.20,cream);
      box(0,h+.014,-depth*.5,w+.27,.17,depth+.28,marble);
      if(roofPeak){
        const peak=h+.93, fw=w*.5+.16, rz=-depth-.13;
        triangle([-fw,h,.13],[fw,h,.13],[0,peak,.13],body);
        quad([-fw,h,.16],[0,peak,.16],[0,peak,rz],[-fw,h,rz],roof);
        quad([0,peak,.16],[fw,h,.16],[fw,h,rz],[0,peak,rz],roof);
        for(const s of [-1,1])beam([s*fw,h,.18],[0,peak,.18],.084,.11,cream);
        oval(0,h+.31,.165,.275,.275,.06,charcoal);
      }else{
        const fw=w*.5+.18;
        quad([-fw,h+.12,.18],[fw,h+.12,.18],[fw,h+.78,-depth*.55],[-fw,h+.78,-depth*.55],roof);
        quad([-fw,h+.78,-depth*.55],[fw,h+.78,-depth*.55],[fw,h+.12,-depth-.14],[-fw,h+.12,-depth-.14],roof);
      }
      const cx=w*(index%2 ? .29 : -.25);
      box(cx,h+.72,-depth*.63,.32,1.0,.38,buff);box(cx,h+1.23,-depth*.63,.43,.11,.49,cream);
      if(index%2===0){
        rod([w*.46,1.21,.18],[w*.46,h-.18,.18],.055,iron);
        for(let j=0;j<3;j++)box(w*.46,1.49+j*1.24,.14,.11,.055,.14,bronze);
      }
    });
  }
  // Continuous quays, stone courses, and iron mooring rings.
  for(const s of [-1,1]){
    box(s*6.16,.43,-3.0,3.84,.86,22.0,buff);
    box(s*6.16,.91,-3.0,3.96,.15,22.1,coping);
    for(let j=0;j<26;j++)box(s*4.27,.995,7.55-j*.84,.34,.095,.814,marble);
    for(let j=0;j<7;j++){
      const z=6.8-j*2.7;
      rod([s*4.49,1.0,z],[s*4.49,1.41,z],.115,iron);
      oval(s*4.49,1.43,z,.17,.095,.17,iron);
    }
  }
  box(0,.44,-12.20,18,.88,3.1,buff);box(0,.93,-12.20,18,.12,3.16,coping);
  const rear=[[-7,3.5,5.15],[-3.62,3.15,6.48],[-.34,3.31,5.30],[2.96,3.15,6.03],[6.25,3.3,4.80]];
  rear.forEach(([x,w,h],i)=>house(x,-11.44-(i%2)*.24,0,w,h,2.75,i,i%2===1));
  for(const s of [-1,1]){
    const bank=s<0 ? [[-8.83,3.55,4.88],[-5.09,3.77,5.83],[-1.43,3.43,4.71],[2.03,3.32,5.54]] :
      [[-8.6,3.65,5.75],[-4.89,3.70,4.96],[-1.21,3.52,5.41],[2.53,3.61,4.64]];
    bank.forEach(([z,w,h],i)=>house(s*(6.04+.12*(i%2)),z,-s*Math.PI/2,w,h,2.65,i+(s<0 ? 3 : 5),i%3===0));
  }
  // Bell tower rises over the skyline, with open belfry and a copper spire.
  const tx=.69,tz=-15.4;
  box(tx,4.05,tz,1.42,8.10,1.42,buff);box(tx,6.68,tz,1.64,.20,1.64,cream);
  for(const a of [-1,1])for(const b of [-1,1])box(tx+a*.57,8.54,tz+b*.57,.226,1.19,.226,marble);
  oval(tx,8.51,tz,.54,.72,.54,bronze);
  box(tx,9.17,tz,1.64,.18,1.64,cream);
  for(let i=0;i<4;i++){
    const corners=[[-.85,-.85],[-.85,.85],[.85,.85],[.85,-.85]],a=corners[i],b=corners[(i+1)%4];
    triangle([tx+a[0],9.27,tz+a[1]],[tx+b[0],9.27,tz+b[1]],[tx,10.79,tz],teal);
  }
  rod([tx,10.76,tz],[tx,11.19,tz],.045,bronze);
  // Clock face, minute marks and hands remain legible from across the basin.
  const cy=7.49,cz=tz+.74;
  oval(tx,cy,cz,.99,.99,.092,bronze);oval(tx,cy,cz+.049,.84,.84,.042,cream);
  for(let i=0;i<12;i++){
    const t=i*Math.PI/6,pt=r=>[tx+r*Math.sin(t),cy+r*Math.cos(t),cz+.076];
    beam(pt(.326),pt(.384),.032,.022,charcoal);
  }
  beam([tx,cy,cz+.09],[tx-.19,cy+.165,cz+.09],.041,.022,charcoal);
  beam([tx,cy,cz+.099],[tx+.092,cy+.293,cz+.099],.032,.022,charcoal);
  // Bridge: stone spandrels above the arch, individually fitted voussoirs, intrados and railings.
  const bz=-4.27,half=.66, segments=30;
  const arc=(r,t,z)=>[r*Math.cos(t),.14+(r/3.80)*2.03*Math.sin(t),z];
  for(let j=0;j<segments;j++){
    const a=j*Math.PI/segments,b=(j+1)*Math.PI/segments;
    const deck=x=>2.33+.25*(1-Math.pow(x/4.4,2));
    for(const s of [-1,1]){
      const z=bz+s*half,p=arc(3.8,a,z),q=arc(3.8,b,z);
      quad(p,q,[q[0],deck(q[0]),z],[p[0],deck(p[0]),z],buff);
      quad(arc(3.8,a,z+s*.029),arc(4.08,a,z+s*.029),arc(4.08,b,z+s*.029),arc(3.8,b,z+s*.029),j%3 ? cream : coping);
    }
    quad(arc(3.8,a,bz-half),arc(3.8,b,bz-half),arc(3.8,b,bz+half),arc(3.8,a,bz+half),coping);
    const x=3.8*Math.cos(a), xx=3.8*Math.cos(b);
    quad([x,deck(x),bz-half],[xx,deck(xx),bz-half],[xx,deck(xx),bz+half],[x,deck(x),bz+half],coping);
  }
  for(const s of [-1,1]){
    box(s*3.99,1.18,bz,.43,2.30,1.35,buff);
    for(let j=0;j<7;j++)box(s*(4.19+j*.239),1.00+(7-j)*.091,bz,.25,(7-j)*.182,1.32,marble);
  }
  for(const side of [-1,1]){
    const z=bz+side*.64, heights=x=>2.33+.25*(1-Math.pow(x/4.4,2));
    for(let j=0;j<=28;j++){
      const x=-4+j*8/28,y=heights(x);
      rod([x,y,z],[x,y+.59,z],j%7===0 ? .095 : .037,iron);
      if(j%7===0)oval(x,y+.66,z,.13,.145,.13,bronze);
      if(j<28)for(const dy of [.18,.59])beam([x,y+dy,z],[x+8/28,heights(x+8/28)+dy,z],.040,.041,iron);
    }
  }
  // Two small café terraces and a greengrocer occupy the narrow quays.
  function chair(x,z,angle){
    place(x,0,z,angle,()=>{
      for(const s of [-1,1])for(const t of [-1,1])
        rod([s*.16,1.02,t*.15],[s*.139,1.38,t*.14],.030,iron);
      box(0,1.390,0,.34,.049,.33,oak);
      for(const s of [-1,1])rod([s*.145,1.39,-.15],[s*.145,1.71,-.17],.026,iron);
      for(const y of [1.58,1.68])box(0,y,-.16,.36,.064,.03,oak);
    });
  }
  for(const s of [-1,1])for(const z of [-1.6,2.08]){
    const x=s*5.39;
    rod([x,1.0,z],[x,1.62,z],.061,iron);
    oval(x,1.045,z,.42,.063,.42,iron);oval(x,1.65,z,.65,.066,.65,marble);
    oval(x+.05,1.72,z,.12,.11,.12,cream);oval(x-.12,1.70,z+.01,.12,.085,.12,cream);
    chair(x,z+.51,Math.PI-.20);chair(x,z-.51,.15);
  }
  for(let i=0;i<3;i++){
    const x=4.96+.34*i,z=-8.1;
    box(x,1.175,z,.325,.32,.58,oak);
    for(let j=0;j<12;j++)
      oval(x+(random()-.5)*.23,1.36+random()*.08,z+(random()-.5)*.45,.095,.090,.095,i%2 ? sienna : flowers[1]);
  }
  // A low boat sits beyond the opening, giving the eye a distance cue under the bridge.
  place(.32,0,-8.05,-.20,()=>{
    oval(0,.13,0,2.28,.37,.70,deep);oval(0,.23,0,2.05,.16,.53,oak);
    for(const x of [-.50,.05,.56])box(x,.33,0,.16,.055,.53,timber);
    beam([-.62,.37,-.34],[.62,.37,.39],.052,.048,cream);
  });
  for(let j=0;j<18;j++){
    const x=-5.92+j*.66, xx=x+.66, y=4.56+.020*x*x;
    const z=-7.19+.10*x, yy=4.56+.020*xx*xx, zz=z+.066;
    rod([x,y,z],[xx,yy,zz],.019,iron);
    triangle([x+.08,y-.015,z],[xx-.08,yy-.015,zz],[(x+xx)/2,y-.39-.07*(j%2),z+.095],
      [sienna,linen,teal,linen][j%4]);
  }
  function streetlamp(x,z){
    rod([x,1,z],[x,3.34,z],.078,iron);
    rod([x,1,z],[x,1.36,z],.18,iron);oval(x,3.33,z,.19,.13,.19,iron);
    box(x,3.59,z,.235,.40,.235,lamp);
    for(const a of [-1,1])for(const b of [-1,1])rod([x+a*.13,3.37,z+b*.13],[x+a*.16,3.81,z+b*.16],.024,iron);
    box(x,3.82,z,.40,.076,.40,iron);oval(x,3.89,z,.31,.19,.31,iron);
  }
  for(const z of [-8.4,-1.85,4.30])for(const s of [-1,1])streetlamp(s*4.77,z);
  function tree(x,z,sz){
    box(x,1.12,z,.87,.25,.87,coping);
    rod([x,1.19,z],[x+.04,1.19+sz*1.6,z],sz*.15,timber);
    for(let j=0;j<21;j++){
      const a=j*2.4,r=(.19+random()*.65)*sz;
      const q=[x+r*Math.cos(a),2.4+sz*(.4+.65*random()),z+r*Math.sin(a)];
      rod([x,1.7+.38*random(),z],q,.075*sz,timber);
      oval(...q,sz*(.43+.39*random()),sz*(.47+.36*random()),sz*(.44+.38*random()),pick(leaf));
    }
  }
  tree(-5.04,.51,1.11);tree(5.13,-6.34,.93);tree(-3.88,-10.99,1.1);
  for(let i=0;i<5;i++)box(3.14+i*.218,.098+i*.10,1.56,.25,.196+i*.20,1.95,marble);

  // The hull is lofted through cross-sections. Timber rubbing strakes follow
  // the sheer line and the striped canopy is stretched over three bent hoops.
  g.movable(()=>place(-1.22,0,1.36,-.30,()=>{
    const stations=[[-1.85,.035,.53],[-1.54,.42,.46],[-.94,.60,.407],[.76,.62,.41],[1.36,.46,.46],[1.82,.045,.58]];
    for(let i=0;i<stations.length-1;i++){
      const [x,w,y]=stations[i],[xx,ww,yy]=stations[i+1];
      for(const s of [-1,1]){
        const edge=[x,y,s*w],next=[xx,yy,s*ww];
        quad([x,.025,s*w*.63],[xx,.025,s*ww*.63],next,edge,deep);
        quad([x,y-.115,s*(w-.01)],[xx,yy-.115,s*(ww-.01)],next,edge,sienna);
        beam(edge,next,.055,.055,oak);
      }
      quad([x,y-.038,-w],[xx,yy-.038,-ww],[xx,yy-.038,ww],[x,y-.038,w],teal);
    }
    for(const x of [-1.15,-.57,.0,.57,1.12])box(x,.43,0,.20,.064,.96,oak);
    for(const x of [-.95,0,.95]){
      for(const s of [-1,1])rod([x,.45,s*.50],[x,1.43,s*.50],.041,bronze);
      beam([x,1.43,-.53],[x,1.64,0],.047,.047,oak);
      beam([x,1.64,0],[x,1.43,.53],.047,.047,oak);
    }
    for(let j=0;j<9;j++){
      const x=-1.16+2.32*j/9,xx=x+2.32/9,cloth=j%2 ? linen : sienna;
      for(const s of [-1,1]){
        quad([x,1.65,0],[xx,1.65,0],[xx,1.42,s*.63],[x,1.42,s*.63],cloth);
        box((x+xx)/2,1.359,s*.63,xx-x,.126,.024,cloth);
        oval((x+xx)/2,1.30,s*.63,xx-x,.099,.035,cloth);
      }
    }
    for(const x of [-1.21,-.64,.025,.65,1.20]){
      const z=.17+.10*random();
      box(x,.565,z,.44,.26,.42,timber);
      for(const sy of [.47,.55,.64])box(x,sy,z+.22,.46,.052,.041,oak);
      for(let j=0;j<13;j++){
        const xx=x+(random()-.5)*.39,zz=z+(random()-.5)*.32, y=.75+random()*.25;
        rod([xx,.62,zz],[xx,y,zz],.025,pick(leaf));oval(xx,y,zz,.11,.095,.11,pick(flowers));
      }
    }
  }));
}
if(studyId==='canal') worlds.canal=installDetailWorld(buildCanal,{
  openSky:true, sun:[-.57,.85,.64],radiance:[1.48,1.21,.88],fill:[.185,.23,.255],
  skyLow:[.83,.78,.65],skyHigh:[.25,.52,.71],
  gridLo:[-6.4,.04,-11.4],gridHi:[6.4,6.0,6.2],reflectionLo:[-6.8,0,-11.5],reflectionHi:[6.8,7.2,9.2],
  floorProbe:[-.15,.15,2.25],probe:[-.60,.59,1.58],normal:waterNormals(.034,.21),boatLift:.018,
  floor:`float wave=landNoise((p.xz-vec2(.034,.21)*sceneTime)*vec2(3,7));return Surface(vec3(.029,.117,.107)*(.78+.22*wave),vec3(.53));`
});
