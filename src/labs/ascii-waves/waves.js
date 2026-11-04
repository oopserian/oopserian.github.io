/* 用字符画（ASCII）画的海浪。WebGL2 着色器画的海只在离屏图里当底稿，屏幕上只有字。每帧两步：

     1. 海（scene）：镜头从 11 米高往前下方 40° 看，整块画面都是海，没有天。
        海面是一张从脚下铺到远处的网格（近密远疏），顶点在着色器里按 10 道 Gerstner 波推动，浪顶尖、浪谷平；
        每个像素再叠 8 道细碎的小波只改法线。底稿存三样：
        水的亮度（浪顶比浪谷亮，迎着光的浪面、反光更亮，远处被雾抹到中间）、浪头在画面上的走向、浪花有多浓。
        浪花只在三道最大的浪的浪尖上一簇一簇地起，往后拖一段渐淡的尾巴，每簇自己冒出来、再散掉；
        浪尖挤到一起（雅可比行列式变小）的地方、涟漪的环上也有。
     2. 合成（composite）：整块切成 8px 见方的格子，每格都有字，不留空：
        浪花够浓的格子画浪花的字 . : * o @（越浓越大），深色主题是白的，浅色主题是最深的墨，不转；浪花边上零星撒几个点当飞沫。
        别的格子画水：按亮度从 - ~ = 里挑，颜色沿一条色带走（深色主题由深蓝到浅蓝，浅色主题由浅灰蓝到深蓝），
        字再转到浪头的走向上，一道道浪就被横着的字描出来，涟漪的环外面的字也绕着环转，
        跟最早那版草浪里字顺着草叶转是一个做法。
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
import { context, program, fullscreen, target, canvasTexture, softwareGL } from "../_kit/gl.js";

const TAU = Math.PI * 2;

function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// 颜色：水的字沿一条四个颜色的色带走，由淡的字到浓的字；浪花的字由淡到浓两个颜色。
// 深色主题水由深蓝到浅蓝、浪花由浅蓝到白（越浓越亮）；浅色主题水由浅灰蓝到深蓝、浪花是最深的墨（越浓越重）
const COLORS = {
  dark: { water: [[0.1, 0.26, 0.5], [0.13, 0.42, 0.76], [0.27, 0.65, 0.92], [0.55, 0.84, 1.0]], foam: [[0.62, 0.86, 1.0], [1.0, 1.0, 1.0]] },
  light: { water: [[0.6, 0.7, 0.8], [0.33, 0.52, 0.75], [0.17, 0.37, 0.65], [0.09, 0.23, 0.5]], foam: [[0.1, 0.22, 0.42], [0.02, 0.06, 0.17]] },
};

// ---------- 波 ----------
// 10 道推动海面的大波、8 道只改法线的小波。大多往镜头这边来，有一组斜着的涌浪交叉。
// 每道波的角频率按深水色散 ω = √(gk) 算，再取成「一圈 period 里正好整数个周期」
function makeWaves(period) {
  const r = rng(20261104), T = period / 1000, g = 9.81;
  const cycles = (k) => Math.max(1, Math.round((Math.sqrt(g * k) * T) / TAU));
  const omega = (k) => (TAU * cycles(k)) / T;
  const big = [], small = [];
  for (let i = 0; i < 10; i++) {
    const L = 9 * Math.pow(0.8, i), k = TAU / L;
    const a = Math.PI / 2 + (i % 3 === 1 ? 0.55 : (r() - 0.5) * 0.5);  // 往 +z（镜头）来，每三道有一道斜着
    const A = L * (i < 3 ? 0.05 : 0.03);
    const Q = 0.9 / (k * A * 10);                                       // 尖的程度：加起来不超过 1，浪顶才不会翻过去
    big.push([Math.cos(a), Math.sin(a), k, A, Q, omega(k), L, cycles(k)]);
  }
  for (let i = 0; i < 8; i++) {
    const L = 1.1 * Math.pow(0.78, i), k = TAU / L, a = Math.PI / 2 + (r() - 0.5) * 2.2;
    small.push([Math.cos(a), Math.sin(a), k, L * 0.035, omega(k)]);
  }
  return { big, small };
}

// ---------- 字的图集 ----------
// 一行 8 格，一格 64 见方（字要转，格子得是正方形）。前 3 个是水，由淡到浓 - ~ =，横着拉宽，一格接一格连成一道道浪；
// 后 5 个是浪花，由淡到浓 . : * o @，不拉宽。每个字按墨迹居中，再描一圈边，笔画粗一点
const GLYPHS = ["-", "~", "=", ".", ":", "*", "o", "@"], WATER = 3;
const T = 64;
function drawAtlas(c) {
  const g = c.getContext("2d");
  c.width = T * GLYPHS.length; c.height = T;
  g.fillStyle = g.strokeStyle = "#fff"; g.lineJoin = "round";
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.font = '500 50px "DM Mono", ui-monospace, monospace';
  GLYPHS.forEach((ch, i) => {
    const m = g.measureText(ch);
    const l = m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight, up = m.actualBoundingBoxAscent, dn = m.actualBoundingBoxDescent;
    const sx = i < WATER ? Math.max(1, Math.min(1.8, (0.84 * T) / (l + r))) : 1;
    g.save();
    g.translate(i * T + T / 2, T / 2); g.scale(sx, 1);
    const x = -(r - l) / 2, y = (up - dn) / 2;
    g.lineWidth = i < WATER ? 4.5 : 3;   // 水的字是细线，描粗一点才压得住整块
    g.fillText(ch, x, y); g.strokeText(ch, x, y);
    g.restore();
  });
}

// ---------- 着色器 ----------
const QUAD_VS = /* glsl */ `
  in vec2 position; out vec2 vUv;
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
  out vec2 vP0;
  out float vJ, vRip;
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
    vJ = jxx * jzz - jxz * jxz; vRip = rip;
    vPos = P; vN = n; vP0 = p;
    gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
  }
`;

// 底稿：r 是水的亮度：浪顶比浪谷亮，迎着光的浪面、反光、亮点更亮，远处被雾抹到中间。
// g、b 是浪头在画面上的走向，存成二倍角（cos 2θ、sin 2θ）：一道横线转 180° 还是它，
// 二倍角一格取平均才不会正反抵消，平均下来越短说明这一格的方向越乱。
// a 是浪花（白沫）有多浓：三道最大的浪，浪尖上一簇一簇地起，往后拖一段渐淡的尾巴；
// 几道浪的浪尖挤到一起（雅可比行列式变小）的地方也起一点；涟漪的环上也有
const SEA_FS = /* glsl */ `
  precision highp float;
  in vec3 vPos, vN;
  in vec2 vP0;
  in float vJ, vRip;
  out vec4 o;
  uniform mat4 projectionMatrix, viewMatrix;
  uniform vec3 cameraPosition, uSunDir;
  uniform vec2 uAspect;             // 画布的宽、高（只看比例）
  uniform vec4 uW[10];              // 大波：方向 x、方向 z、波数 k、振幅 A
  uniform vec4 uWq[10];             // 大波：尖的程度 Q、角频率 ω、波长、一圈走几个周期
  uniform vec4 uS[8];               // 小波：方向 x、方向 z、k、A
  uniform float uSw[8];             // 小波的角频率
  uniform float uT, uAmax, uPer;   // uPer：一圈多少秒
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
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
    L = mix(L, 0.5, 1.0 - exp(-dist / 140.0));
    // 浪头的走向：海面上跟坡度垂直的方向（等高线），投到画面上。按坡度的平方算轻重：浪顶、浪谷是平的，方向说不准，几乎不算
    vec2 gh = -vN.xz;                                  // 高度对没推动前的位置的梯度：浪尖被挤尖的地方也不会被放大
    vec3 tw = vec3(-gh.y, 0.0, gh.x) / (length(gh) + 1e-6);
    vec4 p0 = projectionMatrix * viewMatrix * vec4(vPos, 1.0), p1 = projectionMatrix * viewMatrix * vec4(vPos + tw * 0.2, 1.0);
    vec2 sd = (p1.xy / p1.w - p0.xy / p0.w) * uAspect;   // 画面上的方向，左上角是原点
    sd.y = -sd.y;
    float m2 = dot(sd, sd);
    vec2 t2 = m2 > 1e-12 ? vec2(sd.x * sd.x - sd.y * sd.y, 2.0 * sd.x * sd.y) / m2 * min(dot(gh, gh) * 5.0, 1.0) : vec2(0.0);
    // 浪花：d 是这一点落在浪尖后面多远（相位，0 是浪尖），白沫从浪尖起、往后渐淡。
    // 哪几段浪尖起白沫看噪声，噪声跟着这道浪尖走（沿浪尖的位置、第几道浪尖），
    // 第几道浪尖按「一圈走几个周期」取余，一圈以后正好回到原样
    float foam = 0.0;
    for (int i = 0; i < 3; i++) {
      vec2 D = uW[i].xy; float k = uW[i].z;
      float th = k * dot(D, vP0) - uWq[i].y * uT;
      float d = mod(1.5707963 - th, 6.2831853);
      float id = mod(floor((th + d - 1.5707963) / 6.2831853 + 0.5), uWq[i].w);
      float u = dot(vec2(-D.y, D.x), vP0);
      float clump = smoothstep(0.32, 0.64, vnoise(vec2(u * 0.32, id * 7.31 + float(i) * 3.7)));
      // 每一簇自己起落：一圈里碎三次，各簇错开，浪花冒出来、散掉，不是一直挂在浪尖上
      clump *= smoothstep(0.05, 0.6, 0.5 + 0.5 * sin(6.2831853 * (3.0 * uT / uPer + vnoise(vec2(u * 0.15, id * 3.1 + float(i))))));
      float grain = vnoise(vec2(u, d / k) * 1.4 + id * 5.13 + float(i) * 1.9);
      float tail = exp(-d / 1.1);
      foam += clump * smoothstep(0.12, 0.7, tail * (0.4 + 1.0 * grain)) * (1.0 - 0.2 * float(i));
    }
    foam += (1.0 - smoothstep(0.08, 0.35, vJ)) * 0.4 * smoothstep(0.35, 0.7, vnoise(vP0 * 0.6));   // 浪尖挤到一起的地方，也是零零碎碎的
    foam += 1.4 * vRip;
    foam *= exp(-dist / 120.0);
    o = vec4(L, t2 * 0.5 + 0.5, clamp(foam, 0.0, 1.0));
  }
`;

const COMP_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uAtlas;
  uniform vec2 uRes;                // 画布，设备像素
  uniform float uCell, uLod, uN;    // 一格多少设备像素、取平均用的 mipmap 层、图集里有几个字
  uniform vec2 uRange;              // 水的亮度从 x 到 y 铺满由淡到浓的水的字
  uniform vec3 uC0, uC1, uC2, uC3;  // 水的色带
  uniform vec3 uF0, uF1;            // 浪花由淡到浓的颜色
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) * uCell / uRes;
    vec4 s = textureLod(uScene, vec2(c0.x, 1.0 - c0.y), uLod);
    float r1 = hash(cell), r2 = hash(cell + 17.31);
    float gi, a = 0.0;
    vec3 col;
    // 浪花：这一格的白沫够浓就画浪花的字（. : * o @），不转；边上淡的地方零星撒几个点当飞沫
    float fz = s.a + (r1 - 0.5) * 0.16;
    if (fz > 0.16 || r2 < (s.a - 0.04) * 3.0) {
      float fl = clamp((fz - 0.16) / 0.6, 0.0, 0.999);
      gi = ${WATER}.0 + floor(fl * (uN - ${WATER}.0));
      col = mix(uF0, uF1, fl);
    } else {
      // 水：亮度挑 - ~ =，字顺着浪头放；这一格的方向乱（二倍角平均下来很短）就横着放
      vec2 t2 = textureLod(uScene, vec2(c0.x, 1.0 - c0.y), uLod + 1.5).gb * 2.0 - 1.0;   // 方向取周围几格一起的，不跟着一格里的小起伏乱转
      a = dot(t2, t2) > 1e-12 ? 0.5 * atan(t2.y, t2.x) * smoothstep(0.05, 0.25, length(t2)) : 0.0;   // atan(0, 0) 没定义，有的显卡算出 NaN
      float lv = clamp((s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.08, 0.0, 0.999);
      gi = floor(lv * ${WATER}.0);
      col = ramp(lv);
    }
    vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
    vec2 q = vec2(cos(a) * loc.x + sin(a) * loc.y, -sin(a) * loc.x + cos(a) * loc.y);
    float ink = 0.0;
    if (abs(q.x) < 0.5 && abs(q.y) < 0.5) ink = texture(uAtlas, vec2((gi + q.x + 0.5) / uN, 0.5 - q.y)).r;
    o = vec4(col * ink, ink);   // 预乘过的透明度：字以外是透明的
  }
`;

// ---------- 镜头 ----------
// 透视投影、看向某一点的视图矩阵，按列存（uniformMatrix4fv 要的就是这样），算法跟 Three.js 的 PerspectiveCamera、lookAt 一样
const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan((fovY * Math.PI) / 360), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function lookAt(eye, at) {
  const z = norm(sub(eye, at)), x = norm(cross([0, 1, 0], z)), y = cross(z, x);   // 镜头往右、往上、往后
  const view = new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  return { x, y, z, view };
}

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
  const seaP = program(gl, SEA_VS, SEA_FS), compP = program(gl, QUAD_VS, COMP_FS);

  // 镜头：11 米高，往前下方 40° 看，画面最上沿也落在海上，没有天
  const FOV = 50, EYE = [0, 11, 6];
  const cam = lookAt(EYE, [0, 0, 6 - 11 / Math.tan((40 * Math.PI) / 180)]);
  let proj = perspective(FOV, 2, 0.1, 1000);

  const { big, small } = makeWaves(period);
  const flat = (rows) => new Float32Array(rows.flat());
  const sea = {
    uAmax: big.slice(0, 3).reduce((s, w) => s + w[3], 0), uPer: period / 1000,
    uW: flat(big.map((w) => w.slice(0, 4))), uWq: flat(big.map((w) => w.slice(4, 8))),
    uS: flat(small.map((w) => w.slice(0, 4))), uSw: new Float32Array(small.map((w) => w[4])),
    uSunDir: norm([0.25, 0.75, -1]),   // 光从正前方偏右的高处来
    viewMatrix: cam.view, cameraPosition: EYE,
  };

  // 1. 海面：x 方向 300 格、z 方向 400 格，z 按指数铺（脚下密、远处疏），越远越宽，正好盖满画面。
  //    从镜头脚下往后一点开始铺，浪把网格前后推的时候边缘也露不出来。12 万个点，下标超过 65535，用 32 位的
  const COLS = 300, ROWS = 400, NEAR = 1, FAR = 260, Z0 = 6;
  const pos = new Float32Array((COLS + 1) * (ROWS + 1) * 3), idx = new Uint32Array(COLS * ROWS * 6);
  for (let j = 0; j <= ROWS; j++) {
    const z = Z0 - NEAR * Math.pow(FAR / NEAR, j / ROWS) + 3, half = Math.abs(Z0 - z) * 1.3 + 10;
    for (let i = 0; i <= COLS; i++) { const o = (j * (COLS + 1) + i) * 3; pos[o] = (i / COLS * 2 - 1) * half; pos[o + 1] = 0; pos[o + 2] = z; }
  }
  for (let j = 0, o = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++, o += 6) {
    const a = j * (COLS + 1) + i, b = a + 1, c = a + COLS + 1, d = c + 1;
    idx[o] = a; idx[o + 1] = c; idx[o + 2] = b; idx[o + 3] = b; idx[o + 4] = c; idx[o + 5] = d;
  }
  const seaVao = gl.createVertexArray(), seaBuf = gl.createBuffer(), seaIdx = gl.createBuffer();
  gl.bindVertexArray(seaVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, seaBuf); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, seaIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  const rip = new Float32Array(32), ripT = new Array(8).fill(-1e9), ripP = Array.from({ length: 8 }, () => [0, 0]);
  let sceneRT = null;

  // 2. 合成
  const atlasCanvas = document.createElement("canvas");
  drawAtlas(atlasCanvas);
  const atlas = canvasTexture(gl, atlasCanvas);

  let W = 0, H = 0, dpr = 1, raf = 0, visible = true, last = -1e9, dead = false, colors = COLORS.light;

  function readTheme() { colors = COLORS[getComputedStyle(canvas).colorScheme.includes("dark") ? "dark" : "light"]; }
  function relayout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    sceneRT?.dispose();
    sceneRT = target(gl, canvas.width, canvas.height, { mipmaps: true, depth: true });
    proj = perspective(FOV, W / H, 0.1, 1000);
    readTheme();
    paint(true);
  }

  // 鼠标、手指：从画面上那一点往海面投一条线，落点激起一圈涟漪。移动时每走 40px 或者每 120ms 一圈，最多同时 8 圈
  let slot = 0, lastX = -1e9, lastY = -1e9, lastAt = -1e9;
  function splash(x, y) {
    const ty = Math.tan((FOV * Math.PI) / 360), nx = ((x / W) * 2 - 1) * ty * (W / H), ny = (1 - (y / H) * 2) * ty;
    const d = [0, 1, 2].map((i) => cam.x[i] * nx + cam.y[i] * ny - cam.z[i]);
    if (d[1] >= 0) return;   // 视线朝上，碰不到海面
    const t = -EYE[1] / d[1];
    ripP[slot] = [EYE[0] + d[0] * t, EYE[2] + d[2] * t]; ripT[slot] = performance.now(); slot = (slot + 1) % ripT.length;
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
    for (let k = 0; k < ripT.length; k++) {
      const age = (now - ripT[k]) / 1000, on = age >= 0 && age < 5;
      rip.set([ripP[k][0], ripP[k][1], age, on ? 1 : 0], k * 4);
      if (on) busy = true;
    }
    // 平时每秒 fps 帧；有涟漪时每帧都画，跟得上手
    if (!still && !busy && now - last < 1000 / fps - 2) { schedule(); return; }
    last = now;
    const u = still ? 0.05 : (((now % period) + period) % period) / period;   // 不动时停在跟封面差不多的那一刻
    // 海：画进带深度的离屏图（网格两面都画，不剔除），再生成 mipmap，合成时按格子取平均
    sceneRT.bind();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    seaP.use({ ...sea, projectionMatrix: proj, uT: (u * period) / 1000, uRip: rip, uAspect: [W, H] });
    gl.bindVertexArray(seaVao); gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    sceneRT.mip();
    // 合成到画布上
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const C = colors;
    compP.use({
      uScene: [sceneRT.tex, 0], uAtlas: [atlas.tex, 1], uRes: [canvas.width, canvas.height], uCell: cell * dpr,
      uLod: Math.log2(cell * dpr) - 0.5, uN: GLYPHS.length, uRange: [0.25, 0.8],
      uC0: C.water[0], uC1: C.water[1], uC2: C.water[2], uC3: C.water[3], uF0: C.foam[0], uF1: C.foam[1],
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
  document.fonts?.load('400 54px "DM Mono"').then(() => document.fonts.load('500 54px "DM Mono"')).then(() => {
    if (dead) return;
    drawAtlas(atlasCanvas); atlas.update(); paint(true);
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
      sceneRT?.dispose(); atlas.dispose(); tri.dispose();
      gl.deleteVertexArray(seaVao); gl.deleteBuffer(seaBuf); gl.deleteBuffer(seaIdx);
      seaP.dispose(); compP.dispose();
      // 上下文不强行丢掉：同一个 canvas 再挂一次（开发时 React 会挂两遍）还要用
    },
  };
}

export { create };
