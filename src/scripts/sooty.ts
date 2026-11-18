// 首屏 SOOTY 那格：海报活过来（2026-11-18 laken：SOOTY 上线了，给它做一个特别的动画背景）。
// 海报的样子不变：左上 SOOTY 和那句话，右边一块裂开的煤，底下一道字符画的蓝色星球边缘。动起来的是：
//   - 星球边缘的光沿着弧慢慢流；一行行字往左走，越往下走得越快，像星球在转；字时不时换一个
//   - 煤块浮着、轻轻转，缝里那点蓝光一明一暗，底下的光把朝下的边照出一道细蓝
//   - 第一次看到这一格时，缝里的亮点亮一下，光顺着缝跑开，跑到缝的下头，地平线从煤块底下鼓起一道浪往两头跑开，浪过处的字乱跳一下
//   - 鼠标移上来：轻轻再来一下开场；地平线朝鼠标抬起来、最亮的那段光跟着鼠标走，鼠标底下的字乱跳；
//     凑近煤块，整条缝慢慢亮起来；煤块和地平线跟着鼠标挪一点，
//     煤块挪得多、地平线挪得少，有前后；整张海报跟原来一样轻轻放大
// 画法：一个全屏的片元着色器（WebGL2）。字和煤块直接从页面上那张海报图取，不另下图；
// 煤块的轮廓和裂缝从 sooty-stone.png 取（tools/sooty-stone.py 从海报里拆出来的）。
// 省：平时每秒 30 帧，鼠标在动、开场那一下的时候跟满帧；看不见、切走了就停。
// 不画、留着原来那张海报：减弱动态效果、没有 WebGL2、显卡是软件模拟的（无头浏览器测试时设 window.__sootySoftwareOk）、上下文丢了。
import { context, program, fullscreen, softwareGL } from '../labs/_kit/gl.js';
import stoneUrl from '../assets/projects/sooty-stone.png?url';

const PW = 1200, PH = 630, POS_Y = 0.42;      // 海报多大；图在格子里怎么裁（object-position 的 y，跟 Hero 里的一样）
const CW = 10.8, CH = 18;                     // 一个字格多大（海报像素）：海报上是 18px 的 DM Mono 一行行排的
const RAMP = ' +xX0S8#@';                     // 由暗到亮，海报上用的就是这几个字
const MASK = [770, 148, 340, 334];            // sooty-stone.png 盖着海报的哪一块（x、y、宽、高），改了要跟 tools/sooty-stone.py 一起改
const GLINT = [999, 392], GLINT_AT = 0.791;   // 缝里那个蓝色亮点：在海报上的位置、在缝上从上往下走到哪（tools/sooty-stone.py 打出来的）
const STONE_C = [938, 314];                   // 煤块的中心，绕它转
const FPS = 30;
const RING_S = 2.6;                           // 开场那一下多长（秒）

// 光晕的底色（字和字之间的颜色），从海报上一行行量的：在弧线下面 d 像素处是什么颜色。
// 弧线外面一圈很淡的蓝雾，往里越来越亮，d 六七十处是一道白，再往里变青
const LUT_D0 = -40, LUT_D1 = 200;
const STOPS = [
  [-34, 10, 10, 10], [-26, 12, 13, 17], [-20, 11, 16, 38], [-14, 14, 22, 58], [-8, 16, 28, 88], [-2, 18, 35, 105],
  [4, 20, 39, 133], [10, 23, 44, 159], [16, 25, 50, 169], [22, 27, 57, 189], [28, 35, 69, 205], [34, 49, 85, 205],
  [40, 67, 107, 218], [46, 91, 129, 226], [52, 117, 147, 222], [58, 152, 175, 227], [64, 200, 208, 224], [70, 214, 221, 227],
  [76, 214, 223, 228], [82, 196, 219, 235], [88, 178, 206, 228], [100, 157, 196, 227], [112, 125, 190, 228], [124, 98, 179, 226],
  [136, 81, 179, 224], [148, 62, 178, 228], [175, 45, 168, 228], [200, 40, 160, 226],
];

const VS = /* glsl */ `
  in vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

// 每个像素先换算到海报上的位置（海报像素，原点左上），再按「在弧线下面多深」上色、挑字，最后盖上煤块
const FS = /* glsl */ `
  precision highp float;
  precision highp int;
  uniform sampler2D uPoster, uStone, uAtlas, uLut;
  uniform vec2 uRes, uOrg;      // 画布多少像素；海报左上角落在画布哪（设备像素）
  uniform float uS;             // 海报 1 像素 = 多少设备像素
  uniform float uT, uStep;      // 秒；字换一次的节拍（一秒 12 拍）
  uniform float uHov;           // 鼠标在上面，0 到 1
  uniform vec2 uPtr, uPar;      // 鼠标在海报上的位置；跟着鼠标挪的量（-1 到 1）
  uniform vec2 uSun;            // 地平线上最亮的那一段：在哪（海报 x）、抬起来多高
  uniform float uRing;          // 开场那一下走了几秒，没有就是负的
  uniform float uRingAmp;       // 那一下多重：开场是 1，鼠标移进来时再来一下轻的
  uniform float uWarm;          // 鼠标离缝里的亮点多近（0 到 1）：越近缝里越亮
  uniform vec2 uStoneOff, uGlint;
  uniform float uStoneAng;
  out vec4 outColor;

  const vec2 CELL = vec2(${CW}, ${CH});
  const float N = ${RAMP.length}.0;
  const float RR = 2760.0;                    // 星球的半径：弧线顶在 (600, 474)，两头在 540 上下，跟海报一样
  const vec2 STONE_C = vec2(${STONE_C[0]}.0, ${STONE_C[1]}.0);
  const vec2 GLINT = vec2(${GLINT[0]}.0, ${GLINT[1]}.0);
  const vec4 MASK = vec4(${MASK.join('.0, ')}.0);
  const vec2 POSTER = vec2(${PW}.0, ${PH}.0);

  uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
  float rnd(vec3 v) { uvec3 u = uvec3(ivec3(floor(v)) + 100000); return float(pcg(u.x ^ pcg(u.y ^ pcg(u.z)))) / 4294967295.0; }
  float h1(float i) { return float(pcg(uint(int(i) + 1000000))) / 4294967295.0; }
  float vnoise(float x) { float i = floor(x), f = x - i, u = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), u); }
  float sq(float x) { return x * x; }

  vec3 glowCol(float d) { return texture(uLut, vec2((d - ${LUT_D0}.0) / ${LUT_D1 - LUT_D0}.0, 0.5)).rgb; }

  // 光沿着弧慢慢流：几道慢慢走的起伏叠在一起
  float flow(float x) {
    return 0.5 * sin(x * 0.0045 - uT * 0.23) + 0.3 * sin(x * 0.011 + uT * 0.31 + 1.7) + 0.2 * sin(x * 0.023 - uT * 0.47 + 4.1);
  }

  // 开场那一下：缝里的光跑到缝的下头（0.3 秒）以后，地平线从煤块底下鼓起一道浪，往左右两头跑开
  float wave(float x) {
    float t = uRing - 0.3;
    if (t < 0.0) return 0.0;
    return uRingAmp * exp(-sq((abs(x - uGlint.x) - t * 620.0) / 120.0)) * smoothstep(0.0, 0.25, t) * (1.0 - smoothstep(0.7, ${RING_S} - 0.3, t));
  }

  // 最亮的那一段：平时沿着地平线慢慢来回漂，鼠标在上面就跟着鼠标
  float sun(float x) { return exp(-sq((x - uSun.x) / 190.0)); }

  // 在弧线下面多深（负的是弧线以上）：弧线跟着光流起伏几像素，最亮的那一段抬起来
  float depth(vec2 p) {
    vec2 c = vec2(600.0 + uPar.x * 3.0, 474.0 + RR + uPar.y * 2.0);
    float d = RR - length(p - c);
    float dx = (p.x - 600.0) / 600.0;
    d *= 1.0 - 0.1 * dx * dx;
    d += 5.0 * flow(p.x);
    d += uSun.y * sun(p.x);
    d += 16.0 * wave(p.x);
    return d;
  }

  float glyph(float g, vec2 local) { return texture(uAtlas, vec2((g + local.x) / N, local.y)).a; }

  void main() {
    vec2 dev = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 p = (dev - uOrg) / uS;

    // 1. 天和星球边缘的光
    float d = depth(p);
    float ring = wave(p.x);
    float glowAmt = smoothstep(-30.0, 10.0, d);
    vec3 col = glowCol(d) * (1.0 + 0.05 * flow(p.x + 300.0) + 0.12 * sun(p.x) * glowAmt);
    col += ring * 0.35 * glowCol(d + 30.0) * glowAmt;

    // 2. 字：一行一行往左走，越往下越快（星球近处转得快）；每格按格子中心那里的亮度挑字
    float row = floor(p.y / CELL.y);
    float rowY = (row + 0.5) * CELL.y;
    float off = uT * (0.12 + 0.0045 * max(rowY - 450.0, 0.0)) * CELL.x;
    off = floor(off * uS + 0.5) / uS;   // 按整个设备像素走，字不会一会儿清楚一会儿糊
    float cx = floor((p.x + off) / CELL.x);
    vec2 cell = vec2(cx, row);
    vec2 pc = vec2((cx + 0.5) * CELL.x - off, rowY);
    float dc = depth(pc);
    if (dc > -8.0) {
      // 亮度：弧线上是 0，那道白最亮，往里（青的地方）暗一点，跟海报上用的字一样
      float e = dc < 72.0 ? smoothstep(-4.0, 72.0, dc) : mix(1.0, 0.66, smoothstep(72.0, 150.0, dc));
      float seed = h1(row * 13.0 + 7.0);
      // 一个个「词」：中间空几格，越暗的地方空得越多
      float gap = vnoise(cx * 0.55 + seed * 40.0);
      // 每格隔一阵子换一个字，各有各的节奏
      float n = rnd(vec3(cell, floor(uStep * 0.03 * (0.5 + seed) + h1(cx * 7.0 + row * 131.0) * 10.0)));
      float rc = wave(pc.x) * smoothstep(-8.0, 20.0, dc);
      float stir = uHov * smoothstep(64.0, 16.0, length(pc - uPtr));
      float lv = e * 0.94 + (n - 0.5) * 0.2 + rc * 0.5 + stir * 0.3 + 0.1 * sun(pc.x) * smoothstep(-8.0, 30.0, dc);
      float gi = gap > mix(0.72, 0.18, e) - rc * 0.4 ? 1.0 + floor(clamp(lv, 0.0, 0.999) * (N - 1.0)) : 0.0;
      // 被光圈扫过、在鼠标底下的：乱跳
      if (max(rc, stir) > 0.25 && rnd(vec3(cell, uStep + 77.0)) < max(rc, stir) * 0.9) gi = 1.0 + floor(rnd(vec3(cell, uStep + 191.0)) * (N - 1.0));
      if (gi > 0.0) {
        float a = glyph(gi, vec2((p.x + off) / CELL.x - cx, p.y / CELL.y - row));
        // 字的颜色是它底下的光再亮一截（海报上量的），扫过的、鼠标底下的再亮一点
        vec3 gc = clamp(glowCol(dc) * 1.25 + vec3(0.05, 0.07, 0.08) + rc * 0.35 + stir * vec3(0.2, 0.24, 0.28), 0.0, 1.0);
        col = mix(col, gc, a * 0.92);
      }
    }

    // 3. 左上的 SOOTY 和那句话：直接取海报
    if (p.x < 770.0 && p.y < 430.0) col = max(col, texture(uPoster, p / POSTER).rgb);

    // 4. 煤块：浮着、轻轻转、跟着鼠标挪
    vec2 q = p - STONE_C - uStoneOff;
    q = mat2(cos(uStoneAng), sin(uStoneAng), -sin(uStoneAng), cos(uStoneAng)) * q + STONE_C;
    vec2 muv = (q - MASK.xy) / MASK.zw;
    float onStone = 0.0;
    if (all(greaterThan(muv, vec2(0.0))) && all(lessThan(muv, vec2(1.0)))) {
      vec3 m = texture(uStone, muv).rgb;   // r 轮廓，g 缝里的光，b 在缝上走到哪
      if (m.r > 0.0) {
        vec3 sc = texture(uPoster, q / POSTER).rgb;
        // 底下的光照上来：轮廓朝下的边亮一道细蓝，底下一点点泛蓝；鼠标、光圈过来时更亮
        vec2 e2 = 3.0 / MASK.zw;
        vec2 gr = vec2(texture(uStone, muv + vec2(e2.x, 0.0)).r - texture(uStone, muv - vec2(e2.x, 0.0)).r,
                       texture(uStone, muv + vec2(0.0, e2.y)).r - texture(uStone, muv - vec2(0.0, e2.y)).r);
        float edge = clamp(length(gr), 0.0, 1.0);
        float down = smoothstep(0.2, 0.9, dot(-gr / max(length(gr), 1e-4), vec2(0.0, 1.0)));
        float lift = 0.5 + (0.6 + 0.9 * uHov) * sun(q.x) + ring * 2.5;
        sc += vec3(0.16, 0.28, 0.85) * edge * down * 0.22 * lift;
        sc += vec3(0.015, 0.03, 0.09) * smoothstep(380.0, 475.0, q.y) * lift;
        // 缝里的光：亮点那一段最亮，慢慢一明一暗；开场那一下先顺着缝往两头跑；鼠标凑近了整条缝慢慢亮起来
        float breathe = 0.5 + 0.5 * sin(uT * 1.1);
        float near = exp(-sq((m.b - ${GLINT_AT}) / 0.07));
        float run = uRing >= 0.0 ? uRingAmp * exp(-sq((abs(m.b - ${GLINT_AT}) - uRing * 0.55) / 0.05)) * (1.0 - smoothstep(0.8, 1.6, uRing)) : 0.0;
        float warm = uWarm * exp(-sq((m.b - ${GLINT_AT}) / 0.3));
        sc += vec3(0.35, 0.6, 1.0) * m.g * (0.06 + near * 0.4 * breathe + run * 1.2 + warm * 0.5);
        float r = length(q - GLINT);
        float flash = uRing >= 0.0 ? uRingAmp * exp(-uRing * 3.0) : 0.0;
        sc += vec3(0.55, 0.75, 1.0) * (exp(-sq(r / 5.0)) * 0.3 + exp(-sq(r / 16.0)) * 0.08) * (0.5 + 0.7 * breathe + run * 2.0 + flash * 3.0 + uWarm * 1.2);
        col = mix(col, sc, m.r);
        onStone = m.r;
      }
    }

    // 5. 颗粒：主要在光晕上，跟海报一样有一层细细的噪点
    float g = rnd(vec3(dev, floor(uT * 24.0))) - 0.5;
    col += g * (0.06 * dot(col, vec3(0.299, 0.587, 0.114)) + 0.012) * glowAmt * (1.0 - onStone);
    outColor = vec4(col, 1.0);
  }
`;

// 光晕的色表：256 格，从 d = -40 到 200
function lut() {
  const n = 256, a = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const d = LUT_D0 + (i / (n - 1)) * (LUT_D1 - LUT_D0);
    const k = STOPS.findIndex((s) => s[0] > d);
    let c: number[];
    if (k <= 0) c = (k === 0 ? STOPS[0] : STOPS[STOPS.length - 1]).slice(1);
    else {
      const A = STOPS[k - 1], B = STOPS[k], t = (d - A[0]) / (B[0] - A[0]);
      c = [1, 2, 3].map((j) => A[j] + (B[j] - A[j]) * t);
    }
    a.set([...c, 255], i * 4);
  }
  return a;
}

// 字的图集：一行白字，一个字正好一格大（设备像素），用网站的 DM Mono
function atlas(cw: number, ch: number, size: number) {
  const a = document.createElement('canvas');
  a.width = cw * RAMP.length;
  a.height = ch;
  const c = a.getContext('2d')!;
  c.fillStyle = '#fff';
  c.font = `${size}px "DM Mono", ui-monospace, monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (let i = 1; i < RAMP.length; i++) c.fillText(RAMP[i], (i + 0.5) * cw, ch * 0.52);
  return a;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Engine = { destroy(): void };

// 建画布和显卡，等海报、煤块的图和字体到齐，画第一帧再淡进来。哪一步不行就返回 null，海报照旧
async function create(box: HTMLElement, img: HTMLImageElement, link: HTMLElement): Promise<Engine | null> {
  const canvas = document.createElement('canvas');
  canvas.className = 'sooty-gl';
  canvas.setAttribute('aria-hidden', 'true');
  let gl: WebGL2RenderingContext;
  try { gl = context(canvas); } catch { return null; }
  const lose = () => gl.getExtension('WEBGL_lose_context')?.loseContext();
  if (softwareGL(gl) && !(window as any).__sootySoftwareOk) { lose(); return null; }

  const stone = new Image();
  stone.src = stoneUrl;
  try {
    await Promise.all([
      img.complete && img.naturalWidth ? null : img.decode(),
      stone.decode(),
      Promise.race([document.fonts.load('400 18px "DM Mono"'), wait(1500)]),
    ]);
  } catch { lose(); return null; }

  let prog: ReturnType<typeof program>;
  try { prog = program(gl, VS, FS); } catch (err) { if (import.meta.env.DEV) console.warn(err); lose(); return null; }
  const quad = fullscreen(gl);
  const texture = (src: TexImageSource | Uint8Array, w = 0, h = 0, t = gl.createTexture()!) => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (src instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const posterT = texture(img), stoneT = texture(stone), lutT = texture(lut(), 256, 1), atlasT = gl.createTexture()!;
  // 屏幕变宽，浏览器从 srcset 里换了张大的海报：跟着换
  const onImg = () => { if (!dead) { texture(img, 0, 0, posterT); paint(true); } };
  img.addEventListener('load', onImg);

  // 尺寸：海报按 object-fit: cover 盖满格子，跟底下那张 img 一模一样地裁
  let W = 0, H = 0, dpr = 1, sc = 1, org = [0, 0], cellKey = '';
  function relayout() {
    W = box.clientWidth; H = box.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    sc = Math.max(W / PW, H / PH);
    org = [(W - PW * sc) * 0.5, (H - PH * sc) * POS_Y];
    const s = sc * dpr, cw = Math.max(3, Math.round(CW * s)), ch = Math.max(5, Math.round(CH * s));
    if (`${cw}x${ch}` !== cellKey) { cellKey = `${cw}x${ch}`; texture(atlas(cw, ch, CH * s), 0, 0, atlasT); }
    paint(true);
  }

  // 状态：to 是目标，画的时候慢慢追过去
  const st = {
    hov: 0, hovTo: 0,
    ptr: [GLINT[0], 520], ptrTo: [GLINT[0], 520],
    par: [0, 0], parTo: [0, 0],
    ringAt: -1e9, ringAmp: 1, seen: false, moved: -1e9,
  };
  const t0 = performance.now() - 20000 * Math.random();   // 每次打开光流、字走到的地方都不一样
  let raf = 0, last = -1e9, prev = performance.now(), visible = false, dead = false, shown = false;

  function frame() {
    raf = 0;
    const now = performance.now();
    if (dead || !W) return;
    const dt = Math.min(0.1, (now - prev) / 1000);
    prev = now;
    const ease = (rate: number) => 1 - Math.exp(-dt * rate);
    st.hov += (st.hovTo - st.hov) * ease(st.hovTo > st.hov ? 6 : 2.5);
    for (let i = 0; i < 2; i++) {
      st.ptr[i] += (st.ptrTo[i] - st.ptr[i]) * ease(9);
      st.par[i] += (st.parTo[i] - st.par[i]) * ease(3.5);
    }
    const ring = (now - st.ringAt) / 1000;
    const busy = ring < RING_S || Math.abs(st.hovTo - st.hov) > 0.003 || now - st.moved < 600
      || Math.hypot(st.par[0] - st.parTo[0], st.par[1] - st.parTo[1]) > 0.003;
    // 平时每秒 30 帧；鼠标在动、开场那一下的时候每帧都画，跟得上手
    if (!busy && now - last < 1000 / FPS - 2) { schedule(); return; }
    last = now;

    const t = ((now - t0) / 1000) % 100000;
    // 煤块：一上一下浮（8 秒一个来回），轻轻转，跟着鼠标挪 6 个海报像素，比地平线挪得多
    const fl = t * 0.8;
    // 最亮的那一段：平时一分来钟沿着地平线漂一个来回，鼠标在上面就移到鼠标那里、抬得更高
    const drift = 600 + 520 * Math.sin(t * 0.09) + 120 * Math.sin(t * 0.23 + 1);
    const sun = [drift + (st.ptr[0] - drift) * st.hov, 10 + 16 * st.hov];
    const off = [st.par[0] * 6, Math.sin(fl) * 3.2 + st.par[1] * 4];
    // 鼠标在上面整张轻轻放大（原来是 CSS 给 img 放大 1.025），绕格子中心
    const z = 1 + 0.025 * st.hov;
    const s = sc * dpr * z;
    const cxy = [W / 2, H / 2];
    const o = [(cxy[0] - (cxy[0] - org[0]) * z) * dpr, (cxy[1] - (cxy[1] - org[1]) * z) * dpr];

    gl.viewport(0, 0, canvas.width, canvas.height);
    prog.use({
      uPoster: [posterT, 0], uStone: [stoneT, 1], uAtlas: [atlasT, 2], uLut: [lutT, 3],
      uRes: [canvas.width, canvas.height], uOrg: o, uS: s,
      uT: t, uStep: Math.floor(t * 12),
      uHov: st.hov, uPtr: st.ptr, uPar: st.par, uSun: sun,
      uRing: ring < RING_S ? ring : -1, uRingAmp: st.ringAmp,
      uWarm: st.hov * Math.min(1, Math.max(0, (260 - Math.hypot(st.ptr[0] - GLINT[0] - off[0], st.ptr[1] - GLINT[1] - off[1])) / 200)),
      uStoneOff: off, uStoneAng: Math.sin(fl * 0.71 + 1.3) * 0.009,
      uGlint: [GLINT[0] + off[0], GLINT[1] + off[1]],
    });
    quad.draw();
    if (!shown) { shown = true; requestAnimationFrame(() => canvas.classList.add('on')); }
    schedule();
  }
  function schedule() { if (!raf && !dead && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function paint(force = false) { if (force) last = -1e9; schedule(); }

  // 鼠标（触屏上一点就是打开链接，不跟手）：位置换算到海报上，抬起光；离开慢慢落回去
  const toPoster = (e: PointerEvent) => {
    const b = box.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    return { p: [(x - org[0]) / sc, (y - org[1]) / sc], f: [x / b.width - 0.5, y / b.height - 0.5] };
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const { p, f } = toPoster(e);
    if (st.hovTo === 0) {
      st.ptr = [...p];   // 刚移进来：光直接从鼠标底下抬起来，不从上次的地方滑过来
      // 再来一下轻的开场（上一下走完 5 秒以后才来，来回晃不会一直闪）
      const now = performance.now();
      if (st.seen && now - st.ringAt > RING_S * 1000 + 5000) { st.ringAt = now; st.ringAmp = 0.55; }
    }
    st.ptrTo = p;
    st.parTo = [f[0] * 2, f[1] * 2];
    st.hovTo = 1;
    st.moved = performance.now();
    paint();
  };
  const onLeave = () => { st.hovTo = 0; st.parTo = [0, 0]; paint(); };
  // 用键盘停到这一格：光从煤块底下抬起来
  const onFocus = () => { if (link.matches(':focus-visible')) { st.ptr = [GLINT[0], 520]; st.ptrTo = [GLINT[0], 520]; st.hovTo = 1; paint(); } };
  link.addEventListener('pointermove', onMove);
  link.addEventListener('pointerleave', onLeave);
  link.addEventListener('focus', onFocus);
  link.addEventListener('blur', onLeave);

  // 第一次看到这一格：等画布淡进来，缝里亮一下，地平线鼓起一道浪
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible && !st.seen) { st.seen = true; st.ringAt = performance.now() + 700; st.ringAmp = 1; }
    if (visible) { prev = performance.now(); paint(true); }
  });
  const ro = new ResizeObserver(() => relayout());
  const onVis = () => { if (!document.hidden) { prev = performance.now(); paint(true); } };
  document.addEventListener('visibilitychange', onVis);

  function destroy() {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    io.disconnect(); ro.disconnect();
    link.removeEventListener('pointermove', onMove);
    link.removeEventListener('pointerleave', onLeave);
    link.removeEventListener('focus', onFocus);
    link.removeEventListener('blur', onLeave);
    img.removeEventListener('load', onImg);
    document.removeEventListener('visibilitychange', onVis);
    canvas.remove();
    lose();
  }
  canvas.addEventListener('webglcontextlost', destroy);

  (canvas as any).__sooty = st;   // 测试用：截图脚本改 ringAt 重放开场、看鼠标的样子
  img.after(canvas);
  relayout();
  io.observe(box);
  ro.observe(box);
  return { destroy };
}

/** 挂到 SOOTY 那格上。box 是放海报的格子，img 是海报，link 是整格的链接（鼠标在它上面就算在格子上） */
export function mountSooty(box: HTMLElement, img: HTMLImageElement, link: HTMLElement) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let eng: Engine | null = null, starting = false;
  const start = () => {
    if (eng || starting || reduce.matches) return;
    starting = true;
    create(box, img, link).then((e) => {
      starting = false;
      if (e && reduce.matches) e.destroy();
      else eng = e;
    }, () => { starting = false; });
  };
  // 中途开了「减弱动态效果」：拿掉画布，回到海报
  reduce.addEventListener('change', () => {
    if (reduce.matches) { eng?.destroy(); eng = null; } else start();
  });
  start();
}
