// Walnut shelving, a wraparound gallery and a rolling trolley are built at book scale.
function buildBookshop(g) {
  const {box,beam,oval,quad,place,material,random,sign}=g;
  const walnut=material([.155,.063,.025],0,1), edge=material([.30,.146,.052],0,1);
  const inset=material([.066,.031,.020],0,1), sage=material([.14,.23,.177],0,4);
  const plaster=material([.62,.54,.40],0,4), ivory=material([.74,.65,.47],0,4);
  const brass=material([.55,.31,.085],.16), iron=material([.06,.066,.051]);
  const globe=material([1,.68,.30],0,0,1.35), lampGreen=material([.018,.19,.098],.12);
  const leather=material([.34,.025,.026],0,4), pages=material([.75,.62,.42]);
  const steel=material([.25,.26,.22],.14), glass=material([.62,.75,.68],0,8);
  const bindings=[[.32,.058,.042],[.135,.22,.17],[.39,.22,.07],[.08,.115,.15],[.35,.16,.12],
    [.17,.25,.245],[.43,.36,.24],[.10,.068,.050],[.25,.12,.047],[.20,.085,.115]].map(c=>material(c,0,7));
  const pick=a=>a[Math.floor(random()*a.length)];
  const pole=(a,b,d,m)=>beam(a,b,d,d,m,true);
  function pile(x,y,z,count) {
    for(let i=0;i<count;i++){
      const w=.32+random()*.22,d=.26+random()*.10,h=.062+random()*.04, m=pick(bindings);
      place(x,y,z,(random()-.5)*.28,()=>{
        box(0,h*.5,0,w-.018,h,d-.026,pages);
        box(0,.007,0,w,.014,d,m);box(0,h-.007,0,w,.014,d,m);
        box(0,h*.5,-d*.5,w,h,.016,m);
      });
      y+=h;
    }
  }
  function bookcase(x,base,z,width,rows) {
    const depth=.46, step=.51, bottom=base+.36, top=bottom+rows*step;
    box(x,(base+top)*.5,z-.19,width,top-base,.10,inset);
    box(x,base+.18,z,width,.36,depth,walnut);
    for(const side of [-1,1]){
      const sx=x+side*(width/2-.055);
      box(sx,(top+base)*.5,z,.11,top-base,depth+.065,walnut);
      box(sx,(top+base)*.5,z+.25,.041,top-base,.04,edge);
      box(sx,top-.06,z,.17,.14,depth+.14,edge);
    }
    for(let row=0;row<rows;row++){
      const sy=bottom+row*step;
      box(x,sy,z,width,.064,depth,edge);
      let x0=x-width/2+.14, stop=x+width/2-.13;
      while(x0<stop-.115){
        const w=.068+random()*.105, h=.285+random()*.15, d=.23+random()*.10;
        if(x0+w>stop) break;
        box(x0+w*.5,sy+.032+h*.5,z+.175-d/2-random()*.042,w,h,d,pick(bindings));
        x0+=w+.007+(random()<.065 ? random()*.10 : 0);
      }
    }
    box(x,top,z,width+.085,.09,depth+.10,walnut);
    box(x,top+.055,z,width+.14,.043,depth+.14,edge);
    box(x,base+.155,z+.235,width-.29,.20,.025,inset);
    box(x,base+.155,z+.253,width-.37,.14,.026,walnut);
    box(x,base+.235,z+.275,.165,.046,.015,brass);
  }

  // The arched transom has a glazed fanlight, radiating mullions and a stone surround.
  const back=-5.66, spring=3.60, radius=1.51;
  box(0,3.0,back-.28,15,6.0,.18,sage);
  box(0,1.80,back,3.03,3.6,.13,glass);
  const arcPoint=(r,a,z)=>[r*Math.cos(a),spring+r*Math.sin(a),z];
  for(let i=0;i<26;i++){
    const a=i*Math.PI/26,b=(i+1)*Math.PI/26;
    g.triangle([0,spring,back+.02],arcPoint(radius,a,back+.02),arcPoint(radius,b,back+.02),glass);
    quad(arcPoint(radius,a,back+.14),arcPoint(radius+.19,a,back+.14),
      arcPoint(radius+.19,b,back+.14),arcPoint(radius,b,back+.14),i%2 ? ivory : plaster);
  }
  for(let i=1;i<8;i++)pole([0,spring,back+.12],arcPoint(radius,i*Math.PI/8,back+.12),.040,edge);
  for(const x of [-1.52,-.75,0,.75,1.52])box(x,2.06,back+.16,.065,3.10,.095,walnut);
  for(const y of [.54,1.52,2.54,spring])box(0,y,back+.18,3.12,.065,.10,walnut);
  for(const x of [-1.62,1.62])box(x,1.83,back+.20,.17,3.66,.25,ivory);
  box(0,.51,back+.22,3.48,.16,.42,ivory);
  for(const side of [-1,1]) {
    for(let i=0;i<3;i++){
      const x=side*(2.59+i*1.66);
      bookcase(x,0,-5.08,1.60,4);
      bookcase(x,2.95,-5.08,1.60,5);
    }
    // Wainscoting and high shelves continue around the side walls.
    place(side*6.75,0,-.92,-side*Math.PI/2,()=>{
      box(0,3.05,-.34,10.5,6.1,.18,sage);
      for(let j=0;j<5;j++){
        bookcase(-3.96+j*1.95,0,0,1.86,4);
        bookcase(-3.96+j*1.95,2.95,0,1.86,5);
      }
    });
    // Balcony at the back leaves the tall window clear in the middle.
    box(side*4.12,2.73,-4.49,4.74,.25,2.04,walnut);
    box(side*4.12,2.69,-3.46,4.80,.30,.12,edge);
    box(side*6.07,2.73,-.18,1.43,.25,6.68,walnut);
    for(let i=0;i<=18;i++){
      const x=side*(1.82+i*.254);
      pole([x,2.88,-3.43],[x,3.63,-3.43],i%6===0 ? .080 : .036,iron);
      if(i%6===0) oval(x,3.65,-3.43,.112,.12,.112,brass);
    }
    for(const y of [3.09,3.64])beam([side*1.78,y,-3.43],[side*6.47,y,-3.43],.063,.065,brass);
    for(let i=0;i<=21;i++){
      const z=-3.39+i*.30;
      pole([side*5.40,2.87,z],[side*5.40,3.63,z],i%7===0 ? .075 : .036,iron);
    }
    for(const y of [3.09,3.64])beam([side*5.40,y,-3.45],[side*5.40,y,2.95],.068,.068,brass);
    for(const z of [-3.45,.15,2.95]){
      const x=side*5.42;
      box(x,1.42,z,.20,2.84,.20,walnut);
      box(x,.22,z,.32,.44,.32,edge);box(x,2.57,z,.36,.20,.36,edge);
      beam([x,2.15,z],[x+side*.64,2.60,z],.14,.14,walnut);
    }
    for(let i=0;i<3;i++){
      const x=side*(2.56+i*1.67);
      box(x,2.68,-3.386,1.45,.165,.037,inset);
      box(x,2.68,-3.36,1.28,.085,.027,walnut);
    }
  }
  // A real flight of treads and a continuous handrail connect the two levels.
  const stepX=-4.68;
  for(let i=0;i<15;i++){
    const z=1.71-i*.344, y=(i+1)*.188;
    box(stepX,y-.07,z,1.28,.14,.367,edge);
    if(i%2===0)pole([stepX+.61,y,z],[stepX+.61,y+.77,z],.052,iron);
  }
  for(const dx of [-.63,.63])beam([stepX+dx,.02,1.86],[stepX+dx,2.64,-3.26],.15,.15,walnut);
  beam([stepX+.61,.93,1.78],[stepX+.61,3.61,-3.23],.092,.092,brass);

  // Repeated ceiling coffers and pendant chains establish the room's height.
  box(0,6.17,.2,14.2,.18,13,plaster);
  for(const x of [-6,-3,0,3,6])box(x,5.99,.2,.19,.23,12.5,edge);
  for(const z of [-5.4,-2.7,.3,3.3,6.3]){
    box(0,5.92,z,14,.32,.21,walnut);box(0,5.75,z,14,.06,.27,edge);
  }
  function pendant(x,y,z) {
    pole([x,y+.3,z],[x,5.91,z],.029,iron);
    oval(x,y+.18,z,.20,.23,.20,brass);
    oval(x,y-.04,z,.55,.52,.55,globe);
    pole([x,y-.34,z],[x,y-.26,z],.075,brass);
    for(let j=0;j<5;j++){
      const a=j*2*Math.PI/5;
      const q=[x+.275*Math.cos(a),y-.04,z+.275*Math.sin(a)];
      pole([x,y+.19,z],q,.019,brass);pole(q,[x,y-.295,z],.019,brass);
    }
  }
  pendant(-2.85,4.68,-1.1);pendant(2.85,4.68,-1.1);
  pendant(-2.85,4.86,3.1);pendant(2.85,4.86,3.1);
  sign(0,5.53,-5.34,3.35,.52,'LIBRAIRIE','LIVRES ANCIENS  ·  DEPUIS 1894','#254038','#dfbd79');

  // A carved counter with a green banker's lamp and a book spread open on its stand.
  place(2.68,0,-2.02,-.18,()=>{
    box(0,.52,0,2.48,1.04,.96,walnut);
    box(0,.12,0,2.62,.18,1.06,edge);box(0,1.08,0,2.70,.12,1.14,edge);
    for(const x of [-.77,0,.77]){
      box(x,.57,.49,.65,.66,.040,inset);
      box(x,.57,.518,.54,.54,.045,edge);
      box(x,.57,.546,.46,.46,.025,walnut);
    }
    pile(-.8,1.14,.035,4);
    const y=1.18;
    quad([-.27,y,.34],[.08,y+.095,.34],[.08,y+.21,-.16],[-.27,y+.115,-.16],pages);
    quad([.08,y+.095,.34],[.41,y+.012,.34],[.41,y+.122,-.16],[.08,y+.21,-.16],ivory);
    oval(.80,1.19,0,.41,.105,.30,brass);
    pole([.80,1.20,0],[.80,1.72,0],.061,brass);
    oval(.80,1.72,0,.65,.23,.29,lampGreen);
  });
  // A woven runner sits behind the trolley, where it leaves the polished floor exposed.
  const rug=material([.215,.048,.033],0,4), rugInk=material([.072,.119,.107]), embroidery=material([.54,.35,.165]);
  box(0,.013,-2.12,2.75,.018,3.5,rug);
  for(const s of [-1,1]){
    box(s*1.26,.025,-2.12,.11,.010,3.4,rugInk);
    box(s*1.16,.026,-2.12,.026,.012,3.20,embroidery);
    box(0,.025,-2.12+s*1.63,2.57,.012,.12,rugInk);
    for(let j=0;j<34;j++)box(-1.29+j*.078,.012,-2.12+s*1.79,.028,.013,.11,pages);
  }
  for(let j=0;j<5;j++){
    const z=-3.31+j*.59;
    for(const s of [-1,1])for(const side of [-1,1])
      beam([0,.031,z+s*.24],[side*.41,.031,z],.019,.035,embroidery);
  }
  // Low reading table and a stool complete the central aisle.
  place(-1.62,0,-2.56,.12,()=>{
    box(0,.88,0,1.65,.115,.92,edge);
    for(const x of [-.64,.64])for(const z of [-.31,.31])pole([x,.04,z],[x,.84,z],.085,walnut);
    pile(-.45,.94,.04,4);pile(.22,.94,-.04,2);
  });
  oval(-.53,.51,-2.38,.48,.13,.48,leather);
  for(let j=0;j<3;j++){const a=j*2.094;pole([-.53+.25*Math.cos(a),.02,-2.38+.25*Math.sin(a)],
    [-.53+.13*Math.cos(a),.49,-2.38+.13*Math.sin(a)],.06,walnut);}

  // A button-tufted leather reading chair and its standing lamp face the aisle.
  place(3.57,0,.66,-.51,()=>{
    const hide=material([.19,.067,.035],0,4);
    for(const x of [-.42,.42])for(const z of [-.39,.37])oval(x,.12,z,.17,.23,.16,walnut);
    box(0,.33,0,1.01,.32,.95,hide);oval(0,.51,.065,1.00,.24,.87,leather);
    oval(0,.93,-.40,1.04,1.25,.31,hide);
    for(const x of [-.51,.51]){
      oval(x,.65,-.015,.24,.51,1.00,hide);
      oval(x,.84,.012,.275,.20,.99,leather);
    }
    for(let r=0;r<3;r++)for(let j=0;j<3;j++){
      const x=(j-1)*.245+(r%2 ? .045 : -.010),y=.86+r*.19;
      const z=-.40+.156*Math.sqrt(Math.max(.025,1-(x/.52)**2-((y-.93)/.625)**2));
      oval(x,y,z,.042,.042,.026,walnut);
    }
  });
  oval(4.46,.087,.27,.47,.15,.47,brass);pole([4.46,.13,.27],[4.46,1.79,.27],.047,brass);
  for(let j=0;j<16;j++){
    const a=j*Math.PI/8,b=(j+1)*Math.PI/8;
    const pt=(r,y,t)=>[4.46+r*Math.cos(t),y,.27+r*Math.sin(t)];
    quad(pt(.31,1.54,a),pt(.31,1.54,b),pt(.15,1.92,b),pt(.15,1.92,a),j%2 ? ivory : pages);
  }
  g.movable(()=>place(-1.37,0,1.19,-.14,()=>{
    for(const x of [-.77,.77])for(const z of [-.30,.30]){
      oval(x,.17,z,.29,.32,.13,iron);oval(x,.17,z+.061,.12,.12,.028,brass);
      box(x,.295,z,.082,.16,.073,steel);
    }
    for(const y of [.37,.94]){
      box(0,y,0,1.88,.092,.83,leather);
      box(0,y+.084,.386,1.92,.17,.088,leather);
      box(0,y+.17,.386,1.92,.025,.090,brass);
    }
    for(const x of [-.90,.90]){
      box(x,.79,0,.072,.94,.84,leather);
      for(const z of [-.355,.355])pole([x,.37,z],[x,1.40,z],.045,brass);
      pole([x,1.40,-.355],[x,1.40,.355],.060,brass);
    }
    for(let j=0;j<9;j++){
      const x=-.75+j*.175,h=.21+random()*.15;
      box(x,1.00+h/2,-.012,.14,h,.49,pick(bindings));box(x,1.002+h,-.012,.112,.008,.45,pages);
    }
    pile(-.42,.425,.0,4);pile(.26,.425,.0,3);
  }));
}

if(studyId==='bookshop') worlds.bookshop=installDetailWorld(buildBookshop,{
  sun:[1,1,1], skyLow:[.48,.49,.40],skyHigh:[.64,.72,.73],
  gridLo:[-6.7,.035,-5.4],gridHi:[6.7,5.9,5.4],reflectionLo:[-6.85,0,-5.7],reflectionHi:[6.85,6.1,7.6],
  floorProbe:[-.05,.18,1.95],probe:[0,1.20,-2],
  floor:`vec2 tile=floor((p.xz+.40)/.80);
    float checker=mod(tile.x+tile.y,2.0); vec2 cell=abs(fract((p.xz+.40)/.80)-.5);
    float line=smoothstep(.465,.50,max(cell.x,cell.y));
    vec3 c=mix(vec3(.095,.142,.115),vec3(.42,.355,.245),checker);
    c=mix(c,vec3(.085,.075,.058),line);
    float vein=landNoise(p.xz*vec2(5,12)+landNoise(p.xz)*3.0);
    return Surface(c*(.89+.17*vein),vec3(mix(.14,.04,line)));`,
  volumeSource:`
    // The glazed arch transmits directional daylight. Intervening mullions,
    // railings and furniture still block the path to the pane.
    vec3 l=normalize(vec3(-.27,.34,-1));
    float t=(-5.58-p.z)/l.z;
    vec2 window=(p+t*l).xy;
    vec3 light=vec3(0);
    if(t>0.0 && window.y>.55 && length(vec2(window.x,max(0.0,window.y-3.6)))<1.51
        && trace(p,l).t>=t-.008)
      light=vec3(5.1,4.7,3.7)*PI*henyeyGreenstein(dot(ray,l),.48);
    vec3 bulb=vec3(uv.x<.5 ? -2.85 : 2.85,4.33,-1.1);
    return light+localEmitter(p,ray,bulb,vec3(28,18,10),.32);`,
  direct:`vec3 light=vec3(.19,.164,.13)*(.72+.28*max(n.y,0.0));
    bool left=p.x+(uv.x-.5)*2.0<0.0;
    vec3 bulb=vec3(left ? -2.85 : 2.85,4.33,-1.1);
    bulb.xz+=(uv-.5)*.24;
    vec3 delta=bulb-p;float dist=length(delta);vec3 l=delta/dist;float facing=max(0.0,dot(l,n));
    if(facing>0.0 && trace(p+n*EPS*3.0,l).t>dist-.025) light+=vec3(16.0,10.8,6.40)*facing/(1.25+dist*dist);
    vec3 window=vec3((uv.x-.5)*2.82,1.1+uv.y*3.6,-5.28);
    delta=window-p;dist=length(delta);l=delta/max(dist,.0001);facing=max(0.0,dot(l,n))*max(0.0,-l.z);
    if(facing>0.0 && trace(p+n*EPS*3.0,l).t>dist-.025) light+=vec3(7.0,8.8,9.2)*facing/(1.8+dist*dist);
    return light;`
});
