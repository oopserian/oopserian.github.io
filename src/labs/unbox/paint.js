/* Unboxing 的贴图：礼盒、卡包、五张卡全部用 canvas 现画，没有图片文件。
   每样东西画三张：颜色、金属粗糙（R 镭射遮罩、G 粗糙度、B 金属度，three 的 roughnessMap 读 G、metalnessMap 读 B）、
   高度（纸纹、压凹、锡箔褶皱，转成法线图）。字用 Instrument Serif、Instrument Sans、DM Mono，引擎画之前先等字体到。
   随机数都有种子，每次打开纸纹、褶皱、撕口都一样。 */
export const TAU = Math.PI * 2, DEG = Math.PI / 180;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
/* 可复现的随机数：每次打开页面，纸纹、褶皱、撕口都一样 */
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* ───────── 贴图工具和礼盒的贴图（全部用 canvas 现画） ─────────
   礼盒外面是雾蓝色的哑光纸板，钴蓝油墨；里面（盖子内侧、盒底、内托）是夜空色。 */
export const FS = '"Instrument Serif", "Times New Roman", serif';
export const FA = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif';
export const FM = '"DM Mono", ui-monospace, Menlo, monospace';
export function cv(w, hh) { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(hh); return c; }

/* 在 w×h 的可平铺画布上，把一个形状画在 9 个位置，保证接缝处连续 */
export function wrapDraw(w, hh, x, y, r, fn) {
  for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
    const X = x + ox * w, Y = y + oy * hh;
    if (X + r < 0 || X - r > w || Y + r < 0 || Y - r > hh) continue;
    fn(X, Y);
  }
}
/* 高度图 → 法线图；wrap 为 false 时边上不回绕 */
export function heightToNormal(hgt, w, hh, strength, wrap = true) {
  const c = cv(w, hh), x = c.getContext('2d'), id = x.createImageData(w, hh), d = id.data;
  const H = wrap ? (i, j) => hgt[((j + hh) % hh) * w + ((i + w) % w)] : (i, j) => hgt[clamp(j, 0, hh - 1) * w + clamp(i, 0, w - 1)];
  for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
    const dx = (H(i + 1, j) - H(i - 1, j)) * strength, dy = (H(i, j + 1) - H(i, j - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), k = (j * w + i) * 4;
    d[k] = (-dx / l * 0.5 + 0.5) * 255; d[k + 1] = (dy / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  x.putImageData(id, 0, 0); return c;
}
export function canvasHeight(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, out = new Float32Array(c.width * c.height);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return out;
}

/* 小星环标志 */
export function orbitMark(x, cx, cy, r, lw, col) {
  x.save(); x.strokeStyle = col; x.fillStyle = col; x.lineWidth = lw;
  x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke();
  x.beginPath(); x.ellipse(cx, cy, r * 1.62, r * 0.46, -0.42, 0, TAU); x.stroke();
  x.beginPath(); x.arc(cx + r * 1.24, cy - r * 0.62, lw * 1.6, 0, TAU); x.fill();
  x.restore();
}

/* ───────── 纸板 ───────── */
export const FOG = '#bfc9d6', NIGHT = '#0f1934', COBALT = '#2448d8', TILE_CM = 8, TPX = 512;
/* 可平铺的纸面：底色、很淡的斑驳、纤维、细颗粒 */
export function paintPaper(base, seed, dark) {
  const R = rng(seed), w = TPX, c = cv(w, w), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, w, w);
  for (let i = 0; i < 46; i++) {
    const px = R() * w, py = R() * w, r = 40 + R() * 140, lt = R() < 0.5;
    const col = lt ? '255,255,255' : '0,10,40', a = (dark ? 0.02 : 0.012) + R() * (dark ? 0.03 : 0.014);
    wrapDraw(w, w, px, py, r, (X, Y) => { const g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(X - r, Y - r, r * 2, r * 2); });
  }
  for (let i = 0; i < 1500; i++) {
    const px = R() * w, py = R() * w, len = 2 + R() * 9, ang = R() * Math.PI, lt = R() < 0.55;
    x.strokeStyle = lt ? `rgba(255,255,255,${(dark ? 0.03 : 0.1) + R() * 0.08})` : `rgba(0,12,40,${(dark ? 0.1 : 0.05) + R() * 0.06})`;
    x.lineWidth = 0.5 + R() * 0.6;
    wrapDraw(w, w, px, py, len, (X, Y) => { x.beginPath(); x.moveTo(X - Math.cos(ang) * len / 2, Y - Math.sin(ang) * len / 2); x.lineTo(X + Math.cos(ang) * len / 2, Y + Math.sin(ang) * len / 2); x.stroke(); });
  }
  const id = x.getImageData(0, 0, w, w), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * (dark ? 5 : 7); d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(id, 0, 0);
  return c;
}
/* 纸面的起伏：哑光纸的细橘皮和纤维 */
export function paintPaperHeight(seed, w = 256) {
  const R = rng(seed), c = cv(w, w), x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, w, w);
  for (let i = 0; i < 2200; i++) { const px = R() * w, py = R() * w, r = 0.6 + R() * 1.6; x.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'; wrapDraw(w, w, px, py, r, (X, Y) => { x.beginPath(); x.arc(X, Y, r, 0, TAU); x.fill(); }); }
  for (let i = 0; i < 500; i++) {
    const px = R() * w, py = R() * w, len = 2 + R() * 6, ang = R() * Math.PI;
    x.strokeStyle = R() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.22)'; x.lineWidth = 0.6;
    wrapDraw(w, w, px, py, len, (X, Y) => { x.beginPath(); x.moveTo(X - Math.cos(ang) * len / 2, Y - Math.sin(ang) * len / 2); x.lineTo(X + Math.cos(ang) * len / 2, Y + Math.sin(ang) * len / 2); x.stroke(); });
  }
  return c;
}
export function paperNormal(seed) { const h = paintPaperHeight(seed); return heightToNormal(canvasHeight(h), h.width, h.height, 1.2); }
/* 用平铺纸纹铺满一张 wcm×hcm、每厘米 P 像素的画布 */
export function paperFill(x, wcm, hcm, P, tile) {
  const p = x.createPattern(tile, 'repeat'), k = P * TILE_CM / TPX;
  p.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
  x.fillStyle = p; x.fillRect(0, 0, wcm * P, hcm * P);
}
/* 颜色、金属粗糙（G 粗糙 B 金属）、高度三张图一起画；高度图用来压凹和做纸纹 */
export function triple(wcm, hcm, P, tile, rough) {
  const c = cv(wcm * P, hcm * P), m = cv(wcm * P, hcm * P), hgt = cv(wcm * P, hcm * P);
  const x = c.getContext('2d'), y = m.getContext('2d'), z = hgt.getContext('2d');
  paperFill(x, wcm, hcm, P, tile);
  y.fillStyle = `rgb(0,${Math.round(rough * 255)},0)`; y.fillRect(0, 0, m.width, m.height);
  const ph = z.createPattern(paintPaperHeight(seedOf(tile)), 'repeat'), k = P * TILE_CM / 256;
  ph.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0])); z.fillStyle = ph; z.fillRect(0, 0, hgt.width, hgt.height);
  return { c, m, hgt, x, y, z, P };
}
export const seedOf = tile => (tile.width * 7 + 3) | 0;
export const mr = (rough, metal) => `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`;

/* 盖子正面：压凹的星环标志，钴蓝烫印的字标，下沿一行小字。文字的“上”朝盒子后面 */
export function paintLidTop(wcm, lcm, tile) {
  const P = 64, T = triple(wcm, lcm, P, tile, 0.8), { x, y, z } = T, cx = wcm / 2 * P;
  // 压凹：在高度图上画暗（低），再在颜色上加一点点阴影感
  z.save(); z.filter = 'blur(2.2px)'; orbitMark(z, cx, lcm * 0.39 * P, 1.55 * P, 0.11 * P, '#3a3a3a'); z.restore();
  x.save(); x.globalAlpha = 0.07; orbitMark(x, cx, lcm * 0.39 * P, 1.55 * P, 0.11 * P, '#0a1a4a'); x.restore();
  // 烫印字标
  const word = (g, col) => { g.save(); g.fillStyle = col; g.font = `italic ${1.42 * P}px ${FS}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('Night Atlas', cx, lcm * 0.6 * P); g.restore(); };
  word(x, COBALT); word(y, mr(0.3, 1));
  z.save(); z.filter = 'blur(1px)'; word(z, '#5c5c5c'); z.restore();
  const small = (str, col, s, Y, ls) => { x.save(); x.fillStyle = col; x.font = `500 ${s * P}px ${FM}`; x.letterSpacing = `${ls * P}px`; x.textAlign = 'center'; x.fillText(str, cx, Y * P); x.restore(); };
  small('SERIES 01  ·  FIVE CARDS', COBALT, 0.27, lcm * 0.6 + 0.95, 0.08);
  small('A FIELD GUIDE TO THE NIGHT SKY', 'rgba(36,72,216,0.75)', 0.23, lcm - 1.25, 0.11);
  return T;
}
/* 盖子内侧：一张星图（极投影的赤经赤纬网、恒星按星等画大小、猎户座连线），银色油墨 */
export function paintLidInside(wcm, lcm) {
  const P = 64, w = wcm * P, hh = lcm * P, c = cv(w, hh), m = cv(w, hh), x = c.getContext('2d'), y = m.getContext('2d'), R = rng(1937);
  x.fillStyle = NIGHT; x.fillRect(0, 0, w, hh);
  const vg = x.createRadialGradient(w / 2, hh * 0.46, 0, w / 2, hh * 0.46, hh * 0.7); vg.addColorStop(0, 'rgba(40,60,120,0.35)'); vg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = vg; x.fillRect(0, 0, w, hh);
  y.fillStyle = mr(0.72, 0); y.fillRect(0, 0, w, hh);
  const ink = 'rgba(205,214,232,', both = (fn) => { fn(x, false); fn(y, true); };
  const cx = w / 2, cy = hh * 0.46, Rr = Math.min(w, hh) * 0.4;
  both((g, isM) => {
    g.save(); g.lineWidth = 0.022 * P; g.strokeStyle = isM ? mr(0.35, 1) : ink + '0.42)';
    for (let k = 1; k <= 4; k++) { g.beginPath(); g.arc(cx, cy, Rr * k / 4, 0, TAU); g.stroke(); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a) * Rr * 0.25, cy + Math.sin(a) * Rr * 0.25); g.lineTo(cx + Math.cos(a) * Rr, cy + Math.sin(a) * Rr); g.stroke(); }
    g.lineWidth = 0.04 * P; g.beginPath(); g.arc(cx, cy, Rr, 0, TAU); g.stroke();
    // 黄道：一条虚线斜穿
    g.setLineDash([0.14 * P, 0.12 * P]); g.lineWidth = 0.024 * P; g.beginPath(); g.ellipse(cx, cy + Rr * 0.12, Rr * 0.98, Rr * 0.5, -0.32, Math.PI * 0.05, Math.PI * 0.95); g.stroke(); g.setLineDash([]);
    g.restore();
  });
  // 星
  const star = (sx, sy, mag) => {
    const r = (0.115 - mag * 0.018) * P;
    both((g, isM) => { g.fillStyle = isM ? mr(0.25, 1) : '#eef1f8'; g.beginPath(); g.arc(sx, sy, Math.max(0.02 * P, r), 0, TAU); g.fill(); });
    if (mag < 1.2) { const gl = x.createRadialGradient(sx, sy, 0, sx, sy, r * 4); gl.addColorStop(0, 'rgba(200,215,255,0.35)'); gl.addColorStop(1, 'rgba(200,215,255,0)'); x.fillStyle = gl; x.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8); }
  };
  for (let i = 0; i < 260; i++) { const a = R() * TAU, rr = Math.sqrt(R()) * Rr * 0.985; star(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3.6 + R() * 2.4); }
  // 猎户座（大致的相对位置）
  const O = [[-1.05, -1.6, 0.5], [0.95, -1.38, 1.6], [-0.18, 0.02, 1.7], [0.12, -0.12, 1.7], [0.42, -0.26, 2.2], [-0.82, 1.5, 2.1], [1.12, 1.72, 0.2], [-0.02, -2.2, 3.4]];
  const ox = cx + Rr * 0.18, oy = cy - Rr * 0.06, sc = 0.95 * P;
  const pt = i => [ox + O[i][0] * sc, oy + O[i][1] * sc];
  both((g, isM) => {
    g.save(); g.strokeStyle = isM ? mr(0.3, 1) : ink + '0.7)'; g.lineWidth = 0.028 * P;
    for (const [a, b] of [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [1, 7]]) { const [ax, ay] = pt(a), [bx, by] = pt(b); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
    g.restore();
  });
  O.forEach((s, i) => star(...pt(i), s[2]));
  // 字
  const txt = (s, X, Y, font, align = 'left', ls = 0) => both((g, isM) => { g.save(); g.fillStyle = isM ? mr(0.35, 1) : ink + '0.85)'; g.font = font; g.textAlign = align; g.letterSpacing = `${ls * P}px`; g.fillText(s, X, Y); g.restore(); });
  const mono = `500 ${0.24 * P}px ${FM}`;
  txt('WINTER SKY', 0.9 * P, 1.25 * P, mono, 'left', 0.06);
  txt('LAT 40° N', w - 0.9 * P, 1.25 * P, mono, 'right', 0.06);
  txt('ORION', ox + 1.35 * P, oy + 0.15 * P, `500 ${0.2 * P}px ${FM}`, 'left', 0.08);
  for (const [k, lab] of [[0, '0h'], [3, '6h'], [6, '12h'], [9, '18h']]) { const a = k / 12 * TAU; txt(lab, cx + Math.cos(a) * (Rr + 0.42 * P), cy + Math.sin(a) * (Rr + 0.42 * P) + 0.08 * P, `500 ${0.2 * P}px ${FM}`, 'center'); }
  txt('Clear skies.', w / 2, hh - 1.35 * P, `italic ${0.72 * P}px ${FS}`, 'center');
  return { c, m };
}
/* 盒子正面下半截露出来的一条：左边编号，右边品牌，钴蓝小字 */
export function paintBaseFront(wcm, hcm, tile) {
  const P = 64, T = triple(wcm, hcm, P, tile, 0.8), { x } = T;
  x.save(); x.fillStyle = 'rgba(36,72,216,0.82)'; x.font = `500 ${0.22 * P}px ${FM}`; x.letterSpacing = `${0.1 * P}px`; x.textBaseline = 'alphabetic';
  x.fillText('Nº 01', 0.75 * P, (hcm - 0.72) * P);
  x.textAlign = 'right'; x.fillText('NIGHT ATLAS', (wcm - 0.75) * P, (hcm - 0.72) * P);
  x.restore();
  return T;
}
/* 右侧面：一个小星环和一行字 */
export function paintBaseSide(wcm, hcm, tile) {
  const P = 64, T = triple(wcm, hcm, P, tile, 0.8), { x } = T;
  orbitMark(x, 1.2 * P, (hcm - 1.05) * P, 0.26 * P, 0.045 * P, 'rgba(36,72,216,0.8)');
  x.save(); x.fillStyle = 'rgba(36,72,216,0.8)'; x.font = `500 ${0.2 * P}px ${FM}`; x.letterSpacing = `${0.1 * P}px`;
  x.fillText('SERIES 01  ·  FIVE CARDS', 2.0 * P, (hcm - 0.98) * P); x.restore();
  return T;
}
/* 撕拉条：钴蓝，两边一排齿孔，白字。起头 tab 厘米是圆角拉手（用透明挖掉两个角） */
export function paintZip(lcm, wcm, tab) {
  const P = 64, w = lcm * P, hh = wcm * P, c = cv(w, hh), x = c.getContext('2d');
  x.fillStyle = COBALT; x.fillRect(0, 0, w, hh);
  const g = x.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,30,0.12)'); x.fillStyle = g; x.fillRect(0, 0, w, hh);
  x.fillStyle = 'rgba(255,255,255,0.35)';
  for (let X = tab * P; X < w; X += 0.22 * P) { x.fillRect(X, 0.05 * P, 0.1 * P, 0.035 * P); x.fillRect(X, hh - 0.085 * P, 0.1 * P, 0.035 * P); }
  x.fillStyle = '#ffffff'; x.textBaseline = 'middle'; x.font = `600 ${0.3 * P}px ${FM}`; x.letterSpacing = `${0.12 * P}px`;
  x.fillText('PULL', 0.16 * P, hh / 2 + 1);
  x.font = `500 ${0.24 * P}px ${FM}`; x.letterSpacing = `${0.14 * P}px`;
  for (let X = (tab + 1.4) * P; X < w - 3 * P; X += 5.6 * P) { x.fillText('TEAR TO OPEN  →', X, hh / 2 + 1); }
  // 拉手的圆角
  x.save(); x.globalCompositeOperation = 'destination-out'; const r = 0.32 * P;
  x.beginPath(); x.moveTo(0, 0); x.lineTo(r, 0); x.arc(r, r, r, -Math.PI / 2, Math.PI, true); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(0, hh); x.lineTo(0, hh - r); x.arc(r, hh - r, r, Math.PI, Math.PI / 2, true); x.closePath(); x.fill();
  x.restore();
  return c;
}

/* ───────── 卡包贴图：锡箔印刷、金属/粗糙/镭射通道、褶皱法线 ─────────
   卡包本地坐标：x 横向、y 竖向（上为正）、z 朝前。单位厘米。
   金属粗糙图三个通道：R = 镭射遮罩，G = 粗糙度，B = 金属度（three 的 roughnessMap 读 G，metalnessMap 读 B） */
export const PACK = { W: 7.4, H: 12, crimp: 1.0, strip: 1.45, Z: 0.27, P: 128 };
PACK.tearY = PACK.H / 2 - PACK.strip;

/* 撕口的参差：一条平滑过的随机游走，左端起头处是个 V 形缺口 */
export const JAG = (() => {
  const R = rng(4242), n = 240, a = new Float32Array(n + 1);
  let v = 0, d = 0;
  for (let i = 0; i <= n; i++) { d = d * 0.82 + (R() - 0.5) * 0.05; v = v * 0.93 + d; a[i] = v; }
  // 再叠一层细碎的锯齿，撕铝箔的口子不会是光滑的
  for (let i = 0; i <= n; i++) a[i] += (R() - 0.5) * 0.026;
  return a;
})();
export function tearJag(x) {
  const u = clamp((x + PACK.W / 2) / PACK.W) * (JAG.length - 1), i = Math.floor(u), f = u - i;
  const v = lerp(JAG[i], JAG[Math.min(JAG.length - 1, i + 1)], f);
  return clamp(v, -0.09, 0.09) * smooth(clamp((x + PACK.W / 2) / 0.25));
}

export const NAVY = '#0c1838', NAVY2 = '#09122b', SILVER = '#d7dbe4', WHITE_INK = '#f3f1ea';
/* 在颜色图和金属粗糙图上同时画：col 是颜色，mr 是 [镭射, 粗糙, 金属] */
export function dual(c, m) {
  const x = c.getContext('2d'), y = m.getContext('2d');
  const mr = (h, r, me) => `rgb(${Math.round(h * 255)},${Math.round(r * 255)},${Math.round(me * 255)})`;
  return {
    x, y,
    fill(col, holo, rough, metal, fn) { x.fillStyle = col; y.fillStyle = mr(holo, rough, metal); fn(x); fn(y); },
    stroke(col, holo, rough, metal, lw, fn) { x.strokeStyle = col; y.strokeStyle = mr(holo, rough, metal); x.lineWidth = y.lineWidth = lw; fn(x); fn(y); },
    text(col, holo, rough, metal, font, str, X, Y, opts = {}) {
      for (const g of [x, y]) {
        g.save(); g.font = font; g.textAlign = opts.align || 'left'; g.textBaseline = opts.base || 'alphabetic';
        g.letterSpacing = opts.ls || '0px';
        g.fillStyle = g === x ? col : mr(holo, rough, metal); g.fillText(str, X, Y); g.restore();
      }
    },
  };
}
export function starField(d, P, R, x0, y0, w, hh, n, avoid) {
  for (let i = 0; i < n; i++) {
    const sx = x0 + R() * w, sy = y0 + R() * hh;
    if (avoid && avoid(sx, sy)) continue;
    const r = (R() < 0.85 ? 0.018 + R() * 0.02 : 0.04 + R() * 0.03) * P;
    d.fill(SILVER, 1, 0.15, 1, g => { g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill(); });
  }
}
/* 封口的锯齿边和撕口缺口：在两张图上一起挖掉 */
export function cutEdges(c, m, mirror) {
  const P = PACK.P, w = c.width, hh = c.height, tooth = 0.24 * P, depth = 0.11 * P;
  for (const g of [c.getContext('2d'), m.getContext('2d')]) {
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    for (const top of [true, false]) {
      g.beginPath();
      const Y = top ? 0 : hh, s = top ? 1 : -1;
      g.moveTo(-1, Y - s);
      for (let X = 0; X <= w + tooth; X += tooth) { g.lineTo(X, Y - s); g.lineTo(X + tooth / 2, Y + s * depth); }
      g.lineTo(w + 1, Y - s); g.closePath(); g.fill();
    }
    // V 形缺口，在撕口线的左端（背面看在右端）
    const ny = (PACK.H / 2 - PACK.tearY) * P, nx = mirror ? w : 0, dir = mirror ? -1 : 1;
    g.beginPath(); g.moveTo(nx - dir, ny - 0.13 * P); g.lineTo(nx + dir * 0.2 * P, ny); g.lineTo(nx - dir, ny + 0.13 * P); g.closePath(); g.fill();
    g.restore();
  }
}
export function crimpBands(d, P, w, hh, col) {
  const c = PACK.crimp * P;
  d.fill(col, 0.25, 0.26, 0.92, g => { g.fillRect(0, 0, w, c); g.fillRect(0, hh - c, w, c); });
  // 封口和袋身之间一道压痕
  d.fill('rgba(0,0,0,0.35)', 0, 0.4, 0.9, g => { g.fillRect(0, c - 0.02 * P, w, 0.03 * P); g.fillRect(0, hh - c - 0.01 * P, w, 0.03 * P); });
}

export function paintPackFront() {
  const P = PACK.P, w = PACK.W * P, hh = PACK.H * P;
  const c = cv(w, hh), m = cv(w, hh), d = dual(c, m), R = rng(808);
  // 底：深海军蓝油墨压在铝箔上
  const gr = d.x.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, '#0f1d45'); gr.addColorStop(0.55, NAVY); gr.addColorStop(1, NAVY2);
  d.x.fillStyle = gr; d.x.fillRect(0, 0, w, hh);
  d.y.fillStyle = 'rgb(0,96,184)'; d.y.fillRect(0, 0, w, hh);
  crimpBands(d, P, w, hh, '#13224c');
  const cx = w / 2, cy = hh * 0.44;
  // 镭射圆盘：标志后面一圈淡淡的彩虹
  d.x.save(); const hg = d.x.createRadialGradient(cx, cy, 0, cx, cy, 2.3 * P); hg.addColorStop(0, 'rgba(70,95,170,0.55)'); hg.addColorStop(1, 'rgba(70,95,170,0)'); d.x.fillStyle = hg; d.x.fillRect(0, 0, w, hh); d.x.restore();
  d.y.save(); const hm = d.y.createRadialGradient(cx, cy, 0, cx, cy, 2.3 * P); hm.addColorStop(0, 'rgba(150,60,240,1)'); hm.addColorStop(1, 'rgba(0,84,214,0)'); d.y.fillStyle = hm; d.y.fillRect(0, 0, w, hh); d.y.restore();
  // 星星
  starField(d, P, R, 0.45 * P, (PACK.crimp + PACK.strip + 0.15) * P, w - 0.9 * P, hh - (2 * PACK.crimp + PACK.strip + 0.4) * P, 120, (x, y) => Math.hypot(x - cx, y - cy) < 2.05 * P || (y > hh * 0.62 && y < hh * 0.79));
  // 银色细框
  const fi = 0.34 * P, ft = (PACK.crimp + PACK.strip + 0.22) * P, fb = hh - (PACK.crimp + 0.28) * P;
  d.stroke(SILVER, 1, 0.16, 1, 0.022 * P, g => { g.strokeRect(fi, ft, w - 2 * fi, fb - ft); });
  // 星环标志：两道圆、一道斜椭圆轨道、一颗行星
  d.stroke(SILVER, 1, 0.14, 1, 0.03 * P, g => {
    g.beginPath(); g.arc(cx, cy, 1.55 * P, 0, TAU); g.stroke();
    g.beginPath(); g.arc(cx, cy, 1.18 * P, 0, TAU); g.stroke();
    g.save(); g.translate(cx, cy); g.rotate(-0.42); g.beginPath(); g.ellipse(0, 0, 2.05 * P, 0.62 * P, 0, 0, TAU); g.restore(); g.stroke();
  });
  d.fill(SILVER, 1, 0.12, 1, g => { g.beginPath(); g.arc(cx, cy, 0.62 * P, 0, TAU); g.fill(); });
  d.fill(SILVER, 1, 0.12, 1, g => { g.beginPath(); g.arc(cx + 1.6 * P, cy - 0.93 * P, 0.1 * P, 0, TAU); g.fill(); });
  // 行星上的阴影（白墨，压低金属感）
  d.fill('rgba(12,24,56,0.85)', 0, 0.4, 0.6, g => { g.beginPath(); g.arc(cx + 0.2 * P, cy + 0.14 * P, 0.5 * P, 0, TAU); g.fill(); });
  // 字
  const sc = `500 ${0.205 * P}px ${FA}`, ls = `${0.05 * P}px`;
  d.text(WHITE_INK, 0, 0.55, 0, `italic ${1.22 * P}px ${FS}`, 'Night Atlas', cx, hh * 0.705, { align: 'center' });
  d.text('rgba(243,241,234,0.78)', 0, 0.55, 0, `500 ${0.19 * P}px ${FA}`, 'A FIELD GUIDE TO THE NIGHT SKY', cx, hh * 0.705 + 0.62 * P, { align: 'center', ls: `${0.06 * P}px` });
  d.text(WHITE_INK, 0, 0.55, 0, sc, 'SERIES 01', fi + 0.3 * P, ft + 0.52 * P, { ls });
  d.text(WHITE_INK, 0, 0.55, 0, sc, '5 CARDS', w - fi - 0.3 * P, ft + 0.52 * P, { ls, align: 'right' });
  d.text(SILVER, 1, 0.16, 1, `500 ${0.2 * P}px ${FM}`, 'No. 0417', fi + 0.3 * P, fb - 0.32 * P, { ls: `${0.02 * P}px` });
  d.fill(SILVER, 1, 0.16, 1, g => { for (let k = 0; k < 3; k++) { const X = w - fi - 0.42 * P - k * 0.3 * P, Y = fb - 0.4 * P; g.beginPath(); g.moveTo(X, Y - 0.09 * P); g.lineTo(X + 0.09 * P, Y); g.lineTo(X, Y + 0.09 * P); g.lineTo(X - 0.09 * P, Y); g.closePath(); g.fill(); } });
  // 撕条上：起头处的箭头和字
  const sy = (PACK.crimp + PACK.strip * 0.55) * P;
  d.text(WHITE_INK, 0, 0.55, 0, `600 ${0.17 * P}px ${FA}`, 'TEAR', 0.42 * P, sy + 0.06 * P, { ls: `${0.07 * P}px` });
  d.stroke(WHITE_INK, 0, 0.55, 0, 0.02 * P, g => { g.beginPath(); g.moveTo(1.28 * P, sy); g.lineTo(1.9 * P, sy); g.moveTo(1.8 * P, sy - 0.08 * P); g.lineTo(1.9 * P, sy); g.lineTo(1.8 * P, sy + 0.08 * P); g.stroke(); });
  // 撕口线：一排很淡的点
  d.fill('rgba(215,219,228,0.35)', 0.4, 0.2, 1, g => { for (let X = 0.3 * P; X < w - 0.2 * P; X += 0.16 * P) { g.fillRect(X, (PACK.H / 2 - PACK.tearY) * P - 0.008 * P, 0.07 * P, 0.016 * P); } });
  cutEdges(c, m, false);
  return { c, m };
}

export function paintPackBack() {
  const P = PACK.P, w = PACK.W * P, hh = PACK.H * P;
  const c = cv(w, hh), m = cv(w, hh), d = dual(c, m), R = rng(909);
  const gr = d.x.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, '#0d1a3f'); gr.addColorStop(1, '#08112a');
  d.x.fillStyle = gr; d.x.fillRect(0, 0, w, hh);
  d.y.fillStyle = 'rgb(0,90,210)'; d.y.fillRect(0, 0, w, hh);
  crimpBands(d, P, w, hh, '#13224c');
  // 背封：中间一条压平的竖封边
  const fw = 0.95 * P, fx = w / 2 - fw / 2;
  d.fill('#142555', 0.15, 0.28, 0.92, g => g.fillRect(fx, 0, fw, hh));
  d.fill('rgba(0,0,0,0.4)', 0, 0.4, 0.9, g => { g.fillRect(fx - 0.02 * P, 0, 0.03 * P, hh); });
  d.fill('rgba(255,255,255,0.08)', 0, 0.3, 0.9, g => { g.fillRect(fx + fw - 0.01 * P, 0, 0.02 * P, hh); });
  starField(d, P, R, 0.4 * P, (PACK.crimp + PACK.strip + 0.2) * P, w - 0.8 * P, 3.0 * P, 40, (x) => Math.abs(x - w / 2) < fw);
  // 白墨小字
  const L = 0.5 * P, top = hh * 0.6;
  d.text(WHITE_INK, 0, 0.55, 0, `italic ${0.42 * P}px ${FS}`, 'Night Atlas', L, top, {});
  const lines = ['Series 01 · five cards', 'Moon, comet, ringed giant,', 'a constellation and', 'one card that glows.'];
  lines.forEach((t, i) => d.text('rgba(243,241,234,0.82)', 0, 0.55, 0, `400 ${0.18 * P}px ${FA}`, t, L, top + (0.42 + i * 0.27) * P, {}));
  // 条形码
  const bx = w - 2.75 * P, by = hh - (PACK.crimp + 1.75) * P, bw = 2.3 * P, bh = 1.25 * P;
  d.fill('#f4f3ef', 0, 0.5, 0, g => g.fillRect(bx, by, bw, bh));
  let X = bx + 0.15 * P;
  while (X < bx + bw - 0.2 * P) { const t = (R() < 0.5 ? 1 : R() < 0.6 ? 2 : 3) * 0.028 * P; d.fill('#111', 0, 0.5, 0, g => g.fillRect(X, by + 0.14 * P, t, bh - 0.46 * P)); X += t + (1 + Math.floor(R() * 2.4)) * 0.028 * P; }
  d.text('#111', 0, 0.5, 0, `500 ${0.15 * P}px ${FM}`, '4 017 2611 08 3', bx + bw / 2, by + bh - 0.1 * P, { align: 'center' });
  // 撕条：背面看起头在右边
  const sy = (PACK.crimp + PACK.strip * 0.55) * P;
  d.text(WHITE_INK, 0, 0.55, 0, `600 ${0.17 * P}px ${FA}`, 'TEAR HERE', w - 0.42 * P, sy + 0.06 * P, { align: 'right', ls: `${0.07 * P}px` });
  d.fill('rgba(215,219,228,0.35)', 0.4, 0.2, 1, g => { for (let X2 = 0.2 * P; X2 < w - 0.3 * P; X2 += 0.16 * P) g.fillRect(X2, (PACK.H / 2 - PACK.tearY) * P - 0.008 * P, 0.07 * P, 0.016 * P); });
  cutEdges(c, m, true);
  return { c, m };
}

/* 褶皱：很多条随机的折痕（多数接近横向，四角有放射状的斜纹），封口处密密的横向压纹 */
export function paintPackNormal(seed, back) {
  const P = 64, w = Math.round(PACK.W * P), hh = Math.round(PACK.H * P), R = rng(seed);
  const H = new Float32Array(w * hh);
  const crease = (cx, cy, ang, len, amp, wd) => {
    const ca = Math.cos(ang), sa = Math.sin(ang), r = len / 2 + wd;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(hh - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, t = dx * ca + dy * sa, d = -dx * sa + dy * ca;
      if (Math.abs(t) > len / 2 || Math.abs(d) > wd) continue;
      const taper = Math.cos(t / (len / 2) * Math.PI / 2);
      H[y * w + x] += amp * (1 - Math.abs(d) / wd) * taper;
    }
  };
  const bodyT = PACK.crimp * P, bodyB = hh - PACK.crimp * P;
  for (let i = 0; i < 70; i++) {
    const diag = R() < 0.35;
    const ang = diag ? (R() < 0.5 ? 1 : -1) * (0.5 + R() * 0.5) : (R() - 0.5) * 0.6;
    crease(R() * w, bodyT + R() * (bodyB - bodyT), ang, (1.2 + R() * 3.6) * P, (R() < 0.5 ? -1 : 1) * (0.3 + R() * 0.7), (0.06 + R() * 0.16) * P);
  }
  // 四角放射纹：封口把袋子扯紧的地方
  for (const [cx, cy, s] of [[0, bodyT, 1], [w, bodyT, -1], [0, bodyB, -1], [w, bodyB, 1]]) {
    for (let k = 0; k < 6; k++) {
      const ang = s * (0.35 + k * 0.17 + R() * 0.08) * (cy === bodyT ? 1 : -1);
      const len = (0.8 + R() * 1.6) * P, ox = (cx === 0 ? 1 : -1) * (0.3 + k * 0.25) * P;
      crease(cx + ox + Math.cos(ang) * len * 0.4 * (cx === 0 ? 1 : -1), cy + (cy === bodyT ? 1 : -1) * (0.25 + R() * 0.4) * P, ang, len, 0.5 + R() * 0.4, 0.07 * P);
    }
  }
  // 大的起伏
  for (let i = 0; i < 9; i++) {
    const cx = R() * w, cy = bodyT + R() * (bodyB - bodyT), r = (1 + R() * 1.5) * P, a = (R() - 0.5) * 1.6;
    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(hh, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(w, cx + r); x++) {
      const q = ((x - cx) ** 2 + (y - cy) ** 2) / (r * r); if (q < 1) H[y * w + x] += a * (1 - q) * (1 - q);
    }
  }
  // 封口压纹；背面中间的竖封边也有压纹
  const per = 0.11 * P;
  for (let y = 0; y < hh; y++) {
    const inCrimp = y < bodyT || y > bodyB;
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (inCrimp) H[k] = 0.55 * Math.sin(y / per * TAU);
      else if (back && Math.abs(x - w / 2) < 0.47 * P) H[k] = H[k] * 0.3 + 0.35 * Math.sin(x / per * TAU) + 0.6;
      H[k] += (R() - 0.5) * 0.06;
    }
  }
  return heightToNormal(H, w, hh, 0.9);
}

/* ───────── 卡面：「星空图鉴」——米白棉纸上印深蓝，中间一个目镜视野，插图是点刻版画 ─────────
   6.3 × 8.8 cm，每厘米 160px。三张图：颜色、金属粗糙（R 镭射 / G 粗糙 / B 金属）、高度（纸纹、目镜压凹）。
   普通卡：纸面哑光，深蓝油墨略有光泽，刻度环和稀有度星是钴蓝烫箔（带一点幻彩）。
   闪卡：黑色触感纸，日冕、刻度环和字都是银色镭射箔。 */
export const CARD = { W: 6.3, H: 8.8, R: 0.32, P: 160, T: 0.028 };
export const CARDS = [
  { no: '01', title: 'Waxing Gibbous', kicker: 'THE MOON  ·  78 % LIT', data: [['ILLUM.', '78 %'], ['MAG', '−11.8'], ['DIST', '384 400 km']], desc: ['Three days short of full, lit from the west.', 'Rises in the middle of the afternoon.'], fov: 'FOV 0.7°', bar: '5′', art: artMoon },
  { no: '02', title: 'Long-Period Comet', kicker: 'COMET  ·  OORT CLOUD', data: [['PERIOD', '≈ 2 400 yr'], ['MAG', '4.5'], ['TAIL', '0.3 AU']], desc: ['Its tail points away from the Sun,', 'whichever way it happens to travel.'], fov: 'FOV 6°', bar: '30′', art: artComet },
  { no: '03', title: 'Ringed Giant', kicker: 'PLANET  ·  GAS GIANT', data: [['MAG', '0.6'], ['DIST', '9.5 AU'], ['RINGS', '282 000 km']], desc: ['Rings of ice and dust, wider than', 'the planet and only metres thick.'], fov: 'FOV 50″', bar: '10″', art: artRinged },
  { no: '04', title: 'Lyra', kicker: 'CONSTELLATION  ·  THE LYRE', data: [['RA', '18h 51m'], ['DEC', '+36°'], ['VEGA', 'mag 0.03']], desc: ['Vega, its brightest star, becomes', 'the pole star in about 12 000 years.'], fov: 'FOV 9°', bar: '1°', art: artLyra },
  { no: '05', title: 'Totality', kicker: 'TOTAL SOLAR ECLIPSE', data: [['LONGEST', '7 m 32 s'], ['PATH', '≤ 267 km'], ['SHADOW', '1 700 km/h']], desc: ['The Moon is 400 times smaller than', 'the Sun, and 400 times closer.'], fov: 'FOV 2°', bar: '10′', art: artEclipse, rare: true },
];
export const IVORY = '#f2efe6', CNAVY = '#0d1531';
export const PAPER = '#ece7db', INK = '#151d3c', LITE = '#f0e9d8';

export function roundRectPath(g, x, y, w, hh, r) { g.beginPath(); g.roundRect(x, y, w, hh, r); }
export const nrm3 = v => { const l = Math.hypot(...v); return v.map(a => a / l); };

/* 点刻：六角格上抖一点，每个点的半径跟亮度的平方根走；亮到 1 时点和点连成一片 */
export function stipple(g, R, cx, cy, r, step, bright, col, k = 0.6) {
  g.fillStyle = col;
  const dy = step * 0.866, rows = Math.ceil(2 * r / dy);
  for (let j = 0; j <= rows; j++) {
    const y = -r + j * dy, off = (j % 2) * step / 2;
    for (let x = -r + off; x <= r; x += step) {
      const px = x + (R() - 0.5) * step * 0.45, py = y + (R() - 0.5) * step * 0.45;
      if (px * px + py * py > r * r) continue;
      const b = bright(px / r, py / r);
      if (b < 0.012) continue;
      const rr = step * k * Math.sqrt(Math.min(1, b));
      if (rr < 0.32) continue;
      g.beginPath(); g.arc(cx + px, cy + py, rr, 0, TAU); g.fill();
    }
  }
}
/* 网点：像印刷品那样的 45° 余弦网屏。亮度从 0 到 1，先是小点，长大连成片，最后只剩小孔；逐像素算，带抗锯齿，
   所以亮面边缘是干净的圆，不会像随机点刻那样糊成一团。bright(u, v) 里 u、v 是除以半径以后的坐标（v 向下） */
export function halftone(g, cx, cy, r, step, bright, col, ang = 45 * DEG) {
  const n = Math.ceil(r) + 2, S = n * 2, c = cv(S, S), x = c.getContext('2d'), id = x.createImageData(S, S), d = id.data;
  const ca = Math.cos(ang), sa = Math.sin(ang), k = TAU / step;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const px = i + 0.5 - n, py = j + 0.5 - n, edge = clamp(r - Math.hypot(px, py) + 0.5);
    if (edge <= 0) continue;
    const b = clamp(bright(px / r, py / r)); if (b < 0.004) continue;
    const X = (px * ca + py * sa) * k, Y = (py * ca - px * sa) * k;
    const f = 0.5 * (Math.cos(X) + Math.cos(Y)), gr = 0.5 * k * Math.hypot(Math.sin(X), Math.sin(Y)) + 0.04;
    const q = (j * S + i) * 4; d[q] = col[0]; d[q + 1] = col[1]; d[q + 2] = col[2]; d[q + 3] = 255 * edge * clamp(0.5 + (f - 1 + 2 * b) / gr);
  }
  x.putImageData(id, 0, 0); g.drawImage(c, cx - n, cy - n);
}
export const LITE3 = [240, 233, 216];
/* 视野里的星：大多是针尖，少数亮的带一个细十字 */
export function fieldStars(g, R, cx, cy, r, n, P, avoid) {
  for (let k = 0; k < n; k++) {
    const a = R() * TAU, q = Math.sqrt(R()) * r * 0.97, X = cx + Math.cos(a) * q, Y = cy + Math.sin(a) * q;
    if (avoid && avoid(X, Y)) continue;
    const big = R() < 0.06, rad = big ? 0.017 * P : (0.0035 + R() * 0.0075) * P;
    g.fillStyle = `rgba(240,233,216,${big ? 0.95 : 0.35 + R() * 0.6})`;
    g.beginPath(); g.arc(X, Y, rad, 0, TAU); g.fill();
    if (big) { g.strokeStyle = 'rgba(240,233,216,0.55)'; g.lineWidth = 0.6; const l = 0.09 * P; g.beginPath(); g.moveTo(X - l, Y); g.lineTo(X + l, Y); g.moveTo(X, Y - l); g.lineTo(X, Y + l); g.stroke(); }
  }
}
/* 纸：颜色上撒细斑和纤维，高度上撒纸纹 */
export function cardGrain(x, z, w, hh, R, dark) {
  for (let k = 0; k < 6000; k++) {
    const px = R() * w, py = R() * hh, s = 0.8 + R() * 1.3;
    x.fillStyle = dark ? `rgba(255,255,255,${0.015 + R() * 0.03})` : R() < 0.5 ? `rgba(96,78,48,${0.025 + R() * 0.05})` : `rgba(255,255,255,${0.05 + R() * 0.08})`;
    x.fillRect(px, py, s, s);
  }
  x.lineCap = 'round';
  for (let k = 0; k < 700; k++) {
    const px = R() * w, py = R() * hh, l = 4 + R() * 12, a = R() * Math.PI;
    x.strokeStyle = dark ? `rgba(255,255,255,${0.02 + R() * 0.03})` : `rgba(110,90,60,${0.03 + R() * 0.05})`; x.lineWidth = 0.6;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + (R() - 0.5) * 3, py + Math.sin(a) * l * 0.5 + (R() - 0.5) * 3, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  for (let k = 0; k < 14000; k++) {
    const px = R() * w, py = R() * hh, r = 0.7 + R() * 1.6;
    z.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
    z.beginPath(); z.arc(px, py, r, 0, TAU); z.fill();
  }
}
/* 四角星（稀有度） */
export function starGlyph(g, X, Y, s) { g.beginPath(); g.moveTo(X, Y - s); g.quadraticCurveTo(X, Y, X + s, Y); g.quadraticCurveTo(X, Y, X, Y + s); g.quadraticCurveTo(X, Y, X - s, Y); g.quadraticCurveTo(X, Y, X, Y - s); g.closePath(); g.fill(); }

export function paintCardFront(i) {
  const D = CARDS[i], P = CARD.P, w = Math.round(CARD.W * P), hh = Math.round(CARD.H * P);
  const c = cv(w, hh), m = cv(w, hh), hgt = cv(w, hh), d = dual(c, m), R = rng(1000 + i * 77), rare = !!D.rare;
  const z = hgt.getContext('2d'); z.fillStyle = '#808080'; z.fillRect(0, 0, w, hh);
  const ink = rare ? '#e4e6ed' : INK, sub = rare ? 'rgba(228,230,237,0.62)' : 'rgba(21,29,60,0.64)', faint = rare ? 'rgba(228,230,237,0.26)' : 'rgba(21,29,60,0.24)';
  const inkMR = rare ? [0.25, 0.3, 1] : [0, 0.6, 0];       // 闪卡的字是银箔
  const foil = rare ? '#d8dbe3' : COBALT, foilMR = rare ? [1, 0.24, 1] : [0.45, 0.26, 1];
  d.fill(rare ? '#0b0c11' : PAPER, 0, rare ? 0.74 : 0.9, 0, g => g.fillRect(0, 0, w, hh));
  cardGrain(d.x, z, w, hh, R, rare);
  const L = 0.42 * P, Rr = w - 0.42 * P;
  // 细框
  d.stroke(faint, 0, 0.6, 0, 0.008 * P, g => { roundRectPath(g, 0.2 * P, 0.2 * P, w - 0.4 * P, hh - 0.4 * P, 0.14 * P); g.stroke(); });
  // 顶栏
  const hy = 0.6 * P;
  d.text(ink, ...inkMR, `500 ${0.135 * P}px ${FM}`, `Nº ${D.no}`, L, hy, { ls: `${0.01 * P}px` });
  d.text(ink, ...inkMR, `600 ${0.1 * P}px ${FA}`, 'NIGHT ATLAS', Rr, hy, { align: 'right', ls: `${0.045 * P}px` });
  // 目镜视野：深蓝实地，压凹一点
  const ex = w / 2, ey = 3.04 * P, er = 1.93 * P;
  const fg = d.x.createRadialGradient(ex, ey - er * 0.35, er * 0.05, ex, ey, er * 1.02);
  fg.addColorStop(0, rare ? '#121319' : '#1e2852'); fg.addColorStop(1, rare ? '#060609' : '#0c1230');
  d.fill(fg, 0, rare ? 0.62 : 0.62, 0, g => { g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill(); });
  z.save(); z.filter = `blur(${0.03 * P}px)`; z.fillStyle = '#5c5c5c'; z.beginPath(); z.arc(ex, ey, er, 0, TAU); z.fill(); z.restore();
  for (const g of [d.x, d.y]) { g.save(); g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.clip(); }
  D.art(d.x, R, ex, ey, er, P, d);
  // 视野里的方位：上北左东（天文图的习惯）
  for (const [t, X, Y] of [['N', ex, ey - er + 0.2 * P], ['E', ex - er + 0.16 * P, ey + 0.035 * P]]) d.text('rgba(240,233,216,0.5)', 0, 0.6, 0, `500 ${0.085 * P}px ${FM}`, t, X, Y, { align: 'center' });
  d.x.restore(); d.y.restore();
  d.stroke(rare ? 'rgba(228,230,237,0.3)' : 'rgba(21,29,60,0.85)', 0, 0.5, 0, 0.01 * P, g => { g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.stroke(); });
  // 刻度环：每 5° 一格，30° 一长格，烫箔
  const r0 = er + 0.075 * P;
  d.stroke(foil, ...foilMR, 0.011 * P, g => {
    g.beginPath(); g.arc(ex, ey, r0, 0, TAU); g.stroke();
    g.beginPath();
    for (let k = 0; k < 72; k++) { const a = k / 72 * TAU - Math.PI / 2, l = (k % 6 === 0 ? 0.13 : 0.06) * P; g.moveTo(ex + Math.cos(a) * r0, ey + Math.sin(a) * r0); g.lineTo(ex + Math.cos(a) * (r0 + l), ey + Math.sin(a) * (r0 + l)); }
    g.stroke();
  });
  // 两个下角：左边比例尺，右边视野
  const cy2 = ey + er + 0.05 * P;
  d.stroke(sub, ...inkMR, 0.008 * P, g => { g.beginPath(); g.moveTo(L, cy2); g.lineTo(L + 0.5 * P, cy2); g.moveTo(L, cy2 - 0.04 * P); g.lineTo(L, cy2 + 0.04 * P); g.moveTo(L + 0.5 * P, cy2 - 0.04 * P); g.lineTo(L + 0.5 * P, cy2 + 0.04 * P); g.stroke(); });
  d.text(sub, ...inkMR, `500 ${0.085 * P}px ${FM}`, D.bar, L + 0.25 * P, cy2 - 0.08 * P, { align: 'center' });
  d.text(sub, ...inkMR, `500 ${0.085 * P}px ${FM}`, D.fov, Rr, cy2 + 0.03 * P, { align: 'right', ls: `${0.01 * P}px` });
  // 字
  const ky = 5.82 * P;
  d.text(foil, ...(rare ? foilMR : [0, 0.55, 0]), `600 ${0.1 * P}px ${FA}`, D.kicker, L, ky, { ls: `${0.032 * P}px` });
  d.text(ink, ...inkMR, `400 ${0.54 * P}px ${FS}`, D.title, L - 0.02 * P, ky + 0.55 * P, {});
  D.desc.forEach((t, k) => d.text(sub, ...inkMR, `400 ${0.142 * P}px ${FA}`, t, L, ky + (0.88 + k * 0.215) * P, {}));
  // 数据：三栏，细线隔开
  const gy = ky + 1.36 * P, cw = (Rr - L) / 3;
  d.stroke(faint, ...inkMR, 0.008 * P, g => {
    g.beginPath(); g.moveTo(L, gy); g.lineTo(Rr, gy);
    for (let k = 1; k < 3; k++) { g.moveTo(L + cw * k, gy + 0.1 * P); g.lineTo(L + cw * k, gy + 0.56 * P); }
    g.stroke();
  });
  D.data.forEach(([lab, val], k) => {
    const X = L + cw * k + (k ? 0.12 * P : 0);
    d.text(sub, ...inkMR, `600 ${0.08 * P}px ${FA}`, lab, X, gy + 0.25 * P, { ls: `${0.035 * P}px` });
    d.text(ink, ...inkMR, `500 ${0.128 * P}px ${FM}`, val, X, gy + 0.5 * P, {});
  });
  // 底栏：稀有度星（烫箔）和编号
  const fy = hh - 0.42 * P;
  d.fill(foil, ...foilMR, g => { for (let k = 0; k < (rare ? 3 : 1); k++) starGlyph(g, L + 0.06 * P + k * 0.2 * P, fy - 0.035 * P, 0.07 * P); });
  d.text(sub, ...inkMR, `500 ${0.1 * P}px ${FM}`, `${D.no} / 05`, Rr, fy, { align: 'right', ls: `${0.01 * P}px` });
  const n = heightToNormal(canvasHeight(hgt), w, hh, 5, false);
  return { c, m, n };
}

/* ① 凸月：亮面用点刻铺，明暗交界附近的环形山最清楚；暗面只有很淡的地照 */
export function artMoon(g, R, cx, cy, er, P) {
  const mr = er * 0.72;
  fieldStars(g, R, cx, cy, er, 70, P, (X, Y) => Math.hypot(X - cx, Y - cy) < mr * 1.08);
  const al = 56 * DEG, L = nrm3([Math.sin(al), 0.12, Math.cos(al)]), Lh = Math.hypot(L[0], L[1]);
  const maria = [[-0.32, -0.36, 0.26, 0.21], [0.16, -0.33, 0.16, 0.15], [0.3, -0.04, 0.2, 0.17], [0.64, -0.2, 0.1, 0.12], [-0.6, -0.02, 0.24, 0.42], [-0.15, 0.36, 0.18, 0.14], [0.5, 0.17, 0.13, 0.15], [0.34, 0.31, 0.09, 0.09], [-0.42, 0.32, 0.12, 0.1]];
  const cr = [[-0.3, -0.12, 0.05], [-0.12, 0.6, 0.045], [-0.12, -0.72, 0.05], [-0.16, 0.8, 0.08], [0.05, 0.75, 0.05]];
  for (let k = 0; k < 38; k++) { const a = R() * TAU, q = Math.sqrt(R()) * 0.93; cr.push([Math.cos(a) * q, Math.sin(a) * q, 0.014 + Math.pow(R(), 2.2) * 0.06]); }
  g.fillStyle = '#0d1331'; g.beginPath(); g.arc(cx, cy, mr, 0, TAU); g.fill();
  halftone(g, cx, cy, mr, 0.024 * P, (u, v) => {
    const z2 = Math.max(0, 1 - u * u - v * v);
    const zz = Math.sqrt(z2), ndl = u * L[0] - v * L[1] + zz * L[2];
    const lit = smooth(clamp((ndl + 0.03) / 0.2)) * (0.8 + 0.2 * clamp(ndl));
    // 月海：边界扭一扭，再卡一道阈值，边缘清楚、形状不规则，不是一团团模糊的圆斑
    const wu = u + 0.05 * Math.sin(v * 11 + 1.3) + 0.015 * Math.sin(v * 29 + u * 7), wv = v + 0.05 * Math.sin(u * 10 + 0.4) + 0.015 * Math.sin(u * 27 - v * 9);
    let gm = 0; for (const [a, b, ru, rv] of maria) { const x = (wu - a) / ru, y = (wv - b) / rv; gm = Math.max(gm, Math.exp(-(x * x + y * y) * 1.4)); }
    const ma = smooth(clamp((gm - 0.3) / 0.3)) * (0.88 + 0.12 * Math.sin(u * 31 + Math.sin(v * 23) * 2) * Math.sin(v * 27 + 1.7));
    let alb = 1 - 0.27 * ma - 0.06 * gm;
    const tx = u + 0.12, ty = v - 0.6, td = Math.hypot(tx, ty);   // 第谷环形山的辐射纹
    alb += 0.22 * Math.exp(-td * 2.6) * Math.pow(Math.max(0, Math.sin(Math.atan2(ty, tx) * 7 + 1.3)), 10);
    const term = 0.35 + 0.65 * (1 - clamp(ndl * 2.4));
    let cs = 1;
    for (const [a, b, rr] of cr) {
      const x = u - a, y = v - b, dd = Math.hypot(x, y); if (dd > rr * 1.25) continue;
      if (dd < rr) { const t = (x * L[0] - y * L[1]) / (rr * Lh); cs *= t > 0 ? 1 - 0.48 * smooth(clamp(t)) * term : 1 + 0.22 * smooth(clamp(-t)) * term; }
      else { const t = (x * L[0] - y * L[1]) / (dd * Lh); cs *= 1 + 0.12 * Math.max(0, -t) * term; }
    }
    return clamp(lit * alb * cs * (0.9 + 0.1 * zz)) + (1 - lit) * 0.03;
  }, LITE3);
}

/* ② 彗星：彗发是一团点刻，尘埃尾是一把弯的细刻线，离子尾是几条直的 */
export function artComet(g, R, cx, cy, er, P) {
  const hx = cx + er * 0.4, hy = cy - er * 0.38, dir = nrm3([-0.76, 0.65]), per = [-dir[1], dir[0]];
  fieldStars(g, R, cx, cy, er, 110, P, (X, Y) => Math.hypot(X - hx, Y - hy) < 0.35 * P);
  g.save(); g.lineCap = 'round';
  for (let k = 0; k < 140; k++) {
    const s = k / 139 - 0.5, len = er * (1.25 + 0.5 * (1 - Math.abs(s) * 2) + R() * 0.15);
    const ang = s * 0.5 + 0.12, ca = Math.cos(ang), sa = Math.sin(ang);
    const dx = dir[0] * ca - dir[1] * sa, dy = dir[0] * sa + dir[1] * ca;
    const ex = hx + dx * len, ey = hy + dy * len, bend = len * 0.16;
    const qx = hx + dx * len * 0.5 + per[0] * bend, qy = hy + dy * len * 0.5 + per[1] * bend;
    const a = (0.08 + 0.34 * Math.pow(1 - Math.abs(s) * 2, 1.6)) * (0.7 + R() * 0.3);
    const gr = g.createLinearGradient(hx, hy, ex, ey); gr.addColorStop(0, `rgba(240,233,216,${a})`); gr.addColorStop(0.55, `rgba(240,233,216,${a * 0.45})`); gr.addColorStop(1, 'rgba(240,233,216,0)');
    g.strokeStyle = gr; g.lineWidth = 0.5 + R() * 0.5;
    g.beginPath(); g.moveTo(hx + per[0] * s * 6, hy + per[1] * s * 6); g.quadraticCurveTo(qx, qy, ex, ey); g.stroke();
  }
  // 离子尾：正背着太阳，笔直，偏一点冷色
  for (let k = 0; k < 9; k++) {
    const s = (k - 4) / 4, len = er * (1.7 + R() * 0.2), ang = -0.09 + s * 0.025, ca = Math.cos(ang), sa = Math.sin(ang);
    const dx = dir[0] * ca - dir[1] * sa, dy = dir[0] * sa + dir[1] * ca, a = 0.42 - Math.abs(s) * 0.25;
    const gr = g.createLinearGradient(hx, hy, hx + dx * len, hy + dy * len); gr.addColorStop(0, `rgba(196,210,255,${a})`); gr.addColorStop(1, 'rgba(196,210,255,0)');
    g.strokeStyle = gr; g.lineWidth = 0.55; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + dx * len, hy + dy * len); g.stroke();
  }
  g.restore();
  const cr = 0.62 * P;
  // 彗发：一团柔光，不用网点（网点在这么淡的地方会露出一张网）
  const cg = g.createRadialGradient(hx, hy, 0, hx, hy, cr);
  for (const [o, a] of [[0, 0.95], [0.06, 0.75], [0.16, 0.36], [0.34, 0.12], [0.6, 0.035], [1, 0]]) cg.addColorStop(o, `rgba(244,238,224,${a})`);
  g.fillStyle = cg; g.beginPath(); g.arc(hx, hy, cr, 0, TAU); g.fill();
  g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(hx, hy, 0.022 * P, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,250,240,0.6)'; g.lineWidth = 0.6; const l = 0.16 * P;
  g.beginPath(); g.moveTo(hx - l, hy); g.lineTo(hx + l, hy); g.moveTo(hx, hy - l); g.lineTo(hx, hy + l); g.stroke();
}

/* ③ 带环巨行星：星体点刻（带纬向条纹和环的影子），环是一圈圈细刻线，后半圈被星体挡住 */
export function artRinged(g, R, cx, cy, er, P) {
  const pr = er * 0.34, tilt = -0.4, kE = 0.3;
  fieldStars(g, R, cx, cy, er, 80, P, (X, Y) => { const x = X - cx, y = Y - cy, a = x * Math.cos(-tilt) - y * Math.sin(-tilt), b = x * Math.sin(-tilt) + y * Math.cos(-tilt); return (a * a) / (pr * 2.45) ** 2 + (b * b) / (pr * 2.45 * kE + pr) ** 2 < 1; });
  const bands = [[1.24, 1.52, 0.22], [1.53, 1.95, 0.85], [1.95, 2.03, 0.03], [2.03, 2.2, 0.55], [2.2, 2.225, 0.05], [2.225, 2.28, 0.5]];
  const dens = q => { for (const [a, b, dd] of bands) if (q >= a && q < b) return dd; return 0; };
  const rings = front => {
    g.save(); g.translate(cx, cy); g.rotate(tilt);
    for (let q = 1.24; q < 2.28; q += 0.011) {
      const dd = dens(q); if (dd < 0.02) continue;
      g.strokeStyle = `rgba(240,233,216,${(0.1 + 0.55 * dd) * (0.8 + R() * 0.3)})`; g.lineWidth = 0.65;
      g.beginPath(); g.ellipse(0, 0, pr * q, pr * q * kE, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); g.stroke();
    }
    g.restore();
  };
  rings(false);
  g.fillStyle = '#0d1331'; g.beginPath(); g.arc(cx, cy, pr, 0, TAU); g.fill();
  const L = nrm3([-0.55, 0.42, 0.72]), ct = Math.cos(-tilt), st = Math.sin(-tilt);
  halftone(g, cx, cy, pr, 0.022 * P, (u, v) => {
    const z2 = Math.max(0, 1 - u * u - v * v);
    const zz = Math.sqrt(z2), ndl = u * L[0] - v * L[1] + zz * L[2];
    const lit = smooth(clamp((ndl + 0.04) / 0.32)) * (0.62 + 0.38 * clamp(ndl));
    const lat = u * st + v * ct;
    const band = 0.74 + 0.26 * Math.sin(lat * 15 + 0.7 * Math.sin(lat * 5 + u * 2));
    const shadow = 1 - 0.55 * smooth(clamp(1 - Math.abs(lat - 0.2) / 0.06));
    return lit * band * shadow * (1 - 0.3 * Math.pow(Math.abs(lat), 3)) + 0.012;
  }, LITE3);
  rings(true);
  // 两颗卫星
  for (const [x, y, s, nm] of [[0.6, 0.42, 0.018, 'TITAN'], [-0.62, -0.52, 0.011, 'RHEA']]) {
    const X = cx + x * er, Y = cy + y * er;
    g.fillStyle = 'rgba(240,233,216,0.9)'; g.beginPath(); g.arc(X, Y, s * P, 0, TAU); g.fill();
    g.fillStyle = 'rgba(240,233,216,0.5)'; g.font = `500 ${0.075 * P}px ${FM}`; g.letterSpacing = `${0.012 * P}px`; g.textAlign = 'left'; g.fillText(nm, X + 0.07 * P, Y + 0.025 * P); g.letterSpacing = '0px';
  }
}

/* ④ 天琴座：一张小星图。赤经赤纬网、背景暗星、连线、希腊字母，和夹在中间的环状星云 M57 */
export function artLyra(g, R, cx, cy, er, P) {
  const px = cx + er * 0.25, py = cy - er * 3.4, d0 = Math.hypot(cx - px, cy - py);
  g.strokeStyle = 'rgba(240,233,216,0.1)'; g.lineWidth = 0.7;
  for (let k = -3; k <= 3; k++) { g.beginPath(); g.arc(px, py, d0 + k * er * 0.42, 0, TAU); g.stroke(); }
  for (let k = -5; k <= 5; k++) { const a = Math.PI / 2 + k * 0.075; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * (d0 + er * 2), py + Math.sin(a) * (d0 + er * 2)); g.stroke(); }
  fieldStars(g, R, cx, cy, er, 150, P);
  const S = { a: [-0.16, -0.5, 0.03], e: [0.13, -0.62, 4.7], z: [0.1, -0.28, 4.4], d: [0.34, 0.03, 4.3], gm: [0.12, 0.44, 3.2], b: [-0.2, 0.33, 3.5] };
  const at = s => [cx + s[0] * er, cy + s[1] * er], rad = s => (0.07 - s[2] * 0.0105) * P;
  g.strokeStyle = 'rgba(240,233,216,0.5)'; g.lineWidth = 0.8;
  for (const [p, q] of [['a', 'z'], ['a', 'e'], ['e', 'z'], ['z', 'd'], ['d', 'gm'], ['gm', 'b'], ['b', 'z']]) {
    const [x1, y1] = at(S[p]), [x2, y2] = at(S[q]), l = Math.hypot(x2 - x1, y2 - y1), g1 = rad(S[p]) + 0.07 * P, g2 = rad(S[q]) + 0.07 * P;
    g.beginPath(); g.moveTo(x1 + (x2 - x1) * g1 / l, y1 + (y2 - y1) * g1 / l); g.lineTo(x2 - (x2 - x1) * g2 / l, y2 - (y2 - y1) * g2 / l); g.stroke();
  }
  for (const [k, s] of Object.entries(S)) {
    const [X, Y] = at(s), r = rad(s);
    g.fillStyle = '#f6f0e2';
    if (k === 'e') { for (const o of [-1, 1]) { g.beginPath(); g.arc(X + o * r * 0.9, Y - o * r * 0.5, r * 0.75, 0, TAU); g.fill(); } }
    else { g.beginPath(); g.arc(X, Y, r, 0, TAU); g.fill(); }
    if (k === 'a') {   // 织女星：刻出来的八角星芒
      g.strokeStyle = 'rgba(246,240,226,0.75)'; g.lineWidth = 0.7;
      for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4, l = (j % 2 ? 0.16 : 0.32) * P; g.beginPath(); g.moveTo(X + Math.cos(a) * r * 1.3, Y + Math.sin(a) * r * 1.3); g.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); g.stroke(); }
    }
  }
  const lab = (t, s, dx, dy, f) => { const [X, Y] = at(s); g.fillStyle = 'rgba(240,233,216,0.78)'; g.font = f; g.textAlign = 'left'; g.fillText(t, X + dx * P, Y + dy * P); };
  lab('α Vega', S.a, -0.62, -0.18, `italic ${0.2 * P}px ${FS}`);
  lab('ε', S.e, 0.1, -0.06, `italic ${0.15 * P}px ${FS}`); lab('ζ', S.z, 0.1, 0.05, `italic ${0.15 * P}px ${FS}`);
  lab('δ', S.d, 0.1, 0.05, `italic ${0.15 * P}px ${FS}`); lab('γ', S.gm, 0.1, 0.1, `italic ${0.15 * P}px ${FS}`); lab('β', S.b, -0.2, 0.1, `italic ${0.15 * P}px ${FS}`);
  const [bx, by] = at(S.b), [gx, gyy] = at(S.gm), mx = bx + (gx - bx) * 0.45, my = by + (gyy - by) * 0.45;
  g.strokeStyle = 'rgba(240,233,216,0.75)'; g.lineWidth = 1; g.beginPath(); g.arc(mx, my, 0.032 * P, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(240,233,216,0.5)'; g.font = `500 ${0.075 * P}px ${FM}`; g.fillText('M57', mx - 0.08 * P, my + 0.15 * P);
}

/* ⑤ 日全食（闪卡）：月盘全黑，日冕是一根根放射的细刻线（银色镭射箔），一颗钻石环 */
export function artEclipse(g, R, cx, cy, er, P, d) {
  const mr = er * 0.34, y = d.y;
  g.save(); y.save(); g.lineCap = y.lineCap = 'round';
  for (let k = 0; k < 1100; k++) {
    const th = R() * TAU;
    const streamer = Math.pow(0.5 + 0.5 * Math.cos(2 * (th - 0.25)), 3), polar = Math.pow(Math.abs(Math.sin(th - 0.25)), 6);
    const len = mr * (0.25 + 1.75 * streamer * (0.55 + R() * 0.6) + 0.35 * polar * R() + 0.3 * Math.pow(R(), 4));
    const r1 = mr * (1.0 + R() * 0.02), r2 = r1 + len, bend = (R() - 0.5) * 0.08 * streamer;
    const x1 = cx + Math.cos(th) * r1, y1 = cy + Math.sin(th) * r1, x2 = cx + Math.cos(th + bend) * r2, y2 = cy + Math.sin(th + bend) * r2;
    const qx = cx + Math.cos(th + bend * 0.3) * (r1 + len * 0.5), qy = cy + Math.sin(th + bend * 0.3) * (r1 + len * 0.5);
    const a = 0.25 + R() * 0.45, lw = 0.45 + R() * 0.55;
    const gc = g.createLinearGradient(x1, y1, x2, y2); gc.addColorStop(0, `rgba(232,235,242,${a})`); gc.addColorStop(1, 'rgba(232,235,242,0)');
    g.strokeStyle = gc; g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(qx, qy, x2, y2); g.stroke();
    const gm = y.createLinearGradient(x1, y1, x2, y2); gm.addColorStop(0, `rgba(255,60,150,${Math.min(1, a * 1.6)})`); gm.addColorStop(1, 'rgba(255,60,150,0)');
    y.strokeStyle = gm; y.lineWidth = lw + 0.6; y.beginPath(); y.moveTo(x1, y1); y.quadraticCurveTo(qx, qy, x2, y2); y.stroke();
  }
  g.restore(); y.restore();
  // 内日冕：贴着月盘边的一圈细点
  stipple(g, R, cx, cy, mr * 1.6, 0.016 * P, (u, v) => { const q = Math.hypot(u, v) * 1.6; return q < 1 ? 0 : Math.exp(-(q - 1) * 5.5) * 0.95; }, '#eceef4', 0.55);
  y.save(); const hm = y.createRadialGradient(cx, cy, mr, cx, cy, mr * 1.6); hm.addColorStop(0, 'rgba(255,60,150,0.9)'); hm.addColorStop(1, 'rgba(255,60,150,0)'); y.fillStyle = hm; y.beginPath(); y.arc(cx, cy, mr * 1.6, 0, TAU); y.fill(); y.restore();
  // 月盘和色球层的细边
  g.fillStyle = '#020203'; g.beginPath(); g.arc(cx, cy, mr, 0, TAU); g.fill();
  y.fillStyle = 'rgb(0,190,0)'; y.beginPath(); y.arc(cx, cy, mr, 0, TAU); y.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.8; g.beginPath(); g.arc(cx, cy, mr + 0.4, 0, TAU); g.stroke();
  // 钻石环
  const a = -0.82, dx = cx + Math.cos(a) * mr, dy = cy + Math.sin(a) * mr;
  stipple(g, R, dx, dy, 0.42 * P, 0.015 * P, (u, v) => { const q = u * u + v * v; return Math.exp(-q * 14) + Math.exp(-q * 90) * 0.6; }, '#ffffff', 0.55);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(dx, dy, 0.026 * P, 0, TAU); g.fill();
  for (const [ux, uy, l] of [[1, 0, 0.36 * P], [0, 1, 0.22 * P]]) {
    const sp = g.createLinearGradient(dx - ux * l, dy - uy * l, dx + ux * l, dy + uy * l);
    sp.addColorStop(0, 'rgba(255,255,255,0)'); sp.addColorStop(0.5, 'rgba(255,255,255,0.85)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = sp; g.lineWidth = 0.8; g.beginPath(); g.moveTo(dx - ux * l, dy - uy * l); g.lineTo(dx + ux * l, dy + uy * l); g.stroke();
  }
  y.fillStyle = 'rgba(255,60,255,1)'; y.beginPath(); y.arc(dx, dy, 0.12 * P, 0, TAU); y.fill();
  fieldStars(g, R, cx, cy, er, 40, P, (X, Y) => Math.hypot(X - cx, Y - cy) < mr * 2.4);
}

/* 卡背：海军蓝底，中间一朵银色扭索纹，星环标志和字标 */
export function paintCardBack() {
  const P = CARD.P, w = CARD.W * P, hh = CARD.H * P;
  const c = cv(w, hh), m = cv(w, hh), d = dual(c, m);
  d.fill('#0f1938', 0.0, 0.5, 0.15, g => g.fillRect(0, 0, w, hh));
  const cx = w / 2, cy = hh / 2;
  d.stroke('rgba(200,206,220,0.5)', 0.5, 0.18, 1, 0.008 * P, g => {
    for (let k = 0; k < 48; k++) {
      const ph = k / 48 * TAU;
      g.beginPath();
      for (let s = 0; s <= 360; s++) {
        const t = s / 360 * TAU, rr = (1.55 + 0.38 * Math.sin(7 * t + ph) + 0.12 * Math.sin(19 * t)) * P;
        const X = cx + Math.cos(t) * rr, Y = cy + Math.sin(t) * rr;
        if (s === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
      }
      g.stroke();
    }
  });
  d.fill('#0f1938', 0, 0.5, 0.15, g => { g.beginPath(); g.arc(cx, cy, 1.08 * P, 0, TAU); g.fill(); });
  d.stroke('#d7dbe4', 1, 0.15, 1, 0.02 * P, g => {
    g.beginPath(); g.arc(cx, cy - 0.12 * P, 0.4 * P, 0, TAU); g.stroke();
    g.save(); g.translate(cx, cy - 0.12 * P); g.rotate(-0.42); g.beginPath(); g.ellipse(0, 0, 0.66 * P, 0.2 * P, 0, 0, TAU); g.restore(); g.stroke();
  });
  d.text(IVORY, 0, 0.5, 0, `italic ${0.32 * P}px ${FS}`, 'Night Atlas', cx, cy + 0.68 * P, { align: 'center' });
  d.stroke('#cfd4de', 1, 0.15, 1, 0.018 * P, g => { roundRectPath(g, 0.2 * P, 0.2 * P, w - 0.4 * P, hh - 0.4 * P, 0.16 * P); g.stroke(); });
  d.stroke('rgba(207,212,222,0.45)', 0.6, 0.18, 1, 0.01 * P, g => { roundRectPath(g, 0.32 * P, 0.32 * P, w - 0.64 * P, hh - 0.64 * P, 0.1 * P); g.stroke(); });
  d.text('#d7dbe4', 0.8, 0.16, 1, `500 ${0.15 * P}px ${FA}`, 'SERIES 01', cx, hh - 0.62 * P, { align: 'center', ls: `${0.08 * P}px` });
  return { c, m };
}
