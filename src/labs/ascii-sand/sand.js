/* 用字符画（ASCII）画的一片沙丘，从正上方往下看。WebGL2 着色器画的沙丘只在离屏图里当底稿，屏幕上只有字。每帧两步：

     1. 沙（sand）：一片高低起伏的沙面，铺满画面。风从上往下吹（略偏右），沙丘一道道横着排，
        迎风坡缓、背风坡陡，坡顶是一道尖的棱，棱沿着横向弯弯曲曲；迎风坡上布满细的沙纹，一圈 period 往下风挪一道。
        太阳低低地挂在左上方：迎风坡亮，背风坡背着光，沙丘的影子落进下一道沙丘前的洼地（往太阳那边走几步看挡没挡住）。
        棱上不时被风扬起一缕缕沙，顺着风往下飘。
        底稿存四样：沙面的亮度、扬起的沙有多少、线（沙纹的脊、沙丘的棱、沟边的沙埂）在画面上的走向（二倍角，乘上有多像一条线）。
     2. 合成（composite）：整块切成 8px 见方的格子，每格都有字，不留空：
        像一条线的格子按走向挑 ~ \ | /，不转，就是老式的字符画；
        别的格子按沙面的亮度挑 . , : ; + * #：深色主题越亮越浓，浅色主题越暗越浓，两种主题看到的都是正片；
        扬起来的沙是另一个颜色的 . : *。画布是透明的，字以外露出网页自己的底色。

   鼠标、手指划过沙面：落点连成一条线，沿着它犁出一道沟，两边堆起沙埂，沟里的沙纹没了；
   风一点点把沟填平（六秒），沙纹再长回来。点一下：那里倒下一撮沙，堆成一个小沙堆，过一会儿被风吹散，顺着风拖出一道沙尾。

   所有会动的都是 t（一圈 period 毫秒）的函数：沙纹一圈正好往下风挪一道；扬起的沙用的噪声顺风方向是首尾相接的，
   一圈正好挪一个周期，录出来的视频首尾接得上。

   省着画：平时每秒 30 帧，划过、沙堆还在的时候跟着屏幕刷新；滚出屏幕、切到别的标签页就停；
   系统开了「减弱动态效果」，或者显卡是 CPU 模拟的（没有能用的显卡、无头浏览器），只画一帧不动的，也不跟着鼠标动。

     const d = create(canvas, { period: 12000 });
     d.pour();                       // 在随便一处倒一撮沙（键盘用）
     d.refresh();                    // 换了主题以后调：换字的颜色
     d.destroy();                    // 不用了：停下、摘掉监听、释放显存 */
import { context, program, fullscreen, target, canvasTexture, softwareGL } from "../_kit/gl.js";

const TRAIL = 64, TRAIL_LIFE = 6;   // 划过的线最多几个点、一道沟几秒填平
const TAPS = 6, TAP_LIFE = 5;       // 同时最多几个沙堆、一个沙堆几秒吹散

// 划过的点满了：不扔最老的那个（快划时后面一截沟会一下子平掉），而是去掉一个最不影响形状的中间点，
// 就是跟前后两个点围出的三角形最小的那个（几乎在一条直线上）。一笔的头尾、最新的那个点不动；全是单个的点才扔最老的
function thin(list) {
  let best = 0, least = Infinity;
  for (let i = 1; i < list.length - 1; i++) {
    if (list[i].start || list[i + 1].start) continue;
    const a = list[i - 1], b = list[i], c = list[i + 1];
    const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    if (area < least) { least = area; best = i; }
  }
  list.splice(best, 1);
}

// 颜色：沙面的字沿一条四个颜色的色带走，由淡的字到浓的字；扬起来的沙一个颜色。
// 深色主题是黄昏：背光的地方偏紫灰，向阳的是琥珀到浅金（越亮越浓）；
// 浅色主题是正午：由浅沙色到深褐（越暗越浓）
const COLORS = {
  dark: {
    sand: [[0.33, 0.29, 0.43], [0.58, 0.43, 0.42], [0.84, 0.62, 0.4], [1.0, 0.87, 0.64]], spray: [1.0, 0.95, 0.84],
    range: [0.05, 0.8],
  },
  light: {
    sand: [[0.79, 0.69, 0.55], [0.63, 0.48, 0.32], [0.44, 0.3, 0.18], [0.22, 0.13, 0.07]], spray: [0.55, 0.38, 0.2],
    range: [0.05, 0.85],
  },
};

// ---------- 字的图集 ----------
// 一行一格 64 见方。前 4 个是线 ~ \ | /，拉到顶满一格（横的拉宽、再拉高一点让波浪看得出来，竖的拉高、斜的拉到对角），一格接一格连成一道；
// 后面是面，由淡到浓 . , : ; + * #，不拉。每个字按墨迹居中，再描一圈边，笔画粗一点
const GLYPHS = ["~", "\\", "|", "/", ".", ",", ":", ";", "+", "*", "#"], LINES = 4;
const T = 64;
function drawAtlas(c) {
  const g = c.getContext("2d");
  c.width = T * GLYPHS.length; c.height = T;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = g.strokeStyle = "#fff"; g.lineJoin = "round";
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.font = '500 50px "DM Mono", ui-monospace, monospace';
  GLYPHS.forEach((ch, i) => {
    const m = g.measureText(ch);
    const l = m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight, up = m.actualBoundingBoxAscent, dn = m.actualBoundingBoxDescent;
    const w = Math.max(1, l + r), h = Math.max(1, up + dn);
    const sx = i === 0 || i === 1 || i === 3 ? (0.98 * T) / w : 1, sy = i >= 1 && i <= 3 ? (0.98 * T) / h : i === 0 ? 1.6 : 1;
    g.save();
    g.translate(i * T + T / 2, T / 2); g.scale(sx, sy);
    const x = -(r - l) / 2, y = (up - dn) / 2;
    g.lineWidth = i < LINES ? 7 / Math.sqrt(sx * sy) : 2;   // 线拉长以后描边也跟着变形，按拉的倍数缩回去；线描粗一点，压得住旁边的沙粒
    g.fillText(ch, x, y); g.strokeText(ch, x, y);
    g.restore();
  });
}

// ---------- 着色器 ----------
const QUAD_VS = /* glsl */ `
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// 底稿：r 是沙面的亮度，g 是扬起来的沙有多少，b、a 是线在画面上的走向，
// 存成二倍角（cos 2θ、sin 2θ）再乘上「有多像一条线」：一道横线转 180° 还是它，一格取平均才不会正反抵消；
// 不在线上的地方是 0，平均下来越短，说明这一格越不像一条线。
// 沙上的长度单位：画面短边的一半左右算 1（见引擎里的 scale），uPx 是一个像素有多长
const SAND_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec2 uView;               // 画面盖住多大一片沙
  uniform float uU, uPx, uCellW;    // 一圈里走到哪（0 到 1）；一个像素、一格字在沙上多长
  uniform float uRip, uGroove, uPile;   // 沙纹多宽、沟多宽（一半）、沙堆多大（半径）
  uniform vec3 uSun;                // 太阳的方向
  uniform float uRelief;            // 打光时沙丘的坡度放大几倍
  uniform vec4 uTrail[${TRAIL}];    // 划过的点，由旧到新：x、y、过了几秒、是不是一笔的开头
  uniform float uTrailN;
  uniform vec4 uTap[${TAPS}];       // 沙堆：x、y、过了几秒、随机数
  uniform float uTapN;
  const vec2 WD = vec2(0.14, -0.9902);    // 风往哪吹（往下，略偏右）
  const vec2 WC = vec2(0.9902, 0.14);    // 横着风的方向
  const float LD = 1.25, FC = 0.72;       // 一道沙丘多宽（顺风方向）；坡顶在一道沙丘的哪儿（前面是迎风坡，后面是背风坡）
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // x 方向每 per 格首尾相接的噪声：扬起的沙顺风挪一个周期，正好回到原处
  float vnoiseP(vec2 x, float per) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    float i0 = mod(i.x, per), i1 = mod(i.x + 1.0, per);
    return mix(mix(h21(vec2(i0, i.y)), h21(vec2(i1, i.y)), f.x), mix(h21(vec2(i0, i.y + 1.0)), h21(vec2(i1, i.y + 1.0)), f.x), f.y);
  }
  // 一道沙丘（沙纹也一样）顺风切开的样子，0 到 1：迎风坡缓，到坡顶还带着坡度（是一道尖棱），背风坡陡，坡脚收平
  float profile(float f, float fc) {
    if (f < fc) { float x = f / fc; return x * x * (1.6 - 0.6 * x); }
    float y = (f - fc) / (1.0 - fc);
    return pow(1.0 - y, 1.4);
  }
  // 沙丘：顺风方向上走到第几道（小数部分是在一道沙丘的哪儿），棱横着弯弯曲曲
  float duneS(vec2 p) {
    float a = dot(p, WD), c = dot(p, WC);
    float off = 0.12 * sin(c * 1.5 + 0.6) + 0.05 * sin(c * 3.7 + 2.0) + 0.22 * (vnoise(vec2(c * 0.7, 3.7)) - 0.5);
    return (a + off) / LD;
  }
  float duneH(vec2 p, float s) {
    float amp = 0.13 * (0.7 + 0.6 * vnoise(vec2(dot(p, WC) * 0.8, s * 0.7 + 11.0)));
    return amp * profile(fract(s), FC);
  }
  // 沙纹：顺风方向上第几道，弯一点，一圈往下风挪一道
  float rippleP(vec2 p) {
    float a = dot(p, WD) / uRip, c = dot(p, WC) / uRip;
    float w = 0.6 * sin(c * 0.33 + 1.3) + 1.4 * (vnoise(vec2(c * 0.15, a * 0.1)) - 0.5) + 0.35 * (vnoise(vec2(c * 0.45, a * 0.3) + 7.0) - 0.5);
    return a + w - uU;
  }
  // 沙纹长在哪儿：迎风坡和洼地里有，坡顶到背风坡没有（太陡，沙一直在往下滑）；沟里被抹掉的地方也没有
  float rippleMask(float f, float erase) {
    return (1.0 - smoothstep(FC - 0.1, FC - 0.02, f)) * smoothstep(0.0, 0.08, f) * (1.0 - erase);
  }
  // 沙纹的高度
  float rippleH(vec2 p, float erase) {
    return uRip * 0.09 * profile(fract(rippleP(p)), 0.68) * rippleMask(fract(duneS(p)), erase);
  }
  // 沙堆：倒下去 0.45 秒堆起来，一秒后风开始吹，顺风挪、拉长、矮下去
  // h、g 是高度和坡度；edge 是离沙堆的底边多远（沿着坡往外量），tan 是底边在这儿的走向
  void pile(vec4 P, vec2 p, out float h, out vec2 g, out float blow, out vec2 cen, out float edge, out vec2 tan) {
    float a = P.z, grow = smoothstep(0.0, 0.45, a);
    blow = smoothstep(1.0, ${TAP_LIFE}.0, a);
    cen = P.xy + WD * uPile * 1.4 * blow;
    float sa = 1.0 + 1.3 * blow, R = uPile * (0.55 + 0.45 * grow), Hc = 0.62 * R * grow * (1.0 - blow);
    vec2 q = p - cen;
    float qa = dot(q, WD) / sa, qc = dot(q, WC), k = 0.12 * R;
    float rr = sqrt(qa * qa + qc * qc + k * k), r = rr - k;   // 顶上圆一点
    h = Hc * max(0.0, 1.0 - r / R);
    vec2 dr = (qa * WD / sa + qc * WC) / rr;   // r 往哪个方向长得最快
    g = r < R ? -Hc / R * dr : vec2(0.0);
    edge = abs(r - R) / max(length(dr), 1e-3);
    tan = normalize(vec2(-dr.y, dr.x) + 1e-6);
  }
  float pilesH(vec2 p) {
    float h = 0.0, ph, bl, ed; vec2 pg, cn, tn;
    for (int i = 0; i < ${TAPS}; i++) {
      if (float(i) >= uTapN) break;
      pile(uTap[i], p, ph, pg, bl, cn, ed, tn);
      h += ph;
    }
    return h;
  }
  // 到一段线段的距离，t 是落在线段上哪儿（0 到 1）
  float seg(vec2 p, vec2 a, vec2 b, out float t) {
    vec2 ab = b - a; float l2 = dot(ab, ab);
    t = l2 > 1e-10 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
    return length(p - a - ab * t);
  }
  void main() {
    vec2 p = (vUv - 0.5) * uView;
    float a = dot(p, WD), c = dot(p, WC);

    // 沟：找对这一点影响最大的那一段（新的、近的），沟按噪声抖一抖，边是参差的
    vec2 pj = p + uGroove * 0.5 * (vec2(vnoise(p / uGroove * 0.6 + 1.7), vnoise(p / uGroove * 0.6 + 9.2)) - 0.5);
    float best = 0.0, gd = 1e3, gamp = 0.0, gw = uGroove;
    vec2 gc = p, gdir = WC;
    for (int i = 0; i < ${TRAIL}; i++) {
      if (float(i) >= uTrailN) break;
      vec4 B = uTrail[i], A = (i == 0 || B.w > 0.5) ? B : uTrail[max(i - 1, 0)];
      float t, d = seg(pj, A.xy, B.xy, t), ag = mix(A.z, B.z, t);
      float fill = smoothstep(0.8, ${TRAIL_LIFE}.0, ag), amp = 1.0 - fill, w = uGroove * (1.0 + 0.6 * fill);
      float score = amp * exp(-d * d / (9.0 * w * w));
      if (score > best) {
        best = score; gd = d; gamp = amp; gw = w; gc = mix(A.xy, B.xy, t);
        vec2 ab = B.xy - A.xy;
        if (dot(ab, ab) > 1e-10) gdir = normalize(ab);
      }
    }
    // 沟的横截面：中间凹下去，两边各堆起一道沙埂。高度连同坡度一起算
    float D = 0.9 * uGroove, Bh = 0.35 * D, db = 1.75 * gw, wb = 0.65 * gw;
    float e1 = exp(-gd * gd / (gw * gw)), x2 = (gd - db) / wb, e2 = exp(-x2 * x2);
    float gh = gamp * (-D * e1 + Bh * e2);
    vec2 rdir = gd > 1e-6 ? (pj - gc) / gd : vec2(0.0);
    vec2 ggrad = gamp * (D * 2.0 * gd / (gw * gw) * e1 - Bh * 2.0 * x2 / wb * e2) * rdir;
    float erase = gamp * exp(-gd * gd / (4.0 * gw * gw));   // 沟和沙埂上没有沙纹，填平了再长回来

    // 沙堆
    float ph = 0.0, spray = 0.0, rim = 0.0;
    vec2 pg = vec2(0.0), rimDir = WC;
    vec2 cid = floor(gl_FragCoord.xy * 0.5);   // 这一点落在屏幕上哪一格（底稿一格两个像素）：一格里取同一个随机数
    for (int i = 0; i < ${TAPS}; i++) {
      if (float(i) >= uTapN) break;
      vec4 P = uTap[i];
      float hh, bl, ed; vec2 gg, cen, tn;
      pile(P, p, hh, gg, bl, cen, ed, tn);
      ph += hh; pg += gg;
      // 沙堆的底边描一圈线，风吹的时候跟着拉长、变淡
      float rm = smoothstep(0.1, 0.4, P.z) * (1.0 - smoothstep(0.3, 0.8, bl)) * (1.0 - smoothstep(uCellW * 0.3, uCellW * 0.65, ed));
      if (rm > rim) { rim = rm; rimDir = tn; }
      erase = max(erase, clamp(hh / (0.05 * uPile), 0.0, 1.0));   // 沙堆盖住的地方没有沙纹
      vec2 q = p - P.xy;
      float r = length(q), ag = P.z;
      // 倒下来的沙粒：头 0.6 秒里落点一圈闪着亮的沙
      float fall = (1.0 - smoothstep(0.3, 0.7, ag)) * (1.0 - smoothstep(uPile * 0.6, uPile * 1.3, r));
      spray = max(spray, fall * step(0.6, h21(cid + floor(ag * 24.0) * 7.13 + P.w * 50.0)));
      // 被风吹散：顺风拖出一道沙尾，一缕一缕往下风走
      vec2 qc = p - cen;
      float down = dot(qc, WD), side = dot(qc, WC);
      float tail = smoothstep(-0.3 * uPile, 0.2 * uPile, down) * (1.0 - smoothstep(uPile, uPile * 4.0, down)) * exp(-side * side / (uPile * uPile * 0.5));
      float wisp = smoothstep(0.45, 0.8, vnoise(vec2(down / uPile * 1.5 - ag * 6.0, side / uPile * 4.0) + P.w * 13.0));
      spray = max(spray, tail * wisp * smoothstep(0.0, 0.25, bl) * (1.0 - smoothstep(0.6, 1.0, bl)));
    }
    // 沙面：沙丘 + 沙纹，坡度用差分算。打光时沙丘的坡度放大一些，起伏才看得出来（影子还按真的高度算）
    float e = 2.0 * uPx;
    float hd = duneH(p, duneS(p)), hr = rippleH(p, erase);
    vec2 dx = p + vec2(e, 0.0), dy = p + vec2(0.0, e);
    vec2 grad = uRelief * vec2(duneH(dx, duneS(dx)) - hd, duneH(dy, duneS(dy)) - hd) / e
              + vec2(rippleH(dx, erase) - hr, rippleH(dy, erase) - hr) / e;
    float h0 = hd + hr;
    grad += ggrad + 1.5 * pg;   // 沙堆也放大一点坡度，明暗两面分得开

    // 光：低低的太阳，漫射，加一点天光；往太阳那边走几步，看沙丘、沙堆挡没挡住（软一点的影子）
    vec3 n = normalize(vec3(-grad, 1.0));
    float dif = max(dot(n, uSun), 0.0);
    vec2 sh2 = normalize(uSun.xy);
    float tanEl = uSun.z / length(uSun.xy), sh = 1.0;
    float hs0 = duneH(p, duneS(p)) + ph;
    for (int i = 1; i <= 14; i++) {
      float t = float(i) * 0.04;
      vec2 q = p + sh2 * t;
      float hq = duneH(q, duneS(q)) + (uTapN > 0.0 ? pilesH(q) : 0.0);
      sh = min(sh, clamp((hs0 + t * tanEl - hq) * 14.0 / t + 0.5, 0.0, 1.0));
    }
    float lum = 0.1 + 0.1 * n.z + 0.75 * dif * mix(0.25, 1.0, sh);

    // 风从坡顶扬起一缕缕沙，顺着风往下飘，落在背风坡上
    float s = duneS(p), f = fract(s);
    float crest = smoothstep(FC - 0.05, FC, f) * (1.0 - smoothstep(FC + 0.03, FC + 0.16, f));
    float wn = vnoiseP(vec2(a * 2.2 - uU * 8.0, c * 11.0), 8.0);
    spray = max(spray, crest * smoothstep(0.55, 0.85, wn) * 0.9);

    // 线：沙纹的脊、沙丘的棱、沟两边的沙埂，记下走向
    float er = 0.5 * uPx;
    float rp = rippleP(p);
    vec2 rg = vec2(rippleP(p + vec2(er, 0.0)) - rp, rippleP(p + vec2(0.0, er)) - rp) / er;
    float dr = abs(fract(rp - 0.68 + 0.5) - 0.5) / max(length(rg), 1e-3);
    // 沙纹的脊只在一片一片的地方画成线（全画上像一张横格纸，压过了沙丘的明暗），别处只靠明暗；线比旁边暗一点（脊后面那一小条背着光）
    float patchy = smoothstep(0.58, 0.72, vnoise(p / uRip * 0.22 + 4.1));
    float line = (1.0 - smoothstep(uCellW * 0.28, uCellW * 0.6, dr)) * rippleMask(f, erase) * patchy;
    vec2 dir = normalize(vec2(-rg.y, rg.x));
    lum *= 1.0 - 0.3 * line;   // 沙纹的脊画成比旁边暗一点的细线（脊后面那一小条背着光），不抢沙丘的明暗
    vec2 sg = vec2(duneS(p + vec2(er, 0.0)) - s, duneS(p + vec2(0.0, er)) - s) / er;
    float dbk = abs(f - FC) / max(length(sg), 1e-3);
    float brink = (1.0 - smoothstep(uCellW * 0.3, uCellW * 0.7, dbk)) * (1.0 - erase);
    if (brink > line) { line = brink; dir = normalize(vec2(-sg.y, sg.x)); }
    lum = max(lum, 0.92 * brink);   // 棱最先迎着光，最亮
    // 背风坡上一道道往下流的沙（顺着坡往下的细线），疏一点
    float slip = smoothstep(FC + 0.01, FC + 0.04, f) * (1.0 - smoothstep(0.9, 0.98, f)) * (1.0 - erase);
    float flow = slip * smoothstep(0.62, 0.8, vnoise(vec2(c / uCellW * 0.55, a * 3.0 + 5.0))) * 0.8;
    if (flow > line) { line = flow; dir = WD; }
    if (rim > line) { line = rim; dir = rimDir; }
    float berm = gamp * (1.0 - smoothstep(uCellW * 0.3, uCellW * 0.65, abs(gd - db)));
    if (berm > line) { line = berm; dir = gdir; }
    vec2 t2 = vec2(dir.x * dir.x - dir.y * dir.y, 2.0 * dir.x * dir.y) * line;
    o = vec4(clamp(lum, 0.0, 1.0), clamp(spray, 0.0, 1.0), t2 * 0.5 + 0.5);
  }
`;

const COMP_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uSand, uAtlas;
  uniform vec2 uRes, uCells;        // 画布（设备像素）；底稿有几列几行格子（比画布多出不到一格）
  uniform float uCell, uLod, uN;    // 一格多少设备像素、取平均用的 mipmap 层（底稿一格两个像素，第 1 层正好一格一个）、图集里有几个字
  uniform vec2 uRange;              // 沙面的亮度从 x 到 y 铺满由淡到浓的字
  uniform float uDark;              // 深色主题：越亮越浓；浅色主题反过来
  uniform vec3 uC0, uC1, uC2, uC3;  // 沙面的色带
  uniform vec3 uSpray;              // 扬起来的沙
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) / uCells;
    vec4 s = textureLod(uSand, vec2(c0.x, 1.0 - c0.y), uLod);
    float r1 = hash(cell);
    vec2 t2 = s.ba * 2.0 - 1.0;
    float m = length(t2), spray = s.g;
    float nf = uN - ${LINES}.0;
    // 沙面的亮度换成由淡到浓：深色主题越亮越浓，浅色主题越暗越浓；抖一点，但不能抖出这一段（会挑到前面的线）
    float lv = clamp((s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.08, 0.0, 0.999);
    if (uDark < 0.5) lv = 0.999 - lv;
    float gi; vec3 col = ramp(lv);
    if (spray > 0.3 && m < 0.5) {
      // 扬起来的沙：. : * 由少到多，换一个颜色
      float k = clamp((spray - 0.3) / 0.6, 0.0, 0.999);
      gi = ${LINES}.0 + (k < 0.4 ? 0.0 : k < 0.75 ? 2.0 : 5.0);
      col = mix(col, uSpray, 0.55 + 0.45 * k);
    } else if (m > 0.3) {
      // 沙纹的脊、沙丘的棱、沙埂：按走向挑 ~ \\ | /（沙上 y 朝上：往右上走的是 /）；颜色跟着这里的明暗走，
      // 沙纹跟旁边的沙一样亮，只是换成顺着走向的字；棱在底稿里就是最亮的，自己会跳出来
      float phi = 0.5 * atan(t2.y, t2.x);
      gi = abs(phi) < 0.3927 ? 0.0 : abs(phi) > 1.1781 ? 2.0 : phi > 0.0 ? 3.0 : 1.0;
    } else {
      gi = ${LINES}.0 + floor(lv * nf);
    }
    vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
    float ink = 0.0;
    // 图集按一格的大小取 mipmap 层：自动挑层的话，格子交界处相邻两个像素取的字隔得老远，会挑到最糊的一层，每行之间多出一道灰线
    if (abs(loc.x) < 0.5 && abs(loc.y) < 0.5) ink = textureLod(uAtlas, vec2((gi + loc.x + 0.5) / uN, 0.5 - loc.y), log2(${T}.0 / uCell)).r;
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
  const sandP = program(gl, QUAD_VS, SAND_FS), compP = program(gl, QUAD_VS, COMP_FS);

  // 划过的点：沙上的 x、y（y 朝上），什么时候划过的（毫秒），是不是一笔的开头
  const trail = [], trailU = new Float32Array(TRAIL * 4);
  // 沙堆：x、y，什么时候倒的，随机数
  const taps = [], tapU = new Float32Array(TAPS * 4);
  let sandRT = null, cols = 1, rows = 1, scale = 300, view = [1, 1];

  const atlasCanvas = document.createElement("canvas");
  drawAtlas(atlasCanvas);
  const atlas = canvasTexture(gl, atlasCanvas);

  let W = 0, H = 0, dpr = 1, raf = 0, visible = true, last = -1e9, dead = false, dark = false;

  function readTheme() { dark = getComputedStyle(canvas).colorScheme.includes("dark"); }
  function relayout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    cols = Math.ceil(W / cell); rows = Math.ceil(H / cell);
    // 沙上的 1 是多少像素：短边的四成，夹在 120 到 300 之间。一道沙丘 1.25，卡片上看得到一两道，详情页上两三道
    scale = Math.min(300, Math.max(120, Math.min(W, H) * 0.42));
    view = [(cols * cell) / scale, (rows * cell) / scale];
    sandRT?.dispose();
    // 底稿一格两个像素：第 1 层 mipmap 正好一格一个，取平均不用自己算
    sandRT = target(gl, cols * 2, rows * 2, { mipmaps: true });
    readTheme();
    paint(true);
  }

  // 画面上一点 → 沙上的位置
  const toSand = (x, y) => [(x / (cols * cell) - 0.5) * view[0], (0.5 - y / (rows * cell)) * view[1]];
  // 鼠标、手指：划的时候最新的一个点一直跟着手走，离上一个记下的点 28px 或者 90ms 就再记一个；
  // 停下 250ms 以上、移出画面，再动就是新的一笔
  let head = null, lastX = 0, lastY = 0, lastAt = -1e9;
  function push(pt) { trail.push(pt); if (trail.length > TRAIL) thin(trail); }
  function sweep(x, y, now) {
    const [sx, sy] = toSand(x, y);
    if (!head || now - head.t > 250) {
      head = { x: sx, y: sy, t: now, start: true }; push(head); lastX = x; lastY = y; lastAt = now;
    } else if (Math.hypot(x - lastX, y - lastY) >= 28 || now - lastAt >= 90 || trail[trail.length - 1] !== head || head.start) {
      head = { x: sx, y: sy, t: now, start: false }; push(head); lastX = x; lastY = y; lastAt = now;
    } else Object.assign(head, { x: sx, y: sy, t: now });
    paint(true);
  }
  function pourAt(x, y, now) {
    const [sx, sy] = toSand(x, y);
    // 鼠标挪过来时在这儿按下的那个单独的点（还没划开）不算沟，不然沙堆坐在一个坑里
    if (head && head.start && trail[trail.length - 1] === head) trail.pop();
    taps.push({ x: sx, y: sy, t: now, seed: Math.random() });
    if (taps.length > TAPS) taps.shift();
    head = null;
    paint(true);
  }
  const at = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onMove = (e) => { if (still || !W) return; const [x, y] = at(e); sweep(x, y, performance.now()); };
  const onDown = (e) => { if (still || !W) return; const [x, y] = at(e); pourAt(x, y, performance.now()); };
  const onLeave = () => { head = null; };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerleave", onLeave);

  // 太阳：左上方，仰角 21°
  const az = 2.0, el = 0.36;
  const sun = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];

  function frame(now) {
    raf = 0;
    if (dead || !W || !sandRT) return;
    // 过了时候的点、沙堆扔掉；剩下的由旧到新传给着色器，最旧的那个就是一笔的开头
    while (trail.length && (now - trail[0].t) / 1000 >= TRAIL_LIFE) trail.shift();
    if (!trail.length) head = null;
    trail.forEach((p, i) => trailU.set([p.x, p.y, Math.max(0, (now - p.t) / 1000), i === 0 || p.start ? 1 : 0], i * 4));
    while (taps.length && (now - taps[0].t) / 1000 >= TAP_LIFE) taps.shift();
    taps.forEach((p, i) => tapU.set([p.x, p.y, Math.max(0, (now - p.t) / 1000), p.seed], i * 4));
    const busy = trail.length > 0 || taps.length > 0;
    // 平时每秒 fps 帧；划过、沙堆还在的时候每帧都画，跟得上手
    if (!still && !busy && now - last < 1000 / fps - 2) { schedule(); return; }
    last = now;
    const u = still ? 0 : (((now % period) + period) % period) / period;
    sandRT.bind();
    sandP.use({
      uView: view, uU: u, uPx: 1 / scale, uCellW: cell / scale, uRip: 40 / scale, uGroove: 13 / scale, uPile: 46 / scale, uSun: sun, uRelief: 2.2,
      uTrail: trailU, uTrailN: trail.length, uTap: tapU, uTapN: taps.length,
    });
    tri.draw();
    sandRT.mip();
    // 合成到画布上
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const C = COLORS[dark ? "dark" : "light"];
    compP.use({
      uSand: [sandRT.tex, 0], uAtlas: [atlas.tex, 1], uRes: [canvas.width, canvas.height], uCells: [cols, rows], uCell: cell * dpr,
      uLod: 1, uN: GLYPHS.length, uRange: C.range, uDark: dark ? 1 : 0,
      uC0: C.sand[0], uC1: C.sand[1], uC2: C.sand[2], uC3: C.sand[3], uSpray: C.spray,
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
    pour() { if (!still && W) pourAt(W * (0.25 + Math.random() * 0.5), H * (0.25 + Math.random() * 0.5), performance.now()); },
    refresh() { readTheme(); paint(true); },
    destroy() {
      dead = true; cancelAnimationFrame(raf); raf = 0;
      io.disconnect(); ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      motion.removeEventListener("change", onMotion);
      sandRT?.dispose(); atlas.dispose(); tri.dispose();
      sandP.dispose(); compP.dispose();
      // 上下文不强行丢掉：同一个 canvas 再挂一次（开发时 React 会挂两遍）还要用
    },
  };
}

export { create };
