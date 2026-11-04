/* 用字符画（ASCII）画的海浪。Three.js 画的海只在离屏图里当底稿，屏幕上只有字。每帧两步：

     1. 海（scene）：镜头从 11 米高往前下方 40° 看，整块画面都是海，没有天。
        海面是一张从脚下铺到远处的网格（近密远疏），顶点在着色器里按 10 道 Gerstner 波推动：
        浪顶尖、浪谷平，波峰被挤到一起的地方（雅可比行列式变小）、浪尖、涟漪的环起白沫。
        每个像素再叠 8 道细碎的小波只改法线。底稿存两样：
        亮度（浪顶比浪谷亮，迎着光的浪面、反光、白沫更亮，远处被雾抹到中间）和浪头在画面上的走向。
     2. 合成（composite）：整块切成 8px 见方的格子，每格都有字，不留空：
        按这一格底稿的平均亮度从 - ~ = * # @ 里挑（越亮越浓），颜色沿一条色带走（深色主题由深蓝到白，浅色主题由浅灰蓝到深蓝）；
        字再转到浪头的走向上，一道道浪就被横着的字描出来，涟漪的环也是一圈转着的字，
        跟 ASCII Grass 里字顺着草叶转是一个做法。
        画布是透明的，字以外露出网页自己的底色，所以铺满整块也跟网站接得上。

   鼠标、手指划过海面：从画面上那一点往海面投一条线，落点激起一圈往外扩的涟漪，两三秒后平下去。

   所有会动的都是 t（一圈 period 毫秒）的函数：每道波一圈正好走整数个周期（按深水的色散关系挑最近的整数），
   所以一圈以后海面正好回到原样，录出来的视频首尾接得上。

   省着画：平时每秒 30 帧，有涟漪的那一会儿跟着屏幕刷新；滚出屏幕、切到别的标签页就停；
   系统开了「减弱动态效果」，或者显卡是 CPU 模拟的（没有能用的显卡、无头浏览器，画一帧要上百毫秒），只画一帧不动的，也不跟着鼠标动。

     const w = create(canvas, { period: 12000 });
     w.splash();                     // 在海面上随便一处激起一圈涟漪（键盘用）
     w.refresh();                    // 换了主题以后调：换字的色带
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

// 字的色带：由淡的字到浓的字四个颜色。深色主题由深蓝到白（浓的字最亮）；浅色主题由浅灰蓝到深蓝（浓的字墨最重）
const RAMPS = {
  dark: [[0.12, 0.3, 0.56], [0.14, 0.5, 0.84], [0.45, 0.82, 0.96], [0.95, 0.99, 1.0]],
  light: [[0.6, 0.7, 0.8], [0.27, 0.47, 0.72], [0.1, 0.29, 0.58], [0.03, 0.11, 0.28]],
};

// ---------- 波 ----------
// 10 道推动海面的大波、8 道只改法线的小波。大多往镜头这边来，有一组斜着的涌浪交叉。
// 每道波的角频率按深水色散 ω = √(gk) 算，再取成「一圈 period 里正好整数个周期」
function makeWaves(period) {
  const r = rng(20261104), T = period / 1000, g = 9.81;
  const omega = (k) => (TAU * Math.max(1, Math.round((Math.sqrt(g * k) * T) / TAU))) / T;
  const big = [], small = [];
  for (let i = 0; i < 10; i++) {
    const L = 9 * Math.pow(0.8, i), k = TAU / L;
    const a = Math.PI / 2 + (i % 3 === 1 ? 0.55 : (r() - 0.5) * 0.5);  // 往 +z（镜头）来，每三道有一道斜着
    const A = L * (i < 3 ? 0.05 : 0.03);
    const Q = 0.9 / (k * A * 10);                                       // 尖的程度：加起来不超过 1，浪顶才不会翻过去
    big.push([Math.cos(a), Math.sin(a), k, A, Q, omega(k), L]);
  }
  for (let i = 0; i < 8; i++) {
    const L = 1.1 * Math.pow(0.78, i), k = TAU / L, a = Math.PI / 2 + (r() - 0.5) * 2.2;
    small.push([Math.cos(a), Math.sin(a), k, L * 0.035, omega(k)]);
  }
  return { big, small };
}

// ---------- 字的图集 ----------
// 一行 6 格，一格 64 见方（字要转，格子得是正方形），由淡到浓：- ~ = * # @。
// 每个字按墨迹居中、横着拉宽一些（横线拉得多，块状的字拉得少），一格接一格连成一道道浪；再描一圈边，笔画粗一点
const GLYPHS = ["-", "~", "=", "*", "#", "@"];
const T = 64;
function drawAtlas(c) {
  const g = c.getContext("2d");
  c.width = T * GLYPHS.length; c.height = T;
  g.fillStyle = g.strokeStyle = "#fff"; g.lineJoin = "round"; g.lineWidth = 3;
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.font = '500 50px "DM Mono", ui-monospace, monospace';
  GLYPHS.forEach((ch, i) => {
    const m = g.measureText(ch);
    const l = m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight, up = m.actualBoundingBoxAscent, dn = m.actualBoundingBoxDescent;
    const sx = Math.max(1, Math.min(i <= 2 ? 1.8 : 1.25, (0.84 * T) / (l + r)));
    g.save();
    g.translate(i * T + T / 2, T / 2); g.scale(sx, 1);
    const x = -(r - l) / 2, y = (up - dn) / 2;
    g.fillText(ch, x, y); g.strokeText(ch, x, y);
    g.restore();
  });
}

// ---------- 着色器 ----------
const QUAD_VS = /* glsl */ `
  in vec3 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const SEA_VS = /* glsl */ `
  precision highp float;
  in vec3 position;                 // 网格在海平面上的位置（y = 0）
  uniform mat4 projectionMatrix, viewMatrix;
  uniform vec3 cameraPosition;
  uniform vec4 uW[10];              // 方向 x、方向 z、波数 k、振幅 A
  uniform vec4 uWq[10];             // 尖的程度 Q、角频率 ω、波长
  uniform vec4 uRip[8];             // 涟漪：x、z、过了几秒、有没有
  uniform float uT, uAmax;
  out vec3 vPos, vN;
  out float vFoam;
  void main() {
    vec2 p = position.xz;
    float dist = length(p - cameraPosition.xz);
    vec3 P = vec3(p.x, 0.0, p.y);
    vec3 n = vec3(0.0, 1.0, 0.0);
    float jxx = 1.0, jzz = 1.0, jxz = 0.0;
    for (int i = 0; i < 10; i++) {
      vec2 D = uW[i].xy; float k = uW[i].z, Q = uWq[i].x, w = uWq[i].y;
      // 远处网格稀，短的波在那里会闪，按「网格间距和波长的比」淡掉
      float A = uW[i].w * smoothstep(0.0, 1.0, uWq[i].z / (0.06 * dist + 0.001) - 0.6);
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
      float front = 0.6 + 3.2 * age, x = r - front;
      float env = exp(-x * x / 1.2) * exp(-age / 1.3) * smoothstep(0.0, 0.15, age);
      float h = 0.5 * env * cos(3.6 * x), dh = -0.5 * env * 3.6 * sin(3.6 * x);
      P.y += h; n.xz -= dh * d / r; rip += env * (0.5 + 0.5 * cos(3.6 * x));   // 只算环的浪顶，环和环中间留着暗的
    }
    float J = jxx * jzz - jxz * jxz;
    vFoam = smoothstep(0.42, 0.12, J) + 0.6 * smoothstep(0.55, 0.95, P.y / uAmax) + 1.6 * rip;
    vPos = P; vN = n;
    gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
  }
`;

// 底稿：r 是亮度：浪顶比浪谷亮，迎着光的浪面、反光、亮点和白沫更亮，远处被雾抹到中间。
// g、b 是浪头在画面上的走向，存成二倍角（cos 2θ、sin 2θ）：一道横线转 180° 还是它，
// 二倍角一格取平均才不会正反抵消，平均下来越短说明这一格的方向越乱
const SEA_FS = /* glsl */ `
  precision highp float;
  in vec3 vPos, vN;
  in float vFoam;
  out vec4 o;
  uniform mat4 projectionMatrix, viewMatrix;
  uniform vec3 cameraPosition, uSunDir;
  uniform vec2 uAspect;             // 画布的宽、高（只看比例）
  uniform vec4 uS[8];               // 小波：方向 x、方向 z、k、A
  uniform float uSw[8];             // 小波的角频率
  uniform float uT, uAmax;
  void main() {
    vec3 V = cameraPosition - vPos; float dist = length(V); V /= dist;
    vec3 N = normalize(vN);
    // 细碎的小波只改法线；一个像素盖住的海面随距离变大，比它短的小波淡掉，不然排成一道道闪的条纹
    vec2 g = vec2(0.0);
    float foot = 0.0009 * dist * dist + 0.01;
    for (int i = 0; i < 8; i++) {
      float th = uS[i].z * dot(uS[i].xy, vPos.xz) - uSw[i] * uT;
      float keep = smoothstep(1.0, 3.0, 6.2831853 / uS[i].z / foot);
      g += uS[i].xy * uS[i].z * uS[i].w * cos(th) * keep;
    }
    N = normalize(N - vec3(g.x, 0.0, g.y) * 0.8);
    float diff = max(dot(N, uSunDir), 0.0);
    float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    float spec = pow(max(dot(reflect(-V, N), uSunDir), 0.0), 40.0);
    float h = clamp(vPos.y / uAmax, -1.0, 1.0) * 0.5 + 0.5;
    float L = 0.04 + 0.6 * h + 0.2 * diff + 0.25 * F + 0.6 * spec;
    L = mix(L, 1.0, clamp(vFoam, 0.0, 1.0) * 0.85);
    L = mix(L, 0.5, 1.0 - exp(-dist / 140.0));
    // 浪头的走向：海面上跟坡度垂直的方向（等高线），投到画面上。按坡度的平方算轻重：浪顶、浪谷是平的，方向说不准，几乎不算
    vec2 gh = -vN.xz;                                  // 高度对没推动前的位置的梯度：浪尖被挤尖的地方也不会被放大
    vec3 tw = vec3(-gh.y, 0.0, gh.x) / (length(gh) + 1e-6);
    vec4 p0 = projectionMatrix * viewMatrix * vec4(vPos, 1.0), p1 = projectionMatrix * viewMatrix * vec4(vPos + tw * 0.2, 1.0);
    vec2 sd = (p1.xy / p1.w - p0.xy / p0.w) * uAspect;   // 画面上的方向，左上角是原点
    sd.y = -sd.y;
    float m2 = dot(sd, sd);
    vec2 t2 = m2 > 1e-12 ? vec2(sd.x * sd.x - sd.y * sd.y, 2.0 * sd.x * sd.y) / m2 * min(dot(gh, gh) * 5.0, 1.0) : vec2(0.0);
    o = vec4(L, t2 * 0.5 + 0.5, 1.0);
  }
`;

const COMP_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uAtlas;
  uniform vec2 uRes;                // 画布，设备像素
  uniform float uCell, uLod, uN;    // 一格多少设备像素、取平均用的 mipmap 层、字有几个
  uniform vec2 uRange;              // 亮度从 x 到 y 铺满由淡到浓的字
  uniform vec3 uC0, uC1, uC2, uC3;  // 色带
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) * uCell / uRes;
    vec3 s = textureLod(uScene, vec2(c0.x, 1.0 - c0.y), uLod).rgb;
    // 字顺着浪头放；这一格的方向乱（二倍角平均下来很短）就横着放
    vec2 t2 = textureLod(uScene, vec2(c0.x, 1.0 - c0.y), uLod + 1.5).gb * 2.0 - 1.0;   // 方向取周围几格一起的，不跟着一格里的小起伏乱转
    float a = 0.5 * atan(t2.y, t2.x) * smoothstep(0.05, 0.25, length(t2));
    float lv = clamp((s.r - uRange.x) / (uRange.y - uRange.x) + (hash(cell) - 0.5) * 0.08, 0.0, 0.999);
    float gi = floor(lv * uN);
    vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
    vec2 q = vec2(cos(a) * loc.x + sin(a) * loc.y, -sin(a) * loc.x + cos(a) * loc.y);
    float ink = 0.0;
    if (abs(q.x) < 0.5 && abs(q.y) < 0.5) ink = texture(uAtlas, vec2((gi + q.x + 0.5) / uN, 0.5 - q.y)).r;
    o = vec4(ramp(lv) * ink, ink);   // 预乘过的透明度：字以外是透明的
  }
`;

// ---------- 引擎 ----------
/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ period?: number, cell?: number, fps?: number }} [opts]
 */
function create(canvas, { period = 12000, cell = 8, fps = 30 } = {}) {
  // 没有 WebGL2 时 three 会抛错，交给调用的人接
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
  renderer.autoClear = false;
  const software = softwareGL(renderer.getContext());
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let still = motion.matches || software;
  const flat = new THREE.Camera();
  const quad = new THREE.BufferGeometry();
  quad.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));

  // 镜头：11 米高，往前下方 40° 看，画面最上沿也落在海上，没有天
  const cam = new THREE.PerspectiveCamera(50, 2, 0.1, 1000);
  cam.position.set(0, 11, 6);
  cam.lookAt(0, 0, 6 - 11 / Math.tan((40 * Math.PI) / 180));
  cam.updateMatrixWorld();

  const { big, small } = makeWaves(period);
  const uT = { value: 0 };

  // 1. 海面：x 方向 300 格、z 方向 400 格，z 按指数铺（脚下密、远处疏），越远越宽，正好盖满画面。
  //    从镜头脚下往后一点开始铺，浪把网格前后推的时候边缘也露不出来
  const COLS = 300, ROWS = 400, NEAR = 1, FAR = 260, Z0 = 6;
  const pos = new Float32Array((COLS + 1) * (ROWS + 1) * 3), idx = [];
  for (let j = 0; j <= ROWS; j++) {
    const z = Z0 - NEAR * Math.pow(FAR / NEAR, j / ROWS) + 3, half = Math.abs(Z0 - z) * 1.3 + 10;
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
      uT, uAmax: { value: big.slice(0, 3).reduce((s, w) => s + w[3], 0) },
      uW: { value: big.map((w) => new THREE.Vector4(w[0], w[1], w[2], w[3])) },
      uWq: { value: big.map((w) => new THREE.Vector4(w[4], w[5], w[6], 0)) },
      uS: { value: small.map((w) => new THREE.Vector4(w[0], w[1], w[2], w[3])) },
      uSw: { value: small.map((w) => w[4]) },
      uRip: { value: rip },
      uSunDir: { value: new THREE.Vector3(0.25, 0.75, -1).normalize() },   // 光从正前方偏右的高处来
      uAspect: { value: new THREE.Vector2(1, 1) },
    },
  });
  const seaScene = new THREE.Scene();
  seaScene.add(Object.assign(new THREE.Mesh(seaGeo, seaMat), { frustumCulled: false }));
  let sceneRT = null;

  // 2. 合成
  const atlasCanvas = document.createElement("canvas");
  drawAtlas(atlasCanvas);
  const atlas = new THREE.CanvasTexture(atlasCanvas);
  atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.magFilter = THREE.LinearFilter; atlas.generateMipmaps = true;
  const compMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: QUAD_VS, fragmentShader: COMP_FS, depthTest: false, depthWrite: false,
    uniforms: {
      uScene: { value: null }, uAtlas: { value: atlas }, uRes: { value: new THREE.Vector2(1, 1) }, uCell: { value: cell }, uLod: { value: 3 }, uN: { value: GLYPHS.length },
      uRange: { value: new THREE.Vector2(0.25, 0.8) },
      uC0: { value: new THREE.Vector3() }, uC1: { value: new THREE.Vector3() }, uC2: { value: new THREE.Vector3() }, uC3: { value: new THREE.Vector3() },
    },
  });
  const compScene = new THREE.Scene();
  compScene.add(Object.assign(new THREE.Mesh(quad, compMat), { frustumCulled: false }));

  let W = 0, H = 0, dpr = 1, raf = 0, visible = true, last = -1e9, dead = false;

  function readTheme() {
    const R = RAMPS[getComputedStyle(canvas).colorScheme.includes("dark") ? "dark" : "light"];
    ["uC0", "uC1", "uC2", "uC3"].forEach((k, i) => compMat.uniforms[k].value.fromArray(R[i]));
  }
  function relayout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    sceneRT?.dispose();
    sceneRT = new THREE.WebGLRenderTarget(pw, ph, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: true });
    cam.aspect = W / H; cam.updateProjectionMatrix(); seaMat.uniforms.uAspect.value.set(W, H);
    compMat.uniforms.uScene.value = sceneRT.texture;
    compMat.uniforms.uRes.value.set(pw, ph);
    compMat.uniforms.uCell.value = cell * dpr;
    compMat.uniforms.uLod.value = Math.log2(cell * dpr) - 0.5;
    readTheme();
    paint(true);
  }

  // 鼠标、手指：从画面上那一点往海面投一条线，落点激起一圈涟漪。移动时每走 40px 或者每 120ms 一圈，最多同时 8 圈
  const ray = new THREE.Raycaster(), sea = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  let slot = 0, lastX = -1e9, lastY = -1e9, lastAt = -1e9;
  function splash(x, y) {
    ndc.set((x / W) * 2 - 1, 1 - (y / H) * 2);
    ray.setFromCamera(ndc, cam);
    if (!ray.ray.intersectPlane(sea, hit)) return;
    ripP[slot] = [hit.x, hit.z]; ripT[slot] = performance.now(); slot = (slot + 1) % rip.length;
    paint(true);
  }
  const at = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onMove = (e) => {
    if (still || !W) return;
    const [x, y] = at(e), now = performance.now(), moved = Math.hypot(x - lastX, y - lastY);
    if (moved < 6 || (moved < 40 && now - lastAt < 120)) return;
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
      const age = (now - ripT[k]) / 1000, on = age >= 0 && age < 5;
      rip[k].set(ripP[k][0], ripP[k][1], age, on ? 1 : 0);
      if (on) busy = true;
    }
    // 平时每秒 fps 帧；有涟漪时每帧都画，跟得上手
    if (!still && !busy && now - last < 1000 / fps - 2) { schedule(); return; }
    last = now;
    const u = still ? 0.05 : (((now % period) + period) % period) / period;   // 不动时停在跟封面差不多的那一刻
    uT.value = (u * period) / 1000;
    renderer.setRenderTarget(sceneRT); renderer.setClearColor(0x000000, 1); renderer.clear();
    renderer.render(seaScene, cam);
    renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(compScene, flat);
    if (!still || busy) schedule();
  }
  function schedule() { if (!raf && !dead && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  // force：马上画这一帧，不等限帧（尺寸、主题变了）
  function paint(force = false) { if (force) last = -1e9; schedule(); }

  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) paint(true); });
  io.observe(canvas);
  const ro = new ResizeObserver(() => relayout());
  ro.observe(canvas);
  const onVis = () => { if (!document.hidden) paint(true); };
  document.addEventListener("visibilitychange", onVis);
  const onMotion = () => { still = motion.matches || software; paint(true); };
  motion.addEventListener("change", onMotion);
  // 字的图集用网站的 DM Mono 画，字体晚到了重画一遍
  document.fonts?.load('400 54px "DM Mono"').then(() => document.fonts.load('500 54px "DM Mono"')).then(() => {
    if (dead) return;
    drawAtlas(atlasCanvas); atlas.needsUpdate = true; paint(true);
  }, () => {});

  relayout();
  return {
    splash() { if (!still && W) splash(W * (0.3 + Math.random() * 0.4), H * (0.55 + Math.random() * 0.3)); },
    refresh() { readTheme(); paint(true); },
    destroy() {
      dead = true; cancelAnimationFrame(raf); raf = 0;
      io.disconnect(); ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onVis);
      motion.removeEventListener("change", onMotion);
      sceneRT?.dispose(); seaGeo.dispose(); quad.dispose(); atlas.dispose();
      seaMat.dispose(); compMat.dispose();
      renderer.dispose();   // 上下文不强行丢掉：同一个 canvas 再挂一次（开发时 React 会挂两遍）还要用
    },
  };
}

export { create };
