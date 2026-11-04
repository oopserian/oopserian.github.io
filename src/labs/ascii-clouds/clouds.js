/* 用字符画（ASCII）画的云。WebGL2 着色器在离屏图里实时画一片立体的积云，只当底稿，屏幕上只有字。每帧三步：

     1. 云量（coverage）：一张 512×256 的小图，盖住镜头看得到的那一大片天（左右各 60 公里、往前 62 公里），
        每个点存这里有多少云（几层值噪声叠起来）。云顺着风往镜头这边飘，一圈 period 正好飘一段；
        为了首尾接得上，同一份噪声错开一段取两次、按时间交叉淡入淡出，再把被平均掉的对比度拉回来，云就像延时摄影那样边飘边变。
     2. 云（clouds）：镜头站在地上往前上方看，画面最下沿刚好是地平线，整块都是天。每个像素往天上打一条光线，
        在 1 到 2.6 公里高的云层里走 48 步：云底平、云顶圆（云越厚顶越高），再用一张 32³ 的立体噪声（几层 Worley 反过来，
        一团一团鼓起来的）把边咬碎；每步往太阳那边再取三个点，算这里被挡掉多少光，加上天光，远处被雾抹成地平线的颜色。
        这张图只画到「一格两个像素」那么细（字一格 8px，再细也看不出来），比整屏画便宜几十倍。
        底稿存颜色和这一格有多少云。
     3. 合成（composite）：整块切成 8px 见方的格子，每格都有字，不留空：
        按这一格的亮度从 . : - = + * # % @ 里挑（越亮越浓），天是淡的点，云是浓的字；
        字顺着明暗的等高线转，云边一圈的字绕着云走，跟海浪里字顺着浪头转是一个做法。
        深色主题是黄昏：太阳贴着地平线，云被照成金色、粉色，背光的地方是紫的，字就用底稿的颜色；
        浅色主题是白天：太阳在身后，蓝天白云，字照 ASCII Waves 的规矩按浓淡上墨，越浓墨越深，云是一团深蓝的字，不是白底上的洞。
        画布是透明的，字以外露出网页自己的底色，所以铺满整块也跟网站接得上。

   鼠标、手指划过：从画面上那一点往天上打一条线，在它穿进云层的地方把云拨开一个洞，洞跟着风飘，三四秒后合上；划过去是一道沟。

   所有会动的都是 t（一圈 period 毫秒）的函数，录出来的视频首尾接得上。
   省着画：平时每秒 30 帧，有洞的那一会儿跟着屏幕刷新；滚出屏幕、切到别的标签页就停；
   系统开了「减弱动态效果」，或者显卡是 CPU 模拟的（没有能用的显卡、无头浏览器），只画一帧不动的，也不跟着鼠标动。

     const c = create(canvas, { period: 12000 });
     c.splash();                     // 在云上随便一处拨开一个洞（键盘用）
     c.refresh();                    // 换了主题以后调：白天、黄昏换过来
     c.destroy();                    // 不用了：停下、摘掉监听、释放显存 */
import { context, program, fullscreen, target, canvasTexture, softwareGL } from "../_kit/gl.js";

function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// 天和光，两套。sun 是太阳的方向（镜头朝 -z 看），disc 是太阳画不画出来。
// ink 是浅色主题字的墨：由淡的字到浓的字四个颜色（深色主题字直接用底稿的颜色）
const SKIES = {
  day: {
    sun: [-0.45, 0.62, 0.65], sunCol: [1.6, 1.55, 1.45], disc: 0,
    zenith: [0.2, 0.42, 0.82], mid: [0.42, 0.62, 0.9], horizon: [0.72, 0.82, 0.94], glow: [0, 0, 0],
    ambTop: [0.62, 0.74, 0.95], ambBot: [0.38, 0.47, 0.66],
    ink: [[0.62, 0.72, 0.84], [0.36, 0.53, 0.78], [0.16, 0.32, 0.62], [0.05, 0.12, 0.3]],
  },
  dusk: {
    sun: [0.75, -0.03, -1], sunCol: [2.6, 1.15, 0.55], disc: 0,
    zenith: [0.07, 0.07, 0.2], mid: [0.42, 0.24, 0.42], horizon: [1.0, 0.5, 0.3], glow: [1.0, 0.62, 0.32],
    ambTop: [0.24, 0.2, 0.42], ambBot: [0.34, 0.17, 0.28],
    ink: null,
  },
};

// ---------- 云的细节：32³ 的立体噪声 ----------
// 三层周期的 Worley（到最近一个随机点的距离）反过来叠起来：一团一团鼓起来，像积云的边。四周首尾相接，可以平铺
function makeDetail(n = 32) {   // 返回 { data, n }，传给显卡见 create()
  const worley = (cells, seed) => {
    const r = rng(seed), pts = new Float32Array(cells * cells * cells * 3);
    for (let i = 0; i < pts.length; i++) pts[i] = r();
    const wrap = (v) => ((v % cells) + cells) % cells;
    return (x, y, z) => {
      const fx = x * cells, fy = y * cells, fz = z * cells, ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
      let best = 9;
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx, cy = iy + dy, cz = iz + dz, k = ((wrap(cz) * cells + wrap(cy)) * cells + wrap(cx)) * 3;
        const ex = cx + pts[k] - fx, ey = cy + pts[k + 1] - fy, ez = cz + pts[k + 2] - fz, d = ex * ex + ey * ey + ez * ez;
        if (d < best) best = d;
      }
      return Math.sqrt(best);
    };
  };
  const w1 = worley(3, 11), w2 = worley(6, 23), w3 = worley(12, 37);
  const v = new Float32Array(n * n * n);
  let lo = 9, hi = -9;
  for (let z = 0, i = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++, i++) {
    const a = x / n, b = y / n, c = z / n;
    v[i] = (1 - w1(a, b, c)) * 0.6 + (1 - w2(a, b, c)) * 0.27 + (1 - w3(a, b, c)) * 0.13;
    lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]);
  }
  const data = new Uint8Array(n * n * n);
  for (let i = 0; i < v.length; i++) data[i] = Math.round(((v[i] - lo) / (hi - lo)) * 255);
  return { data, n };
}

// ---------- 字的图集 ----------
// 一行 9 格，一格 64 见方（字要转，格子得是正方形），由淡到浓：. : - = + * # % @。每个字按墨迹居中，横线稍微拉宽一点，再描一圈边，笔画粗一点
const GLYPHS = [".", ":", "-", "=", "+", "*", "#", "%", "@"];
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
    const sx = ch === "-" || ch === "=" ? Math.max(1, Math.min(1.5, (0.8 * T) / (l + r))) : 1;
    g.save();
    g.translate(i * T + T / 2, T / 2); g.scale(sx, 1);
    const x = -(r - l) / 2, y = (up - dn) / 2;
    g.fillText(ch, x, y); g.strokeText(ch, x, y);
    g.restore();
  });
}

// ---------- 着色器 ----------
const QUAD_VS = /* glsl */ `
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const NOISE = /* glsl */ `
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;

// 1. 云量：uDomain 是这张图盖住的那块地（x0、z0、宽、深，公里）
const COV_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform float uU;                 // 一圈走到哪了，0~1
  uniform vec2 uDrift;              // 一圈飘多远（公里）
  uniform vec4 uDomain;
  ${NOISE}
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return s / 0.96875; }
  void main() {
    vec2 p = uDomain.xy + vUv * uDomain.zw;
    float a = fbm((p - uDrift * uU) * 0.32), b = fbm((p - uDrift * (uU - 1.0)) * 0.32);   // 一团云三公里上下
    float m = 0.5 + (mix(a, b, uU) - 0.5) / sqrt((1.0 - uU) * (1.0 - uU) + uU * uU);
    o = vec4(m, 0.0, 0.0, 1.0);
  }
`;

// 2. 云：往天上打光线，在云层里一步步走，按挡掉的光和天光给颜色。a 存这一格有多少云
const CLOUD_FS = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uCov;
  uniform sampler3D uDetail;
  uniform vec4 uDomain;
  uniform vec3 uF, uR, uUp;         // 镜头往前、往右、往上
  uniform vec2 uTan;                // 画面右沿、上沿离中间多远（tan）
  uniform vec3 uSun, uSunCol, uZenith, uMid, uHorizon, uGlow, uAmbTop, uAmbBot;
  uniform float uDisc;
  uniform vec3 uDScale, uDOff;      // 细节噪声的缩放、这一刻的偏移（跟着风走，一圈正好整数个周期）
  uniform vec4 uHole[8];            // 拨开的洞：从镜头看过去的方向 xyz，过了几秒（< 0 是没有）
  uniform float uHoleR[8];          // 洞的半径（视线偏开多少弧度）
  const float BASE = 1.0, TOP = 2.6, TMAX = 70.0;
  ${NOISE}
  vec3 sky(vec3 rd) {
    float e = clamp(rd.y, 0.0, 1.0);
    vec3 c = e < 0.12 ? mix(uHorizon, uMid, e / 0.12) : mix(uMid, uZenith, pow(max(e - 0.12, 0.0) / 0.88, 0.6));   // pow 的底不能是负的
    float s = max(dot(rd, uSun), 0.0);
    return c + uGlow * (0.3 * pow(s, 6.0) + 0.6 * pow(s, 60.0)) + uSunCol * uDisc * smoothstep(0.9990, 0.9995, s);
  }
  float density(vec3 p, bool fine) {
    float h = (p.y - BASE) / (TOP - BASE);
    vec2 uv = (p.xz - uDomain.xy) / uDomain.zw;
    if (h <= 0.0 || h >= 1.0 || uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return 0.0;
    float c = smoothstep(0.44, 0.66, texture(uCov, uv).r);
    float d = c * smoothstep(0.0, 0.06, h) - h * h * 1.1 - 0.04;     // 云底平、云顶圆：云越厚顶越高
    if (fine) d -= (1.0 - texture(uDetail, p * uDScale + uDOff).r) * 0.34;
    d = clamp(d * 4.0, 0.0, 1.0);
    if (d <= 0.0) return 0.0;
    // 拨开的洞：从镜头看过去，那个方向附近一圈的云都推开，透出后面的天。洞的边按细一点的噪声咬得参差，不是正圆；
    // 半径先一下子张开、再慢慢缩回去（JS 里算好传进来），像云又流回来
    float cut = 0.0, rag = -1.0;
    vec3 pn = normalize(p);
    for (int i = 0; i < 8; i++) {
      float r = uHoleR[i];
      if (uHole[i].w < 0.0 || r < 0.002) continue;
      float th = sqrt(2.0 * max(1.0 - dot(pn, uHole[i].xyz), 0.0));
      if (th > r * 1.7) continue;
      if (rag < 0.0) rag = 0.6 + 0.8 * texture(uDetail, (p * uDScale + uDOff) * 3.0).r;   // 离洞近才取，平时不多花
      cut = max(cut, 1.0 - smoothstep(r * 0.5, r, th * rag));
    }
    return d * (1.0 - cut);
  }
  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 rd = normalize(uF + uR * ndc.x * uTan.x + uUp * ndc.y * uTan.y);
    vec3 col = vec3(0.0); float Tr = 1.0;
    if (rd.y > 0.002) {
      float t0 = BASE / rd.y, t1 = min(TOP / rd.y, TMAX);
      if (t0 < TMAX) {
        float dt = (t1 - t0) / 48.0, t = t0 + dt * h21(gl_FragCoord.xy);
        float cosA = dot(rd, uSun);
        float phase = 0.55 + 1.4 * pow(max(cosA, 0.0), 10.0);       // 背着太阳看是散开的光，迎着太阳看云边一圈亮
        for (int i = 0; i < 48; i++) {
          vec3 p = rd * t;
          float d = density(p, true);
          if (d > 0.002) {
            float od = density(p + uSun * 0.1, false) * 0.1 + density(p + uSun * 0.3, false) * 0.2 + density(p + uSun * 0.7, false) * 0.4;
            float h = (p.y - BASE) / (TOP - BASE);
            vec3 L = uSunCol * exp(-od * 3.0) * phase * (1.0 - exp(-d * 5.0)) + mix(uAmbBot, uAmbTop, h) * (0.45 + 0.55 * h);
            L = mix(L, uHorizon, 1.0 - exp(-t / 45.0));                 // 远处被雾抹成地平线的颜色
            float tr = exp(-d * 6.0 * dt);
            col += Tr * (1.0 - tr) * L;
            Tr *= tr;
            if (Tr < 0.03) break;
          }
          t += dt;
        }
      }
    }
    col += Tr * sky(rd);
    o = vec4(1.0 - exp(-col * 1.4), 1.0 - Tr);
  }
`;

// 3. 合成
const COMP_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uAtlas;
  uniform vec2 uRes, uCells;        // 画布（设备像素）、一共多少格
  uniform float uCell, uN;          // 一格多少设备像素、字有几个
  uniform vec4 uRange;              // 天的亮度从 x 到 y、云的亮度从 z 到 w
  uniform float uInk;               // 1：浅色主题，按浓淡上墨；0：深色主题，用底稿的颜色
  uniform vec3 uC0, uC1, uC2, uC3;  // 浅色主题的墨
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  float lum(vec3 c) { return dot(c, vec3(0.3, 0.55, 0.15)); }
  vec4 at(vec2 cell, float lod) { return textureLod(uScene, vec2((cell.x + 0.5) / uCells.x, 1.0 - (cell.y + 0.5) / uCells.y), lod); }
  // 这一格该多浓（0~1）：天只用最淡的三个字 . : -，越亮越浓；云用后面的 = + * # % @，也是越亮越浓
  float level(vec4 s) {
    float L = lum(s.rgb);
    float sky = clamp((L - uRange.x) / (uRange.y - uRange.x), 0.0, 1.0) * 0.32;
    float cloud = 0.36 + 0.64 * clamp((L - uRange.z) / (uRange.w - uRange.z), 0.0, 1.0);
    return mix(sky, cloud, smoothstep(0.2, 0.65, s.a));
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell);
    vec4 s = at(cell, 1.0);                                       // 底稿一格两个像素，第 1 层 mipmap 正好一格一个
    // 字顺着浓淡的等高线放：左右、上下隔一格的浓淡差是变化最快的方向，字跟它垂直，云边一圈的字就绕着云走；
    // 变化很小（天的大部分、云的里面）就横着放。浓淡卡在头上（最亮的云）时四周一样，g 正好是 0：
    // atan(0, 0) 规范里没定义，有的显卡算出 NaN，整格就没字了，所以先换成一个横着的方向
    vec2 g = vec2(level(at(cell + vec2(1.0, 0.0), 1.5)) - level(at(cell - vec2(1.0, 0.0), 1.5)), level(at(cell + vec2(0.0, 1.0), 1.5)) - level(at(cell - vec2(0.0, 1.0), 1.5)));
    vec2 gs = dot(g, g) > 1e-12 ? g : vec2(0.0, -1.0);
    float a = atan(gs.x, -gs.y);
    a = mod(a + 1.5707963, 3.1415926) - 1.5707963;
    a *= smoothstep(0.03, 0.12, length(g));
    float lv = clamp(level(s) + (hash(cell) - 0.5) * 0.06, 0.0, 0.999);
    float gi = floor(lv * uN);
    // 颜色：深色主题取底稿的色相，亮度跟着字的浓淡走，最淡的也看得见；浅色主题按浓淡上墨
    vec3 hue = s.rgb / max(max(s.r, s.g), max(s.b, 0.02));
    vec3 col = mix(hue * (0.4 + 0.65 * lv), ramp(lv), uInk);
    vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
    vec2 q = vec2(cos(a) * loc.x + sin(a) * loc.y, -sin(a) * loc.x + cos(a) * loc.y);
    float ink = 0.0;
    if (abs(q.x) < 0.5 && abs(q.y) < 0.5) ink = texture(uAtlas, vec2((gi + q.x + 0.5) / uN, 0.5 - q.y)).r;
    o = vec4(col * ink, ink);   // 预乘过的透明度：字以外是透明的
  }
`;

// ---------- 引擎 ----------
/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ period?: number, cell?: number, fps?: number }} [opts]
 */
function create(canvas, { period = 12000, cell = 8, fps = 30 } = {}) {
  const gl = context(canvas);   // 没有 WebGL2 就抛错，交给调用的人接
  const software = softwareGL(gl);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let still = motion.matches || software;
  const tri = fullscreen(gl);
  const covP = program(gl, QUAD_VS, COV_FS), cloudP = program(gl, QUAD_VS, CLOUD_FS), compP = program(gl, QUAD_VS, COMP_FS);

  // 风：一圈往右飘 1.5 公里、往镜头这边飘 4 公里。细节噪声按这段距离缩放，一圈正好走整数个周期（右 1 个、前 3 个）
  const DRIFT = [1.5, 4.0], DOMAIN = [-60, -62, 120, 64];
  const dScale = [1 / DRIFT[0], 0.7, 3 / DRIFT[1]];
  const wind = [DRIFT[0] / (period / 1000), DRIFT[1] / (period / 1000)];   // 每秒飘多远

  // 镜头：站在地上，往前上方看，画面最下沿比地平线高 1°
  const FOV = 40, pitch = ((FOV / 2 + 1) * Math.PI) / 180, tanY = Math.tan(((FOV / 2) * Math.PI) / 180);
  const camF = [0, Math.sin(pitch), -Math.cos(pitch)], camR = [1, 0, 0], camU = [0, Math.cos(pitch), Math.sin(pitch)];

  const covRT = target(gl, 512, 256);
  const { data, n } = makeDetail();
  const detail = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, detail);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, n, n, n, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // 拨开的洞：在天上的位置（跟着风飘），每帧换算成从镜头看过去的方向和过了几秒、半径
  const HOLE_LIFE = 3.6;   // 一个洞从张开到合上几秒
  const holes = new Float32Array(32).fill(-1), holeR = new Float32Array(8).fill(0.1), holeAt = new Array(8).fill(-1e9), holeP = Array.from({ length: 8 }, () => [0, 0, 0]);
  let sceneRT = null, cols = 1, rows = 1;

  const atlasCanvas = document.createElement("canvas");
  drawAtlas(atlasCanvas);
  const atlas = canvasTexture(gl, atlasCanvas);

  let W = 0, H = 0, dpr = 1, raf = 0, visible = true, last = -1e9, dead = false, sky = SKIES.day, dark = false;

  // 主题：浅色是白天，深色是黄昏
  function readTheme() {
    dark = getComputedStyle(canvas).colorScheme.includes("dark");
    sky = SKIES[dark ? "dusk" : "day"];
  }
  const sunDir = () => { const [x, y, z] = sky.sun, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
  function relayout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    cols = Math.ceil(W / cell); rows = Math.ceil(H / cell);
    sceneRT?.dispose();
    // 底稿一格两个像素：第 1 层 mipmap 正好一格一个，取平均不用自己算
    sceneRT = target(gl, cols * 2, rows * 2, { mipmaps: true });
    readTheme();
    paint(true);
  }

  // 画面上一点 → 往天上那条视线的方向。画面是按格子数排的，比画布多出不到一格，镜头的视角跟着格子数的宽高比
  const ray = (x, y) => {
    const nx = ((x / (cols * cell)) * 2 - 1) * tanY * (cols / rows), ny = (1 - (y / (rows * cell)) * 2) * tanY;
    const d = [0, 1, 2].map((i) => camF[i] + camR[i] * nx + camU[i] * ny), l = Math.hypot(...d);
    return d.map((v) => v / l);
  };
  // 拨开一个洞：记下视线在云层中间的那一点，之后这一点跟着风飘，洞也跟着走。移动时每走 40px 或者每 120ms 一个，最多同时 8 个
  let slot = 0, lastX = -1e9, lastY = -1e9, lastAt = -1e9;
  function part(x, y) {
    const d = ray(x, y);
    if (d[1] < 0.01) return;
    const t = Math.min(1.8 / d[1], 65);
    holeP[slot] = d.map((v) => v * t);
    holeAt[slot] = performance.now(); slot = (slot + 1) % 8;
    paint(true);
  }
  const at = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onMove = (e) => {
    if (still || !W) return;
    const [x, y] = at(e), now = performance.now(), moved = Math.hypot(x - lastX, y - lastY);
    if (moved < 6 || (moved < 40 && now - lastAt < 120)) return;
    lastX = x; lastY = y; lastAt = now;
    part(x, y);
  };
  const onDown = (e) => { if (still || !W) return; const [x, y] = at(e); lastX = x; lastY = y; lastAt = performance.now(); part(x, y); };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);

  function frame(now) {
    raf = 0;
    if (dead || !W || !sceneRT) return;
    let busy = false;
    for (let k = 0; k < 8; k++) {
      const age = (now - holeAt[k]) / 1000, on = age >= 0 && age < HOLE_LIFE, p = holeP[k];
      if (on) {
        const x = p[0] + wind[0] * age, y = p[1], z = p[2] + wind[1] * age, l = Math.hypot(x, y, z);   // 洞跟着风飘
        holes.set([x / l, y / l, z / l, age], k * 4);
        // 0.3 秒张开到半径 7°，停一会儿，再用两秒多慢慢合上
        const open = Math.min(1, age / 0.3) ** 0.5, t = Math.min(1, Math.max(0, (age - 1.1) / (HOLE_LIFE - 1.1)));
        holeR[k] = 0.125 * open * (1 - t * t * (3 - 2 * t));
        busy = true;
      } else holes[k * 4 + 3] = -1;
    }
    // 平时每秒 fps 帧；有洞时每帧都画，跟得上手
    if (!still && !busy && now - last < 1000 / fps - 2) { schedule(); return; }
    last = now;
    const u = still ? 0.3 : (((now % period) + period) % period) / period;   // 不动时停在云多一点的那一刻
    covRT.bind();
    covP.use({ uU: u, uDrift: DRIFT, uDomain: DOMAIN });
    tri.draw();
    sceneRT.bind();
    cloudP.use({
      uCov: [covRT.tex, 0], uDetail: [detail, 1], uDomain: DOMAIN,
      uF: camF, uR: camR, uUp: camU, uTan: [tanY * (cols / rows), tanY],
      uSun: sunDir(), uSunCol: sky.sunCol, uZenith: sky.zenith, uMid: sky.mid, uHorizon: sky.horizon, uGlow: sky.glow,
      uAmbTop: sky.ambTop, uAmbBot: sky.ambBot, uDisc: sky.disc,
      uDScale: dScale, uDOff: [-DRIFT[0] * u * dScale[0], 0, -DRIFT[1] * u * dScale[2]], uHole: holes, uHoleR: holeR,
    });
    tri.draw();
    sceneRT.mip();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const ink = sky.ink || SKIES.day.ink;
    compP.use({
      uScene: [sceneRT.tex, 0], uAtlas: [atlas.tex, 1], uRes: [canvas.width, canvas.height], uCells: [cols, rows],
      uCell: cell * dpr, uN: GLYPHS.length, uRange: dark ? [0.18, 0.4, 0.32, 0.56] : [0.45, 0.56, 0.42, 0.72], uInk: sky.ink ? 1 : 0,
      uC0: ink[0], uC1: ink[1], uC2: ink[2], uC3: ink[3],
    });
    tri.draw();
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
  document.fonts?.load('500 50px "DM Mono"').then(() => {
    if (dead) return;
    drawAtlas(atlasCanvas); atlas.update(); paint(true);
  }, () => {});

  relayout();
  return {
    splash() { if (!still && W) part(W * (0.25 + Math.random() * 0.5), H * (0.2 + Math.random() * 0.5)); },
    refresh() { readTheme(); paint(true); },
    destroy() {
      dead = true; cancelAnimationFrame(raf); raf = 0;
      io.disconnect(); ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onVis);
      motion.removeEventListener("change", onMotion);
      covRT.dispose(); sceneRT?.dispose(); gl.deleteTexture(detail); atlas.dispose(); tri.dispose();
      covP.dispose(); cloudP.dispose(); compP.dispose();
      // 上下文不强行丢掉：同一个 canvas 再挂一次（开发时 React 会挂两遍）还要用
    },
  };
}

export { create };
