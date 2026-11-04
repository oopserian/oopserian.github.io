/* 字符画（ASCII）叠在 Three.js 画的海浪上。每帧两步：

     1. 海（scene）：画到一张离屏的图上（带 mipmap）。
        先画天：从地平线的雾白（夜里是深蓝）渐到天顶，前方低低的一个太阳（深色主题是月亮），外面一圈光晕。
        再画海面：一张从脚下铺到天边的网格（近密远疏），顶点在着色器里按 10 道 Gerstner 波推动：
        浪顶尖、浪谷平，波峰被挤到一起的地方（雅可比行列式变小）起白沫。
        每个像素再叠 8 道细碎的小波只改法线，太阳的倒影被打碎成一条闪光的路。
        颜色 = 海水本色（浪顶透一点青）和天的倒影按菲涅耳混合，越远越被雾吞掉。
     2. 合成（composite）：Waves 模式直接显示海；ASCII 模式把画面切成 8×14 的格子，每格取海的平均亮度挑一个字
        （. - ~ = + * # % @ 由淡到浓），字的颜色是这一格的颜色提亮，叠在海上，海本身只压暗一点，照样看得见。
        两种模式换的时候从左往右扫过去。

   鼠标、手指划过海面：从画面上那一点往海面投一条线，落点激起一圈往外扩的涟漪，两三秒后平下去。

   所有会动的都是 t（一圈 period 毫秒）的函数：每道波一圈正好走整数个周期（按深水的色散关系挑最近的整数），
   所以一圈以后海面正好回到原样，录出来的视频首尾接得上。

   省着画：平时每秒 30 帧，有涟漪、换模式的那一会儿跟着屏幕刷新；滚出屏幕、切到别的标签页就停；
   系统开了「减弱动态效果」，或者显卡是 CPU 模拟的（没有能用的显卡、无头浏览器，画一帧要上百毫秒），只画一帧不动的，也不跟着鼠标动。

     const w = create(canvas, { period: 12000 });
     w.setMode("ascii" | "waves");   // 从左往右扫过去
     w.refresh();                    // 换了主题以后调：浅色是白天，深色是月夜
     w.destroy();                    // 不用了：停下、摘掉监听、释放显存 */
import * as THREE from "three";

const TAU = Math.PI * 2;

function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// 显卡是不是 CPU 在模拟：跟首屏字符画（src/scripts/ascii.ts）同一个判断
function softwareGL(gl) {
  let name = String(gl.getParameter(gl.RENDERER));
  if (/^webkit webgl$/i.test(name)) {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  }
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

// ---------- 两套光 ----------
// 浅色主题是白天：太阳低低地挂在正前方偏右，海是深蓝，浪顶透青；深色主题是月夜：月亮偏左，天和海都压到很暗，只剩月光那条路
const LOOKS = {
  // ink：ASCII 那层怎么按亮度挑字。海上亮度 lo~hi 铺满由淡到浓的字；天上只有比 sky 还亮的地方（太阳、月亮和它的光晕）才有字
  day: {
    zenith: [0.3, 0.5, 0.74], horizon: [0.8, 0.84, 0.87], sun: [1.0, 0.93, 0.8], sunDir: [0.2, 0.075, -1],
    deep: [0.02, 0.13, 0.22], scatter: [0.06, 0.36, 0.42], foam: [0.92, 0.95, 0.96], disc: 0.99965, glow: 0.8,
    ink: [0.06, 0.42, 0.86, 0.14],
  },
  night: {
    zenith: [0.015, 0.025, 0.06], horizon: [0.09, 0.115, 0.18], sun: [0.85, 0.9, 1.0], sunDir: [-0.24, 0.1, -1],
    deep: [0.004, 0.012, 0.024], scatter: [0.03, 0.09, 0.14], foam: [0.42, 0.48, 0.56], disc: 0.99978, glow: 0.6,
    ink: [0.01, 0.16, 0.15, 0.5],
  },
};

// ---------- 波 ----------
// 10 道推动海面的大波、8 道只改法线的小波。大多往镜头这边来，有一组斜着的涌浪交叉。
// 每道波的角频率按深水色散 ω = √(gk) 算，再取成「一圈 period 里正好整数个周期」
function makeWaves(period) {
  const r = rng(20261104), T = period / 1000, g = 9.81;
  const omega = (k) => (TAU * Math.max(1, Math.round((Math.sqrt(g * k) * T) / TAU))) / T;
  const big = [], small = [];
  for (let i = 0; i < 10; i++) {
    const L = 26 * Math.pow(0.72, i), k = TAU / L;
    const a = Math.PI / 2 + (i % 3 === 1 ? 0.55 : (r() - 0.5) * 0.7);   // 往 +z（镜头）来，每三道有一道斜着
    const A = L * (i < 3 ? 0.016 : 0.011);
    const Q = 0.72 / (k * A * 10);                                         // 尖的程度：加起来不超过 1，浪顶才不会翻过去
    big.push([Math.cos(a), Math.sin(a), k, A, Q, omega(k), L]);
  }
  for (let i = 0; i < 8; i++) {
    const L = 1.1 * Math.pow(0.74, i), k = TAU / L, a = Math.PI / 2 + (r() - 0.5) * 2.2;
    small.push([Math.cos(a), Math.sin(a), k, L * 0.03, omega(k)]);
  }
  return { big, small };
}

// ---------- 字的图集 ----------
// 一行 10 格，一格 48×80（跟 DM Mono 一个字的宽高比一样），由淡到浓：空 . - ~ = + * # % @
const GLYPHS = [" ", ".", "-", "~", "=", "+", "*", "#", "%", "@"];
const TW = 48, TH = 80;
function drawAtlas(c) {
  const g = c.getContext("2d");
  c.width = TW * GLYPHS.length; c.height = TH;
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  GLYPHS.forEach((ch, i) => {
    g.font = `${i >= 6 ? 500 : 400} 70px "DM Mono", ui-monospace, monospace`;
    g.fillText(ch, i * TW + TW / 2, TH / 2 + 2);
  });
}

// ---------- 着色器 ----------
const SKY = /* glsl */ `
  uniform vec3 uZenith, uHorizon, uSun, uSunDir;
  uniform float uDisc, uGlow;
  vec3 sky(vec3 d) {
    float y = max(d.y, 0.0);
    vec3 c = mix(uHorizon, uZenith, pow(y, 0.5));
    float s = max(dot(d, uSunDir), 0.0);
    c += uSun * (pow(s, 8.0) * 0.1 + pow(s, 120.0) * 0.2 + pow(s, 1500.0) * 0.5) * uGlow;  // 光晕
    c += uSun * smoothstep(uDisc - 0.0001, uDisc, s) * 1.4;                                 // 太阳（月亮）本身
    return c;
  }
`;

const QUAD_VS = /* glsl */ `
  in vec3 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// 天：全屏一个三角形，按镜头的方向算每个像素看的是天的哪里
const SKY_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec3 uCamF, uCamR, uCamU;
  uniform vec2 uTan;
  ${SKY}
  void main() {
    vec2 n = vUv * 2.0 - 1.0;
    vec3 d = normalize(uCamF + uCamR * n.x * uTan.x + uCamU * n.y * uTan.y);
    o = vec4(sky(d), 0.0);   // a = 0：天
  }
`;

const SEA_VS = /* glsl */ `
  precision highp float;
  in vec3 position;                 // 网格在海平面上的位置（y = 0）
  uniform mat4 projectionMatrix, viewMatrix;
  uniform vec3 cameraPosition;
  uniform vec4 uW[10];              // 方向 x、方向 z、波数 k、振幅 A
  uniform vec4 uWq[10];             // 尖的程度 Q、角频率 ω、波长
  uniform vec4 uRip[8];             // 涟漪：x、z、过了几秒、有没有
  uniform float uT;
  out vec3 vPos, vN;
  out float vFoam, vH;
  void main() {
    vec2 p = position.xz;
    float dist = length(p - cameraPosition.xz);
    vec3 P = vec3(p.x, 0.0, p.y);
    vec3 n = vec3(0.0, 1.0, 0.0);
    float jxx = 1.0, jzz = 1.0, jxz = 0.0;
    for (int i = 0; i < 10; i++) {
      vec2 D = uW[i].xy; float k = uW[i].z, Q = uWq[i].x, w = uWq[i].y;
      // 远处网格稀，短的波在那里会闪，按「网格间距和波长的比」淡掉
      float A = uW[i].w * smoothstep(0.0, 1.0, uWq[i].z / (0.07 * dist + 0.001) - 0.6);
      float th = k * dot(D, p) - w * uT, s = sin(th), c = cos(th), WA = k * A;
      P.x += Q * A * D.x * c; P.z += Q * A * D.y * c; P.y += A * s;
      n.x -= D.x * WA * c; n.z -= D.y * WA * c; n.y -= Q * WA * s;
      jxx -= Q * WA * D.x * D.x * s; jzz -= Q * WA * D.y * D.y * s; jxz -= Q * WA * D.x * D.y * s;
    }
    // 涟漪：一圈往外扩的环，边走边弱
    float rip = 0.0;
    for (int i = 0; i < 8; i++) {
      if (uRip[i].w < 0.5) continue;
      vec2 d = p - uRip[i].xy; float r = length(d) + 1e-4, age = uRip[i].z;
      float front = 0.4 + 2.4 * age, x = r - front;
      float env = exp(-x * x / 0.5) * exp(-age / 0.9) * smoothstep(0.0, 0.15, age);
      float h = 0.3 * env * cos(5.0 * x), dh = -0.3 * env * 5.0 * sin(5.0 * x);
      P.y += h; n.xz -= dh * d / r; rip += env;
    }
    float J = jxx * jzz - jxz * jxz;
    vFoam = smoothstep(0.5, 0.18, J) + 0.35 * smoothstep(0.2, 0.9, rip);
    vH = P.y;
    vPos = P; vN = n;
    gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
  }
`;

const SEA_FS = /* glsl */ `
  precision highp float;
  in vec3 vPos, vN;
  in float vFoam, vH;
  out vec4 o;
  uniform vec3 cameraPosition;
  uniform vec4 uS[8];               // 小波：方向 x、方向 z、k、A
  uniform float uSw[8];             // 小波的角频率
  uniform float uT;
  uniform vec3 uDeep, uScatter, uFoam;
  ${SKY}
  void main() {
    vec3 V = cameraPosition - vPos; float dist = length(V); V /= dist;
    vec3 N = normalize(vN);
    // 细碎的小波只改法线。远处一个像素盖住的海面（顺着视线方向）大约随距离的平方变长，
    // 比它短的小波画不出来、只会排成一道道闪的条纹，按波长和它的比淡掉
    vec2 g = vec2(0.0);
    float foot = 0.0012 * dist * dist + 0.01;
    for (int i = 0; i < 8; i++) {
      float th = uS[i].z * dot(uS[i].xy, vPos.xz) - uSw[i] * uT;
      float keep = smoothstep(1.0, 3.0, 6.2831853 / uS[i].z / foot);
      g += uS[i].xy * uS[i].z * uS[i].w * cos(th) * keep;
    }
    N = normalize(N - vec3(g.x, 0.0, g.y) * 0.9);
    float nv = max(dot(N, V), 0.0);
    float F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
    vec3 R = reflect(-V, N); R.y = abs(R.y);
    vec3 refl = sky(R);
    // 海水本色：浪顶背着光透一点青
    float lift = clamp(vH * 0.9 + 0.3, 0.0, 1.0);
    float back = pow(max(dot(-V, uSunDir), 0.0), 3.0);
    vec3 water = mix(uDeep, uScatter, lift * (0.35 + 0.65 * back));
    vec3 col = mix(water, refl, F);
    col = mix(col, uFoam * (0.75 + 0.25 * lift), clamp(vFoam, 0.0, 1.0) * 0.85);
    // 越远越被雾吞掉，天边跟天接上
    float haze = 1.0 - exp(-dist / 160.0);
    col = mix(col, uHorizon, haze);
    o = vec4(col, 1.0 - haze);   // a：近处的海是 1，越远越接近天（0），ASCII 那层按它挑字
  }
`;

const COMP_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uAtlas;
  uniform vec2 uRes, uCell;         // 画布、一格，设备像素
  uniform float uLod, uN;
  uniform vec4 uInk;                // 海上亮度 lo、hi，天上从多亮开始有字、到多亮最浓
  uniform float uFrom, uTo, uP;     // 换模式：0 海、1 ASCII，uP 是扫到哪了（0~1）
  uniform float uDark;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec3 base = texture(uScene, vUv).rgb;
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) * uCell / uRes;
    vec4 avg = textureLod(uScene, vec2(c0.x, 1.0 - c0.y), uLod);
    vec3 col = avg.rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    // 亮度挑字：海上按 lo~hi 铺满；天上（a 小）只有太阳、月亮那一圈有字，一大片天保持干净
    float sea = (lum - uInk.x) / (uInk.y - uInk.x), sky = (lum - uInk.z) / uInk.w;
    float lv = clamp(mix(sky, sea, avg.a) + (hash(cell) - 0.5) * 0.1, 0.0, 0.999);
    float gi = floor(lv * uN);
    vec2 loc = (fc - cell * uCell) / uCell;
    float ink = texture(uAtlas, vec2((gi + clamp(loc.x, 0.02, 0.98)) / uN, 1.0 - loc.y)).r;
    // 字的颜色：这一格的颜色往白里提；海本身只压暗一点，照样看得见
    vec3 gc = col + (1.0 - col) * mix(0.55, 0.62, uDark);
    vec3 ascii = mix(base * mix(0.78, 0.72, uDark), gc, ink * 0.95);
    float k = clamp((uP * 1.25 - vUv.x) / 0.25, 0.0, 1.0);
    o = vec4(mix(base, ascii, mix(uFrom, uTo, k)), 1.0);
  }
`;

// ---------- 引擎 ----------
/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ period?: number, cell?: [number, number], fps?: number }} [opts]
 */
function create(canvas, { period = 12000, cell = [8, 14], fps = 30 } = {}) {
  // 没有 WebGL2 时 three 会抛错，交给调用的人接
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.autoClear = false;
  const software = softwareGL(renderer.getContext());
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let still = motion.matches || software;
  const flat = new THREE.Camera();
  const quad = new THREE.BufferGeometry();
  quad.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const pass = (mat) => { const s = new THREE.Scene(); s.add(Object.assign(new THREE.Mesh(quad, mat), { frustumCulled: false })); return s; };

  // 镜头：离海面 4 米，往下低一点看，地平线在画面上三分之一左右
  const cam = new THREE.PerspectiveCamera(40, 2, 0.1, 2000);
  cam.position.set(0, 4, 0);
  cam.lookAt(0, 4 - Math.tan((6.5 * Math.PI) / 180) * 100, -100);
  cam.updateMatrixWorld();

  const { big, small } = makeWaves(period);
  const look = {
    uZenith: { value: new THREE.Vector3() }, uHorizon: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3() },
    uSunDir: { value: new THREE.Vector3() }, uDisc: { value: 0.9995 }, uGlow: { value: 1 },
  };
  const uT = { value: 0 };

  // 1. 天
  const skyMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: QUAD_VS, fragmentShader: SKY_FS, depthTest: false, depthWrite: false,
    uniforms: { ...look, uCamF: { value: new THREE.Vector3() }, uCamR: { value: new THREE.Vector3() }, uCamU: { value: new THREE.Vector3() }, uTan: { value: new THREE.Vector2() } },
  });
  const skyScene = pass(skyMat);

  // 2. 海面：x 方向 300 格、z 方向 400 格，z 按指数铺（脚下密、天边疏），越远越宽，正好盖满画面。
  //    从镜头脚下往后一点开始铺，浪把网格前后推的时候边缘也露不出来
  const COLS = 300, ROWS = 400, NEAR = 1, FAR = 900;
  const pos = new Float32Array((COLS + 1) * (ROWS + 1) * 3), idx = [];
  for (let j = 0; j <= ROWS; j++) {
    const z = 2 - NEAR * Math.pow(FAR / NEAR, j / ROWS), half = Math.abs(z) * 1.4 + 6;
    for (let i = 0; i <= COLS; i++) { const o = (j * (COLS + 1) + i) * 3; pos[o] = (i / COLS * 2 - 1) * half; pos[o + 1] = 0; pos[o + 2] = z; }
  }
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const a = j * (COLS + 1) + i, b = a + 1, c = a + COLS + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const seaGeo = new THREE.BufferGeometry();
  seaGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); seaGeo.setIndex(idx);
  const rip = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0)), ripT = new Array(8).fill(-1e9), ripP = Array.from({ length: 8 }, () => [0, 0]);
  const seaMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: SEA_VS, fragmentShader: SEA_FS, side: THREE.DoubleSide,
    uniforms: {
      ...look, uT,
      uW: { value: big.map((w) => new THREE.Vector4(w[0], w[1], w[2], w[3])) },
      uWq: { value: big.map((w) => new THREE.Vector4(w[4], w[5], w[6], 0)) },
      uS: { value: small.map((w) => new THREE.Vector4(w[0], w[1], w[2], w[3])) },
      uSw: { value: small.map((w) => w[4]) },
      uRip: { value: rip },
      uDeep: { value: new THREE.Vector3() }, uScatter: { value: new THREE.Vector3() }, uFoam: { value: new THREE.Vector3() },
    },
  });
  const seaScene = new THREE.Scene();
  seaScene.add(Object.assign(new THREE.Mesh(seaGeo, seaMat), { frustumCulled: false }));
  let sceneRT = null;

  // 3. 合成
  const atlasCanvas = document.createElement("canvas");
  drawAtlas(atlasCanvas);
  const atlas = new THREE.CanvasTexture(atlasCanvas);
  atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.magFilter = THREE.LinearFilter; atlas.generateMipmaps = true;
  const compMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: QUAD_VS, fragmentShader: COMP_FS, depthTest: false, depthWrite: false,
    uniforms: { uScene: { value: null }, uAtlas: { value: atlas }, uInk: { value: new THREE.Vector4() }, uRes: { value: new THREE.Vector2(1, 1) }, uCell: { value: new THREE.Vector2(cell[0], cell[1]) },
      uLod: { value: 3 }, uN: { value: GLYPHS.length }, uFrom: { value: 1 }, uTo: { value: 1 }, uP: { value: 1 }, uDark: { value: 1 } },
  });
  const compScene = pass(compMat);

  let W = 0, H = 0, dpr = 1, mode = "ascii", sw = { t0: -1e9, from: 1, to: 1 }, raf = 0, visible = true, last = -1e9, dead = false;
  const SWEEP = 900;

  function readTheme() {
    const dark = getComputedStyle(canvas).colorScheme.includes("dark"), L = LOOKS[dark ? "night" : "day"];
    look.uZenith.value.fromArray(L.zenith); look.uHorizon.value.fromArray(L.horizon); look.uSun.value.fromArray(L.sun);
    look.uSunDir.value.fromArray(L.sunDir).normalize(); look.uDisc.value = L.disc; look.uGlow.value = L.glow;
    seaMat.uniforms.uDeep.value.fromArray(L.deep); seaMat.uniforms.uScatter.value.fromArray(L.scatter); seaMat.uniforms.uFoam.value.fromArray(L.foam);
    compMat.uniforms.uDark.value = dark ? 1 : 0;
    compMat.uniforms.uInk.value.fromArray(L.ink);
  }
  function relayout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    sceneRT?.dispose();
    sceneRT = new THREE.WebGLRenderTarget(pw, ph, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: true });
    cam.aspect = W / H; cam.updateProjectionMatrix();
    // 天那一步用的镜头方向
    const e = cam.matrixWorld.elements, ty = Math.tan((cam.fov * Math.PI) / 360);
    skyMat.uniforms.uCamR.value.set(e[0], e[1], e[2]); skyMat.uniforms.uCamU.value.set(e[4], e[5], e[6]); skyMat.uniforms.uCamF.value.set(-e[8], -e[9], -e[10]);
    skyMat.uniforms.uTan.value.set(ty * cam.aspect, ty);
    compMat.uniforms.uScene.value = sceneRT.texture;
    compMat.uniforms.uRes.value.set(pw, ph);
    compMat.uniforms.uCell.value.set(cell[0] * dpr, cell[1] * dpr);
    compMat.uniforms.uLod.value = Math.log2(Math.sqrt(cell[0] * cell[1]) * dpr) - 0.5;
    readTheme();
    paint(true);
  }

  // 鼠标、手指：从画面上那一点往海面投一条线，落点激起一圈涟漪。移动时每走 40px 或者每 120ms 一圈，最多同时 8 圈
  const ray = new THREE.Raycaster(), sea = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  let slot = 0, lastX = -1e9, lastY = -1e9, lastAt = -1e9;
  function splash(x, y) {
    ndc.set((x / W) * 2 - 1, 1 - (y / H) * 2);
    ray.setFromCamera(ndc, cam);
    if (!ray.ray.intersectPlane(sea, hit) || hit.distanceTo(cam.position) > 120) return;
    ripP[slot] = [hit.x, hit.z]; ripT[slot] = performance.now(); slot = (slot + 1) % rip.length;
    paint(true);
  }
  const at = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onMove = (e) => {
    if (still || !W) return;
    const [x, y] = at(e), now = performance.now();
    if (Math.hypot(x - lastX, y - lastY) < 40 && now - lastAt < 120) return;
    if (Math.hypot(x - lastX, y - lastY) < 6) return;
    lastX = x; lastY = y; lastAt = now;
    splash(x, y);
  };
  const onDown = (e) => { if (still || !W) return; const [x, y] = at(e); lastX = x; lastY = y; lastAt = performance.now(); splash(x, y); };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);

  function frame(now) {
    raf = 0;
    if (dead || !W || !sceneRT) return;
    let busy = false;
    for (let k = 0; k < rip.length; k++) {
      const age = (now - ripT[k]) / 1000, on = age >= 0 && age < 4;
      rip[k].set(ripP[k][0], ripP[k][1], age, on ? 1 : 0);
      if (on) busy = true;
    }
    const p = Math.min(1, Math.max(0, (now - sw.t0) / SWEEP)), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    if (p < 1) busy = true;
    // 平时每秒 fps 帧；有涟漪、换模式时每帧都画，跟得上手
    if (!still && !busy && now - last < 1000 / fps - 2) { schedule(); return; }
    last = now;
    const u = still ? 0.05 : (((now % period) + period) % period) / period;   // 不动时停在跟封面差不多的那一刻
    uT.value = (u * period) / 1000;
    compMat.uniforms.uFrom.value = sw.from; compMat.uniforms.uTo.value = sw.to; compMat.uniforms.uP.value = e;
    renderer.setRenderTarget(sceneRT); renderer.clear();
    renderer.render(skyScene, flat); renderer.render(seaScene, cam);
    renderer.setRenderTarget(null); renderer.render(compScene, flat);
    if (!still || busy) schedule();
  }
  function schedule() { if (!raf && !dead && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  // force：马上画这一帧，不等限帧（尺寸、主题、模式变了）
  function paint(force = false) { if (force) last = -1e9; schedule(); }

  function setMode(m, animate = true) {
    if (m === mode && animate) return;
    sw = { t0: animate && !still ? performance.now() : -1e9, from: mode === "ascii" ? 1 : 0, to: m === "ascii" ? 1 : 0 };
    mode = m;
    paint(true);
  }

  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) paint(true); });
  io.observe(canvas);
  const ro = new ResizeObserver(() => relayout());
  ro.observe(canvas);
  const onVis = () => { if (!document.hidden) paint(true); };
  document.addEventListener("visibilitychange", onVis);
  const onMotion = () => { still = motion.matches || software; paint(true); };
  motion.addEventListener("change", onMotion);
  // 字的图集用网站的 DM Mono 画，字体晚到了重画一遍
  document.fonts?.load('400 70px "DM Mono"').then(() => document.fonts.load('500 70px "DM Mono"')).then(() => {
    if (dead) return;
    drawAtlas(atlasCanvas); atlas.needsUpdate = true; paint(true);
  }, () => {});

  relayout();
  return {
    setMode,
    refresh() { readTheme(); paint(true); },
    get mode() { return mode; },
    destroy() {
      dead = true; cancelAnimationFrame(raf); raf = 0;
      io.disconnect(); ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onVis);
      motion.removeEventListener("change", onMotion);
      sceneRT?.dispose(); seaGeo.dispose(); quad.dispose(); atlas.dispose();
      skyMat.dispose(); seaMat.dispose(); compMat.dispose();
      renderer.dispose();   // 上下文不强行丢掉：同一个 canvas 再挂一次（开发时 React 会挂两遍）还要用
    },
  };
}

export { create };
