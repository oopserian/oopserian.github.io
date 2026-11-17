/* 拿在手里的纸：一小块布料一样的网格，带纸的硬度，用 WebGL2 画在页面上面。
   坐标用舞台的设计像素：x 向右、y 向下、z 离开桌面往上。透视镜头放在 z = CAMZ，视角算好让 z = 0 正好落在底下的页面上，
   所以桌上的小图和拿起来的纸互换时没有接缝。没有 WebGL2 时 createPaper 返回 null，desk.js 换成扁平的卡片。
   不引 Three.js：透视矩阵、网格、离屏影子图这几样自己写，杂活用 _kit/gl.js（为什么见 README 的「选型」）。 */
import { program, fullscreen, target, canvasTexture } from "../_kit/gl.js";
import { motion, clamp, lerp, Spring } from "./motion.js";
import { PAPER_BACK } from "./pages.js";

const CAMZ = 1100, LIFT = 62, STEP = 1 / 120, ITER = 10;
const L = norm([-0.32, 0.46, 0.83]);   // 光：高高的，从左上来（世界坐标，y 向上）
const SH = [0.16, 0.55];               // 主光的影子每升高 1px 往右下滑多少（设计坐标）

// 纸：平放时颜色正好等于贴图（跟 DOM 小图一样），歪了才变亮变暗；高光减掉平放时的那一份，所以平放没有高光
const VS = `layout(location = 0) in vec3 position; layout(location = 1) in vec3 normal; layout(location = 2) in vec2 uv;
  uniform mat4 uP; uniform vec2 uSize;
  out vec2 vUv; out vec3 vN; out vec3 vW;
  void main() {
    vec3 w = vec3(position.x - uSize.x * 0.5, uSize.y * 0.5 - position.y, position.z);
    vUv = uv; vN = vec3(normal.x, -normal.y, normal.z); vW = w;
    gl_Position = uP * vec4(w.xy, w.z - ${CAMZ.toFixed(1)}, 1.0);
  }`;
const FS = `precision highp float;
  uniform sampler2D map; uniform vec3 uL, uBack; uniform float uExp, uGloss, uShine, uCut, uEar; uniform vec2 uF;
  in vec2 vUv; in vec3 vN; in vec3 vW; out vec4 o;
  void main() {
    vec2 q = vec2((1.0 - vUv.x) / uF.x, (1.0 - vUv.y) / uF.y);
    if (uCut > 0.5 && q.x + q.y < 1.0) discard;            // 折角折过去了，这一角是空的
    vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
    float lit = 0.72 + 0.28 * clamp(dot(N, uL) / uL.z, 0.0, 1.25);
    vec3 V = normalize(vec3(0.0, 0.0, ${CAMZ.toFixed(1)}) - vW), Hh = normalize(uL + V);
    float sp = max(pow(max(dot(N, Hh), 0.0), uShine) - pow(max(Hh.z, 0.0), uShine), 0.0);
    vec3 tex = texture(map, vUv, -0.5).rgb;                 // 比普通的 mipmap 稍锐一点，跟浏览器自己缩小的图对得上
    vec3 alb = gl_FrontFacing ? tex : mix(uBack, tex, 0.06); // 背面是纸背的颜色，透一点点正面的字
    // 折角压在纸上，在它下边和左边投一道很淡的影子
    float fold = uEar * uEar * uEar * uCut;
    float below = step(1.0, q.y) * (1.0 - smoothstep(1.0, 1.22, q.y)) * (1.0 - smoothstep(0.9, 1.06, q.x));
    float left = step(1.0, q.x) * (1.0 - smoothstep(1.0, 1.1, q.x)) * (1.0 - smoothstep(0.85, 1.0, q.y));
    alb *= 1.0 - fold * (0.13 * below + 0.05 * left);
    o = vec4(min(alb * lit * uExp, vec3(1.0)) + vec3(1.0, 0.97, 0.93) * min(uGloss * sp, 0.3), 1.0);
  }`;
// 影子：把纸压扁画进一张图。红 = 主光的影子，按高度往右下滑；绿 = 贴着纸底下的一圈环境影子。两张都取最大值叠
const SVS = `layout(location = 0) in vec3 position; layout(location = 2) in vec2 uv;
  uniform vec2 uK, uO, uSize; out float vZ; out vec2 vUv;
  void main() {
    vZ = position.z; vUv = uv;
    vec2 p = position.xy + uK * position.z + uO;
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
  }`;
const SFS = `precision highp float;
  uniform float uCh, uCut; uniform vec2 uF; in float vZ; in vec2 vUv; out vec4 o;
  void main() {
    vec2 q = vec2((1.0 - vUv.x) / uF.x, (1.0 - vUv.y) / uF.y);
    if (uCut > 0.5 && q.x + q.y < 1.0) discard;             // 折角缺掉的地方没有纸，也就没有影子
    float v = mix(1.0, 0.6, clamp(vZ / 140.0, 0.0, 1.0));
    o = uCh < 0.5 ? vec4(v, 0.0, 0.0, 1.0) : vec4(0.0, 1.0, 0.0, 1.0);
  }`;
const QVS = `layout(location = 0) in vec2 position; out vec2 vUv;
  void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`;
// 横竖各模糊一遍，两个通道的半径不一样：主光影子随高度慢慢散，环境影子散得快
const BFS = `precision highp float;
  uniform sampler2D t; uniform vec2 uD; uniform float uA, uB; in vec2 vUv; out vec4 o;
  void main() {
    float r = 0.0, g = 0.0, wr = 0.0;
    for (int i = -6; i <= 6; i++) {
      float f = float(i), w = exp(-f * f / 18.0);
      r += texture(t, vUv + uD * f * uA).r * w; g += texture(t, vUv + uD * f * uB).g * w; wr += w;
    }
    o = vec4(r / wr, g / wr, 0.0, 1.0);
  }`;
const PFS = `precision highp float;
  uniform sampler2D t; uniform float uC, uK; uniform vec3 uCol; in vec2 vUv; out vec4 o;
  void main() { vec4 s = texture(t, vUv); o = vec4(uCol, clamp(s.r * uC + s.g * uK, 0.0, 0.9)); }`;

function norm(v) { const m = Math.hypot(...v); return v.map((x) => x / m); }

/** @param {HTMLCanvasElement} canvas 盖在舞台上的画布。没有 WebGL2 返回 null */
export function createPaper(canvas) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: false, powerPreference: "high-performance" });
  if (!gl) return null;
  let pPaper, pShadow, pBlur, pPlane, quad;
  try {
    pPaper = program(gl, VS, FS); pShadow = program(gl, SVS, SFS); pBlur = program(gl, QVS, BFS); pPlane = program(gl, QVS, PFS);
    quad = fullscreen(gl);
  } catch (e) { console.warn(e); return null; }
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  const look = { exp: 1, back: hex(PAPER_BACK), cast: 0.46, contact: 0.3, shade: hex("#1c1a24") };
  let W = 420, H = 560, rtA = null, rtB = null, raf = 0, last = 0, acc = 0, dead = false;
  const proj = new Float32Array(16);

  const P = { sheets: [] };

  P.resize = function (w, h, pr) {
    W = w; H = h;
    canvas.width = Math.max(1, Math.round(w * pr)); canvas.height = Math.max(1, Math.round(h * pr));
    // 透视：视角按高度算，z = 0 那一层正好铺满画布
    const f = CAMZ / (h / 2), near = 10, far = 4000;
    proj.fill(0); proj[0] = f / (w / h); proj[5] = f; proj[10] = (far + near) / (near - far); proj[11] = -1; proj[14] = (2 * far * near) / (near - far);
    rtA?.dispose(); rtB?.dispose();
    const tw = Math.max(1, Math.round(w)), th = Math.max(1, Math.round(h));
    rtA = target(gl, tw, th); rtB = target(gl, tw, th);
    draw();
  };

  P.theme = function (dark) {
    look.exp = dark ? 0.9 : 1; look.cast = dark ? 0.62 : 0.46; look.contact = dark ? 0.55 : 0.3;
    look.shade = hex(dark ? "#000000" : "#1c1a24"); look.back = hex(dark ? "#d9d8d3" : PAPER_BACK);
    draw();
  };

  /** 把画好的一页传成贴图（带 mipmap 和各向异性过滤，斜着看也清楚） */
  P.texture = function (c) {
    const t = canvasTexture(gl, c);
    if (aniso) { gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))); }
    return t;
  };

  /** 拿起一张纸。spec：{ tex, w（拿在手里的宽）, ar（高 / 宽）, gloss, shine, stiff, ear }；rect 是它在页面上原来的位置；gx, gy 是手捏住的点 */
  P.lift = function (spec, rect, gx, gy, opt) { const s = new Sheet(spec, rect, gx, gy, opt); P.sheets.push(s); kick(); return s; };
  /** 全部扔掉（重来、拆掉的时候） */
  P.clear = function () { for (const s of P.sheets) s.dispose(); P.sheets.length = 0; draw(); };
  /** 全部马上落地：舞台尺寸变了，飞到一半的纸直接交回页面 */
  P.finish = function () { const all = P.sheets.splice(0); for (const s of all) { if (s.mode === "carry") s.done?.(s); s.dispose(); } draw(); };
  P.destroy = function () {
    dead = true; cancelAnimationFrame(raf); P.clear();
    rtA?.dispose(); rtB?.dispose(); quad.dispose(); [pPaper, pShadow, pBlur, pPlane].forEach((p) => p.dispose());
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };

  /* 一张纸 */
  class Sheet {
    constructor(spec, rect, gx, gy, opt = {}) {
      this.hs = opt.hs || 1; this.k = 1; this.lift = opt.lift || LIFT;
      this.spec = spec; this.W = spec.w; this.H = spec.w * spec.ar;
      const NX = (this.NX = 13), NY = (this.NY = Math.max(8, Math.round(13 * spec.ar))), n = (this.n = NX * NY);
      this.p = new Float32Array(n * 3); this.o = new Float32Array(n * 3); this.nr = new Float32Array(n * 3);
      this.lx = new Float32Array(n); this.ly = new Float32Array(n);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i; this.lx[k] = (i / (NX - 1)) * this.W; this.ly[k] = (j / (NY - 1)) * this.H; }
      // 约束：相邻、对角，再加隔 2、4、8 格的长约束，纸的硬度就是从这几条来的
      const C = [], add = (a, b, k) => C.push(a, b, k), st = spec.stiff || 0;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        if (i + 1 < NX) add(k, k + 1, 1); if (j + 1 < NY) add(k, k + NX, 1);
        if (i + 1 < NX && j + 1 < NY) { add(k, k + NX + 1, 1); add(k + 1, k + NX, 1); }
        // 相纸比复印纸硬：同样的网格，长约束更长、更紧
        if (i + 2 < NX) add(k, k + 2, 0.9 + st * 0.1); if (j + 2 < NY) add(k, k + 2 * NX, 0.9 + st * 0.1);
        if (i + 4 < NX && i % 2 === 0) add(k, k + 4, 0.7 + st * 0.3); if (j + 4 < NY && j % 2 === 0) add(k, k + 4 * NX, 0.7 + st * 0.3);
        if (i + 8 < NX && i % 4 === 0 && j % 2 === 0) add(k, k + 8, 0.35 + st * 0.5); if (j + 8 < NY && j % 4 === 0 && i % 2 === 0) add(k, k + 8 * NX, 0.35 + st * 0.5);
        if (st && i + 12 < NX && j % 3 === 0) add(k, k + 12, 0.6); if (st && j + 12 < NY && i % 3 === 0) add(k, k + 12 * NX, 0.6);
      }
      const nc = C.length / 3;
      this.ca = new Int32Array(nc); this.cb = new Int32Array(nc); this.ck = new Float32Array(nc); this.cl = new Float32Array(nc);
      for (let c = 0; c < nc; c++) {
        const a = C[c * 3], b = C[c * 3 + 1]; this.ca[c] = a; this.cb[c] = b; this.ck[c] = C[c * 3 + 2];
        this.cl[c] = Math.hypot(this.lx[a] - this.lx[b], this.ly[a] - this.ly[b]);
      }
      // 手的几个弹簧：捏在哪、多高、纸多大、往哪边歪
      const s0 = rect.w / this.W;
      this.s = new Spring(s0); this.gx = new Spring(gx); this.gy = new Spring(gy); this.gz = new Spring(0);
      this.ear = new Spring(spec.ear ? 1 : 0); this.pitch = new Spring(0); this.roll = new Spring(0); this.yaw = new Spring(0);
      this.gu = clamp((gx - rect.x) / rect.w, 0.05, 0.95); this.gv = clamp((gy - rect.y) / rect.h, 0.05, 0.95);
      // 手指捏住的是一小块圆，半径是纸宽的 17%
      this.pin = []; this.pinX = []; this.pinY = [];
      const rp = 0.17 * this.W;
      let best = 0, bd = 1e9;
      for (let k = 0; k < n; k++) {
        const dx = this.lx[k] - this.gu * this.W, dy = this.ly[k] - this.gv * this.H, d = Math.hypot(dx, dy);
        if (d < rp) { this.pin.push(k); this.pinX.push(dx); this.pinY.push(dy); }
        if (d < bd) { bd = d; best = k; }
      }
      if (!this.pin.length) { this.pin.push(best); this.pinX.push(this.lx[best] - this.gu * this.W); this.pinY.push(this.ly[best] - this.gv * this.H); }
      for (let k = 0; k < n; k++) {
        this.p[k * 3] = this.o[k * 3] = rect.x + this.lx[k] * s0;
        this.p[k * 3 + 1] = this.o[k * 3 + 1] = rect.y + this.ly[k] * s0;
        this.p[k * 3 + 2] = this.o[k * 3 + 2] = 0;
      }
      this.mode = "held"; this.vx = 0; this.vy = 0; this.hv = [0, 0, 0];
      this.hold(gx, gy);   // 刚按下还没动，也不让抬起来的纸伸出舞台
      this.build();
      this.push();
    }

    build() {
      const { NX, NY, n, spec } = this, f = 0.2;
      const uv = new Float32Array(n * 2), idx = new Uint16Array((NX - 1) * (NY - 1) * 6);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i; uv[k * 2] = i / (NX - 1); uv[k * 2 + 1] = 1 - j / (NY - 1); }
      let q = 0;
      for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + NX, c = a + 1, d = b + 1; idx.set([a, b, c, c, b, d], q); q += 6; }
      this.count = idx.length;
      this.vao = mesh(n, uv, idx); this.uF = [f, f / spec.ar];
      // 折角：单独一个三角形，绕折痕翻过来
      if (spec.ear) { this.fpos = new Float32Array(9); this.fnor = new Float32Array(9); this.fvao = mesh(3, new Float32Array([1 - f, 1, 1, 1 - f / spec.ar, 1, 1]), null); }
    }

    // 手跟着指针走；高度、大小、歪的角度都是弹簧。拿在手里的纸不出舞台：靠边时手的位置收进来一点。
    // 抬起来的纸离镜头近，看上去大 g 倍、还往画面外偏，所以边界按投影到画面上的位置算
    hold(x, y) {
      const w = this.W * this.hs * this.k, h = this.H * this.hs * this.k, m = 8, g = CAMZ / (CAMZ - this.lift);
      const fit = (v, size, u, span) => {
        const c = span / 2, lo = c + (m - c) / g + u * size, hi = c + (span - m - c) / g - (1 - u) * size;
        return lo > hi ? (lo + hi) / 2 : clamp(v, lo, hi);
      };
      this.gx.t = fit(x, w, this.gu, W);
      this.gy.t = fit(y, h, this.gv, H);
    }
    // 拖到对话框上方时缩小一些，像是要变成附件了
    shrink(on) { this.k = on ? 0.62 : 1; }
    carry(rect, fold, done) {
      this.mode = "carry"; this.dest = rect; this.fold = fold; this.done = done;
      this.gx.t = rect.x + this.gu * rect.w; this.gy.t = rect.y + this.gv * rect.h; this.gz.t = 0; this.s.t = rect.w / this.W;
    }

    update(dt) {
      const held = this.mode === "held";
      if (held) { this.gz.t = this.lift; this.s.t = this.hs * this.k; this.ear.t = 0; }
      const px = this.gx.x, py = this.gy.x, pz = this.gz.x;
      if (held) { this.gx.step(dt, 0.07, 0); this.gy.step(dt, 0.07, 0); }
      else { this.gx.step(dt, 0.46, 0.05); this.gy.step(dt, 0.46, 0.05); }
      this.vx = lerp(this.vx, (this.gx.x - px) / dt, 0.25); this.vy = lerp(this.vy, (this.gy.x - py) / dt, 0.25);
      this.gz.step(dt, held ? 0.34 : 0.4, held ? 0.16 : 0);
      this.hv = [(this.gx.x - px) / dt, (this.gy.x - py) / dt, (this.gz.x - pz) / dt];
      const s0 = this.s.x;
      this.s.step(dt, held ? 0.4 : 0.3, held ? 0.1 : 0);
      // 变大变小是绕着手整张缩放，不去改约束的长度：改长度等于把纸往里挤，纸会起皱
      const r = this.s.x / s0;
      if (r !== 1) {
        const { p, o } = this, gx = this.gx.x, gy = this.gy.x, gz = this.gz.x;
        for (let i = 0; i < p.length; i += 3) {
          p[i] = gx + (p[i] - gx) * r; p[i + 1] = gy + (p[i + 1] - gy) * r; p[i + 2] = Math.max(0, gz + (p[i + 2] - gz) * r);
          o[i] = gx + (o[i] - gx) * r; o[i + 1] = gy + (o[i + 1] - gy) * r; o[i + 2] = Math.max(0, gz + (o[i + 2] - gz) * r);
        }
      }
      if (!held && this.fold) this.ear.t = this.gz.x < 14 ? 1 : 0;
      this.ear.step(dt, 0.4, 0.04);
      // 顺着动的方向歪：前沿往下低一点，纸绕着手往后甩
      const k = held ? 1 : 0.4;
      this.roll.t = clamp(this.vx * 0.0003 * k, -0.16, 0.16); this.pitch.t = clamp(-this.vy * 0.0003 * k, -0.16, 0.16);
      const cxw = (0.5 - this.gu) * this.W * this.s.x, cyw = (0.5 - this.gv) * this.H * this.s.x;
      this.yaw.t = held ? clamp((cyw * this.vx - cxw * this.vy) * 0.000003, -0.22, 0.22) : 0;
      this.roll.step(dt, 0.3, 0.2); this.pitch.step(dt, 0.3, 0.2); this.yaw.step(dt, 0.6, 0.1);
      if (motion.reduce) { this.roll.snap(0); this.pitch.snap(0); this.yaw.snap(0); }
    }

    sim(h) {
      // 力按纸的大小算：一张缩小的纸（飞向别处的小图）跟远处看的整张纸一样，不会像一片薄纸巾
      const { p, o, n } = this, sc = this.s.x, G = (this.mode === "held" ? 520 : 900) * sc, h2 = h * h, an = 6 * Math.min(1, sc * 1.4), at = 0.3 * sc;
      const [hx, hy, hz] = this.hv;
      // 手带着纸走七成，剩下的纸自己跟：纸在自己的平面里很硬，快速一甩会摆，但不会被挤回手里皱成一团
      const F = 0.7, dx = hx * h * F, dy = hy * h * F;
      const nr = this.normals();
      for (let k = 0; k < n; k++) {
        const i = k * 3;
        p[i] += dx; p[i + 1] += dy; o[i] += dx; o[i + 1] += dy;
        const vx = (p[i] - o[i]) / h + hx * F, vy = (p[i + 1] - o[i + 1]) / h + hy * F, vz = (p[i + 2] - o[i + 2]) / h;
        // 空气：正面迎风阻力大，顺着纸面几乎没有；纸自己的阻尼只算相对手的那部分速度
        const vn = vx * nr[i] + vy * nr[i + 1] + vz * nr[i + 2];
        const ax = -nr[i] * vn * an - (vx - hx) * 1.6 - vx * at, ay = -nr[i + 1] * vn * an - (vy - hy) * 1.6 - vy * at, az = -nr[i + 2] * vn * an - (vz - hz) * 1.6 - vz * at - G;
        const d = 0.998;
        o[i] = p[i]; o[i + 1] = p[i + 1]; o[i + 2] = p[i + 2];
        p[i] += (vx - hx * F) * h * d + ax * h2; p[i + 1] += (vy - hy * F) * h * d + ay * h2; p[i + 2] += vz * h * d + az * h2;
      }
      const s = this.s.x, { ca, cb, ck, cl } = this;
      const cr = Math.cos(this.roll.x), sr = Math.sin(this.roll.x), cp = Math.cos(this.pitch.x), spp = Math.sin(this.pitch.x), cy = Math.cos(this.yaw.x), sy = Math.sin(this.yaw.x);
      const gx = this.gx.x, gy = this.gy.x, gz = this.gz.x;
      const pinIt = () => {
        for (let m = 0; m < this.pin.length; m++) {
          const k = this.pin[m] * 3;
          let x = this.pinX[m] * s, y = this.pinY[m] * s, z = 0;
          // 先绕 x 轴俯仰，再绕 y 轴侧倾，最后绕 z 轴转
          let y2 = y * cp - z * spp, z2 = y * spp + z * cp; y = y2; z = z2;
          let x2 = x * cr + z * sr; z2 = -x * sr + z * cr; x = x2; z = z2;
          x2 = x * cy - y * sy; y2 = x * sy + y * cy;
          p[k] = gx + x2; p[k + 1] = gy + y2; p[k + 2] = gz + z;
        }
      };
      for (let it = 0; it < ITER; it++) {
        pinIt();
        for (let c = 0; c < ca.length; c++) {
          const a = ca[c] * 3, b = cb[c] * 3;
          const ex = p[b] - p[a], ey = p[b + 1] - p[a + 1], ez = p[b + 2] - p[a + 2];
          const len = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-6, f = ((len - cl[c] * s) / len) * 0.5 * ck[c];
          p[a] += ex * f; p[a + 1] += ey * f; p[a + 2] += ez * f;
          p[b] -= ex * f; p[b + 1] -= ey * f; p[b + 2] -= ez * f;
        }
        for (let k = 2; k < p.length; k += 3) if (p[k] < 0) p[k] = 0;
      }
      this.match(this.spec.stiff ? 0.07 : 0.035);
      pinIt();
      // 贴着桌面的地方有摩擦
      for (let k = 0; k < n; k++) { const i = k * 3; if (p[i + 2] <= 0.01) { o[i] = lerp(o[i], p[i], 0.35); o[i + 1] = lerp(o[i + 1], p[i + 1], 0.35); } }
    }

    // 纸整张的硬度：找出最贴合现在形状的那张平的纸（形状匹配），每个点往它那儿拉一点，弯就宽而顺，不会在一行上折死
    match(a) {
      const { p, n, lx, ly } = this, s = this.s.x, W0 = this.W / 2, H0 = this.H / 2;
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < n; k++) { cx += p[k * 3]; cy += p[k * 3 + 1]; cz += p[k * 3 + 2]; }
      cx /= n; cy /= n; cz /= n;
      let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
      for (let k = 0; k < n; k++) {
        const qx = lx[k] - W0, qy = ly[k] - H0, dx = p[k * 3] - cx, dy = p[k * 3 + 1] - cy, dz = p[k * 3 + 2] - cz;
        ax += dx * qx; ay += dy * qx; az += dz * qx; bx += dx * qy; by += dy * qy; bz += dz * qy;
      }
      // 用两条纸面内的轴拼出一个正交的坐标架，两条轴对称地处理，不偏向哪一条
      let m = Math.hypot(ax, ay, az) || 1; ax /= m; ay /= m; az /= m;
      m = Math.hypot(bx, by, bz) || 1; bx /= m; by /= m; bz /= m;
      let hx = ax + bx, hy = ay + by, hz = az + bz, gx = ax - bx, gy = ay - by, gz = az - bz;
      m = Math.hypot(hx, hy, hz) || 1; hx /= m; hy /= m; hz /= m; m = Math.hypot(gx, gy, gz) || 1; gx /= m; gy /= m; gz /= m;
      const r = Math.SQRT1_2, e1x = (hx + gx) * r, e1y = (hy + gy) * r, e1z = (hz + gz) * r, e2x = (hx - gx) * r, e2y = (hy - gy) * r, e2z = (hz - gz) * r;
      for (let k = 0; k < n; k++) {
        const qx = (lx[k] - W0) * s, qy = (ly[k] - H0) * s, i = k * 3;
        p[i] += (cx + e1x * qx + e2x * qy - p[i]) * a;
        p[i + 1] += (cy + e1y * qx + e2y * qy - p[i + 1]) * a;
        p[i + 2] = Math.max(0, p[i + 2] + (cz + e1z * qx + e2z * qy - p[i + 2]) * a);
      }
    }

    // 每个点的法线：左右邻居和上下邻居连线的叉积（设计坐标，平放时朝 +z）
    normals() {
      const { p, NX, NY, nr } = this;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i, l = (j * NX + Math.max(0, i - 1)) * 3, r = (j * NX + Math.min(NX - 1, i + 1)) * 3, u = (Math.max(0, j - 1) * NX + i) * 3, d = (Math.min(NY - 1, j + 1) * NX + i) * 3;
        const ax = p[r] - p[l], ay = p[r + 1] - p[l + 1], az = p[r + 2] - p[l + 2], bx = p[d] - p[u], by = p[d + 1] - p[u + 1], bz = p[d + 2] - p[u + 2];
        const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, m = Math.hypot(nx, ny, nz) || 1;
        nr[k * 3] = nx / m; nr[k * 3 + 1] = ny / m; nr[k * 3 + 2] = nz / m;
      }
      return nr;
    }

    // 纸上某一点（u、v 从左上角算）现在在哪，网格里双线性插出来
    at(u, v) {
      const { p, NX, NY } = this, fx = u * (NX - 1), fy = v * (NY - 1), i = Math.min(NX - 2, fx | 0), j = Math.min(NY - 2, fy | 0), tx = fx - i, ty = fy - j;
      const a = (j * NX + i) * 3, b = a + 3, c = a + NX * 3, d = c + 3, out = [0, 0, 0];
      for (let q = 0; q < 3; q++) out[q] = lerp(lerp(p[a + q], p[b + q], tx), lerp(p[c + q], p[d + q], tx), ty);
      return out;
    }

    // 把这一帧的位置、法线交给显卡；折角翻到哪儿也在这里算
    push() {
      this.normals();
      this.vao.write(this.p, this.nr);
      const e = this.ear.x;
      this.earOn = !!this.spec.ear && e > 0.015;
      if (!this.earOn) return;
      const f = 0.2, A = this.at(1 - f, 0), B = this.at(1, f / this.spec.ar), C = this.at(1, 0);
      // 角上那块纸的法线，再把尖儿绕折痕往外翻
      const ux = C[0] - A[0], uy = C[1] - A[1], uz = C[2] - A[2], vx = B[0] - C[0], vy = B[1] - C[1], vz = B[2] - C[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nm = Math.hypot(nx, ny, nz) || 1; nx /= nm; ny /= nm; nz /= nm;
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], r = [C[0] - M[0], C[1] - M[1], C[2] - M[2]], rl = Math.hypot(...r);
      const ph = clamp(e) * Math.PI, cs = Math.cos(ph), sn = Math.sin(ph), up = 0.35 * clamp(e);
      const T = [M[0] + r[0] * cs + nx * rl * sn + nx * up, M[1] + r[1] * cs + ny * rl * sn + ny * up, M[2] + r[2] * cs + nz * rl * sn + nz * up];
      const fp = this.fpos;
      [A, B, T].forEach((q, m) => { fp[m * 3] = q[0]; fp[m * 3 + 1] = q[1]; fp[m * 3 + 2] = q[2] + 0.25; });
      // 三角形的面法线（按 A、B、T 的绕向，在世界坐标里算，再换回设计坐标交给着色器）
      const w = (q) => [q[0], -q[1], q[2]], Aw = w(A), Bw = w(B), Tw = w(T);
      const e1 = [Bw[0] - Aw[0], Bw[1] - Aw[1], Bw[2] - Aw[2]], e2 = [Tw[0] - Aw[0], Tw[1] - Aw[1], Tw[2] - Aw[2]];
      const fn = norm([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
      for (let m = 0; m < 3; m++) { this.fnor[m * 3] = fn[0]; this.fnor[m * 3 + 1] = -fn[1]; this.fnor[m * 3 + 2] = fn[2]; }
      this.fvao.write(this.fpos, this.fnor);
    }

    // 手到了、每个角都停稳了：可以交回页面
    get settled() {
      if (this.mode !== "carry") return false;
      if (!this.gx.near(0.4, 6) || !this.gy.near(0.4, 6) || !this.gz.near(0.3, 6) || Math.abs(this.s.x - this.s.t) > 0.002) return false;
      if (this.fold && !this.ear.near(0.01, 0.05)) return false;
      let mz = 0, mv = 0; const { p, o } = this;
      for (let k = 0; k < this.n; k++) { mz = Math.max(mz, p[k * 3 + 2]); mv = Math.max(mv, Math.abs(p[k * 3] - o[k * 3]) + Math.abs(p[k * 3 + 1] - o[k * 3 + 1]) + Math.abs(p[k * 3 + 2] - o[k * 3 + 2])); }
      return mz < 0.35 && mv < 0.02;
    }
    meanZ() { let z = 0; for (let k = 2; k < this.p.length; k += 3) z += this.p[k]; return z / this.n; }
    dispose() { this.vao.dispose(); this.fvao?.dispose(); }
  }

  // 一块网格：位置、法线每帧更新，uv 和下标不变（下标为空就是三个点的一个三角形）
  function mesh(n, uv, idx) {
    const vao = gl.createVertexArray(), bp = gl.createBuffer(), bn = gl.createBuffer(), bu = gl.createBuffer(), bi = idx ? gl.createBuffer() : null;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, bp); gl.bufferData(gl.ARRAY_BUFFER, n * 12, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bn); gl.bufferData(gl.ARRAY_BUFFER, n * 12, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bu); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    if (bi) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bi); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW); }
    gl.bindVertexArray(null);
    return {
      write(pos, nor) { gl.bindBuffer(gl.ARRAY_BUFFER, bp); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos); gl.bindBuffer(gl.ARRAY_BUFFER, bn); gl.bufferSubData(gl.ARRAY_BUFFER, 0, nor); },
      draw(count) { gl.bindVertexArray(vao); if (bi) gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0); else gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); },
      dispose() { gl.deleteVertexArray(vao); [bp, bn, bu, bi].forEach((b) => b && gl.deleteBuffer(b)); },
    };
  }

  function draw() {
    if (dead) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!P.sheets.length || !rtA) return;
    // 影子图：纸越高糊得越开
    let mz = 0; for (const s of P.sheets) mz = Math.max(mz, s.meanZ());
    gl.disable(gl.DEPTH_TEST);
    rtA.bind(); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendEquation(gl.MAX);
    const size = [W, H];
    for (const s of P.sheets) {
      for (const [ch, k, oy] of [[0, SH, 0], [1, [0, 0], 0.7]]) {
        pShadow.use({ uK: k, uO: [0, oy], uSize: size, uCh: ch, uCut: s.earOn ? 1 : 0, uF: s.uF });
        s.vao.draw(s.count);
        if (s.earOn) { pShadow.use({ uCut: 0 }); s.fvao.draw(3); }
      }
    }
    gl.blendEquation(gl.FUNC_ADD); gl.disable(gl.BLEND);
    const sa = 1.2 + mz * 0.12, sb = 1.0 + mz * 0.34;
    rtB.bind(); pBlur.use({ t: [rtA.tex, 0], uD: [1 / rtA.w, 0], uA: sa / 3, uB: sb / 3 }); quad.draw();
    rtA.bind(); pBlur.use({ t: [rtB.tex, 0], uD: [0, 1 / rtA.h] }); quad.draw();
    // 影子铺到桌上
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const up = clamp(mz / 24);
    pPlane.use({ t: [rtA.tex, 0], uC: look.cast * up * up * (3 - 2 * up) * lerp(1, 0.8, clamp(mz / 90)), uK: look.contact * lerp(1, 0.36, clamp(mz / 40)), uCol: look.shade });
    quad.draw();
    gl.disable(gl.BLEND);
    // 每张纸单独画一遍、先清深度：后拿起的永远在上面，两张纸不会互相穿过去
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    for (const s of P.sheets) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      const sp = s.spec;
      pPaper.use({ uP: proj, uSize: size, map: [sp.tex, 0], uL: L, uBack: look.back, uExp: look.exp, uGloss: sp.gloss || 0, uShine: sp.shine || 12, uCut: s.earOn ? 1 : 0, uEar: clamp(s.ear.x), uF: s.uF });
      s.vao.draw(s.count);
      if (s.earOn) { pPaper.use({ uCut: 0, uEar: 0 }); s.fvao.draw(3); }
    }
    gl.disable(gl.DEPTH_TEST);
  }
  P.draw = draw;

  function frame(now) {
    raf = 0;
    if (dead) return;
    const dt = last ? clamp((now - last) / 1000, 0, 1 / 30) : 1 / 60; last = now;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) { for (const s of P.sheets) { s.update(STEP); s.sim(STEP); } acc -= STEP; steps++; }
    if (steps === 6) acc = 0;
    for (const s of P.sheets) s.push();
    // 先交回页面再拆：页面上的那份在纸消失的同一帧就位
    const done = P.sheets.filter((s) => s.settled);
    for (const s of done) { P.sheets.splice(P.sheets.indexOf(s), 1); s.done?.(s); s.dispose(); }
    draw();
    // 没有纸了就停，什么都不画
    if (P.sheets.length) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf && !dead) { last = 0; raf = requestAnimationFrame(frame); } }

  return P;
}

function hex(c) { const n = parseInt(c.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
