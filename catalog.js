const studies = {
  bookshop: {
    name: '夹层旧书店', subject: '在两层书墙、通往夹层的木阶与拱窗之间，寻找红书车的反弹光。',
    move: '书车移至右侧', object: '书车', yaw: .095, elevation: .101, distance: 11.65, fov: 42, focus: [0,2.20,-2.50],
    yawLimits: [-.38,.40], elevationLimits: [.07,.25],
    gi: '移动酒红色书车，观察底层书页和车旁浅色地砖上的暖色是否跟着移动。',
    reflection: '从较低的视角看磨光石地，比较书车的红色侧板与黄铜扶手在两种模式下的倒影。'
  },
  canal: {
    name: '花市运河', subject: '沿水面望向石拱桥，两岸的百叶窗、条纹雨篷和花船在水中重叠。',
    move: '花船移至右侧', object: '花船', yaw: .08, elevation: .135, distance: 14.65, fov: 47.5, focus: [0,2.26,-3.65],
    yawLimits: [-.28,.29], elevationLimits: [.07,.35],
    gi: '看雨篷遮住的花箱和船舱内侧，切换全局光照，观察阴影里的颜色与层次。',
    reflection: '把花船移到右侧，观察船舷、花束与桥洞在水面上怎样交错。'
  },
  lake: {
    name: '雪峰帆影', subject: '沿湖岸转动视角，看云层、雪峰和红帆倒映在水纹里。',
    move: '帆船移至右侧', object: '帆船', yaw: .14, elevation: .075, distance: 9.35, fov: 42, focus: [-.12,1.20,-.45],
    gi: '观察红帆下方的浅色甲板，以及船靠近木栈桥时的间接光。', reflection: '移动帆船，对比湖面上红帆倒影的位置。'
  },
  canyon: {
    name: '赤岩溪谷', subject: '在层状砂岩之间，观察帐篷给浅色石块染上的暖色。',
    move: '帐篷移至右侧', object: '帐篷', yaw: .19, elevation: .15, distance: 10.25, focus: [0,.95,-.55],
    gi: '把橙色帐篷移开，比较原址浅色岩块面向篷布一侧的暖色。', reflection: '溪水映出两岸的砂岩和帐篷。移动帐篷，观察水中的轮廓。'
  },
  tram: {
    name: '雨后电车街', subject: '从湿路面和斑马线之间，追踪电车的倒影。',
    move: '电车移至右侧', object: '电车', yaw: .30, elevation: .15, distance: 9.65, focus: [0,1.02,-.45],
    gi: '对比车身旁站台和路缘的间接光，观察电车驶离前后的变化。', reflection: '盯着轨道前方的积水，观察橘色车身和车窗倒影是否同步移动。'
  },
  arch: {
    name: '朱红拱廊', subject: '观察红色地面在白台阶上留下的间接光。',
    move: '展台移至右侧', object: '红色展台', yaw: 0.315, elevation: 0.208, distance: 8.05, focus: [-0.15,1.18,-0.16],
    gi: '移动红色展台，观察白台阶侧面的红色是否随之褪去。', reflection: '看深色地砖上的拱门倒影是否跟着展台移动。'
  },
  neon: {
    name: '雨夜酒吧', subject: '在潮湿路面上追踪霓虹招牌的倒影。',
    move: '招牌移至右侧', object: '霓虹招牌', yaw: 0.14, elevation: 0.155, distance: 8.75, focus: [0,0.64,-0.30],
    gi: '移动发光招牌，观察卷帘门和路缘上的粉红色光晕。', reflection: '看湿路面上 BAR 三个字母的倒影能否跟上招牌。'
  },
  pool: {
    name: '午后水庭', subject: '从起伏的水面观察遮阳伞和石柱的反射。',
    move: '阳伞移至右侧', object: '遮阳伞', yaw: 0.22, elevation: 0.29, distance: 8.85, focus: [-0.05,1.03,-0.17],
    gi: '移动橘色阳伞，观察附近浅色池沿和石柱上的暖色。', reflection: '沿水平方向拖动视角，看水纹怎样打散伞面和柱廊的倒影。'
  },
  vinyl: {
    name: '黑胶听音室', subject: '比较唱片亮面映出的封套图案。',
    move: '封套移至右侧', object: '唱片封套', yaw: 0.23, elevation: 0.34, distance: 7.65, focus: [0.05,0.96,-0.04],
    gi: '观察封套附近的木台和转盘顶板，比较橙色反弹光的范围。', reflection: '移动封套后转动视角，观察黑胶沟槽里随视角改变的倒影。'
  }
};
const selectedStudy = new URLSearchParams(location.search).get('scene');
const studyId = Object.hasOwn(studies, selectedStudy) ? selectedStudy : 'arch';
const study = studies[studyId];
function referenceImage(id, state='on') {
  return 'previews/' + (id === 'arch' ? '' : id + '/') + state + '.webp';
}
