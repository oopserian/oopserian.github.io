/* 用字符画（ASCII）画的一个黑洞。WebGL2 着色器画的黑洞只在离屏图里当底稿，屏幕上只有字。每帧两步：

     1. 黑洞（hole）：镜头在吸积盘上面一点，斜着看过去。每个像素从镜头打一条光线，按黑洞的引力一步步弯着走
        （史瓦西黑洞里光走的路，写成「往黑洞拉、跟距离五次方成反比」的加速度，跟真的轨道一模一样）：
        掉进视界的是黑的，穿过盘面就加上盘在那儿发的光，飞远了就是背后的星空。
        所以盘后面那一半的光被弯过来，在黑洞上面、下面各绕出一道光环；贴着黑洞边上是一圈细亮的光子环；
        背后的星星挨着黑洞的地方也被弯过去，一颗看成两颗。
        盘内圈热、外圈暗；朝着镜头转过来的那边亮得多（相对论的多普勒增亮），背过去的那边暗。
        盘上一道道气流按开普勒转：里圈快、外圈慢。
        底稿存三样：亮度、星星有多亮、字该朝哪个方向放（气体绕着转的方向，按屏幕上算的，
        所以绕到黑洞上面的那道光环，字也跟着绕过去），方向存成二倍角。
     2. 合成（composite）：整块切成 8px 见方的格子。跟另外几个字符画一个做法：
        盘按亮度从 - ~ = 里挑，颜色沿一条色带走，字再转到气体的流向上，一圈圈轨道就被字描出来；
        星星是另一个颜色的 . + *，不转；黑洞和空的天上没有字，露出网页自己的底色。

   鼠标、手指划过盘面：从画面上那一点照样弯着打一条光线，落在盘上哪一点，就往那儿撒一团气体；
   气体跟着盘转，里快外慢，被扯成一道弧，一边往里卷一边越来越亮，到盘的内沿就没了。
   点一下：扔进一颗星，被潮汐力撕成一条长长的亮带，绕着卷进去，掉到内沿时整圈亮一下。

   盘上的气流一圈 period 刚好转整数圈（里圈转得多，外圈少；相邻两种转速之间渐变过去），星星闪的快慢也是整数倍，
   录出来的视频首尾接得上。

   省着画：平时每秒 30 帧，划过、星星还没卷完的时候跟着屏幕刷新；滚出屏幕、切到别的标签页就停；
   系统开了「减弱动态效果」，或者显卡是 CPU 模拟的（没有能用的显卡、无头浏览器），只画一帧不动的，也不跟着鼠标动。

     const h = create(canvas, { period: 12000 });
     h.drop();                       // 往随便一处扔一颗星（键盘用）
     h.refresh();                    // 换了主题以后调：换字的颜色
     h.destroy();                    // 不用了：停下、摘掉监听、释放显存 */
import { context, program, fullscreen, target, canvasTexture, softwareGL } from "../_kit/gl.js";

// 长度单位是黑洞的半径（视界，史瓦西半径）
const DEF = {
  CD: 24, EL: 12, ROLL: -5,      // 镜头离黑洞多远；在盘面上面几度；画面歪几度
  LOOKY: 0.5,                    // 镜头对着黑洞上面一点（上面那道光环比下面的高，这样上下留的空一样）
  TY: 0.245, TXMIN: 0.3,         // 竖着半个画面的 tan；竖屏时横着至少多宽
  RIN: 3, ROUT: 11,              // 盘的内沿（最内的稳定轨道）、外沿
  SPIN: 6,                       // 内沿一圈 period 转几圈
  BEAM: 2.5,                     // 多普勒增亮的次方
  EXPO: 3,                       // 亮度压到 0 到 1 时的曝光
  TEXC: 1.3, BMAX: 0.5,          // 气流明暗反差；多普勒算的速度最多多快（光速的几成）
  DIRLOD: 1.5,                   // 字的方向从哪一层 mipmap 取
};
const P = DEF;
const CLUMPS = 48, CLUMP_LIFE = 6;   // 同时最多几团气体；一团几秒卷进去
const STARS = 4, STAR_FALL = 3.2, STAR_LIFE = 5;   // 同时最多几颗星；几秒卷到内沿；几秒后没了
const f = (x) => Number(x).toFixed(5);

// 颜色：盘的字沿一条四个颜色的色带走，越亮越浓；星星一个颜色。
// 深色主题：暗红、橙、金，最亮的地方近白；浅色主题像钢笔画：亮的地方墨浓，由浅赭到深褐
const COLORS = {
  dark: {
    disk: [[0.5, 0.14, 0.1], [0.95, 0.4, 0.14], [1.0, 0.72, 0.32], [1.0, 0.96, 0.86]], star: [0.82, 0.88, 1.0], hot: [0.62, 0.84, 1.0],
    range: [0.06, 0.85], dense: 1.4,
  },
  light: {
    disk: [[0.78, 0.6, 0.46], [0.62, 0.34, 0.18], [0.42, 0.17, 0.07], [0.16, 0.05, 0.02]], star: [0.3, 0.32, 0.42], hot: [0.1, 0.2, 0.62],
    range: [0.06, 0.85], dense: 1.2,
  },
};

// ---------- 字的图集 ----------
// 一行一格 64 见方（字要转，格子得是正方形）。前 3 个是盘，由淡到浓 - ~ =，横着拉宽，一格接一格连成一道道弧；
// 后 3 个是星星，由暗到亮 . + *，不拉宽。每个字按墨迹居中，再描一圈边，笔画粗一点
const GLYPHS = ["-", "~", "=", ".", "+", "*"], DISK = 3;
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
    const sx = i < DISK ? Math.max(1, Math.min(1.8, (0.84 * T) / (l + r))) : 1;
    g.save();
    g.translate(i * T + T / 2, T / 2); g.scale(sx, 1);
    const x = -(r - l) / 2, y = (up - dn) / 2;
    g.lineWidth = i < DISK ? 4.5 : 3;
    g.fillText(ch, x, y); g.strokeText(ch, x, y);
    g.restore();
  });
}

// ---------- 光线：着色器和引擎（找鼠标落在盘上哪一点）走同一套步子 ----------
// 史瓦西黑洞里光走的路：x'' = -1.5 h² x / r⁵（h 是角动量 |x × v|，视界半径取 1）。
// 每步走 0.07r（离黑洞越近步子越小），速度 Verlet 积分
const STEPS = 170;
const step = (r) => 0.07 * r + 0.01;

// ---------- 着色器 ----------
const QUAD_VS = /* glsl */ `
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// 底稿：r 是亮度，g 是星星有多亮，b、a 是字该朝的方向（画面上，y 朝下），
// 存成二倍角（cos 2θ、sin 2θ）：一道横线转 180° 还是它，一格取平均才不会正反抵消
const holeFS = () => /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec3 uCamP, uCamR, uCamU, uCamF;   // 镜头在哪；往右、往上、往前
  uniform vec2 uTan;                          // 画面右边沿、上边沿的 tan
  uniform float uU;                           // 一圈里走到哪（0 到 1）
  uniform vec4 uClump[${CLUMPS}];             // 气体：现在在盘上的半径、角度，被扯斜了多少，多亮
  uniform float uClumpN;
  uniform vec4 uStar[${STARS}];               // 扔进去的星：半径、角度、扯斜了多少、撕开的亮带多亮
  uniform vec4 uBody[${STARS}];               // 还没撕开的星本身：在哪（x、y、z），多大
  uniform float uStarN, uFlare;               // 掉到内沿时整圈亮一下
  const float TAU = 6.2831853, RIN = ${f(P.RIN)}, ROUT = ${f(P.ROUT)}, BW = 0.3;

  float h21(vec2 p) {
    uvec2 q = uvec2(ivec2(floor(p))) * uvec2(1597334673u, 3812015801u);
    uint n = (q.x ^ q.y) * 1597334673u;
    return float(n) * (1.0 / 4294967295.0);
  }
  vec3 h33(vec3 p) {
    uvec3 q = uvec3(ivec3(floor(p))) * uvec3(1597334673u, 3812015801u, 2798796415u);
    uint n = q.x ^ q.y ^ q.z;
    return vec3(uvec3(n * 1597334673u, n * 3812015801u, n * 2798796415u)) * (1.0 / 4294967295.0);
  }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // x 方向每 per 格首尾相接的噪声：绕盘一圈正好接上
  float vnoiseP(vec2 x, float per) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    float i0 = mod(i.x, per), i1 = mod(i.x + 1.0, per);
    return mix(mix(h21(vec2(i0, i.y)), h21(vec2(i1, i.y)), f.x), mix(h21(vec2(i0, i.y + 1.0)), h21(vec2(i1, i.y + 1.0)), f.x), f.y);
  }
  float wrapPi(float a) { return a - TAU * floor(a / TAU + 0.5); }

  // 盘上的气流：按半径切成一圈圈窄带，每圈按开普勒的转速取一个整数（一圈 period 转几圈），
  // 相邻两圈转速一样就是同一份花纹，不一样就渐变过去。花纹顺着转的方向拉得很长
  float band(float b, float r, float a) {
    float rb = (b + 0.5) * BW;
    float n = max(1.0, floor(${f(P.SPIN)} * pow(rb / RIN, -1.5) + 0.5));
    float q = a - n * uU;
    return 0.6 * vnoiseP(vec2(q * 14.0, r * 3.2), 14.0) + 0.4 * vnoiseP(vec2(q * 42.0, r * 8.0 + 3.0), 42.0);
  }
  float diskTex(float r, float a) {
    float bc = r / BW, b0 = floor(bc), k = smoothstep(0.0, 1.0, fract(bc));
    return mix(band(b0, r, a), band(b0 + 1.0, r, a), k);
  }
  // 内沿最亮，往外暗下去
  float prof(float r) {
    return smoothstep(RIN * 0.97, RIN + 0.5, r) * pow(RIN / r, 1.8) * (1.0 - smoothstep(ROUT * 0.55, ROUT, r));
  }

  // 背后的星星：方向切成小格，少数格子里有一颗，一圈闪整数次
  float stars(vec3 d) {
    vec3 q = d * 110.0, c = floor(q), h = h33(c);
    if (h.x < 0.9) return 0.0;
    vec3 hp = h33(c + 17.0);
    float dd = length(q - c - 0.5 - 0.5 * (hp - 0.5));
    float tw = 0.75 + 0.25 * sin(TAU * (uU * floor(1.0 + 3.0 * h.z) + h.y));   // 闪：一圈整数次
    return smoothstep(0.4, 0.05, dd) * (0.35 + 0.65 * h.y) * tw;
  }

  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 rd = normalize(uCamF + ndc.x * uTan.x * uCamR + ndc.y * uTan.y * uCamU);
    vec3 x = uCamP, v = rd;
    vec3 cr = cross(x, v);
    float h2 = dot(cr, cr);
    float L = 0.0, Lh = 0.0, Tr = 1.0, sp = 0.0, wBest = 0.0, flow = 0.0, kind = 0.0;
    bool esc = false;
    for (int i = 0; i < ${STEPS}; i++) {
      float r = length(x);
      if (r < 1.0) break;                                  // 掉进视界
      if (r > ${f(P.CD * 1.3)} && dot(x, v) > 0.0) { esc = true; break; }
      float dt = 0.07 * r + 0.01;
      vec3 a = -1.5 * h2 * x / pow(r, 5.0);
      vec3 xn = x + v * dt + 0.5 * a * dt * dt;
      float rn = length(xn);
      vec3 an = -1.5 * h2 * xn / pow(rn, 5.0);
      vec3 vn = v + 0.5 * (a + an) * dt;
      // 穿过盘面：在这一步里按高度插出穿过的那一点
      if (x.y * xn.y <= 0.0 && x.y != xn.y) {
        vec3 Pt = mix(x, xn, x.y / (x.y - xn.y));
        float rp = length(Pt.xz);
        if (rp > RIN * 0.9 && rp < ROUT + 3.0) {
          float phi = atan(Pt.z, Pt.x);
          float tex = diskTex(rp, phi / TAU);
          float dens = prof(rp) * (0.15 + ${f(P.TEXC)} * smoothstep(0.2, 0.85, tex)), ex = 0.0;
          // 撒进去的气体：沿着各自的轨道被扯成一道弧（ex：撒进去、扔进去的东西发的光，合成时换一个更热的颜色）
          for (int j = 0; j < ${CLUMPS}; j++) {
            if (float(j) >= uClumpN) break;
            vec4 C = uClump[j];
            float dr = rp - C.x, dp = wrapPi(phi - C.y - C.z * dr) * rp;
            ex += C.w * exp(-dr * dr / 0.06 - dp * dp / 0.2) * (0.25 + 1.1 * tex);
          }
          // 扔进去的星：先是一颗亮点，再被撕成一条细长的亮带
          for (int j = 0; j < ${STARS}; j++) {
            if (float(j) >= uStarN) break;
            vec4 S = uStar[j];
            float dr = rp - S.x, dp = wrapPi(phi - S.y - S.z * dr) * rp;
            ex += S.w * exp(-dr * dr / 0.15 - dp * dp / 0.3) * (0.5 + 0.8 * tex);
          }
          ex += uFlare * exp(-pow((rp - RIN - 0.25) / 0.4, 2.0)) * (0.5 + 0.8 * tex);
          dens += ex;
          // 朝镜头转过来的那边亮（多普勒增亮），越靠里被引力红移得越暗
          vec3 od = vec3(-Pt.z, 0.0, Pt.x) / max(rp, 1e-3);
          float beta = min(sqrt(0.5 / max(rp - 1.0, 0.5)), ${f(P.BMAX)});
          float D = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(od, -normalize(vn)));
          float e = dens * pow(D, ${f(P.BEAM)}) * sqrt(max(1.0 - 1.0 / rp, 0.0));
          L += Tr * e; Lh += Tr * e * ex / max(dens, 1e-4);
          if (Tr * e > wBest) { wBest = Tr * e; flow = rp; kind = 1.0; }
          Tr *= 1.0 - clamp(dens * 1.4, 0.0, 0.9);
        }
      }
      // 还没撕开的星：一个发亮的小球，光线从它旁边擦过（这一步的线段离球心够近）就算碰上
      for (int j = 0; j < ${STARS}; j++) {
        if (float(j) >= uStarN) break;
        vec4 B = uBody[j];
        if (B.w <= 0.0) continue;
        vec3 sg = xn - x;
        float tt = clamp(dot(B.xyz - x, sg) / dot(sg, sg), 0.0, 1.0), d = length(x + sg * tt - B.xyz);
        if (d < B.w) { float e = 3.0 * sqrt(1.0 - d / B.w); L += Tr * e; Lh += Tr * e; Tr *= 0.1; }
      }
      x = xn; v = vn;
      if (Tr < 0.03) break;
    }
    if (esc) {
      vec3 d = normalize(v);
      sp = max(sp, Tr * stars(d));
    }
    // 字的方向：顺着盘上半径的等值线，就是一圈圈轨道。按屏幕算，光环上的字也跟着绕
    vec2 g = vec2(dFdx(flow), -dFdy(flow));
    float kd = abs(dFdx(kind)) + abs(dFdy(kind));
    vec2 t = vec2(-g.y, g.x);
    float m2 = dot(t, t);
    vec2 dir = (m2 > 1e-14 && kd < 0.5) ? vec2(t.x * t.x - t.y * t.y, 2.0 * t.x * t.y) / m2 : vec2(0.0);
    // g：盘上是这一点的光里有几成是撒进去、扔进去的东西发的，空的天上是星星有多亮（合成时看这一格有没有盘来分）
    float Lt = 1.0 - exp(-${f(P.EXPO)} * L);
    o = vec4(Lt, Lt > 0.02 ? clamp(1.5 * Lh / max(L, 1e-4), 0.0, 1.0) : clamp(sp, 0.0, 1.0), dir * 0.5 + 0.5);
  }
`;

const compFS = () => /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uImg, uAtlas;
  uniform vec2 uRes, uCells;        // 画布（设备像素）；底稿有几列几行格子（比画布多出不到一格）
  uniform float uCell, uN;          // 一格多少设备像素、图集里有几个字
  uniform vec2 uRange;              // 亮度从 x 到 y 铺满由淡到浓的字；比 x 暗的不画
  uniform vec3 uC0, uC1, uC2, uC3;  // 盘的色带
  uniform vec3 uStar, uHot;         // 星星；撒进去的气体、扔进去的星（更热，偏蓝白）
  uniform float uDense;             // 字由细到粗怎么分：越大，越亮的格子才用得上 =
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) / uCells, uv = vec2(c0.x, 1.0 - c0.y);
    vec4 s = textureLod(uImg, uv, 1.0);                           // 底稿一格两个像素，第 1 层 mipmap 正好一格一个
    float r1 = hash(cell);
    float gi = -1.0, a = 0.0;
    vec3 col = vec3(0.0);
    float lv = (s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.06;
    vec2 t2 = textureLod(uImg, uv, ${f(P.DIRLOD)}).ba * 2.0 - 1.0;
    float ang = dot(t2, t2) > 1e-12 ? 0.5 * atan(t2.y, t2.x) * smoothstep(0.05, 0.25, length(t2)) : 0.0;   // atan(0, 0) 没定义，有的显卡算出 NaN
    if (lv > 0.0) {
      // 盘：亮度挑 - ~ =，字转到气体的流向上；撒进去的气体往热的颜色上靠
      a = ang;
      lv = clamp(lv, 0.0, 0.999);
      lv = mix(lv, lv * lv * (3.0 - 2.0 * lv), 0.5);   // 拉开一点反差
      float hot = smoothstep(0.1, 0.8, s.g);
      lv = max(lv, 0.6 * hot);
      gi = min(floor(pow(lv, uDense) * ${DISK}.0), ${DISK}.0 - 1.0);
      col = mix(ramp(lv), uHot, 0.85 * hot);
    } else if (s.r < 0.003 && s.g > 0.1 + 0.08 * r1) {
      // 星星：. + * 由暗到亮，不转
      float k = clamp((s.g - 0.1) / 0.4, 0.0, 0.999);
      gi = ${DISK}.0 + floor(k * (uN - ${DISK}.0));
      col = uStar;
    }
    float ink = 0.0;
    if (gi >= 0.0) {
      vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
      vec2 q = vec2(cos(a) * loc.x + sin(a) * loc.y, -sin(a) * loc.x + cos(a) * loc.y);
      if (abs(q.x) < 0.5 && abs(q.y) < 0.5) ink = texture(uAtlas, vec2((gi + q.x + 0.5) / uN, 0.5 - q.y)).r;
    }
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
  const holeP = program(gl, QUAD_VS, holeFS()), compP = program(gl, QUAD_VS, compFS());

  // 气体：r0（撒下去的半径）、现在的半径、角度、扯斜了多少、过了几秒
  const clumps = [], clumpU = new Float32Array(CLUMPS * 4);
  const stars = [], starU = new Float32Array(STARS * 4), bodyU = new Float32Array(STARS * 4);
  let img = null, cols = 1, rows = 1;

  const atlasCanvas = document.createElement("canvas");
  drawAtlas(atlasCanvas);
  const atlas = canvasTexture(gl, atlasCanvas);

  // 镜头：离黑洞 CD，在盘面上面 EL 度，看着黑洞上面 LOOKY 那一点，画面歪 ROLL 度
  const el = (P.EL * Math.PI) / 180, roll = (P.ROLL * Math.PI) / 180;
  const pos = [0, P.CD * Math.sin(el), P.CD * Math.cos(el)];
  const fl = Math.hypot(pos[1] - P.LOOKY, pos[2]);
  const F = [0, (P.LOOKY - pos[1]) / fl, -pos[2] / fl];
  const R0 = [1, 0, 0], U0 = [0, -F[2], F[1]];   // 往上：F 绕 x 轴转 90°
  const cam = {
    R: R0.map((v, i) => v * Math.cos(roll) + U0[i] * Math.sin(roll)),
    U: U0.map((v, i) => v * Math.cos(roll) - R0[i] * Math.sin(roll)),
    tan: [1, 1],
  };
  function aim(aspect) {
    let ty = P.TY, tx = ty * aspect;
    if (tx < P.TXMIN) { tx = P.TXMIN; ty = tx / aspect; }
    cam.tan = [tx, ty];
  }

  let W = 0, H = 0, dpr = 1, raf = 0, visible = true, last = -1e9, prev = -1, dead = false, dark = false;

  function readTheme() { dark = getComputedStyle(canvas).colorScheme.includes("dark"); }
  function relayout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    cols = Math.ceil(W / cell); rows = Math.ceil(H / cell);
    aim(cols / rows);
    img?.dispose();
    // 底稿一格两个像素：第 1 层 mipmap 正好一格一个，取平均不用自己算
    img = target(gl, cols * 2, rows * 2, { mipmaps: true });
    readTheme();
    paint(true);
  }

  // 画面上一点 → 盘上的半径和角度：跟着色器一样弯着走，第一次穿过盘面（盘外面三个单位以内）的那一点；碰不到就是 null
  function toDisk(px, py) {
    const nx = (px / (cols * cell)) * 2 - 1, ny = 1 - (py / (rows * cell)) * 2;
    const d = [0, 1, 2].map((i) => F[i] + nx * cam.tan[0] * cam.R[i] + ny * cam.tan[1] * cam.U[i]);
    const l = Math.hypot(...d);
    let x = pos.slice(), v = d.map((c) => c / l);
    const c = [x[1] * v[2] - x[2] * v[1], x[2] * v[0] - x[0] * v[2], x[0] * v[1] - x[1] * v[0]];
    const h2 = c[0] * c[0] + c[1] * c[1] + c[2] * c[2];
    for (let i = 0; i < STEPS; i++) {
      const r = Math.hypot(...x);
      if (r < 1) return null;
      if (r > P.CD * 1.3 && x[0] * v[0] + x[1] * v[1] + x[2] * v[2] > 0) return null;
      const dt = step(r), k = (-1.5 * h2) / r ** 5;
      const a = x.map((q) => q * k);
      const xn = x.map((q, j) => q + v[j] * dt + 0.5 * a[j] * dt * dt);
      const kn = (-1.5 * h2) / Math.hypot(...xn) ** 5;
      const vn = v.map((q, j) => q + 0.5 * (a[j] + xn[j] * kn) * dt);
      if (x[1] * xn[1] <= 0 && x[1] !== xn[1]) {
        const t = x[1] / (x[1] - xn[1]);
        const qx = x[0] + (xn[0] - x[0]) * t, qz = x[2] + (xn[2] - x[2]) * t, rp = Math.hypot(qx, qz);
        if (rp > P.RIN * 0.9 && rp < P.ROUT + 3) return { r: Math.max(rp, P.RIN + 0.2), phi: Math.atan2(qz, qx) };
      }
      x = xn; v = vn;
    }
    return null;
  }
  // 盘转得多快（弧度每秒）：内沿一圈 period 转 SPIN 圈，往外按开普勒慢下去
  const omega = (r) => ((P.SPIN * 2 * Math.PI) / (period / 1000)) * Math.pow(r / P.RIN, -1.5);

  // 鼠标、手指：划过去离上一团 24px 或者 80ms 就再撒一团
  let lastX = -1e9, lastY = -1e9, lastAt = -1e9;
  function sweep(x, y, now) {
    if (Math.hypot(x - lastX, y - lastY) < 24 && now - lastAt < 80) return;
    const q = toDisk(x, y);
    if (!q) return;
    lastX = x; lastY = y; lastAt = now;
    clumps.push({ r0: q.r, r: q.r, phi: q.phi, k: 0, age: 0 });
    if (clumps.length > CLUMPS) clumps.shift();
    paint(true);
  }
  function dropAt(x, y) {
    const q = toDisk(x, y);
    if (!q) return false;
    stars.push({ r0: q.r, r: q.r, phi: q.phi, k: 0, age: 0 });
    if (stars.length > STARS) stars.shift();
    paint(true);
    return true;
  }
  const at = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onMove = (e) => { if (still || !W) return; const [x, y] = at(e); sweep(x, y, performance.now()); };
  const onDown = (e) => { if (still || !W) return; const [x, y] = at(e); dropAt(x, y); };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);

  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // 气体、星往前走 dt 秒：一边绕着转一边往里卷，里圈转得快，所以被扯成一道弧
  function advance(dt) {
    for (const c of clumps) {
      c.age += dt;
      const t = Math.min(c.age / CLUMP_LIFE, 1);
      c.r = c.r0 - (c.r0 - P.RIN + 0.15) * Math.pow(t, 1.6);
      const om = omega(c.r);
      c.phi += om * dt; c.k += ((-1.5 * om) / c.r) * dt;
    }
    while (clumps.length && clumps[0].age >= CLUMP_LIFE) clumps.shift();
    for (const s of stars) {
      s.age += dt;
      const t = Math.min(s.age / STAR_FALL, 1);
      s.r = s.r0 - (s.r0 - P.RIN + 0.1) * t * t;
      const om = omega(s.r);
      s.phi += om * dt; s.k += ((-1.5 * om) / s.r) * dt * 3 * ss(0.4, 1.0, s.age);   // 撕开以后被扯得比气体快
    }
    while (stars.length && stars[0].age >= STAR_LIFE) stars.shift();
  }

  function frame(now) {
    raf = 0;
    if (dead || !W || !img) return;
    const dt = prev < 0 ? 0 : Math.min(0.1, (now - prev) / 1000);
    const busy = clumps.length > 0 || stars.length > 0;
    // 平时每秒 fps 帧；气体、星还在的时候每帧都画，跟得上手
    if (!still && !busy && now - last < 1000 / fps - 2) { prev = now; schedule(); return; }
    last = now;
    advance(still ? 0 : dt); prev = now;
    clumps.forEach((c, i) => {
      const t = c.age / CLUMP_LIFE;
      clumpU.set([c.r, c.phi, c.k, 0.6 * ss(0, 0.2, c.age) * (1 - ss(0.7, 1, t)) * (1 + 1.5 * t)], i * 4);
    });
    let flare = 0;
    stars.forEach((s, i) => {
      starU.set([s.r, s.phi, s.k, 2.5 * ss(0.4, 1.0, s.age) * (1 - ss(STAR_FALL - 0.3, STAR_FALL + 0.2, s.age))], i * 4);
      bodyU.set([s.r * Math.cos(s.phi), 0.12, s.r * Math.sin(s.phi), 0.55 * (1 - ss(0.5, 1.3, s.age))], i * 4);
      if (s.age > STAR_FALL - 0.3) flare += 1.4 * ss(STAR_FALL - 0.3, STAR_FALL, s.age) * Math.exp(-Math.max(0, s.age - STAR_FALL) * 1.6);
    });
    const u = still ? 0 : (((now % period) + period) % period) / period;
    img.bind();
    holeP.use({
      uCamP: pos, uCamR: cam.R, uCamU: cam.U, uCamF: F, uTan: cam.tan, uU: u,
      uClump: clumpU, uClumpN: clumps.length, uStar: starU, uBody: bodyU, uStarN: stars.length, uFlare: flare,
    });
    tri.draw();
    img.mip();
    // 合成到画布上
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const C = COLORS[dark ? "dark" : "light"];
    compP.use({
      uImg: [img.tex, 0], uAtlas: [atlas.tex, 1], uRes: [canvas.width, canvas.height], uCells: [cols, rows], uCell: cell * dpr,
      uN: GLYPHS.length, uRange: C.range,
      uC0: C.disk[0], uC1: C.disk[1], uC2: C.disk[2], uC3: C.disk[3], uStar: C.star, uHot: C.hot, uDense: C.dense,
    });
    tri.draw();
    if (!still) schedule();
  }
  function schedule() { if (!raf && !dead && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  // force：马上画这一帧，不等限帧（尺寸、主题变了）
  function paint(force = false) { if (force) last = -1e9; schedule(); }

  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { prev = -1; paint(true); } });
  io.observe(canvas);
  const ro = new ResizeObserver(() => relayout());
  ro.observe(canvas);
  const onVis = () => { if (!document.hidden) { prev = -1; paint(true); } };
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
    drop() {
      if (still || !W) return;
      // 随便挑盘上一点；落空就再挑
      for (let i = 0; i < 12; i++) if (dropAt(W * (0.15 + Math.random() * 0.7), H * (0.35 + Math.random() * 0.4))) return;
    },
    refresh() { readTheme(); paint(true); },
    destroy() {
      dead = true; cancelAnimationFrame(raf); raf = 0;
      io.disconnect(); ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onVis);
      motion.removeEventListener("change", onMotion);
      img?.dispose(); atlas.dispose(); tri.dispose();
      holeP.dispose(); compP.dispose();
      // 上下文不强行丢掉：同一个 canvas 再挂一次（开发时 React 会挂两遍）还要用
    },
  };
}

export { create };
