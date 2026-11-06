/* 用字符画（ASCII）画的一片沙丘。WebGL2 着色器画的沙漠只在离屏图里当底稿，屏幕上只有字。每帧两步：

     1. 沙漠（sand）：镜头站在沙丘上，往前下方看，地平线在画面上面七分之一处，上面是天。
        每个像素往沙面打一条光线，一步步走到碰上沙为止（高度场的光线步进）。沙丘一道道横着风排开：
        迎风坡缓，坡顶是一道尖的棱，背风坡陡；棱沿着横向弯弯曲曲，每道高矮不一，底下再垫一层很缓的起伏。
        迎风坡和洼地里布满细的沙纹，一圈 period 往下风挪一道；远到一格字装不下一道沙纹的地方只留走向，不留明暗。
        太阳低低地挂在左后方：朝着镜头的迎风坡亮，背风坡背着光，沙丘的影子拖得很长（往太阳那边走几步看挡没挡住）；
        越远越被沙尘的雾抹平，到地平线跟天接上。棱上不时被风扬起一缕缕沙，顺着风往下飘。
        底稿存三样：亮度、扬起的沙有多少、字该朝哪个方向放（沙纹的走向，没有沙纹就顺着沙丘的等高线，投到画面上，存成二倍角）。
     2. 合成（composite）：整块切成 8px 见方的格子，每格都有字，不留空。跟 ASCII Waves 一个做法：
        沙按亮度从 - ~ = 里挑，颜色沿一条色带走，字再转到沙纹的走向上，一道道沙纹就被字描出来，跟着透视往远处收；
        扬起来的沙是另一个颜色的 . : *，不转。画布是透明的，字以外露出网页自己的底色。

   鼠标、手指划过沙面：从画面上那一点往沙面打一条光线，落点连成一条线，沿着它犁出一道沟，两边堆起沙埂，沟里的沙纹没了；
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

// 颜色：沙的字沿一条四个颜色的色带走，由淡的字到浓的字；扬起来的沙一个颜色。
// 深色主题是黄昏：背光的地方是暗紫，往亮里走是灰玫瑰、琥珀、浅金（越亮越浓）；
// 浅色主题像钢笔画：由浅沙色到深褐，越暗越浓，影子是一片密密的墨
const COLORS = {
  dark: {
    sand: [[0.3, 0.26, 0.5], [0.72, 0.42, 0.45], [1.0, 0.66, 0.36], [1.0, 0.92, 0.7]], spray: [1.0, 0.95, 0.85],
    range: [0.31, 0.62], dense: 1.8,
  },
  light: {
    sand: [[0.55, 0.43, 0.3], [0.45, 0.32, 0.2], [0.33, 0.21, 0.12], [0.18, 0.1, 0.05]], spray: [0.5, 0.32, 0.16],
    range: [0.31, 0.62], dense: 1,
  },
};

// ---------- 沙漠的形状：着色器和引擎（找鼠标落在沙上哪一点）共用一份 ----------
// 长度单位随便取，镜头离地 1.1；风往远处吹、略偏右，沙丘的棱横着排，迎风坡朝着镜头
const WIND = (() => { const x = 0.25, z = -1, l = Math.hypot(x, z); return [x / l, z / l]; })();
const LD = 2.3, FC = 0.74, AMP = 0.42;   // 一道沙丘顺风多宽；坡顶在一道沙丘的哪儿（前面是迎风坡，后面是背风坡）；多高
const RW = 0.11;                         // 沙纹多宽
const CAM_H = 1.1, HORIZON = 0.7;        // 镜头多高；地平线在画面上的位置（-1 最下，1 最上）
const TMAX = 70;                         // 光线最远走多远，再远就是天

// 噪声的格点用整数哈希（没有 sin，也不靠浮点数的尾数）：JS 里用 Math.imul 能算出一模一样的数，鼠标落点才对得上
const GLSL_TERRAIN = /* glsl */ `
  const vec2 WD = vec2(${WIND[0]}, ${WIND[1]});     // 风往哪吹（地面上 x、z）
  const vec2 WC = vec2(${-WIND[1]}, ${WIND[0]});    // 横着风的方向
  const float LD = ${LD}, FC = ${FC}, AMP = ${AMP}, RW = ${RW};
  float h21(vec2 p) {
    uvec2 q = uvec2(ivec2(floor(p))) * uvec2(1597334673u, 3812015801u);
    uint n = (q.x ^ q.y) * 1597334673u;
    return float(n) * (1.0 / 4294967295.0);
  }
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
    float off = 0.42 * sin(c * 0.7 + 0.6) + 0.14 * sin(c * 1.9 + 2.0) + 0.7 * (vnoise(vec2(c * 0.4, 3.7)) - 0.5);
    return (a + off) / LD;
  }
  float duneH(vec2 p) {
    float s = duneS(p), id = floor(s);
    float amp = AMP * (0.55 + 0.8 * vnoise(vec2(dot(p, WC) * 0.3, id * 1.7 + 11.0)));
    return amp * profile(s - id, FC) + 0.45 * vnoise(p * 0.09 + 5.0);   // 底下再垫一层很缓的起伏
  }
`;

// JS 里同一份沙丘（只用来找鼠标、手指落在沙上哪一点）
const imul = Math.imul;
function h21(x, y) {
  const qx = imul(Math.floor(x) | 0, 1597334673) >>> 0, qy = imul(Math.floor(y) | 0, 3812015801 | 0) >>> 0;
  return (imul((qx ^ qy) >>> 0, 1597334673) >>> 0) / 4294967295;
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h21(ix, iy), b = h21(ix + 1, iy), c = h21(ix, iy + 1), d = h21(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function profile(f, fc) {
  if (f < fc) { const x = f / fc; return x * x * (1.6 - 0.6 * x); }
  return Math.pow(1 - (f - fc) / (1 - fc), 1.4);
}
function duneH(x, z) {
  const a = x * WIND[0] + z * WIND[1], c = -x * WIND[1] + z * WIND[0];
  const off = 0.42 * Math.sin(c * 0.7 + 0.6) + 0.14 * Math.sin(c * 1.9 + 2.0) + 0.7 * (vnoise(c * 0.4, 3.7) - 0.5);
  const s = (a + off) / LD, id = Math.floor(s);
  const amp = AMP * (0.55 + 0.8 * vnoise(c * 0.3, id * 1.7 + 11));
  return amp * profile(s - id, FC) + 0.45 * vnoise(x * 0.09 + 5, z * 0.09 + 5);
}

// ---------- 字的图集 ----------
// 一行一格 64 见方（字要转，格子得是正方形）。前 3 个是沙，由淡到浓 - ~ =，横着拉宽，一格接一格连成一道道沙纹；
// 后 3 个是扬起来的沙，由淡到浓 . : *，不拉宽。每个字按墨迹居中，再描一圈边，笔画粗一点
const GLYPHS = ["-", "~", "=", ".", ":", "*"], SAND = 3;
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
    const sx = i < SAND ? Math.max(1, Math.min(1.8, (0.84 * T) / (l + r))) : 1;
    g.save();
    g.translate(i * T + T / 2, T / 2); g.scale(sx, 1);
    const x = -(r - l) / 2, y = (up - dn) / 2;
    g.lineWidth = i < SAND ? 4.5 : 3;   // 沙的字是细线，描粗一点才压得住整块
    g.fillText(ch, x, y); g.strokeText(ch, x, y);
    g.restore();
  });
}

// ---------- 着色器 ----------
const QUAD_VS = /* glsl */ `
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// 底稿：r 是亮度，g 是扬起来的沙有多少，b、a 是字该朝的方向（画面上，y 朝下），
// 存成二倍角（cos 2θ、sin 2θ）再乘上「有多确定」：一道横线转 180° 还是它，一格取平均才不会正反抵消
const SAND_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec3 uCamR, uCamU, uCamF;   // 镜头往右、往上、往前
  uniform vec2 uTan;                  // 画面右边沿、上边沿的 tan
  uniform float uU;                   // 一圈里走到哪（0 到 1）
  uniform float uFoot;                // 底稿一个像素，在 1 远的地方有多宽
  uniform vec3 uSun;                  // 太阳的方向
  uniform float uGroove, uPile;       // 沟多宽（一半）、沙堆多大（半径）
  uniform vec4 uTrail[${TRAIL}];      // 划过的点，由旧到新：x、z、过了几秒、是不是一笔的开头
  uniform float uTrailN;
  uniform vec4 uTap[${TAPS}];         // 沙堆：x、z、过了几秒、随机数
  uniform float uTapN;
  const vec3 RO = vec3(0.0, ${CAM_H}, 0.0);
  ${GLSL_TERRAIN}
  // 沙纹：顺风方向上第几道，弯一点，一圈往下风挪一道
  float rippleP(vec2 p) {
    float a = dot(p, WD) / RW, c = dot(p, WC) / RW;
    float w = 0.6 * sin(c * 0.33 + 1.3) + 1.4 * (vnoise(vec2(c * 0.15, a * 0.1)) - 0.5) + 0.35 * (vnoise(vec2(c * 0.45, a * 0.3) + 7.0) - 0.5);
    return a + w - uU;
  }
  // 沙纹长在哪儿：迎风坡和洼地里有，坡顶到背风坡没有（太陡，沙一直在往下滑）
  float rippleMask(vec2 p) {
    float f = fract(duneS(p));
    return (1.0 - smoothstep(FC - 0.06, FC - 0.01, f)) * smoothstep(0.0, 0.05, f);
  }
  // 沙堆：倒下去 0.45 秒堆起来，一秒后风开始吹，顺风挪、拉长、矮下去
  // h、g 是高度和坡度；blow 是被吹散了多少，cen 是现在的中心
  void pile(vec4 P, vec2 p, out float h, out vec2 g, out float blow, out vec2 cen) {
    float a = P.z, grow = smoothstep(0.0, 0.45, a);
    blow = smoothstep(1.0, ${TAP_LIFE}.0, a);
    cen = P.xy + WD * uPile * 1.4 * blow;
    float sa = 1.0 + 1.3 * blow, R = uPile * (0.55 + 0.45 * grow), Hc = 0.62 * R * grow * (1.0 - blow);
    vec2 q = p - cen;
    float qa = dot(q, WD) / sa, qc = dot(q, WC), k = 0.12 * R;
    float rr = sqrt(qa * qa + qc * qc + k * k), r = rr - k;   // 顶上圆一点
    h = Hc * max(0.0, 1.0 - r / R);
    vec2 dr = (qa * WD / sa + qc * WC) / rr;
    g = r < R ? -Hc / R * dr : vec2(0.0);
  }
  float pilesH(vec2 p) {
    float h = 0.0, ph, bl; vec2 pg, cn;
    for (int i = 0; i < ${TAPS}; i++) {
      if (float(i) >= uTapN) break;
      pile(uTap[i], p, ph, pg, bl, cn);
      h += ph;
    }
    return h;
  }
  float groundH(vec2 p) { return duneH(p) + (uTapN > 0.0 ? pilesH(p) : 0.0); }
  // 到一段线段的距离，t 是落在线段上哪儿（0 到 1）
  float seg(vec2 p, vec2 a, vec2 b, out float t) {
    vec2 ab = b - a; float l2 = dot(ab, ab);
    t = l2 > 1e-10 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
    return length(p - a - ab * t);
  }
  // 天：越往上越暗，地平线上一层亮的沙尘，太阳那边一团光
  float skyL(vec3 rd) {
    float up = max(rd.y, 0.0), s = max(dot(rd, uSun), 0.0);
    return 0.1 + 0.42 * exp(-up * 7.0) + 0.35 * pow(s, 10.0) + 0.5 * smoothstep(0.9993, 0.9997, s);
  }
  // 地面上一个方向 T（x、z）在 P 点投到画面上朝哪（y 朝下），存成二倍角
  vec2 screenDir(vec3 P, vec2 T) {
    vec3 d = P - RO, t3 = vec3(T.x, 0.0, T.y);
    float z = dot(d, uCamF), sx = dot(d, uCamR) / z, sy = dot(d, uCamU) / z;
    vec2 v = vec2((dot(t3, uCamR) - sx * dot(t3, uCamF)) / uTan.x, -(dot(t3, uCamU) - sy * dot(t3, uCamF)) / uTan.y);
    float m2 = dot(v, v);
    return m2 > 1e-14 ? vec2(v.x * v.x - v.y * v.y, 2.0 * v.x * v.y) / m2 : vec2(0.0);
  }
  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 rd = normalize(uCamF + ndc.x * uTan.x * uCamR + ndc.y * uTan.y * uCamU);
    // 往沙面走：每步走「离沙面还有多高」的一部分，越远步子可以越大
    float t = 0.3, hit = -1.0, lastT = t, lastD = 1.0;
    for (int i = 0; i < 140; i++) {
      vec3 q = RO + rd * t;
      float d = q.y - groundH(q.xz);
      if (d < 0.0) {
        // 碰上了：在上一步和这一步之间按高度差插一下
        hit = mix(lastT, t, lastD / (lastD - d));
        break;
      }
      lastT = t; lastD = d;
      t += max(0.4 * d, 0.0025 * t);
      if (t > ${TMAX}.0) break;
    }
    if (hit < 0.0) {
      // 天：字横着放
      o = vec4(clamp(skyL(rd), 0.0, 1.0), 0.0, 0.5, 0.5);
      return;
    }
    vec3 P = RO + rd * hit;
    vec2 p = P.xz;
    float foot = hit * uFoot;   // 这里底稿一个像素在沙上有多宽

    // 沟：找对这一点影响最大的那一段（新的、近的），沟按噪声抖一抖，边是参差的
    vec2 pj = p + uGroove * 0.5 * (vec2(vnoise(p / uGroove * 0.6 + 1.7), vnoise(p / uGroove * 0.6 + 9.2)) - 0.5);
    float best = 0.0, gd = 1e3, gamp = 0.0, gw = uGroove, gage = 9.0;
    vec2 gc = p;
    for (int i = 0; i < ${TRAIL}; i++) {
      if (float(i) >= uTrailN) break;
      vec4 B = uTrail[i], A = (i == 0 || B.w > 0.5) ? B : uTrail[max(i - 1, 0)];
      float tt, d = seg(pj, A.xy, B.xy, tt), ag = mix(A.z, B.z, tt);
      float fill = smoothstep(0.8, ${TRAIL_LIFE}.0, ag), amp = 1.0 - fill, w = uGroove * (1.0 + 0.6 * fill);
      float score = amp * exp(-d * d / (9.0 * w * w));
      if (score > best) { best = score; gd = d; gamp = amp; gw = w; gc = mix(A.xy, B.xy, tt); gage = ag; }
    }
    // 沟的横截面：中间凹下去，两边各堆起一道沙埂。高度连同坡度一起算
    float D = 0.9 * uGroove, Bh = 0.35 * D, db = 1.75 * gw, wb = 0.65 * gw;
    float e1 = exp(-gd * gd / (gw * gw)), x2 = (gd - db) / wb, e2 = exp(-x2 * x2);
    vec2 rdir = gd > 1e-6 ? (pj - gc) / gd : vec2(0.0);
    vec2 ggrad = gamp * (D * 2.0 * gd / (gw * gw) * e1 - Bh * 2.0 * x2 / wb * e2) * rdir;
    float erase = gamp * exp(-gd * gd / (4.0 * gw * gw));   // 沟和沙埂上没有沙纹，填平了再长回来

    // 刚犁过的那一截：翻起来的沙粒往两边溅，半秒里落下
    vec2 cid = floor(gl_FragCoord.xy * 0.5);   // 这一点落在屏幕上哪一格（底稿一格两个像素）：一格里取同一个随机数
    float spray = (1.0 - smoothstep(0.15, 0.7, gage)) * (1.0 - smoothstep(gw * 1.2, gw * 2.6, gd)) * step(0.55, h21(cid + floor(gage * 20.0) * 3.7));
    // 沙堆
    vec2 pg = vec2(0.0);
    for (int i = 0; i < ${TAPS}; i++) {
      if (float(i) >= uTapN) break;
      vec4 Pt = uTap[i];
      float hh, bl; vec2 gg, cen;
      pile(Pt, p, hh, gg, bl, cen);
      pg += gg;
      erase = max(erase, clamp(hh / (0.05 * uPile), 0.0, 1.0));   // 沙堆盖住的地方没有沙纹
      float r = length(p - Pt.xy), ag = Pt.z;
      // 倒下来的沙粒：头 0.6 秒里落点一圈闪着亮的沙
      float fall = (1.0 - smoothstep(0.3, 0.7, ag)) * (1.0 - smoothstep(uPile * 0.6, uPile * 1.3, r));
      spray = max(spray, fall * step(0.6, h21(cid + floor(ag * 24.0) * 7.13 + Pt.w * 50.0)));
      // 被风吹散：顺风拖出一道沙尾，一缕一缕往下风走
      vec2 qc = p - cen;
      float down = dot(qc, WD), side = dot(qc, WC);
      float tail = smoothstep(-0.3 * uPile, 0.2 * uPile, down) * (1.0 - smoothstep(uPile, uPile * 4.0, down)) * exp(-side * side / (uPile * uPile * 0.5));
      float wisp = smoothstep(0.45, 0.8, vnoise(vec2(down / uPile * 1.5 - ag * 6.0, side / uPile * 4.0) + Pt.w * 13.0));
      spray = max(spray, tail * wisp * smoothstep(0.0, 0.25, bl) * (1.0 - smoothstep(0.6, 1.0, bl)));
    }

    // 沙面的坡度：沙丘用差分，沙纹也用差分（远到装不下的地方淡掉），沟、沙堆是算好的
    float e = max(foot, 0.002);
    vec2 gdn = vec2(duneH(p + vec2(e, 0.0)) - duneH(p - vec2(e, 0.0)), duneH(p + vec2(0.0, e)) - duneH(p - vec2(0.0, e))) / (2.0 * e);
    float rmask = rippleMask(p) * (1.0 - erase);
    float er = RW * 0.08;
    float rp = rippleP(p);
    vec2 rg = vec2(rippleP(p + vec2(er, 0.0)) - rp, rippleP(p + vec2(0.0, er)) - rp) / er;   // 沙纹相位的梯度
    float fr = fract(rp);
    float slope = fr < 0.68 ? 1.0 / 0.68 * (2.0 * (fr / 0.68) * (1.6 - 0.6 * fr / 0.68) - 0.6 * (fr / 0.68) * (fr / 0.68)) : -1.4 / 0.32 * pow(max(1.0 - (fr - 0.68) / 0.32, 0.0), 0.4);
    float keep = smoothstep(2.5, 6.0, RW / foot);   // 一道沙纹在底稿上至少几个像素才画明暗，不然只剩噪点
    vec2 grp = RW * 0.14 * slope * rg * rmask * keep;
    vec2 grad = gdn + grp + ggrad + 1.5 * pg;

    // 光：低低的太阳，漫射，加一点天光；往太阳那边走几步，看沙丘、沙堆挡没挡住（软一点的影子）
    vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
    float dif = max(dot(n, uSun), 0.0);
    float sh = 1.0, h0 = groundH(p) + 0.004;
    float st = 0.03;
    for (int i = 0; i < 22; i++) {
      vec3 q = vec3(p.x, h0, p.y) + uSun * st;
      float hq = groundH(q.xz);
      sh = min(sh, clamp((q.y - hq) * 12.0 / st + 0.5, 0.0, 1.0));
      st *= 1.28;
      if (sh < 0.01 || st > 6.0) break;
    }
    // 天光：背着太阳那一半天空照过来的蓝光，影子里的沙纹也看得出一点
    vec3 skyDir = normalize(vec3(-uSun.x, 1.2, -uSun.z));
    float L = 0.2 * (0.5 + 0.5 * dot(n, skyDir)) + dif * mix(0.12, 1.0, sh);
    // 沙尘的雾：越远越往地平线上那层亮的沙尘靠
    vec3 rh = normalize(vec3(rd.x, 0.0, rd.z));
    L = mix(L, skyL(rh), 1.0 - exp(-hit / 4.5));

    // 风从坡顶扬起一缕缕沙，顺着风往下飘，落在背风坡上
    float s = duneS(p), f = fract(s);
    float a = dot(p, WD), c = dot(p, WC);
    float crest = smoothstep(FC - 0.16, FC - 0.04, f) * (1.0 - smoothstep(FC - 0.005, FC + 0.01, f));
    float wn = vnoiseP(vec2(a * 6.0 - uU * 16.0, c * 18.0), 16.0);
    float gust = smoothstep(0.35, 0.7, vnoise(vec2(c * 0.6, floor(s) * 3.1)));
    spray = max(spray, crest * gust * smoothstep(0.55, 0.85, wn) * (1.0 - smoothstep(2.0, 3.5, hit)));

    // 字的方向：沟里顺着沟，有沙纹的地方顺着沙纹（远处装不下明暗了，走向还在），别处顺着沙丘的等高线
    vec2 t2 = screenDir(P, normalize(vec2(-gdn.y, gdn.x) + 1e-6)) * clamp(length(gdn) * 2.5, 0.0, 1.0);
    t2 = mix(t2, screenDir(P, normalize(vec2(-rg.y, rg.x))), rmask * smoothstep(0.6, 1.6, RW / foot));
    t2 = mix(t2, screenDir(P, normalize(vec2(-ggrad.y, ggrad.x) + 1e-6)), clamp(length(ggrad) * 3.0, 0.0, 1.0));
    o = vec4(clamp(L, 0.0, 1.0), clamp(spray, 0.0, 1.0), t2 * 0.5 + 0.5);
  }
`;

const COMP_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uSand, uAtlas;
  uniform vec2 uRes, uCells;        // 画布（设备像素）；底稿有几列几行格子（比画布多出不到一格）
  uniform float uCell, uN;          // 一格多少设备像素、图集里有几个字
  uniform vec2 uRange;              // 亮度从 x 到 y 铺满由淡到浓的字
  uniform float uDark;              // 深色主题：越亮越浓；浅色主题反过来
  uniform vec3 uC0, uC1, uC2, uC3;  // 沙的色带
  uniform vec3 uSpray;              // 扬起来的沙
  uniform float uDense;             // 字由细到粗怎么分：越大，越亮（浅色主题是越暗）的格子才用得上 =
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) / uCells, uv = vec2(c0.x, 1.0 - c0.y);
    vec4 s = textureLod(uSand, uv, 1.0);                          // 底稿一格两个像素，第 1 层 mipmap 正好一格一个
    float r1 = hash(cell), r2 = hash(cell + 17.31);
    float gi, a = 0.0;
    vec3 col;
    float sp = s.g + (r1 - 0.5) * 0.16;
    if (sp > 0.3 || r2 < (s.g - 0.1) * 1.5) {
      // 扬起来的沙：. : * 由少到多，换一个颜色，不转；边上零星撒几个点
      float k = clamp((sp - 0.3) / 0.55, 0.0, 0.999);
      gi = ${SAND}.0 + floor(k * (uN - ${SAND}.0));
      col = uSpray;
    } else {
      // 沙：亮度挑 - ~ =，字转到沙纹的走向上；方向取周围几格一起的，不跟着一格里的小起伏乱转
      vec2 t2 = textureLod(uSand, uv, 2.5).ba * 2.0 - 1.0;
      a = dot(t2, t2) > 1e-12 ? 0.5 * atan(t2.y, t2.x) * smoothstep(0.05, 0.25, length(t2)) : 0.0;   // atan(0, 0) 没定义，有的显卡算出 NaN
      float lv = clamp((s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.08, 0.0, 0.999);
      lv = mix(lv, lv * lv * (3.0 - 2.0 * lv), 0.6);   // 拉开一点反差
      if (uDark < 0.5) lv = 0.999 - lv;
      // 字：亮的才用 =，大部分是细的 - ~，一道道连成线；明暗主要靠颜色
      float lg = pow(lv, uDense);
      gi = min(floor(lg * ${SAND}.0), ${SAND}.0 - 1.0);
      col = ramp(lv);
    }
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
  const sandP = program(gl, QUAD_VS, SAND_FS), compP = program(gl, QUAD_VS, COMP_FS);

  // 划过的点：沙上的 x、z，什么时候划过的（毫秒），是不是一笔的开头
  const trail = [], trailU = new Float32Array(TRAIL * 4);
  // 沙堆：x、z，什么时候倒的，随机数
  const taps = [], tapU = new Float32Array(TAPS * 4);
  let sandRT = null, cols = 1, rows = 1;

  const atlasCanvas = document.createElement("canvas");
  drawAtlas(atlasCanvas);
  const atlas = canvasTexture(gl, atlasCanvas);

  // 镜头：竖着的视角 44°（竖屏放宽到横着至少 40°），往下低头，让地平线落在 HORIZON
  const cam = { R: [1, 0, 0], U: [0, 1, 0], F: [0, 0, -1], tan: [1, 1] };
  function aim(aspect) {
    let ty = Math.tan((22 * Math.PI) / 180), tx = ty * aspect;
    const minX = Math.tan((20 * Math.PI) / 180);
    if (tx < minX) { tx = minX; ty = tx / aspect; }
    const pitch = Math.atan(HORIZON * ty);
    cam.F = [0, -Math.sin(pitch), -Math.cos(pitch)];
    cam.U = [0, Math.cos(pitch), -Math.sin(pitch)];
    cam.tan = [tx, ty];
  }

  // 太阳：左后方，离地平线 9°
  const az = (165 * Math.PI) / 180, el = (9 * Math.PI) / 180;
  const sun = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];

  let W = 0, H = 0, dpr = 1, raf = 0, visible = true, last = -1e9, dead = false, dark = false;

  function readTheme() { dark = getComputedStyle(canvas).colorScheme.includes("dark"); }
  function relayout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    cols = Math.ceil(W / cell); rows = Math.ceil(H / cell);
    aim((cols * cell) / (rows * cell));
    sandRT?.dispose();
    // 底稿一格两个像素：第 1 层 mipmap 正好一格一个，取平均不用自己算
    sandRT = target(gl, cols * 2, rows * 2, { mipmaps: true });
    readTheme();
    paint(true);
  }

  // 画面上一点 → 沙上的位置：从镜头往那一点打一条光线，走到碰上沙丘为止；打到天上就是 null
  function toSand(x, y) {
    const nx = (x / (cols * cell)) * 2 - 1, ny = 1 - (y / (rows * cell)) * 2;
    const d = [0, 1, 2].map((i) => cam.F[i] + nx * cam.tan[0] * cam.R[i] + ny * cam.tan[1] * cam.U[i]);
    const l = Math.hypot(...d);
    const rd = d.map((v) => v / l);
    let t = 0.3, lastT = t, lastD = 1;
    for (let i = 0; i < 200 && t < TMAX; i++) {
      const px = rd[0] * t, py = CAM_H + rd[1] * t, pz = rd[2] * t;
      const dd = py - duneH(px, pz);
      if (dd < 0) { const th = lastT + ((t - lastT) * lastD) / (lastD - dd); return { x: rd[0] * th, y: rd[2] * th }; }
      lastT = t; lastD = dd;
      t += Math.max(0.4 * dd, 0.0025 * t);
    }
    return null;
  }
  // 鼠标、手指：划的时候最新的一个点一直跟着手走，离上一个记下的点 28px 或者 90ms 就再记一个；
  // 停下 250ms 以上、移出画面、划到天上，再动就是新的一笔
  let head = null, lastX = 0, lastY = 0, lastAt = -1e9;
  function push(pt) { trail.push(pt); if (trail.length > TRAIL) thin(trail); }
  function sweep(x, y, now) {
    const q = toSand(x, y);
    if (!q) { head = null; return; }
    if (!head || now - head.t > 250) {
      head = { x: q.x, y: q.y, t: now, start: true }; push(head); lastX = x; lastY = y; lastAt = now;
    } else if (Math.hypot(x - lastX, y - lastY) >= 28 || now - lastAt >= 90 || trail[trail.length - 1] !== head || head.start) {
      head = { x: q.x, y: q.y, t: now, start: false }; push(head); lastX = x; lastY = y; lastAt = now;
    } else Object.assign(head, { x: q.x, y: q.y, t: now });
    paint(true);
  }
  function pourAt(x, y, now) {
    const q = toSand(x, y);
    if (!q) return false;
    // 鼠标挪过来时在这儿按下的那个单独的点（还没划开）不算沟，不然沙堆坐在一个坑里
    if (head && head.start && trail[trail.length - 1] === head) trail.pop();
    taps.push({ x: q.x, y: q.y, t: now, seed: Math.random() });
    if (taps.length > TAPS) taps.shift();
    head = null;
    paint(true);
    return true;
  }
  const at = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onMove = (e) => { if (still || !W) return; const [x, y] = at(e); sweep(x, y, performance.now()); };
  const onDown = (e) => { if (still || !W) return; const [x, y] = at(e); pourAt(x, y, performance.now()); };
  const onLeave = () => { head = null; };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerleave", onLeave);

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
      uCamR: cam.R, uCamU: cam.U, uCamF: cam.F, uTan: cam.tan, uU: u, uFoot: (2 * cam.tan[1]) / sandRT.h, uSun: sun,
      uGroove: 0.05, uPile: 0.2,
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
      uN: GLYPHS.length, uRange: C.range, uDark: dark ? 1 : 0,
      uC0: C.sand[0], uC1: C.sand[1], uC2: C.sand[2], uC3: C.sand[3], uSpray: C.spray, uDense: C.dense,
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
    pour() {
      if (still || !W) return;
      // 随便挑画面下面大半里的一点；打到天上就再挑
      for (let i = 0; i < 8; i++) if (pourAt(W * (0.2 + Math.random() * 0.6), H * (0.4 + Math.random() * 0.45), performance.now())) return;
    },
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
