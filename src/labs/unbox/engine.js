/* Unboxing 的引擎：一个连续的三维场景，桌上一只雾蓝色的翻盖礼盒，撕掉封条、掀盖、拿出卡包、撕开、抽卡、一张张看、摊开、拿近转着看。
   用 Three.js 画（为什么见 README 的「选型」）：纸板、锡箔、卡面都是带粗糙度、金属度、法线的实体材质，
   靠一张房间环境图打反光，主光投软影子到桌上（桌面只接影子，颜色就是舞台的底色）；镭射在光照之后叠一层（addHolo）。
   撕拉条和卡包撕条是两排质点连成的纸带（Ribbon），手拉到哪撕到哪。
   所有拖动都“跟手”：按住的那一点一直待在指针下面（盒盖只能绕铰链转，取弧线上离指针最近的那一点）。
   单位是厘米，桌面是 y=0。贴图全在 paint.js 里用 canvas 现画。

     const u = create(root, { canvas, hint, dark, still, onStatus, onPhase });
     u.restart(); u.setDark(true); u.destroy();

   hint 是舞台底下那行提示，引擎自己往里写；onStatus('ready' | 'poster')：没有 WebGL、显卡是 CPU 模拟的时候不画，
   交给组件放一张静帧；onPhase(phase) 每换一步调一次（zip → lid → lift → tear → slide → reveal → done）。
   省电的规矩写在「每帧」那一段。 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { softwareGL } from "../_kit/gl.js";
import { CARD, CARDS, DEG, FOG, NIGHT, PACK, TAU, TILE_CM, canvasHeight, clamp, heightToNormal, lerp, paintBaseFront, paintBaseSide, paintCardBack, paintCardFront, paintLidInside, paintLidTop, paintPackBack, paintPackFront, paintPackNormal, paintPaper, paintZip, paperNormal, smooth, tearJag } from "./paint.js";

export function create(root, opts = {}) {
  const { canvas, hint: hintEl } = opts;
  const reduce = !!opts.still;   // 「减弱动态效果」：弹簧不回弹，卡包不飘
  const inv = (a, b, x) => clamp((x - a) / (b - a));
  const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* 每帧推进的弹簧（resp 是周期，bounce 是回弹） */
  class Spring {
    constructor(x = 0) { this.x = x; this.v = 0; this.t = x; }
    step(dt, resp, bounce = 0) {
      if (reduce) bounce = 0;
      const w = TAU / Math.max(0.04, resp), k = w * w, c = 2 * (1 - clamp(bounce, 0, 0.95)) * w;
      const n = Math.max(1, Math.ceil(dt * 480)), hh = dt / n;
      for (let i = 0; i < n; i++) { const a = -k * (this.x - this.t) - c * this.v; this.v += a * hh; this.x += this.v * hh; }
      return this.x;
    }
    snap(x) { this.x = this.t = x; this.v = 0; }
    near(e = 0.002, ev = 0.02) { return Math.abs(this.x - this.t) < e && Math.abs(this.v) < ev; }
  }

  /* ───────── 场景：渲染器、相机、灯光、桌面 ───────── */
  // 单位是厘米。桌面是 y=0 的平面，盒子立在原点，相机从右前上方看。
  const G = { ok: false };
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  function initScene(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    G.renderer = renderer;
    G.maxAniso = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    G.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    G.env = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
    scene.environment = G.env;
    scene.environmentIntensity = 0.62;

    G.camera = new THREE.PerspectiveCamera(28, 3 / 4, 1, 500);

    // 主光：左上偏前，投软影
    const key = new THREE.DirectionalLight(0xfff6ec, 2.1);
    key.position.set(-26, 58, 30);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 20; sc.far = 130;
    key.shadow.radius = 9; key.shadow.blurSamples = 20;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
    scene.add(key, key.target);
    G.key = key;
    // 补光：从右边来的一点冷光，让暗面不死
    const fill = new THREE.DirectionalLight(0xe8eeff, 0.35); fill.position.set(40, 20, 10); scene.add(fill);
    G.fill = fill;
    // 拿到面前以后才亮的一盏：在相机左上方，给锡箔的褶皱和卡面的光油一点反光
    const glint = new THREE.DirectionalLight(0xffffff, 0); scene.add(glint, glint.target);
    G.glint = glint;

    // 桌面只接影子，颜色交给 CSS 背景，所以浅色深色和页面完全一样
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ color: 0x2a2018, opacity: 0.22 }));
    desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);
    G.desk = desk;

    G.root = new THREE.Group(); scene.add(G.root);
    G.ok = true;
  }

  function setTheme(dark) {
    if (!G.ok) return;
    G.dark = dark;
    G.desk.material.opacity = dark ? 0.5 : 0.22;
    G.desk.material.color.set(dark ? 0x000000 : 0x2a2018);
    G.scene.environmentIntensity = dark ? 0.42 : 0.62;
    G.key.intensity = dark ? 1.75 : 2.1;
    G.fill.intensity = dark ? 0.22 : 0.35;
    G.renderer.toneMappingExposure = dark ? 0.92 : 1.0;
    if (G.onTheme) G.onTheme(dark);
  }

  /* 相机：目标点、距离、仰角、方位角；距离按画面比例自动算，让需要的范围刚好装下 */
  const CAM = {
    t: new Spring(0),
    A: { target: V3(0, 3.6, 0.6), elev: 50, azim: 16, needW: 37, needH: 31 },
    B: { target: V3(0, 34, 8), elev: -5, azim: 10, needW: 19, needH: 21 },
  };
  function camPose(P, aspect, fov) {
    const vt = Math.tan(fov * DEG / 2), ht = vt * aspect;
    const d = Math.max(P.needW / 2 / ht, P.needH / 2 / vt);
    return { target: P.target, d, elev: P.elev, azim: P.azim };
  }
  function placeCamera() {
    const cam = G.camera, k = smooth(clamp(CAM.t.x, 0, 1.2) > 1 ? 1 : clamp(CAM.t.x)), a = cam.aspect, fov = cam.fov;
    const A = camPose(CAM.A, a, fov), B = camPose(CAM.B, a, fov);
    const tg = A.target.clone().lerp(B.target, k);
    const d = lerp(A.d, B.d, k), el = lerp(A.elev, B.elev, k) * DEG, az = lerp(A.azim, B.azim, k) * DEG;
    cam.position.set(tg.x + d * Math.cos(el) * Math.sin(az), tg.y + d * Math.sin(el), tg.z + d * Math.cos(el) * Math.cos(az));
    cam.lookAt(tg);
    cam.updateMatrixWorld();
    if (G.glint) {
      G.glint.position.copy(cam.position).add(V3(-10, 16, 0).applyQuaternion(cam.quaternion));
      G.glint.target.position.copy(tg); G.glint.target.updateMatrixWorld();
      G.glint.intensity = (G.dark ? 0.7 : 0.9) * k;
    }
  }

  function resizeScene(w, hh, dpr) {
    if (!G.ok) return;
    G.renderer.setPixelRatio(dpr);
    G.renderer.setSize(w, hh, false);
    G.camera.aspect = w / hh; G.camera.updateProjectionMatrix();
    G.w = w; G.h = hh;
    placeCamera();
  }

  /* 屏幕坐标（舞台像素）→ 射线 */
  const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
  function rayAt(x, y) {
    _ndc.set(x / G.w * 2 - 1, -(y / G.h) * 2 + 1);
    _ray.setFromCamera(_ndc, G.camera);
    return _ray;
  }
  function rayPlane(x, y, normal, point) {
    const r = rayAt(x, y).ray, pl = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
    const out = V3(); return r.intersectPlane(pl, out) ? out : null;
  }
  function toScreen(v) {
    const p = v.clone().project(G.camera);
    return [(p.x + 1) / 2 * G.w, (1 - p.y) / 2 * G.h];
  }

  /* 世界坐标的 UV：纸纹按厘米铺，切口按瓦楞铺。faces 的顺序和 BoxGeometry 一样：+x −x +y −y +z −z */
  function panelGeo(min, max, faces, pivot) {
    const s = max.clone().sub(min), c = min.clone().add(max).multiplyScalar(0.5);
    const g = new THREE.BoxGeometry(s.x, s.y, s.z);
    g.translate(c.x, c.y, c.z);
    const pos = g.attributes.position, uv = g.attributes.uv, uv1 = new Float32Array(pos.count * 2);
    const ax = ['x', 'y', 'z'];
    for (let f = 0; f < 6; f++) {
      const F = faces[f] || {};
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k, p = V3().fromBufferAttribute(pos, i);
        const nAx = Math.floor(f / 2);
        const others = ax.filter((_, j) => j !== nAx);
        let ua = F.u || others[0], va = F.v || others[1];
        let u = p[ua], v = p[va];
        uv1[i * 2] = (F.fu ? -u : u); uv1[i * 2 + 1] = (F.fv ? -v : v);
        if (F.fit) { u = (u - min[ua]) / s[ua]; v = (v - min[va]) / s[va]; if (F.fu) u = 1 - u; if (F.fv) v = 1 - v; }
        else { if (F.fu) u = -u; if (F.fv) v = -v; }
        uv.setXY(i, u, v);
      }
    }
    g.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    if (pivot) g.translate(-pivot.x, -pivot.y, -pivot.z);
    return g;
  }
  function canvasTex(c, opts = {}) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, G.maxAniso || 1);
    if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat, opts.repeat); }
    if (opts.wrapS) t.wrapS = THREE.RepeatWrapping;
    return t;
  }

  /* 镭射：在光照算完以后叠一层。颜色由反射方向决定（倾斜就换色），亮度集中在一条“反光带”里，
     带子随视角滑过表面；带外只留很淡的底色。遮罩取金属粗糙图的 R 通道 */
  function addHolo(mat, o = {}) {
    const prev = mat.onBeforeCompile;
    mat.userData.holo = { uHolo: { value: o.amount ?? 1 }, uShift: { value: 0 }, uSweep: { value: -1 } };
    const mask = o.mask || 'roughnessMap', muv = o.uv || 'vRoughnessMapUv';
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      Object.assign(sh.uniforms, mat.userData.holo);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
  uniform float uHolo; uniform float uShift; uniform float uSweep;
  float holoHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
        .replace('#include <opaque_fragment>', `
    {
      float hm = texture2D(${mask}, ${muv}).r * uHolo;
      if (hm > 0.002) {
        vec3 Vv = normalize(vViewPosition);
        vec3 Rr = reflect(-Vv, normal);
        vec2 uvh = ${muv};
        float sp = dot(Rr, normalize(vec3(-0.32, 0.5, 0.8)));
        float sd = sp + (uvh.x - uvh.y) * ${o.slope || '0.06'};
        ${o.band ? `float glint = exp(-(sd - ${o.band}) * (sd - ${o.band}) / ${o.bw || '0.0016'});` : `float glint = smoothstep(${o.lo || '0.86'}, 1.0, sd);`}
        float sw = (uvh.x * 0.6 + uvh.y * 0.4) - (uSweep * 1.5 - 0.25);
        glint = max(glint, exp(-sw * sw / 0.012) * step(0.0, uSweep) * step(uSweep, 1.0));
        float ph = Rr.x * ${o.fx || '2.2'} + Rr.y * ${o.fy || '1.6'} + (uvh.x * 0.45 + uvh.y * 0.3) + uShift;
        vec3 rb = 0.5 + 0.5 * cos(6.28318 * (ph + vec3(0.0, 0.33, 0.67)));
        rb = mix(rb, vec3(1.0), 0.22);
        vec2 cell = floor(uvh * ${o.cells || '240.0'});
        float rnd = holoHash(cell);
        float tw = smoothstep(0.96, 1.0, fract(rnd * 19.0 + ph * 2.3)) * step(0.6, rnd);
        vec3 holo = rb * ${o.base || '0.10'} + mix(rb, vec3(1.0), ${o.white || '0.0'}) * glint + vec3(tw) * (0.25 + 0.9 * glint);
        outgoingLight += holo * hm * ${o.gain || '0.55'};
      }
    }
    #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'holo-' + (o.key || mask);
    return mat;
  }

  /* ───────── 礼盒：盒身、翻盖、正面的撕拉条、里面的内托 ─────────
     盒宽 W（x）、长 L（z）、高 H（y）、硬纸板厚 T。盖子绕后沿的折痕翻起；盖子前面垂下一道裙边，
     裙边中间是一条撕拉条，撕掉以后裙边分成上下两截，上截跟盖子走，下截留在盒身上。 */
  const BOX = { W: 13.4, L: 17.4, H: 4.6, T: 0.22, ov: 0.07, lip: 2.4, zipW: 0.9, tab: 1.05 };
  BOX.zipC = BOX.H + BOX.T - BOX.lip / 2 - 0.1;                  // 撕拉条中线的高度
  BOX.zipLo = BOX.zipC - BOX.zipW / 2; BOX.zipHi = BOX.zipC + BOX.zipW / 2;
  BOX.zipZ = BOX.L / 2 + BOX.ov + BOX.T;                         // 裙边外表面
  BOX.insY = BOX.H - 1.05; BOX.recD = 0.5; BOX.recZ = 0.35;       // 内托面的高度、凹槽深度、凹槽中心
  const PACK_REST = (() => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    return { p: V3(0, BOX.insY - BOX.recD + 0.3, BOX.recZ), q };
  })();

  function buildBox() {
    const { W, L, H, T, ov, lip } = BOX;
    const fog = paintPaper(FOG, 3, false), night = paintPaper(NIGHT, 4, true);
    const rep = 1 / TILE_CM;
    const tex = {
      fog: canvasTex(fog, { repeat: rep }), night: canvasTex(night, { repeat: rep }),
      n: canvasTex(paperNormal(9), { repeat: rep, linear: true }),
    };
    tex.n.channel = 1;
    const LW = W + 2 * ov, LL = L + 2 * ov + T;
    const top = paintLidTop(LW, LL, fog), inside = paintLidInside(LW, LL);
    const front = paintBaseFront(W, H, fog), side = paintBaseSide(L, H, fog);
    const nScale = new THREE.Vector2(0.35, 0.35);
    const std = o => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0, normalMap: tex.n, normalScale: nScale }, o));
    const topN = canvasTex(heightToNormal(canvasHeight(top.hgt), top.hgt.width, top.hgt.height, 2.4, false), { linear: true });
    const M = {
      fog: std({ map: tex.fog }),
      night: std({ map: tex.night, roughness: 0.86 }),
      top: new THREE.MeshStandardMaterial({ map: canvasTex(top.c), roughnessMap: canvasTex(top.m, { linear: true }), metalnessMap: canvasTex(top.m, { linear: true }), roughness: 1, metalness: 1, normalMap: topN, normalScale: new THREE.Vector2(0.6, 0.6) }),
      inside: new THREE.MeshStandardMaterial({ map: canvasTex(inside.c), roughnessMap: canvasTex(inside.m, { linear: true }), metalnessMap: canvasTex(inside.m, { linear: true }), roughness: 1, metalness: 1, normalMap: tex.n, normalScale: nScale }),
      front: std({ map: canvasTex(front.c) }), side: std({ map: canvasTex(side.c) }),
    };
    const box = new THREE.Group(); box.name = 'box';
    const add = (geo, mats, parent = box) => { const m = new THREE.Mesh(geo, mats.map(k => M[k])); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    const Fz = { u: 'z', v: 'y' }, Fx = { u: 'x', v: 'y' }, Fy = { u: 'x', v: 'z' };

    // 盒身：底、四面墙。墙的上沿也包着外面的纸
    add(panelGeo(V3(-W / 2, 0, -L / 2), V3(W / 2, T, L / 2), [Fz, Fz, Fy, Fy, Fx, Fx]), ['fog', 'fog', 'night', 'fog', 'fog', 'fog']);
    add(panelGeo(V3(-W / 2, T, L / 2 - T), V3(W / 2, H, L / 2), [Fz, Fz, Fy, Fy, { fit: true, u: 'x', v: 'y' }, { u: 'x', v: 'y', fu: true }]), ['fog', 'fog', 'fog', 'fog', 'front', 'night']);
    add(panelGeo(V3(-W / 2, T, -L / 2), V3(W / 2, H, -L / 2 + T), [Fz, Fz, Fy, Fy, Fx, { u: 'x', v: 'y', fu: true }]), ['fog', 'fog', 'fog', 'fog', 'night', 'fog']);
    add(panelGeo(V3(W / 2 - T, T, -L / 2 + T), V3(W / 2, H, L / 2 - T), [{ fit: true, u: 'z', v: 'y', fu: true }, Fz, Fy, Fy, Fx, Fx]), ['side', 'night', 'fog', 'fog', 'fog', 'fog']);
    add(panelGeo(V3(-W / 2, T, -L / 2 + T), V3(-W / 2 + T, H, L / 2 - T), [Fz, { u: 'z', v: 'y', fu: true }, Fy, Fy, Fx, Fx]), ['night', 'fog', 'fog', 'fog', 'fog', 'fog']);
    // 裙边的下半截，粘在盒身正面
    add(panelGeo(V3(-W / 2 - ov, H + T - lip, L / 2), V3(W / 2 + ov, BOX.zipLo, BOX.zipZ), [Fz, Fz, Fy, Fy, Fx, Fx]), ['fog', 'fog', 'fog', 'fog', 'fog', 'fog']);

    // 内托：一块带凹槽的硬纸板，凹槽一侧挖个半圆的指口
    const iw = W - 2 * T - 0.02, il = L - 2 * T - 0.02, rw = PACK.W + 0.26, rl = PACK.H + 0.26, nr = 1.05;
    const sh = new THREE.Shape();
    sh.moveTo(-iw / 2, -il / 2); sh.lineTo(iw / 2, -il / 2); sh.lineTo(iw / 2, il / 2); sh.lineTo(-iw / 2, il / 2); sh.closePath();
    const hole = new THREE.Path(), zc = -BOX.recZ;   // 形状的 y 轴对着 −z
    hole.moveTo(-rw / 2, zc - rl / 2); hole.lineTo(rw / 2, zc - rl / 2); hole.lineTo(rw / 2, zc - nr);
    hole.absarc(rw / 2, zc, nr, -Math.PI / 2, Math.PI / 2, false);
    hole.lineTo(rw / 2, zc + rl / 2); hole.lineTo(-rw / 2, zc + rl / 2); hole.closePath();
    sh.holes.push(hole);
    const ins = new THREE.ExtrudeGeometry(sh, { depth: BOX.recD, bevelEnabled: false, curveSegments: 24 });
    ins.rotateX(-Math.PI / 2); ins.translate(0, BOX.insY - BOX.recD, 0);
    ins.setAttribute('uv1', ins.attributes.uv.clone());
    const insM = new THREE.Mesh(ins, M.night); insM.castShadow = false; insM.receiveShadow = true; box.add(insM);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(iw, il).rotateX(-Math.PI / 2).translate(0, BOX.insY - BOX.recD + 0.002, 0), M.night);
    fl.geometry.setAttribute('uv1', fl.geometry.attributes.uv.clone()); fl.receiveShadow = true; box.add(fl);

    // 盖子：绕后沿转。顶板 + 裙边上半截
    const pivot = V3(0, H + T / 2, -L / 2 - ov);
    const lid = new THREE.Group(); lid.position.copy(pivot); box.add(lid);
    const lm = [
      add(panelGeo(V3(-W / 2 - ov, H, -L / 2 - ov), V3(W / 2 + ov, H + T, BOX.zipZ), [Fz, Fz, { fit: true, u: 'x', v: 'z', fv: true }, { fit: true, u: 'x', v: 'z' }, Fx, Fx], pivot), ['fog', 'fog', 'top', 'inside', 'fog', 'fog'], lid),
      add(panelGeo(V3(-W / 2 - ov, BOX.zipHi, L / 2 + 0.01), V3(W / 2 + ov, H, BOX.zipZ), [Fz, Fz, Fy, Fy, Fx, Fx], pivot), ['fog', 'fog', 'fog', 'fog', 'fog', 'night'], lid),
    ];
    const L0 = { g: lid, meshes: lm, a: new Spring(0), open: false, pivot, max: 112 * DEG, rest: 104 * DEG, locked: true };
    lm.forEach(m => { m.userData.lid = true; });

    G.root.add(box);
    return { group: box, lid: L0, M, tex, insert: insM };
  }

  /* 盖子角度：每帧推弹簧。锁着的时候只能抬起一点点 */
  function updateLid(Bx, dt) {
    const l = Bx.lid;
    if (!l.held) {
      l.a.step(dt, l.open ? 0.7 : 0.42, l.open ? 0.22 : 0.3);
      // 铰链开到头就停住；合上时碰到盒口轻轻弹一下
      if (l.a.x > l.max) { l.a.x = l.max; if (l.a.v > 0) l.a.v *= -0.25; }
      if (l.a.x < 0) { l.a.x = 0; if (l.a.v < 0) l.a.v *= -0.2; }
    }
    l.g.rotation.x = -l.a.x;
  }

  /* 撕拉条：沿裙边从左到右。起头那一截是拉手，翘起来一点；撕口跟着手的横向位置走 */
  function zipPath(s) {
    const { W, ov } = BOX;
    return { p: V3(-W / 2 - ov + s, BOX.zipC, BOX.zipZ + 0.012), n: V3(0, 0, 1), w: V3(0, -1, 0) };   // w 朝下：这样网格的正面朝外
  }
  function zipCollide(P, PP) {
    const { W, L, H, T, ov } = BOX;
    if (P.y < 0.03) { P.y = 0.03; if (PP) { PP.x = P.x - (P.x - PP.x) * 0.4; PP.z = P.z - (P.z - PP.z) * 0.4; } }
    if (Math.abs(P.x) < W / 2 + ov + 0.05 && P.y < H + T + 0.05 && P.y > 0 && P.z < BOX.zipZ + 0.03 && P.z > -L / 2) P.z = BOX.zipZ + 0.03;
  }
  function buildZip() {
    const { W, ov, zipW, tab } = BOX, len = W + 2 * ov;
    const mat = twoSided({ map: canvasTex(paintZip(len, zipW, tab)), roughness: 0.5, metalness: 0, alphaTest: 0.5 }, 0xdfe4ea, 0.85, 0.9);
    const rb = new Ribbon({
      len, ds: 0.22, width: zipW, rows: 2, path: zipPath, material: mat, p0: tab, flipV: true,
      gravity: 320, bend: 0.35, peelAt: 0.04, assist: 1.0, maxRate: 80, curlR: 0.14, damp: 0.975,
      collide: zipCollide,
      along: hand => hand.x + W / 2 + ov - 0.45,
    });
    rb.wig = 0;
    rb.restPose = i => {
      if (rb.p > tab + 0.05) return null;
      const s = i * rb.ds, q = zipPath(s), out = clamp((tab - s) / tab);
      return q.p.addScaledVector(q.n, 0.05 + out * out * (0.42 + rb.wig * 0.7));
    };
    G.root.add(rb.mesh);
    return rb;
  }

  /* ───────── 撕带：胶带和卡包撕条共用的一条纸带 ─────────
     纸带是两排质点（左边、右边）连成的窄布条：沿边、横向、对角、隔一个点的弯曲约束。
     这样它只能绕宽度方向弯、能拧，但不能在自己的平面里横着折（纸带本来就折不了）。
     纸带沿一条贴在物体表面的路径 S(s) 排开，s 从自由端（拉手）量起。s < p 的部分已经揭开，按 verlet 自由运动；
     s ≥ p 的部分还贴着，每帧钉在路径上。手捏住自由端往外拉，手和揭口之间的直线距离超过揭开的长度，就往前揭。 */
  class Ribbon {
    constructor(o) {
      Object.assign(this, { ds: 0.3, width: 4.8, gravity: 520, damp: 0.985, bend: 0.2, peelAt: 0.1, maxRate: 120, assist: 2.4, iters: 14, sub: 2, rows: 2, curlR: 0.28 }, o);
      this.N = Math.round(this.len / this.ds) + 1;
      this.ds = this.len / (this.N - 1);
      this.diag = Math.hypot(this.ds, this.width);
      this.A = []; this.B = []; this.PA = []; this.PB = []; this.M = [];
      for (let i = 0; i < this.N; i++) {
        const q = this.path(i * this.ds);
        const a = q.p.clone().addScaledVector(q.w, -this.width / 2), b = q.p.clone().addScaledVector(q.w, this.width / 2);
        this.A.push(a); this.B.push(b); this.PA.push(a.clone()); this.PB.push(b.clone()); this.M.push(q.p.clone());
      }
      this.p = this.p0 || 0;
      this.hand = null; this.hi = 0; this.hw = V3(1, 0, 0);
      this.free = this.p >= this.len - 1e-6;
      this.peeled = 0;
      this._v = V3(); this._d = V3(); this._t = V3(); this._c = V3();
      this.buildMesh();
      this.settle();
    }
    buildMesh() {
      const N = this.N, R = this.rows;
      const g = new THREE.BufferGeometry();
      this.pos = new Float32Array(N * R * 3); this.nor = new Float32Array(N * R * 3);
      const uv = new Float32Array(N * R * 2), idx = [];
      for (let i = 0; i < N; i++) for (let r = 0; r < R; r++) {
        const k = i * R + r; uv[k * 2] = i / (N - 1); uv[k * 2 + 1] = this.flipV ? 1 - r / (R - 1) : r / (R - 1);
        if (i < N - 1 && r < R - 1) { const a = k, b = k + 1, c = k + R, d = k + R + 1; idx.push(a, b, c, b, d, c); }
      }
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      this.geo = g;
      this.mesh = new THREE.Mesh(g, this.material);
      this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    }
    /* 第一个还贴着的点 */
    get k() { return Math.min(this.N, Math.ceil(this.p / this.ds - 1e-6)); }
    mid(i, out = V3()) { return out.addVectors(this.A[i], this.B[i]).multiplyScalar(0.5); }
    settle() { for (let n = 0; n < 50; n++) this.step(1 / 120, true); this.write(); }
    grab(hand, i = 0) { this.hi = i; this.hand = hand.clone(); this.hw.subVectors(this.B[i], this.A[i]).normalize(); }
    release() { this.hand = null; }
    step(dt, quiet) {
      const h = dt / this.sub;
      this.peeled = 0;
      for (let s = 0; s < this.sub; s++) this.substep(h);
      if (!quiet) this.write();
    }
    pin(i) { const q = this.path(i * this.ds), W2 = this.width / 2; this.A[i].copy(q.p).addScaledVector(q.w, -W2); this.B[i].copy(q.p).addScaledVector(q.w, W2); this.PA[i].copy(this.A[i]); this.PB[i].copy(this.B[i]); }
    substep(h) {
      const N = this.N, A = this.A, B = this.B, PA = this.PA, PB = this.PB, ds = this.ds, hi = this.hi, W2 = this.width / 2;
      // 揭：手和揭口之间的直线距离比揭开的长度长，就往前揭；手往外拉时揭得更快一点，多出来的自然垂下
      if (!this.free && this.hand && this.k > hi) {
        const moved = this._lastHand ? this.hand.distanceTo(this._lastHand) : 0;
        const D = this.hand.distanceTo(this.path(this.p).p), Lf = this.p - hi * ds;
        const over = D - Lf, dD = this._lastD === undefined ? 0 : D - this._lastD;
        let adv = over > this.peelAt ? (over - this.peelAt) * 0.6 : 0;
        if (dD > 0 && over > -Lf * 0.4) adv = Math.max(adv, dD * this.assist);
        adv = Math.min(adv, moved * 2.6 + 0.002);
        if (this.along) adv = Math.max(adv, this.along(this.hand) - this.p);   // 撕条：撕口跟着手走
        adv = Math.min(adv, this.maxRate * h);
        if (adv > 0) {
          const k0 = this.k;
          this.p = Math.min(this.len, this.p + adv); this.peeled += adv;
          for (let i = k0; i < this.k && i < N; i++) this.pin(i);
          if (this.onPeel) this.onPeel(this.p, adv);
          if (this.p >= this.len - 1e-6) this.free = true;
        }
        this._lastD = this.hand.distanceTo(this.path(this.p).p);
      } else this._lastD = undefined;
      this._lastHand = this.hand ? (this._lastHand || V3()).copy(this.hand) : null;
      const k = this.free ? N : this.k;
      for (let i = k; i < N; i++) this.pin(i);
      // verlet
      const g = this.gravity * h * h, damp = this.damp, v = this._v;
      for (let i = 0; i < k; i++) {
        v.subVectors(A[i], PA[i]).multiplyScalar(damp); PA[i].copy(A[i]); A[i].add(v); A[i].y -= g;
        v.subVectors(B[i], PB[i]).multiplyScalar(damp); PB[i].copy(B[i]); B[i].add(v); B[i].y -= g;
      }
      const held = this.hand && k > hi;
      const shape = held && !this.free ? this.curl(k) : null;
      const mv = i => i < k && !(held && i === hi);
      const c = this._c;
      for (let it = 0; it < this.iters; it++) {
        if (held) { A[hi].copy(this.hand).addScaledVector(this.hw, -W2); B[hi].copy(this.hand).addScaledVector(this.hw, W2); }
        if (shape) for (let i = hi + 1; i < k; i++) { this.mid(i, c); c.sub(shape.pts[i]).multiplyScalar(-shape.w); A[i].add(c); B[i].add(c); }
        for (let i = 0; i < Math.min(k + 1, N); i++) {
          const mi = mv(i);
          if (i + 1 < N) {
            const mj = mv(i + 1);
            if (mi || mj) {
              this.dist(A[i], A[i + 1], mi, mj, ds, 1); this.dist(B[i], B[i + 1], mi, mj, ds, 1);
              this.dist(A[i], B[i + 1], mi, mj, this.diag, 0.6); this.dist(B[i], A[i + 1], mi, mj, this.diag, 0.6);
            }
          }
          if (mi) this.dist(A[i], B[i], true, true, this.width, 1);
          if (i + 2 < N) {
            const mj = mv(i + 2);
            if (mi || mj) { this.dist(A[i], A[i + 2], mi, mj, 2 * ds, this.bend); this.dist(B[i], B[i + 2], mi, mj, 2 * ds, this.bend); }
          }
        }
        if (this.restPose && !this.hand) for (let i = 0; i < k; i++) { const t = this.restPose(i); if (t) { this.mid(i, c); c.sub(t).multiplyScalar(-0.3); A[i].add(c); B[i].add(c); } }
        if (this.collide) for (let i = 0; i < k; i++) { this.collide(A[i], PA[i]); this.collide(B[i], PB[i]); }
      }
      if (held) { A[hi].copy(this.hand).addScaledVector(this.hw, -W2); B[hi].copy(this.hand).addScaledVector(this.hw, W2); }
    }
    dist(a, b, ma, mb, rest, stiff) {
      const d = this._d.subVectors(b, a), l = d.length() || 1e-6, diff = (l - rest) / l * stiff;
      const wa = ma ? (mb ? 0.5 : 1) : 0, wb = mb ? (ma ? 0.5 : 1) : 0;
      if (wa) a.addScaledVector(d, diff * wa);
      if (wb) b.addScaledVector(d, -diff * wb);
    }
    /* 揭口的理想形状：从揭口沿表面朝已揭开的方向出发，弯一个半径 r 的弧转向手，再直线到手。
       越松（揭开的比直线距离长得多）权重越小，交给重力 */
    curl(k) {
      const hi = this.hi, ds = this.ds, r = this.curlR;
      const q = this.path(this.p), F = q.p, q2 = this.path(Math.max(0, this.p - 0.05));
      const d0 = q2.p.clone().sub(F).normalize();
      const dH = this.hand.clone().sub(F); const D = dH.length(); if (D < 1e-4) return null; dH.divideScalar(D);
      const c = clamp(d0.dot(dH), -1, 1), th = Math.acos(c);
      const nn = dH.clone().addScaledVector(d0, -c); if (nn.lengthSq() < 1e-8) nn.copy(q.n); nn.normalize();
      const C = F.clone().addScaledVector(nn, r), arcL = r * th;
      const aEnd = C.clone().addScaledVector(nn, -r * Math.cos(th)).addScaledVector(d0, r * Math.sin(th));
      const toH = this.hand.clone().sub(aEnd), lH = toH.length(); toH.divideScalar(lH || 1);
      const Lf = this.p - hi * ds, slack = Lf - (arcL + lH);
      const w = 0.5 * (1 - smooth(clamp(slack / 1.5)));
      if (w <= 0.01) return null;
      const pts = this._pts || (this._pts = this.A.map(() => V3()));
      for (let i = hi + 1; i < k; i++) {
        const sg = this.p - i * ds;
        if (sg <= arcL) { const ph = sg / r; pts[i].copy(C).addScaledVector(nn, -r * Math.cos(ph)).addScaledVector(d0, r * Math.sin(ph)); }
        else pts[i].copy(aEnd).addScaledVector(toH, Math.min(lH, sg - arcL));
      }
      return { pts, w };
    }
    releaseAll() { this.p = this.len; this.free = true; }
    toss(v, dt = 1 / 60) { for (let i = 0; i < this.N; i++) { this.PA[i].copy(this.A[i]).addScaledVector(v, -dt); this.PB[i].copy(this.B[i]).addScaledVector(v, -dt); } }
    write() {
      const N = this.N, R = this.rows, A = this.A, B = this.B, M = this.M, t = this._t, a = this._d, n = this._v;
      for (let i = 0; i < N; i++) this.mid(i, M[i]);
      for (let i = 0; i < N; i++) {
        t.subVectors(M[Math.min(N - 1, i + 1)], M[Math.max(0, i - 1)]);
        a.subVectors(B[i], A[i]);
        n.crossVectors(a, t).normalize();
        for (let r = 0; r < R; r++) {
          const f = r / (R - 1), j = (i * R + r) * 3;
          const off = this.edgeOff ? this.edgeOff(i, r) : 0;
          const ox = a.x / this.width * off, oy = a.y / this.width * off, oz = a.z / this.width * off;
          this.pos[j] = A[i].x + a.x * f + ox; this.pos[j + 1] = A[i].y + a.y * f + oy; this.pos[j + 2] = A[i].z + a.z * f + oz;
          this.nor[j] = n.x; this.nor[j + 1] = n.y; this.nor[j + 2] = n.z;
        }
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.normal.needsUpdate = true;
      this.geo.boundingSphere = null;   // 拾取时按当前形状重算
    }
    /* 屏幕上离 (sx, sy) 最近的揭开点 */
    nearest(sx, sy) {
      const k = this.free ? this.N : this.k; let best = 1e9, bi = -1;
      for (let i = 0; i < Math.max(1, k); i++) { const [X, Y] = toScreen(this.M[i]); const d = Math.hypot(X - sx, Y - sy); if (d < best) { best = d; bi = i; } }
      return { d: best, i: bi };
    }
  }

  /* 正反面不同色的材质：正面是印刷面，反面是胶面/内层 */
  function twoSided(opts, back, backMix = 0.7, backRough = 0.55) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ side: THREE.DoubleSide }, opts));
    m.shadowSide = THREE.DoubleSide;
    m.onBeforeCompile = sh => {
      sh.uniforms.uBack = { value: new THREE.Color(back) };
      sh.fragmentShader = 'uniform vec3 uBack;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, uBack, ${backMix.toFixed(3)});`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n if (!gl_FrontFacing) roughnessFactor *= ${backRough.toFixed(3)};`);
    };
    return m;
  }

  /* ───────── 卡包：袋身（前后两片，鼓起来）、顶上一条撕条、里面一叠卡 ─────────
     袋身前后各是一张网格，四周贴平、中间鼓起；撕口线以上那一条交给 Ribbon，撕开时跟手。
     撕开的那一段，袋口往外张开，能看见里面银色的内层和卡的上沿。 */
  let PK = null;

  function buildPack() {
    const { W, H, tearY } = PACK;
    const f = paintPackFront(), b = paintPackBack();
    const T = {
      fc: canvasTex(f.c), fm: canvasTex(f.m, { linear: true }), fn: canvasTex(paintPackNormal(31, false), { linear: true }),
      bc: canvasTex(b.c), bm: canvasTex(b.m, { linear: true }), bn: canvasTex(paintPackNormal(57, true), { linear: true }),
    };
    const nrm = new THREE.Vector2(0.5, 0.5);
    const foil = (c, m, n, side = THREE.FrontSide) => addHolo(new THREE.MeshStandardMaterial({
      map: c, roughnessMap: m, metalnessMap: m, normalMap: n, normalScale: nrm, roughness: 1, metalness: 1, alphaTest: 0.5, side, envMapIntensity: 1.3,
    }), { key: 'pack' + side, gain: '0.5', base: '0.07', lo: '0.7' });
    const mirror = t => { const u = t.clone(); u.wrapS = THREE.RepeatWrapping; u.repeat.x = -1; u.offset.x = 1; u.needsUpdate = true; return u; };
    const M = {
      front: foil(T.fc, T.fm, T.fn), back: foil(T.bc, T.bm, T.bn),
      // 撕条网格的正面朝袋子背后（Ribbon 的绕向），所以正面贴背面的印刷，另一份反面网格贴正面的印刷
      stripBack: foil(mirror(T.bc), mirror(T.bm), mirror(T.bn), THREE.FrontSide), stripFront: foil(T.fc, T.fm, T.fn, THREE.BackSide),
      inner: new THREE.MeshStandardMaterial({ color: 0xb9bdc6, metalness: 1, roughness: 0.34, side: THREE.BackSide, normalMap: T.fn, normalScale: new THREE.Vector2(0.35, 0.35) }),
    };
    const group = new THREE.Group(); group.name = 'pack';
    G.root.add(group);

    // 袋身网格：列和撕条的点一一对应，顶行就是参差的撕口
    const NC = 38, NR = 46, ds = W / (NC - 1);
    const mk = (back) => {
      const g = new THREE.BufferGeometry(), n = NC * NR;
      const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
      for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++) {
        const k = j * NC + i, x = -W / 2 + i * ds, y = lerp(-H / 2, tearY + tearJag(x), j / (NR - 1));
        pos[k * 3] = x; pos[k * 3 + 1] = y;
        uv[k * 2] = back ? (W / 2 - x) / W : (x + W / 2) / W; uv[k * 2 + 1] = (y + H / 2) / H;
        if (i < NC - 1 && j < NR - 1) { const a = k, bb = k + 1, c = k + NC, d = k + NC + 1; if (back) idx.push(a, c, bb, bb, c, d); else idx.push(a, bb, c, bb, d, c); }
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
      return g;
    };
    const gF = mk(false), gB = mk(true);
    const meshes = [];
    const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; group.add(m); meshes.push(m); return m; };
    const front = add(gF, M.front), back = add(gB, M.back);
    add(gF, M.inner); add(gB, M.inner);

    PK = {
      group, front, back, meshes, M, T, strip: null, stripBack: null, gF, gB, NC, NR, ds,
      open: new Spring(0), mode: 'box', from: null, dp: V3(), dq: new THREE.Quaternion(), t: new Spring(0), tilt: { x: new Spring(0), y: new Spring(0) },
      sway: { x: new Spring(0), z: new Spring(0) }, lean: new Spring(0), off: V3(), drop: null, calm: 1,
    };
    updateBody(0, -W / 2 - 1);
    return PK;
  }

  /* 撕条：路径在卡包本地坐标里，每帧按卡包的世界矩阵换算。UV 直接用袋子正面贴图的坐标，图案和袋身接得上 */
  function makeStrip() {
    const { W, H, tearY, strip } = PACK, ds = PK.ds, yc = tearY + strip / 2, mw = PK.group.matrixWorld;
    const _l = V3(), _n = V3(), _w = V3();
    const path = s => {
      _l.set(-W / 2 + s, yc, 0.012);
      return { p: _l.clone().applyMatrix4(mw), n: _n.set(0, 0, 1).transformDirection(mw).clone(), w: _w.set(0, 1, 0).transformDirection(mw).clone() };
    };
    const rb = new Ribbon({
      len: W, ds, width: strip, rows: 3, path, material: PK.M.stripBack, p0: 0,
      gravity: 420, bend: 0.4, peelAt: 0.04, assist: 1.0, maxRate: 70, curlR: 0.16, damp: 0.975,
      edgeOff: (i, r) => r === 0 ? tearJag(-W / 2 + i * ds) : 0,
      collide: (P) => packCollide(P),
      along: hand => { _l.copy(hand); PK.group.worldToLocal(_l); return _l.x + W / 2 - 0.55; },
    });
    const suv = rb.geo.attributes.uv;
    for (let i = 0; i < rb.N; i++) {
      const x = -W / 2 + i * ds;
      suv.setXY(i * 3, (x + W / 2) / W, (tearY + tearJag(x) + H / 2) / H);
      suv.setXY(i * 3 + 1, (x + W / 2) / W, (yc + H / 2) / H);
      suv.setXY(i * 3 + 2, (x + W / 2) / W, 1);
    }
    suv.needsUpdate = true;
    return rb;
  }

  /* 袋身的形状：四边贴平、中间鼓；撕开的那一段袋口往外张 */
  function updateBody(open, tornX) {
    const { W, H, tearY, Z, crimp } = PACK, NC = PK.NC, NR = PK.NR;
    for (const [g, s] of [[PK.gF, 1], [PK.gB, -1]]) {
      const pos = g.attributes.position.array;
      for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++) {
        const k = (j * NC + i) * 3, x = pos[k], y = pos[k + 1];
        const fx = Math.pow(Math.sin(Math.PI / 2 * clamp((W / 2 - Math.abs(x)) / 1.0)), 0.6);
        const fy = smooth(inv(-H / 2 + crimp, -H / 2 + crimp + 1.3, y)) * smooth(inv(tearY + 0.05, tearY - 1.6, y));
        const torn = smooth(inv(tornX + 0.35, tornX - 0.35, x));
        const op = open * torn * Math.pow(smooth(inv(tearY - 2.6, tearY + 0.1, y)), 1.6) * (0.4 + 0.6 * fx);
        pos[k + 2] = s * (0.012 + Z * fx * fy + op);
      }
      g.attributes.position.needsUpdate = true;
      g.computeVertexNormals();
    }
  }

  /* 撕条不许穿到袋子后面去 */
  const _pc = V3();
  function packCollide(P) {
    const g = PK.group; _pc.copy(P); g.worldToLocal(_pc);
    if (Math.abs(_pc.x) < PACK.W / 2 + 0.2 && _pc.y > -PACK.H / 2 && _pc.y < PACK.H / 2 + 0.6 && _pc.z < 0.05 && _pc.z > -0.6) {
      _pc.z = 0.05; P.copy(_pc.applyMatrix4(g.matrixWorld));
    }
  }

  /* ───────── 卡包的几个姿势 ───────── */
  const _dummy = new THREE.Object3D(), _hq = new THREE.Quaternion();
  /* 拿在手里：正对相机，带一点随指针的倾斜 */
  function holdQuat(pos, out) {
    _dummy.position.copy(pos); _dummy.up.set(0, 1, 0); _dummy.lookAt(G.camera.position);
    return out.copy(_dummy.quaternion);
  }
  /* 姿势：盒里（box）、手拖着（drag，位置由手势直接给）、飞到面前（fly → hold）、松手不够高落回去（back）、扔掉（gone） */
  function packPose(out) {
    const m = PK.mode;
    if (m === 'drag') { out.p.copy(PK.dp); out.q.copy(PK.dq); return out; }
    if (m === 'box' || !PK.from) { out.p.copy(PACK_REST.p); out.q.copy(PACK_REST.q); return out; }
    const t = clamp(PK.t.x), e = smooth(t);
    if (m === 'back') { out.p.lerpVectors(PK.from.p, PACK_REST.p, e); out.q.slerpQuaternions(PK.from.q, PACK_REST.q, e); return out; }
    out.p.lerpVectors(PK.from.p, CAM.B.target, e);
    out.p.y += Math.sin(Math.PI * t) * 1.2;
    holdQuat(out.p, _hq);
    out.q.slerpQuaternions(PK.from.q, _hq, smooth(clamp(t * 1.25)));
    return out;
  }
  /* 从当前姿势出发飞到 to（'hold' 或 'back'） */
  function packFlyFrom(to) {
    PK.from = { p: PK.group.position.clone(), q: PK.group.quaternion.clone() };
    PK.mode = to === 'hold' ? 'fly' : 'back'; PK.t.snap(0); PK.t.t = 1;
  }
  const _pose = { p: V3(), q: new THREE.Quaternion() };
  function updatePack(dt, t) {
    const g = PK.group, m = PK.mode;
    if (m === 'fly' || m === 'hold') PK.t.step(dt, 0.85, 0.1);
    else if (m === 'back') { PK.t.step(dt, 0.42, 0.12); if (PK.t.near(0.01, 0.05)) PK.mode = 'box'; }
    packPose(_pose);
    g.position.copy(_pose.p).add(PK.off);
    g.quaternion.copy(_pose.q);
    // 拿在手里：随指针倾斜、轻轻浮动、撕的时候被扯得晃一下
    const held = m === 'fly' || m === 'hold' ? clamp(PK.t.x) : 0;
    PK.tilt.x.step(dt, 0.7, 0.2); PK.tilt.y.step(dt, 0.7, 0.2);
    PK.sway.x.step(dt, 0.45, 0.35); PK.sway.z.step(dt, 0.45, 0.35);
    // 浮动没人理六秒就慢慢歇下来（画面停住，循环才能睡），指针一动又浮起来
    PK.calm += ((performance.now() - poke < 6000 ? 1 : 0) - PK.calm) * (1 - Math.exp(-dt * 3));
    const fl = reduce ? 0 : Math.sin(t * 1.1) * 0.012 * held * PK.calm;
    PK.lean.step(dt, 0.8, 0.25);
    _e.set((PK.tilt.x.x + PK.sway.x.x + PK.lean.x) * held + fl, (PK.tilt.y.x) * held, PK.sway.z.x * held);
    g.quaternion.multiply(_q.setFromEuler(_e));
    if (!reduce) g.position.y += Math.sin(t * 0.9) * 0.08 * held * PK.calm;
    g.updateMatrixWorld(true);
    PK.open.step(dt, 0.7, 0.3);
    const tornX = PK.strip.free ? PACK.W : -PACK.W / 2 + PK.strip.p;
    if (PK._lastOpen !== PK.open.x || PK._lastTorn !== tornX) { updateBody(PK.open.x, tornX); PK._lastOpen = PK.open.x; PK._lastTorn = tornX; }
  }
  const _e = new THREE.Euler(), _q = new THREE.Quaternion();

  /* ───────── 卡片：几何、材质、在包里、一张张翻、最后摊成一把扇子 ─────────
     卡片抽出来以后挂在一个“手里”的组下面，这个组始终正对相机；卡片的位置和角度都在这个组的坐标里用弹簧推。 */
  let CD = null;

  function cardGeos() {
    const { W, H, R, T } = CARD, s = new THREE.Shape();
    s.moveTo(-W / 2 + R, -H / 2); s.lineTo(W / 2 - R, -H / 2); s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R);
    s.lineTo(W / 2, H / 2 - R); s.quadraticCurveTo(W / 2, H / 2, W / 2 - R, H / 2); s.lineTo(-W / 2 + R, H / 2);
    s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - R); s.lineTo(-W / 2, -H / 2 + R); s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2);
    const face = new THREE.ShapeGeometry(s, 6), uv = face.attributes.uv, p = face.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, (p.getY(i) + H / 2) / H);
    const front = face.clone().translate(0, 0, T / 2), back = face.clone().translate(0, 0, -T / 2);
    // 侧边：沿轮廓一圈窄条
    const pts = s.getPoints(6), pos = [], idx = [];
    for (let i = 0; i < pts.length; i++) { pos.push(pts[i].x, pts[i].y, T / 2, pts[i].x, pts[i].y, -T / 2); }
    for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const edge = new THREE.BufferGeometry(); edge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); edge.setIndex(idx); edge.computeVertexNormals();
    return { front, back, edge };
  }

  function buildCards() {
    const geo = cardGeos();
    const bk = paintCardBack();
    const bc = canvasTex(bk.c), bm = canvasTex(bk.m, { linear: true });
    for (const t of [bc, bm]) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
    const backMat = addHolo(new THREE.MeshPhysicalMaterial({ map: bc, roughnessMap: bm, metalnessMap: bm, roughness: 1, metalness: 1, clearcoat: 0.4, clearcoatRoughness: 0.25, side: THREE.BackSide }), { key: 'cardback', gain: '0.35', base: '0.04' });
    // 侧边：普通卡是棉纸的米白，闪卡是黑芯
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xe6e0d0, roughness: 0.9 });
    const edgeRare = new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: 0.7 });
    const hold = new THREE.Group(); hold.name = 'hand'; G.root.add(hold);
    const cards = CARDS.map((D, i) => {
      // 卡面一张要画一两百毫秒，五张一起画会让页面卡住一下：先贴一个像素的纸色，开场以后空闲时一张张画好再换上
      // （贴图从有到有，着色器不用重编）
      const px = (c) => { const k = document.createElement('canvas'); k.width = k.height = 1; const x = k.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 1, 1); return k; };
      const mr = canvasTex(px('rgb(0,230,0)'), { linear: true });
      // 普通卡：棉纸几乎不反光，只有油墨和烫箔亮；闪卡：黑色触感纸上薄薄一层光油
      const fm = addHolo(new THREE.MeshPhysicalMaterial({
        map: canvasTex(px(D.rare ? '#0b0c11' : '#ece7db')), roughnessMap: mr, metalnessMap: mr, normalMap: canvasTex(px('rgb(128,128,255)'), { linear: true }), normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 1, metalness: 1, clearcoat: D.rare ? 0.12 : 0.05, clearcoatRoughness: D.rare ? 0.4 : 0.55, envMapIntensity: 1.1,
        sheen: D.rare ? 0 : 0.1, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xfff6e6),
      }), D.rare ? { key: 'cardr', gain: '0.75', base: '0.05', band: '0.93', bw: '0.0003', slope: '0.17', white: '0.3', cells: '300.0' } : { key: 'cardc', gain: '0.55', base: '0.06', lo: '0.88', cells: '240.0' });
      const g = new THREE.Group(); g.name = 'card' + i;
      // 卡面不接影子：摊开时闪卡比别的卡高一点，影子落在邻居卡面上是一块硬边的灰斑，像脏了；影子留给桌面
      for (const [gg, mm] of [[geo.front, fm], [geo.back, backMat], [geo.edge, D.rare ? edgeRare : edgeMat]]) { const m = new THREE.Mesh(gg, mm); m.castShadow = true; m.receiveShadow = gg !== geo.front; m.userData.card = i; g.add(m); }
      // hv：悬停抬起的量（0 到 1），tl：悬停时朝指针的倾斜，都用弹簧推，进出都有缓动
      const c = { i, D, g, front: fm, pos: [new Spring(), new Spring(), new Spring()], rot: [new Spring(), new Spring(), new Spring()], sc: new Spring(1), hv: new Spring(0), tl: [new Spring(0), new Spring(0)], state: 'pack', slot: 0 };
      return c;
    });
    CD = { hold, cards, order: [0, 1, 2, 3, 4], seen: 0, insp: -1, hover: -1, hpx: 0, hpy: 0, geo, sweep: -1, tilt: { x: new Spring(0), y: new Spring(0) }, layout: '' };
    CD.painted = 0; CD.flow = 0;
    return CD;
  }
  /* 画下一张卡面，换掉一个像素的那张。都画完返回 false */
  function paintNextCard() {
    if (!CD || CD.painted >= CD.cards.length) return false;
    const c = CD.cards[CD.painted++], t = paintCardFront(c.i), m = c.front, mr = canvasTex(t.m, { linear: true });
    const old = [m.map, m.roughnessMap, m.normalMap];
    m.map = canvasTex(t.c); m.roughnessMap = m.metalnessMap = mr; m.normalMap = canvasTex(t.n, { linear: true });
    old.forEach(x => x.dispose());
    // 趁空闲把贴图传上显卡，撕开卡包那一下不卡；卡还关在盒子里看不见，不用叫醒循环
    for (const x of [m.map, mr, m.normalMap]) G.renderer.initTexture(x);
    return CD.painted < CD.cards.length;
  }
  const RARE = CARDS.findIndex(d => d.rare);

  /* 放回包里：一叠，正面朝前，第一张在最前 */
  const CARD_Y0 = -PACK.H / 2 + PACK.crimp + 0.1 + CARD.H / 2;
  function cardsIntoPack() {
    CD.insp = -1; CD.hover = -1; CD.order = [0, 1, 2, 3, 4]; CD.seen = 0; CD.layout = '';
    for (const c of CD.cards) {
      c.hv.snap(0); c.tl[0].snap(0); c.tl[1].snap(0);
      PK.group.add(c.g);
      c.g.position.set(0, CARD_Y0, 0.07 - c.i * 0.035); c.g.rotation.set(0, 0, 0); c.g.scale.setScalar(1);
      c.state = 'pack'; c.drag = false;
    }
    CD.slide = new Spring(0);
    CD.tilt.x.snap(0); CD.tilt.y.snap(0);
  }

  /* ───────── 几个位置（都在“手”的坐标里，手始终正对相机） ───────── */
  // 一叠：第 k 张（0 是最上面）往后、往下错一点，角度有一点点乱，看得出是一叠真卡
  const JIT = [0, 0.018, -0.014, 0.024, -0.009];
  function stackPose(k) { return { p: [k * 0.05, -k * 0.07, 1.0 - k * 0.06 - (k ? 0.14 : 0)], r: [0, 0, JIT[k]], s: 1 }; }
  // 摊开：宽的舞台一排五张（闪卡在中间、往前一点，两边的微微往下、往后，排成一道很浅的弧），方一点的两排（上排三张、下排两张，整体往上挪一点，下排别压到提示）
  const ROW = [0, 1, 3, 4, 2];     // 卡 → 一排里的位置（0 最左），闪卡在正中
  const GRID = [[-6.75, 4.7], [-3.4, -4.7], [6.75, 4.7], [3.4, -4.7], [0, 4.7]];   // 卡 → 两排里的位置
  // 9:16 那么窄：闪卡单独在上，其余四张两两一排
  const TALL = [[-3.4, 0], [3.4, 0], [-3.4, -9.4], [3.4, -9.4]];
  function spreadLayout() { const a = G.camera.aspect; return a < 0.66 ? 'tall' : a < 1.45 ? 'grid' : 'row'; }
  function spreadPose(i) {
    const rare = i === RARE;
    if (CD.layout === 'tall') { const [x, y] = rare ? [0, 9.4] : TALL[CD.cards.filter(c => c.i !== RARE).findIndex(c => c.i === i)]; return { p: [x, y + 1.6, (CD.cards[i].sz || 0) + (rare ? 0.3 : 0)], r: [rare ? 0.14 : 0, 0, 0], s: rare ? 1.04 : 1 }; }   // 上面那张上沿朝你偏一点，别正好照到顶灯
    if (CD.layout === 'grid') { const [x, y] = GRID[i]; return { p: [x, y + 0.9, (CD.cards[i].sz || 0) + (rare ? 0.3 : 0)], r: [0, 0, 0], s: rare ? 1.04 : 1 }; }
    const k = ROW[i] - 2;
    return { p: [k * 7.3, -k * k * 0.16 + (rare ? 0.25 : 0), -Math.abs(k) * 0.35 + (CD.cards[i].sz || 0) + (rare ? 0.3 : 0)], r: [0, 0, -k * 0.022], s: rare ? 1.05 : 1 };
  }
  /* 拿近看：离相机多远才让卡占画面七成高（竖屏按宽算） */
  function inspectZ() {
    const d = camPose(CAM.B, G.camera.aspect, G.camera.fov).d, vt = Math.tan(G.camera.fov * DEG / 2);
    const D = Math.max(CARD.H / (0.7 * 2 * vt), CARD.W / (0.74 * 2 * vt * G.camera.aspect));
    return d - D;
  }

  /* 把卡从包里交给“手”：保留世界位置，之后用弹簧推到一叠的位置 */
  function cardsToHand() {
    CD.hold.position.copy(CAM.B.target); holdQuat(CD.hold.position, CD.hold.quaternion); CD.hold.updateMatrixWorld(true);
    for (const c of CD.cards) {
      CD.hold.attach(c.g);
      const e = new THREE.Euler().setFromQuaternion(c.g.quaternion);
      c.pos.forEach((s, k) => s.snap(c.g.position.getComponent(k)));
      c.rot[0].snap(e.x); c.rot[1].snap(e.y); c.rot[2].snap(e.z);
      c.state = 'stack';
      setCardTarget(c, stackPose(CD.order.indexOf(c.i)));
      c.pos[2].v = 9;   // 先往你这边带一下，和往后掉的卡包错开
    }
  }
  function setCardTarget(c, P) { c.pos.forEach((s, k) => s.t = P.p[k]); c.rot.forEach((s, k) => s.t = P.r[k]); c.sc.t = P.s; }
  function restack() { CD.order.forEach((i, k) => { const c = CD.cards[i]; if (c.state === 'stack') setCardTarget(c, stackPose(k)); }); }

  /* 把最上面那张划到一叠的最后：先往划的那边滑出去，绕到后面，再塞回去 */
  function tuckTop(side) {
    const c = CD.cards[CD.order[0]];
    c.state = 'tuck'; c.tu = 0; c.side = side || 1;
    c.t0 = { p: c.pos.map(s => s.x), r: c.rot.map(s => s.x) };
    CD.order.push(CD.order.shift()); CD.seen++;
    restack();
  }
  function finishTuck(c) {
    const P = stackPose(CD.order.indexOf(c.i));
    c.state = 'stack'; c.pos.forEach((s, k) => s.snap(P.p[k])); c.rot.forEach((s, k) => s.snap(P.r[k])); c.sc.snap(1);
  }
  /* 全部看过：摊开 */
  function spreadCards() {
    CD.layout = spreadLayout();
    CD.order.forEach((i, k) => { CD.cards[i].sz = (CD.order.length - 1 - k) * 0.08; });
    CD.cards.forEach(c => { if (c.state === 'tuck') finishTuck(c); c.state = 'spread'; setCardTarget(c, spreadPose(c.i)); c.pos[2].v += 2 + (c.i === RARE ? 4 : 0); });
  }

  const _hq2 = new THREE.Quaternion(), _he = new THREE.Euler();
  function updateCards(dt) {
    if (!CD) return;
    if (CD.cards[0].state === 'pack') {
      CD.slide.step(dt, 0.5, 0.2);
      for (const c of CD.cards) c.g.position.y = CARD_Y0 + CD.slide.x * (1 - c.i * 0.04);
      return;
    }
    // “手”跟着相机；整只手随指针轻轻倾斜（整叠一起转，不会互相插进去）
    // 指针位置先平滑一下，触屏松手以后慢慢回正
    const kk = 1 - Math.pow(0.002, dt), ph = ST.phase;
    CD.sx = lerp(CD.sx || 0, CD.hx || 0, kk); CD.sy = lerp(CD.sy || 0, CD.hy || 0, kk);
    CD.tw = lerp(CD.tw ?? 1, CD.spin || (drag && drag.kind === 'done') ? 0 : 1, kk);
    const hx = CD.sx, hy = CD.sy;
    const amt = ph === 'reveal' ? 1 : CD.insp >= 0 ? 0.15 : 0.35;
    if (!(drag && drag.kind === 'card')) { CD.tilt.x.t = -hy * 0.2 * amt; CD.tilt.y.t = hx * 0.26 * amt; }   // 拿着卡的时候手别跟着转
    CD.tilt.x.step(dt, 0.6, 0.15); CD.tilt.y.step(dt, 0.6, 0.15);
    CD.hold.position.copy(CAM.B.target); holdQuat(CD.hold.position, CD.hold.quaternion);
    CD.hold.quaternion.multiply(_hq2.setFromEuler(_he.set(CD.tilt.x.x, CD.tilt.y.x, 0)));
    for (const c of CD.cards) {
      if (c.drag) continue;
      if (c.state === 'tuck') {
        c.tu += dt / 0.62;
        const e = easeIO(clamp(c.tu)), P = stackPose(CD.order.indexOf(c.i)), s0 = c.t0, side = c.side;
        // 出去的时候里侧那条边朝你翘，绕到后面以后朝后翘，所以不会扎进这一叠
        const out = Math.sin(Math.PI * e), zk = smooth(clamp((e - 0.3) / 0.4));
        c.g.position.set(lerp(s0.p[0], P.p[0], e) + side * 7.6 * out, lerp(s0.p[1], P.p[1], e) + 0.5 * out, lerp(s0.p[2], P.p[2], zk) + 0.25 * out);
        c.g.rotation.set(lerp(s0.r[0], 0, e), lerp(s0.r[1], 0, e) + side * 0.3 * Math.sin(TAU * e), lerp(s0.r[2], P.r[2], e) - side * 0.12 * out);
        c.g.scale.setScalar(1 - 0.04 * out);
        if (c.tu >= 1) finishTuck(c);
        continue;
      }
      const fast = c.state === 'spread' || c.state === 'insp';
      c.pos.forEach(s => s.step(dt, fast ? 0.55 : 0.42, fast ? 0.14 : 0.1));
      c.rot.forEach(s => s.step(dt, 0.5, 0.14));
      c.sc.step(dt, 0.5, 0.15);
      let rx = c.rot[0].x, ry = c.rot[1].x, x = c.pos[0].x, y = c.pos[1].x, z = c.pos[2].x, sc = c.sc.x;
      if (CD.insp === c.i) { rx += -hy * 0.32 * CD.tw; ry += hx * 0.42 * CD.tw; }
      // 悬停：抬起、放大一点点、朝指针那一侧压下去一点；松开时慢慢落回，不是一下子跳
      const on = CD.hover === c.i && c.state === 'spread' && CD.insp < 0;
      c.hv.t = on ? 1 : 0; c.hv.step(dt, on ? 0.42 : 0.5, on ? 0.12 : 0);
      c.tl[0].t = on ? -CD.hpy * 0.13 : 0; c.tl[1].t = on ? CD.hpx * 0.17 : 0;
      c.tl[0].step(dt, 0.45, 0.08); c.tl[1].step(dt, 0.45, 0.08);
      if (CD.insp !== c.i) { const h = c.hv.x; y += 0.22 * h; z += 0.8 * h; sc *= 1 + 0.025 * h; rx += c.tl[0].x; ry += c.tl[1].x; }
      c.g.position.set(x, y, z);
      c.g.rotation.set(rx, ry, c.rot[2].x);
      c.g.scale.setScalar(sc);
    }
    CD.hold.updateMatrixWorld(true);   // 拾取和手势平面用得到，不等渲染
    // 闪卡翻到的那一下：镭射整体扫一遍
    if (CD.sweep >= 0) { CD.sweep += dt / 0.9; if (CD.sweep > 1) CD.sweep = -1; }
    CD.flow += dt;   // 镭射慢慢流：只在醒着的帧里走，睡一觉醒来不会跳一下
    for (const c of CD.cards) {
      const u = c.front.userData.holo;
      u.uShift.value = CD.flow * 0.02;
      u.uSweep.value = c.D.rare ? CD.sweep : -1;
    }
  }

  /* ───────── 舞台、布局、每帧循环 ───────── */
  let SCALE = 1;   // 按 420 宽的设计稿算的缩放，几处按像素算的阈值（离拉手多近算抓到）跟着它走
  let B = null, Z = null;   // 礼盒、撕拉条
  const ST = { phase: 'zip', t: 0 };   // zip → lid → lift → tear → slide → reveal → done
  let drag = null, hoverKind = '';

  function layout() {
    const w = Math.max(1, root.clientWidth), hh = Math.max(1, root.clientHeight);
    if (w === G.w && hh === G.h) return;
    SCALE = clamp(Math.min(w, hh * 0.75) / 420, 0.55, 1.8);
    resizeScene(w, hh, Math.min(2, devicePixelRatio || 1));
    if (CD && CD.layout) relayoutSpread();
    wake();
  }

  /* ───────── 每帧 ─────────
     省电的规矩：有人在拖、东西在动时每帧都画；只剩卡包在手里轻轻飘、镭射慢慢流的时候限到每秒 30 帧；
     什么都不动了（所有物体的位置、相机、两条撕带的点连着 16 帧几乎没变，差不到千分之一个单位，画面上远不到一个像素）就停，
     等下一次指针、键盘或者尺寸变化。撕拉条的拉手每 4.2 秒翘一下，停着的时候按时间叫醒一次；没人理它，翘四回就不翘了，
     指针再进来才接着翘。滚出屏幕、切到别的标签页也停。 */
  let last = 0, raf = 0, quiet = 0, sig = NaN, napAt = 0, poke = 0, alive = true, onScreen = true, nudgeTimer = 0, nudges = 0;
  function frame(now) {
    raf = 0;
    if (!alive || manual || !onScreen || document.hidden) return;
    const busy = drag || later.length || now - poke < 1500;
    if (!busy && now - last < 1000 / 31) { raf = requestAnimationFrame(frame); return; }   // 闲着时每秒 30 帧
    const dt = Math.min(1 / 30, Math.max(0.001, (now - (last || now)) / 1000)); last = now;
    step(dt, now / 1000);
    G.renderer.render(G.scene, G.camera);
    const s2 = signature();
    quiet = Math.abs(s2 - sig) < 5e-4 && !busy ? quiet + 1 : 0; sig = s2;
    if (quiet > 16) { napAt = now; nap(); return; }
    raf = requestAnimationFrame(frame);
  }
  /* 停下来：撕拉条还没撕时，掐着点等拉手下一次翘 */
  function nap() {
    clearTimeout(nudgeTimer);
    if (ST.phase === 'zip' && !Z.free && !reduce && nudges++ < 4) nudgeTimer = setTimeout(wake, Math.max(60, (4.2 - ST.t % 4.2) * 1000 - 30));
  }
  function wake() {
    if (!alive) return;
    poke = performance.now(); quiet = 0;
    if (raf || !onScreen || document.hidden) return;
    // 睡着的这段时间场景时钟照走（只是没有东西在动），排好的延时和拉手的节奏都不乱
    if (napAt) { ST.t += Math.min(30, (performance.now() - napAt) / 1000); napAt = 0; }
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  /* 整个场景动没动：所有物体的世界矩阵、相机、撕带上的点、闪卡扫光的进度加在一起 */
  function signature() {
    let a = 0, k = 1;
    G.scene.traverse(o => { if (!o.visible) return; const e = o.matrixWorld.elements; a += (e[12] + e[13] * 1.3 + e[14] * 1.7 + e[0] + e[5] * 1.1 + e[10] * 1.2 + e[4] * 0.7) * (k = k * 1.0001 % 7 + 1); });
    const e = G.camera.matrixWorld.elements; a += e[12] + e[13] * 3 + e[14] * 5 + e[8] * 7;
    for (const r of [Z, PK && PK.strip]) if (r && !r.sleep) for (const P of r.A) a += P.x + P.y * 1.3 + P.z * 1.7;
    return a + (CD ? CD.sweep : 0) * 11 + (B ? B.lid.a.x * 13 : 0);
  }
  /* 盒子的机位跟着盖子走：合着的时候凑近看盒面，掀开以后退一点、抬一点，把立起来的盖子装进来 */
  function frameBox(a, k) {
    // 宽的舞台（详情页、实验页的卡片）上高度是紧的那一边：竖起来的盖子要多留一点头顶，合着时给底下的提示留一点；
    // 窄的（手机）合着时盒子也往上挪一点、缩一点，盒底别压到提示
    const op = smooth(clamp(a / (100 * DEG))), A = CAM.A, wide = G.camera.aspect > 1.2;
    A.target.x = lerp(A.target.x, 0, k);
    A.target.y = lerp(A.target.y, lerp(wide ? 2.0 : 1.3, wide ? 8.8 : 7.4, op), k);
    A.target.z = lerp(A.target.z, lerp(1.4, -2.0, op), k);
    A.needW = lerp(A.needW, lerp(23, 26, op), k);
    A.needH = lerp(A.needH, lerp(wide ? 23.5 : 23, wide ? 46 : 42, op), k);
    A.elev = lerp(A.elev, lerp(50, 42, op), k);
  }
  function step(dt, t) {
    ST.t += dt;
    runLater();
    // 撕拉条的拉手时不时翘一下，邀请人去拉
    if (!reduce && ST.phase === 'zip' && Z.p <= BOX.tab + 0.05 && !(drag && drag.kind === 'zip') && !Z.nudged) { const c = (ST.t % 4.2) / 4.2; Z.wig = c < 0.16 ? Math.sin(c / 0.16 * Math.PI) : 0; }
    if (!Z.sleep) { Z.step(dt); zipAway(dt); }
    updateLid(B, dt);
    const L = B.lid;
    if (ST.phase === 'zip' && Z.free) { L.locked = false; setPhase('lid'); }
    if (ST.phase === 'lid' && L.open && L.a.x > 80 * DEG) setPhase('lift');
    if (ST.phase === 'lift' && !L.open && L.a.x < 40 * DEG && PK.mode === 'box') setPhase('lid');
    frameBox(L.a.x, 1 - Math.pow(0.03, dt));
    // 拿到面前以后：撕、抽的时候看整只卡包；翻卡时凑近看大卡；摊开以后退一点
    const ph = ST.phase, k = 1 - Math.pow(0.02, dt);
    let nw = 19, nh = 21;
    const tall = G.camera.aspect < 0.66;
    if (ph === 'reveal') { nw = tall ? 11.8 : 13.6; nh = 15.5; }
    else if (ph === 'done') { if (CD.layout === 'tall') { nw = 16; nh = 35; } else if (CD.layout === 'row') { nw = 38.5; nh = 14; } else { nw = 22; nh = 24; } }
    CAM.B.needW = lerp(CAM.B.needW, nw, k); CAM.B.needH = lerp(CAM.B.needH, nh, k);
    // 抬多高：让画面下沿始终在盒子（连同立着的盖子）上面，9:16 竖着更高，要抬得更高
    CAM.B.target.y = lerp(CAM.B.target.y, camBY(), k);
    CAM.t.step(dt, 1.25, 0);
    placeCamera();
    if (PK.mode === 'fly' && PK.t.near(0.01, 0.05)) PK.mode = 'hold';
    if (PK.group.visible) { if (PK.mode === 'gone') packFall(dt); else updatePack(dt, t); }
    if (PK.strip && !PK.strip.sleep) PK.strip.step(dt);
    stripAway(dt);
    updateCards(dt);
    if (CD.cards[0].state === 'pack' && CD.popping && CD.slide.x > 10.2) handOff();   // 整叠卡的下沿离开袋口再交到手里
    // 相机和“手”还在动的时候，按住的东西也要一直待在指针下面
    if (drag && drag.lx !== undefined) { if (drag.kind === 'lid') moveLid(drag.lx, drag.ly); else if (drag.kind === 'card') moveCard(drag.lx, drag.ly); }
  }
  function camBY() { return Math.max(40, 23 + camPose(CAM.B, G.camera.aspect, G.camera.fov).d * Math.tan(G.camera.fov * DEG / 2) * 1.28); }

  function setPhase(p) { ST.phase = p; hint(p); opts.onPhase?.(p); }
  /* 按场景时间排的延时（手动时钟下也准） */
  let later = [];
  function after(sec, fn) { later.push([ST.t + sec, fn]); }
  function runLater() { if (!later.length) return; const due = later.filter(l => l[0] <= ST.t); later = later.filter(l => l[0] > ST.t); due.forEach(l => l[1]()); }

  /* ───────── 扔掉的东西：撕拉条往右甩出画面，卡包撕条往下掉出画面 ───────── */
  function zipAway(dt) {
    if (!Z.tossed) return;
    Z.awayT = (Z.awayT || 0) + dt;
    for (let i = 0; i < Z.N; i++) for (const P of [Z.A[i], Z.B[i]]) { P.x += 30 * dt; P.y += 5 * dt; }
    if (Z.awayT > 1.6) { Z.sleep = true; Z.mesh.visible = false; }
  }
  function stripAway(dt) {
    const S = PK.strip;
    if (!S.dropped || S.sleep) return;
    S.awayT = (S.awayT || 0) + dt;
    if (S.awayT > 2.2) { S.sleep = true; S.mesh.visible = PK.stripBack.visible = false; }
  }
  function packFall(dt) {
    const d = PK.drop;
    d.v.y -= 60 * dt; PK.group.position.addScaledVector(d.v, dt);
    PK.group.rotateX(d.w * dt); PK.group.rotateZ(d.w * 0.4 * dt);
    d.t += dt; if (d.t > 1.6) PK.group.visible = false;
    PK.group.updateMatrixWorld(true);
  }

  /* ───────── 手势 ───────── */
  function pt(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  const camFacing = () => G.camera.getWorldDirection(V3()).negate();

  /* 事件都挂在画布上（按钮在画布外面一层，点按钮不会抓起东西），收在一张表里，destroy 时一起摘掉 */
  const offs = [];
  const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); offs.push(() => t.removeEventListener(type, fn, o)); };
  on(canvas, 'pointerdown', e => {
    if (e.button !== 0 || drag) return;
    wake();
    const [x, y] = pt(e);
    if (down(x, y, e.pointerId)) { e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (_) { } }
    cursor();
  });
  on(canvas, 'pointermove', e => {
    const [x, y] = pt(e);
    nudges = 0;
    if (e.pointerType === 'mouse' || drag) { CD.hx = clamp(x / G.w * 2 - 1, -1, 1); CD.hy = clamp(y / G.h * 2 - 1, -1, 1); aimPack(x, y); wake(); }
    if (drag && drag.pid === e.pointerId) { move(x, y); return; }
    if (e.pointerType === 'mouse') { hoverKind = probe(x, y); cursor(); }
  });
  const end = e => { if (drag && drag.pid === e.pointerId) { const [x, y] = pt(e); up(x, y); } if (e.pointerType !== 'mouse') { CD.hx = CD.hy = 0; aimPack(G.w / 2, G.h / 2); } cursor(); wake(); };
  on(canvas, 'pointerup', end);
  on(canvas, 'pointercancel', end);
  on(canvas, 'pointerleave', e => { if (e.pointerType === 'mouse' && !drag) { CD.hx = CD.hy = 0; aimPack(G.w / 2, G.h / 2); CD.hover = -1; hoverKind = ''; cursor(); wake(); } });
  // 触屏：画布是 touch-action: pan-y，手指落在空处上下划还是滚页面；落在能抓的东西上（pointerdown 已经抓起来了）就不让页面滚
  const holdTouch = e => { if (drag && e.cancelable) e.preventDefault(); };
  on(canvas, 'touchstart', holdTouch, { passive: false });
  on(canvas, 'touchmove', holdTouch, { passive: false });
  function cursor() { canvas.dataset.cur = drag ? 'grabbing' : hoverKind === 'tap' ? 'pointer' : hoverKind ? 'grab' : ''; }

  /* 拿在手里的卡包朝指针偏一点 */
  function aimPack(x, y) {
    if (PK.mode !== 'hold' && PK.mode !== 'fly') return;
    PK.tilt.y.t = clamp((x / G.w - 0.5) * 0.5, -0.25, 0.25);
    PK.tilt.x.t = clamp((y / G.h - 0.5) * 0.4, -0.2, 0.2);
  }

  const hitList = (x, y, objs) => rayAt(x, y).intersectObjects(objs, false);
  const packMeshes = () => [PK.front, PK.back, PK.strip.mesh, PK.stripBack];
  const cardMeshes = (filter) => CD.cards.filter(filter || (() => true)).flatMap(c => c.g.children);
  const nearZip = (x, y) => !Z.free && Z.nearest(x, y).d < 30 * SCALE;

  /* 指针下面能抓什么 */
  function probe(x, y) {
    const ph = ST.phase;
    if (ph === 'zip') return nearZip(x, y) || lidAt(x, y) ? 'grab' : '';
    if (ph === 'lift' && hitList(x, y, packMeshes()).length) return 'grab';
    if ((ph === 'lid' || ph === 'lift') && lidAt(x, y)) return 'grab';
    if ((ph === 'tear' || ph === 'slide') && hitList(x, y, packMeshes().concat(cardMeshes())).length) return 'grab';
    if (ph === 'reveal' && hitList(x, y, cardMeshes(c => c.state === 'stack')).length) return 'grab';
    if (ph === 'done') {
      if (CD.insp < 0) { CD.hover = hoverAt(x, y); return CD.hover >= 0 ? 'tap' : ''; }
      const hh = hitList(x, y, cardMeshes()), i = hh.length ? hh[0].object.userData.card : -1;
      CD.hover = -1;
      return i === CD.insp ? 'grab' : i >= 0 ? 'tap' : '';
    }
    return '';
  }
  /* 摊开时的悬停：按每张卡“该在的位置”判断，不按它抬起来、歪过去以后的样子，
     所以指针停在卡边上也不会一抬一落地抖；正在悬停的那张边界放宽一点。顺便记下指针在卡上的位置（-1 到 1） */
  const _hr = new THREE.Ray(), _hm = new THREE.Matrix4(), _hp = new THREE.Vector3();
  function hoverAt(x, y) {
    _hm.copy(CD.hold.matrixWorld).invert(); _hr.copy(rayAt(x, y).ray).applyMatrix4(_hm);
    let best = -1, bz = -Infinity;
    for (const c of CD.cards) {
      if (c.state !== 'spread' || Math.abs(_hr.direction.z) < 1e-6) continue;
      const z = c.pos[2].t, s = (z - _hr.origin.z) / _hr.direction.z;
      if (s < 0 || z <= bz) continue;
      _hp.copy(_hr.direction).multiplyScalar(s).add(_hr.origin);
      const dx = _hp.x - c.pos[0].t, dy = _hp.y - c.pos[1].t, a = -c.rot[2].t, ca = Math.cos(a), sa = Math.sin(a);
      const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca, hw = CARD.W / 2 * c.sc.t, hh = CARD.H / 2 * c.sc.t, pad = c.i === CD.hover ? 0.3 : 0;
      if (Math.abs(lx) < hw + pad && Math.abs(ly) < hh + pad) { best = c.i; bz = z; CD.hpx = clamp(lx / hw, -1, 1); CD.hpy = clamp(ly / hh, -1, 1); }
    }
    return best;
  }
  function down(x, y, pid) {
    const ph = ST.phase;
    let ok = false;
    if (ph === 'zip') { ok = grabZip(x, y, pid) || grabLid(x, y, pid); if (!ok) nudgeTab(); }
    else if (ph === 'lid') ok = grabLid(x, y, pid);
    else if (ph === 'lift') ok = grabPack(x, y, pid) || grabLid(x, y, pid);
    else if (ph === 'tear') ok = grabStrip(x, y, pid);
    else if (ph === 'slide') ok = grabSlide(x, y, pid);
    else if (ph === 'reveal') ok = grabCard(x, y, pid);
    else if (ph === 'done') ok = grabDone(x, y, pid);
    if (ok) { drag.x0 = x; drag.y0 = y; drag.moved = false; }
    return ok;
  }
  function move(x, y) {
    if (!drag) return;
    if (Math.hypot(x - drag.x0, y - drag.y0) > 6) drag.moved = true;
    drag.lx = x; drag.ly = y;
    const k = drag.kind;
    if (k === 'zip') moveZip(x, y);
    else if (k === 'lid') moveLid(x, y);
    else if (k === 'pack') movePack(x, y);
    else if (k === 'strip') moveStrip(x, y);
    else if (k === 'slide') moveSlide(x, y);
    else if (k === 'card') moveCard(x, y);
    else if (k === 'done') moveDone(x, y);
  }
  function up() {
    const d = drag; drag = null;
    if (!d) return;
    const k = d.kind;
    if (k === 'zip') dropZip();
    else if (k === 'lid') dropLid(d);
    else if (k === 'pack') dropPack(d);
    else if (k === 'strip') dropStrip(d);
    else if (k === 'slide') dropSlide(d);
    else if (k === 'card') dropCard(d);
    else if (k === 'done') dropDone(d);
  }
  /* 最近 120ms 里的速度 */
  function track(d, ...v) { const now = performance.now(); (d.hist = d.hist || []).push([now, ...v]); while (d.hist.length > 2 && now - d.hist[0][0] > 120) d.hist.shift(); }
  function vel(d, j) { const h = d.hist; if (!h || h.length < 2) return 0; const a = h[0], b = h[h.length - 1], s = (b[0] - a[0]) / 1000; return s > 0.004 ? (b[j] - a[j]) / s : 0; }

  /* ───────── ① 撕拉条：捏住拉手往右撕，撕口跟着手的横向位置走 ───────── */
  function grabZip(x, y, pid) {
    if (!nearZip(x, y)) return false;
    const n = Z.nearest(x, y);
    // 手在盒子正面前一点的竖直平面上动（略往后仰），往右拖就往右撕，往外拖撕条就离开盒面
    const cf = camFacing(), nrm = V3(0, cf.y * 0.4, 1).normalize();
    const p0 = Z.M[n.i].clone();
    const hp = rayPlane(x, y, nrm, p0); if (!hp) return false;
    drag = { kind: 'zip', pid, nrm, pp: p0, off: p0.clone().sub(hp) };
    Z.grab(p0, n.i);
    return true;
  }
  function moveZip(x, y) {
    const hp = rayPlane(x, y, drag.nrm, drag.pp); if (!hp) return;
    const hand = hp.add(drag.off);
    zipCollide(hand); hand.y = Math.max(hand.y, 0.4);
    Z.hand.copy(hand);
  }
  function dropZip() {
    Z.release();
    if (Z.free) { Z.toss(V3(34, 22, 16)); Z.tossed = true; }
  }
  function nudgeTab() { if (Z.free || Z.p > BOX.tab + 0.05) return; Z.nudged = true; Z.wig = 1; after(0.3, () => { Z.wig = 0; Z.nudged = false; }); nudgeHint(); }
  function onZipPeel(_p, adv) { buzz(adv); }
  function tearZip() { Z.releaseAll(); Z.toss(V3(34, 22, 16)); Z.tossed = true; B.lid.locked = false; if (ST.phase === 'zip') setPhase('lid'); }

  /* ───────── ② 盒盖：在所有角度里找一个，让按住的那一点在屏幕上离指针最近 ───────── */
  const _lq = new THREE.Quaternion(), _X = V3(1, 0, 0), _lw = V3();
  function lidWorld(local, a, out = V3()) { return out.copy(local).applyQuaternion(_lq.setFromAxisAngle(_X, -a)).add(B.lid.pivot); }
  function lidAt(x, y) { const h = hitList(x, y, B.lid.meshes); return h.length ? h[0] : null; }
  function grabLid(x, y, pid) {
    const hit = lidAt(x, y); if (!hit) return false;
    const L = B.lid;
    L.g.updateMatrixWorld(true);
    const local = L.g.worldToLocal(hit.point.clone());
    drag = { kind: 'lid', pid, local };
    L.held = true; L.a.v = 0;
    track(drag, L.a.x);
    return true;
  }
  function moveLid(x, y) {
    const L = B.lid, cur = L.a.x, max = L.locked ? 2.2 * DEG : L.max;
    // 几乎不罚角度变化，只在两个角度一样近时偏向不动，这样按住的点就钉在指针下面
    const cost = a => { const [X, Y] = toScreen(lidWorld(drag.local, a, _lw)); return Math.hypot(X - x, Y - y) + Math.abs(a - cur) / DEG * 0.02; };
    let best = cur, bc = cost(cur);
    for (let a = 0; a <= max + 1e-6; a += 1 * DEG) { const c = cost(a); if (c < bc) { bc = c; best = a; } }
    for (let a = best - 1 * DEG; a <= best + 1 * DEG; a += 0.1 * DEG) { const aa = clamp(a, 0, max), c = cost(aa); if (c < bc) { bc = c; best = aa; } }
    L.a.x = L.a.t = best;
    track(drag, best);
    if (L.locked && best > 1.5 * DEG && !Z.nudged) nudgeTab();
  }
  function dropLid(d) {
    const L = B.lid; L.held = false;
    if (L.locked) { L.a.t = 0; L.a.v = -1; return; }
    const v = vel(d, 1);
    const open = !d.moved || v > 2 || (v > -2 && L.a.x > 42 * DEG);
    L.open = open; L.a.t = open ? L.rest : 0; L.a.v = clamp(v, -8, 8);
  }
  function openLid() { const L = B.lid; L.locked = false; L.open = true; L.a.t = L.rest; L.a.v = 2.5; }

  /* ───────── ③ 拿出卡包：按住的那一点跟着手往上走，越高越转向你；松手够高就拿到面前 ───────── */
  const _pq = new THREE.Quaternion(), _pc4 = [V3(), V3(), V3(), V3()];
  function grabPack(x, y, pid) {
    if (PK.mode !== 'box' && PK.mode !== 'back') return false;
    const hits = hitList(x, y, packMeshes()); if (!hits.length) return false;
    const g = PK.group, p0 = hits[0].point.clone();
    const cf = camFacing(), nrm = V3(cf.x, 0, cf.z).normalize();   // 竖直平面：往上拖就是往上提
    drag = { kind: 'pack', pid, local: g.worldToLocal(p0.clone()), p0, nrm, q0: g.quaternion.clone() };
    PK.mode = 'drag'; PK.dp.copy(g.position); PK.dq.copy(g.quaternion);
    return true;
  }
  function movePack(x, y) {
    const hp = rayPlane(x, y, drag.nrm, drag.p0); if (!hp) return;
    const p0 = drag.p0, h = clamp(hp.y - p0.y, 0, 15), t = clamp(h / 9);
    // 还在凹槽里时横着挪不动，提得越高越自由
    const fr = smooth(clamp(h / 2.2));
    const hand = V3(p0.x + (hp.x - p0.x) * fr, p0.y + h, p0.z + (hp.z - p0.z) * fr);
    holdQuat(hand, _pq);
    PK.dq.slerpQuaternions(drag.q0, _pq, smooth(t));
    PK.dp.copy(drag.local).applyQuaternion(PK.dq).negate().add(hand);
    // 转起来的时候别让另一头扎进内托
    const { W, H } = PACK; let lo = 1e9;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy], i) => { lo = Math.min(lo, _pc4[i].set(sx * W / 2, sy * H / 2, 0).applyQuaternion(PK.dq).y); });
    PK.dp.y = Math.max(PK.dp.y, PACK_REST.p.y - lo);
    PK.t.x = PK.t.t = t;
  }
  function dropPack(d) {
    if (!d.moved || PK.t.x > 0.25) liftPack();
    else packFlyFrom('back');
  }
  function liftPack() { packFlyFrom('hold'); PK.t.v = 0.5; CAM.t.t = 1; setPhase('tear'); }

  /* ───────── ④ 撕开：捏住撕条往旁边扯，撕条的起头跟着手 ───────── */
  function grabStrip(x, y, pid) {
    const hits = hitList(x, y, packMeshes()); if (!hits.length) return false;
    const loc = PK.group.worldToLocal(hits[0].point.clone());
    if (loc.y < 0) return false;
    const S = PK.strip;
    if (S.free) return false;
    if (S.p < S.ds * 1.05) S.p = S.ds * 1.05;
    const nrm = V3(0, 0, 1).transformDirection(PK.group.matrixWorld);
    const pp = hits[0].point.clone().addScaledVector(nrm, 0.9);
    const hp = rayPlane(x, y, nrm, pp); if (!hp) return false;
    const end0 = S.M[0].clone().addScaledVector(nrm, 0.15);
    drag = { kind: 'strip', pid, nrm, pp, off: end0.clone().sub(hp) };
    S.grab(end0, 0);
    return true;
  }
  function moveStrip(x, y) {
    const hp = rayPlane(x, y, drag.nrm, drag.pp); if (!hp) return;
    const hand = hp.add(drag.off);
    packCollide(hand);
    PK.strip.hand.copy(hand);
  }
  function dropStrip() {
    const S = PK.strip;
    S.release();
    if (S.free) finishTear();
  }
  function finishTear() {
    const S = PK.strip;
    S.dropped = true; S.toss(V3(18, -30, 8));
    PK.open.t = 0.85; PK.open.v = 3;
    PK.lean.t = 0.3;   // 袋口往你这边低一点，看得见里面的卡
    CD.slide.t = 1.3;
    while (paintNextCard());   // 卡要露出来了：还没画好的卡面当场画完
    setPhase('slide');
  }
  function onStripPeel(_p, adv) {
    // 每撕一下，卡包被扯得晃一晃
    PK.sway.z.v -= adv * 2.2; PK.sway.x.v += adv * 0.8;
    buzz(adv);
  }

  /* ───────── ⑤ 抽卡：顺着卡包往上拖 ───────── */
  function grabSlide(x, y, pid) {
    if (!hitList(x, y, packMeshes().concat(cardMeshes())).length) return false;
    const o = PK.group.localToWorld(V3(0, 0, 0)), u = PK.group.localToWorld(V3(0, 1, 0));
    const a = toScreen(o), b = toScreen(u), dir = [b[0] - a[0], b[1] - a[1]], len = Math.hypot(...dir);
    drag = { kind: 'slide', pid, s0: CD.slide.x, dir: [dir[0] / len, dir[1] / len], ppc: len };
    return true;
  }
  function moveSlide(x, y) {
    const dx = x - drag.x0, dy = y - drag.y0, along = (dx * drag.dir[0] + dy * drag.dir[1]) / drag.ppc;
    CD.slide.x = CD.slide.t = clamp(drag.s0 + along, 0, 9.6);
  }
  function dropSlide(d) {
    if (!d.moved || CD.slide.x > 3.4) popCards();
    else CD.slide.t = 1.3;
  }
  function popCards() { CD.popping = true; CD.slide.t = 11.4; CD.slide.v = Math.max(CD.slide.v, 9); }
  function handOff() {
    CD.popping = false;
    cardsToHand();
    PK.mode = 'gone'; PK.drop = { v: V3(1.5, -8, -4), w: -1.4, t: 0 };
    setPhase('reveal');
  }

  /* ───────── ⑥ 一张张看：最上面那张跟着手走，划出去（或点一下）就绕到这一叠的最后 ───────── */
  function holdPlane(z) {
    CD.hold.updateMatrixWorld(true);
    return { n: V3(0, 0, 1).applyQuaternion(CD.hold.quaternion), p: CD.hold.localToWorld(V3(0, 0, z)) };
  }
  function grabCard(x, y, pid) {
    if (!hitList(x, y, cardMeshes(c => c.state === 'stack')).length) return false;
    const c = CD.cards[CD.order[0]]; if (!c || c.state !== 'stack') return false;
    const z = c.pos[2].x, pl = holdPlane(z), hp = rayPlane(x, y, pl.n, pl.p); if (!hp) return false;
    const hl = CD.hold.worldToLocal(hp);
    c.drag = true;
    drag = { kind: 'card', pid, c, z, p0: c.pos.map(s => s.x), r0: c.rot.map(s => s.x), off: [c.pos[0].x - hl.x, c.pos[1].x - hl.y] };
    track(drag, c.pos[0].x, c.pos[1].x);
    return true;
  }
  function moveCard(x, y) {
    const c = drag.c, pl = holdPlane(drag.z), hp = rayPlane(x, y, pl.n, pl.p); if (!hp) return;
    const hl = CD.hold.worldToLocal(hp);
    const X = hl.x + drag.off[0], Y = hl.y + drag.off[1], dx = X - drag.p0[0], dy = Y - drag.p0[1];
    c.pos[0].snap(X); c.pos[1].snap(Y); c.pos[2].snap(drag.p0[2] + Math.min(0.45, Math.hypot(dx, dy) * 0.12));
    // 拿着一角往外带：往哪边走就往哪边歪一点
    c.rot[0].snap(drag.r0[0] - dy * 0.02); c.rot[1].snap(drag.r0[1] + dx * 0.03); c.rot[2].snap(drag.r0[2] - dx * 0.035);
    c.g.position.set(c.pos[0].x, c.pos[1].x, c.pos[2].x); c.g.rotation.set(c.rot[0].x, c.rot[1].x, c.rot[2].x);
    track(drag, X, Y);
  }
  function dropCard(d) {
    const c = d.c; c.drag = false;
    const dx = c.pos[0].x - d.p0[0], dy = c.pos[1].x - d.p0[1], vx = vel(d, 1), vy = vel(d, 2);
    const go = !d.moved || Math.hypot(dx, dy) > 2 || Math.hypot(vx, vy) > 22;
    if (!go) { c.pos[0].v = vx; c.pos[1].v = vy; setCardTarget(c, stackPose(0)); return; }
    const side = Math.abs(dx) > 0.4 ? Math.sign(dx) : Math.abs(vx) > 4 ? Math.sign(vx) : 1;
    nextCard(side);
  }
  /* 换下一张；最后一张（闪卡）划走就把五张摊开 */
  function nextCard(side = 1) {
    const top = CD.cards[CD.order[0]];
    if (top.i === RARE && CD.seen >= CD.cards.length - 1) { CD.seen = CD.cards.length; spreadCards(); setPhase('done'); return; }
    tuckTop(side);
    const nxt = CD.cards[CD.order[0]];
    if (nxt.i === RARE && CD.seen >= CD.cards.length - 1) {   // 最后一张是闪卡：它自己往前凑一点，镭射扫一遍
      hint('rare');
      after(0.42, () => { if (CD.order[0] !== nxt.i || nxt.state !== 'stack') return; CD.sweep = 0; nxt.pos[2].t += 0.5; nxt.sc.t = 1.03; });
    } else hint('reveal');
  }

  /* ───────── ⑦ 摊开以后：点一张拿近看；拿近以后在哪儿拖都能转它，松手停在正面或背面 ───────── */
  function grabDone(x, y, pid) {
    const hh = hitList(x, y, cardMeshes());
    let i = hh.length ? hh[0].object.userData.card : -1;
    if (CD.insp < 0) { const k = hoverAt(x, y); if (k >= 0) i = k; }   // 和悬停用同一套判断，看着抬起来的那张就是点到的那张
    drag = { kind: 'done', pid, i };
    if (CD.insp >= 0) { const c = CD.cards[CD.insp]; drag.r0 = [c.rot[0].x, c.rot[1].x]; track(drag, c.rot[1].x); }
    return true;
  }
  function moveDone(x, y) {
    if (CD.insp < 0 || !drag.moved) return;
    const c = CD.cards[CD.insp];
    CD.spin = true;
    // 横着拖半个舞台转大半圈；竖着拖只能前后仰一点
    const yaw = drag.r0[1] + (x - drag.x0) / (G.w * 0.5) * Math.PI * 0.9;
    const pitch = clamp(drag.r0[0] + (y - drag.y0) / (G.h * 0.5) * 1.2, -0.6, 0.6);
    c.rot[1].snap(yaw); c.rot[0].snap(pitch);
    track(drag, yaw);
  }
  function dropDone(d) {
    if (d.moved && CD.insp >= 0) {   // 带着惯性停到最近的一面
      const c = CD.cards[CD.insp], v = clamp(vel(d, 1), -14, 14);
      CD.spin = false;
      c.rot[1].v = v; c.rot[1].t = Math.round((c.rot[1].x + v * 0.12) / Math.PI) * Math.PI; c.rot[0].t = 0;
      return;
    }
    if (d.moved) return;
    inspect(d.i >= 0 && d.i !== CD.insp ? d.i : -1);
  }
  function inspect(i) {
    const prev = CD.insp;
    CD.insp = i >= 0 && i !== prev ? i : -1;
    CD.spin = false;
    // 拿起来的那张凑到面前，其余的往后让一让
    for (const o of CD.cards) {
      const P = spreadPose(o.i);
      if (o.i === CD.insp) { o.state = 'insp'; setCardTarget(o, { p: [0, 0, inspectZ()], r: [0, Math.round(o.rot[1].x / Math.PI) * Math.PI, 0], s: 1 }); }
      else {
        if (o.state === 'insp') { o.rot[1].x -= Math.round(o.rot[1].x / TAU) * TAU; }   // 放回去时少转几圈
        o.state = 'spread';
        if (CD.insp >= 0) { P.p[2] -= 3; P.s *= 0.92; }
        setCardTarget(o, P);
      }
    }
    hint(CD.insp >= 0 ? 'inspect' : 'done');
  }
  function relayoutSpread() { if (ST.phase !== 'done') return; CD.layout = spreadLayout(); const keep = CD.insp; CD.insp = -1; inspect(keep); }

  /* ───────── 提示：舞台底下一行，第几步 + 怎么做；鼠标和触屏说法不一样的写两句 ───────── */
  const HINTS = {
    zip: ['1', 'Pull the tab to tear it open'],
    lid: ['2', 'Lift the lid'],
    lift: ['3', 'Lift the pack out'],
    tear: ['4', 'Tear along the top'],
    slide: ['5', 'Slide the cards out'],
    reveal: [null, 'Swipe for the next card'],
    rare: [null, 'Swipe to lay them out'],
    done: ['✓', 'Click a card to look closer', 'Tap a card to look closer'],
    inspect: ['✓', 'Drag to turn it'],
  };
  const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  let hintKey = '';
  function hint(p, instant) {
    let [n, t, touch] = HINTS[p] || ['', ''];
    if (n === null) n = `${Math.min(CD.cards.length, CD.seen + 1)}/${CD.cards.length}`;
    const key = n + t;
    if (!hintEl || key === hintKey) return;
    hintKey = key;
    hintEl.innerHTML = `<span class="n">${esc(n)}</span>` + (touch ? `<span class="for-mouse">${esc(t)}</span><span class="for-touch">${esc(touch)}</span>` : `<span>${esc(t)}</span>`);
    if (!instant && !reduce) hintEl.animate([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  }
  /* 盖子还锁着就去掀：提示条左右晃一下 */
  function nudgeHint() { if (hintEl && !reduce) hintEl.animate([{ transform: 'none' }, { transform: 'translateX(-4px)', offset: 0.22 }, { transform: 'translateX(3px)', offset: 0.48 }, { transform: 'translateX(-1.5px)', offset: 0.72 }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' }); }

  /* 震一下（只有安卓上的浏览器支持） */
  let lastBuzz = 0;
  function buzz(a) { const now = performance.now(); if (a > 0.05 && now - lastBuzz > 70 && navigator.vibrate && drag && drag.pid !== 'kb') { lastBuzz = now; try { navigator.vibrate(4); } catch (_) { } } }

  /* ───────── 开始 / 重来 ───────── */
  function reset() {
    drag = null; later = []; nudges = 0;
    if (Z) { G.root.remove(Z.mesh); Z.geo.dispose(); }
    Z = buildZip(); Z.onPeel = onZipPeel;
    const L = B.lid; L.a.snap(0); L.open = false; L.locked = true; L.held = false; L.g.rotation.x = 0;
    frameBox(0, 1);   // 机位直接放到合着的盒子上，不从上一次的样子飘过来
    CAM.t.snap(0); CAM.B.needW = 19; CAM.B.needH = 21; CAM.B.target.y = camBY();
    // 卡包回到内托里，撕条重新贴上
    if (!PK) buildPack();
    PK.group.visible = true; PK.mode = 'box'; PK.from = null; PK.t.snap(0); PK.off.set(0, 0, 0); PK.open.snap(0); PK.drop = null;
    for (const s of [PK.tilt.x, PK.tilt.y, PK.sway.x, PK.sway.z, PK.lean]) s.snap(0);
    newStrip();
    if (!CD) buildCards();
    cardsIntoPack(); CD.popping = false; CD.sweep = -1; CD.spin = false;
    ST.phase = 'zip'; ST.t = 0; hint('zip', true); opts.onPhase?.('zip');
  }
  function newStrip() {
    if (PK.strip) { G.root.remove(PK.strip.mesh, PK.stripBack); PK.strip.geo.dispose(); }
    packPose(_pose); PK.group.position.copy(_pose.p); PK.group.quaternion.copy(_pose.q); PK.group.updateMatrixWorld(true);
    const S = makeStrip();
    PK.strip = S; S.onPeel = onStripPeel;
    PK.stripBack = new THREE.Mesh(S.geo, PK.M.stripFront); PK.stripBack.frustumCulled = false; PK.stripBack.receiveShadow = true;
    G.root.add(S.mesh, PK.stripBack);
    PK._lastTorn = null;
  }

  /* 测试用：手动按 60Hz 推进 n 帧再画一次（无头浏览器里的软件渲染太慢，真实时间下物理会被截断）；推过一次以后自己的循环就不跑了 */
  let manual = false;
  function tick(n = 1, dt = 1 / 60, draw = true) { manual = true; for (let i = 0; i < n; i++) step(dt, ST.t + dt); if (draw) G.renderer.render(G.scene, G.camera); else G.scene.updateMatrixWorld(); }

  /* ───────── 键盘：回车 / 空格走一步 ─────────
     走的是和手一样的按下 / 拖动 / 松开（一只看不见的手），每一步都是“朝某个方向拖，直到场景里那件事发生了再松手”，
     所以不管画面多大、帧率多低都能走完。手指或鼠标一碰就停。 */
  const ABORT = Symbol('abort');
  const D = {
    tok: 0, x: 0, y: 0,
    check(t) { if (t !== D.tok) throw ABORT; },
    now() { return ST.t * 1000; },   // 用场景时间：机器慢、掉帧时，手和物理一起慢下来
    place(x, y) { D.x = x; D.y = y; },
    at(v) { return toScreen(v); },
    feed(x, y) { CD.hx = clamp(x / G.w * 2 - 1, -1, 1); CD.hy = clamp(y / G.h * 2 - 1, -1, 1); aimPack(x, y); if (drag) move(x, y); },
    frame() { wake(); return new Promise(r => requestAnimationFrame(r)); },
    async move(x, y, t, ms) {
      const x0 = D.x, y0 = D.y, dist = Math.hypot(x - x0, y - y0);
      ms = ms ?? clamp(200 + dist * 1.1, 240, 640);
      const t0 = D.now();
      for (;;) {
        await D.frame(); D.check(t);
        const u = clamp((D.now() - t0) / ms), e = easeIO(u);
        D.place(lerp(x0, x, e), lerp(y0, y, e));
        if (drag) D.feed(D.x, D.y);
        if (u >= 1) return;
      }
    },
    // 按住往一个方向拖，速度先慢后快；done() 成立或超时就停。速度按 420 宽的设计稿给，乘 SCALE
    async drive(t, dir, speed, done, maxMs = 6000) {
      const t0 = D.now(); let last = t0;
      const n = Math.hypot(dir[0], dir[1]) || 1, ux = dir[0] / n, uy = dir[1] / n;
      for (;;) {
        await D.frame(); D.check(t);
        const now = D.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
        const v = speed * SCALE * smooth(clamp((now - t0) / 380));
        D.place(D.x + ux * v * dt, D.y + uy * v * dt);
        D.feed(D.x, D.y);
        if (done() || now - t0 > maxMs) return;
      }
    },
    async wait(ms, t) { const t0 = D.now(); while (D.now() - t0 < ms) { await D.frame(); D.check(t); } },
    async press(t) { const ok = down(D.x, D.y, 'kb'); await D.wait(110, t); return ok; },
    async release(t) { up(D.x, D.y); await D.wait(70, t); },
  };
  const ACT = {
    async zip(t) {
      await D.move(...D.at(Z.M[1]), t);
      if (!await D.press(t)) return;
      await D.wait(240, t);
      await D.drive(t, [1, -0.03], 240, () => Z.free, 7000);
      await D.drive(t, [1, -0.6], 900, () => false, 150);   // 甩出去
      await D.release(t);
    },
    async lid(t) {
      await D.wait(260, t);
      await D.move(...D.at(V3(BOX.W * 0.18, BOX.H + BOX.T, BOX.L / 2 - 1.3)), t);
      if (!await D.press(t)) return;
      await D.wait(160, t);
      await D.drive(t, [0.06, -1], 300, () => B.lid.a.x > 78 * DEG, 4000);
      await D.release(t);
    },
    async lift(t) {
      await D.wait(450, t);
      await D.move(...D.at(PK.group.localToWorld(V3(0.3, -3.2, 0.3))), t);
      if (!await D.press(t)) return;
      await D.wait(200, t);
      await D.drive(t, [0.04, -1], 260, () => PK.t.x > 0.5, 3500);
      await D.release(t);
    },
    async tear(t) {
      await D.wait(PK.mode === 'hold' ? 200 : 900, t);
      await D.move(...D.at(PK.group.localToWorld(V3(-PACK.W / 2 + 0.45, PACK.tearY + 0.75, 0.05))), t);
      if (!await D.press(t)) return;
      await D.wait(240, t);
      await D.drive(t, [1, -0.06], 210, () => PK.strip.free, 6000);
      await D.drive(t, [1, 0.5], 500, () => false, 160);
      await D.release(t);
    },
    async slide(t) {
      await D.wait(650, t);
      await D.move(...D.at(PK.group.localToWorld(V3(0.4, -1.5, 0.4))), t);
      if (!await D.press(t)) return;
      await D.wait(180, t);
      await D.drive(t, [0, -1], 190, () => CD.slide.x > 4.2, 3000);
      await D.release(t);
    },
    async reveal(t) {
      const c = CD.cards[CD.order[0]]; if (!c) return;
      await D.wait(c.i === RARE ? 1500 : CD.seen ? 700 : 1100, t);
      await D.move(...D.at(CD.hold.localToWorld(V3(0.9, -0.8, 1.2))), t, 420);
      if (!await D.press(t)) return;
      await D.wait(110, t);
      const x0 = c.pos[0].x, side = CD.seen % 2 ? -1 : 1;   // 左右轮流划
      await D.drive(t, [side, -0.22], 720, () => Math.abs(c.pos[0].x - x0) > 3, 900);
      await D.release(t);
    },
    async done(t) {
      const r = CD.cards[RARE];
      await D.wait(1000, t);
      await D.move(...D.at(r.g.getWorldPosition(V3())), t);
      await D.press(t); await D.release(t);   // 拿近
      await D.wait(1100, t);
      const cx = D.x, cy = D.y;
      // 晃一晃，让镭射滑过去
      await D.move(cx - 60, cy - 26, t, 900); await D.move(cx + 66, cy + 18, t, 1200); await D.move(cx, cy, t, 700);
      // 拖着翻到背面，再翻回来
      await D.press(t);
      await D.drive(t, [1, 0.04], 380, () => r.rot[1].x > Math.PI * 0.62, 2600);
      await D.release(t);
      await D.wait(1300, t);
      await D.move(cx + 30, cy, t, 500);
      await D.press(t);
      await D.drive(t, [-1, -0.04], 380, () => r.rot[1].x < Math.PI * 0.38, 2600);
      await D.release(t);
      await D.wait(1100, t);
      await D.press(t); await D.release(t);   // 放回去
    },
  };

  /* 手指或鼠标一碰，看不见的那只手就松开、停下 */
  function stopGhost() {
    D.tok++; kbNext = false;
    if (drag && drag.pid === 'kb') up(D.x, D.y);
  }
  let kbBusy = false, kbNext = false;
  async function onKey(e) {
    if (e.target !== root || e.altKey || e.ctrlKey || e.metaKey) return;
    const ph = ST.phase, k = e.key;
    if (k === 'r' || k === 'R') { stopGhost(); reset(); wake(); return; }
    // 摊开以后：左右键换着拿近看，Esc 放回去；翻卡时左右键往那边划
    if (ph === 'done' && (k === 'ArrowRight' || k === 'ArrowLeft')) {
      e.preventDefault(); const n = CD.cards.length, i = CD.insp < 0 ? (k === 'ArrowRight' ? 0 : n - 1) : (CD.insp + (k === 'ArrowRight' ? 1 : n - 1)) % n;
      inspect(i); wake(); return;
    }
    if (ph === 'done' && k === 'Escape' && CD.insp >= 0) { e.preventDefault(); inspect(-1); wake(); return; }
    if (ph === 'reveal' && (k === 'ArrowRight' || k === 'ArrowLeft') && !drag) { e.preventDefault(); nextCard(k === 'ArrowRight' ? 1 : -1); wake(); return; }
    if (k !== 'Enter' && k !== ' ') return;
    e.preventDefault();
    // 上一步的手还没松开（这一步的事已经发生了，手还在甩、在松）：记下来，松开以后接着走，不吞掉这一下
    if (kbBusy) { kbNext = true; return; }
    kbStep();
  }
  async function kbStep() {
    const t = ++D.tok, ph = ST.phase; kbBusy = true;
    try {
      if (ph === 'done') { const n = CD.cards.length; inspect(CD.insp < n - 1 ? CD.insp + 1 : -1); wake(); }
      else { D.place(G.w * 0.72, G.h * 0.86); await ACT[ph](t); }
    } catch (err) { if (err !== ABORT) throw err; }
    finally { kbBusy = false; }
    if (kbNext && alive) { kbNext = false; kbStep(); }
  }
  on(root, 'keydown', onKey);

  /* ───────── 启动 ───────── */
  let ro = null, io = null;
  const visible = () => { if (!document.hidden) wake(); };
  async function init() {
    try { initScene(canvas); } catch (e) { G.ok = false; }
    // 没有 WebGL、显卡是 CPU 模拟的（无头浏览器、没有能用的显卡）：这一场在 CPU 上一秒才画一帧，换成一张静帧
    if (!G.ok || (softwareGL(G.renderer.getContext()) && !window.__unboxSoftwareOk)) {
      if (G.renderer) G.renderer.dispose();
      G.ok = false; opts.onStatus?.('poster'); return;
    }
    // 卡面、盒面、卡包上的字都是 canvas 排的，先等字体（最多等 3 秒）
    if (document.fonts) {
      await Promise.race([
        Promise.all(['40px "Instrument Serif"', 'italic 40px "Instrument Serif"', '400 20px "Instrument Sans"', '600 20px "Instrument Sans"', '500 20px "DM Mono"'].map(f => document.fonts.load(f))).catch(() => { }),
        new Promise(r => setTimeout(r, 3000)),
      ]);
    }
    if (!alive) return;
    const t0 = performance.now();
    B = buildBox();
    layout();   // 先知道舞台多宽，reset 才能把机位一次放对
    reset();
    setTheme(!!opts.dark);
    if (window.__unboxDebug) console.info('> unbox build', Math.round(performance.now() - t0), 'ms');
    ro = new ResizeObserver(layout); ro.observe(root);
    io = new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) wake(); }); io.observe(root);
    on(document, 'visibilitychange', visible);
    opts.onStatus?.('ready');
    wake();
    // 卡面空闲时一张张画（盒子还没打开，看不到卡）；要是有人手快，撕开卡包时还没画完，就当场画完
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 60));
    const more = () => { if (alive && paintNextCard()) idle(more, { timeout: 400 }); };
    setTimeout(() => idle(more, { timeout: 400 }), 300);
  }
  init();

  const api = {
    /** 从一只新盒子重来 */
    restart() { if (!G.ok || !B) return; stopGhost(); reset(); wake(); },
    /** 换主题：桌上的影子、灯和曝光跟着变 */
    setDark(d) { if (!G.ok || !B) return; setTheme(d); wake(); },
    destroy() {
      alive = false; cancelAnimationFrame(raf); raf = 0; clearTimeout(nudgeTimer); D.tok++;
      offs.forEach(f => f()); ro?.disconnect(); io?.disconnect();
      if (G.scene) G.scene.traverse(o => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) { for (const v of Object.values(m)) if (v && v.isTexture) v.dispose(); m.dispose(); } });
      G.env?.dispose(); G.renderer?.dispose();
    },
  };
  // 自查用（无头浏览器里手动推帧、摆到某个样子再截图）：先在页面上设 window.__unboxDebug = true
  if (window.__unboxDebug) root.__unbox = { api, G, BOX, CAM, ST, PACK, CARD, RARE, toScreen, rayAt, V3, tick, down, move, up, tearZip, openLid, liftPack, popCards, finishTear, nextCard, spreadCards, inspect, reset, wake, hoverAt, get B() { return B; }, get PK() { return PK; }, get CD() { return CD; }, get Z() { return Z; }, get drag() { return drag; }, get SCALE() { return SCALE; }, get asleep() { return !raf; }, get quiet() { return quiet; }, signature, get frames() { return G.renderer.info.render.frame; } };
  return api;
}
