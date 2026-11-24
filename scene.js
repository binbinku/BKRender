(() => {
  const root = document.getElementById('light-study');
  root.querySelector('.scene-title').textContent = study.name;
  document.title = study.name + ' · 光线实验室';
  const select = root.querySelector('.scene-select');
  for (const [id, item] of Object.entries(studies)) select.add(new Option(item.name, id, false, id === studyId));
  select.addEventListener('change', () => location.assign('study.html?scene=' + select.value));
  root.querySelector('.move-label').textContent = study.move;
  root.querySelector('.gi-guide').textContent = study.gi;
  root.querySelector('.reflection-guide').textContent = study.reflection;
  const canvas = root.querySelector('canvas');
  const resolutionControl = root.querySelector('.resolution-control');
  const resolutionSelect = root.querySelector('#render-resolution');
  const renderSize = root.querySelector('#render-size');
  const resolutionKey = 'light-study/render-height';
  canvas.setAttribute('aria-label', study.name + '。' + study.subject + '拖动或用方向键旋转视角。');
  const gi = root.querySelector('.gi');
  const reflections = root.querySelector('.reflections');
  const motion = root.querySelector('.motion');
  const motionControl = motion.closest('label');
  const hasMotion = Boolean(world.openSky || studyId === 'bookshop' || studyId === 'vinyl');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let motionOverride = false, sceneSeconds = 0, lastTick = null;
  motion.checked = hasMotion && !reducedMotion.matches;
  motion.disabled = !hasMotion;
  const message = root.querySelector('.render-message');
  const sampling = root.querySelector('.sampling');
  const atmosphereButton = root.querySelector('.atmosphere-button');
  const atmospherePanel = root.querySelector('#atmosphere-settings');
  const atmosphereInputs = [...atmospherePanel.querySelectorAll('input')];
  for (const input of atmosphereInputs) {
    if (!world.openSky && (input.name === 'physicalSky' || input.name === 'volumeClouds')) {
      input.closest('label').hidden = true;
      input.disabled = true;
    }
  }
  let atmosphereExpanded = false;
  function showAtmosphereControls(available) {
    atmosphereButton.hidden = !available;
    atmospherePanel.hidden = !available || !atmosphereExpanded;
    atmosphereButton.setAttribute('aria-expanded', String(!atmospherePanel.hidden));
  }
  atmosphereButton.addEventListener('click', () => {
    atmosphereExpanded = !atmosphereExpanded;
    showAtmosphereControls(true);
  });
  const state = { yaw: study.yaw, elevation: study.elevation };
  const storageKey = 'light-study/' + studyId;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const modes = [...root.querySelectorAll('input[name="pipeline"]')];
  const moved = root.querySelector('.moved');
  const still = root.querySelector('.still');
  const hint = root.querySelector('.view-hint');
  const methodHint = root.querySelector('.method-hint');
  const embeddedViews = JSON.parse(root.querySelector('.still-sources')?.textContent || '{}');
  let updateView = () => {};
  const isBaked = () => modes.find(input => input.checked)?.value === 'baked';
  const viewer = root.querySelector('.viewport');
  const expand = viewer.querySelector('.expand');
  const zoomIn = viewer.querySelector('.zoom-in');
  const zoomOut = viewer.querySelector('.zoom-out');
  const zoomLevel = viewer.querySelector('.zoom-level');
  let zoom = 1;

  function changeZoom(step) {
    zoom = clamp(zoom + step, 1, 2);
    viewer.style.setProperty('--view-zoom', zoom);
    zoomLevel.textContent = Math.round(zoom * 100) + '%';
    zoomOut.disabled = zoom === 1;
    zoomIn.disabled = zoom === 2;
    updateView(true);
  }
  zoomIn.addEventListener('click', () => changeZoom(0.25));
  zoomOut.addEventListener('click', () => changeZoom(-0.25));

  function expandInPage(active) {
    viewer.classList.toggle('is-expanded', active);
    document.body.classList.toggle('expanded-view', active);
    root.querySelector('.detail-header').inert = active;
    root.querySelector('.scene-notes').inert = active;
    expand.textContent = active ? '退出全屏' : '全屏查看';
    expand.setAttribute('aria-pressed', String(active));
    expand.focus({ preventScroll: true });
  }
  expand.addEventListener('click', () => expandInPage(!viewer.classList.contains('is-expanded')));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && viewer.classList.contains('is-expanded')) expandInPage(false);
  });

  function update() {
    methodHint.textContent = isBaked()
      ? '固定表面从光照贴图读取间接光，' + study.object + '从所在位置的光照探针取光。反射探针保留初始位置的倒影。'
      : '实时光追根据' + study.object + '的当前位置计算间接光和倒影。';
    updateView();
  }
  function save() {
    const snapshot = {
      modelContent: { globalIllumination: gi.checked, reflections: reflections.checked,
        ...(motionOverride ? {motion:motion.checked} : {}),
        motionTime:sceneSeconds, method: isBaked() ? 'baked' : 'ray', stageMoved: moved.checked,
        atmosphere: Object.fromEntries(atmosphereInputs.filter(input => !input.disabled).map(input => [input.name, input.checked])) },
      privateContent: { ...state }
    };
    try { sessionStorage.setItem(storageKey, JSON.stringify(snapshot)); } catch {}
    window.openai?.setWidgetState?.(snapshot)?.catch(() => {});
  }
  function restore(saved) {
    if (!saved) return;
    const model = saved.modelContent || {}, view = saved.privateContent || {};
    if (typeof model.globalIllumination === 'boolean') gi.checked = model.globalIllumination;
    if (typeof model.reflections === 'boolean') reflections.checked = model.reflections;
    if (typeof model.stageMoved === 'boolean') moved.checked = model.stageMoved;
    for (const input of atmosphereInputs) {
      if (typeof model.atmosphere?.[input.name] === 'boolean') input.checked = model.atmosphere[input.name];
    }
    if (hasMotion && typeof model.motion === 'boolean') {
      motion.checked = model.motion;
      motionOverride = true;
    }
    if (Number.isFinite(model.motionTime) && !motion.checked) sceneSeconds = Math.max(0,model.motionTime);
    const selected = modes.find(input => input.value === model.method);
    if (selected) selected.checked = true;
    if (Number.isFinite(view.yaw)) state.yaw = clamp(view.yaw, ...(study.yawLimits || [-.66,.82]));
    if (Number.isFinite(view.elevation)) state.elevation = clamp(view.elevation, ...(study.elevationLimits || [.07,.61]));
    update();
  }
  for (const control of [gi, reflections, moved, ...modes, ...atmosphereInputs])
    control.addEventListener('change', () => { update(); save(); });
  motion.addEventListener('change', () => {
    motionOverride = true;
    lastTick = null;
    update();
    save();
  });
  reducedMotion.addEventListener('change', () => {
    if (!motionOverride && hasMotion) {
      motion.checked = !reducedMotion.matches;
      lastTick = null;
      update();
    }
  });
  window.addEventListener('openai:set_globals', e => restore(e.detail?.globals?.widgetState));
  try { restore(JSON.parse(sessionStorage.getItem(storageKey))); } catch {}
  restore(window.openai?.widgetState);

  function useFixedViews() {
    showAtmosphereControls(false);
    motionControl.hidden = true;
    lastTick = null;
    resolutionControl.hidden = true;
    message.hidden = true;
    sampling.textContent = '';
    canvas.hidden = true;
    still.hidden = false;
    hint.textContent = '固定视角预渲染 · 使用默认大气，可切换模式、位置、全局光照和反射。';
    updateView = () => {
      const effects = gi.checked ? (reflections.checked ? 'on' : 'gi') : (reflections.checked ? 'no-gi' : 'off');
      const prefix = isBaked() ? 'baked-' : 'ray-';
      const location = moved.checked ? 'right-' : 'left-';
      const key = !isBaked() && !moved.checked ? effects : prefix + location + effects;
      still.src = embeddedViews[key] || referenceImage(studyId, key);
    };
    update();
  }

  let renderer;
  try {
    renderer = new BKThree.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
  } catch {
    useFixedViews();
    return;
  }

  motionControl.hidden = !hasMotion;
  const gl = renderer.getContext();
  const viewportLimits = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  const attachmentLimit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  const maxWidth = Math.min(viewportLimits[0], attachmentLimit);
  const maxHeight = Math.min(viewportLimits[1], attachmentLimit);
  try {
    const saved = localStorage.getItem(resolutionKey);
    if ([...resolutionSelect.options].some(option => option.value === saved)) resolutionSelect.value = saved;
  } catch {}
  resolutionControl.hidden = false;
  resolutionSelect.addEventListener('change', () => {
    try { localStorage.setItem(resolutionKey, resolutionSelect.value); } catch {}
    resize();
  });

  const T = BKThree;
  const camera = new T.PerspectiveCamera(32, 1, 0.01, 50);
  const focus = new T.Vector3(...study.focus);
  const fullscreenCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scene = new T.Scene();
  const vertexShader = `
    varying vec2 screenUV;
    void main() { screenUV=uv; gl_Position=vec4(position.xy,0.0,1.0); }
  `;
  function material(fragmentShader, uniforms) {
    return new T.ShaderMaterial({ fragmentShader, vertexShader, uniforms,
      depthWrite: false, depthTest: false, blending: T.NoBlending });
  }

  const geometryUniforms = world.model ? detailUniforms(T, world.model) : {};
  const atmosphereUniforms = Object.fromEntries(atmosphereInputs.map(input => [input.name, { value: input.checked && !input.disabled }]));
  const skyTarget = world.openSky ? new T.WebGLRenderTarget(640, 192, {
    minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, stencilBuffer: false
  }) : null;
  if (skyTarget) skyTarget.texture.wrapS = T.RepeatWrapping;
  const skyFrames = [null,null];
  // The bake always sees the same sky for a weather setting, independent of playback.
  const bakeAtmosphere = {...atmosphereUniforms, skyMap:{value:skyTarget?.texture || null},
    nextSkyMap:{value:skyTarget?.texture || null},skyBlend:{value:0}};

  const skyMaterial = skyTarget ? material(makeSkyShader(world), {
    physicalSky: atmosphereUniforms.physicalSky, volumeClouds: atmosphereUniforms.volumeClouds,cloudTime:{value:0}
  }) : null;
  const uniforms = {
    ...geometryUniforms, ...atmosphereUniforms,
    skyMap:{value:skyTarget?.texture || null},nextSkyMap:{value:skyTarget?.texture || null},skyBlend:{value:0},
    sceneTime:{value:0},motionDelta:{value:0},historyCount:{value:0},
    reconstructLighting:{value:false}, diffuseHistory:{value:null}, diffuseGeometry:{value:null}, volumeHistory:{value:null}, diffuseSize:{value:new T.Vector2()},
    resolution: { value: new T.Vector2() }, cameraWorld: { value: camera.matrixWorld },
    tanHalfFov: { value: 0 }, sampleNumber: { value: 0 }, useGI: { value: true },
    useReflections: { value: true }, bakedMode: { value: false }, stageOffset: { value: 0 },
    staticOnly: {value:false}, lightmapMeta:{value:null}, surfaceLightmap:{value:null},
    hideMetal: { value: false }, diffuseAtlas: { value: null }, ballPanorama: { value: null },
    floorPanorama: { value: null }, previousFrame: { value: null }
  };
  const traceMaterial = material(roomTraceShader, uniforms);
  const displayMaterial = material(roomDisplayShader, { image: { value: null }, resolution: uniforms.resolution, samples: uniforms.historyCount });
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), traceMaterial);
  quad.frustumCulled = false;
  scene.add(quad);
  const floatTargets = renderer.extensions.has('EXT_color_buffer_float');
  const lightingHistory = createLightingHistory(T,material,uniforms,floatTargets,draw);
  const maxSamples = floatTargets ? 256 : 32;
  const targets = Array.from({ length: 2 }, () => new T.WebGLRenderTarget(1, 1, {
    type: floatTargets ? T.HalfFloatType : T.UnsignedByteType,
    minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: false, stencilBuffer: false
  }));
  let probeTargets = null;
  let renderedSkyKey = -1, probeSkyKey = -1, probeMediumKey = -1;
  let sequence = 0;
  let frame = 0, count = 0, targetIndex = 0, failed = false, visible = true;
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
    console.error(gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment));
    failed = true;
    useFixedViews();
  };

  function draw(pass,target) {
    quad.material=pass;
    renderer.setRenderTarget(target);
    renderer.render(scene,fullscreenCamera);
  }
  function renderSky(target,seconds) {
    skyMaterial.uniforms.cloudTime.value=seconds;
    draw(skyMaterial,target);
  }
  function cloudFrame(index,skyKey) {
    if(index===0) return skyTarget;
    const slot=index%2;
    const cached=skyFrames[slot] ||= {target:skyTarget.clone(), index:-1, key:-1};
    if(cached.index!==index || cached.key!==skyKey){
      renderSky(cached.target,index*2);
      cached.index=index;
      cached.key=skyKey;
    }
    return cached.target;
  }
  function render(timestamp) {
    frame = 0;
    if (failed || document.hidden || !visible || renderer.getContext().isContextLost()) return;
    const playing=hasMotion && motion.checked;
    const elapsed=lastTick===null ? 0 : (timestamp-lastTick)/1000;
    if(playing && lastTick!==null && elapsed<1/30-.001){queue();return;}
    const delta=playing ? Math.min(.25,Math.max(0,elapsed)) : 0;
    sceneSeconds+=delta;
    lastTick=playing ? timestamp : null;
    uniforms.sceneTime.value=sceneSeconds;
    uniforms.motionDelta.value=delta;
    const skyKey = Number(uniforms.physicalSky.value) + 2 * Number(uniforms.volumeClouds.value);
    const mediumKey = Number(uniforms.volumeFog.value) + 2 * Number(uniforms.volumeLight.value);
    if (skyTarget) {
      if(renderedSkyKey!==skyKey){
        renderSky(skyTarget,0);
        renderedSkyKey=skyKey;
      }
      const phase=uniforms.volumeClouds.value ? sceneSeconds/2 : 0;
      const index=Math.floor(phase), fraction=phase-index;
      uniforms.skyMap.value=cloudFrame(index,skyKey).texture;
      uniforms.nextSkyMap.value=fraction>0 ? cloudFrame(index+1,skyKey).texture : uniforms.skyMap.value;
      uniforms.skyBlend.value=fraction;
      if(failed) return;
    }
    if (uniforms.bakedMode.value && (!probeTargets || probeSkyKey !== skyKey || probeMediumKey !== mediumKey)) {
      try {
        probeTargets = bakeStudioProbes(T, renderer, scene, fullscreenCamera, quad, material, uniforms,
          geometryUniforms, bakeAtmosphere, probeTargets, probeSkyKey !== skyKey);
      } catch (error) {
        console.error('Could not bake scene lighting.', error);
        failed = true;
        useFixedViews();
        return;
      }
      probeSkyKey = skyKey;
      probeMediumKey = mediumKey;
      if (failed) return;
    }
    const output = targets[targetIndex];
    uniforms.sampleNumber.value = sequence;
    uniforms.historyCount.value = count;
    uniforms.previousFrame.value = targets[1 - targetIndex].texture;
    // Once a paused view has a clean starting image, refine using independent
    // full-resolution paths. Its stationary lighting cache is still valid on orbit.
    const noisyLighting=(uniforms.useGI.value && !uniforms.bakedMode.value) || uniforms.volumeLight.value;
    uniforms.reconstructLighting.value=noisyLighting && (playing || count<16);
    if(uniforms.reconstructLighting.value){
      lightingHistory.render();
      if(failed) return;
    }
    draw(traceMaterial,output);
    if (failed) return;
    displayMaterial.uniforms.image.value = output.texture;
    draw(displayMaterial,null);
    targetIndex = 1 - targetIndex;
    sequence = (sequence+1)%8192;
    count = Math.min(count+1,maxSamples);
    message.hidden = true;
    if (count === 1) sampling.textContent = '正在细化画面';
    if (count === maxSamples) sampling.textContent = '';
    queue();
  }
  function queue() {
    if (!failed && visible && !document.hidden && !frame && (count < maxSamples || (hasMotion && motion.checked)))
      frame = requestAnimationFrame(render);
  }
  function resetSamples(cameraOnly = false) {
    count = 0;
    if(!cameraOnly){
      sequence = 0;
      lightingHistory.reset();
    }
    for (const input of atmosphereInputs) atmosphereUniforms[input.name].value = input.checked && !input.disabled;
    uniforms.bakedMode.value = isBaked();
    uniforms.stageOffset.value = moved.checked ? 2.55 : 0;
    uniforms.useGI.value = gi.checked;
    uniforms.useReflections.value = reflections.checked;
    camera.position.set(
      Math.sin(state.yaw) * Math.cos(state.elevation),
      Math.sin(state.elevation),
      Math.cos(state.yaw) * Math.cos(state.elevation)
    ).multiplyScalar(study.distance).add(focus);
    camera.lookAt(focus);
    camera.updateMatrixWorld();
    const tangent = Math.tan((study.fov || 32) * Math.PI / 360) * Math.max(1, 1.40 / camera.aspect) / zoom;
    camera.fov = 2 * Math.atan(tangent) * 180 / Math.PI;
    camera.updateProjectionMatrix();
    uniforms.tanHalfFov.value = tangent;
    queue();
  }
  function resize() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height || gl.isContextLost()) return;
    const requestedHeight = Number(resolutionSelect.value);
    const scale = Math.min(requestedHeight / height, maxWidth / width, maxHeight / height);
    let w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    if (canvas.width !== w || canvas.height !== h) renderer.setSize(w, h, false);
    // Some browsers limit the default framebuffer below the advertised GL limits.
    const available = Math.min(gl.drawingBufferWidth / w, gl.drawingBufferHeight / h);
    if (available <= 0) return;
    if (available < 1) {
      w = Math.max(1, Math.floor(w * available));
      h = Math.max(1, Math.floor(h * available));
      renderer.setSize(w, h, false);
    }
    for (const target of targets) target.setSize(w, h);
    uniforms.resolution.value.set(w, h);
    renderSize.textContent = w + ' × ' + h + (h < requestedHeight ? '（设备上限）' : '');
    camera.aspect = w / h;
    resetSamples();
  }
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (drag || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  });
  function orbit(dx, dy) {
    const yaw = clamp(state.yaw + dx, ...(study.yawLimits || [-.66,.82]));
    const elevation = clamp(state.elevation + dy, ...(study.elevationLimits || [.07,.61]));
    if (yaw === state.yaw && elevation === state.elevation) return;
    state.yaw = yaw;
    state.elevation = elevation;
    resetSamples(true);
  }
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    orbit((drag.x - e.clientX) * 0.006, (e.clientY - drag.y) * 0.005);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  canvas.addEventListener('lostpointercapture', () => { if (drag) { drag = null; save(); } });
  canvas.addEventListener('keydown', e => {
    const movement = { ArrowLeft: [-0.065, 0], ArrowRight: [0.065, 0], ArrowUp: [0, 0.04], ArrowDown: [0, -0.04] }[e.key];
    if (movement) { e.preventDefault(); orbit(...movement); save(); }
  });

  function visibilityChanged() {
    lastTick = null;
    if (!visible || document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else queue();
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    visibilityChanged();
  }).observe(canvas);
  new ResizeObserver(resize).observe(canvas);
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    cancelAnimationFrame(frame);
    frame = 0;
    lightingHistory.release();
    for (const target of targets) target.dispose();
    skyTarget?.dispose();
    for (const slot of skyFrames) slot?.target.dispose();
    probeTargets?.layout.dispose();
    probeTargets?.targets.forEach(target => target.dispose());
    probeTargets = null;
    for (const key of ['diffuseAtlas','ballPanorama','floorPanorama','lightmapMeta','surfaceLightmap'])
      uniforms[key].value = null;
    useFixedViews();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (failed) return;
    renderedSkyKey = -1;
    for(const slot of skyFrames){ if(slot) slot.index=-1; }
    lastTick = null;
    motionControl.hidden = !hasMotion;
    showAtmosphereControls(true);
    resolutionControl.hidden = false;
    still.hidden = true;
    canvas.hidden = false;
    hint.textContent = '拖动或用方向键转动视角';
    updateView = resetSamples;
    resize();
  });
  updateView = resetSamples;
  update();
  resize();
})();
