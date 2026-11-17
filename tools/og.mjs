/* 给每个实验截两样图：分享图（链接贴到 X、微信这些地方时显示的那张大图）和首页预览框里的小图。

     pnpm build && node tools/og.mjs              # 全部实验
     pnpm build && node tools/og.mjs ascii-clouds # 只截这几个
     pnpm build && node tools/og.mjs --thumbs     # 只截预览小图（--og 只截分享图），可以跟实验名一起写

   分享图：public/og/lab/<slug>.png，1200×630，深色主题。详情页（src/pages/lab/[slug].astro）有这张图就用它，
   没有就用全站的 public/og.png。
   预览小图：public/thumb/lab/<slug>-light.webp、<slug>-dark.webp，浅色深色各一张，只有舞台、不带字，
   1068×560（舞台 534×280 按 2 倍截，跟首页 SOOTY 海报一样是 1200:630 的比例）。首页首屏的实验目录指到哪个，右上的预览框就换成它（见 Hero.astro）；
   没截的显示一块斜条纹。
   截完要再 pnpm build 一次，提交时把图一起提交。改了实验的样子、标题、一句话要重截。

   做法：自己起一个小服务器放 dist/，用 Playwright 按 1200×630、2 倍像素开实验详情页的整窗模式（?focus，录屏用的那个），
   再加一段样式调成卡片：上面是标题和一句话（最多两行），下面是带 1px 细线的舞台撑满剩下的高度，底下那行日期和 @oopserian 换成右下角的 eooo.me；
   等实验画出来，按 1 倍（scale: "css"）截下来：字符画一格只有 8px，按 2 倍画再缩小才不糊。
   无头浏览器没有显卡，WebGL 的实验只画一帧静止的，正好拿来截。
   要 Playwright 的 Chromium：第一次先跑 pnpm exec playwright install chromium。 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(ROOT, "public", "og", "lab");
const THUMBS = path.join(ROOT, "public", "thumb", "lab");
if (!fs.existsSync(path.join(DIST, "lab"))) { console.error("先跑 pnpm build"); process.exit(1); }

const all = fs.readdirSync(path.join(DIST, "lab")).filter((d) => fs.existsSync(path.join(DIST, "lab", d, "index.html")));
const args = process.argv.slice(2);
const want = args.filter((a) => !a.startsWith("--"));
const doOg = !args.includes("--thumbs");
const doThumbs = !args.includes("--og");
const slugs = want.length ? want : all;
for (const s of slugs) if (!all.includes(s)) { console.error(`dist 里没有 /lab/${s}/`); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(THUMBS, { recursive: true });

// 放 dist/ 的小服务器：/lab/x/ 找 index.html
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (p.startsWith(DIST) && fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
server.listen(0);
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;

// 整窗模式已经只剩标题、舞台和底下一行，再调成卡片。只藏、只挪，不改实验自己的样子
const CARD = `
  .lab .caption, .lab-hint { display: none !important; }
  .lab .shot { padding: 44px 56px 56px !important; }
  .lab header { margin: 0 0 24px !important; max-width: 920px !important; }
  .lab h1 { --size: 44px !important; }
  .lab .summary { margin-top: 10px !important; font-size: 17px !important; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  /* 小组件在大舞台里显得空，放大一点；整块铺满的字符画（有 canvas 的）不放大 */
  .lab .frame astro-island:not(:has(canvas)) { transform: scale(1.25); }
  .og-mark { position: fixed; right: 56px; bottom: 19px; font: 400 13px/1 var(--mono); color: var(--fg-3); letter-spacing: 0.02em; }
`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
for (const slug of doOg ? slugs : []) {
  await page.goto(`${base}/lab/${slug}/?focus`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: CARD });
  await page.evaluate(() => {
    const mark = document.createElement("div");
    mark.className = "og-mark";
    mark.textContent = "eooo.me";
    document.body.append(mark);
    return document.fonts.ready;
  });
  await page.waitForSelector(".lab .frame astro-island:not([ssr])", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);   // 等实验挂上、WebGL 画完那一帧
  const file = path.join(OUT, `${slug}.png`);
  await page.screenshot({ path: file, scale: "css" });
  console.log(`${slug}: ${path.relative(ROOT, file)}，${Math.round(fs.statSync(file).size / 1024)} KB`);
}
await context.close();

// 预览小图：整窗模式里只留舞台，窗口就是舞台（534×280，跟首页卡片上的舞台一样高），浅色深色各截一张。
// 截出来是 PNG，交给浏览器自己的 canvas 转成 WebP（不用另装 sharp 这类库），质量 0.8
const THUMB = `
  .lab header, .lab .caption, .lab-hint { display: none !important; }
  html[data-focus] .lab .shot { padding: 0 !important; }
  .lab .frame { border: 0 !important; }
`;
for (const scheme of doThumbs ? ["light", "dark"] : []) {
  const ctx = await browser.newContext({ viewport: { width: 534, height: 280 }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: "reduce" });
  const tab = await ctx.newPage();
  tab.on("pageerror", (e) => errors.push(e.message));
  for (const slug of slugs) {
    await tab.goto(`${base}/lab/${slug}/?focus`, { waitUntil: "networkidle" });
    await tab.addStyleTag({ content: THUMB });
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForSelector(".lab .frame astro-island:not([ssr])", { timeout: 15000 }).catch(() => {});
    await tab.waitForTimeout(2500);
    const png = await tab.screenshot();
    const webp = await tab.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      return c.toDataURL("image/webp", 0.8).split(",")[1];
    }, png.toString("base64"));
    const file = path.join(THUMBS, `${slug}-${scheme}.webp`);
    fs.writeFileSync(file, Buffer.from(webp, "base64"));
    console.log(`${slug}: ${path.relative(ROOT, file)}，${Math.round(fs.statSync(file).size / 1024)} KB`);
  }
  await ctx.close();
}

await browser.close();
server.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
