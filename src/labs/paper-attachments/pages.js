/* 三份文件各画一次到 canvas 上：桌上的小图和拿起来那张纸的贴图都用它，两边永远一样。
   字用网站自己的：标题是 Instrument Serif（本站带的字体），正文衬线用系统的 Georgia，小字用系统的无衬线。
   纸是纸，不跟主题变色；深色主题里整张压暗一点（CSS 的 --paper-dim 和着色器的曝光） */
import { lerp } from "./motion.js";

const DISPLAY = '"Instrument Serif", Georgia, serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
export const PAPER = "#fbfaf7";
export const PAPER_BACK = "#efeee9";

/** 画字之前先把标题字体载进来；最多等三秒，等不到就用后备字体 */
export function fontsReady() {
  if (!document.fonts) return Promise.resolve();
  const load = Promise.all(['400 54px "Instrument Serif"', 'italic 400 18px "Instrument Serif"'].map((f) => document.fonts.load(f))).catch(() => {});
  return Promise.race([load, new Promise((r) => setTimeout(r, 3000))]);
}

function canvas(w, hgt) { const c = document.createElement('canvas'); c.width = w; c.height = hgt; return c; }

// 细的颗粒加一层很淡的云斑：凑近看没上光的纸和胶片都是这样
function grain(ctx, w, hgt, amt, mottle = 0) {
  const img = ctx.getImageData(0, 0, w, hgt), d = img.data;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cells = 9, cw = w / cells, chh = hgt / cells, M = [];
  for (let i = 0; i < (cells + 1) * (cells + 1); i++) M.push(rnd() - 0.5);
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
    const gx = x / cw, gy = y / chh, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, r = cells + 1;
    const m = mottle ? lerp(lerp(M[iy * r + ix], M[iy * r + ix + 1], fx), lerp(M[(iy + 1) * r + ix], M[(iy + 1) * r + ix + 1], fx), fy) * mottle : 0;
    const n = (rnd() - 0.5) * amt + m, i = (y * w + x) * 4;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; } else line = t;
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}

/* Proposal.pdf：一份亭子方案的第一页，带一张立面图 */
export function paintProposal(W) {
  const Hh = Math.round(W * Math.SQRT2), c = canvas(W, Hh), x = c.getContext('2d'), k = W / 600;
  x.fillStyle = PAPER; x.fillRect(0, 0, W, Hh);
  x.scale(k, k);
  const ink = '#1b1b1f', grey = '#8a8a90', m = 48, R = 600 - m;
  x.textBaseline = 'alphabetic';
  x.fillStyle = ink; x.font = `600 10.5px ${SANS}`; x.letterSpacing = '2.2px'; x.fillText('NORTHWIND STUDIO', m, 58);
  x.letterSpacing = '0px'; x.fillStyle = grey; x.font = `400 10.5px ${SANS}`; x.textAlign = 'right'; x.fillText('Concept proposal  ·  16 Nov 2026', R, 58); x.textAlign = 'left';
  x.fillStyle = ink; x.fillRect(m, 70, R - m, 1);
  x.font = `400 58px ${DISPLAY}`; x.fillText('Spring Pavilion', m - 2, 140);
  x.font = `italic 400 19px ${DISPLAY}`; x.fillStyle = '#56565c'; x.fillText('A timber canopy for the riverside garden', m, 170);
  // 几项基本信息
  [['CLIENT', 'Riverside Trust'], ['AREA', '86 m²'], ['STAGE', 'Concept'], ['BUDGET', '£56,600']].forEach(([a, b], i) => {
    const cx = m + i * 126;
    x.fillStyle = grey; x.font = `600 8.5px ${SANS}`; x.letterSpacing = '1.6px'; x.fillText(a, cx, 206);
    x.letterSpacing = '0px'; x.fillStyle = ink; x.font = `400 12.5px ${SANS}`; x.fillText(b, cx, 224);
  });
  x.fillStyle = 'rgba(27,27,31,.14)'; x.fillRect(m, 244, R - m, 1);
  // 南立面，照建筑师的画法：细线、地面打斜线、画一个人当比例尺
  x.save(); x.strokeStyle = ink; x.lineCap = 'round'; x.lineJoin = 'round';
  const g = 470, L = 112, Rt = 488;
  x.lineWidth = 1.1; x.beginPath(); x.moveTo(m, g); x.lineTo(R, g); x.stroke();
  x.lineWidth = 0.55; for (let i = m; i < R; i += 7) { x.beginPath(); x.moveTo(i, g + 1); x.lineTo(i - 6, g + 7); x.stroke(); }
  const arch = (t, off) => [lerp(L, Rt, t), 352 - Math.sin(Math.PI * t) * 46 + off];
  x.lineWidth = 1.1; x.beginPath(); for (let i = 0; i <= 60; i++) { const [px, py] = arch(i / 60, 0); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  x.beginPath(); for (let i = 0; i <= 60; i++) { const [px, py] = arch(i / 60, 9); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  x.lineWidth = 0.5; for (let i = 1; i < 30; i++) { const [px, py] = arch(i / 30, 0); x.beginPath(); x.moveTo(px, py); x.lineTo(px, py + 9); x.stroke(); }
  x.lineWidth = 0.9; for (let i = 0; i <= 6; i++) { const t = 0.04 + i * 0.92 / 6, [px, py] = arch(t, 9); x.beginPath(); x.moveTo(px, py); x.lineTo(px, g); x.stroke(); }
  x.lineWidth = 0.8; x.strokeRect(246, g - 22, 88, 6); x.beginPath(); x.moveTo(252, g - 16); x.lineTo(252, g); x.moveTo(328, g - 16); x.lineTo(328, g); x.stroke();
  // 树
  x.lineWidth = 0.7; x.beginPath(); x.arc(R - 14, 372, 40, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.arc(R - 30, 392, 26, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 0.9; x.beginPath(); x.moveTo(R - 18, 410); x.lineTo(R - 18, g); x.stroke();
  // 人
  x.lineWidth = 0.9; x.beginPath(); x.arc(392, g - 31, 3.2, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.moveTo(392, g - 27.5); x.lineTo(392, g - 13); x.moveTo(392, g - 13); x.lineTo(388.5, g); x.moveTo(392, g - 13); x.lineTo(395, g); x.moveTo(392, g - 24); x.lineTo(387.5, g - 15); x.moveTo(392, g - 24); x.lineTo(396, g - 16); x.stroke();
  // 尺寸线
  x.lineWidth = 0.6; x.strokeStyle = grey; x.beginPath(); x.moveTo(L, g + 24); x.lineTo(Rt, g + 24); x.stroke();
  for (const px of [L, Rt]) { x.beginPath(); x.moveTo(px - 3, g + 27); x.lineTo(px + 3, g + 21); x.moveTo(px, g + 18); x.lineTo(px, g + 30); x.stroke(); }
  x.fillStyle = grey; x.font = `400 9px ${SANS}`; x.textAlign = 'center'; x.fillText('12 400', 300, g + 20); x.textAlign = 'left';
  x.restore();
  x.fillStyle = grey; x.font = `400 9px ${SANS}`; x.fillText('South elevation  1:100', m, 268);
  // 两栏正文
  const col = (y0, cx, head, body) => {
    x.fillStyle = ink; x.font = `600 8.5px ${SANS}`; x.letterSpacing = '1.6px'; x.fillText(head, cx, y0); x.letterSpacing = '0px';
    x.fillStyle = '#3a3a40'; x.font = `400 11.5px ${SERIF}`; wrap(x, body, cx, y0 + 20, 240, 16.5);
  };
  col(542, m, '01  SITE', 'The pavilion sits where the garden path meets the old river wall. It keeps the line of the wall and leaves the lawn open, so the view across the water stays whole from the gate. Visitors arrive under the low end of the canopy and walk out toward the river as it rises.');
  col(542, m + 264, '02  STRUCTURE', 'Seven glulam ribs carry a thin roof of cedar shingles. Each rib lands on a steel shoe above the flood line, and the bench between them doubles as bracing. Everything bolts together on site in under three weeks, and can be taken apart again when the garden needs the space.');
  x.fillStyle = 'rgba(27,27,31,.14)'; x.fillRect(m, 790, R - m, 1);
  x.fillStyle = grey; x.font = `400 9px ${SANS}`; x.fillText('Northwind Studio  ·  Spring Pavilion', m, 808); x.textAlign = 'right'; x.fillText('1 / 12', R, 808); x.textAlign = 'left';
  x.setTransform(1, 0, 0, 1, 0, 0);
  grain(x, W, Hh, 7, 5);
  return c;
}

/* Cover.jpg：傍晚斜阳里的亭子，一张光面相纸 */
export function paintCover(W) {
  const Hh = Math.round(W * 1.25), c = canvas(W, Hh), x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, Hh * 0.6);
  sky.addColorStop(0, '#9fb3c2'); sky.addColorStop(0.55, '#d6d9d4'); sky.addColorStop(1, '#efdcc2');
  x.fillStyle = sky; x.fillRect(0, 0, W, Hh);
  // 低低的太阳在左边
  const sun = x.createRadialGradient(W * 0.08, Hh * 0.5, 0, W * 0.08, Hh * 0.5, W * 0.9);
  sun.addColorStop(0, 'rgba(255,214,160,.75)'); sun.addColorStop(0.4, 'rgba(255,214,160,.18)'); sun.addColorStop(1, 'rgba(255,214,160,0)');
  x.fillStyle = sun; x.fillRect(0, 0, W, Hh);
  const hz = Hh * 0.6;
  // 远处的树
  x.fillStyle = 'rgba(92,104,94,.55)';
  for (let i = 0; i < 26; i++) { const tx = (i / 25) * W * 1.1 - W * 0.05, r = W * (0.03 + ((i * 37) % 11) / 260); x.beginPath(); x.ellipse(tx, hz - r * 0.55, r, r * 0.9, 0, 0, Math.PI * 2); x.fill(); }
  // 河和草地
  const gr = x.createLinearGradient(0, hz, 0, Hh);
  gr.addColorStop(0, '#a9ad93'); gr.addColorStop(0.35, '#8f946f'); gr.addColorStop(1, '#6f7550');
  x.fillStyle = gr; x.fillRect(0, hz, W, Hh - hz);
  x.fillStyle = 'rgba(214,220,214,.75)'; x.fillRect(0, hz, W, Hh * 0.025);
  // 碎石小路
  x.fillStyle = 'rgba(226,214,190,.85)'; x.beginPath(); x.moveTo(W * 0.38, Hh); x.lineTo(W * 0.62, Hh); x.lineTo(W * 0.53, hz + Hh * 0.1); x.lineTo(W * 0.47, hz + Hh * 0.1); x.closePath(); x.fill();
  // 顶棚落在草地上的影子
  x.save(); x.filter = `blur(${W * 0.03}px)`; x.fillStyle = 'rgba(40,38,28,.42)'; x.beginPath(); x.ellipse(W * 0.56, hz + Hh * 0.13, W * 0.42, Hh * 0.045, 0, 0, Math.PI * 2); x.fill(); x.restore();
  // 顶棚
  const L = W * 0.1, Rr = W * 0.92, top = (t, off) => [lerp(L, Rr, t), hz - Hh * 0.17 - Math.sin(Math.PI * t) * Hh * 0.07 + off];
  const ribs = 7;
  for (let i = 0; i < ribs; i++) {
    const t = 0.05 + i * 0.9 / (ribs - 1), [px, py] = top(t, Hh * 0.03);
    const cg = x.createLinearGradient(px - 4, 0, px + 4, 0); cg.addColorStop(0, '#3e2a1c'); cg.addColorStop(1, '#5a3d27');
    x.fillStyle = cg; x.fillRect(px - W * 0.006, py, W * 0.012, hz + Hh * 0.1 - py - (1 - Math.abs(t - 0.5)) * Hh * 0.02);
  }
  x.beginPath();
  for (let i = 0; i <= 80; i++) { const [px, py] = top(i / 80, 0); i ? x.lineTo(px, py) : x.moveTo(px, py); }
  for (let i = 80; i >= 0; i--) { const [px, py] = top(i / 80, Hh * 0.034); x.lineTo(px, py); }
  x.closePath();
  const wg = x.createLinearGradient(L, 0, Rr, 0); wg.addColorStop(0, '#d9a56f'); wg.addColorStop(0.5, '#a8714a'); wg.addColorStop(1, '#7d5236');
  x.fillStyle = wg; x.fill();
  x.strokeStyle = 'rgba(255,230,190,.7)'; x.lineWidth = W * 0.003; x.beginPath(); for (let i = 0; i <= 80; i++) { const [px, py] = top(i / 80, 0); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  x.strokeStyle = 'rgba(60,38,24,.35)'; x.lineWidth = 1; for (let i = 1; i < 40; i++) { const [px, py] = top(i / 40, 0); x.beginPath(); x.moveTo(px, py + 2); x.lineTo(px, py + Hh * 0.032); x.stroke(); }
  // 长凳和一个人，当比例尺
  x.fillStyle = '#4a3324'; x.fillRect(W * 0.43, hz + Hh * 0.075, W * 0.16, Hh * 0.012);
  x.fillStyle = '#2b2622'; const px = W * 0.66, py = hz + Hh * 0.1;
  x.beginPath(); x.arc(px, py - Hh * 0.085, W * 0.009, 0, Math.PI * 2); x.fill();
  x.fillRect(px - W * 0.008, py - Hh * 0.075, W * 0.016, Hh * 0.042); x.fillRect(px - W * 0.006, py - Hh * 0.035, W * 0.005, Hh * 0.035); x.fillRect(px + W * 0.001, py - Hh * 0.035, W * 0.005, Hh * 0.035);
  // 暗角和胶片颗粒
  const v = x.createRadialGradient(W / 2, Hh * 0.55, W * 0.3, W / 2, Hh * 0.55, W * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,14,8,.32)');
  x.fillStyle = v; x.fillRect(0, 0, W, Hh);
  grain(x, W, Hh, 16, 0);
  return c;
}

/* Budget.xlsx 打印出来：一张表，加一条钱花在哪儿的横条 */
export function paintBudget(W) {
  const Hh = Math.round(W * Math.SQRT2), c = canvas(W, Hh), x = c.getContext('2d'), k = W / 600;
  x.fillStyle = PAPER; x.fillRect(0, 0, W, Hh); x.scale(k, k);
  const ink = '#1b1b1f', grey = '#8a8a90', green = '#2f7a52', m = 48, R = 552;
  x.fillStyle = ink; x.font = `600 10.5px ${SANS}`; x.letterSpacing = '2.2px'; x.fillText('NORTHWIND STUDIO', m, 58); x.letterSpacing = '0px';
  x.fillStyle = grey; x.font = `400 10.5px ${SANS}`; x.textAlign = 'right'; x.fillText('Estimate  ·  v3', R, 58); x.textAlign = 'left';
  x.fillStyle = ink; x.fillRect(m, 70, R - m, 1);
  x.font = `400 46px ${DISPLAY}`; x.fillText('Budget', m - 1, 124);
  x.font = `italic 400 17px ${DISPLAY}`; x.fillStyle = '#56565c'; x.fillText('Spring Pavilion, concept estimate', m, 150);
  const rows = [['Glulam ribs', '7', '£2,480', '£17,360'], ['Cedar shingles', '86 m²', '£64', '£5,504'], ['Steel shoes', '14', '£205', '£2,870'], ['Foundations', '1', '£6,200', '£6,200'], ['Bench', '2', '£1,150', '£2,300'], ['Lighting', '1', '£2,400', '£2,400'], ['Labour', '1', '£14,800', '£14,800'], ['Contingency 10%', '', '', '£5,143']];
  const cols = [m + 10, 318, 410, R - 10];
  let y = 186;
  x.fillStyle = 'rgba(47,122,82,.1)'; x.fillRect(m, y, R - m, 26);
  x.fillStyle = green; x.font = `600 8.5px ${SANS}`; x.letterSpacing = '1.4px';
  ['ITEM', 'QTY', 'UNIT', 'COST'].forEach((t, i) => { x.textAlign = i ? 'right' : 'left'; x.fillText(t, i === 1 ? cols[1] + 28 : cols[i], y + 17); });
  x.letterSpacing = '0px'; y += 26;
  x.font = `400 11.5px ${SANS}`;
  for (const r of rows) {
    x.fillStyle = ink; r.forEach((t, i) => { x.textAlign = i ? 'right' : 'left'; x.fillText(t, i === 1 ? cols[1] + 28 : cols[i], y + 18); });
    y += 27; x.fillStyle = 'rgba(27,27,31,.08)'; x.fillRect(m, y, R - m, 1);
  }
  x.fillStyle = ink; x.fillRect(m, y + 1, R - m, 1.2);
  x.font = `600 12.5px ${SANS}`; x.textAlign = 'left'; x.fillText('Total', cols[0], y + 24); x.textAlign = 'right'; x.fillText('£56,577', cols[3], y + 24); x.textAlign = 'left';
  // 钱花在哪儿
  y += 70;
  x.fillStyle = ink; x.font = `600 8.5px ${SANS}`; x.letterSpacing = '1.6px'; x.fillText('SHARE OF COST', m, y); x.letterSpacing = '0px';
  const parts = [['Timber', 40.4], ['Labour', 26.2], ['Ground', 16], ['Fit-out', 8.3], ['Reserve', 9.1]];
  let bx = m; y += 14;
  parts.forEach(([n, p], i) => {
    const w = (R - m) * p / 100;
    x.fillStyle = `rgba(47,122,82,${0.85 - i * 0.16})`; x.fillRect(bx, y, w - 2, 16);
    x.fillStyle = '#3a3a40'; x.font = `400 9.5px ${SANS}`; x.fillText(n, bx, y + 32); x.fillStyle = grey; x.fillText(p.toFixed(0) + '%', bx, y + 46);
    bx += w;
  });
  y += 84;
  x.fillStyle = '#3a3a40'; x.font = `400 11.5px ${SERIF}`;
  wrap(x, 'Prices are from two timber suppliers and one steel fabricator, quoted in October. Shingles assume a 15% cut allowance. Lighting is a single low run under the bench; anything brighter would need its own feed from the gatehouse.', m, y, R - m, 16.5);
  x.fillStyle = 'rgba(27,27,31,.14)'; x.fillRect(m, 790, R - m, 1);
  x.fillStyle = grey; x.font = `400 9px ${SANS}`; x.fillText('Northwind Studio  ·  Spring Pavilion', m, 808); x.textAlign = 'right'; x.fillText('1 / 2', R, 808); x.textAlign = 'left';
  x.setTransform(1, 0, 0, 1, 0, 0);
  grain(x, W, Hh, 7, 5);
  return c;
}
