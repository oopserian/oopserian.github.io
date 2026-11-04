/* 会流动的字符画（ASCII）草浪。Three.js 起三个全屏的 pass，每帧：

     1. 方向场（field）：一张 192×144 的小图，每格存「草往哪边倒」的向量和「倒得多平」（风头）。
        鱼群式：整片有一个慢慢左右摆的总方向，叠两层大小不同、慢慢漂的噪声，大片的草一起转向；
        鼠标划过的地方往外推、顺着划的方向带一下，过一会儿弹回去。
     2. 草叶（blades）：16 万根，一根一个实例。每根在底图上有自己的根，颜色取底图在根上的颜色，
        方向 = 方向场在根上的方向 + 自己的一点偏角 + 自己的摆动；风头过来时倒得更平（从上往下看更长、更亮）。
        一根草是 4 段的二次曲线，根粗尖细，根暗尖亮，顺着光的方向多一点反光。画到一张离屏的图上（带 mipmap）。
     3. 合成（composite）：Blades 模式直接显示草叶；ASCII 模式把画面切成 9px 一格，每格取草叶图的平均色，
        按亮度挑字（. : i ! l | 和粗的 |，亮处粗笔画、暗处细点），字按方向场在这一格的方向转过去（字跟着草叶转），
        叠在压暗的草叶上。两种模式换的时候从左往右扫过去。

   所有会动的都是 u（0~1，一圈 period 毫秒）的函数：噪声用「两份错开一圈的噪声交叉淡入淡出」的做法（跟 ASCII Clouds 一样），
   正弦都是整数圈，所以 u 走完一圈画面正好回到原样，录出来的视频首尾接得上。

   省着画：平时每秒 30 帧，鼠标拨草、换模式的那一会儿跟着屏幕刷新；滚出屏幕、切到别的标签页就停；
   系统开了「减弱动态效果」，或者显卡是 CPU 模拟的（没有能用的显卡、无头浏览器，画一帧要上百毫秒），只画一帧不动的，也不跟着鼠标动。

     const g = create(canvas, { count: 160000, period: 12000, cell: 9 });
     g.setMode("ascii" | "blades");   // 从左往右扫过去
     g.setImage(img);                 // 换底图（拖一张图进来）
     g.refresh();                     // 换了主题以后调：重新读深浅色和底色
     g.destroy();                     // 不用了：停下、摘掉监听、释放显存

   颜色：深浅色看 canvas 的 color-scheme；浅色时 ASCII 模式的底色是 canvas 外面那一层（父元素）的背景色。 */
import * as THREE from "three";

// ---------- 小工具 ----------
function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// CSS 颜色 → [r, g, b]（0~1）：交给 2D canvas 解析，什么写法都认
let probe = null;
function rgb(css) {
  probe ||= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#fff"; probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}

// 显卡是不是 CPU 在模拟：跟首屏字符画（src/scripts/ascii.ts）同一个判断
function softwareGL(gl) {
  let name = String(gl.getParameter(gl.RENDERER));
  if (/^webkit webgl$/i.test(name)) {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  }
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

// 默认的底图：画一张夏天的草地（深浅不一的绿、几块发黄的、左上来的阳光），每次都一样
function meadow(w = 720, h = 540) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"), r = rng(7);
  g.fillStyle = "#22401c"; g.fillRect(0, 0, w, h);
  const blob = (x, y, rad, col, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, col.replace("A", a)); gr.addColorStop(1, col.replace("A", 0));
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  const COLS = ["rgb(62 106 38 / A)", "rgb(93 138 46 / A)", "rgb(143 176 74 / A)", "rgb(30 58 26 / A)", "rgb(184 190 94 / A)", "rgb(120 150 60 / A)"];
  for (let i = 0; i < 160; i++) blob(r() * w, r() * h, 40 + r() * 150, COLS[Math.floor(r() * COLS.length)], 0.18 + r() * 0.3);
  // 几块干了发黄的
  for (let i = 0; i < 7; i++) blob(r() * w, r() * h, 50 + r() * 90, "rgb(201 179 106 / A)", 0.35);
  // 细纹理：一万多笔短短的草
  for (let i = 0; i < 14000; i++) {
    const x = r() * w, y = r() * h, a = -0.6 + (r() - 0.5) * 1.2, l = 4 + r() * 9, v = r();
    g.strokeStyle = v < 0.5 ? `rgb(20 40 18 / ${0.25 + r() * 0.3})` : `rgb(${150 + r() * 80} ${170 + r() * 60} ${80 + r() * 40} / ${0.12 + r() * 0.2})`;
    g.lineWidth = 0.6 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // 阳光从左上来，右下暗一点
  const sun = g.createLinearGradient(0, 0, w, h);
  sun.addColorStop(0, "rgb(255 240 180 / 0.20)"); sun.addColorStop(0.5, "rgb(255 240 180 / 0)"); sun.addColorStop(1, "rgb(0 20 10 / 0.35)");
  g.fillStyle = sun; g.fillRect(0, 0, w, h);
  return c;
}

// 字的图集：一行 8 格，0 是空的，往后越来越粗：. : i ! l | 粗|。字体用网站的 DM Mono
const GLYPHS = [" ", ".", ":", "i", "!", "l", "|", "|"];
function drawAtlas(c) {
  const T = 64, g = c.getContext("2d");
  c.width = T * GLYPHS.length; c.height = T;
  g.fillStyle = "#fff"; g.strokeStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  GLYPHS.forEach((ch, i) => {
    const bold = i === GLYPHS.length - 1;
    g.font = `${i >= 5 ? 500 : 400} 50px "DM Mono", ui-monospace, monospace`;
    // 让墨迹正好居中
    const m = g.measureText(ch), dy = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    g.fillText(ch, i * T + T / 2, T / 2 + dy);
    if (bold) { g.lineWidth = 5; g.strokeText(ch, i * T + T / 2, T / 2 + dy); }
  });
}

// ---------- 着色器 ----------
const NOISE = /* glsl */ `
  // 梯度噪声，-1~1
  vec2 h2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453) * 2.0 - 1.0; }
  float gnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(h2(i), f), dot(h2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
               mix(dot(h2(i + vec2(0, 1)), f - vec2(0, 1)), dot(h2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y) * 1.6;
  }
  // 一圈回到原样的噪声：花纹顺着 drift 漂，u 到 1 时正好回到 u = 0 的样子
  float loopN(vec2 p, vec2 drift, float u) {
    float a = gnoise(p + drift * u), b = gnoise(p + drift * (u - 1.0));
    return (a * (1.0 - u) + b * u) / sqrt((1.0 - u) * (1.0 - u) + u * u);
  }
`;

const QUAD_VS = /* glsl */ `
  in vec3 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FIELD_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform float uU, uAspect;
  uniform vec4 uTrail[12]; uniform float uTrailS[12];
  const float TAU = 6.2831853;
  ${NOISE}
  void main() {
    vec2 q = vec2(vUv.x, 1.0 - vUv.y), p = q * vec2(uAspect, 1.0);   // q：左上角是原点
    // 鱼群：整片的总方向慢慢左右摆（一圈里摆一次大的、两次小的），大块噪声让一大片一起转，小块噪声让相邻的几片略有不同
    float head = 0.7 * sin(TAU * uU) + 0.3 * sin(2.0 * TAU * uU + 1.3);
    float big = loopN(p * 1.15 + 3.1, vec2(0.85, 0.35), uU);
    float mid = loopN(p * 3.2 + 9.7, vec2(-0.55, 0.9), uU);
    float ang = -0.45 + head + 2.3 * big + 0.5 * mid;
    // 风头：一道道斜着往右下走的带子，一圈走两道；带子上的草倒得更平
    float g = 0.5 + 0.5 * sin(TAU * (dot(p, vec2(0.8, 0.45)) * 1.3 - 2.0 * uU) + 1.8 * big);
    g = 0.25 + 0.75 * smoothstep(0.2, 0.95, g);
    vec2 v = vec2(cos(ang), sin(ang));
    // 鼠标划过：往外推，顺着划的方向带一下，倒得更平
    for (int k = 0; k < 12; k++) {
      float s = uTrailS[k];
      if (s < 0.002) continue;
      vec2 d = p - uTrail[k].xy * vec2(uAspect, 1.0);
      float f = exp(-dot(d, d) / 0.006) * s;
      v += (normalize(d + 1e-5) * 1.6 + uTrail[k].zw * 1.4) * f;
      g += 0.5 * f;
    }
    o = vec4(normalize(v + 1e-5), min(g, 1.2), 1.0);
  }
`;

const BLADE_VS = /* glsl */ `
  precision highp float;
  in vec3 position;          // x：沿着草叶 0~1，y：左右 -1 / 1
  in vec2 iRoot;             // 根在画面里的位置，0~1，左上角是原点
  in vec4 iP;                // 长、宽（CSS 像素）、自己的偏角、自己的相位
  in vec2 iV;                // 自己的亮度、弯曲
  uniform sampler2D uField, uImage;
  uniform vec2 uSize;        // 画布 CSS 像素
  uniform vec4 uImgMap;      // 画面 0~1 → 底图 uv（铺满裁掉多的）
  uniform float uU;
  uniform vec2 uLight;
  out vec3 vCol;
  void main() {
    float t = position.x;
    vec4 f = texture(uField, vec2(iRoot.x, 1.0 - iRoot.y));
    // 自己的摆动：一圈摆 3 次，相位各不相同
    float own = iP.z + 0.22 * sin(6.2831853 * (3.0 * uU + iP.w));
    float a0 = atan(f.y, f.x) + own;
    float a1 = a0 + iV.y;                                        // 尖上再弯一点
    float len = iP.x * (0.45 + 0.65 * f.z);                      // 风头上倒得平，从上往下看更长
    vec2 root = iRoot * uSize, d0 = vec2(cos(a0), sin(a0)), d1 = vec2(cos(a1), sin(a1));
    vec2 P1 = root + d0 * len * 0.55, P2 = root + d1 * len;
    vec2 pt = mix(mix(root, P1, t), mix(P1, P2, t), t);
    vec2 tg = normalize(mix(P1 - root, P2 - P1, t) + 1e-5);
    float w = iP.y * pow(1.0 - t, 0.75);
    pt += vec2(-tg.y, tg.x) * position.y * 0.5 * w;
    // 颜色：底图在根上的颜色，根暗尖亮，顺着光的那几根亮一点（大片一起转向时就是一阵一阵的亮）
    vec3 img = texture(uImage, vec2(uImgMap.x + iRoot.x * uImgMap.z, 1.0 - (uImgMap.y + iRoot.y * uImgMap.w))).rgb;
    float sheen = pow(max(0.0, dot(tg, uLight)), 3.0);
    vCol = img * iV.x * (0.42 + 0.78 * t) * (0.62 + 0.5 * f.z) + vec3(0.95, 0.97, 0.8) * sheen * 0.3 * t * f.z;
    gl_Position = vec4(pt.x / uSize.x * 2.0 - 1.0, 1.0 - pt.y / uSize.y * 2.0, 0.0, 1.0);
  }
`;
const BLADE_FS = /* glsl */ `
  precision highp float;
  in vec3 vCol; out vec4 o;
  void main() { o = vec4(vCol, 1.0); }
`;

const COMP_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBlades, uField, uAtlas;
  uniform vec2 uRes;          // 画布设备像素
  uniform float uCell;        // 一格多少设备像素
  uniform float uLod;         // 取一格平均色用的 mipmap 层
  uniform float uFrom, uTo, uP;   // 换模式：0 草叶、1 ASCII，uP 是扫到哪了（0~1）
  uniform float uDark;
  uniform vec3 uBg;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec3 blades = texture(uBlades, vUv).rgb;
    // 这一格：草叶的平均色、方向场的方向
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) * uCell / uRes;
    vec3 col = textureLod(uBlades, vec2(c0.x, 1.0 - c0.y), uLod).rgb;
    vec4 f = texture(uField, vec2(c0.x, 1.0 - c0.y));
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    // 亮度挑字：亮处粗笔画，暗处细点；每格抖一点，字的分界不排成一条条带子
    float lv = clamp((lum - 0.07) / 0.3 + (hash(cell) - 0.5) * 0.18, 0.0, 0.999);
    float gi = floor(1.0 + lv * 7.0);
    if (lum < 0.035) gi = 0.0;
    // 字转到草叶的方向：字竖着的那根轴对准方向场
    vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
    float a = atan(f.y, f.x) - 1.5707963;
    vec2 q = vec2(cos(a) * loc.x + sin(a) * loc.y, -sin(a) * loc.x + cos(a) * loc.y);
    float ink = 0.0;
    if (abs(q.x) < 0.5 && abs(q.y) < 0.5) ink = texture(uAtlas, vec2((gi + q.x + 0.5) / 8.0, 0.5 - q.y)).r;
    vec3 ascii;
    if (uDark > 0.5) {
      vec3 gc = col * 1.9 + vec3(0.03, 0.04, 0.01);
      ascii = mix(blades * 0.28, gc, ink);
    } else {
      vec3 gc = col * 0.85;
      ascii = mix(mix(uBg, blades, 0.1), gc, ink);
    }
    // 换模式：从左往右扫过去，边缘留一段渐变
    float k = clamp((uP * 1.25 - vUv.x) / 0.25, 0.0, 1.0);
    float m = mix(uFrom, uTo, k);
    o = vec4(mix(blades, ascii, m), 1.0);
  }
`;

// ---------- 引擎 ----------
/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ count?: number, period?: number, cell?: number, fps?: number }} [opts]
 */
function create(canvas, { count = 160000, period = 12000, cell = 9, fps = 30 } = {}) {
  // 没有 WebGL2 时 three 会抛错，交给调用的人接
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  const software = softwareGL(renderer.getContext());
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let still = motion.matches || software;
  const cam = new THREE.Camera();
  const quad = new THREE.BufferGeometry();
  quad.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const pass = (mat) => { const s = new THREE.Scene(); s.add(Object.assign(new THREE.Mesh(quad, mat), { frustumCulled: false })); return s; };

  // 1. 方向场
  const FW = 192, FH = 144;
  const fieldRT = new THREE.WebGLRenderTarget(FW, FH, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const trail = Array.from({ length: 12 }, () => new THREE.Vector4(-9, -9, 0, 0)), trailS = new Array(12).fill(0), trailT = new Array(12).fill(-1e9);
  const fieldMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: QUAD_VS, fragmentShader: FIELD_FS, depthTest: false, depthWrite: false,
    uniforms: { uU: { value: 0 }, uAspect: { value: 4 / 3 }, uTrail: { value: trail }, uTrailS: { value: trailS } },
  });
  const fieldScene = pass(fieldMat);

  // 2. 草叶：一根 4 段，10 个点、8 个三角形
  const SEG = 4, base = [], idx = [];
  for (let s = 0; s <= SEG; s++) base.push(s / SEG, -1, 0, s / SEG, 1, 0);
  for (let s = 0; s < SEG; s++) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(base, 3)); geo.setIndex(idx);
  const r = rng(20261104), root = new Float32Array(count * 2), P = new Float32Array(count * 4), V = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    root[i * 2] = r() * 1.04 - 0.02; root[i * 2 + 1] = r() * 1.04 - 0.02;
    P[i * 4] = 9 + 15 * Math.pow(r(), 0.8); P[i * 4 + 1] = 1.2 + 1.2 * r();
    P[i * 4 + 2] = (r() + r() + r() - 1.5) * 0.55; P[i * 4 + 3] = r();
    V[i * 2] = 0.78 + 0.44 * r(); V[i * 2 + 1] = (r() - 0.5) * 0.7;
  }
  geo.setAttribute("iRoot", new THREE.InstancedBufferAttribute(root, 2));
  geo.setAttribute("iP", new THREE.InstancedBufferAttribute(P, 4));
  geo.setAttribute("iV", new THREE.InstancedBufferAttribute(V, 2));
  geo.instanceCount = count;
  const imgTex = new THREE.CanvasTexture(meadow());
  imgTex.minFilter = THREE.LinearMipmapLinearFilter; imgTex.generateMipmaps = true;
  const bladeMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: BLADE_VS, fragmentShader: BLADE_FS, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uField: { value: fieldRT.texture }, uImage: { value: imgTex }, uSize: { value: new THREE.Vector2(1, 1) }, uImgMap: { value: new THREE.Vector4(0, 0, 1, 1) }, uU: { value: 0 }, uLight: { value: new THREE.Vector2(-0.6, -0.8) } },
  });
  const bladeScene = new THREE.Scene(); bladeScene.add(Object.assign(new THREE.Mesh(geo, bladeMat), { frustumCulled: false }));
  bladeScene.background = new THREE.Color(0x0f1a0c);
  let bladeRT = null;

  // 3. 合成
  const atlasCanvas = document.createElement("canvas");
  drawAtlas(atlasCanvas);
  const atlas = new THREE.CanvasTexture(atlasCanvas);
  atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.magFilter = THREE.LinearFilter; atlas.generateMipmaps = true;
  const compMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: QUAD_VS, fragmentShader: COMP_FS, depthTest: false, depthWrite: false,
    uniforms: { uBlades: { value: null }, uField: { value: fieldRT.texture }, uAtlas: { value: atlas }, uRes: { value: new THREE.Vector2(1, 1) }, uCell: { value: cell }, uLod: { value: 3 },
      uFrom: { value: 1 }, uTo: { value: 1 }, uP: { value: 1 }, uDark: { value: 1 }, uBg: { value: new THREE.Vector3(1, 1, 1) } },
  });
  const compScene = pass(compMat);

  let W = 0, H = 0, dpr = 1, img = imgTex.image, mode = "ascii", sw = { t0: -1e9, from: 1, to: 1 }, raf = 0, visible = true, last = -1e9, dead = false;
  const SWEEP = 900;

  function fitImage() {
    // 底图铺满画布，多的裁掉
    const ia = img.width / img.height, ca = W / H, m = bladeMat.uniforms.uImgMap.value;
    if (ia > ca) { const s = ca / ia; m.set((1 - s) / 2, 0, s, 1); } else { const s = ia / ca; m.set(0, (1 - s) / 2, 1, s); }
  }
  function readTheme() {
    const dark = getComputedStyle(canvas).colorScheme.includes("dark");
    compMat.uniforms.uDark.value = dark ? 1 : 0;
    const bg = rgb(canvas.parentElement ? getComputedStyle(canvas.parentElement).backgroundColor : "#fff");
    compMat.uniforms.uBg.value.set(bg[0], bg[1], bg[2]);
  }
  function relayout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    bladeRT?.dispose();
    bladeRT = new THREE.WebGLRenderTarget(pw, ph, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false });
    compMat.uniforms.uBlades.value = bladeRT.texture;
    compMat.uniforms.uRes.value.set(pw, ph);
    compMat.uniforms.uCell.value = cell * dpr;
    compMat.uniforms.uLod.value = Math.log2(cell * dpr) - 0.5;
    bladeMat.uniforms.uSize.value.set(W, H);
    fieldMat.uniforms.uAspect.value = W / H;
    readTheme();
    fitImage();
    paint(true);
  }

  // 鼠标、手指：记最近 12 个位置（移动超过 4px 才记一个），每个随时间淡掉。点一下是原地往外推开一圈
  let lastX = -1, lastY = -1, slot = 0;
  function push(x, y, dx, dy) {
    const l = Math.hypot(dx, dy) || 1;
    trail[slot].set(x / W, y / H, dx / l, dy / l); trailT[slot] = performance.now(); slot = (slot + 1) % trail.length;
    paint(true);
  }
  const at = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onMove = (e) => {
    if (still || !W) return;
    const [x, y] = at(e);
    if (lastX >= 0 && Math.hypot(x - lastX, y - lastY) < 4) return;
    push(x, y, lastX < 0 ? 0 : x - lastX, lastX < 0 ? 0 : y - lastY);
    lastX = x; lastY = y;
  };
  const onDown = (e) => { if (still || !W) return; const [x, y] = at(e); lastX = x; lastY = y; push(x, y, 0, 0); };
  const onLeave = () => { lastX = lastY = -1; };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointercancel", onLeave);

  function frame(now) {
    raf = 0;
    if (dead || !W || !bladeRT) return;
    let busy = false;
    for (let k = 0; k < trail.length; k++) { trailS[k] = Math.exp(-(now - trailT[k]) / 520); if (trailS[k] > 0.002) busy = true; }
    const p = Math.min(1, Math.max(0, (now - sw.t0) / SWEEP)), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    if (p < 1) busy = true;
    // 平时每秒 fps 帧；拨草、换模式时每帧都画，跟得上手
    if (!still && !busy && now - last < 1000 / fps - 2) { schedule(); return; }
    last = now;
    const u = still ? 0.05 : (((now % period) + period) % period) / period;   // 不动时停在草叶已经转开的一刻
    fieldMat.uniforms.uU.value = u; bladeMat.uniforms.uU.value = u;
    compMat.uniforms.uFrom.value = sw.from; compMat.uniforms.uTo.value = sw.to; compMat.uniforms.uP.value = e;
    renderer.setRenderTarget(fieldRT); renderer.render(fieldScene, cam);
    renderer.setRenderTarget(bladeRT); renderer.render(bladeScene, cam);
    renderer.setRenderTarget(null); renderer.render(compScene, cam);
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
  function setImage(im) { img = im; imgTex.image = im; imgTex.needsUpdate = true; fitImage(); paint(true); }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) paint(true); });
  io.observe(canvas);
  const ro = new ResizeObserver(() => relayout());
  ro.observe(canvas);
  const onVis = () => { if (!document.hidden) paint(true); };
  document.addEventListener("visibilitychange", onVis);
  const onMotion = () => { still = motion.matches || software; paint(true); };
  motion.addEventListener("change", onMotion);
  // 字的图集用网站的 DM Mono 画，字体晚到了重画一遍
  document.fonts?.load('400 50px "DM Mono"').then(() => document.fonts.load('500 50px "DM Mono"')).then(() => {
    if (dead) return;
    drawAtlas(atlasCanvas); atlas.needsUpdate = true; paint(true);
  }, () => {});

  relayout();
  return {
    setMode, setImage,
    refresh() { readTheme(); paint(true); },
    get mode() { return mode; },
    get still() { return still; },
    count,
    destroy() {
      dead = true; cancelAnimationFrame(raf); raf = 0;
      io.disconnect(); ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointercancel", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      motion.removeEventListener("change", onMotion);
      fieldRT.dispose(); bladeRT?.dispose(); geo.dispose(); quad.dispose(); imgTex.dispose(); atlas.dispose();
      fieldMat.dispose(); bladeMat.dispose(); compMat.dispose();
      renderer.dispose();   // 上下文不强行丢掉：同一个 canvas 再挂一次（开发时 React 会挂两遍）还要用
    },
  };
}

export { create };
