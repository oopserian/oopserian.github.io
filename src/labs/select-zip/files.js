/* 文件夹里的八个文件：一组照片随笔的材料。三张照片是真的（同一张山景照和它裁出来的两张），
   别的文件画成单色的纸页，页上一个小图示认出是什么、底下印扩展名。大小、压缩能省多少都照真的文件类型估。 */
import dscUrl from "./assets/dsc-8647.webp?url";
import ridgeUrl from "./assets/ridge.webp?url";
import leavesUrl from "./assets/leaves.webp?url";

export const KB = 1024, MB = 1024 * 1024;

// pack：压成 zip 以后剩下原来的多少。照片、本来就压过的 xlsx/docx 几乎不变，纯文本的 GPX 能压掉八九成
export const FILES = [
  { name: "Budget.xlsx", size: 86 * KB, pack: 0.93 },
  { name: "Captions.docx", size: 48 * KB, pack: 0.9 },
  { name: "DSC_8647.JPG", size: 1433345, pack: 0.98, pic: dscUrl, ar: 1510 / 1000 },
  { name: "Layout.fig", size: 9.6 * MB, pack: 0.58 },
  { name: "Leaves.jpg", size: 1.2 * MB, pack: 0.98, pic: leavesUrl, ar: 3 / 4 },
  { name: "Proposal.pdf", size: 2.4 * MB, pack: 0.86 },
  { name: "Ridge.jpg", size: 1.0 * MB, pack: 0.98, pic: ridgeUrl, ar: 3 / 4 },
  { name: "Route.gpx", size: 1.8 * MB, pack: 0.14 },
];

export const extOf = (n) => (n.includes(".") ? n.split(".").pop() : "").toLowerCase();
export const fmtSize = (b) => (b < MB ? Math.max(1, Math.round(b / KB)) + " KB" : (b / MB).toFixed(1) + " MB");

/** 跟访达一样按名字排：先比去掉扩展名的部分（Archive 在 Archive 2 前面），数字按大小比 */
const stem = (n) => n.replace(/\.[^.]+$/, "");
export const byName = (a, b) => stem(a.name).localeCompare(stem(b.name), "en", { numeric: true, sensitivity: "base" }) || a.name.localeCompare(b.name);

/** 把一组文件压成一个包：名字取 Archive.zip、Archive 2.zip……里第一个没被占的，大小按各自的 pack 加起来 */
export function pack(files, taken) {
  let name = "Archive.zip";
  for (let k = 2; taken.has(name); k++) name = `Archive ${k}.zip`;
  const raw = files.reduce((s, f) => s + f.size, 0), size = files.reduce((s, f) => s + f.size * f.pack, 0);
  return { name, size, pack: 0.99, raw, files: [...files] };
}

/* 纸页：36 × 44 的画布，右上角折一个角。页上的小图示和扩展名都是同一种灰，不分颜色 */
const PAGE = "M6 .75H24L35.25 12V38A5.25 5.25 0 0 1 30 43.25H6A5.25 5.25 0 0 1 .75 38V6A5.25 5.25 0 0 1 6 .75Z";
const GLYPH = {
  // 文档：几行字
  docx: '<path d="M8.5 15.5h19M8.5 19.5h19M8.5 23.5h19M8.5 27.5h12"/>',
  // PDF：一块图，底下两行字
  pdf: '<rect x="8.5" y="13.5" width="19" height="8" rx="1.5" class="fill"/><path d="M8.5 25h19M8.5 28.5h13"/>',
  // 表格：一张小格子
  xlsx: '<rect x="8.5" y="13.5" width="19" height="15" rx="1.5"/><path d="M8.5 18.5h19M8.5 23.5h19M14.83 13.5v15M21.17 13.5v15"/>',
  // 设计稿：一条贝塞尔曲线和它两头的锚点
  fig: '<path d="M10.5 27C12 19 17 15.5 25.5 15.5"/><rect x="8.5" y="25.5" width="4" height="4" rx="1" class="fill"/><rect x="23.5" y="13.5" width="4" height="4" rx="1" class="fill"/>',
  // GPS 轨迹：一条走走停停的路线，终点一个点
  gpx: '<path d="M9.5 27.5c2.5 0 3-4.5 6-4.5s3 2.5 5.5 2.5S24 20 24 16.5"/><circle cx="24" cy="15.5" r="2" class="fill"/><circle cx="9.5" cy="27.5" r="1.4" class="fill"/>',
  // 压缩包：一条拉链和拉头
  zip: '<path d="M18 .75v3M18 6.25v3M18 11.75v3M18 17.25v3" class="zp"/><rect x="15.5" y="21.5" width="5" height="7" rx="1.5"/><path d="M18 24.5v1.5"/>',
};

/** 文件在网格里的样子（64 × 64 的格子里居中）：照片是带白边的小图，按真实的长宽比；别的是纸页 */
export function fileIcon(f, w = 40) {
  if (f.pic) {
    // 横的照片宽 58，竖的高 52，都放得进 64 的格子
    const pw = f.ar > 1 ? Math.round(52 / f.ar) : 58, ph = f.ar > 1 ? 52 : Math.round(58 * f.ar);
    return `<span class="pic" style="width:${pw}px;height:${ph}px"><img src="${f.pic}" alt="" draggable="false"></span>`;
  }
  const ext = extOf(f.name), g = GLYPH[ext] || GLYPH.docx;
  return `<svg class="page" width="${w}" height="${+(w * 44 / 36).toFixed(2)}" viewBox="0 0 36 44" aria-hidden="true">
    <path class="pg" d="${PAGE}"/><path class="fold" d="M24 .75V7.5A4.5 4.5 0 0 0 28.5 12H35.25"/>
    <g class="gl">${g}</g><text x="18" y="38.4" text-anchor="middle">${ext.toUpperCase()}</text></svg>`;
}
