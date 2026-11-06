/* 用字符画（ASCII）画的一床煤。WebGL2 着色器画的煤只在离屏图里当底稿，屏幕上只有字。分三步：

     1. 煤床（geo）：镜头悬在一床煤块上面，往前下方看，整块画面都是煤，没有天。煤块是 Voronoi 的一块块，
        每块是一个矮穹顶被五个凹下去的斜面削出来的（像凿出来的，面和面之间是棱），块的边沿陡陡地落进块与块之间的缝里；
        整床再垫一层很缓的起伏。每个像素往煤床打一条光线，一步步走到碰上煤为止（高度场的光线步进），
        记下碰在哪儿。煤不会动，这一步只在尺寸变了的时候算一次。
     2. 打光（shade）：每帧按记下的落点重新算那一点的高度和坡度（坡度连同高度一起算，就是法线），再打光：
        煤是黑的、带光泽，漫射很弱，主要靠反光：一盏主光在后上方左右来回扫（一圈 period 来回一次），
        朝着它的面一块块闪亮，亮面跟着光滑过去；斜着的面映着一点天光；鼠标是第二盏灯，悬在煤上，跟着鼠标走。
        越远越暗，远处没进黑里。缝里住着冷的蓝光：平时只有几处亮，沿着缝慢慢挪，把缝两边的煤块底下也映蓝。
        底稿存三样：亮度、蓝光有多亮、字该朝哪个方向放（煤面的等高线投到画面上，存成二倍角）。
     3. 合成（composite）：整块切成 8px 见方的格子，每格都有字，不留空。跟 ASCII Waves 一个做法：
        煤面按亮度从 - = # 里挑，颜色沿一条色带走，字再转到等高线的走向上，同一个面上的字朝一个方向，换一个面就换一个方向，
        一块块煤的棱角就被字描出来；蓝光把字染蓝，最亮的地方（裂开时炸开的那一下）是不转的 . : * o @。
        画布是透明的，字以外露出网页自己的底色。

   鼠标、手指划过煤：从画面上那一点往煤床打一条光线（用第 1 步记下的落点查），落点连成一条线，
   沿着它裂开一道参差的裂纹，里面亮着蓝光，附近的缝也亮起来，光顺着缝往外渗，四秒后合上、熄掉。
   点一下：那里当场裂开，从落点往外裂出三到五道参差的裂纹（各带一个小岔），落点闪一下，几秒后合上。

   所有会动的都是 t（一圈 period 毫秒）的函数：主光来回一次；缝里平时亮的那几处，是在噪声里绕一个圈取的，
   一圈以后正好回到原处，录出来的视频首尾接得上。

   省着画：煤床只在尺寸变了的时候算；平时每秒 30 帧只重新打光，划过、裂开、鼠标那盏灯还在挪的时候跟着屏幕刷新；
   滚出屏幕、切到别的标签页就停；系统开了「减弱动态效果」，或者显卡是 CPU 模拟的（没有能用的显卡、无头浏览器），
   只画一帧不动的，也不跟着鼠标动。

     const w = create(canvas, { period: 12000 });
     w.crack();                      // 在煤上随便一处裂开（键盘用）
     w.refresh();                    // 换了主题以后调：换字的颜色
     w.destroy();                    // 不用了：停下、摘掉监听、释放显存 */
import { context, program, fullscreen, target, canvasTexture, softwareGL } from "../_kit/gl.js";

const TAU = Math.PI * 2;
const TRAIL = 64, TRAIL_LIFE = 4;   // 划过的线最多几个点、一个点亮几秒
const TAPS = 6, TAP_LIFE = 4;       // 同时最多几处裂开、裂纹几秒合上

// 划过的点满了：不扔最老的那个（快划时后面一截会一下子暗掉），而是去掉一个最不影响形状的中间点，
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

// 颜色：煤面的字沿一条四个颜色的色带走，由淡的字到浓的字；蓝光由弱到强两个颜色；闪亮的高光一个颜色。
// 深色主题煤面由近黑的蓝灰到亮灰（越亮越浓），光由冰蓝到白；浅色主题煤面由浅灰到墨（越暗越浓），光是网站的钴蓝
const COLORS = {
  dark: {
    stone: [[0.12, 0.13, 0.17], [0.28, 0.31, 0.39], [0.56, 0.6, 0.7], [0.88, 0.91, 0.97]],
    glow: [[0.25, 0.5, 0.95], [0.82, 0.94, 1.0]], glint: [1, 1, 1], range: [0.04, 0.5], gamma: 0.6, dense: 1.4, fog: 0,
  },
  light: {
    stone: [[0.62, 0.64, 0.69], [0.4, 0.42, 0.48], [0.19, 0.2, 0.24], [0.04, 0.04, 0.06]],
    glow: [[0.15, 0.25, 0.85], [0.03, 0.07, 0.5]], glint: [0.04, 0.04, 0.06], range: [0.04, 0.5], gamma: 0.8, dense: 1, fog: 1,
  },
};

// ---------- 煤床的样子 ----------
// 长度单位是一块煤（Voronoi 的一格）。可调的数都在这儿
const DEF = {
  S: 0.6,                // 煤块的高度乘多少（块本身 -0.35 到 1.2）
  GAP: 0.03, RIM: 4,     // 缝底平的那一段离块边多远；块的边沿落进缝里有多陡
  HA: 0.6, HF: 0.16,     // 整床起伏多高、多密
  CAM_H: 3.4, PITCH: 42, // 镜头离煤床多高、往下低头多少度（画面最上边也还看着煤，没有天）
  FOG0: 7, FOGD: 9,      // 多远开始暗、暗下去的快慢
  KEY_EL: 0.5, KEY_SWING: 1.1,                      // 主光的仰角、左右扫多大（弧度，从正后方算）
  AMB: 0.04, FILL: 0.15, KD: 0.35, KE: 0.45, KS: 1.0, KP: 50,   // 底子、镜头这边的补光、漫射、映着的天光、反光多亮、多尖
  LAMP: 0.8, LAMP_H: 1.3, LAMP_F: 2.5,              // 鼠标那盏灯多亮、多高、照多远（越大照得越近）
  GA: 1.0, GT: 0.64, GF: 0.55, GLOW_UP: 0.6,        // 缝里的蓝光多亮、噪声过多少才亮、噪声多密、往块上映多高
  HOT: 0.92, GLINT: 0.8, // 光亮过多少换成不转的 . : * o @；煤面亮过多少零星冒一个闪亮的 *（只在深色主题）
  FLAT0: 0.2,            // 多暗的地方字横着放
  DIRLOD: 2.0,           // 字的方向取哪一层 mipmap（越大越顺，越小面和面分得越清）
};
const XR = 40, ZR = 80;   // 落点存成 16 位的 x（-XR 到 XR）、z（-ZR 到 0）
const f = (x) => Number(x).toFixed(5);   // 写进着色器的数一律带小数点：GLSL 里 1 是整数，跟浮点数一算就编不过

// 煤床的高度和坡度：着色器里两步都用（第 1 步找落点，第 2 步在落点重新算）
// 噪声的格点用整数哈希（不用 sin，各家显卡算出来一样）
const terrain = (T) => /* glsl */ `
  const float S = ${f(T.S)}, GAP = ${f(T.GAP)}, RIM = ${f(T.RIM)}, HA = ${f(T.HA)}, HF = ${f(T.HF)};
  const float YMAX = ${f(1.2 * T.S + 0.5 * T.HA + 0.02)}, YMIN = ${f(-0.35 * T.S - 0.5 * T.HA - 0.05)};
  uint ih(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
  uint hu(vec2 c, uint k) { ivec2 i = ivec2(floor(c)); return ih(uint(i.x) * 1597334673u ^ uint(i.y) * 3812015801u ^ k * 2654435769u); }
  float hh(vec2 c, uint k) { return float(hu(c, k)) * (1.0 / 4294967295.0); }
  // 每块煤的中心在自己那一格里的位置：一个哈希拆成两半用
  vec2 site(vec2 c) { uint n = hu(c, 0u); return 0.14 + 0.72 * vec2(float(n & 0xffffu), float(n >> 16u)) / 65535.0; }
  // 值噪声，连同坡度一起算
  vec3 vnoised(vec2 x, uint k) {
    vec2 i = floor(x), fr = fract(x);
    vec2 u = fr * fr * (3.0 - 2.0 * fr), du = 6.0 * fr * (1.0 - fr);
    float a = hh(i, k), b = hh(i + vec2(1.0, 0.0), k), c = hh(i + vec2(0.0, 1.0), k), d = hh(i + vec2(1.0, 1.0), k);
    return vec3(a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y, du * (vec2(b - a, c - a) + (a - b - c + d) * u.yx));
  }
  // 整床的起伏
  vec3 heap(vec2 p) { vec3 n = vnoised(p * HF + 2.0, 1u); return vec3(HA * (n.x - 0.5), HA * HF * n.yz); }
  // 值和坡度一起算：x 是高度，yz 是坡度。平滑地取小（面和面之间是一道圆一点的棱，不是刀刃）
  vec3 smin3(vec3 a, vec3 b, float k) {
    float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
    return vec3(mix(b.x, a.x, h) - k * h * (1.0 - h), mix(b.yz, a.yz, h));
  }
  // 离这一点最近的那块煤：q 是这一点减块中心，id 是块的编号；ed 是离块边多远，en 是朝那条边的方向（Inigo Quilez 的两遍法）
  void voro(vec2 x, out vec2 q, out vec2 id, out float ed, out vec2 en) {
    vec2 n = floor(x), fr = fract(x), mg = vec2(0.0), mr = vec2(0.0);
    float md = 8.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j)), r = g + site(n + g) - fr;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
    ed = 8.0; en = vec2(1.0, 0.0);
    for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j)), r = g + site(n + g) - fr;
      vec2 dr = r - mr;
      if (dot(dr, dr) > 1e-5) {
        vec2 nn = normalize(dr);
        float d = dot(0.5 * (mr + r), nn);
        if (d < ed) { ed = d; en = nn; }
      }
    }
    q = -mr; id = n + mg;
  }
  // 一块煤的高度和坡度：一个矮穹顶，被五个往外斜、又往里凹的面削过（凿出来的那种凹面），面和面之间是棱
  vec3 chunk(vec2 q, vec2 id) {
    vec3 h = vec3(1.0 + 0.2 * hh(id, 1u) - 0.5 * dot(q, q), -q);
    float a0 = hh(id, 2u) * 6.2831853;
    for (int k = 0; k < 5; k++) {
      uint uk = uint(k);
      float a = a0 + float(k) * 1.2566371 + (hh(id, 3u + uk) - 0.5) * 0.9;
      vec2 d = vec2(cos(a), sin(a));
      float sl = 0.75 + 0.7 * hh(id, 8u + uk);                // 这一面有多斜
      vec2 c = q - d * (0.1 + 0.2 * hh(id, 13u + uk));        // 凹下去的那个碗的中心
      float bowl = 1.5 + 1.1 * hh(id, 18u + uk);
      h = smin3(h, vec3(0.96 - sl * dot(q, d) + bowl * dot(c, c), -sl * d + 2.0 * bowl * c), 0.045);
    }
    return h;
  }
  // 煤床：块本身，边沿陡陡地落进缝里（缝底在 -0.35），再垫上整床的起伏。hr 是块本身的高度（没乘、没垫）
  vec3 bed(vec2 p, out vec2 id, out float ed, out vec2 en, out float hr) {
    vec2 q;
    voro(p, q, id, ed, en);
    vec3 h = chunk(q, id);
    float e = max(ed - GAP, 0.0);
    h = smin3(h, vec3(-0.35 + RIM * e, e > 0.0 ? -RIM * en : vec2(0.0)), 0.08);
    hr = h.x;
    return h * S + heap(p);
  }
  // 便宜的上界：只找最近、次近的两块，穹顶不削面，边沿按到这两块中线的距离算（不会比真的近）。光线先按它走
  float bound(vec2 p) {
    vec2 n = floor(p), fr = fract(p), r1 = vec2(0.0), r2 = vec2(1.0);
    float d1 = 8.0, d2 = 9.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j)), r = g + site(n + g) - fr;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; r2 = r1; d1 = d; r1 = r; } else if (d < d2) { d2 = d; r2 = r; }
    }
    float ed = (d2 - d1) / (2.0 * length(r2 - r1));
    return S * min(1.2 - 0.5 * d1, -0.35 + RIM * max(ed - GAP, 0.0)) + heap(p).x;
  }
`;

// ---------- 字的图集 ----------
// 一行一格 64 见方（字要转，格子得是正方形）。前 2 个是煤面，由淡到浓 - =，横着拉宽，一格接一格连成一道道线；
// 后 5 个是光，由弱到强 . : * o @，不拉宽。每个字按墨迹居中，再描一圈边，笔画粗一点
const GLYPHS = ["-", "=", ".", ":", "*", "o", "@"], BODY = 2;
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
    const sx = i < BODY ? Math.max(1, Math.min(1.8, (0.84 * T) / (l + r))) : 1;
    g.save();
    g.translate(i * T + T / 2, T / 2); g.scale(sx, 1);
    const x = -(r - l) / 2, y = (up - dn) / 2;
    g.lineWidth = i < BODY ? 4.5 : 3;   // 煤面的字是细线，描粗一点才压得住整块
    g.fillText(ch, x, y); g.strokeText(ch, x, y);
    g.restore();
  });
}

// ---------- 着色器 ----------
const QUAD_VS = /* glsl */ `
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const CAMERA = /* glsl */ `
  uniform vec3 uCamR, uCamU, uCamF;   // 镜头往右、往上、往前
  uniform vec2 uTan;                  // 画面右边沿、上边沿的 tan
  uniform float uCamH;                // 镜头多高（窄的画面镜头抬高一点，煤块不至于太大）
  #define RO vec3(0.0, uCamH, 0.0)
`;

// 第 1 步：每个像素往煤床打一条光线，存下碰在哪儿（x、z 各 16 位，拆成两个 8 位）
const geoFS = (T) => /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  ${CAMERA}
  ${terrain(T)}
  float fullH(vec2 p) { vec2 id, en; float ed, hr; return bed(p, id, ed, en, hr).x; }
  vec2 enc(float v) { float u = floor(clamp(v, 0.0, 1.0) * 65535.0 + 0.5), hi = floor(u / 256.0); return vec2(hi, u - hi * 256.0) / 255.0; }
  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 rd = normalize(uCamF + ndc.x * uTan.x * uCamR + ndc.y * uTan.y * uCamU);
    float dy = -rd.y, hz = length(rd.xz);
    if (dy < 0.01) { o = vec4(1.0); return; }
    // 从煤床最高处那层开始走；先按便宜的上界走到它跟前，再按真的高度走，最后在一上一下两点之间二分
    float t = (RO.y - YMAX) / dy, tEnd = (RO.y - YMIN) / dy, ta = t, tb = -1.0;
    float k1 = 0.9 / (dy + hz), k2 = 0.8 / (dy + 2.0 * hz);
    for (int i = 0; i < 64; i++) {
      vec3 q = RO + rd * t;
      float d = q.y - bound(q.xz);
      if (d < 0.0) break;
      ta = t;
      if (d < 0.003 || t > tEnd) break;
      t += max(d * k1, 0.004);
    }
    t = ta;
    for (int i = 0; i < 40; i++) {
      vec3 q = RO + rd * t;
      float d = q.y - fullH(q.xz);
      if (d < 0.0) { tb = t; break; }
      ta = t;
      if (t > tEnd) break;
      t += max(d * k2, 0.003);
    }
    if (tb < 0.0) tb = t;
    for (int i = 0; i < 6; i++) {
      float tm = 0.5 * (ta + tb);
      vec3 q = RO + rd * tm;
      if (q.y < fullH(q.xz)) tb = tm; else ta = tm;
    }
    vec3 P = RO + rd * (0.5 * (ta + tb));
    o = vec4(enc((P.x + ${XR}.0) / ${2 * XR}.0), enc((P.z + ${ZR}.0) / ${ZR}.0));
  }
`;

// 第 2 步：打光。r 是亮度（反光接近 1），g 是蓝光有多亮，b、a 是字该朝的方向（画面上，y 朝下），
// 存成二倍角（cos 2θ、sin 2θ）再乘上「有多确定」：一道横线转 180° 还是它，一格取平均才不会正反抵消
const shadeFS = (T) => /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  ${CAMERA}
  uniform sampler2D uGeo;
  uniform float uU, uFoot, uFogL;     // 一圈里走到哪（0 到 1）；底稿一个像素在 1 远的地方有多宽；远处暗到哪个亮度
  uniform vec3 uKey;                  // 主光的方向
  uniform vec3 uPtr;                  // 鼠标那盏灯：x、z、亮度
  uniform vec4 uTrail[${TRAIL}];      // 划过的点，由旧到新：x、z、过了几秒、是不是一笔的开头
  uniform float uTrailN;
  uniform vec4 uTap[${TAPS}];         // 裂开的地方：x、z、过了几秒、随机数
  uniform float uTapN;
  ${terrain(T)}
  float dec(vec2 hl) { vec2 b = floor(hl * 255.0 + 0.5); return (b.x * 256.0 + b.y) / 65535.0; }
  float h21(vec2 p) { return hh(p, 7u); }
  float vnoise(vec2 x) { return vnoised(x, 5u).x; }
  // 到一段线段的距离，t 是落在线段上哪儿（0 到 1）
  float seg(vec2 p, vec2 a, vec2 b, out float t) {
    vec2 ab = b - a; float l2 = dot(ab, ab);
    t = l2 > 1e-8 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
    return length(p - a - ab * t);
  }
  // 地面上一个方向 T（x、z）在 P 点投到画面上朝哪（y 朝下），存成二倍角
  vec2 screenDir(vec3 P, vec2 Tg) {
    vec3 d = P - RO, t3 = vec3(Tg.x, 0.0, Tg.y);
    float z = dot(d, uCamF), sx = dot(d, uCamR) / z, sy = dot(d, uCamU) / z;
    vec2 v = vec2((dot(t3, uCamR) - sx * dot(t3, uCamF)) / uTan.x, -(dot(t3, uCamU) - sy * dot(t3, uCamF)) / uTan.y);
    float m2 = dot(v, v);
    return m2 > 1e-14 ? vec2(v.x * v.x - v.y * v.y, 2.0 * v.x * v.y) / m2 : vec2(0.0);
  }
  void main() {
    vec4 g = texelFetch(uGeo, ivec2(gl_FragCoord.xy), 0);
    if (all(greaterThan(g, vec4(0.999)))) { o = vec4(uFogL, 0.0, 0.5, 0.5); return; }
    vec2 x = vec2(dec(g.xy) * ${2 * XR}.0 - ${XR}.0, dec(g.zw) * ${ZR}.0 - ${ZR}.0);
    vec2 id, en; float ed, hr;
    vec3 h = bed(x, id, ed, en, hr);
    vec3 P = vec3(x.x, h.x, x.y), dv = P - RO;
    float dist = length(dv);
    vec3 rd = dv / dist;
    float cw = 2.0 * dist * uFoot;   // 一格字在这儿的煤上多宽（底稿一格两个像素）

    // 裂纹：每处裂开的地方往外裂 3 到 5 道，方向随机（不是均匀分开的星星），0.2 秒里裂到头；
    // 每道走三段、每段拐一下，越往外越细，第二段起头分一个小岔；裂纹再按噪声抖一抖，是参差的
    float crack = 0.0, cglow = 0.0, flash = 0.0;
    vec2 cdir = vec2(1.0, 0.0);
    for (int i = 0; i < ${TAPS}; i++) {
      if (float(i) >= uTapN) break;
      vec4 Pt = uTap[i];
      vec2 r = x - Pt.xy;
      if (Pt.z > ${TAP_LIFE}.0 || dot(r, r) > 3.0) continue;
      vec2 xr = r + 0.035 * (vec2(vnoise(x * 9.0 + Pt.w * 31.0), vnoise(x * 9.0 - Pt.w * 17.0 + 3.3)) - 0.5);
      float grow = smoothstep(0.0, 0.2, Pt.z), heal = 1.0 - smoothstep(${TAP_LIFE}.0 - 1.6, ${TAP_LIFE}.0, Pt.z);
      int K = 3 + int(h21(vec2(Pt.w * 97.0, 1.0)) * 2.99);
      float cm = 0.0;
      for (int k = 0; k < 6; k++) {
        if (k >= K) break;
        float fk = float(k);
        float an = Pt.w * 6.2831853 + (fk + 0.75 * (h21(vec2(Pt.w * 911.0, fk)) - 0.5)) * 6.2831853 / float(K);
        float Lk = 0.5 + 0.6 * h21(vec2(fk + 20.0, Pt.w * 313.0));
        vec2 a = vec2(0.0);
        for (int j = 0; j < 3; j++) {
          float fj = float(j), pj = clamp(grow * 3.0 - fj, 0.0, 1.0);   // 一段一段往外裂
          if (pj <= 0.0) break;
          float aj = an + (h21(vec2(fk * 3.0 + fj + 40.0, Pt.w * 531.0)) - 0.5) * 1.2;
          vec2 dj = vec2(cos(aj), sin(aj)), b = a + dj * Lk / 3.0 * (0.7 + 0.6 * h21(vec2(fj + 60.0, fk + Pt.w * 777.0))) * pj;
          float t, dd = seg(xr, a, b, t);
          float w = cw * mix(0.9, 0.4, (fj + t) / 3.0);
          float m = 1.0 - smoothstep(w, w + cw * 0.45, dd);
          if (m > cm) { cm = m; cdir = dj; }
          if (j == 1) {
            float sb = h21(vec2(fk + 80.0, Pt.w * 151.0)) > 0.5 ? 0.85 : -0.85;
            vec2 bd = vec2(cos(aj + sb), sin(aj + sb));
            float db = seg(xr, a, a + bd * Lk * 0.3 * pj, t);
            float mb = 1.0 - smoothstep(cw * 0.35, cw * 0.75, db);
            if (mb > cm) { cm = mb; cdir = bd; }
          }
          a = b;
        }
      }
      cm *= heal;
      crack = max(crack, cm);
      cglow += cm * (0.6 + 1.2 * exp(-Pt.z / 1.2));
      flash += exp(-dot(r, r) / (0.015 + 0.2 * Pt.z)) * exp(-Pt.z / 0.35);
    }
    // 划过：顺着划的路裂开一道参差的裂纹，里面亮着蓝光，四秒里从老的那头合上；
    // 附近的缝也亮起来，光顺着缝往外渗，越老渗得越远、越暗
    float seep = 0.0;
    vec2 xj = x + 0.07 * (vec2(vnoise(x * 5.0 + 1.7), vnoise(x * 5.0 + 9.2)) - 0.5);
    for (int i = 0; i < ${TRAIL}; i++) {
      if (float(i) >= uTrailN) break;
      vec4 B = uTrail[i], A = (i == 0 || B.w > 0.5) ? B : uTrail[max(i - 1, 0)];
      float t, d = seg(x, A.xy, B.xy, t), a = mix(A.z, B.z, t);
      float fade = 1.0 - smoothstep(${TRAIL_LIFE}.0 - 1.5, ${TRAIL_LIFE}.0, a);
      float reach = 0.2 + 0.55 * pow(a, 0.7);
      seep = max(seep, 0.8 * exp(-d * d / (reach * reach)) * exp(-a / 1.6) * smoothstep(0.0, 0.05, a) * fade);
      vec2 ab = B.xy - A.xy;
      if (dot(ab, ab) > 1e-6) {
        float tj, dj = seg(xj, A.xy, B.xy, tj), aj = mix(A.z, B.z, tj);
        float w = cw * 0.6;
        float m = (1.0 - smoothstep(w, w + cw * 0.5, dj)) * (1.0 - smoothstep(${TRAIL_LIFE}.0 - 1.5, ${TRAIL_LIFE}.0, aj));
        if (m > crack) { crack = m; cdir = normalize(ab); }
        cglow = max(cglow, m * (0.55 + 0.8 * exp(-aj / 1.0)));
      }
    }

    // 光：煤是黑的，漫射弱，主要靠反光。主光、鼠标那盏灯各一份漫射加反光，斜着的面映一点天光；
    // 缝里、块底下暗（遮蔽），裂纹里更暗
    vec3 n = normalize(vec3(-h.y, 1.0, -h.z)), V = -rd;
    float ao = mix(0.15, 1.0, smoothstep(-0.3, 0.7, hr)) * (1.0 - 0.85 * crack);
    float dif = max(dot(n, uKey), 0.0), spec = pow(max(dot(n, normalize(uKey + V)), 0.0), ${f(T.KP)});
    vec3 R = reflect(rd, n);
    float fres = 0.15 + 0.85 * pow(1.0 - max(dot(n, V), 0.0), 3.0);
    float env = smoothstep(-0.2, 0.8, R.y) * fres;
    vec3 Lp = vec3(uPtr.x, ${f(T.LAMP_H)}, uPtr.y) - P;
    float dp = length(Lp); Lp /= dp;
    float att = uPtr.z / (1.0 + dp * dp * ${f(T.LAMP_F)});
    float pdif = max(dot(n, Lp), 0.0) * att, pspec = pow(max(dot(n, normalize(Lp + V)), 0.0), 36.0) * att;
    float lum = ${f(T.AMB)} + ao * (${f(T.FILL)} * max(dot(n, V), 0.0) + ${f(T.KD)} * dif + ${f(T.KE)} * env + ${f(T.KS)} * spec + ${f(T.LAMP)} * (0.5 * pdif + 0.8 * pspec));
    // 越远越暗
    lum = mix(lum, uFogL, 1.0 - exp(-max(dist / uCamH * ${f(T.CAM_H)} - ${f(T.FOG0)}, 0.0) / ${f(T.FOGD)}));

    // 缝里的蓝光。平时：几处亮的沿着缝挪，是在噪声里绕一个圈取的，一圈以后回到原处
    vec2 lo = 1.3 * vec2(cos(6.2831853 * uU), sin(6.2831853 * uU));
    float L = ${f(T.GA)} * smoothstep(${f(T.GT)}, ${f(T.GT + 0.2)}, vnoise(x * ${f(T.GF)} + lo + 3.0)) * (0.75 + 0.25 * sin(6.2831853 * (3.0 * uU + hh(id, 30u))));
    L = max(L, seep);
    float low = 1.0 - smoothstep(-0.35, ${f(T.GLOW_UP)}, hr);           // 越往缝底越亮：缝两边的块底下也映着
    float glow = L * (low + 0.25 * exp(-ed / 0.1)) + cglow + 0.9 * flash;
    glow *= exp(-max(dist / uCamH * ${f(T.CAM_H)} - ${f(T.FOG0)}, 0.0) / (2.0 * ${f(T.FOGD)}));

    // 字的方向：顺着煤面的等高线（同一个面上朝一个方向），裂纹里顺着裂纹
    vec2 gr = h.yz;
    vec2 t2 = screenDir(P, normalize(vec2(-gr.y, gr.x) + 1e-6)) * clamp(length(gr) * 3.0, 0.0, 1.0);
    t2 = mix(t2, screenDir(P, cdir), crack);
    o = vec4(clamp(lum, 0.0, 1.0), clamp(glow, 0.0, 1.0), t2 * 0.5 + 0.5);
  }
`;

const compFS = (T) => /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uShade, uAtlas;
  uniform vec2 uRes, uCells;        // 画布（设备像素）；底稿有几列几行格子（比画布多出不到一格）
  uniform float uCell, uN;          // 一格多少设备像素、图集里有几个字
  uniform vec2 uRange;              // 亮度从 x 到 y 铺满由淡到浓的字
  uniform float uDark;              // 深色主题：越亮越浓；浅色主题反过来
  uniform vec3 uC0, uC1, uC2, uC3;  // 煤面的色带
  uniform vec3 uG0, uG1, uGlint;    // 光由弱到强、闪亮的高光
  uniform float uGamma;             // 亮度先按这个次方拉一下：煤大半是暗的，暗部要拉开
  uniform float uDense;             // 字由细到粗怎么分：越大，越亮（浅色主题是越暗）的格子才用得上粗的
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) / uCells, uv = vec2(c0.x, 1.0 - c0.y);
    vec4 s = textureLod(uShade, uv, 1.0);                         // 底稿一格两个像素，第 1 层 mipmap 正好一格一个
    float r1 = hash(cell), r2 = hash(cell + 17.31);
    float glow = s.g, gi, a = 0.0;
    vec3 col;
    float lv = clamp((s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.06, 0.0, 0.999);
    if (glow > ${f(T.HOT)} + (r2 - 0.5) * 0.12) {
      // 最亮的光：. : * o @ 由弱到强，不转
      float k = clamp((glow - ${f(T.HOT)}) / ${f(1 - T.HOT)}, 0.0, 0.999);
      gi = ${BODY}.0 + floor(k * (uN - ${BODY}.0));
      col = mix(uG0, uG1, k);
    } else if (uDark > 0.5 && s.r > ${f(T.GLINT)} && r2 < 0.5) {
      // 闪亮的高光：零零星星几个 *，不转
      gi = ${BODY}.0 + 2.0;
      col = uGlint;
    } else {
      // 煤面：亮度挑 - = #，字转到等高线的走向上；方向取周围几格一起的，不跟着一格里的小起伏乱转
      vec2 t2 = textureLod(uShade, uv, ${f(T.DIRLOD)}).ba * 2.0 - 1.0;
      lv = pow(lv, uGamma);
      // 背光的暗处字都横着放，像版画里阴影的排线，亮的面才顺着面转
      a = dot(t2, t2) > 1e-12 ? 0.5 * atan(t2.y, t2.x) * smoothstep(0.05, 0.25, length(t2)) * smoothstep(${f(T.FLAT0)}, ${f(T.FLAT0 + 0.2)}, lv) : 0.0;   // atan(0, 0) 没定义，有的显卡算出 NaN
      lv = mix(lv, lv * lv * (3.0 - 2.0 * lv), 0.3);   // 再拉开一点反差
      if (uDark < 0.5) lv = 0.999 - lv;
      float gl = clamp(glow * 1.6, 0.0, 1.0);
      float lg = max(pow(lv, uDense), gl);
      gi = min(floor(lg * ${BODY}.0), ${BODY}.0 - 1.0);
      col = mix(ramp(lv), mix(uG0, uG1, smoothstep(0.35, 0.9, glow)), smoothstep(0.03, 0.3, glow));
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
  const P = DEF;
  const gl = context(canvas);   // 没有 WebGL2 就抛错，交给调用的人接
  const software = softwareGL(gl);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let still = motion.matches || software;
  const tri = fullscreen(gl);
  const geoP = program(gl, QUAD_VS, geoFS(P)), shadeP = program(gl, QUAD_VS, shadeFS(P)), compP = program(gl, QUAD_VS, compFS(P));

  // 划过的点：煤床上的 x、z，什么时候划过的（毫秒），是不是一笔的开头
  const trail = [], trailU = new Float32Array(TRAIL * 4);
  // 裂开的地方：x、z，什么时候，随机数（定裂纹往哪几个方向、多长）
  const taps = [], tapU = new Float32Array(TAPS * 4);
  let geoRT = null, shadeRT = null, cols = 1, rows = 1, geoDirty = true, pick = null;

  const atlasCanvas = document.createElement("canvas");
  drawAtlas(atlasCanvas);
  const atlas = canvasTexture(gl, atlasCanvas);

  // 镜头：竖着的视角 44°（竖屏放宽到横着至少 40°），往下低头，画面最上边也还看着煤
  const cam = { R: [1, 0, 0], U: [0, 1, 0], F: [0, 0, -1], tan: [1, 1], h: P.CAM_H };
  function aim(aspect) {
    let ty = Math.tan((22 * Math.PI) / 180), tx = ty * aspect;
    const minX = Math.tan((20 * Math.PI) / 180);
    if (tx < minX) { tx = minX; ty = tx / aspect; }
    const pitch = Math.max((P.PITCH * Math.PI) / 180, Math.atan(ty) + (14 * Math.PI) / 180);
    cam.F = [0, -Math.sin(pitch), -Math.cos(pitch)];
    cam.U = [0, Math.cos(pitch), -Math.sin(pitch)];
    cam.tan = [tx, ty];
    cam.h = P.CAM_H * Math.min(1.6, Math.max(1, 1.2 / aspect));   // 越窄抬得越高
  }

  let W = 0, H = 0, dpr = 1, raf = 0, visible = true, last = -1e9, prev = -1, dead = false, dark = false;
  // 鼠标那盏灯：要去的地方、现在的地方（跟过去，不是瞬移）、亮度（移进来慢慢亮，移出去慢慢灭）
  const lamp = { tx: 0, ty: 0, x: 0, y: 0, on: 0, k: 0 };

  function readTheme() { dark = getComputedStyle(canvas).colorScheme.includes("dark"); }
  function relayout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    cols = Math.ceil(W / cell); rows = Math.ceil(H / cell);
    aim(cols / rows);
    geoRT?.dispose(); shadeRT?.dispose();
    // 底稿一格两个像素：第 1 层 mipmap 正好一格一个，取平均不用自己算
    geoRT = target(gl, cols * 2, rows * 2);
    shadeRT = target(gl, cols * 2, rows * 2, { mipmaps: true });
    geoDirty = true; pick = null;
    readTheme();
    paint(true);
  }

  // 画面上一点 → 煤床上的位置：查第 1 步记下的落点（第一次要用时整张读回来，之后尺寸不变就一直用）
  function toCoal(x, y) {
    if (!geoRT || geoDirty) return null;
    const w = geoRT.w, h = geoRT.h;
    if (!pick) {
      pick = new Uint8Array(w * h * 4);
      geoRT.bind();
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pick);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    const i = Math.floor((x / (cols * cell)) * w), j = Math.floor((1 - y / (rows * cell)) * h);
    if (i < 0 || j < 0 || i >= w || j >= h) return null;
    const k = (j * w + i) * 4, b = pick;
    if (b[k] === 255 && b[k + 1] === 255 && b[k + 2] === 255 && b[k + 3] === 255) return null;
    return { x: ((b[k] * 256 + b[k + 1]) / 65535) * 2 * XR - XR, y: ((b[k + 2] * 256 + b[k + 3]) / 65535) * ZR - ZR };
  }
  // 鼠标、手指：划的时候最新的一个点一直跟着手走，离上一个记下的点 28px 或者 90ms 就再记一个；
  // 停下 250ms 以上、移出画面，再动就是新的一笔。点一下：那里裂开，也记一个单独的点，让附近的缝亮起来
  let head = null, lastX = 0, lastY = 0, lastAt = -1e9;
  function push(pt) { trail.push(pt); if (trail.length > TRAIL) thin(trail); }
  function sweep(q, x, y, now) {
    if (!head || now - head.t > 250) {
      head = { x: q.x, y: q.y, t: now, start: true }; push(head); lastX = x; lastY = y; lastAt = now;
    } else if (Math.hypot(x - lastX, y - lastY) >= 28 || now - lastAt >= 90 || trail[trail.length - 1] !== head || head.start) {
      head = { x: q.x, y: q.y, t: now, start: false }; push(head); lastX = x; lastY = y; lastAt = now;
    } else Object.assign(head, { x: q.x, y: q.y, t: now });
    paint(true);
  }
  function crackAt(x, y, now) {
    const q = toCoal(x, y);
    if (!q) return;
    taps.push({ x: q.x, y: q.y, t: now, seed: Math.random() });
    if (taps.length > TAPS) taps.shift();
    push({ x: q.x, y: q.y, t: now, start: true });
    head = null;
    paint(true);
  }
  const at = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onMove = (e) => {
    if (still || !W) return;
    const [x, y] = at(e), q = toCoal(x, y);
    if (!q) return;
    if (!lamp.on) { lamp.x = q.x; lamp.y = q.y; }
    lamp.tx = q.x; lamp.ty = q.y; lamp.on = 1;
    sweep(q, x, y, performance.now());
  };
  const onDown = (e) => { if (still || !W) return; const [x, y] = at(e); crackAt(x, y, performance.now()); };
  const onLeave = () => { head = null; lamp.on = 0; paint(true); };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerleave", onLeave);

  function frame(now) {
    raf = 0;
    if (dead || !W || !geoRT) return;
    const dt = prev < 0 ? 0 : Math.min(0.1, (now - prev) / 1000);
    prev = now;
    // 过了时候的点、裂纹扔掉；剩下的由旧到新传给着色器，最旧的那个就是一笔的开头
    while (trail.length && (now - trail[0].t) / 1000 >= TRAIL_LIFE) trail.shift();
    if (!trail.length) head = null;
    trail.forEach((p, i) => trailU.set([p.x, p.y, Math.max(0, (now - p.t) / 1000), i === 0 || p.start ? 1 : 0], i * 4));
    while (taps.length && (now - taps[0].t) / 1000 >= TAP_LIFE) taps.shift();
    taps.forEach((p, i) => tapU.set([p.x, p.y, Math.max(0, (now - p.t) / 1000), p.seed], i * 4));
    // 灯跟着鼠标挪、慢慢亮、慢慢灭
    const fl = 1 - Math.exp(-dt * 10);
    lamp.x += (lamp.tx - lamp.x) * fl; lamp.y += (lamp.ty - lamp.y) * fl;
    lamp.k += ((still ? 0 : lamp.on) - lamp.k) * (1 - Math.exp(-dt * 5));
    const moving = Math.abs(lamp.tx - lamp.x) + Math.abs(lamp.ty - lamp.y) > 0.002 || Math.abs(lamp.on - lamp.k) > 0.01;
    const busy = trail.length > 0 || taps.length > 0 || moving;
    // 平时每秒 fps 帧；划过、裂开、灯在挪的时候每帧都画，跟得上手
    if (!still && !busy && now - last < 1000 / fps - 2) { schedule(); return; }
    last = now;
    const u = still ? 0.15 : (((now % period) + period) % period) / period;
    const camU = { uCamR: cam.R, uCamU: cam.U, uCamF: cam.F, uTan: cam.tan, uCamH: cam.h };
    // 煤床：只在尺寸变了以后算一次
    if (geoDirty) {
      geoRT.bind();
      geoP.use(camU);
      tri.draw();
      geoDirty = false;
    }
    // 主光：在后上方左右来回扫
    const az = P.KEY_SWING * Math.sin(TAU * u), el = P.KEY_EL;
    const key = [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
    const C = COLORS[dark ? "dark" : "light"];
    shadeRT.bind();
    shadeP.use({
      ...camU, uGeo: [geoRT.tex, 0], uU: u, uFoot: (2 * cam.tan[1]) / shadeRT.h, uFogL: C.fog, uKey: key,
      uPtr: [lamp.x, lamp.y, lamp.k], uTrail: trailU, uTrailN: trail.length, uTap: tapU, uTapN: taps.length,
    });
    tri.draw();
    shadeRT.mip();
    // 合成到画布上
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    compP.use({
      uShade: [shadeRT.tex, 0], uAtlas: [atlas.tex, 1], uRes: [canvas.width, canvas.height], uCells: [cols, rows], uCell: cell * dpr,
      uN: GLYPHS.length, uRange: C.range, uDark: dark ? 1 : 0, uGamma: C.gamma, uDense: C.dense,
      uC0: C.stone[0], uC1: C.stone[1], uC2: C.stone[2], uC3: C.stone[3], uG0: C.glow[0], uG1: C.glow[1], uGlint: C.glint,
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
  const onVis = () => { prev = -1; if (!document.hidden) paint(true); };
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
    crack() { if (!still && W) crackAt(W * (0.25 + Math.random() * 0.5), H * (0.4 + Math.random() * 0.45), performance.now()); },
    refresh() { readTheme(); paint(true); },
    destroy() {
      dead = true; cancelAnimationFrame(raf); raf = 0;
      io.disconnect(); ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      motion.removeEventListener("change", onMotion);
      geoRT?.dispose(); shadeRT?.dispose(); atlas.dispose(); tri.dispose();
      geoP.dispose(); shadeP.dispose(); compP.dispose();
      // 上下文不强行丢掉：同一个 canvas 再挂一次（开发时 React 会挂两遍）还要用
    },
  };
}

export { create };
