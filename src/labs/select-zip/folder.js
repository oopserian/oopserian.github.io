/* 一个文件夹窗口里八个文件。拖出一个框，框到的文件选中；选中的个数是一颗小药丸，跟着指针走；
   松手它带着惯性飞到窗口底下，长成一条操作栏。压缩把选中的文件吸进按钮，按钮转一圈，吐出一个 Archive.zip 落回网格；
   只选着一个压缩包时同一个按钮是解压，文件从按钮里飞回各自的位置。删除能撤销，删空了有「Put Back」。
   舞台按大小挑排法（4 列 2 行、3 列 3 行、8 列 1 行，哪个让文件最大用哪个），里面按设计像素排，再整体缩放。 */
import { motion, clamp, lerp, easeIO, easeSuck, easeOutBack, Spring, Roll, fly, dtOf } from "./motion.js";
import { FILES, fileIcon, fmtSize, byName, pack } from "./files.js";

const HINT = 30;                          // 舞台底下留给提示那一行（屏幕像素）；提示藏起来时（分享图里）不留
const HEAD = 42, ROWH = 96, BOXH = 88, ICON = 64, PADX = 10, PADB = 8;   // 窗口：标题栏、一行多高、一格多高、图标格、左右和底下的留白
const BH = 52, GAP = 14, TOP = 10, BOT = 4, SIDE = 12;                  // 操作栏多高、离窗口多远，四周最少留多少
const CAP = 1.4;                          // 最多放大到 1.4 倍，再大就不是一个小组件了
const SLOTS = 8;                          // 文件最多八个（压缩只会变少，解压回到原来的数）
const ARRANGE = [{ cols: 4, colw: 104 }, { cols: 3, colw: 112 }, { cols: 8, colw: 104 }];   // 一样大时排在前面的优先
const UNDO_W = 272, UNDO_MS = 5000;
// 操作栏的弹簧：[位置的响应, 位置的回弹, 大小的响应, 大小的回弹]
const SPRING = { ride: [0.11, 0, 0.3, 0.32], bar: [0.52, 0.16, 0.46, 0.14], undo: [0.52, 0.16, 0.46, 0.14], off: [0.3, 0, 0.22, 0] };

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

/** 挂到 Demo.tsx 渲染好的骨架上。返回 { destroy() }，测试用的几个函数也在上面 */
export function create(root) {
  const $ = (s) => root.querySelector(s);
  const si = $(".si"), win = $(".win"), grid = $(".files"), mq = $(".mq"), empty = $(".empty"), bar = $(".bar"), bg = $(".bar .bg"), sr = $(".sr");
  const hint = $(".lab-hint"), rowMain = $(".row.main"), rowUndo = $(".row.undo"), zipB = $(".b.zip"), shareB = $(".b.share"), ring = $(".prog");
  const zipIc = zipB.querySelector(".icm"), shareIc = shareB.querySelector(".icm"), pc = $(".pc");
  const cnt = new Roll($(".cn")), ct = new Roll($(".ct")), t1 = new Roll($(".t1")), sz = new Roll($(".sz")), u1 = new Roll($(".u1"));
  const ac = new AbortController(), on = (t, type, fn, o = {}) => t.addEventListener(type, fn, { ...o, signal: ac.signal });
  const timers = new Set();
  let dead = false;
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); return id; };
  const sleep = (ms) => new Promise((r) => later(r, motion.reduce ? Math.min(ms, 40) : ms));
  const alive = () => !dead;
  const rm = matchMedia("(prefers-reduced-motion: reduce)");
  motion.reduce = rm.matches;
  on(rm, "change", () => { motion.reduce = rm.matches; });

  const st = { items: [], sel: new Set(), drag: null, busy: false, focus: 0, trash: [], undo: null, px: 0, py: 0, touch: false };
  let SCALE = 1, W = 0, H = 0, L = null;

  /* ───────── 排法 ───────── */
  function layout() {
    const w = root.clientWidth, h = root.clientHeight - (hint.offsetParent ? HINT : 0);
    if (w < 40 || h < 40) return;
    let best = null;
    for (const a of ARRANGE) {
      const rows = Math.ceil(SLOTS / a.cols), ww = a.cols * a.colw + 2 * PADX + 2 * SIDE, hh = TOP + HEAD + rows * ROWH + PADB + GAP + BH + BOT;
      const s = Math.min(CAP, w / ww, h / hh);
      if (!best || s > best.s + 0.01) best = { ...a, rows, s };
    }
    SCALE = best.s; W = w / SCALE; H = h / SCALE;
    const winW = best.cols * best.colw + 2 * PADX, winH = HEAD + best.rows * ROWH + PADB;
    const winX = (W - winW) / 2, winY = Math.max(TOP, (H - winH - GAP - BH) / 2);
    const bw = Math.min(336, winW - 12);
    L = { ...best, winW, winH, winX, winY, bw, boxw: best.colw - 4, slotX: W / 2, slotY: winY + winH + GAP + BH / 2 };
    root.dataset.cols = best.cols;
    si.style.width = W + "px"; si.style.height = H + "px"; si.style.transform = `scale(${SCALE})`;
    Object.assign(win.style, { left: winX + "px", top: winY + "px", width: winW + "px", height: winH + "px" });
    win.style.setProperty("--boxw", L.boxw + "px");
    bar.style.setProperty("--bw", bw + "px"); bar.style.setProperty("--uw", Math.min(UNDO_W, bw) + "px");
    fitNames();
    place(true);
    if (B.mode === "bar" || B.mode === "undo") { B.x.snap(L.slotX); B.y.snap(L.slotY); B.w.snap(B.mode === "bar" ? bw : Math.min(UNDO_W, bw)); B.h.snap(BH); }
    render();
  }

  /* ───────── 网格里的文件 ───────── */
  function makeItem(f) {
    const b = el("button", "it", `<span class="ic">${fileIcon(f)}</span><span class="nm">${f.name}</span>`);
    b.type = "button"; b.tabIndex = -1;
    b.setAttribute("role", "option"); b.setAttribute("aria-selected", "false");
    b.setAttribute("aria-label", `${f.name}, ${fmtSize(f.size)}`);
    const it = { f, el: b };
    on(b, "focus", () => { const i = st.items.indexOf(it); if (i >= 0) st.focus = i; });
    grid.appendChild(b);
    if (L) fitName(it);
    return it;
  }
  /** 名字放不下就跟访达一样从中间省略，扩展名留着：DSC_8647.JPG → DSC_…647.JPG */
  let ctx = null;
  function fitName(it) {
    const nm = it.el.querySelector(".nm"), name = it.f.name, max = L.boxw - 12;
    ctx ??= document.createElement("canvas").getContext("2d");
    if (!ctx) return;
    ctx.font = getComputedStyle(nm).font;
    let out = name;
    if (ctx.measureText(name).width > max) {
      const dot = name.lastIndexOf("."), stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : "";
      for (let keep = stem.length - 1; keep >= 1; keep--) {
        out = stem.slice(0, Math.ceil(keep / 2)) + "…" + stem.slice(stem.length - Math.floor(keep / 2)) + ext;
        if (ctx.measureText(out).width <= max) break;
      }
    }
    nm.textContent = out;
  }
  const fitNames = () => st.items.forEach(fitName);
  const posOf = (i) => [PADX + (i % L.cols) * L.colw + 2, HEAD + Math.floor(i / L.cols) * ROWH];
  /** 每个文件待在它的序号该在的那一格；序号变了就滑过去，从 from 往后一个比一个晚 24ms */
  function place(instant, from = 0) {
    if (!L) return;
    st.items.forEach((it, i) => {
      const [x, y] = posOf(i);
      it.el.style.transitionDelay = instant ? "0ms" : Math.max(0, i - from) * 24 + "ms";
      if (instant) it.el.classList.add("now");
      it.el.style.transform = `translate(${x}px,${y}px)`;
    });
    roving();
    const n = st.items.length;
    ct.set(`${n} item${n === 1 ? "" : "s"}`, instant);
    empty.hidden = n > 0 || !!st.undo;
    if (instant) { void grid.offsetWidth; st.items.forEach((it) => it.el.classList.remove("now")); }
  }
  /** 网格里只有一个文件能用 Tab 进来（跟着焦点走），方向键在里面挪 */
  function roving() {
    st.focus = clamp(st.focus, 0, Math.max(0, st.items.length - 1));
    st.items.forEach((it, i) => { it.el.tabIndex = i === st.focus ? 0 : -1; });
  }
  /** 新来的文件（压缩包、解压出来的、撤销回来的）先瞬间站到自己那一格，不从角上滑过来 */
  function settle(news) { void grid.offsetWidth; for (const it of news) it.el.classList.remove("now"); }
  function paintSel() {
    for (const it of st.items) { const v = st.sel.has(it); it.el.classList.toggle("on", v); it.el.setAttribute("aria-selected", String(v)); }
  }
  const say = (s) => { sr.textContent = s; };
  const sizeOf = (list) => list.reduce((s, it) => s + it.f.size, 0);
  const pct = (f) => Math.max(1, Math.round((1 - f.size / f.raw) * 100));
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ───────── 操作栏：藏着、跟着指针的计数、底下的整条、删除后的撤销 ───────── */
  const B = { x: new Spring(0), y: new Spring(0), w: new Spring(0), h: new Spring(0), mode: "off" };
  const pillW = () => Math.max(24, 14 + 7.4 * String(st.sel.size).length);
  /** 计数药丸的中心：鼠标在指针右下，手指在左上（不被手指挡住），都不出舞台 */
  function rideXY() {
    const w = pillW(), h = 24;
    const x = st.touch ? st.px - 34 : st.px + 14 + w / 2, y = st.touch ? st.py - 46 : st.py + 18 + h / 2;
    return [clamp(x, w / 2 + 6, W - w / 2 - 6), clamp(y, h / 2 + 6, H - h / 2 - 6)];
  }
  function setMode(mode) {
    const prev = B.mode;
    if (prev !== mode) {
      B.mode = mode; bar.dataset.s = mode;
      if (mode !== "off") bar.dataset.tone = mode === "ride" ? "accent" : "ink";
      rowMain.inert = mode !== "bar"; rowUndo.inert = mode !== "undo";
      if (mode === "ride" && prev === "off") { const [x, y] = rideXY(); B.x.snap(x); B.y.snap(y); B.w.snap(6); B.h.snap(6); }
      if ((mode === "bar" || mode === "undo") && prev === "off") { B.x.snap(L.slotX); B.y.snap(L.slotY); B.w.snap(L.bw * 0.4); B.h.snap(BH * 0.7); }
      // 收起：在原地缩一点、淡掉
      if (mode === "off") { B.w.t = B.w.x * 0.6; B.h.t = B.h.x * 0.6; B.x.t = B.x.x; B.y.t = B.y.x; }
    }
    kick();
  }
  function targets() {
    if (B.mode === "ride") { const [x, y] = rideXY(); return [x, y, pillW(), 24]; }
    if (B.mode === "bar") return [L.slotX, L.slotY, L.bw, BH];
    return [L.slotX, L.slotY, Math.min(UNDO_W, L.bw), BH];
  }
  let raf = 0;
  const clock = {};
  function kick() { if (!raf && !dead) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (!L) return;
    const dt = dtOf(clock, now);
    if (B.mode !== "off") { const [x, y, w, h] = targets(); B.x.t = x; B.y.t = y; B.w.t = w; B.h.t = h; }
    const [pr, pb, sr2, sb] = SPRING[B.mode];
    B.x.step(dt, pr, pb); B.y.step(dt, pr, pb); B.w.step(dt, sr2, sb); B.h.step(dt, sr2, sb);
    render();
    if (B.x.near() && B.y.near() && B.w.near() && B.h.near()) clock.lt = 0; else kick();
  }
  /** 栏本身一直是整条那么大，只用 clip-path 露出中间一块圆角矩形；动的只有 transform 和 clip-path */
  function render() {
    if (!L) return;
    const w = Math.max(0, B.w.x), h = Math.max(0, B.h.x), m = 8;   // .bg 比栏大出 8px 一圈，回弹冲过头时不被裁
    bar.style.transform = `translate(${(B.x.x - L.bw / 2).toFixed(2)}px,${(B.y.x - BH / 2).toFixed(2)}px)`;
    bg.style.clipPath = `inset(${((BH + 2 * m - h) / 2).toFixed(2)}px ${((L.bw + 2 * m - w) / 2).toFixed(2)}px round ${(Math.min(w, h) / 2).toFixed(2)}px)`;
  }

  /** 栏上的字：一个文件写它的名字，几个写「N selected」；只选着一个压缩包时，压缩按钮换成解压 */
  function paintBar() {
    if (st.busy || !st.sel.size) return;
    const picked = st.items.filter((it) => st.sel.has(it)), one = picked.length === 1 ? picked[0].f : null, zip = one && one.files ? one : null;
    t1.set(one ? one.name : `${picked.length} selected`);
    sz.set(fmtSize(sizeOf(picked)));
    if (zip) pc.textContent = ` · ${pct(zip)}% smaller`;
    pc.classList.toggle("on", !!zip);
    zipIc.classList.toggle("on", !!zip);
    zipB.setAttribute("aria-label", zip ? "Extract" : "Compress");
  }
  function announce() {
    const picked = st.items.filter((it) => st.sel.has(it));
    if (!picked.length) return say("No files selected");
    say(`${picked.length === 1 ? picked[0].f.name : `${picked.length} files`} selected, ${fmtSize(sizeOf(picked))}`);
  }
  function syncBar() {
    if (st.drag && st.drag.on) return;
    if (st.sel.size) { setMode("bar"); paintBar(); }
    else if (B.mode !== "undo") setMode("off");
  }

  /* ───────── 框选 ───────── */
  function local(e) { const r = win.getBoundingClientRect(); return [(e.clientX - r.left) / SCALE, (e.clientY - r.top) / SCALE]; }
  function stageXY(e) { const r = si.getBoundingClientRect(); return [(e.clientX - r.left) / SCALE, (e.clientY - r.top) / SCALE]; }
  function boxStart(gx, gy, add, it) { st.drag = { x0: gx, y0: gy, add, it, on: false, base: add ? new Set(st.sel) : new Set() }; }
  function boxMove(gx, gy) {
    const d = st.drag; if (!d) return;
    if (!d.on) {
      // 鼠标动 4px 就拉框；手指要横着走够 8px 才算（竖着走是在滚页面，浏览器马上会接手，不能先把选择改了）
      const dx = Math.abs(gx - d.x0), dy = Math.abs(gy - d.y0);
      if (st.touch ? dx < 8 || dx < dy : Math.hypot(dx, dy) < 4) return;
      d.on = true; commitUndo(); mq.classList.add("on");
    }
    const x1 = clamp(Math.min(d.x0, gx), 0, L.winW), y1 = clamp(Math.min(d.y0, gy), HEAD - 6, L.winH);
    const x2 = clamp(Math.max(d.x0, gx), 0, L.winW), y2 = clamp(Math.max(d.y0, gy), HEAD - 6, L.winH);
    mq.style.transform = `translate(${x1}px,${y1}px)`; mq.style.width = x2 - x1 + "px"; mq.style.height = Math.max(0, y2 - y1) + "px";
    const sel = new Set(d.base);
    st.items.forEach((it, i) => { const [x, y] = posOf(i); if (x < x2 && x + L.boxw > x1 && y < y2 && y + BOXH > y1) sel.add(it); });
    const changed = sel.size !== st.sel.size || [...sel].some((it) => !st.sel.has(it));
    st.sel = sel;
    if (changed) paintSel();
    if (st.sel.size) { cnt.set(String(st.sel.size)); setMode("ride"); } else setMode("off");
  }
  function boxEnd(cancelled) {
    const d = st.drag; st.drag = null; if (!d) return;
    if (!d.on) {
      if (cancelled) return;
      // 点了一下：点在文件上就加选或者取消它，点在空白处就全不选
      commitUndo();
      if (d.it) { st.sel.has(d.it) ? st.sel.delete(d.it) : st.sel.add(d.it); } else st.sel.clear();
      paintSel(); syncBar(); announce(); return;
    }
    mq.classList.remove("on");
    syncBar(); announce();
  }
  on(win, "pointerdown", (e) => {
    if (e.button !== 0 || st.busy || e.target.closest(".empty")) return;
    const it = st.items.find((x) => x.el.contains(e.target));
    st.touch = e.pointerType === "touch";
    [st.px, st.py] = stageXY(e);
    boxStart(...local(e), e.shiftKey || e.metaKey || e.ctrlKey, it);
    win.setPointerCapture(e.pointerId);
  });
  on(win, "pointermove", (e) => { if (!st.drag) return; [st.px, st.py] = stageXY(e); boxMove(...local(e)); });
  on(win, "pointerup", () => boxEnd(false));
  // 触屏上竖着划是在滚页面（touch-action: pan-y），浏览器接手时发 pointercancel：框已经拉开就按松手算，没拉开就当没发生
  on(win, "pointercancel", () => boxEnd(true));
  // 点窗口外面的空地：全不选
  on(root, "pointerdown", (e) => {
    if (st.busy || win.contains(e.target) || bar.contains(e.target) || !st.sel.size) return;
    st.sel.clear(); paintSel(); syncBar(); announce();
  });

  /* ───────── 键盘：方向键走，空格或回车选，Shift 连着选，⌘A 全选，Esc 全不选，Delete 删 ───────── */
  on(win, "keydown", (e) => {
    if (st.busy || !e.target.closest(".it")) return;
    const n = st.items.length, k = e.key;
    let to = null;
    if (k === "ArrowRight") to = Math.min(n - 1, st.focus + 1);
    else if (k === "ArrowLeft") to = Math.max(0, st.focus - 1);
    else if (k === "ArrowDown") to = Math.min(n - 1, st.focus + L.cols);
    else if (k === "ArrowUp") to = Math.max(0, st.focus - L.cols);
    else if (k === "Home") to = 0;
    else if (k === "End") to = n - 1;
    else if (k === " " || k === "Enter") {
      e.preventDefault(); commitUndo();
      const it = st.items[st.focus]; st.sel.has(it) ? st.sel.delete(it) : st.sel.add(it);
      paintSel(); syncBar(); announce(); return;
    } else if ((k === "a" || k === "A") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault(); commitUndo(); st.sel = new Set(st.items); paintSel(); syncBar(); announce(); return;
    } else if ((k === "Delete" || k === "Backspace") && st.sel.size) { e.preventDefault(); remove(true); return; }
    if (to === null) return;
    e.preventDefault();
    if (e.shiftKey) { commitUndo(); st.sel.add(st.items[st.focus]); st.sel.add(st.items[to]); paintSel(); syncBar(); announce(); }
    st.focus = to; st.items.forEach((it, i) => { it.el.tabIndex = i === to ? 0 : -1; }); st.items[to].el.focus();
  });
  on(root, "keydown", (e) => {
    if (e.key !== "Escape" || st.busy || !st.sel.size) return;
    const inBar = bar.contains(e.target);
    st.sel.clear(); paintSel(); syncBar(); announce();
    if (inBar) focusGrid();
  });
  const focusGrid = () => { const it = st.items[clamp(st.focus, 0, st.items.length - 1)]; if (it) it.el.focus({ preventScroll: true }); else if (!empty.hidden) $(".put").focus({ preventScroll: true }); };

  // 栏上的按钮；e.detail 是 0 说明是键盘按的，做完把焦点放回网格
  on($(".b.x"), "click", (e) => { if (st.busy) return; st.sel.clear(); paintSel(); syncBar(); announce(); if (!e.detail) focusGrid(); });
  on(shareB, "click", () => { if (!st.busy && st.sel.size) share(); });
  on(zipB, "click", (e) => {
    if (st.busy || !st.sel.size) return;
    const kb = !e.detail, picked = st.items.filter((it) => st.sel.has(it));
    picked.length === 1 && picked[0].f.files ? extract(kb) : compress(kb);
  });
  on($(".b.del"), "click", (e) => { if (!st.busy && st.sel.size) remove(!e.detail); });
  on($(".ub"), "click", (e) => undo(!e.detail));
  on($(".put"), "click", (e) => putBack(!e.detail));

  /* ───────── 动作 ───────── */
  function share() {
    shareIc.classList.add("on"); t1.set("Link copied"); say("Link copied");
    later(() => { shareIc.classList.remove("on"); paintBar(); }, 1600);
  }
  // 网格里一个文件的图标中心（舞台坐标）：起飞时用它现在真正在的地方，落地时用它那一格
  function rectCenter(node) { const r = node.getBoundingClientRect(), b = si.getBoundingClientRect(); return [(r.left - b.left + r.width / 2) / SCALE, (r.top - b.top + r.height / 2) / SCALE]; }
  function slotCenter(it) { const [x, y] = posOf(st.items.indexOf(it)); return [L.winX + x + L.boxw / 2, L.winY + y + ICON / 2]; }
  function flyer(it) { const f = el("div", "fly", it.el.querySelector(".ic").innerHTML); si.appendChild(f); return f; }
  const pulse = () => zipB.animate([{ transform: "scale(1)" }, { transform: "scale(1.16)" }, { transform: "scale(1)" }], { duration: motion.reduce ? 1 : 260, easing: "ease-out" });
  const suck = (fl, a, b, delay = 0) => fly(fl, a, b, { ms: 540, delay, lift: 36, s1: 0.26, ease: easeSuck, o0: 1, o1: 0, oe: (u) => clamp((u - 0.75) / 0.25) }, alive);
  const spit = (fl, a, b, delay = 0) => fly(fl, a, b, { ms: 660, delay, lift: 80, s0: 0.3, s1: 1, ease: (t) => easeOutBack(t, 0.7), o0: 0, o1: 1, oe: (u) => clamp(u / 0.2) }, alive);
  // 所有用过的名字：网格里的、包里的（一层层往里）、等着撤销的、废纸篓里的。新的压缩包避开它们，解压出来就不会重名
  const names = (fs) => fs.flatMap((f) => [f.name, ...(f.files ? names(f.files) : [])]);
  const taken = () => new Set(names([...st.items.map((it) => it.f), ...st.trash, ...(st.undo ? st.undo.files : [])]));
  function busy(v) { st.busy = v; root.classList.toggle("busy", v); }
  function runRing(ms) {
    ring.style.setProperty("--ring", ms + "ms");
    ring.classList.remove("full"); void ring.getBoundingClientRect(); ring.classList.add("run");
  }

  /** 压缩：选中的一个个被吸进按钮，别的文件马上让位、给压缩包留出按名字该在的那一格；
      按钮转一圈，栏上的大小跟着一路往下数；最后压缩包从按钮里弹出来，落进那一格，选中它 */
  async function compress(kb) {
    busy(true);
    const picked = st.items.filter((it) => st.sel.has(it));
    const zf = pack(picked.map((it) => it.f), taken());
    t1.set("Compressing…"); sz.set(fmtSize(zf.raw)); pc.classList.remove("on");
    say(`Compressing ${plural(picked.length, "file")}`);
    const zc = rectCenter(zipB);
    const inbound = picked.map((it, k) => {
      const fl = flyer(it), a = rectCenter(it.el.querySelector(".ic"));
      it.el.classList.add("away");
      return suck(fl, a, zc, k * 70).then(() => { fl.remove(); pulse(); });
    });
    await sleep(140);
    if (dead) return;
    const first = st.items.indexOf(picked[0]);
    for (const it of picked) it.el.remove();
    const z = makeItem(zf); z.el.classList.add("now", "wait");
    st.items = [...st.items.filter((it) => !st.sel.has(it)), z].sort((a, b) => byName(a.f, b.f));
    st.sel = new Set(); paintSel();
    st.focus = st.items.indexOf(z);
    place(false, Math.min(first, st.focus)); settle([z]);
    await Promise.all(inbound);
    if (dead) return;
    // 转一圈，大小分六步数下去
    const RING = 900;
    runRing(RING);
    for (let k = 1; k <= 6; k++) { await sleep(RING / 6); sz.set(fmtSize(lerp(zf.raw, zf.size, easeIO(k / 6)))); }
    if (dead) return;
    ring.classList.replace("run", "full");
    const fl = flyer(z);
    await spit(fl, zc, slotCenter(z));
    if (dead) return;
    fl.remove(); z.el.style.transitionDelay = "0ms"; z.el.classList.remove("wait");
    ring.classList.remove("full");
    st.sel = new Set([z]); paintSel();
    busy(false); paintBar();
    say(`${zf.name} created, ${fmtSize(zf.size)}, ${pct(zf)}% smaller`);
    if (kb) z.el.focus({ preventScroll: true });
  }

  /** 解压：压缩包被吸进按钮，别的文件让开，给里面的文件按名字留出位置；按钮转一圈，文件一个个弹回去，都选中 */
  async function extract(kb) {
    busy(true);
    const z = st.items.find((it) => st.sel.has(it)), files = z.f.files;
    t1.set("Extracting…"); sz.set(plural(files.length, "file")); pc.classList.remove("on");
    say(`Extracting ${z.f.name}`);
    const zc = rectCenter(zipB), fl = flyer(z), a = rectCenter(z.el.querySelector(".ic"));
    z.el.classList.add("away");
    const inbound = suck(fl, a, zc).then(() => { fl.remove(); pulse(); });
    await sleep(140);
    if (dead) return;
    const at = st.items.indexOf(z);
    z.el.remove();
    const back = files.map(makeItem);
    back.forEach((it) => it.el.classList.add("now", "wait"));
    st.items = [...st.items.filter((it) => it !== z), ...back].sort((p, q) => byName(p.f, q.f));
    st.sel = new Set(); paintSel();
    st.focus = st.items.indexOf(back[0]);
    place(false, Math.min(at, ...back.map((it) => st.items.indexOf(it)))); settle(back);
    await inbound;
    if (dead) return;
    const RING = 600;
    runRing(RING); await sleep(RING);
    if (dead) return;
    ring.classList.replace("run", "full");
    await Promise.all(back.map((it, k) => {
      const f2 = flyer(it);
      return spit(f2, zc, slotCenter(it), k * 80).then(() => { f2.remove(); it.el.style.transitionDelay = "0ms"; it.el.classList.remove("wait"); });
    }));
    if (dead) return;
    ring.classList.remove("full");
    st.sel = new Set(back); paintSel();
    busy(false); paintBar();
    say(`${plural(back.length, "file")} extracted`);
    if (kb) back[0].el.focus({ preventScroll: true });
  }

  /** 删除：选中的模糊、缩小、淡掉，后面的补上来；栏变成「N files deleted · Undo」，5 秒后自己收起 */
  function remove(kb) {
    const gone = st.items.filter((it) => st.sel.has(it)), first = st.items.indexOf(gone[0]);
    commitUndo();
    for (const it of gone) { it.el.classList.add("gone"); it.el.style.transitionDelay = "0ms"; const node = it.el; later(() => node.remove(), 420); }
    st.items = st.items.filter((it) => !st.sel.has(it)); st.sel = new Set(); paintSel();
    st.undo = { files: gone.map((it) => it.f), timer: later(() => commitUndo(true), UNDO_MS) };
    st.focus = clamp(first, 0, Math.max(0, st.items.length - 1));
    later(() => place(false, first), 120);
    u1.set(`${plural(gone.length, "file")} deleted`);
    setMode("undo");
    say(`${plural(gone.length, "file")} deleted. Undo is in the toolbar.`);
    if (kb) later(focusGrid, 200);
  }
  /** 撤销的机会过了（时间到了，或者又开始选别的）：删掉的进废纸篓，删空了就露出「Put Back」 */
  function commitUndo(timeout) {
    const u = st.undo; if (!u) return;
    clearTimeout(u.timer); st.undo = null;
    st.trash.push(...u.files);
    if (B.mode === "undo") setMode(st.sel.size ? "bar" : "off");
    empty.hidden = st.items.length > 0;
    if (timeout && document.activeElement && rowUndo.contains(document.activeElement)) focusGrid();
  }
  /** 放回来的文件站回按名字该在的那一格，从模糊里显出来，旁边的让开 */
  function restore(files) {
    const back = files.map(makeItem);
    back.forEach((it) => it.el.classList.add("now", "born"));
    st.items = [...st.items, ...back].sort((p, q) => byName(p.f, q.f));
    place(false, Math.min(...back.map((it) => st.items.indexOf(it)))); settle(back);
    requestAnimationFrame(() => back.forEach((it) => it.el.classList.remove("born")));
    return back;
  }
  function undo(kb) {
    const u = st.undo; if (!u || st.busy) return;
    clearTimeout(u.timer); st.undo = null;
    const back = restore(u.files);
    st.sel = new Set(back); paintSel();
    st.focus = st.items.indexOf(back[0]); roving();
    setMode("bar"); paintBar();
    say(`${plural(back.length, "file")} restored`);
    if (kb) back[0].el.focus({ preventScroll: true });
  }
  function putBack(kb) {
    if (!st.trash.length) return;
    const back = restore(st.trash.splice(0));
    st.focus = st.items.indexOf(back[0]); roving();
    say(`${plural(back.length, "file")} put back`);
    if (kb) back[0].el.focus({ preventScroll: true });
  }

  /* ───────── 开始 ───────── */
  st.items = FILES.map(makeItem).sort((a, b) => byName(a.f, b.f));
  rowMain.inert = true; rowUndo.inert = true; bar.dataset.tone = "ink";
  const ro = new ResizeObserver(layout);
  ro.observe(root);
  layout();

  return {
    /** 分享图的样子：照片随笔里的四样（两张照片、提案、图注）选中，栏停在底下 */
    pose() {
      layout();   // 分享图把提示藏了，底下不用再留那一行
      st.sel = new Set(st.items.filter((it) => ["Captions.docx", "DSC_8647.JPG", "Proposal.pdf", "Ridge.jpg"].includes(it.f.name)));
      paintSel(); syncBar();
    },
    destroy() {
      dead = true; ac.abort(); ro.disconnect(); cancelAnimationFrame(raf);
      timers.forEach(clearTimeout); timers.clear();
      si.querySelectorAll(".fly").forEach((n) => n.remove());
      grid.textContent = "";
    },
    // 测试用
    st, boxStart, boxMove, boxEnd, compress, extract, remove, undo, putBack, layout,
    get mode() { return B.mode; }, get layout_() { return L; }, get scale() { return SCALE; },
    names: () => st.items.map((it) => it.f.name), selected: () => st.items.filter((it) => st.sel.has(it)).map((it) => it.f.name),
  };
}
