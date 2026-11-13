/* 树冠羞避（crown shyness）：站在林子里往上看，一棵棵树的树冠长到快碰上就停住，彼此之间留一道窄窄的天。
   像素画，不用 WebGL：CPU 一个像素一个像素算，画进一张约 3.6 万个像素的小图，再按整数倍放大（image-rendering: pixelated）。
   每帧五步：

     1. 归属：每棵树的树冠是挂在枝杈上的一串圆。每个像素找离它最近、第二近的两棵树（到圆边的距离），
        两个距离只差不到缝宽 G 的那条窄带留成天，其余归最近的那棵；缝边再用一张云状的噪声啃得毛一点。
     2. 叶团：每棵树的地盘里事先铺好一团团叶子（排林子时按网格撒，里面大团，沿缝一圈小团），
        每团盖一个事先算好的印章：圆的一团，边上一圈尖尖的叶尖。明暗按太阳的方向一刀切开（像手绘动画里那种），
        高处的团亮、低处的暗，有点宫崎骏的画风；后面的团上留一点前面团的影子。先画远的团，再画主枝，最后画近的团。
     3. 天和树干：饱和的蓝天，一层慢慢飘的积云，挨着太阳的地方亮。树干从天顶往画面外伸，越靠近镜头越粗，
        有顺着树干的纵纹、横的裂缝，背光那一侧长苔藓。
     4. 光和雾：缝里透进来的光往太阳那边一步步收集（径向散射），成一道道光柱；每道缝溢出一圈光晕；
        远处（靠天顶）一层薄雾，几缕雾慢慢飘；光柱里有浮尘。这几层都按 Bayer 矩阵抖动、量化成几档，像素画的边还是硬的。
     5. 落叶：小小一片，叶基圆、叶尖尖，一边翻一边往镜头这边飘，飘近了、大起来之前就淡掉。

   时间 hour（5.5 到 19）：太阳从左边（早上）经过中间（中午）走到右边（傍晚），越高越靠近画面中间；
   光、天、雾、叶子、树皮的颜色按一张一天的关键帧表插值（TOD）。

   动起来：树冠是弹簧，风推它，相邻的树互相顶；枝杈是小弹簧，树冠一晃枝杈跟着甩。
   鼠标划过叶子：底下的枝杈沙沙动，每划过一段掉一片叶子。按住一棵树冠拖：推着它走，邻居被挤开，一路掉叶子。
   点一下：那棵树晃一下，叶子先从外圈落、再往里。手指：点一下是摇，横着拖是推，上下划还是滚页面。

   省着画：平时每秒 30 帧，拖着、划着、叶子还在落、太阳还在挪的时候每帧都画；滚出屏幕、切到别的标签页就停；
   系统开了「减弱动态效果」，只画一帧不动的（缝已经张开），也不跟着鼠标动。

     const c = create(canvas, { hour: 15.5 }); // canvas 放在一个撑满舞台的元素里，大小跟着那个元素
     c.shake();                                 // 整片林子摇一摇（按钮、键盘用）
     c.reseed();                                // 换一片林子
     c.setHour(18.5);                           // 换个时间，太阳慢慢挪过去
     c.destroy();                               // 不用了：停下、摘掉监听 */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = t => t * t * (3 - 2 * t);
// 可重复的随机数（mulberry32）：同一个 seed 排出同一片林子
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 整数坐标的哈希，0 到 1
function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// 颜色存成 ImageData 的一个 Uint32（小端：ABGR）
const pack = h => {
  const n = parseInt(h.slice(1), 16);
  return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;
};

const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const pk = (r, g, b) => ((255 << 24) | (clamp(b | 0, 0, 255) << 16) | (clamp(g | 0, 0, 255) << 8) | clamp(r | 0, 0, 255)) >>> 0;
// 下午三点半的底色，别的时间从这里按光的颜色调
const BASE = {
  LEAF: ['#0d1f26', '#11302b', '#164030', '#1c5035', '#266239', '#33753b', '#45893d', '#5b9c40', '#76af46', '#97c351', '#bcd767', '#e2ec8f'],
  LEAF2: ['#10221f', '#163326', '#1f452b', '#2a582e', '#386c30', '#4a8032', '#5f9435', '#78a73a', '#95bb42', '#b4cd50', '#d2df68', '#eef08f'],
  BARK: ['#100f0b', '#181711', '#211f18', '#2b2a20', '#38362a', '#464434', '#575440', '#6c674e', '#857e62', '#a09779'],
  MOSS: ['#4f5e2a', '#657634', '#7e8f3e', '#99a84a', '#b4bd5c', '#cdd178'],
  FALL: ['#1f5530', '#6ab448', '#a2d55a', '#dcef8a', '#4f8a58', '#b4d898'],
  FALL2: ['#5c6424', '#b4b844', '#d8d65c', '#f4ee98', '#8c9a5a', '#dfe2a8']
};
const BASE_RGB = {};
for (const k in BASE) BASE_RGB[k] = BASE[k].map(hex);
// 实际用的色带：换了时间就在原地改写
const LEAF = BASE.LEAF.map(pack), LEAF2 = BASE.LEAF2.map(pack), BARK = BASE.BARK.map(pack), MOSS = BASE.MOSS.map(pack), FALL = BASE.FALL.map(pack), FALL2 = BASE.FALL2.map(pack);
const SKY = new Array(6).fill(0), CLOUD = new Array(4).fill(0);
// 一天里的光。L 光的颜色，F 雾的颜色，S 天（深处、中间、挨着太阳），ex 叶子的曝光，
// fm、rm 这个时辰雾有多浓、光柱有多显
const TOD = [
  { h: 5.5, L: [255, 186, 150], F: [204, 196, 214], S: ['#7c8cc6', '#dcb9cb', '#ffe0c4'], ex: 0.72, fm: 1.4, rm: 0.9 },
  { h: 7.5, L: [255, 224, 178], F: [200, 216, 220], S: ['#4f98d6', '#a6d2ee', '#fff2dc'], ex: 0.92, fm: 1.1, rm: 1.15 },
  { h: 10, L: [255, 246, 214], F: [204, 224, 232], S: ['#3a8bd4', '#86c2ea', '#f4fbfb'], ex: 1.0, fm: 0.8, rm: 1.0 },
  { h: 12.5, L: [255, 253, 240], F: [210, 230, 240], S: ['#2f80d0', '#74b8e8', '#f2fbff'], ex: 1.06, fm: 0.55, rm: 0.8 },
  { h: 15.5, L: [255, 232, 172], F: [218, 224, 210], S: ['#428cd0', '#94c6e6', '#fff1d0'], ex: 0.98, fm: 0.75, rm: 1.15 },
  { h: 17.5, L: [255, 186, 114], F: [226, 194, 170], S: ['#6582c4', '#e6aa90', '#ffd9a0'], ex: 0.82, fm: 0.95, rm: 1.25 },
  { h: 19, L: [246, 134, 90], F: [196, 160, 172], S: ['#4c5a98', '#c58696', '#f4b07e'], ex: 0.6, fm: 1.1, rm: 1.0 }
];
const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function todAt(h) {
  let i = 0;
  while (i < TOD.length - 2 && h > TOD[i + 1].h) i++;
  const A = TOD[i], B = TOD[i + 1], t = sstep(clamp((h - A.h) / (B.h - A.h), 0, 1));
  return {
    L: mixRGB(A.L, B.L, t), F: mixRGB(A.F, B.F, t),
    S: [0, 1, 2].map(j => mixRGB(hex(A.S[j]), hex(B.S[j]), t)),
    ex: lerp(A.ex, B.ex, t), fm: lerp(A.fm, B.fm, t), rm: lerp(A.rm, B.rm, t)
  };
}
let palKey = null;
function applyPalette(h, d) {
  const key = Math.round(h * 40);
  if (key === palKey) return;
  palKey = key;
  const tint = (dst, src, k0, k1, ex) => src.forEach((c, i) => {
    const f = i / (src.length - 1), k = k0 + (k1 - k0) * f, e = ex * (0.92 + 0.08 * f);
    dst[i] = pk(c[0] * e * lerp(1, d.L[0] / 236, k), c[1] * e * lerp(1, d.L[1] / 236, k), c[2] * e * lerp(1, d.L[2] / 236, k));
  });
  tint(LEAF, BASE_RGB.LEAF, 0.1, 0.55, d.ex);
  tint(LEAF2, BASE_RGB.LEAF2, 0.1, 0.55, d.ex);
  tint(BARK, BASE_RGB.BARK, 0.08, 0.5, lerp(1, d.ex, 0.7));
  tint(MOSS, BASE_RGB.MOSS, 0.15, 0.5, d.ex);
  tint(FALL, BASE_RGB.FALL, 0.15, 0.45, lerp(1, d.ex, 0.7));
  tint(FALL2, BASE_RGB.FALL2, 0.15, 0.45, lerp(1, d.ex, 0.7));
  for (let i = 0; i < 6; i++) {
    const t = i / 5, c = t < 0.5 ? mixRGB(d.S[0], d.S[1], t * 2) : mixRGB(d.S[1], d.S[2], (t - 0.5) * 2);
    SKY[i] = pk(c[0], c[1], c[2]);
  }
  // 积云：底下背光，顶上受光
  const lit = mixRGB([255, 255, 255], d.L, 0.28), sh = mixRGB(d.S[1], [128, 136, 176], 0.42);
  [sh, mixRGB(sh, lit, 0.4), mixRGB(sh, lit, 0.72), lit].forEach((c, i) => { CLOUD[i] = pk(c[0], c[1], c[2]); });
}
// 横竖两遍滑动平均
function boxBlur(src, dst, w, h, r) {
  const tmp = boxBlur.t && boxBlur.t.length === w * h ? boxBlur.t : (boxBlur.t = new Float32Array(w * h)), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / n;
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc / n;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
}
// 4×4 的 Bayer 矩阵，抖动用
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);
// 叶团的印章：圆的一团，边上一圈尖尖的叶尖。半径 2 到 12 各六种。
// 每个像素存：dx、dy、法线 x、法线 y、离边多远、一点笔触噪声（让明暗交界顺着一片片叶子走，不是一条圆弧）
const MASKS = [];
for (let r = 2; r <= 12; r++) {
  MASKS[r] = [];
  for (let v = 0; v < 6; v++) {
    const R = rng(r * 131 + v * 17 + 3);
    const nT = Math.max(5, Math.round(r * 1.2 + 2 + R() * 3)), ph = R() * 9;
    const amp = r <= 2 ? 0.14 : r <= 4 ? 0.24 : 0.3;
    const tl = []; for (let k = 0; k < nT; k++) tl.push(0.55 + R() * 0.75);
    const ext = Math.ceil(r * (0.8 + amp * 1.3)) + 1, px = [];
    for (let y = -ext; y <= ext; y++) for (let x = -ext; x <= ext; x++) {
      const d = Math.hypot(x, y), a = Math.atan2(y, x);
      const u = ((a + Math.PI) / TAU) * nT + ph, fl = Math.floor(u), ki = ((fl % nT) + nT) % nT, fu = u - fl;
      const tip = Math.pow(1 - Math.abs(2 * fu - 1), 1.6) * tl[ki];
      const rr = r * (0.8 + amp * tip);
      if (d > rr + 0.2) continue;
      const nz = 0.32 * Math.cos(fu * TAU + Math.PI) * Math.min(1, d / r * 1.6) + (hash2(x * 7 + v * 3, y * 13 + r) - 0.5) * 0.36;
      px.push(x, y, x / r, y / r, (rr - d) / r, nz);
    }
    MASKS[r][v] = { p: new Float32Array(px), n: px.length / 6 };
  }
}
// 缝边上的叶子像素：风大时从这些地方掉叶子
const c2edge = (s1, s2, g, G) => g > -1.4 && g <= 0 && s2 - s1 < G + 2 && s1 < 0.5;
// 0 到 1 的值按 Bayer 抖动挑色带里的一档
const qz = (v, n, x, y, amp = 0.95) => {
  const i = Math.floor(v * (n - 1) + 0.5 + BAYER[((y & 3) << 2) | (x & 3)] * amp);
  return i < 0 ? 0 : i >= n ? n - 1 : i;
};

// 128 见方、首尾相接的云状噪声（三层值噪声），云、雾、苔藓、缝边都从它取
function makeCloud(seed) {
  const R = rng(seed), N = 128, out = new Float32Array(N * N);
  const oct = (G, amp) => {
    const g = new Float32Array(G * G).map(() => R());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = (x / N) * G, fy = (y / N) * G, ix = fx | 0, iy = fy | 0, tx = sstep(fx - ix), ty = sstep(fy - iy);
      const a = g[(iy % G) * G + (ix % G)], b = g[(iy % G) * G + ((ix + 1) % G)];
      const c = g[((iy + 1) % G) * G + (ix % G)], d = g[((iy + 1) % G) * G + ((ix + 1) % G)];
      out[y * N + x] += lerp(lerp(a, b, tx), lerp(c, d, tx), ty) * amp;
    }
  };
  oct(4, 0.6); oct(8, 0.3); oct(16, 0.1);
  return out;
}


// 引擎：排林子、物理、每帧画一张小图
class Canopy {
  constructor(canvas, opts = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.seed = opts.seed ?? 3;
    this.time = 0;
    this.G = opts.gap ?? 2.6; this.Gt = this.G;
    this.wind = opts.wind ?? 0.12; this.windT = this.wind;
    this.calm = !!opts.calm;
    this.scale = opts.scale ?? 1;
    this.ptr = { x: -1e3, y: -1e3, hover: false };
    this.ptrR = 0; this.brushAcc = 0; this.brushNext = 18; this.lastPx = null; this.lastPy = 0;
    this.drag = -1; this.grab = { x: 0, y: 0 };
    this.parts = []; this.queue = [];
    this.cloud = makeCloud(77);
    this.fog = opts.fog ?? 0.6; this.light = opts.light ?? 0.85;
    this.hour = opts.hour ?? 15.5;
    this.fogPhase = 0;
    this.R = rng(99);
    this.edge = new Int32Array(4096); this.edgeN = 0;
    this.W = 0; this.H = 0;
  }

  setSize(W, H) {
    this.W = W; this.H = H;
    this.cv.width = W; this.cv.height = H;
    this.img = this.ctx.createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.bLv = new Uint8Array(W * H);
    this.bCr = new Uint8Array(W * H);
    this.kind = new Uint8Array(W * H);
    this.near = new Float32Array(W * H);
    this.w2 = Math.ceil(W / 2); this.h2 = Math.ceil(H / 2);
    this.mask = new Float32Array(this.w2 * this.h2);
    this.rays = new Float32Array(this.w2 * this.h2);
    this.generate(this.seed);
  }

  generate(seed) {
    // 先在一张面积固定（REF²，跟 180×240 一样大）的图上排好林子，再缩放到这张图的大小：
    // 什么尺寸、什么比例的舞台，树冠看着都一样大，宽的舞台只是看到的林子更宽
    const W0 = this.W, H0 = this.H, k = Math.sqrt(W0 * H0) / REF;
    this.W = W0 / k; this.H = H0 / k;
    this.layout(seed);
    this.W = W0; this.H = H0;
    if (Math.abs(k - 1) > 1e-6) this.rescale(k);
    this.pose();
  }

  rescale(k) {
    this.V.x *= k; this.V.y *= k;
    for (const c of this.crowns) {
      c.hx *= k; c.hy *= k; c.x *= k; c.y *= k; c.R *= k;
      for (const n of c.nodes) { n.rx *= k; n.ry *= k; for (const nb of n.nb) nb[1] *= k; }
      for (const l of c.lobes) { l.r *= k; l.ox *= k; l.oy *= k; }
      for (const q of c.cl) { q.r *= k; q.ox *= k; q.oy *= k; }
      for (const tw of c.twigs) tw.L *= k;
    }
    for (const p of this.pairs) p[2] *= k;
    for (const m of this.motes) { m.x *= k; m.y *= k; }
    for (const t of this.trunks) { t.qx *= k; t.qy *= k; t.bx *= k; t.by *= k; t.hw0 *= k; t.len *= k; }
    this.pose();
  }

  layout(seed) {
    this.seed = seed;
    const R = rng(seed * 7919 + 13), W = this.W, H = this.H;
    const V = (this.V = { x: W * (0.45 + R() * 0.08), y: H * (0.38 + R() * 0.08) });
    // 树冠的间距：越往画面边上越大（离镜头近）。U 是基准，180×240 那张图的宽
    const U = 180, diag = Math.hypot(W, H), M = U * 0.32;
    const rAt = (x, y) => this.scale * U * (0.33 + 0.2 * Math.min(1, Math.hypot(x - V.x, y - V.y) / (diag * 0.55)));
    let pts = [];
    for (let i = 0; i < 9000; i++) {
      const x = -M + R() * (W + 2 * M), y = -M + R() * (H + 2 * M), r = rAt(x, y);
      let ok = true;
      for (const p of pts) if (Math.hypot(p.x - x, p.y - y) < (r + p.r) * 0.5) { ok = false; break; }
      if (ok) pts.push({ x, y, r });
    }
    // 在粗网格上做两遍 Lloyd 松弛，树冠大小均匀一些，像真的林冠那样一格一格的
    for (let it = 0; it < 2; it++) {
      const acc = pts.map(() => ({ x: 0, y: 0, n: 0 }));
      for (let y = -M; y < H + M; y += 3) for (let x = -M; x < W + M; x += 3) {
        let b = 0, bd = 1e9;
        for (let k = 0; k < pts.length; k++) {
          const d = Math.hypot(pts[k].x - x, pts[k].y - y) / pts[k].r;
          if (d < bd) { bd = d; b = k; }
        }
        acc[b].x += x; acc[b].y += y; acc[b].n++;
      }
      pts = pts.map((p, k) => acc[k].n ? { x: lerp(p.x, acc[k].x / acc[k].n, 0.6), y: lerp(p.y, acc[k].y / acc[k].n, 0.6), r: p.r } : p);
    }
    const crowns = [];
    for (const p of pts) {
      let nn = 1e9;
      for (const q of pts) if (q !== p) nn = Math.min(nn, Math.hypot(q.x - p.x, q.y - p.y));
      const Rr = Math.min(nn * 0.74, p.r * 0.9);
      if (p.x + Rr * 1.25 < 0 || p.x - Rr * 1.25 > W || p.y + Rr * 1.25 < 0 || p.y - Rr * 1.25 > H) continue;
      crowns.push(this.makeCrown(p.x, p.y, Rr, R, crowns.length));
    }
    this.crowns = crowns;
    // 邻居：记下静止时的距离，推一棵树，它会顶旁边那棵
    this.pairs = [];
    for (let i = 0; i < crowns.length; i++) for (let j = i + 1; j < crowns.length; j++) {
      const a = crowns[i], b = crowns[j], d = Math.hypot(a.hx - b.hx, a.hy - b.hy);
      if (d < (a.R + b.R) * 1.25) this.pairs.push([i, j, d]);
    }
    for (const c of crowns) {
      for (const n of c.nodes) {
        n.nb = [];
        const wx = c.hx + n.rx, wy = c.hy + n.ry;
        crowns.forEach((o, j) => {
          if (o === c) return;
          const d = Math.hypot(wx - o.hx, wy - o.hy);
          if (d < o.R * 2.2) n.nb.push([j, d]);
        });
      }
    }
    // 树干从天顶那一点往外伸，越靠近镜头越粗
    this.trunks = [];
    crowns.forEach((c, i) => {
      let dx = c.hx - V.x, dy = c.hy - V.y, dl = Math.hypot(dx, dy);
      if (dl < 6) { const a = R() * TAU; dx = Math.cos(a); dy = Math.sin(a); dl = 1; }
      dx /= dl; dy /= dl;
      const Lf = diag * 1.5, bend = (R() - 0.5) * 0.12;
      this.trunks.push({
        ci: i, id: i,
        qx: c.hx + dx * Lf * 0.38 - dy * Lf * bend, qy: c.hy + dy * Lf * 0.38 + dx * Lf * bend,
        bx: c.hx + dx * Lf, by: c.hy + dy * Lf,
        hw0: 0.6 + c.R * 0.012, kw: 0.042 + R() * 0.012,
        dx, dy, sun: 0, sky: clamp((-0.6 * -dy + -0.8 * dx) * 1.5, -1, 1),
        len: dl
      });
    });
    this.trunks.sort((a, b) => b.len - a.len);
    this.placeClumps();
    this.parts.length = 0; this.queue.length = 0; this.drag = -1;
    this.motes = [];
    for (let i = 0; i < 90; i++) this.motes.push({ x: R() * W, y: R() * H, vx: (R() - 0.5) * 1.6, vy: (R() - 0.5) * 1.2 + 0.4, ph: R() * TAU, f: 1.5 + R() * 2.5 });
  }

  // 叶团铺满每棵树静止时真正占着的那块地盘（林冠里分给它的那一格），每团挂在最近的枝杈上。
  // z：0 是高处、晒得到太阳，1 是低处、在阴影里
  placeClumps() {
    const crowns = this.crowns, G0 = 2.2;
    const lob = crowns.map(c => c.lobes.map(l => {
      const n = l.node < 0 ? null : c.nodes[l.node];
      return [c.hx + (n ? n.rx : 0) + l.ox, c.hy + (n ? n.ry : 0) + l.oy, l.r];
    }));
    const near = crowns.map((c, i) => crowns.filter((o, j) => j !== i && Math.hypot(o.hx - c.hx, o.hy - c.hy) < (o.R + c.R) * 1.5).map(o => o.id));
    const sdf = (j, x, y) => { let m = 1e9; for (const [lx, ly, lr] of lob[j]) { const d = Math.hypot(x - lx, y - ly) - lr; if (d < m) m = d; } return m; };
    for (const c of crowns) {
      const RC = rng(c.id * 7907 + (this.seed | 0) * 131 + 17), Rr = c.R, sp = Rr * 0.12, ext = Rr * 1.35;
      c.cl = [];
      const add = (x, y, fine) => {
        const s1 = sdf(c.id, x, y);
        if (s1 > (fine ? -1.2 : 0.5)) return;      // 天上不留零星的碎点
        let s2 = 1e9;
        for (const j of near[c.id]) { const d = sdf(j, x, y); if (d < s2) s2 = d; }
        const mg = (s2 - s1 - G0) * 0.5;
        // 里面是大团，沿着缝再铺一圈细的小团
        if (fine ? (mg < -0.8 || mg > sp * 1.2) : mg <= sp * 1.2) return;
        let bn = -1, bd = Math.hypot(x - c.hx, y - c.hy) * 1.15;
        c.nodes.forEach((n, k) => { const d = Math.hypot(x - c.hx - n.rx, y - c.hy - n.ry); if (d < bd) { bd = d; bn = k; } });
        const nx = bn < 0 ? 0 : c.nodes[bn].rx, ny = bn < 0 ? 0 : c.nodes[bn].ry;
        const dc = Math.min(1, Math.hypot(x - c.hx, y - c.hy) / (Rr * 0.75));
        const r = fine ? Rr * (0.06 + 0.05 * RC()) + Math.max(0, mg) * 0.6 : Rr * (0.085 + 0.1 * RC()) * (1.2 - 0.3 * dc);
        const z = fine ? RC() * 0.55 : clamp(RC() * 0.7 + (1 - dc) * 0.45 - 0.08, 0, 1);
        c.cl.push({ node: bn, ox: x - c.hx - nx, oy: y - c.hy - ny, r, z, v: (RC() * 6) | 0, f: 0.7 + RC() * 1.2, ph: RC() * TAU });
      };
      for (let gy = -ext; gy <= ext; gy += sp) for (let gx = -ext; gx <= ext; gx += sp)
        add(c.hx + gx + (RC() - 0.5) * sp, c.hy + gy + (RC() - 0.5) * sp, false);
      const fp = sp * 0.6;
      for (let gy = -ext; gy <= ext; gy += fp) for (let gx = -ext; gx <= ext; gx += fp)
        add(c.hx + gx + (RC() - 0.5) * fp, c.hy + gy + (RC() - 0.5) * fp, true);
      c.cl.sort((a, b) => a.z - b.z);
    }
  }

  makeCrown(x, y, Rr, R, id) {
    const c = { id, hx: x, hy: y, x, y, vx: 0, vy: 0, ax: 0, ay: 0, R: Rr, light: (R() - 0.5) * 0.08, olive: R() < 0.3, ph: R() * TAU, ph2: R() * TAU, nodes: [], lobes: [], br: [], twigs: [] };
    const nMain = 5 + ((R() * 3) | 0), a0 = R() * TAU;
    c.lobes.push({ node: -1, r: Rr * 0.38 });
    for (let b = 0; b < nMain; b++) {
      const a = a0 + (b / nMain) * TAU + (R() - 0.5) * 0.5, L = Rr * (0.5 + R() * 0.26);
      const ni = c.nodes.push({ rx: Math.cos(a) * L, ry: Math.sin(a) * L, a, ex: 0, ey: 0, vx: 0, vy: 0, parent: -1, ph: R() * TAU, k: 34 + R() * 14 }) - 1;
      c.br.push({ to: ni, from: -1, t0: 0, bend: (R() - 0.5) * 0.7, lv: 1 });
      c.lobes.push({ node: ni, r: Rr * (0.36 + R() * 0.1) });
      const nSub = 1 + ((R() * 2) | 0);
      let side = R() < 0.5 ? -1 : 1;
      for (let s = 0; s < nSub; s++, side = -side) {
        const sa = a + side * (0.55 + R() * 0.4), t0 = 0.42 + R() * 0.22, Ls = L * (0.42 + R() * 0.2);
        const bx = Math.cos(a) * L * t0, by = Math.sin(a) * L * t0;
        const si = c.nodes.push({ rx: bx + Math.cos(sa) * Ls, ry: by + Math.sin(sa) * Ls, a: sa, ex: 0, ey: 0, vx: 0, vy: 0, parent: ni, ph: R() * TAU, k: 46 + R() * 16 }) - 1;
        c.br.push({ to: si, from: ni, t0, bend: (R() - 0.5) * 0.6, lv: 2 });
        c.lobes.push({ node: si, r: Rr * (0.26 + R() * 0.08) });
      }
    }
    c.nodes.forEach((n, i) => {
      const nr = n.parent < 0 ? 2 : 1 + ((R() * 2) | 0);
      for (let j = 0; j < nr; j++) {
        const a = n.a + (j % 2 ? 1 : -1) * (0.7 + R() * 0.6), d = Rr * (0.15 + R() * 0.12);
        c.lobes.push({ node: i, ox: Math.cos(a) * d, oy: Math.sin(a) * d, r: Rr * (0.16 + R() * 0.07) });
      }
      const k = 2 + ((R() * 2) | 0);
      for (let j = 0; j < k; j++) c.twigs.push({ node: i, a: n.a + (R() - 0.5) * 1.8, L: 2.5 + R() * 3.5 });
    });
    for (const l of c.lobes) { l.ox = l.ox || 0; l.oy = l.oy || 0; }
    c.cl = [];
    return c;
  }

  // 正对着天往上看：太阳越高，越靠近画面中间
  sunPos() {
    const { W, H } = this, h = this.hour, p = clamp((h - 12.5) / 6.5, -1, 1);
    const e = (7 + 76 * (1 - p * p)) * Math.PI / 180;
    const diag = Math.hypot(W, H), d = Math.min(diag * 0.5, (1 / Math.tan(e)) * Math.sqrt(W * H) * 1.27);
    const ax = p, ay = -0.5, al = Math.hypot(ax, ay);
    this.sunX = W * 0.5 + (ax / al) * d; this.sunY = H * 0.5 + (ay / al) * d;
    this.sunElev = e;
    const tod = (this.tod = todAt(h));
    applyPalette(h, tod);
    for (const tr of this.trunks || []) {
      const c = this.crowns[tr.ci], sx = this.sunX - c.x, sy = this.sunY - c.y, sl = Math.hypot(sx, sy) || 1;
      tr.sun = clamp(((sx * -tr.dy + sy * tr.dx) / sl) * 1.4, -1, 1);
    }
  }

  pose() {
    for (const c of this.crowns) for (const n of c.nodes) {
      let x = c.x + n.rx + n.ex, y = c.y + n.ry + n.ey;
      if (n.parent >= 0) { const p = c.nodes[n.parent]; x += p.ex * 0.7; y += p.ey * 0.7; }
      n.wx = x; n.wy = y;
    }
  }

  pick(x, y) {
    let best = -1, bs = 1.5;
    for (const c of this.crowns) for (const l of c.lobes) {
      const lx = l.node < 0 ? c.x : c.nodes[l.node].wx + l.ox, ly = l.node < 0 ? c.y : c.nodes[l.node].wy + l.oy;
      const d = Math.hypot(x - lx, y - ly) - l.r;
      if (d < bs) { bs = d; best = c.id; }
    }
    return best;
  }

  startDrag(i, x, y) {
    const c = this.crowns[i];
    this.drag = i; this.grab.x = c.x - x; this.grab.y = c.y - y;
  }
  endDrag() { this.drag = -1; }

  shake(i, x, y, strength = 1) {
    const c = this.crowns[i], R = this.R;
    if (!c) return;
    for (const n of c.nodes) {
      let dx = n.wx - x, dy = n.wy - y; const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      const s = (55 + R() * 35) * strength;
      n.vx += dx * s - dy * (R() - 0.5) * 30; n.vy += dy * s + dx * (R() - 0.5) * 30;
    }
    c.vx += (R() - 0.5) * 14 * strength; c.vy += (R() - 0.5) * 14 * strength;
    // 叶子先从外圈的团落，再往里
    const ls = c.lobes.map(l => {
      const lx = l.node < 0 ? c.x : c.nodes[l.node].wx + l.ox, ly = l.node < 0 ? c.y : c.nodes[l.node].wy + l.oy;
      return { lx, ly, r: l.r, d: Math.hypot(lx - c.x, ly - c.y) };
    }).sort((a, b) => b.d - a.d);
    const count = Math.round((18 + R() * 6) * strength);
    for (let k = 0; k < count; k++) {
      const l = ls[Math.min(ls.length - 1, Math.floor((k / count) * ls.length))];
      const a = R() * TAU, rr = l.r * (0.55 + R() * 0.4);
      const px = l.lx + Math.cos(a) * rr, py = l.ly + Math.sin(a) * rr;
      if (px < 0 || py < 0 || px >= this.W || py >= this.H) continue;
      this.queue.push({ at: this.time + (k / count) * 0.45 + R() * 0.06, x: px, y: py });
    }
  }
  shakeAll() {
    const R = this.R;
    this.crowns.forEach(c => {
      if (c.x < 0 || c.y < 0 || c.x > this.W || c.y > this.H) return;
      this.shake(c.id, c.x + (R() - 0.5) * c.R, c.y + (R() - 0.5) * c.R, 0.6);
    });
  }

  spawnLeaf(x, y, k = 1) {
    const R = this.R, V = this.V;
    if (this.parts.length > 260) return;
    this.parts.push({
      ax: x - V.x, ay: y - V.y, dx: 0, dy: 0, z: 1, vz: 0.15 + R() * 0.1, s0: (4.4 + R() * 1.6) * k,
      ph: R() * TAU, sp: 1.6 + R() * 2.2, w: 1.4 + R() * 1.8, wp: R() * TAU, amp: 2.5 + R() * 3.5,
      a: R() * TAU, va: (R() - 0.5) * 1.8, y2: R() < 0.4 ? 1 : 0, t0: this.time
    });
  }

  step(dt) {
    this.time += dt;
    const t = this.time, R = this.R;
    this.wind += (this.windT - this.wind) * (1 - Math.exp(-dt * 1.4));
    this.G += (this.Gt - this.G) * (1 - Math.exp(-dt * 5));
    const hov = this.ptr.hover && this.drag < 0;
    const Wd = this.wind, Wl = Math.abs(Wd), calm = this.calm ? 0.25 : 1;
    const crowns = this.crowns;
    const K = 7, D = 1.7, KR = 10;
    for (const c of crowns) {
      const gust = 0.55 + 0.45 * Math.sin(1.25 * t - 0.05 * c.hx + c.ph) * Math.sin(0.43 * t + c.ph2) + 0.22 * Math.sin(2.7 * t + c.ph * 2);
      c.fx = -K * (c.x - c.hx) - D * c.vx + Wd * 72 * gust * calm;
      c.fy = -K * (c.y - c.hy) - D * c.vy + Wl * 14 * Math.sin(0.9 * t + c.ph) * calm;
    }
    for (const [i, j, d0] of this.pairs) {
      const a = crowns[i], b = crowns[j];
      let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1;
      const comp = d0 * 0.985 - d;
      if (comp > 0) {
        dx /= d; dy /= d;
        const f = comp * KR;
        a.fx -= dx * f; a.fy -= dy * f; b.fx += dx * f; b.fy += dy * f;
      }
    }
    if (this.drag >= 0) {
      const c = crowns[this.drag];
      let tx = this.ptr.x + this.grab.x - c.hx, ty = this.ptr.y + this.grab.y - c.hy;
      const L = Math.hypot(tx, ty), mx = c.R * 0.8;
      if (L > 0.001) { const s = (mx * Math.tanh(L / mx)) / L; tx *= s; ty *= s; }
      c.fx += 70 * (c.hx + tx - c.x) - 9 * c.vx;
      c.fy += 70 * (c.hy + ty - c.y) - 9 * c.vy;
    }
    for (const c of crowns) {
      const ovx = c.vx, ovy = c.vy;
      c.vx += c.fx * dt; c.vy += c.fy * dt;
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.ax = (c.vx - ovx) / dt; c.ay = (c.vy - ovy) / dt;
    }
    this.pose();
    const px = this.ptr.x, py = this.ptr.y;
    for (const c of crowns) {
      for (const n of c.nodes) {
        const k = n.k, d = 2 * 0.24 * Math.sqrt(k);
        let fx = -k * n.ex - d * n.vx - c.ax * 0.65;
        let fy = -k * n.ey - d * n.vy - c.ay * 0.65;
        fx += Wd * calm * (80 * (0.5 + 0.5 * Math.sin(3.6 * t + n.ph)) + 34 * Math.sin(7.3 * t + n.ph * 2));
        fy += Wl * calm * 34 * Math.sin(5.1 * t + n.ph * 3);
        if (!this.calm) { fx += Math.sin(1.1 * t + n.ph) * 3; fy += Math.cos(0.9 * t + n.ph) * 3; }
        for (const [j, d0] of n.nb) {
          const o = crowns[j];
          const dx = n.wx - o.x, dy = n.wy - o.y, dd = Math.hypot(dx, dy) || 1;
          if (dd < d0 - 0.3) { const f = (d0 - dd) * 34; fx += (dx / dd) * f; fy += (dy / dd) * f; }
        }
        n.vx += fx * dt; n.vy += fy * dt;
        n.ex += n.vx * dt; n.ey += n.vy * dt;
        const el = Math.hypot(n.ex, n.ey), em = c.R * 0.45;
        if (el > em) { n.ex *= em / el; n.ey *= em / el; }
      }
    }
    this.pose();
    // 划过叶子：指针底下的枝杈沙沙动，隔一段掉一片
    if (this.lastPx === null) { this.lastPx = px; this.lastPy = py; }
    const pmx = px - this.lastPx, pmy = py - this.lastPy, mv = Math.hypot(pmx, pmy);
    this.lastPx = px; this.lastPy = py;
    if (hov && mv > 0 && mv < 30 && this.kind) {
      const X = px | 0, Y = py | 0;
      if (X >= 0 && Y >= 0 && X < this.W && Y < this.H && this.kind[Y * this.W + X] === 1) {
        for (const c of crowns) {
          if (Math.abs(c.x - px) > c.R * 1.4 || Math.abs(c.y - py) > c.R * 1.4) continue;
          for (const n of c.nodes) {
            const dd = Math.hypot(n.wx - px, n.wy - py);
            if (dd < 24) { const f = (1 - dd / 24) ** 2 * 2.2; n.vx += clamp(pmx, -3, 3) * f; n.vy += clamp(pmy, -3, 3) * f; }
          }
        }
        this.brushAcc += mv;
        while (this.brushAcc > this.brushNext) {
          this.brushAcc -= this.brushNext; this.brushNext = 16 + R() * 22;
          this.spawnLeaf(px + (R() - 0.5) * 8, py + (R() - 0.5) * 8, 0.85);
        }
      }
    }
    if (this.drag >= 0) {
      const c = crowns[this.drag];
      this.dragAcc = (this.dragAcc || 0) + Math.hypot(c.vx, c.vy) * dt;
      while (this.dragAcc > 5) {
        this.dragAcc -= 5;
        const a = R() * TAU, rr = c.R * (0.35 + R() * 0.45);
        this.queue.push({ at: t + R() * 0.1, x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr });
      }
    }
    // 落叶
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      if (q.at <= t) { this.spawnLeaf(q.x, q.y); this.queue.splice(i, 1); }
    }
    if (Wl > 0.45 && this.edgeN > 0) {
      const rate = 34 * (Wl - 0.35) ** 2 * calm;
      if (R() < rate * dt) {
        const e = this.edge[(R() * Math.min(this.edgeN, 4096)) | 0];
        this.spawnLeaf((e % this.W) + 0.5, ((e / this.W) | 0) + 0.5);
      }
    }
    this.fogPhase += dt * (1.6 + Wd * 9);
    for (const m of this.motes) {
      m.x += (m.vx + Wd * 6 + Math.sin(t * 0.7 + m.ph) * 0.8) * dt;
      m.y += (m.vy + Math.cos(t * 0.5 + m.ph) * 0.6) * dt;
      if (m.x < 0) m.x += this.W; if (m.x >= this.W) m.x -= this.W;
      if (m.y < 0) m.y += this.H; if (m.y >= this.H) m.y -= this.H;
    }
    const V = this.V;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.vz += 0.08 * dt;
      p.z -= p.vz * dt;
      p.ph += p.sp * dt; p.a += p.va * dt;
      p.dx += (Math.sin(t * p.w + p.wp) * p.amp + Wd * 16) * dt;
      p.dy += (Math.cos(t * p.w * 0.8 + p.wp) * p.amp * 0.5 + Wl * 3) * dt;
      const inv = 1 / p.z, x = V.x + (p.ax + p.dx) * inv, y = V.y + (p.ay + p.dy) * inv;
      if (p.z < 0.2 || p.s0 / p.z > 13 || x < -12 || y < -12 || x > this.W + 12 || y > this.H + 12) this.parts.splice(i, 1);
    }
  }

  plot(X, Y, lv, ci) {
    if (X < 0 || Y < 0 || X >= this.W || Y >= this.H) return;
    const i = Y * this.W + X, o = this.bLv[i];
    if (o === 0 || lv < o) { this.bLv[i] = lv; this.bCr[i] = ci + 1; }
  }
  bez(x0, y0, x1, y1, x2, y2, lv, ci, thickTo) {
    const len = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(2, Math.ceil(len * 1.7));
    const steep = Math.abs(y2 - y0) > Math.abs(x2 - x0);
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = 1 - u;
      const x = a * a * x0 + 2 * a * u * x1 + u * u * x2, y = a * a * y0 + 2 * a * u * y1 + u * u * y2;
      const X = Math.floor(x), Y = Math.floor(y);
      this.plot(X, Y, lv, ci);
      if (u < thickTo) this.plot(X + (steep ? 1 : 0), Y + (steep ? 0 : 1), lv, ci);
    }
  }

  rasterBranches() {
    this.bLv.fill(0);
    for (const c of this.crowns) {
      for (const b of c.br) {
        const n = c.nodes[b.to];
        let x0 = c.x, y0 = c.y, rx = n.rx, ry = n.ry;
        if (b.from >= 0) {
          const p = c.nodes[b.from];
          x0 = lerp(c.x, p.wx, b.t0); y0 = lerp(c.y, p.wy, b.t0);
          rx = n.rx - p.rx * b.t0; ry = n.ry - p.ry * b.t0;
        }
        const mx = (x0 + n.wx) / 2 - ry * b.bend * 0.25 - n.ex * 0.2, my = (y0 + n.wy) / 2 + rx * b.bend * 0.25 - n.ey * 0.2;
        this.bez(x0, y0, mx, my, n.wx, n.wy, b.lv, c.id, b.lv === 1 ? 0.45 : 0);
      }
      for (const tw of c.twigs) {
        const n = c.nodes[tw.node];
        const x1 = n.wx + Math.cos(tw.a) * tw.L, y1 = n.wy + Math.sin(tw.a) * tw.L;
        this.bez(n.wx, n.wy, (n.wx + x1) / 2, (n.wy + y1) / 2, x1, y1, 3, c.id, 0);
      }
    }
  }

  render() {
    this.sunPos();
    const { W, H, buf, cloud, bLv, bCr, kind } = this;
    const N = W * H;
    if (!this.OWN || this.OWN.length !== N) {
      this.OWN = new Int16Array(N); this.MGG = new Float32Array(N); this.TN = new Uint8Array(N); this.RPX = new Uint8Array(N);
    }
    const { OWN, MGG, TN, RPX } = this;
    const t = this.time, G = Math.max(0, this.G);
    this.rasterBranches();
    // 把各棵树的圆摊平成几个数组
    let nl = 0;
    for (const c of this.crowns) nl += c.lobes.length;
    if (!this.LX || this.LX.length < nl) {
      this.LX = new Float32Array(nl); this.LY = new Float32Array(nl); this.LR = new Float32Array(nl); this.LC = new Int16Array(nl);
    }
    const { LX, LY, LR, LC } = this;
    const nc = this.crowns.length;
    const CXY = new Int32Array(nc * 2);
    this.crowns.forEach((c, j) => { CXY[j * 2] = Math.round(c.x) - c.id * 37; CXY[j * 2 + 1] = Math.round(c.y) - c.id * 53; });
    // 每棵树看太阳在哪边；太阳在头顶时侧光淡掉
    const side = clamp(Math.cos(this.sunElev) * 1.6, 0.35, 1);
    const SDX = new Float32Array(nc), SDY = new Float32Array(nc);
    this.crowns.forEach((c, j) => { const sx = this.sunX - c.x, sy = this.sunY - c.y, sl = Math.hypot(sx, sy) || 1; SDX[j] = (sx / sl) * side; SDY[j] = (sy / sl) * side; });
    const gW = Math.min(1, G / 2.5);
    let k = 0;
    for (const c of this.crowns) for (const l of c.lobes) {
      LX[k] = l.node < 0 ? c.x : c.nodes[l.node].wx + l.ox; LY[k] = l.node < 0 ? c.y : c.nodes[l.node].wy + l.oy;
      LR[k] = l.r; LC[k] = c.id; k++;
    }
    // 圆按 8px 的格子分桶，每个像素只看自己格子里的
    const T = 8, gw = Math.ceil(W / T), gh = Math.ceil(H / T), E = G + 5;
    const cnt = new Int32Array(gw * gh + 1);
    const rng4 = k => {
      const r = LR[k] + E;
      return [Math.max(0, Math.floor((LX[k] - r) / T)), Math.min(gw - 1, Math.floor((LX[k] + r) / T)),
        Math.max(0, Math.floor((LY[k] - r) / T)), Math.min(gh - 1, Math.floor((LY[k] + r) / T))];
    };
    for (let k = 0; k < nl; k++) { const [a, b, c, d] = rng4(k); for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) cnt[y * gw + x + 1]++; }
    for (let i = 1; i <= gw * gh; i++) cnt[i] += cnt[i - 1];
    const fill = cnt.slice(0, gw * gh), list = new Int32Array(cnt[gw * gh]);
    for (let k = 0; k < nl; k++) { const [a, b, c, d] = rng4(k); for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) list[fill[y * gw + x]++] = k; }

    const sunX = this.sunX, sunY = this.sunY, sunS = 1 / (2 * (Math.sqrt(W * H) * 0.36) ** 2);
    // 云在天上飘；往太阳那边偏一点再取一次，云顶就亮了
    const cdx = t * 0.9 + this.wind * t * 0.6, cdy = t * 0.18;
    const ssx = clamp((sunX - W / 2) / W, -1, 1) * 2.4, ssy = clamp((sunY - H / 2) / H, -1, 1) * 2.4;
    let edgeN = 0; const edge = this.edge;
    // 第一遍：每个像素归哪棵树、离缝多远，背后是天
    for (let ty = 0; ty < gh; ty++) for (let tx = 0; tx < gw; tx++) {
      const tile = ty * gw + tx, st = cnt[tile], en = cnt[tile + 1];
      const x0 = tx * T, y0 = ty * T, x1 = Math.min(W, x0 + T), y1 = Math.min(H, y0 + T);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = y * W + x, px = x + 0.5, py = y + 0.5;
        let s1 = 1e9, s2 = 1e9, c1 = -1;
        for (let q = st; q < en; q++) {
          const kk = list[q], dx = px - LX[kk], dy = py - LY[kk];
          const d = Math.sqrt(dx * dx + dy * dy) - LR[kk], c = LC[kk];
          if (c === c1) { if (d < s1) s1 = d; }
          else if (d < s1) { s2 = s1; s1 = d; c1 = c; }
          else if (d < s2) s2 = d;
        }
        TN[i] = 255;
        let g = -9;
        if (c1 >= 0 && s1 < 7) {
          const wn = cloud[(((y - CXY[c1 * 2 + 1]) * 2) & 127) * 128 + (((x - CXY[c1 * 2]) * 2) & 127)];
          g = (s2 - s1 - G) * 0.5 + Math.min(0, 2.1 - wn * 4.6) * gW;
          if (c2edge(s1, s2, g, G)) edge[(edgeN++) & 4095] = i;
          OWN[i] = c1; MGG[i] = g;
          // 树冠里面暗的那一大块，一直铺到缝边；叶团画在它上面
          const fe = Math.min(g - 1.6, -s1 - 0.5);
          if (fe > 0) { TN[i] = fe < 1.6 ? 2 : fe < 3.2 && BAYER[((y & 3) << 2) | (x & 3)] > 0.1 ? 2 : 1; RPX[i] = this.crowns[c1].olive ? 1 : 0; }
        } else { OWN[i] = -1; MGG[i] = -9; }
      }
    }
    this.edgeN = edgeN;

    // 第二遍：叶团，先画远的；每团在后面的东西上留一点影子
    const Wl = Math.abs(this.wind);
    const drawSet = (zlo, zhi) => {
      for (const c of this.crowns) {
        if (c.x < -c.R * 1.6 || c.y < -c.R * 1.6 || c.x > W + c.R * 1.6 || c.y > H + c.R * 1.6) continue;
        const cid = c.id, sdx = SDX[cid], sdy = SDY[cid], rp = c.olive ? 1 : 0;
        const osx = Math.round(-sdx * 1.8), osy = Math.round(-sdy * 1.8 + 0.6);
        for (const q of c.cl) {
          if (q.z < zlo || q.z >= zhi) continue;
          let cx = (q.node < 0 ? c.x : c.nodes[q.node].wx) + q.ox, cy = (q.node < 0 ? c.y : c.nodes[q.node].wy) + q.oy;
          const fl = 0.3 + Wl * 0.8;
          cx += Math.sin(t * q.f * 2.1 + q.ph) * fl * 0.6; cy += Math.cos(t * q.f * 1.7 + q.ph) * fl * 0.4;
          let r = q.r;
          const X0 = Math.round(cx), Y0 = Math.round(cy);
          if (X0 < -14 || Y0 < -14 || X0 >= W + 14 || Y0 >= H + 14) continue;
          if (X0 >= 0 && Y0 >= 0 && X0 < W && Y0 < H) {
            const j = Y0 * W + X0;
            if (OWN[j] !== cid) continue;
            r = Math.min(r, MGG[j] + 1.1);   // 靠缝的地方只有叶尖伸到边上
          }
          if (r < 2) continue;
          const mk = MASKS[Math.min(12, Math.max(2, Math.round(r)))][q.v], P = mk.p, n = mk.n;
          const gx = cx - sunX, gy = cy - sunY, glow = Math.exp(-(gx * gx + gy * gy) * sunS);
          const base = 7.1 - q.z * 4.4 + glow * 1.6 + c.light * 10;
          if ((osx || osy) && q.z > 0.22 && r > 2.5) for (let m = 0; m < n; m++) {
            const X = X0 + P[m * 6] + osx, Y = Y0 + P[m * 6 + 1] + osy;
            if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
            const j = Y * W + X, tn = TN[j];
            if (tn !== 255 && tn > 1 && OWN[j] === cid) TN[j] = tn - (tn > 3 ? 2 : 1);
          }
          for (let m = 0; m < n; m++) {
            const o = m * 6, X = X0 + P[o], Y = Y0 + P[o + 1];
            if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
            const j = Y * W + X;
            if (OWN[j] !== cid || MGG[j] < -0.6) continue;
            const lam = P[o + 2] * sdx + P[o + 3] * sdy, e = P[o + 4];
            let v = base + lam * 2.5 + P[o + 5] * 1.3;
            if (e < 0.2 && lam > 0.05) v += 1.5;             // 向阳的边，光从边上透过来
            else if (e < 0.14) v -= 0.8;                      // 背阴的边，当这一团的轮廓
            const b = BAYER[((Y & 3) << 2) | (X & 3)];
            const tn = Math.floor(v + b * 0.4 + 0.5);
            TN[j] = tn < 1 ? 1 : tn > 11 ? 11 : tn; RPX[j] = rp;
          }
        }
      }
    };
    drawSet(-1, 0.52);
    // 主枝夹在远的团和近的团中间
    for (let i = 0; i < N; i++) {
      const bl = bLv[i];
      if (bl !== 1 || TN[i] === 255 || OWN[i] !== bCr[i] - 1 || MGG[i] < 0.5) continue;
      RPX[i] = 2; TN[i] = 2;
    }
    drawSet(0.52, 2);
    // 合成
    const RAMPS = [LEAF, LEAF2, BARK];
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      const tn = TN[i];
      if (tn !== 255) { buf[i] = RAMPS[RPX[i]][tn]; kind[i] = 1; continue; }
      // 天，带着飘的积云
      const px = x + 0.5, py = y + 0.5, gx = px - sunX, gy = py - sunY, glow = Math.exp(-(gx * gx + gy * gy) * sunS);
      const cu = ((x * 0.5 + cdx) | 0) & 127, cv = ((y * 0.5 + cdy) | 0) & 127;
      const cvv = cloud[cv * 128 + cu] + 0.12 * (1 - py / H) - 0.06;
      const bb = BAYER[((y & 3) << 2) | (x & 3)];
      if (cvv + bb * 0.06 > 0.6) {
        const cs = cloud[(((y * 0.5 + cdy + ssy) | 0) & 127) * 128 + (((x * 0.5 + cdx + ssx) | 0) & 127)];
        const lv = (cvv - cs) * 9 + 0.35 + (cvv - 0.6) * 2.5 + glow * 0.5;
        buf[i] = CLOUD[qz(clamp(lv, 0, 1), CLOUD.length, x, y, 0.5)];
      } else {
        const sv = 0.2 + 0.3 * (1 - py / H) + glow * 0.62 + (cvv - 0.45) * 0.5;
        buf[i] = SKY[qz(sv, SKY.length, x, y)];
      }
      kind[i] = 0;
    }
    this.drawTrunks();
    this.atmosphere();
    this.drawParts();
    this.ctx.putImageData(this.img, 0, 0);
  }

  drawTrunks() {
    const { W, H, buf, kind, near } = this;
    for (const tr of this.trunks) {
      const c = this.crowns[tr.ci];
      const x0 = c.x, y0 = c.y, x1 = tr.qx, y1 = tr.qy, x2 = tr.bx, y2 = tr.by;
      let u = 0, s = 0, off = 0;
      while (u < 1 && off < 6) {
        const a = 1 - u;
        const x = a * a * x0 + 2 * a * u * x1 + u * u * x2, y = a * a * y0 + 2 * a * u * y1 + u * u * y2;
        let dx = 2 * a * (x1 - x0) + 2 * u * (x2 - x1), dy = 2 * a * (y1 - y0) + 2 * u * (y2 - y1);
        const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        const nx = -dy, ny = dx, hw = tr.hw0 + s * tr.kw;
        if (x < -hw - 2 || x > W + hw + 2 || y < -hw - 2 || y > H + hw + 2) off++;
        else {
          off = 0;
          for (let w = -hw; w <= hw; w += 0.5) {
            const X = Math.floor(x + nx * w), Y = Math.floor(y + ny * w);
            if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
            const j = Y * W + X;
            buf[j] = this.bark(tr, w / hw, s, X, Y, hw);
            kind[j] = 2; near[j] = s > 90 ? 1 : s / 90;
          }
        }
        u += 0.45 / dl; s += 0.45;
      }
    }
  }
  bark(tr, uu, s, X, Y, hw) {
    // 光：太阳（跟着时间走）加上不变的天光，树干怎么都不会一下变平
    const L = clamp(tr.sun * 0.65 + tr.sky * 0.45, -1, 1), au = Math.abs(uu), us = uu * (L < 0 ? -1 : 1), la = Math.abs(L);
    let lit = 0.3 + uu * L * 0.26 + Math.exp(-(((us - 0.42) / 0.28) ** 2)) * 0.2 * la - au ** 5 * 0.3;
    // 树皮的纵纹顺着树干走；横着固定几条，所以越往树冠越挤，汇到一起
    const fz = clamp((hw - 1.8) / 2.5, 0, 1);
    const wig = Math.sin(s * 0.07 + tr.id * 1.7) * 0.25 + Math.sin(s * 0.019 + tr.id * 0.6) * 0.4;
    const cu = (uu * 0.5 + 0.5) * 4 + wig, ci = Math.floor(cu), fr = cu - ci;
    const ps = (s + hash2(ci, tr.id * 3) * 11) / (3.5 + s * 0.06), pi = Math.floor(ps), pf = ps - pi;
    const plate = hash2(ci + tr.id * 97, pi);
    let v = lit + (plate - 0.5) * 0.14 * fz;
    if (fr < 0.32) v -= 0.22 * fz;                                       // 沟
    else if (fr < 0.5) v += 0.08 * fz * (0.3 + 0.7 * Math.max(0, us));   // 棱边受光
    else if (pf < 0.14) v -= 0.12 * fz;                                  // 横着的裂缝
    // 苔藓：背光那一侧一块块的，越近地面越多
    const cl = this.cloud[((((s * 0.9) | 0) + tr.id * 23) & 127) * 128 + ((((uu * 0.5 + 0.5) * 34) | 0) + tr.id * 41 & 127)];
    const mz = cl + (-uu * L) * 0.14 + clamp(s / 200, 0, 0.05) - 0.71 + (hash2(X, Y) - 0.5) * 0.06;
    if (mz > 0 && au < 0.9 && s > 18) return MOSS[qz(clamp(mz * 1.6 + lit * 0.5 - 0.1, 0, 0.55), MOSS.length, X, Y)];
    return BARK[qz(clamp(v, 0, 1), BARK.length, X, Y)];
  }

  // 缝里透进来的光柱（往太阳那边径向散射）和一层薄雾
  atmosphere() {
    const tod = this.tod, fogK = this.fog * tod.fm, litK = this.light * tod.rm;
    if (fogK < 0.01 && litK < 0.01) return;
    const FOG = tod.F, LIGHT = tod.L, HALO = mixRGB(tod.F, tod.L, 0.45);
    const { W, H, buf, kind, near, w2, h2, mask, rays, cloud, V } = this;
    const halo = this.halo || (this.halo = new Float32Array(w2 * h2)), tmp = this.tmp || (this.tmp = new Float32Array(w2 * h2));
    if (halo.length !== w2 * h2) { this.halo = null; this.tmp = null; return this.atmosphere(); }
    const t = this.time;
    const sx = this.sunX / 2, sy = this.sunY / 2, gS = 1 / (2 * (Math.sqrt(w2 * h2) * 0.48) ** 2);
    // 半分辨率的天的覆盖；缝离太阳越近，透进来的光越强
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
      let sum = 0, n = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const X = 2 * x + dx, Y = 2 * y + dy;
        if (X < W && Y < H) { n++; if (kind[Y * W + X] === 0) sum++; }
      }
      const sky = n ? sum / n : 0, gx = x - sx, gy = y - sy;
      tmp[y * w2 + x] = sky;
      mask[y * w2 + x] = sky * (0.3 + 0.7 * Math.exp(-(gx * gx + gy * gy) * gS));
    }
    // 每道缝溢出来的一圈光晕（两遍方框模糊，差不多是高斯）
    boxBlur(tmp, halo, w2, h2, 3); boxBlur(halo, tmp, w2, h2, 3);
    halo.set(tmp);
    // 光柱：往太阳那边一步步走，把路上缝里透进来的光收起来
    const N = 28, dens = 0.95, dec = 0.95;
    const norm = (1 - dec) / (1 - Math.pow(dec, N));
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
      const px = x + 0.5, py = y + 0.5, ddx = ((px - sx) * dens) / N, ddy = ((py - sy) * dens) / N;
      let cx = px, cy = py, il = 0, wg = 1;
      for (let k = 0; k < N; k++) {
        cx -= ddx; cy -= ddy;
        if (cx < 0 || cy < 0 || cx >= w2 || cy >= h2) break;   // 走出画面：外面有没有缝不知道，就停
        il += mask[(cy | 0) * w2 + (cx | 0)] * wg; wg *= dec;
      }
      rays[y * w2 + x] = il * norm;
    }
    const breathe = 0.88 + 0.12 * Math.sin(t * 0.6) * Math.sin(t * 0.23 + 1);
    const diag = Math.hypot(W, H) * 0.5;
    const fp = this.fogPhase;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, k = kind[i];
      const hi = (y >> 1) * w2 + (x >> 1);
      const r0 = rays[hi];
      let ra = clamp((r0 - 0.06) * 2.8, 0, 1);
      ra = ra * ra * (3 - 2 * ra) * litK * breathe;
      let depth = clamp(1 - Math.hypot(x - V.x, y - V.y) / diag, 0, 1);
      if (k === 2) depth *= 1 - near[i];
      const wv = cloud[(((y * 0.5 + fp * 0.35) | 0) & 127) * 128 + (((x * 0.5 + fp) | 0) & 127)];
      const wisp = clamp((wv - 0.5) * 3, 0, 1);
      let fa = fogK * (0.02 + depth * depth * 0.3 + wisp * 0.18);
      let gl = k === 0 ? 0 : clamp(halo[hi] * 2.2, 0, 1) * (0.18 * litK + 0.16 * fogK);
      if (k === 0) { fa *= 0.5; ra *= 0.4; }
      const b = BAYER[((y & 3) << 2) | (x & 3)] + 0.5;
      const fq = Math.floor(fa * 16 + b) / 16, rq = Math.floor(ra * 0.5 * 8 + b) / 8, gq = Math.floor(gl * 12 + b) / 12;
      if (fq <= 0 && rq <= 0 && gq <= 0) continue;
      const c = buf[i];
      let R0 = c & 255, G0 = (c >> 8) & 255, B0 = (c >> 16) & 255;
      if (gq > 0) { R0 += (HALO[0] - R0) * gq; G0 += (HALO[1] - G0) * gq; B0 += (HALO[2] - B0) * gq; }
      if (fq > 0) { R0 += (FOG[0] - R0) * fq; G0 += (FOG[1] - G0) * fq; B0 += (FOG[2] - B0) * fq; }
      if (rq > 0) { R0 += (LIGHT[0] - R0) * rq; G0 += (LIGHT[1] - G0) * rq; B0 += (LIGHT[2] - B0) * rq; }
      buf[i] = ((255 << 24) | ((B0 | 0) << 16) | ((G0 | 0) << 8) | (R0 | 0)) >>> 0;
    }
    // 光柱里飘的浮尘
    const mh = mixRGB(LIGHT, [255, 255, 255], 0.6), ml = mixRGB(LIGHT, FOG, 0.3);
    const moteHi = pk(mh[0], mh[1], mh[2]), moteLo = pk(ml[0], ml[1], ml[2]);
    if (litK > 0.05) for (const m of this.motes) {
      const X = m.x | 0, Y = m.y | 0;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const r0 = rays[(Y >> 1) * w2 + (X >> 1)];
      const a = clamp((r0 - 0.12) * 3.2, 0, 1) * litK * (0.55 + 0.45 * Math.sin(t * m.f + m.ph));
      if (a > 0.35) buf[Y * W + X] = a > 0.7 ? moteHi : moteLo;
    }
  }

  drawParts() {
    const { W, H, buf, V } = this;
    for (const p of this.parts) {
      const inv = 1 / p.z, x = V.x + (p.ax + p.dx) * inv, y = V.y + (p.ay + p.dy) * inv;
      // 往镜头这边飘，稍微变大一点，大起来之前就淡掉
      const L = Math.min(p.s0 * inv, 10), fade = Math.max(clamp((p.s0 * inv - 9.5) / 3.5, 0, 1), 1 - clamp((this.time - p.t0) / 0.25, 0, 1));
      if (fade >= 1) continue;
      const pal = p.y2 ? FALL2 : FALL;
      // 翻着落：侧过来时变窄，但不会窄成一根棍；一半时间露出浅色的背面
      const cs = Math.cos(p.ph), wv = 0.5 + 0.5 * Math.abs(cs), back = cs < 0;
      const hw = Math.max(0.7, L * 0.3 * wv), ca = Math.cos(p.a), sa = Math.sin(p.a);
      const ext = Math.ceil(L * 0.6) + 1, X0 = Math.round(x), Y0 = Math.round(y);
      if (X0 < -ext || Y0 < -ext || X0 >= W + ext || Y0 >= H + ext) continue;
      for (let oy = -ext; oy <= ext; oy++) for (let ox = -ext; ox <= ext; ox++) {
        const X = X0 + ox, Y = Y0 + oy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const fx = X + 0.5 - x, fy = Y + 0.5 - y;
        const u = fx * ca + fy * sa, v = -fx * sa + fy * ca;
        const un = u / L + 0.5;                                    // 0 叶基 … 1 叶尖
        if (un < 0 || un > 1) continue;
        // 叶基圆，叶尖尖
        const half = hw * Math.sqrt(Math.max(0, un * (1 - un) * 4)) * (1.12 - 0.5 * un * un);
        const av = Math.abs(v);
        if (av > half + 0.3) continue;
        if (fade > 0 && BAYER[((Y & 3) << 2) | (X & 3)] + 0.5 < fade) continue;
        let col;
        if (av > half - 0.55 && L > 3.2) col = back ? pal[4] : pal[0];                      // 描一圈边，落在叶子上也看得清
        else if (back) col = pal[5];
        else if (L > 6.5 && av < 0.45 && un > 0.12 && un < 0.85) col = pal[1];              // 叶脉
        else col = v * (cs > 0 ? 1 : -1) > 0 ? pal[3] : pal[2];                              // 受光的半边 / 叶身
        buf[Y * W + X] = col;
      }
    }
  }
}

// ---------- 挂到页面上 ----------
const REF = Math.sqrt(180 * 240);           // 排林子那张图的边长（见 generate）
const SEEDS = [6, 3, 5, 4, 2, 8, 1, 11];   // 前几片林子是挑过的，看完了再随机
const GAP = 2.6;                            // 缝宽，小图上的像素
const PIXELS = 36000;                       // 小图大约多少个像素：舞台大小不同，像素放大的倍数跟着变
const FPS = 30;                             // 平时每秒几帧
const STEP = 1 / 120;                       // 物理按固定的步长走

function create(canvas, { hour = 15.5 } = {}) {
  const host = canvas.parentElement;   // 舞台：小图按它的大小排
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let still = motion.matches;
  let seedIx = 0, hourT = hour;
  const eng = new Canopy(canvas, { seed: SEEDS[0], gap: still ? GAP : 0, wind: still ? 0 : 0.1, calm: still, scale: 0.9, fog: 0.75, light: 0.98, hour });
  eng.Gt = GAP;   // 一开始树冠挨着，缝慢慢张开
  let raf = 0, prev = -1, last = -1e9, acc = 0, moved = -1e9, visible = true, dead = false;

  // 小图一个像素放大成 sc 个屏幕像素（整数），一共 PIXELS 个像素上下；除不尽的那一点让画布比舞台大一点、居中，多出来的被舞台裁掉
  function fit() {
    const r = host.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const dw = r.width * dpr, dh = r.height * dpr;
    const sc = Math.max(2, Math.round(Math.sqrt((dw * dh) / PIXELS)));
    const W = Math.ceil(dw / sc), H = Math.ceil(dh / sc);
    if (W !== eng.W || H !== eng.H) eng.setSize(W, H);
    Object.assign(canvas.style, {
      width: `${(W * sc) / dpr}px`, height: `${(H * sc) / dpr}px`,
      left: `${Math.floor((dw - W * sc) / 2) / dpr}px`, top: `${Math.floor((dh - H * sc) / 2) / dpr}px`,
    });
    paint(true);
  }

  function frame(now) {
    raf = 0;
    if (dead || !eng.W) return;
    if (still) { eng.hour = hourT; eng.render(); return; }
    const busy = eng.drag >= 0 || now - moved < 400 || eng.parts.length > 0 || eng.queue.length > 0
      || eng.hour !== hourT || Math.abs(eng.G - eng.Gt) > 0.02;
    // 平时每秒 FPS 帧；手上有动作、叶子在落、太阳在挪、缝在张开的时候每帧都画
    if (!busy && now - last < 1000 / FPS - 2) { schedule(); return; }
    const dt = prev < 0 ? 1 / 60 : Math.min(0.1, (now - prev) / 1000);
    prev = last = now;
    acc += dt;
    for (let n = 0; acc >= STEP && n < 12; n++) { eng.step(STEP); acc -= STEP; }
    acc = Math.min(acc, STEP);
    // 太阳慢慢挪到新的时间，大约两秒
    eng.hour += (hourT - eng.hour) * (1 - Math.exp(-dt * 2.5));
    if (Math.abs(hourT - eng.hour) < 0.01) eng.hour = hourT;
    eng.render();
    schedule();
  }
  function schedule() { if (!raf && !dead && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  // force：马上画下一帧，不等限帧
  function paint(force = false) { if (force) last = -1e9; schedule(); }

  // 指针：鼠标划过是拨叶子；按下以后挪过 6px、按在树冠上就是拖；没挪就是点，摇那棵树
  const toBuf = (e) => {
    const b = canvas.getBoundingClientRect();
    return [((e.clientX - b.left) / b.width) * eng.W, ((e.clientY - b.top) / b.height) * eng.H];
  };
  let press = null;
  const onDown = (e) => {
    if (still || !eng.W) return;
    const [x, y] = toBuf(e);
    eng.ptr.x = x; eng.ptr.y = y;
    const ci = eng.pick(x, y), mouse = e.pointerType === "mouse";
    press = { cx: e.clientX, cy: e.clientY, x, y, ci, drag: false, mouse };
    eng.ptr.hover = !mouse && ci < 0;   // 手指按在缝里再挪，也算拨叶子
    if (mouse) canvas.setPointerCapture(e.pointerId);   // 拖出画布也跟着走
    moved = performance.now(); paint(true);
  };
  const onMove = (e) => {
    if (still || !eng.W) return;
    const [x, y] = toBuf(e);
    eng.ptr.x = x; eng.ptr.y = y;
    moved = performance.now();
    if (press) {
      if (!press.drag && press.ci >= 0 && Math.hypot(e.clientX - press.cx, e.clientY - press.cy) > 6) {
        press.drag = true; eng.ptr.hover = false;
        eng.startDrag(press.ci, press.x, press.y);
        canvas.style.cursor = "grabbing";
      }
    } else if (e.pointerType === "mouse") {
      eng.ptr.hover = true;
      canvas.style.cursor = eng.pick(x, y) >= 0 ? "grab" : "";
    }
    schedule();
  };
  // pointercancel：手指上下划，浏览器拿去滚页面了，这一下不算点
  const onUp = (e) => {
    if (!press) return;
    if (press.drag) eng.endDrag();
    else if (e.type === "pointerup") {
      const ci = press.ci >= 0 ? press.ci : eng.pick(press.x, press.y);
      if (ci >= 0) eng.shake(ci, press.x, press.y);
    }
    eng.ptr.hover = press.mouse && e.type === "pointerup";
    canvas.style.cursor = press.mouse ? "grab" : "";
    press = null;
    paint(true);
  };
  const onLeave = () => { if (!press) eng.ptr.hover = false; };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);

  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { prev = -1; paint(true); } });
  io.observe(host);
  const ro = new ResizeObserver(fit);
  ro.observe(host);
  const onVis = () => { if (!document.hidden) { prev = -1; paint(true); } };
  document.addEventListener("visibilitychange", onVis);
  // 中途开了「减弱动态效果」：回到这片林子静止的样子，缝直接张开
  const onMotion = () => {
    still = motion.matches;
    eng.calm = still; eng.wind = eng.windT = still ? 0 : 0.1;
    press = null; eng.ptr.hover = false;
    if (eng.W) eng.generate(eng.seed);
    if (still) eng.G = GAP;
    prev = -1; paint(true);
  };
  motion.addEventListener("change", onMotion);

  fit();
  return {
    shake() { if (still || !eng.W) return; eng.shakeAll(); paint(true); },
    reseed() {
      if (!eng.W) return;
      seedIx++;
      eng.generate(seedIx < SEEDS.length ? SEEDS[seedIx] : 20 + Math.floor(Math.random() * 9000));
      eng.G = still ? GAP : 0;   // 新的林子也从挨着开始，缝再张开
      paint(true);
    },
    setHour(h) { hourT = h; paint(true); },
    destroy() {
      dead = true; cancelAnimationFrame(raf); raf = 0;
      io.disconnect(); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      motion.removeEventListener("change", onMotion);
    },
  };
}

export { create };
