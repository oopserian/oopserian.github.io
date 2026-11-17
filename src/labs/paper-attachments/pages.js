/* 三份文件各画一次到 canvas 上：桌上的小图和拿起来那张纸的贴图都用它，两边永远一样。
   封面是一张真的照片（laken 拍的 DSC_8647，存成不带 EXIF 的 webp），提案页上印的也是它；预算表是画出来的。
   字用网站自己的：标题是 Instrument Serif（本站带的字体），正文衬线用系统的 Georgia，小字用系统的无衬线。
   纸是纸，不跟主题变色；深色主题里整张压暗一点（CSS 的 --paper-dim 和着色器的曝光） */
import { lerp } from "./motion.js";
import photoUrl from "./assets/dsc-8647.webp?url";

const DISPLAY = '"Instrument Serif", Georgia, serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
export const PAPER = "#fbfaf7";
export const PAPER_BACK = "#efeee9";

/** 照片的真实尺寸（相机原图竖着放）：桌上那份文件的比例和说明都照它 */
export const PHOTO = { w: 3264, h: 4928, bytes: 1433345 };
let photo = null;

/** 画之前先把标题字体和照片都载进来；最多等三秒，字体等不到就用后备字体，照片等不到就画一块天色 */
export function pagesReady() {
  const fonts = document.fonts ? Promise.all(['400 54px "Instrument Serif"', 'italic 400 18px "Instrument Serif"'].map((f) => document.fonts.load(f))).catch(() => {}) : Promise.resolve();
  const img = new Image(); img.src = photoUrl;
  const pic = img.decode().then(() => { photo = img; }, () => {});
  return Promise.race([Promise.all([fonts, pic]), new Promise((r) => setTimeout(r, 3000))]);
}

// 把照片按 cover 的方式铺进一个框（fy 是竖着取哪一段：0 顶、1 底）
function drawPhoto(x, dx, dy, dw, dh, fy = 0.5) {
  if (!photo) { const g = x.createLinearGradient(0, dy, 0, dy + dh); g.addColorStop(0, '#5f8fd0'); g.addColorStop(1, '#c9d3dc'); x.fillStyle = g; x.fillRect(dx, dy, dw, dh); return; }
  const iw = photo.naturalWidth, ih = photo.naturalHeight, s = Math.max(dw / iw, dh / ih), sw = dw / s, sh = dh / s;
  x.drawImage(photo, (iw - sw) / 2, (ih - sh) * fy, sw, sh, dx, dy, dw, dh);
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

/* Proposal.pdf：一篇摄影专题的提案，第一页印着那张照片的横幅 */
export function paintProposal(W) {
  const Hh = Math.round(W * Math.SQRT2), c = canvas(W, Hh), x = c.getContext('2d'), k = W / 600;
  x.fillStyle = PAPER; x.fillRect(0, 0, W, Hh);
  x.scale(k, k);
  const ink = '#1b1b1f', grey = '#8a8a90', m = 48, R = 600 - m;
  x.textBaseline = 'alphabetic';
  x.fillStyle = ink; x.font = `600 10.5px ${SANS}`; x.letterSpacing = '2.2px'; x.fillText('NORTHWIND STUDIO', m, 58);
  x.letterSpacing = '0px'; x.fillStyle = grey; x.font = `400 10.5px ${SANS}`; x.textAlign = 'right'; x.fillText('Feature proposal  ·  16 Nov 2026', R, 58); x.textAlign = 'left';
  x.fillStyle = ink; x.fillRect(m, 70, R - m, 1);
  x.font = `400 58px ${DISPLAY}`; x.fillText('Above the Clouds', m - 2, 140);
  x.font = `italic 400 19px ${DISPLAY}`; x.fillStyle = '#56565c'; x.fillText('A photo essay from the high valleys in early spring', m, 170);
  // 几项基本信息
  [['ISSUE', 'Spring 2027'], ['PAGES', '12'], ['PHOTOS', '24'], ['BUDGET', '£12,700']].forEach(([a, b], i) => {
    const cx = m + i * 126;
    x.fillStyle = grey; x.font = `600 8.5px ${SANS}`; x.letterSpacing = '1.6px'; x.fillText(a, cx, 206);
    x.letterSpacing = '0px'; x.fillStyle = ink; x.font = `400 12.5px ${SANS}`; x.fillText(b, cx, 224);
  });
  x.fillStyle = 'rgba(27,27,31,.14)'; x.fillRect(m, 244, R - m, 1);
  // 开篇跨页用的那张：照片横着裁一段，山脊和云
  drawPhoto(x, m, 262, R - m, 286, 0.6);
  x.fillStyle = grey; x.font = `400 9px ${SANS}`; x.fillText('Opening spread  ·  DSC_8647', m, 566);
  // 两栏正文
  const col = (y0, cx, head, body) => {
    x.fillStyle = ink; x.font = `600 8.5px ${SANS}`; x.letterSpacing = '1.6px'; x.fillText(head, cx, y0); x.letterSpacing = '0px';
    x.fillStyle = '#3a3a40'; x.font = `400 11.5px ${SERIF}`; wrap(x, body, cx, y0 + 20, 240, 16.5);
  };
  col(602, m, '01  THE STORY', 'Twelve pages on the valleys below the eastern ridges, walked over six days in March. Cloud fills the valleys most mornings and burns off by ten, so every picture was made in the first two hours of light.');
  col(602, m + 264, '02  THE PICTURES', 'Twenty-four frames from one camera and two lenses, nothing added or taken out. The opening spread runs the ridge across both pages; the cover crops it tall, with the summit under the masthead and the cloud below.');
  x.fillStyle = 'rgba(27,27,31,.14)'; x.fillRect(m, 790, R - m, 1);
  x.fillStyle = grey; x.font = `400 9px ${SANS}`; x.fillText('Northwind Studio  ·  Above the Clouds', m, 808); x.textAlign = 'right'; x.fillText('1 / 12', R, 808); x.textAlign = 'left';
  x.setTransform(1, 0, 0, 1, 0, 0);
  grain(x, W, Hh, 7, 5);
  return c;
}

/* DSC_8647.JPG：封面用的那张照片本身，按相机原图的比例，不加颗粒、不加暗角 */
export function paintCover(W) {
  const Hh = Math.round((W * PHOTO.h) / PHOTO.w), c = canvas(W, Hh), x = c.getContext('2d');
  drawPhoto(x, 0, 0, W, Hh);
  return c;
}

/* Budget.xlsx 打印出来：这篇专题的一张预算表，加一条钱花在哪儿的横条 */
export function paintBudget(W) {
  const Hh = Math.round(W * Math.SQRT2), c = canvas(W, Hh), x = c.getContext('2d'), k = W / 600;
  x.fillStyle = PAPER; x.fillRect(0, 0, W, Hh); x.scale(k, k);
  const ink = '#1b1b1f', grey = '#8a8a90', green = '#2f7a52', m = 48, R = 552;
  x.fillStyle = ink; x.font = `600 10.5px ${SANS}`; x.letterSpacing = '2.2px'; x.fillText('NORTHWIND STUDIO', m, 58); x.letterSpacing = '0px';
  x.fillStyle = grey; x.font = `400 10.5px ${SANS}`; x.textAlign = 'right'; x.fillText('Estimate  ·  v3', R, 58); x.textAlign = 'left';
  x.fillStyle = ink; x.fillRect(m, 70, R - m, 1);
  x.font = `400 46px ${DISPLAY}`; x.fillText('Budget', m - 1, 124);
  x.font = `italic 400 17px ${DISPLAY}`; x.fillStyle = '#56565c'; x.fillText('Above the Clouds, feature estimate', m, 150);
  const rows = [['Travel & permits', '2', '£1,180', '£2,360'], ['Guide & porters', '6 days', '£165', '£990'], ['Lodging', '6 nights', '£48', '£288'], ['Image licence', '24', '£95', '£2,280'], ['Retouching', '24', '£35', '£840'], ['Layout & proofs', '12 pp', '£120', '£1,440'], ['Printing', '8,000', '£0.42', '£3,360'], ['Contingency 10%', '', '', '£1,156']];
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
  x.font = `600 12.5px ${SANS}`; x.textAlign = 'left'; x.fillText('Total', cols[0], y + 24); x.textAlign = 'right'; x.fillText('£12,714', cols[3], y + 24); x.textAlign = 'left';
  // 钱花在哪儿
  y += 70;
  x.fillStyle = ink; x.font = `600 8.5px ${SANS}`; x.letterSpacing = '1.6px'; x.fillText('SHARE OF COST', m, y); x.letterSpacing = '0px';
  const parts = [['Field', 28.6], ['Print', 26.4], ['Pictures', 24.5], ['Design', 11.3], ['Reserve', 9.1]];
  let bx = m; y += 14;
  parts.forEach(([n, p], i) => {
    const w = (R - m) * p / 100;
    x.fillStyle = `rgba(47,122,82,${0.85 - i * 0.16})`; x.fillRect(bx, y, w - 2, 16);
    x.fillStyle = '#3a3a40'; x.font = `400 9.5px ${SANS}`; x.fillText(n, bx, y + 32); x.fillStyle = grey; x.fillText(p.toFixed(0) + '%', bx, y + 46);
    bx += w;
  });
  y += 84;
  x.fillStyle = '#3a3a40'; x.font = `400 11.5px ${SERIF}`;
  wrap(x, 'Travel is two return flights and the road transfer, booked in October. Guide and porters are a day rate for six days; lodging is guesthouses along the route. Printing assumes 8,000 copies on 130 gsm silk.', m, y, R - m, 16.5);
  x.fillStyle = 'rgba(27,27,31,.14)'; x.fillRect(m, 790, R - m, 1);
  x.fillStyle = grey; x.font = `400 9px ${SANS}`; x.fillText('Northwind Studio  ·  Above the Clouds', m, 808); x.textAlign = 'right'; x.fillText('1 / 2', R, 808); x.textAlign = 'left';
  x.setTransform(1, 0, 0, 1, 0, 0);
  grain(x, W, Hh, 7, 5);
  return c;
}
