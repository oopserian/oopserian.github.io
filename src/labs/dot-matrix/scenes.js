/* 自带的场景：白天的云、黄昏的云（照宫崎骏动画里的云画的），还有「图」（拖一张图进窗口，按明暗点亮圆点）。
   每个都只是 scene(名字, { build, frame, move })，照着写一个就能换上别的场景，写法见 engine.js 开头。

   宫崎骏的云：积云底是平的，上面一排分得清的圆顶，圆顶上再鼓几个小包；黄昏的云是横着的长条，上沿鼓几个包。
   不用渐变，用几块分明的颜色：亮面、灰面、阴影、最深的阴影，交界清楚；云底压一道阴影。
   白天光从左上来，云是白的、阴影偏蓝；黄昏太阳在低处，云朝太阳的那面和底被照成金色、桃色，背光的一面是紫色。
   动的东西都按周期 env.period 循环：云边用 loop 很轻地鼓动，整片用整数倍频率的正弦轻轻飘。 */
import { scene, rng, noise, loop, hash, clamp, smooth, TAU } from "./engine.js";
const cycle = (t, env) => (((t % env.period) + env.period) % env.period) / env.period;   // 0~1
const lerp = (a, b, t) => a + (b - a) * t;

// 主角待的那块
const frame = (f) => {
  const { x0, y0, x1, y1 } = f.box;
  return { x0, y0, x1, y1, bw: x1 - x0, bh: y1 - y0 };
};

// ---------- 云的形状 ----------
// 每一团的上半圈鼓出几个小鼓包（ratio：鼓包和这一团的大小比）
function bumps(R, list, ratio, top = 0.92) {
  const out = [];
  for (const p of list) {
    const n = 2 + Math.floor(R() * 3);
    for (let j = 0; j < n; j++) {
      const a = -Math.PI * (0.5 - top / 2 + top * (j + 0.2 + R() * 0.6) / n);
      out.push({ x: p.x + Math.cos(a) * p.r * 0.86, y: p.y + Math.sin(a) * p.r * 0.82, r: p.r * ratio * (0.75 + R() * 0.5) });
    }
  }
  return out;
}
// 夏天的积云：底是平的，上面一排分得清的圆顶，中间最高、往两边一个比一个矮，像画里那种一朵朵的云；
// 每个圆顶左上亮、右下压进下一个圆顶的地方暗，圆顶和圆顶之间就有一道阴影隔开。w 一般是 h 的 2.6 倍左右
function cumulus(R, x, base, w, h) {
  // [离中心多远（按 w 的一半算）, 顶有多高（按 h 算）, 半径（按 h 算）]：相邻两个圆顶只叠一点，中间留出凹口
  const domes = [[-0.84, 0.44, 0.27], [-0.5, 0.74, 0.38], [0.02, 1, 0.5], [0.5, 0.7, 0.37], [0.84, 0.42, 0.26]];
  const puffs = domes.map(([u, hp, rr]) => {
    const k = 0.92 + R() * 0.16, r = h * rr * k;
    return { x: x + u * (w / 2) + (R() - 0.5) * r * 0.15, y: base - h * hp * k + r, r };
  });
  // 底下一排扁团把身子填满，底切平以后是一条直线
  const m = Math.max(3, Math.round(w / (h * 0.45)));
  for (let j = 0; j < m; j++) {
    const u = (j / (m - 1)) * 2 - 1, r = h * 0.28 * (1 - 0.3 * u * u);
    puffs.push({ x: x + u * (w / 2 - r * 1.1), y: base - r * 0.5, r });
  }
  return puffs.concat(bumps(R, puffs.slice(1, 4), 0.3, 0.7));
}
// 横着的一长条：身子是一串很密的扁团，连成两头尖的长条；上沿鼓出几个大小不一的包
function bank(R, x, base, w, th) {
  const puffs = [], n = Math.max(4, Math.round(w / (th * 0.35)));
  for (let j = 0; j < n; j++) {
    const u = j / (n - 1) - 0.5, taper = Math.sqrt(Math.max(0, 1 - (2 * u) ** 2)), r = th * 0.55 * (0.25 + 0.75 * taper);
    puffs.push({ x: x + u * w, y: base - r * 0.6, r });
  }
  const tops = [], m = Math.max(2, Math.round(w / (th * 1.5)));
  for (let j = 0; j < m; j++) {
    const u = (j + 0.2 + R() * 0.6) / m - 0.5, taper = Math.sqrt(Math.max(0, 1 - (2 * u) ** 2)), r = th * (0.42 + R() * 0.38) * taper;
    if (r > th * 0.18) tops.push({ x: x + u * w, y: base - th * 0.5 * taper - r * 0.25, r });
  }
  return puffs.concat(tops, bumps(R, tops, 0.42, 0.8));
}

// 把一朵云算进格子：每格记下钻进最深的那一团有多深（D，团的边上是 0）、该用哪块颜色（T）。底在 cut 那一行切平。
// tone(nx, ny, c, r, D, below)：nx、ny 是在那一团的哪一面，below 是往下还有几格才出云（0、1、2，再多算 3）
function bake(f, puffs, cut, tone) {
  const inside = (x, y) => y <= cut && puffs.some((p) => Math.hypot(x - p.x, y - p.y) < p.r);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9;
  for (const p of puffs) { x0 = Math.min(x0, p.x - p.r); x1 = Math.max(x1, p.x + p.r); y0 = Math.min(y0, p.y - p.r); }
  const idx = [], C = [], Rw = [], D = [], T = [];
  for (let r = Math.max(0, Math.floor(y0) - 1); r <= Math.min(f.rows - 1, Math.ceil(cut) + 1); r++)
    for (let c = Math.max(0, Math.floor(x0) - 1); c <= Math.min(f.cols - 1, Math.ceil(x1) + 1); c++) {
      const cx = c + 0.5, cy = r + 0.5;
      if (cy > cut + (noise(c / 6, cut) - 0.5) * 1.2) continue;
      let best = -9, nx = 0, ny = 0;
      for (const p of puffs) {
        const ex = cx - p.x, ey = cy - p.y, d = 1 - Math.hypot(ex, ey) / p.r;
        if (d > best) { best = d; nx = ex / p.r; ny = ey / p.r; }
      }
      if (best < -0.2) continue;
      let below = 0;
      while (below < 3 && inside(cx, cy + below + 1)) below++;
      idx.push(r * f.cols + c); C.push(c); Rw.push(r); D.push(best); T.push(tone(nx, ny, c, r, best, below));
    }
  return { idx: Int32Array.from(idx), C: Int16Array.from(C), Rw: Int16Array.from(Rw), D: Float32Array.from(D), T: Uint8Array.from(T) };
}
// 亮度 → 第几块颜色（1 最亮 … 5 最暗），交界处错开一两格，不是一条直线
const band = (L, c, r) => { L += (hash(c, r, 5) - 0.5) * 0.04; return L > 0.74 ? 1 : L > 0.56 ? 2 : L > 0.38 ? 3 : L > 0.2 ? 4 : 5; };

// 云边每帧很轻地鼓动（边上一圈才算噪声，里面不用）；后画的云盖在前面
function drawClouds(f, t, env, clouds) {
  const u = cycle(t, env), { v, k, m } = f;
  for (const cl of clouds) for (let j = 0; j < cl.idx.length; j++) v[cl.idx[j]] = 0;
  for (const cl of clouds) for (let j = 0; j < cl.idx.length; j++) {
    let d = cl.D[j];
    if (d < 0.2) d += (loop(cl.C[j] / 4.5 + cl.seed, cl.Rw[j] / 4, u, 1.2, -0.3, 2) - 0.5) * 0.24;
    const a = smooth(-0.02, 0.06, d);
    if (a <= 0.02) continue;
    const i = cl.idx[j];
    v[i] = Math.max(v[i] * (1 - a), a); k[i] = cl.T[j]; m[i] = 0.2;
  }
}

// 天：按行的渐变（stops：[位置 0~1, r, g, b, 不透明度]），可以再加一团光
function paintSky(f, stops, glow) {
  const { cols, rows, sky } = f, boost = f.light ? 1.5 : 1;
  for (let r = 0; r < rows; r++) {
    const y = r / (rows - 1);
    let s = 1;
    while (s < stops.length - 1 && stops[s][0] < y) s++;
    const A = stops[s - 1], B = stops[s], q = clamp((y - A[0]) / (B[0] - A[0] || 1));
    for (let c = 0; c < cols; c++) {
      const j = (r * cols + c) * 4;
      let R = lerp(A[1], B[1], q), G = lerp(A[2], B[2], q), Bl = lerp(A[3], B[3], q), a = lerp(A[4], B[4], q) * boost;
      if (glow) {
        const g = Math.exp(-(((c - glow.x) / glow.rx) ** 2 + ((r - glow.y) / glow.ry) ** 2)) * glow.a;
        R = lerp(R, glow.c[0], g); G = lerp(G, glow.c[1], g); Bl = lerp(Bl, glow.c[2], g); a = Math.min(1, a + g * 0.35);
        // 太阳本身：一个小圆，亮
        if (glow.sun && Math.hypot(c - glow.x, (r - glow.y) * 1.05) < glow.sun) { if (f.light) { R = 255; G = 178; Bl = 96; } else { R = 255; G = 226; Bl = 170; } a = 1; }
      }
      sky[j] = R; sky[j + 1] = G; sky[j + 2] = Bl; sky[j + 3] = clamp(a);
    }
  }
}

// 地平线以下是海：比天暗、偏紫，太阳底下一道断断续续的金色倒影，越近越宽
function sea(f, horizon, sun, rad, dark) {
  const { cols, rows, sky } = f, h0 = Math.ceil(horizon);
  const top = dark ? [92, 62, 108, 0.36] : [176, 122, 152, 0.72], bot = dark ? [40, 30, 70, 0.34] : [112, 94, 158, 0.66];
  const gold = dark ? [255, 212, 146] : [255, 176, 96];
  for (let r = h0; r < rows; r++) {
    const d = (r - h0) / Math.max(1, rows - 1 - h0), wide = rad * (0.9 + d * 1.3);
    for (let c = 0; c < cols; c++) {
      const j = (r * cols + c) * 4;
      for (let q = 0; q < 4; q++) sky[j + q] = lerp(top[q], bot[q], d);
      // 倒影：隔行、按 hash 断开，中间密两边稀，越远越淡
      const u = Math.abs(c - sun.x) / wide;
      if (u < 1 && (r - h0) % 2 === 0 && hash(c, r, 11) < 0.85 - u * 0.7) {
        sky[j] = gold[0]; sky[j + 1] = gold[1]; sky[j + 2] = gold[2]; sky[j + 3] = clamp((1 - u * 0.5) * (1 - d * 0.35));
      }
    }
  }
}

// ---------- 白天：蓝天里飘着几朵夏天的积云 ----------
scene("day", {
  twinkle: 0.05,
  build(f, env) {
    f.light = !env.dark;
    const R = rng(7), { x0, y0, x1, y1, bw, bh } = frame(f);
    // 白，阴影偏蓝；浅色界面上阴影要更深一点才看得出
    f.palette = env.dark
      ? [[0, 0, 0, 0], [255, 255, 255, 0.95], [212, 224, 244, 0.86], [156, 176, 220, 0.78], [108, 128, 190, 0.72], [76, 92, 156, 0.68]]
      : [[0, 0, 0, 0], [208, 221, 242, 1], [184, 202, 234, 1], [150, 174, 220, 1], [110, 136, 198, 1], [82, 104, 176, 1]];
    paintSky(f, env.dark
      ? [[0, 30, 62, 128, 0.42], [0.6, 62, 112, 178, 0.36], [1, 120, 170, 222, 0.36]]
      : [[0, 58, 116, 206, 0.5], [0.6, 90, 148, 224, 0.42], [1, 138, 184, 238, 0.4]]);
    // 光从左上来：每一团上面亮、下面暗，整朵越往底越暗，底上压一道阴影
    const light = (base, h) => (nx, ny, c, r) => {
      let L = 0.55 * clamp(0.55 - 0.7 * ny - 0.35 * nx) + 0.45 * clamp((base - r) / h) + 0.04;
      if (r > base - Math.max(2, h * 0.18)) L *= 0.6;
      return band(L, c, r);
    };
    // 几朵飘在半空的积云：近处一大朵，右上一朵中的，左上远处一朵小的，天边一排低低的。
    // 云的大小按 W 算：竖着的放宽一点，特别扁的（宽是高的两倍以上，比如首页的卡片）按高算，不然云比天还高
    const portrait = bw < bh, W = portrait ? bw * 1.3 : Math.min(bw, bh * 2), cu = (cx, cy, w, h) => ({ p: cumulus(R, cx, cy, w, h), base: cy, h });
    const defs = [
      { p: bank(R, x0 + bw * 0.5, y1 - bh * 0.03, bw * 1.1, bh * 0.1), base: y1 - bh * 0.03 + bh * 0.015, h: bh * 0.14 },
      cu(x0 + bw * 0.15, y0 + bh * (portrait ? 0.2 : 0.26), W * 0.18, W * 0.07),
      cu(x0 + bw * 0.78, y0 + bh * (portrait ? 0.36 : 0.36), W * 0.3, W * 0.12),
      cu(x0 + bw * 0.42, y0 + bh * (portrait ? 0.72 : 0.76), W * 0.6, W * 0.24),
    ];
    return { clouds: defs.map((d, j) => ({ ...bake(f, d.p, d.base, light(d.base, d.h)), seed: j * 9.1 + 2 })) };
  },
  frame(f, t, env, s) { drawClouds(f, t, env, s.clouds); },
  move(f, t, env, s, dx) { dx.fill(0.9 * Math.sin(TAU * cycle(t, env))); },
});

// ---------- 黄昏：太阳落在天边，云底被照成金色、桃色，背光的一面是紫色 ----------
scene("dusk", {
  twinkle: 0.05,
  build(f, env) {
    f.light = !env.dark;
    const R = rng(19), { x0, y0, x1, y1, bw, bh } = frame(f);
    const horizon = y1 - bh * 0.16, sun = { x: x0 + bw * 0.3, y: horizon };
    f.palette = env.dark
      ? [[0, 0, 0, 0], [255, 216, 160, 0.9], [248, 168, 138, 0.8], [204, 128, 166, 0.72], [124, 94, 154, 0.66], [80, 64, 120, 0.62]]
      : [[0, 0, 0, 0], [242, 168, 84, 1], [234, 126, 102, 1], [194, 94, 144, 1], [118, 80, 154, 1], [74, 56, 122, 1]];
    paintSky(f, env.dark
      ? [[0, 34, 32, 86, 0.42], [0.45, 92, 62, 136, 0.3], [0.72, 186, 98, 122, 0.24], [0.86, 232, 138, 100, 0.26], [1, 250, 172, 116, 0.3]]
      : [[0, 70, 62, 140, 0.4], [0.45, 140, 104, 176, 0.36], [0.72, 232, 150, 150, 0.4], [0.86, 250, 184, 132, 0.46], [1, 255, 214, 160, 0.5]],
      { x: sun.x, y: sun.y, rx: bw * 0.3, ry: bh * 0.2, a: env.dark ? 0.3 : 0.35, c: [255, 210, 150], sun: Math.max(3, bh * 0.06) });
    sea(f, horizon, sun, Math.max(3, bh * 0.06), env.dark);
    // 云的颜色主要看整朵：越往下越亮（太阳在低处从下往上照），朝太阳的那头亮；每一团自己的明暗只占一小份。
    // 云的下沿一圈是最亮的金边
    const light = (cx, w, top, h) => (nx, ny, c, r, d, below) => {
      const sx = sun.x - c, sy = sun.y - r, sl = Math.hypot(sx, sy) || 1;
      const own = clamp(0.5 + 0.6 * ((nx * sx) / sl + (ny * sy) / sl)), under = clamp((r - top) / h), side = clamp(0.5 + ((cx - c) / w) * Math.sign(cx - sun.x) * 0.9);
      let L = 0.2 * own + 0.45 * under + 0.2 * side + 0.05;
      if (below === 0) L = Math.max(L + 0.4, 0.8);
      else if (below === 1) L += 0.22;
      return band(L, c, r);
    };
    // 一条条横着的云，底在 base 切平；th 是厚度
    const strip = (x, base, w, th) => ({ p: bank(R, x, base, w, th), cut: base + th * 0.15, light: light(x, w, base - th * 1.1, th * 1.3) });
    const defs = [
      strip(x0 + bw * 0.62, y0 + bh * 0.2, bw * 0.5, bh * 0.09),
      strip(x0 + bw * 0.26, y0 + bh * 0.4, bw * 0.48, bh * 0.11),
      strip(x0 + bw * 0.7, y0 + bh * 0.6, bw * 0.58, bh * 0.13),
      strip(x0 + bw * 0.7, horizon - bh * 0.02, bw * 0.56, bh * 0.08),
    ];
    return { clouds: defs.map((d, j) => ({ ...bake(f, d.p, d.cut, d.light), seed: j * 5.7 + 1 })) };
  },
  frame(f, t, env, s) { drawClouds(f, t, env, s.clouds); },
  move(f, t, env, s, dx) { dx.fill(0.7 * Math.sin(TAU * cycle(t, env))); },
});

// ---------- 图：拖进来的图片，按明暗点亮圆点 ----------
let picture = null;
scene("image", {
  build(f, env) {
    if (!picture) return null;
    const { bw, bh, x0, y0 } = frame(f);
    const ar = picture.width / picture.height;
    let cols = Math.floor(bw * 0.86), rows = Math.round(cols / ar);
    if (rows > bh * 0.86) { rows = Math.floor(bh * 0.86); cols = Math.round(rows * ar); }
    const c = document.createElement("canvas");
    c.width = cols; c.height = rows;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(picture, 0, 0, cols, rows);
    const px = x.getImageData(0, 0, cols, rows).data;
    const n = cols * rows, lum = new Float32Array(n), alpha = new Float32Array(n);
    let clear = 0;
    for (let i = 0; i < n; i++) {
      alpha[i] = px[i * 4 + 3] / 255;
      if (alpha[i] < 0.5) clear++;
      const l = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
      // 深色界面上亮的地方点亮；浅色界面上暗的地方上色
      lum[i] = env.dark ? l : 1 - l;
    }
    let vals;
    if (clear > n * 0.05) {
      // 带透明底的图（剪影、图标）：有东西的地方都点亮，再按明暗分一分
      vals = lum.map((l, i) => alpha[i] * (0.55 + 0.45 * l));
    } else {
      // 照片：拉开明暗，暗的地方压下去
      const sorted = Array.from(lum).sort((a, b) => a - b), lo = sorted[Math.floor(n * 0.02)], hi = sorted[Math.floor(n * 0.98)] || 1;
      vals = lum.map((l) => Math.pow(clamp((l - lo) / Math.max(0.05, hi - lo)), 1.3));
    }
    const c0 = Math.round(x0 + (bw - cols) / 2), r0 = Math.round(y0 + (bh - rows) / 2);
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const v = vals[r * cols + q] * (0.8 + 0.2 * noise((q + c0) * 0.9, (r + r0) * 0.9));
      if (v > 0.02) f.max(q + c0, r + r0, v, 0.4);
    }
    return { rows };
  },
  // 整张轻轻左右飘一点
  move(f, t, env, s, dx) { if (s && s.rows) dx.fill(1.2 * Math.sin(TAU * cycle(t, env))); },
});
export const setPicture = (img) => { picture = img; };
export const hasPicture = () => !!picture;
