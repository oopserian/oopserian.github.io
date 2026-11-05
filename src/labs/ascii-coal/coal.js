/* 用字符画（ASCII）画的一面煤壁。WebGL2 着色器画的煤壁只在离屏图里当底稿，屏幕上只有字。每帧两步：

     1. 煤壁（wall）：正对着看的一面浮雕，铺满画面。煤块是 Voronoi 的一块块，每块是一个矮穹顶被五个凹下去的斜面削出来的
        （像凿出来的，面和面之间是一道道棱），块的边沿斜着落进块与块之间的缝里。高度连同坡度一起算（不用差分），
        坡度就是法线。一盏主光在上方慢慢左右扫（一圈 period 来回一次），每块的面轮流亮起来，亮面上的高光跟着滑；
        鼠标是第二盏灯，悬在煤壁前面，跟着鼠标走。缝里住着冷的蓝光：平时只有几处亮，沿着缝慢慢挪。
        底稿存四样：煤面的亮度、蓝光有多亮、缝（和裂纹）的走向（二倍角，乘上有多像一条线）。
     2. 合成（composite）：整块切成 8px 见方的格子，每格都有字，不留空：
        像一条线的格子（缝、裂纹）按走向挑 - \ | /，不转，就是老式的字符画；缝里有光就是蓝的。
        别的格子按煤面的亮度挑 . : + * # % @：深色主题越亮越浓，浅色主题越暗越浓，两种主题看到的都是正片；
        光亮到一定程度的格子（缝的交叉处、裂开时炸开的那一下）也用这几个字，换成蓝色。
        画布是透明的，字以外露出网页自己的底色。

   鼠标、手指划过煤壁：落点连成一条线，线经过的缝亮起蓝光，再顺着缝往外渗、慢慢暗下去，四秒后熄掉。
   点一下：那里当场裂开，从落点往外裂出六道参差的裂纹（各带一个小岔），裂纹里亮着蓝光，落点闪一下；
   附近的缝也跟着亮，裂纹几秒后合上。

   所有会动的都是 t（一圈 period 毫秒）的函数：主光来回一次；缝里平时亮的那几处，是在噪声里绕一个圈取的，
   一圈以后正好回到原处，录出来的视频首尾接得上。

   省着画：平时每秒 30 帧，划过、裂开、鼠标那盏灯还在挪的时候跟着屏幕刷新；滚出屏幕、切到别的标签页就停；
   系统开了「减弱动态效果」，或者显卡是 CPU 模拟的（没有能用的显卡、无头浏览器），只画一帧不动的，也不跟着鼠标动。

     const w = create(canvas, { period: 12000 });
     w.crack();                      // 在煤壁上随便一处裂开（键盘用）
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

// 颜色：煤面的字沿一条四个颜色的色带走，由淡的字到浓的字；缝一个颜色；光由弱到强两个颜色。
// 深色主题煤面由暗灰到亮灰（越亮越浓），缝是中灰，光由冰蓝到白；
// 浅色主题煤面由浅灰到墨（越暗越浓），缝是最深的墨，光是网站的钴蓝
const COLORS = {
  dark: {
    stone: [[0.19, 0.2, 0.23], [0.36, 0.38, 0.43], [0.6, 0.62, 0.67], [0.88, 0.89, 0.92]], seam: [0.44, 0.46, 0.52],
    glow: [[0.33, 0.6, 0.96], [0.86, 0.95, 1.0]], range: [0.06, 0.62],
  },
  light: {
    stone: [[0.55, 0.57, 0.62], [0.33, 0.35, 0.4], [0.15, 0.16, 0.2], [0.03, 0.03, 0.05]], seam: [0.02, 0.02, 0.04],
    glow: [[0.3, 0.42, 0.96], [0.1, 0.17, 0.82]], range: [0.06, 0.75],
  },
};

// ---------- 字的图集 ----------
// 一行 11 格，一格 64 见方。前 4 个是线 - \ | /，拉到顶满一格（横的拉宽、竖的拉高、斜的拉到对角），一格接一格连成一道；
// 后 7 个是面，由淡到浓 . : + * # % @，不拉。每个字按墨迹居中，再描一圈边，笔画粗一点
const GLYPHS = ["-", "\\", "|", "/", ".", ":", "+", "*", "#", "%", "@"], LINES = 4;
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
    const sx = i === 0 || i === 1 || i === 3 ? (0.98 * T) / w : 1, sy = i >= 1 && i <= 3 ? (0.98 * T) / h : 1;
    g.save();
    g.translate(i * T + T / 2, T / 2); g.scale(sx, sy);
    const x = -(r - l) / 2, y = (up - dn) / 2;
    g.lineWidth = i < LINES ? 5 / Math.sqrt(sx * sy) : 4;   // 线拉长以后描边也跟着变形，按拉的倍数缩回去；面的字描粗一点，煤才压得住
    g.fillText(ch, x, y); g.strokeText(ch, x, y);
    g.restore();
  });
}

// ---------- 着色器 ----------
const QUAD_VS = /* glsl */ `
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// 底稿：r 是煤面的亮度（高光接近 1），g 是蓝光有多亮，b、a 是缝和裂纹在画面上的走向，
// 存成二倍角（cos 2θ、sin 2θ）再乘上「有多像一条线」：一道横线转 180° 还是它，一格取平均才不会正反抵消；
// 不在线上的地方是 0，平均下来越短，说明这一格越不像一条线
const WALL_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec2 uView;               // 画面盖住的煤壁有多大，以「一块煤」为单位
  uniform float uU, uCellW;         // 一圈里走到哪（0 到 1）；一格字在煤壁上多宽
  uniform vec3 uKey;                // 主光的方向
  uniform vec3 uPtr;                // 鼠标那盏灯：x、y、亮度
  uniform vec4 uTrail[${TRAIL}];    // 划过的点，由旧到新：x、y、过了几秒、是不是一笔的开头
  uniform float uTrailN;
  uniform vec4 uTap[${TAPS}];       // 裂开的地方：x、y、过了几秒、随机数
  uniform float uTapN;
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  vec2 h22(vec2 p) { return vec2(h21(p), h21(p + 17.17)); }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // 值和坡度一起算：x 是高度，yz 是坡度。平滑地取小（面和面之间是一道圆一点的棱，跟原图一样不是刀刃）
  vec3 smin3(vec3 a, vec3 b, float k) {
    float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
    return vec3(mix(b.x, a.x, h) - k * h * (1.0 - h), mix(b.yz, a.yz, h));
  }
  vec2 site(vec2 c) { return 0.14 + 0.72 * h22(c); }   // 每块煤的中心在自己那一格里的位置
  // 离这一点最近的那块煤：q 是这一点减块中心，id 是块的编号；ed 是离块边多远，en 是朝那条边的方向（Inigo Quilez 的两遍法）
  void voro(vec2 x, out vec2 q, out vec2 id, out float ed, out vec2 en) {
    vec2 n = floor(x), f = fract(x), mg = vec2(0.0), mr = vec2(0.0);
    float md = 8.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j)), r = g + site(n + g) - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
    ed = 8.0; en = vec2(1.0, 0.0);
    for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j)), r = g + site(n + g) - f;
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
    vec3 h = vec3(1.0 + 0.2 * h21(id + 0.37) - 0.5 * dot(q, q), -q);
    float a0 = h21(id + 3.1) * 6.2831853;
    for (int k = 0; k < 5; k++) {
      float fk = float(k);
      float a = a0 + fk * 1.2566371 + (h21(id + fk * 4.7) - 0.5) * 0.9;
      vec2 d = vec2(cos(a), sin(a));
      float sl = 0.75 + 0.7 * h21(id * 2.3 + fk);       // 这一面有多斜
      vec2 c = q - d * (0.1 + 0.2 * h21(id * 5.1 + fk));   // 凹下去的那个碗的中心
      float bowl = 1.5 + 1.1 * h21(id * 7.9 + fk);
      h = smin3(h, vec3(0.96 - sl * dot(q, d) + bowl * dot(c, c), -sl * d + 2.0 * bowl * c), 0.045);
    }
    return h;
  }
  // 到一段线段的距离，t 是落在线段上哪儿（0 到 1）
  float seg(vec2 p, vec2 a, vec2 b, out float t) {
    vec2 ab = b - a; float l2 = dot(ab, ab);
    t = l2 > 1e-8 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
    return length(p - a - ab * t);
  }
  void main() {
    vec2 x = (vUv - 0.5) * uView;
    vec2 q, id, en; float ed;
    voro(x, q, id, ed, en);
    // 高度：块本身，边沿斜着落进缝里（缝底在 -0.35）
    vec3 h = chunk(q, id);
    h = smin3(h, vec3(-0.35 + 7.0 * ed, -7.0 * en), 0.08);

    // 裂纹：每处裂开的地方往外裂 3 到 5 道，方向随机（不是均匀分开的星星），0.2 秒里裂到头；
    // 每道走三段、每段拐一下，越往外越细，第二段起头分一个小岔；裂纹再按噪声抖一抖，是参差的
    float crack = 0.0, cglow = 0.0, flash = 0.0;
    vec2 cdir = vec2(1.0, 0.0);
    for (int i = 0; i < ${TAPS}; i++) {
      if (float(i) >= uTapN) break;
      vec4 P = uTap[i];
      vec2 r = x - P.xy;
      if (P.z > ${TAP_LIFE}.0 || dot(r, r) > 3.0) continue;
      vec2 xr = r + 0.035 * (vec2(vnoise(x * 9.0 + P.w * 31.0), vnoise(x * 9.0 - P.w * 17.0 + 3.3)) - 0.5);
      float grow = smoothstep(0.0, 0.2, P.z), heal = 1.0 - smoothstep(${TAP_LIFE}.0 - 1.6, ${TAP_LIFE}.0, P.z);
      int K = 3 + int(h21(vec2(P.w, 1.7)) * 2.99);
      float cm = 0.0;
      for (int k = 0; k < 6; k++) {
        if (k >= K) break;
        float fk = float(k);
        float an = P.w * 6.2831853 + (fk + 0.75 * (h21(vec2(P.w * 9.1, fk)) - 0.5)) * 6.2831853 / float(K);
        float Lk = 0.5 + 0.6 * h21(vec2(fk, P.w * 3.1));
        vec2 a = vec2(0.0);
        for (int j = 0; j < 3; j++) {
          float fj = float(j), pj = clamp(grow * 3.0 - fj, 0.0, 1.0);   // 一段一段往外裂
          if (pj <= 0.0) break;
          float aj = an + (h21(vec2(fk * 3.0 + fj, P.w * 5.3)) - 0.5) * 1.2;
          vec2 dj = vec2(cos(aj), sin(aj)), b = a + dj * Lk / 3.0 * (0.7 + 0.6 * h21(vec2(fj, fk + P.w))) * pj;
          float t, dd = seg(xr, a, b, t);
          float w = uCellW * mix(0.7, 0.25, (fj + t) / 3.0);
          float m = 1.0 - smoothstep(w, w + uCellW * 0.45, dd);
          if (m > cm) { cm = m; cdir = dj; }
          if (j == 1) {
            float sb = h21(vec2(fk + 5.0, P.w)) > 0.5 ? 0.85 : -0.85;
            vec2 bd = vec2(cos(aj + sb), sin(aj + sb));
            float db = seg(xr, a, a + bd * Lk * 0.3 * pj, t);
            float mb = 1.0 - smoothstep(uCellW * 0.2, uCellW * 0.6, db);
            if (mb > cm) { cm = mb; cdir = bd; }
          }
          a = b;
        }
      }
      cm *= heal;
      crack = max(crack, cm);
      cglow += cm * (0.6 + 1.2 * exp(-P.z / 1.2));
      flash += exp(-dot(r, r) / (0.015 + 0.2 * P.z)) * exp(-P.z / 0.35);
    }
    // 划过：顺着划的路裂开一道参差的裂纹（按噪声抖一抖，不是一条顺滑的线），里面亮着蓝光，四秒里从老的那头合上；
    // 附近的缝也亮起来，光顺着缝往外渗，越老渗得越远、越暗
    float seep = 0.0;
    vec2 xj = x + 0.07 * (vec2(vnoise(x * 5.0 + 1.7), vnoise(x * 5.0 + 9.2)) - 0.5);
    for (int i = 0; i < ${TRAIL}; i++) {
      if (float(i) >= uTrailN) break;
      vec4 B = uTrail[i], A = (i == 0 || B.w > 0.5) ? B : uTrail[max(i - 1, 0)];
      float t, d = seg(x, A.xy, B.xy, t), a = mix(A.z, B.z, t);
      float fade = 1.0 - smoothstep(${TRAIL_LIFE}.0 - 1.5, ${TRAIL_LIFE}.0, a);
      float reach = 0.2 + 0.55 * pow(a, 0.7);
      seep = max(seep, 1.2 * exp(-d * d / (reach * reach)) * exp(-a / 1.6) * smoothstep(0.0, 0.05, a) * fade);
      vec2 ab = B.xy - A.xy;
      if (dot(ab, ab) > 1e-6) {
        float tj, dj = seg(xj, A.xy, B.xy, tj), aj = mix(A.z, B.z, tj);
        float w = uCellW * 0.45;
        float m = (1.0 - smoothstep(w, w + uCellW * 0.5, dj)) * (1.0 - smoothstep(${TRAIL_LIFE}.0 - 1.5, ${TRAIL_LIFE}.0, aj));
        if (m > crack) { crack = m; cdir = normalize(ab); }
        cglow = max(cglow, m * (0.55 + 0.8 * exp(-aj / 1.0)));
      }
    }
    h.x -= 0.4 * crack;

    // 光照：主光、鼠标那盏灯，漫射 + 高光；缝里、裂纹里低的地方暗（遮蔽）
    vec3 n = normalize(vec3(-0.6 * h.yz, 1.0)), V = vec3(0.0, 0.0, 1.0);
    float ao = mix(0.2, 1.0, smoothstep(-0.35, 0.8, h.x));
    float dif = max(dot(n, uKey), 0.0), spec = pow(max(dot(n, normalize(uKey + V)), 0.0), 60.0);
    vec3 Lp = vec3(uPtr.xy - x, 0.9 - 0.45 * h.x);
    float dp = length(Lp); Lp /= dp;
    float att = uPtr.z / (1.0 + dp * dp * 2.5);
    float pdif = max(dot(n, Lp), 0.0) * att, pspec = pow(max(dot(n, normalize(Lp + V)), 0.0), 36.0) * att;
    float lum = 0.04 + (0.52 * dif + 0.85 * pdif) * ao + (0.5 * spec + 0.6 * pspec) * ao;

    // 缝里的蓝光。平时：几处亮的沿着缝挪，是在噪声里绕一个圈取的，一圈以后回到原处
    vec2 lo = 1.3 * vec2(cos(6.2831853 * uU), sin(6.2831853 * uU));
    float L = 0.85 * smoothstep(0.74, 0.9, vnoise(x * 0.55 + lo + 3.0)) * (0.75 + 0.25 * sin(6.2831853 * (3.0 * uU + h21(id))));
    L = max(L, seep);
    float seam = 1.0 - smoothstep(0.0, 0.045, ed), lip = exp(-ed / 0.12);   // 缝里最亮，边沿上也漏一点
    float glow = L * (seam + 0.45 * lip) + cglow + 0.9 * flash;

    // 线：缝（块和块之间）、裂纹，记下走向
    float line = 1.0 - smoothstep(uCellW * 0.3, uCellW * 0.6, ed);
    vec2 dir = vec2(-en.y, en.x);
    if (crack > line) { line = crack; dir = cdir; }
    vec2 t2 = vec2(dir.x * dir.x - dir.y * dir.y, 2.0 * dir.x * dir.y) * line;
    o = vec4(clamp(lum, 0.0, 1.0), clamp(glow, 0.0, 1.0), t2 * 0.5 + 0.5);
  }
`;

const COMP_FS = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uWall, uAtlas;
  uniform vec2 uRes, uCells;        // 画布（设备像素）；底稿有几列几行格子（比画布多出不到一格）
  uniform float uCell, uLod, uN;    // 一格多少设备像素、取平均用的 mipmap 层（底稿一格两个像素，第 1 层正好一格一个）、图集里有几个字
  uniform vec2 uRange;              // 煤面的亮度从 x 到 y 铺满由淡到浓的字
  uniform float uDark;              // 深色主题：越亮越浓；浅色主题反过来
  uniform vec3 uC0, uC1, uC2, uC3;  // 煤面的色带
  uniform vec3 uSeam, uG0, uG1;     // 缝、光由弱到强
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) / uCells;
    vec4 s = textureLod(uWall, vec2(c0.x, 1.0 - c0.y), uLod);
    float r1 = hash(cell);
    vec2 t2 = s.ba * 2.0 - 1.0;
    float m = length(t2), glow = max(s.g + (r1 - 0.5) * 0.04, 0.0);   // 抖一点，但不能抖成负的：最暗的格子会挑到前一个字（/）
    float gi; vec3 col;
    float nf = uN - ${LINES}.0;
    if (m > 0.3) {
      // 缝、裂纹：按走向挑 - \\ | /（煤壁上 y 朝上：往右上走的是 /）
      float phi = 0.5 * atan(t2.y, t2.x);
      gi = abs(phi) < 0.3927 ? 0.0 : abs(phi) > 1.1781 ? 2.0 : phi > 0.0 ? 3.0 : 1.0;
      col = glow > 0.1 ? mix(uG0, uG1, clamp((glow - 0.1) / 0.6, 0.0, 1.0)) : uSeam;
    } else if (glow > 0.4) {
      // 光：缝的交叉处、裂开时炸开的那一下，按亮度挑字，蓝的
      float gl = clamp((glow - 0.4) / 0.5, 0.0, 0.999);
      gi = ${LINES}.0 + 1.0 + floor(gl * (nf - 1.0));
      col = mix(uG0, uG1, gl);
    } else {
      // 煤面：按亮度挑字。深色主题越亮越浓，浅色主题越暗越浓
      // 缝里的光漏到边上：深色主题字跟着亮一点，两种主题都染上蓝
      float lv = clamp((s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.08, 0.0, 0.999);
      if (uDark < 0.5) lv = pow(0.999 - lv, 0.65);   // 浅色主题反过来，再往浓里推一点：煤是黑的，亮面也不该是一片空白
      else lv = clamp(lv + 0.6 * glow, 0.0, 0.999);
      gi = ${LINES}.0 + floor(lv * nf);
      col = mix(ramp(lv), mix(uG0, uG1, clamp(glow * 1.5, 0.0, 1.0)), smoothstep(0.04, 0.3, glow));
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
  const wallP = program(gl, QUAD_VS, WALL_FS), compP = program(gl, QUAD_VS, COMP_FS);

  // 划过的点：煤壁上的 x、y（以一块煤为单位，y 朝上），什么时候划过的（毫秒），是不是一笔的开头
  const trail = [], trailU = new Float32Array(TRAIL * 4);
  // 裂开的地方：x、y，什么时候，随机数（定裂纹往哪几个方向、多长）
  const taps = [], tapU = new Float32Array(TAPS * 4);
  let wallRT = null, cols = 1, rows = 1, chunk = 160, view = [1, 1];

  const atlasCanvas = document.createElement("canvas");
  drawAtlas(atlasCanvas);
  const atlas = canvasTexture(gl, atlasCanvas);

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
    // 一块煤多大：短边的三成，夹在 110 到 190px 之间（卡片上三四排，详情页上七八列）
    chunk = Math.min(190, Math.max(110, Math.min(W, H) * 0.32));
    view = [(cols * cell) / chunk, (rows * cell) / chunk];
    wallRT?.dispose();
    // 底稿一格两个像素：第 1 层 mipmap 正好一格一个，取平均不用自己算
    wallRT = target(gl, cols * 2, rows * 2, { mipmaps: true });
    readTheme();
    paint(true);
  }

  // 画面上一点 → 煤壁上的位置
  const toWall = (x, y) => [(x / (cols * cell) - 0.5) * view[0], (0.5 - y / (rows * cell)) * view[1]];
  // 鼠标、手指：划的时候最新的一个点一直跟着手走，离上一个记下的点 28px 或者 90ms 就再记一个；
  // 停下 250ms 以上、移出画面，再动就是新的一笔。点一下：那里裂开，也记一个单独的点，让附近的缝亮起来
  let head = null, lastX = 0, lastY = 0, lastAt = -1e9;
  function push(pt) { trail.push(pt); if (trail.length > TRAIL) thin(trail); }
  function sweep(x, y, now) {
    const [wx, wy] = toWall(x, y);
    if (!head || now - head.t > 250) {
      head = { x: wx, y: wy, t: now, start: true }; push(head); lastX = x; lastY = y; lastAt = now;
    } else if (Math.hypot(x - lastX, y - lastY) >= 28 || now - lastAt >= 90 || trail[trail.length - 1] !== head || head.start) {
      head = { x: wx, y: wy, t: now, start: false }; push(head); lastX = x; lastY = y; lastAt = now;
    } else Object.assign(head, { x: wx, y: wy, t: now });
    paint(true);
  }
  function crackAt(x, y, now) {
    const [wx, wy] = toWall(x, y);
    taps.push({ x: wx, y: wy, t: now, seed: Math.random() });
    if (taps.length > TAPS) taps.shift();
    push({ x: wx, y: wy, t: now, start: true });
    head = null;
    paint(true);
  }
  const at = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onMove = (e) => {
    if (still || !W) return;
    const [x, y] = at(e), [wx, wy] = toWall(x, y);
    if (!lamp.on) { lamp.x = wx; lamp.y = wy; }
    lamp.tx = wx; lamp.ty = wy; lamp.on = 1;
    sweep(x, y, performance.now());
  };
  const onDown = (e) => { if (still || !W) return; const [x, y] = at(e); crackAt(x, y, performance.now()); };
  const onLeave = () => { head = null; lamp.on = 0; paint(true); };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerleave", onLeave);

  function frame(now) {
    raf = 0;
    if (dead || !W || !wallRT) return;
    const dt = prev < 0 ? 0 : Math.min(0.1, (now - prev) / 1000);
    prev = now;
    // 过了时候的点、裂纹扔掉；剩下的由旧到新传给着色器，最旧的那个就是一笔的开头
    while (trail.length && (now - trail[0].t) / 1000 >= TRAIL_LIFE) trail.shift();
    if (!trail.length) head = null;
    trail.forEach((p, i) => trailU.set([p.x, p.y, Math.max(0, (now - p.t) / 1000), i === 0 || p.start ? 1 : 0], i * 4));
    while (taps.length && (now - taps[0].t) / 1000 >= TAP_LIFE) taps.shift();
    taps.forEach((p, i) => tapU.set([p.x, p.y, Math.max(0, (now - p.t) / 1000), p.seed], i * 4));
    // 灯跟着鼠标挪、慢慢亮、慢慢灭
    const f = 1 - Math.exp(-dt * 10);
    lamp.x += (lamp.tx - lamp.x) * f; lamp.y += (lamp.ty - lamp.y) * f;
    lamp.k += ((still ? 0 : lamp.on) - lamp.k) * (1 - Math.exp(-dt * 5));
    const moving = Math.abs(lamp.tx - lamp.x) + Math.abs(lamp.ty - lamp.y) > 0.002 || Math.abs(lamp.on - lamp.k) > 0.01;
    const busy = trail.length > 0 || taps.length > 0 || moving;
    // 平时每秒 fps 帧；划过、裂开、灯在挪的时候每帧都画，跟得上手
    if (!still && !busy && now - last < 1000 / fps - 2) { schedule(); return; }
    last = now;
    const u = still ? 0.2 : (((now % period) + period) % period) / period;   // 不动时停在光从左上来的那一刻
    // 主光：在上方左右来回扫，仰角 35°
    const az = Math.PI / 2 + 1.0 * Math.sin(TAU * u), el = 0.62;
    const key = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
    wallRT.bind();
    wallP.use({
      uView: view, uU: u, uCellW: cell / chunk, uKey: key, uPtr: [lamp.x, lamp.y, lamp.k],
      uTrail: trailU, uTrailN: trail.length, uTap: tapU, uTapN: taps.length,
    });
    tri.draw();
    wallRT.mip();
    // 合成到画布上
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const C = COLORS[dark ? "dark" : "light"];
    compP.use({
      uWall: [wallRT.tex, 0], uAtlas: [atlas.tex, 1], uRes: [canvas.width, canvas.height], uCells: [cols, rows], uCell: cell * dpr,
      uLod: 1, uN: GLYPHS.length, uRange: C.range, uDark: dark ? 1 : 0,
      uC0: C.stone[0], uC1: C.stone[1], uC2: C.stone[2], uC3: C.stone[3], uSeam: C.seam, uG0: C.glow[0], uG1: C.glow[1],
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
    crack() { if (!still && W) crackAt(W * (0.25 + Math.random() * 0.5), H * (0.25 + Math.random() * 0.5), performance.now()); },
    refresh() { readTheme(); paint(true); },
    destroy() {
      dead = true; cancelAnimationFrame(raf); raf = 0;
      io.disconnect(); ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      motion.removeEventListener("change", onMotion);
      wallRT?.dispose(); atlas.dispose(); tri.dispose();
      wallP.dispose(); compP.dispose();
      // 上下文不强行丢掉：同一个 canvas 再挂一次（开发时 React 会挂两遍）还要用
    },
  };
}

export { create };
