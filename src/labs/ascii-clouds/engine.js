/* 字符画（ASCII）/ 点阵动画：整块按格铺满，场景按颜色和明暗给每格上色、挑一个字（或者画一个圆点），场景可以换；鼠标扫过能把主角打散。

     import { stage } from "./engine.js";
     const s = stage(canvas, { scene: "day", box: viewEl, pointer: winEl, cell: 8, glyphs: " .:-=+*#%@", fps: 30, period: 12000 });
     // cell 是一格多宽（CSS 像素）。给了 glyphs（由淡到浓，第一个是空格）每格画一个字，字体用 --mono：
     //   底格和天是最淡的「.」，天上给了 f.ink 的地方浓一些；主角按它有多少、颜色在调色板里多亮挑，越亮字越浓。
     // 不给 glyphs 就画圆点，dot 是点的直径占一格的多少
     s.set("dusk");           // 换场景：新旧两幅一格一格错开换过去
     s.refresh();             // 颜色变了（换主题）以后调，重新读 CSS 变量、重画场景
     s.destroy();             // 不用了：停下、摘掉监听

   颜色从 canvas 上的 CSS 变量读：--dot 是满屏的底点；--dot-fill 是点和点之间铺的那层底色有多浓（0 到 1，不写就是 0，浅色界面用）；场景没给调色板时，主角用 --subject 的颜色、最亮时 --subject-a 的不透明度。
   box 是主角待的那块地方（比如窗口中间那一块），点铺满整个 canvas。下面说的「格」就是一个点占的那一小块。

   一格从下往上叠三层：底格 → 天（f.sky，不动，也不会被打散）→ 主角（f.v 明暗、f.k 用调色板里第几个颜色）。
   主角不动的部分换场景时算一次存起来，会变的部分（云边慢慢鼓动）每帧重画；画完每格再按 dx 横着挪一点取样。
   鼠标扫过时，附近主角的格子被往外弹开、顺着鼠标带走一点，再像弹簧一样慢慢回到原处（打散）；点一下是原地炸开一圈。加一个场景：
     scene("名字", {
       build(f, env)            → 换上这个场景、画布大小变了时调一次：画天、画主角不动的部分、定调色板，返回这个场景自己的数据
       frame(f, t, env, s)      → 每帧调，可以不写：重画会变的那部分（f.v、f.k、f.m）
       move(f, t, env, s, dx)   → 每帧调，可以不写：往 dx（每格一个数，单位是格）里写这一格往右挪多少
       twinkle: 0.3             → 每格自己闪的幅度（按 f.m）
     });
   f 的单位都是格：f.cols、f.rows 是整块的格数，f.box = { x0, y0, x1, y1 } 是主角待的那块。
   f.palette = [[r, g, b, 最亮时的不透明度], …]（最多 256 个），f.k 每格填下标；f.sky 是每格 4 个数（r, g, b, 不透明度），
   f.ink 是天这一层每格的字有多浓（0~1，0 是「.」，只有字符模式用：太阳、倒影这种要显出来的地方给）。
   f.m 是每格跟着闪的程度（0~1）。随机数用 rng(种子)，每次一样；颗粒感用 noise / fbm；
   随时间变、一圈回到原样的噪声用 loop。

   动起来的东西都写成 t 的函数，并且以 period 为周期，录出来的视频首尾接得上（打散的点几秒内就回去了）。
   省着画：最多 fps 帧每秒，滚出屏幕、切到别的标签页就停；系统开了「减弱动态效果」只画一帧不动的。 */
const TAU = Math.PI * 2;

// ---------- 小工具 ----------
function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function hash(x, y, z = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// 几层噪声叠起来，0~1
function fbm(x, y, oct = 3) {
  let s = 0, a = 0.5, n = 0;
  for (let o = 0; o < oct; o++) { s += a * noise(x, y); n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= 0.5; }
  return s / n;
}
// 一圈回到原样的噪声：u 从 0 走到 1，花纹顺着 (ddx, ddy) 漂过去，到 1 时正好回到 u = 0 的样子
// （两份错开一圈的噪声按 u 交叉淡入淡出，再把中间被平均掉的对比度拉回来）
function loop(x, y, u, ddx, ddy, oct = 3) {
  const a = fbm(x + ddx * u, y + ddy * u, oct), b = fbm(x + ddx * (u - 1), y + ddy * (u - 1), oct);
  return 0.5 + (a * (1 - u) + b * u - 0.5) / Math.sqrt((1 - u) * (1 - u) + u * u);
}
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- 明暗图 ----------
class Field {
  resize(cols, rows, box) {
    const n = cols * rows;
    Object.assign(this, { cols, rows, box });
    this.v = new Float32Array(n); this.k = new Uint8Array(n); this.m = new Float32Array(n);
    this.sky = new Float32Array(n * 4); this.ink = new Float32Array(n);
  }
  clear() { this.v.fill(0); this.k.fill(0); this.m.fill(0); this.sky.fill(0); this.ink.fill(0); this.palette = null; }
  in(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  max(c, r, val, m = 0, k = 0) {
    if (!this.in(c, r)) return;
    const i = r * this.cols + c;
    if (val > this.v[i]) { this.v[i] = val; this.k[i] = k; }
    if (m > this.m[i]) this.m[i] = m;
  }
}

// ---------- 场景 ----------
const scenes = {};
const scene = (name, def) => { scenes[name] = def; };

// CSS 颜色 → [r, g, b, a]（0~255、0~1）
let probe = null;
function rgba(css) {
  probe ||= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000"; probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}

// ---------- 舞台 ----------
/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ scene?: string, box?: Element | null, pointer?: Element | null, cell?: number, dot?: number, glyphs?: string, fps?: number, period?: number, onResize?: Function }} [opts]
 */
function stage(canvas, { scene: first = Object.keys(scenes)[0], box: boxEl = null, pointer = null, cell = 6, dot = 0.5, glyphs = "", fps = 30, period = 12000, onResize } = {}) {
  const f = new Field();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let name = first, state = null, last = -1e9, raf = 0, visible = true;
  let from = null, fromAt = 0;
  let ctx = null, dpr = 1, pd = 3, ox = 0, oy = 0, mask = null, small = null, sctx = null, img = null;
  let dx, out, outK, tmp, tmpK, twk, twp, fromK, fromSky, fromInk, mix = 1;
  let col = { dot: [255, 255, 255, 0.07], sub: [255, 255, 255], a: 0.6, dark: true };
  const PR = new Float32Array(256), PG = new Float32Array(256), PB = new Float32Array(256), PA = new Float32Array(256), PT = new Float32Array(256);
  // 打散：每格离原处多远（offX、offY，格）、正往哪边飞（velX、velY，格/秒）
  let offX, offY, velX, velY, scattered = false;
  // 字符模式：atlas 是一排白字（每格一个，按 glyphs 的顺序由淡到浓），gmap 是整块画布上每格现在是哪个字，gi 记着每格的字有没有变
  let atlas = null, gmap = null, gctx = null, gi = null;
  const hits = [];

  // 风：几个周期都整除 period 的正弦叠起来，所以一圈以后回到原样
  const wind = (t) => {
    const p = (((t % period) + period) % period) / period;
    return 0.32 + 0.3 * Math.sin(TAU * p) + 0.14 * Math.sin(TAU * 3 * p + 1.3) + 0.06 * Math.sin(TAU * 7 * p + 0.4);
  };
  const env = { wind, period, noise, fbm, loop, hash, rng, clamp, smooth, TAU, get dark() { return col.dark; } };

  function readColors() {
    const cs = getComputedStyle(canvas);
    const dot = rgba(cs.getPropertyValue("--dot").trim() || "rgb(255 255 255 / 0.07)");
    const sub = rgba(cs.getPropertyValue("--subject").trim() || "#fff");
    const a = parseFloat(cs.getPropertyValue("--subject-a")) || 0.6;
    const fill = parseFloat(cs.getPropertyValue("--dot-fill")) || 0;
    col = { dot, sub, a, fill, dark: dot[0] + dot[1] + dot[2] > 384 };
  }
  function loadPalette() {
    const p = f.palette || [[...col.sub.slice(0, 3), col.a]];
    for (let j = 0; j < 256; j++) { const c = p[Math.min(j, p.length - 1)]; PR[j] = c[0]; PG[j] = c[1]; PB[j] = c[2]; PA[j] = c[3]; }
    // 字符模式下每个颜色用多浓的字：调色板里最亮的那个 1，最暗的 0.45，中间按亮度排（只有一个颜色时都是 1）
    const L = p.map((c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]), on = L.filter((_, j) => p[j][3] > 0);
    const lo = Math.min(...on), hi = Math.max(...on);
    for (let j = 0; j < 256; j++) { const c = Math.min(j, p.length - 1); PT[j] = p[c][3] <= 0 ? 0 : hi > lo ? 0.45 + 0.55 * (L[c] - lo) / (hi - lo) : 1; }
  }

  // 点的形状：画一次存起来，每帧拿它把点和点之间的缝抠掉。字符模式下换成一排字，每帧只重画换了字的格子
  function paintMask() {
    if (glyphs) {
      const fam = getComputedStyle(canvas).getPropertyValue("--mono").trim() || "ui-monospace, Menlo, monospace";
      atlas = document.createElement("canvas");
      atlas.width = pd * glyphs.length; atlas.height = pd;
      const t = atlas.getContext("2d");
      t.fillStyle = "#fff"; t.textAlign = "center"; t.textBaseline = "middle";
      t.font = `500 ${Math.round(pd * 0.92)}px ${fam}`;
      for (let k = 1; k < glyphs.length; k++) t.fillText(glyphs[k], pd * k + pd / 2, pd * 0.54);
      gmap = document.createElement("canvas");
      gmap.width = canvas.width; gmap.height = canvas.height;
      gctx = gmap.getContext("2d");
      gi = new Int8Array(f.cols * f.rows).fill(-1);
      return;
    }
    mask = document.createElement("canvas");
    mask.width = canvas.width; mask.height = canvas.height;
    // 先画一格：中间一个圆点；再拿它当花纹铺满
    const tile = document.createElement("canvas");
    tile.width = tile.height = pd;
    const t = tile.getContext("2d");
    t.fillStyle = "#fff"; t.beginPath(); t.arc(pd / 2, pd / 2, Math.max(0.8, (pd * dot) / 2), 0, TAU); t.fill();
    const m = mask.getContext("2d"), pat = m.createPattern(tile, "repeat");
    pat.setTransform(new DOMMatrix([1, 0, 0, 1, ox, oy]));
    m.fillStyle = pat; m.fillRect(ox, oy, f.cols * pd, f.rows * pd);
  }

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    pd = Math.max(2, Math.round(cell * dpr));
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    const cols = Math.max(8, Math.floor(W / pd)), rows = Math.max(4, Math.floor(H / pd));
    ox = Math.floor((W - cols * pd) / 2); oy = Math.floor((H - rows * pd) / 2);
    // 主角待的那块，换算成格
    let bx = { x0: 0, y0: 0, x1: cols, y1: rows };
    if (boxEl) {
      const a = canvas.getBoundingClientRect(), b = boxEl.getBoundingClientRect();
      const toC = (px) => (px * dpr - ox) / pd, toR = (py) => (py * dpr - oy) / pd;
      bx = { x0: toC(b.left - a.left), y0: toR(b.top - a.top), x1: toC(b.right - a.left), y1: toR(b.bottom - a.top) };
    }
    f.resize(cols, rows, bx);
    const n = cols * rows;
    dx = new Float32Array(n); out = new Float32Array(n); outK = new Uint8Array(n); tmp = new Float32Array(n); tmpK = new Uint8Array(n);
    offX = new Float32Array(n); offY = new Float32Array(n); velX = new Float32Array(n); velY = new Float32Array(n); scattered = false;
    // 每格自己闪的快慢和起点（快慢是整数，一圈回到原样）
    twk = new Uint8Array(n); twp = new Float32Array(n);
    for (let i = 0; i < n; i++) { twk[i] = 1 + Math.floor(hash(i, 3, 1) * 3); twp[i] = hash(i, 5, 2) * TAU; }
    canvas.width = W; canvas.height = H;
    ctx = canvas.getContext("2d");
    small = document.createElement("canvas"); small.width = cols; small.height = rows;
    sctx = small.getContext("2d");
    img = sctx.createImageData(cols, rows);
    paintMask();
    from = null;
    readColors();
    build();
    onResize?.(cols, rows);
    draw(performance.now(), true);
  }
  function build() { f.clear(); state = scenes[name].build(f, env) || {}; loadPalette(); }

  // 鼠标扫过：把附近的格子往外弹开，再顺着鼠标的方向带走一点；每格的方向各偏一点，散得不齐
  function kick() {
    if (!hits.length) return;
    const R = Math.max(6, Math.min(f.cols, f.rows) * 0.07);
    for (const h of hits) {
      // 点一下（h.burst）没有速度，按一个中等的速度往四周炸开；扫过去的按扫的速度
      const sp = h.burst ? 120 : Math.min(160, Math.hypot(h.vx, h.vy));
      if (sp < 4) continue;
      for (let r = Math.max(0, Math.floor(h.y - R)); r <= Math.min(f.rows - 1, Math.ceil(h.y + R)); r++)
        for (let c = Math.max(0, Math.floor(h.x - R)); c <= Math.min(f.cols - 1, Math.ceil(h.x + R)); c++) {
          const ex = c + 0.5 - h.x, ey = r + 0.5 - h.y, d = Math.hypot(ex, ey);
          if (d >= R) continue;
          const i = r * f.cols + c, k = Math.pow(1 - d / R, 1.5), turn = (hash(c, r, 31) - 0.5) * 1.6;
          const ux = d > 0.01 ? ex / d : 1, uy = d > 0.01 ? ey / d : 0;
          const rx = ux * Math.cos(turn) - uy * Math.sin(turn), ry = ux * Math.sin(turn) + uy * Math.cos(turn);
          const push = k * (5 + sp * 0.22) * (0.6 + 0.8 * hash(c, r, 37));
          velX[i] += rx * push + h.vx * 0.12 * k; velY[i] += ry * push + h.vy * 0.12 * k;
        }
      scattered = true;
    }
    hits.length = 0;
  }
  // 弹簧把每格拉回原处：快接近临界阻尼，不来回晃，一两秒就回去了
  function settle(dt) {
    if (!scattered) return;
    const K = 7, C = 4.6;
    let e = 0;
    for (let i = 0; i < offX.length; i++) {
      if (!offX[i] && !offY[i] && !velX[i] && !velY[i]) continue;
      velX[i] += (-K * offX[i] - C * velX[i]) * dt; velY[i] += (-K * offY[i] - C * velY[i]) * dt;
      offX[i] += velX[i] * dt; offY[i] += velY[i] * dt;
      const a = Math.abs(offX[i]) + Math.abs(offY[i]) + 0.1 * (Math.abs(velX[i]) + Math.abs(velY[i]));
      if (a > e) e = a;
    }
    if (e < 0.03) { offX.fill(0); offY.fill(0); velX.fill(0); velY.fill(0); scattered = false; }
  }

  // 这一帧每格的明暗和颜色：按 dx 横着挪了取样，再按各自的节奏闪一闪；打散的格子挪到它现在飞到的地方
  function render(t) {
    const { cols, rows, v, k, m } = f, def = scenes[name];
    def.frame?.(f, t, env, state);
    dx.fill(0);
    def.move?.(f, t, env, state, dx);
    const ph = ((((t % period) + period) % period) / period) * TAU, tw = def.twinkle ?? 0.3;
    for (let r = 0; r < rows; r++) {
      const row = r * cols;
      for (let c = 0; c < cols; c++) {
        const i = row + c, sx = c - dx[i], x0 = Math.floor(sx), fr = sx - x0;
        const ia = x0 >= 0 && x0 < cols ? row + x0 : -1, ib = x0 + 1 >= 0 && x0 + 1 < cols ? row + x0 + 1 : -1;
        const a = ia >= 0 ? v[ia] : 0, b = ib >= 0 ? v[ib] : 0;
        let val = a + (b - a) * fr;
        if (val > 0.004 && m[i] > 0) val *= 1 + tw * m[i] * Math.sin(ph * twk[i] + twp[i]);
        out[i] = val;
        outK[i] = (fr < 0.5 ? (ia >= 0 ? k[ia] : 0) : (ib >= 0 ? k[ib] : 0));
      }
    }
    if (!scattered) return;
    tmp.fill(0);
    for (let i = 0; i < out.length; i++) {
      const val = out[i];
      if (val <= 0.004) continue;
      let j = i, w = val;
      const o = Math.abs(offX[i]) + Math.abs(offY[i]);
      if (o > 0.4) {
        const c = Math.round((i % cols) + offX[i]), r = Math.round(Math.floor(i / cols) + offY[i]);
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        j = r * cols + c;
        w = val * (1 - 0.4 * Math.min(1, o / 12));   // 飞得越远越淡
      }
      if (w > tmp[j]) { tmp[j] = w; tmpK[j] = outK[i]; }
    }
    [out, tmp] = [tmp, out]; [outK, tmpK] = [tmpK, outK];
  }

  // 每格：底点 → 天 → 主角，一层层盖上去，写进一张一格一像素的小图，放大贴上，再把缝抠掉
  function paintDots() {
    const d = img.data, [dr, dg, db, da] = col.dot;
    for (let i = 0, j = 0; i < out.length; i++, j += 4) {
      let r = dr, g = dg, b = db, a = da;
      // 换场景时天也一格一格换过去
      const old = from && hash(i, 7, 3) >= mix, sky = old ? fromSky : f.sky, sa = sky[j + 3];
      if (sa > 0) { const k = a * (1 - sa), oa = sa + k; r = (sky[j] * sa + r * k) / oa; g = (sky[j + 1] * sa + g * k) / oa; b = (sky[j + 2] * sa + b * k) / oa; a = oa; }
      const q = outK[i], as = clamp(out[i]) * PA[q];
      if (as > 0) { const k = a * (1 - as), oa = as + k; r = (PR[q] * as + r * k) / oa; g = (PG[q] * as + g * k) / oa; b = (PB[q] * as + b * k) / oa; a = oa; }
      if (glyphs) {
        // 挑字：底格和天是最淡的点，天上给了 f.ink 的地方（太阳、倒影）浓一些；主角按它有多少、颜色在调色板里多亮挑，越亮字越浓。
        // 两层取浓的。不按和底色差多少挑：浅色界面上亮的云、太阳和白底差得少，会变成空洞
        const n = glyphs.length - 1, ink = old ? fromInk[i] : f.ink[i];
        const k = Math.min(n, Math.max(da > 0 || sa > 0 ? 1 + Math.round(ink * (n - 1)) : 0, Math.round(clamp(out[i]) * PT[q] * n)));
        if (k !== gi[i]) {
          const c = i % f.cols, x = ox + c * pd, y = oy + ((i - c) / f.cols) * pd;
          gctx.clearRect(x, y, pd, pd);
          if (k > 0) gctx.drawImage(atlas, k * pd, 0, pd, pd, x, y, pd, pd);
          gi[i] = k;
        }
        // 字的笔画比一整格细，颜色要更不透明才看得出；只是一个点的格子（天）不用加那么多，不然满屏的点抢眼
        a = Math.min(1, k > 1 ? a * 1.8 + 0.05 : a * 1.2);
      }
      d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = a * 255;
    }
    sctx.putImageData(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, ox, oy, f.cols * pd, f.rows * pd);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(glyphs ? gmap : mask, 0, 0);
    // 点和点之间铺一层很淡的底色（浅色界面用：白底上白云的点看不出来，靠这层把蓝天和白云分开）
    if (col.fill > 0) {
      ctx.globalCompositeOperation = "destination-over";
      ctx.globalAlpha = col.fill; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(small, ox, oy, f.cols * pd, f.rows * pd);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function draw(now, force) {
    if (!out) return;
    if (!force && now - last < 1000 / fps - 1) return;
    const dt = Math.max(0, Math.min(100, now - last)) / 1000;
    last = now;
    kick();
    settle(dt);
    render(reduce ? 0 : now);
    // 换场景：每一格在各自的时刻从旧的换成新的
    mix = from ? (now - fromAt) / 480 : 1;
    if (mix >= 1) from = null;
    if (from) for (let i = 0; i < out.length; i++) if (hash(i, 7, 3) >= mix) { out[i] = from[i]; outK[i] = fromK[i]; }
    paintDots();
  }

  function tick(now) { raf = requestAnimationFrame(tick); draw(now); }
  function play() { if (!raf && visible && !reduce && !document.hidden) raf = requestAnimationFrame(tick); }
  function pause() { cancelAnimationFrame(raf); raf = 0; }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? play() : pause(); });
  io.observe(canvas);
  const ro = new ResizeObserver(() => layout());
  ro.observe(canvas);
  let lastP = null;
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) * dpr - ox) / pd, ((e.clientY - r.top) * dpr - oy) / pd];
  };
  // 鼠标扫过：按扫的速度推开；触屏上手指一动页面就要滚，所以触屏只认点一下（鼠标点一下也行）
  const onMove = (e) => {
    if (reduce || e.pointerType !== "mouse") return;
    const [x, y] = at(e), now = performance.now();
    if (lastP && now > lastP.t) {
      const dt = Math.max(8, now - lastP.t) / 1000;
      hits.push({ x, y, vx: (x - lastP.x) / dt, vy: (y - lastP.y) / dt });
    }
    lastP = { x, y, t: now };
  };
  const onDown = (e) => {
    if (reduce || (e.target instanceof Element && e.target.closest("button"))) return;
    const [x, y] = at(e);
    hits.push({ x, y, vx: 0, vy: 0, burst: true });
  };
  const onLeave = () => (lastP = null);
  const onVis = () => (document.hidden ? pause() : play());
  const target = pointer || canvas;
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerdown", onDown);
  target.addEventListener("pointerleave", onLeave);
  document.addEventListener("visibilitychange", onVis);

  layout();
  play();
  return {
    set(next) {
      if (next === name || !scenes[next]) return;
      from = out ? out.slice() : null; fromK = outK ? outK.slice() : null; fromSky = f.sky.slice(); fromInk = f.ink.slice(); fromAt = performance.now();
      name = next; build();
      draw(performance.now(), true);
    },
    refresh() { readColors(); build(); draw(performance.now(), true); },
    rebuild() { build(); draw(performance.now(), true); },
    relayout: () => layout(),   // 字体换了（比如网页字体刚载完）以后调
    get scene() { return name; },
    get size() { return [f.cols, f.rows]; },
    // 拆掉：停下动画、摘掉监听（组件卸载时调）
    destroy() {
      pause(); io.disconnect(); ro.disconnect();
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerdown", onDown);
      target.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}

export { stage, scene, rng, hash, noise, fbm, loop, clamp, smooth, TAU };
