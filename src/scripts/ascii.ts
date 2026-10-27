// 首屏的字符画：头像用等宽字符拼出来，四周一圈淡淡的字符像烟一样慢慢流动。
// 鼠标划过会把字搅乱（变成强调色的乱码，松开后慢慢落回原样），点一下荡开一圈。
//
// 画法是 canvas 2D，没用 WebGL：先把要用的字画进一张小图（图集），之后每一格只是 drawImage 一小块。
// 每一帧只重画变了的格子（被搅动的、闪一下的、烟里换了字的），一帧通常只有几十到几百格，主线程几乎不占。
// 不在屏幕上、切到别的标签页就停；系统开了「减弱动态效果」只画一帧静止的。
//
// 用法：mount({ host, canvas, anchor, src })。host 是铺字符的那块（首屏），canvas 盖满它，
// anchor 是头像要放的位置（一个正方形的空元素，由 CSS 排版），src 是头像图（透明底）。

interface Options {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  anchor: HTMLElement;
  src: string;
}

// 候选的字，按在这款字体里的墨量排好序后挑出一串由淡到浓的（见 buildAtlas）
const CANDIDATES = ` .'\`,:;-~"^=+<>!/\\|()?ivxzo*%#&$@8B`;
const LEVELS = 14;                 // 浓淡分几档
const GAMMA = 1.2;                 // 亮度到浓淡的曲线，大于 1 时中间调偏淡
const NOISE = '!?/\\|()[]{}<>=+*#%&$@0123456789'; // 被搅乱时出现的字
const FPS = 30;                    // 开场、被搅动时的帧率
const AMBIENT_FPS = 8;             // 平时（只有烟在飘、偶尔闪一下）的帧率：每画一帧整张 canvas 都要重新合成，平时没必要画那么勤
const HEAT_DECAY = 0.88;           // 搅动的热度每帧衰减
const HEAT_RADIUS = 7;             // 鼠标周围几格会被搅动（按列算）
const INTRO_MS = 1300;             // 开场：头像从乱码里显出来用多久
const RIPPLE_MS = 1100;

type Theme = { ink: string; hot: string; dark: boolean };

export function mount({ host, canvas, anchor, src }: Options) {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const img = new Image();
  img.decoding = 'async';
  img.src = src;

  // 网格和每一格的状态
  let W = 0, H = 0, dpr = 1, cw = 7, ch = 12, cols = 0, rows = 0;
  let base: Uint8Array;        // 每格本来的字（ramp 里的档位，0 是空）
  let baseA: Float32Array;     // 每格本来的不透明度
  let kind: Uint8Array;        // 0 空，1 头像，2 烟
  let heat: Float32Array;      // 被搅动的热度，0 到 1
  let shownG: Int16Array;      // 现在画在上面的字（图集里的序号，-1 是空）
  let shownA: Uint8Array;      // 现在的不透明度（量化成 0..32）
  let shownC: Uint8Array;      // 现在的颜色（0 墨色，1 强调色）
  let wantG: Int16Array;       // 这一帧想画的
  let resolveAt: Float32Array; // 开场时每格显出来的时间
  let field: Int32Array;       // 烟占的格子
  let fieldW: Float32Array;    // 烟在每格的浓度上限（离头像越远越淡）
  let portrait: Int32Array;    // 头像占的格子
  let hot: number[] = [];      // 正在发热的格子
  let twinkles: { i: number; g: number; until: number }[] = [];
  let ripples: { x: number; y: number; t0: number }[] = [];
  let pc0 = 0, pr0 = 0, pcols = 0, prows = 0; // 头像所在的格子范围

  // 图集：每个字画两遍，一行墨色，一行强调色
  let atlas: HTMLCanvasElement | null = null;
  let ramp: number[] = [];     // 由淡到浓每一档对应的图集序号
  let noiseIdx: number[] = [];

  let theme: Theme = readTheme();
  let t0 = performance.now();
  let raf = 0, last = 0, lastAmbient = 0;
  let visible = true;
  let built = false;
  let introPending = true;    // 开场还有格子没显出来

  function readTheme(): Theme {
    const s = getComputedStyle(canvas);
    const scheme = getComputedStyle(document.documentElement).colorScheme;
    return { ink: s.getPropertyValue('--ascii').trim() || '#888', hot: s.getPropertyValue('--ascii-hot').trim() || '#f80', dark: scheme.includes('dark') };
  }

  function font() {
    const size = parseFloat(getComputedStyle(canvas).getPropertyValue('--ascii-size')) || 11;
    return { size, css: `${size}px "DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace` };
  }

  function buildAtlas() {
    const f = font();
    ctx.font = f.css;
    cw = Math.max(4, Math.round(ctx.measureText('M').width));
    ch = Math.round(f.size * 1.18);
    const all = Array.from(new Set(CANDIDATES + NOISE));
    const gw = Math.ceil(cw * dpr), gh = Math.ceil(ch * dpr);
    atlas = document.createElement('canvas');
    atlas.width = gw * all.length;
    atlas.height = gh * 2;
    const a = atlas.getContext('2d', { willReadFrequently: true })!;
    a.font = f.css.replace(`${f.size}px`, `${f.size * dpr}px`);
    a.textBaseline = 'middle';
    a.textAlign = 'center';
    [theme.ink, theme.hot].forEach((color, row) => {
      a.fillStyle = color;
      all.forEach((c, i) => a.fillText(c, i * gw + gw / 2, row * gh + gh / 2 + 0.5));
    });
    // 量每个候选字的墨量，排成由淡到浓，再均匀挑出 LEVELS 档
    const data = a.getImageData(0, 0, gw * all.length, gh).data;
    const ink = all.map((_, i) => {
      let sum = 0;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) sum += data[(y * gw * all.length + i * gw + x) * 4 + 3];
      return sum;
    });
    const cand = Array.from(new Set(CANDIDATES)).map(c => all.indexOf(c)).sort((p, q) => ink[p] - ink[q]);
    const max = ink[cand[cand.length - 1]];
    ramp = [];
    for (let l = 0; l < LEVELS; l++) {
      const target = (l / (LEVELS - 1)) ** 1.15 * max;
      let best = cand[0];
      for (const c of cand) if (Math.abs(ink[c] - target) < Math.abs(ink[best] - target)) best = c;
      ramp.push(best);
    }
    ramp[0] = all.indexOf(' ');
    noiseIdx = Array.from(NOISE).map(c => all.indexOf(c));
  }

  function layout() {
    const r = host.getBoundingClientRect();
    W = Math.round(r.width);
    H = Math.round(r.height);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    buildAtlas();
    cols = Math.ceil(W / cw);
    rows = Math.ceil(H / ch);
    const n = cols * rows;
    base = new Uint8Array(n);
    baseA = new Float32Array(n);
    kind = new Uint8Array(n);
    heat = new Float32Array(n);
    shownG = new Int16Array(n).fill(-1);
    shownA = new Uint8Array(n);
    shownC = new Uint8Array(n);
    wantG = new Int16Array(n).fill(-1);
    resolveAt = new Float32Array(n);
    hot = [];
    twinkles = [];

    const a = anchor.getBoundingClientRect();
    pc0 = Math.round((a.left - r.left) / cw);
    pr0 = Math.round((a.top - r.top) / ch);
    pcols = Math.max(1, Math.round(a.width / cw));
    prows = Math.max(1, Math.round(a.height / ch));
    samplePortrait();
    buildField();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    built = true;
  }

  // 把头像缩到「一格一个像素」（横竖各多采一倍再平均），按亮度挑字
  function samplePortrait() {
    const list: number[] = [];
    if (!img.complete || !img.naturalWidth) { portrait = new Int32Array(0); return; }
    const sw = pcols * 2, sh = prows * 2;
    const off = document.createElement('canvas');
    off.width = sw; off.height = sh;
    const o = off.getContext('2d', { willReadFrequently: true })!;
    o.imageSmoothingQuality = 'high';
    // 图按 contain 放进头像那块。先按像素算，再换成「半格」：格子是竖长的，横竖要分开换算，不然人会被压扁
    const s = Math.min((pcols * cw) / img.naturalWidth, (prows * ch) / img.naturalHeight);
    const dw = img.naturalWidth * s / cw * 2, dh = img.naturalHeight * s / ch * 2;
    o.drawImage(img, (sw - dw) / 2, (sh - dh) / 2, dw, dh);
    const d = o.getImageData(0, 0, sw, sh).data;
    // 每格的亮度（2×2 个采样点平均，按不透明度加权）和不透明度
    const lum = new Float32Array(pcols * prows), alpha = new Float32Array(pcols * prows);
    let lo = 1, hi = 0;
    for (let y = 0; y < prows; y++) for (let x = 0; x < pcols; x++) {
      let L = 0, A = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const p = ((y * 2 + dy) * sw + x * 2 + dx) * 4;
        const al = d[p + 3] / 255;
        L += (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) / 255 * al;
        A += al;
      }
      const k = y * pcols + x;
      alpha[k] = A / 4;
      lum[k] = A > 0 ? L / A : 0;
      if (alpha[k] > 0.5) { lo = Math.min(lo, lum[k]); hi = Math.max(hi, lum[k]); }
    }
    const span = Math.max(0.05, hi - lo);
    const now = performance.now();
    for (let y = 0; y < prows; y++) for (let x = 0; x < pcols; x++) {
      const gx = pc0 + x, gy = pr0 + y;
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
      const k = y * pcols + x;
      if (alpha[k] < 0.08) continue;
      // 深色背景上是亮的字：原图越亮字越浓；浅色背景上反过来（越暗越浓）。亮度先拉满到 0..1，
      // 再留一点底，头发、衣服这些暗处在深色主题下也看得出轮廓
      let v = (lum[k] - lo) / span;
      if (!theme.dark) v = 1 - v;
      v = Math.min(1, Math.max(0, v));
      const dens = alpha[k] * (0.1 + 0.9 * v ** GAMMA);
      const level = Math.round(dens * (LEVELS - 1));
      const i = gy * cols + gx;
      kind[i] = 1;
      base[i] = level;
      baseA[i] = 0.9;
      resolveAt[i] = now + 150 + (y / prows) * INTRO_MS * 0.6 + Math.random() * INTRO_MS * 0.4;
      list.push(i);
    }
    portrait = Int32Array.from(list);
  }

  // 四周的烟：以头像为中心，越远越淡，到一定距离就没有了
  function buildField() {
    const cx = pc0 + pcols / 2, cy = pr0 + prows / 2;
    const reach = Math.max(pcols, prows * (ch / cw)) * 1.15;
    const idx: number[] = [], w: number[] = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (kind[i] === 1) continue;
      const dx = x - cx, dy = (y - cy) * (ch / cw);
      const dist = Math.sqrt(dx * dx + dy * dy) / reach;
      const k = Math.max(0, 1 - dist);
      if (k <= 0.02) continue;
      kind[i] = 2;
      idx.push(i);
      w.push(k * k);
    }
    field = Int32Array.from(idx);
    fieldW = Float32Array.from(w);
  }

  // 值噪声：烟的形状
  function hash(x: number, y: number) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x: number, y: number) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function draw(i: number, g: number, alpha: number, color: number) {
    const qa = Math.round(alpha * 32);
    if (g === ramp[0]) g = -1;
    if (shownG[i] === g && (g < 0 || (shownA[i] === qa && shownC[i] === color))) return;
    shownG[i] = g; shownA[i] = qa; shownC[i] = color;
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(x, y, cw, ch);
    if (g < 0 || qa === 0) return;
    const gw = Math.ceil(cw * dpr), gh = Math.ceil(ch * dpr);
    ctx.globalAlpha = qa / 32;
    ctx.drawImage(atlas!, g * gw, color * gh, gw, gh, x, y, cw, ch);
  }

  function rand<T>(a: T[]) { return a[(Math.random() * a.length) | 0]; }

  // 一格现在该是什么样：被搅着就是乱码，否则是本来的字
  function settle(i: number, now: number) {
    const h = heat[i];
    if (h > 0.04) {
      if (wantG[i] < 0 || Math.random() < h * 0.5) wantG[i] = rand(noiseIdx);
      draw(i, wantG[i], Math.max(baseA[i] * 0.6, Math.min(1, h * 1.3)), h > 0.3 ? 1 : 0);
      return;
    }
    wantG[i] = -1;
    if (kind[i] === 1) {
      if (now < resolveAt[i]) {
        // 开场还没轮到它：快轮到的时候先闪乱码
        if (resolveAt[i] - now < 520) draw(i, rand(noiseIdx), 0.35, 0);
        else draw(i, ramp[0], 0, 0);
        return;
      }
      draw(i, ramp[base[i]], baseA[i], 0);
    } else if (kind[i] === 2) {
      draw(i, ramp[base[i]], baseA[i], 0);
    } else {
      draw(i, ramp[0], 0, 0);
    }
  }

  function stepField(now: number) {
    const t = (now - t0) / 1000;
    for (let j = 0; j < field.length; j++) {
      const i = field[j];
      const x = i % cols, y = (i / cols) | 0;
      // 三层噪声，整体慢慢往上飘（像炭上冒的烟），各层再横着错开一点
      const yy = y * (ch / cw);
      const n = noise(x * 0.045 + t * 0.05, yy * 0.045 + t * 0.32) * 0.55
        + noise(x * 0.1 - t * 0.08, yy * 0.1 + t * 0.5) * 0.3
        + noise(x * 0.23, yy * 0.23 + t * 0.8) * 0.15;
      // 浓的地方字浓、也更不透明，边上是若有若无的点，没有硬边
      const v = Math.min(1, Math.max(0, (n - 0.42) / 0.38)) * fieldW[j];
      base[i] = v < 0.08 ? 0 : 1 + Math.min(2, Math.floor(v * 3));
      baseA[i] = 0.1 + 0.5 * v;
      if (heat[i] <= 0.04) settle(i, now);
    }
  }

  function addHeat(cx: number, cy: number, radius: number, power: number) {
    const ry = radius * (cw / ch);
    const x0 = Math.max(0, Math.floor(cx - radius)), x1 = Math.min(cols - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(rows - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / radius, dy = (y - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= 1) continue;
      const i = y * cols + x;
      if (kind[i] === 0) continue;
      const h = power * (1 - d) ** 0.7;
      if (h > heat[i]) {
        if (heat[i] <= 0.04) hot.push(i);
        heat[i] = h;
      }
    }
  }

  // 点一下荡开的一圈：只画圈上那一两格宽的乱码，圈走过去马上恢复原样（不走热度，不然圈里会糊成一片）
  let ringPrev = new Set<number>();
  function stepRipples(now: number) {
    if (!ripples.length && !ringPrev.size) return;
    ripples = ripples.filter(r => now - r.t0 < RIPPLE_MS);
    const ring = new Map<number, number>();
    const aspect = cw / ch;
    for (const r of ripples) {
      const p = (now - r.t0) / RIPPLE_MS;
      const R = (1 - (1 - p) ** 2) * Math.max(cols, rows / aspect) * 0.6;
      const power = 1 - p;
      const steps = Math.max(16, Math.ceil(R * 7));
      for (let s = 0; s < steps; s++) {
        const ang = (s / steps) * Math.PI * 2;
        for (const dr of [0, 1]) {
          const x = Math.round(r.x + Math.cos(ang) * (R - dr)), y = Math.round(r.y + Math.sin(ang) * (R - dr) * aspect);
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const i = y * cols + x;
          if (kind[i] === 0) continue;
          ring.set(i, Math.max(ring.get(i) ?? 0, power * (dr ? 0.55 : 1)));
        }
      }
    }
    for (const i of ringPrev) if (!ring.has(i) && heat[i] <= 0.04) settle(i, now);
    for (const [i, pw] of ring) {
      if (heat[i] > 0.04) continue;
      draw(i, rand(noiseIdx), Math.max(baseA[i], pw * 0.9), pw > 0.35 ? 1 : 0);
    }
    ringPrev = new Set(ring.keys());
  }

  function stepTwinkles(now: number) {
    twinkles = twinkles.filter(tw => {
      if (now < tw.until) return true;
      settle(tw.i, now);
      return false;
    });
    const n = Math.max(1, Math.round(portrait.length * 0.008));
    for (let k = 0; k < n; k++) {
      const i = portrait[(Math.random() * portrait.length) | 0];
      if (i === undefined || base[i] === 0 || heat[i] > 0.04 || now < resolveAt[i]) continue;
      const g = ramp[Math.max(1, Math.min(LEVELS - 1, base[i] + (Math.random() < 0.5 ? -1 : 1)))];
      draw(i, g, baseA[i], 0);
      twinkles.push({ i, g, until: now + 180 + Math.random() * 320 });
    }
  }

  function stepHeat(now: number) {
    const next: number[] = [];
    for (const i of hot) {
      heat[i] *= HEAT_DECAY;
      if (heat[i] <= 0.04) { heat[i] = 0; settle(i, now); continue; }
      settle(i, now);
      next.push(i);
    }
    hot = next;
  }

  function tick(now: number) {
    raf = 0;
    if (!visible || !built) return;
    schedule();
    const active = introPending || hot.length > 0 || ripples.length > 0 || ringPrev.size > 0;
    if (now - last < 1000 / (active ? FPS : AMBIENT_FPS) - 2) return;
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 开场：每帧过一遍头像的格子，直到全部显出来（中途滚出屏幕停过也一样，回来接着走完）
    if (introPending) {
      let left = 0;
      for (let j = 0; j < portrait.length; j++) {
        const i = portrait[j];
        if (now < resolveAt[i]) left++;
        if (heat[i] <= 0.04) settle(i, now);
      }
      introPending = left > 0;
    }
    // 烟和闪烁按平时的帧率走，被搅动时也不跟着变快
    if (now - lastAmbient >= 1000 / AMBIENT_FPS - 2) {
      lastAmbient = now;
      stepField(now);
      stepTwinkles(now);
    }
    stepRipples(now);
    stepHeat(now);
  }

  function schedule() {
    if (!raf && visible && !reduce.matches) raf = requestAnimationFrame(tick);
  }

  // 一帧静止的：开场直接跳过，烟定在一个样子
  function still() {
    const now = performance.now();
    for (let j = 0; j < portrait.length; j++) resolveAt[portrait[j]] = 0;
    stepField(now);
    for (let j = 0; j < portrait.length; j++) settle(portrait[j], now);
  }

  function rebuild(keepIntro: boolean) {
    layout();
    introPending = true;
    if (keepIntro && !reduce.matches) { schedule(); return; }
    for (let j = 0; j < portrait.length; j++) resolveAt[portrait[j]] = 0;
    if (reduce.matches) still(); else schedule();
  }

  // 鼠标、手指
  function toCell(e: PointerEvent) {
    const r = host.getBoundingClientRect();
    return { x: (e.clientX - r.left) / cw, y: (e.clientY - r.top) / ch };
  }
  host.addEventListener('pointermove', e => {
    if (reduce.matches || !built) return;
    const p = toCell(e);
    addHeat(p.x, p.y, HEAT_RADIUS, 1);
    schedule();
  }, { passive: true });
  host.addEventListener('pointerdown', e => {
    if (reduce.matches || !built) return;
    if ((e.target as Element).closest('a, button')) return;
    const p = toCell(e);
    ripples.push({ ...p, t0: performance.now() });
    schedule();
  }, { passive: true });

  // 只在看得见时动
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && !document.hidden;
    schedule();
  }).observe(host);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    schedule();
  });

  // 换主题：重画图集，整片重画
  const refreshTheme = () => {
    const next = readTheme();
    if (next.ink === theme.ink && next.hot === theme.hot && next.dark === theme.dark) return;
    theme = next;
    rebuild(false);
  };
  new MutationObserver(refreshTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshTheme);
  reduce.addEventListener('change', () => rebuild(false));

  // 尺寸变了重排（手机地址栏收起这种只差几像素的不管）
  let rt = 0, lastW = 0, lastH = 0;
  new ResizeObserver(([e]) => {
    const { width, height } = e.contentRect;
    if (Math.abs(width - lastW) < 2 && Math.abs(height - lastH) < 24) return;
    const first = lastW === 0;
    lastW = width; lastH = height;
    if (first) return;
    clearTimeout(rt);
    rt = window.setTimeout(() => rebuild(false), 150);
  }).observe(host);

  const start = () => {
    t0 = performance.now();
    const r = host.getBoundingClientRect();
    lastW = r.width; lastH = r.height;
    rebuild(true);
  };
  const fontReady = document.fonts?.load(font().css).catch(() => {}) ?? Promise.resolve();
  Promise.all([img.decode().catch(() => {}), fontReady]).then(start);
}
