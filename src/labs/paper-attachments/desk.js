/* 桌上三份文件、一个对话框：拿起、拖着走、放进对话框、发出去。纸本身在 paper.js，这里管页面上的那一份和整个流程。
   舞台按大小选三种排法：宽的（首页卡片、详情页）文件在左、对话在右；竖的（手机详情页）对话在上、文件在下；
   又矮又窄的（手机上的首页卡片）文件排成一列小图。里面都按设计像素排，再整体缩放到舞台上，WebGL 的画布跟着同一个比例。 */
import { iconSvg } from "../_kit/icons";
import { motion, clamp, easeIO } from "./motion.js";
import { createPaper } from "./paper.js";
import { fontsReady, paintProposal, paintCover, paintBudget } from "./pages.js";

const HINT = 30;   // 舞台底下留给提示那一行的高度（屏幕像素）
const FILES = [
  { key: "proposal", name: "Proposal.pdf", meta: "12 pages · 2.4 MB", paint: paintProposal, ar: Math.SQRT2, ear: true, gloss: 0.06, shine: 10 },
  { key: "cover", name: "Cover.jpg", meta: "4032 × 5040 · 3.1 MB", paint: paintCover, ar: 1.25, ear: false, gloss: 0.3, shine: 46, stiff: 1 },
  { key: "budget", name: "Budget.xlsx", meta: "2 pages · 48 KB", paint: paintBudget, ar: Math.SQRT2, ear: true, gloss: 0.06, shine: 10 },
];
const THREAD0 = `<div class="day">Monday, 16:05</div><div class="msg them">Can you take another pass at the canopy? It feels heavy from the river side.</div><div class="msg me">Yes. I'll thin the ribs and send a new set on Wednesday.</div><div class="day">Yesterday, 18:12</div><div class="msg me">Draft's nearly done. Just tidying up the drawings.</div><div class="msg them">No rush, tomorrow morning is fine.</div><div class="day">Today, 09:41</div><div class="msg them">Morning! Could you send the proposal and the cover shot before the 3pm review?</div>`;

let grainURL = null;   // 桌面的细颗粒，生成一次大家共用
function grain() {
  if (grainURL !== null) return grainURL;
  grainURL = "";
  try {
    const g = document.createElement("canvas"); g.width = g.height = 180;
    const x = g.getContext("2d"), id = x.createImageData(180, 180);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = Math.random() * 13; }
    x.putImageData(id, 0, 0);
    grainURL = `url(${g.toDataURL()})`;
  } catch { /* 没有颗粒也行 */ }
  return grainURL;
}

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

/** 字一个一个地换：新旧两个词里位置相同的字母不动，其余的带一点模糊交叉淡入淡出（对话框的占位字、「Delivered」） */
class Roll {
  constructor(node) { this.el = node; this.s = null; this.cells = []; node.classList.add("roll"); }
  set(s, instant) {
    s = String(s); if (s === this.s) return;
    const old = this.s; this.s = s;
    if (old === null || instant || motion.reduce) { this.el.textContent = ""; this.cells = [...s].map((ch) => this.cell(ch)); this.cells.forEach((c) => this.el.appendChild(c)); return; }
    const A = [...old], B = [...s], d = B.length - A.length;
    let l = 0, r = 0;
    for (let i = 0; i < B.length; i++) { if (A[i] === B[i]) l++; if (A[i - d] === B[i]) r++; }
    const off = r > l ? d : 0, next = [], ow = new Map(this.cells.map((c) => [c, c.offsetWidth]));
    for (let i = 0; i < B.length; i++) {
      const j = i - off, c = j >= 0 && j < A.length ? this.cells[j] : null;
      if (c) { if (A[j] !== B[i]) this.swap(c, B[i]); next.push(c); }
      else { const n = this.cell(""); this.swap(n, B[i]); next.push(n); }
    }
    const used = new Set(next), leaving = this.cells.filter((c) => !used.has(c));
    for (const c of leaving) { c.classList.add("gone"); setTimeout(() => c.remove(), 520); }
    const order = off ? [...leaving, ...next] : [...next, ...leaving];
    for (const c of order) this.el.appendChild(c);
    this.cells = next;
    for (const c of order) {
      const from = ow.get(c) ?? 0;
      c.style.transition = "none"; c.style.width = "";
      const to = leaving.includes(c) ? 0 : c.offsetWidth;
      if (from === to) continue;
      c.style.width = from + "px"; c.classList.add("cl"); void c.offsetWidth;
      c.style.transition = ""; c.style.width = to + "px";
    }
    clearTimeout(this._t);
    this._t = setTimeout(() => this.cells.forEach((c) => { c.style.width = ""; c.classList.remove("cl"); }), 700);
  }
  cell(ch) { const c = el("span", "rc"), g = el("span", "rg"); g.textContent = ch; c.appendChild(g); c._g = g; return c; }
  swap(c, ch) {
    const og = c._g, ng = el("span", "rg"); ng.textContent = ch;
    og.classList.add("old"); ng.classList.add("new");
    c.appendChild(ng); c._g = ng;
    void ng.offsetWidth; ng.classList.remove("new");
    setTimeout(() => og.remove(), 480);
  }
}

/** 挂到 Demo.tsx 渲染好的骨架上。返回 { theme(dark), destroy() }，测试用的几个函数也在上面 */
export function create(root) {
  const $ = (s) => root.querySelector(s);
  const si = $(".si"), thread = $(".thread"), field = $(".field"), atts = $(".atts"), sendB = $(".send"), filesEl = $(".files"), canvas = $(".gl");
  const ph = new Roll($(".ph")); ph.set("Message", true);
  const ac = new AbortController(), on = (t, type, fn, o = {}) => t.addEventListener(type, fn, { ...o, signal: ac.signal });
  const timers = new Set();
  let dead = false;
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); return id; };
  const sleep = (ms) => new Promise((r) => later(r, ms));
  const EASE = getComputedStyle(root).getPropertyValue("--lab-ease").trim() || "ease";
  const MOVE_MS = 450;   // 对话往上让、附件那一行开合，都是这么长、同一条曲线

  root.style.setProperty("--grain", grain());
  const rm = matchMedia("(prefers-reduced-motion: reduce)");
  motion.reduce = rm.matches;
  on(rm, "change", () => { motion.reduce = rm.matches; });

  let Paper = null;
  try { Paper = createPaper(canvas); } catch (e) { console.warn(e); Paper = null; }
  const files = FILES.map((f) => ({ ...f }));
  let W = 420, H = 560, SCALE = 1, ATT = 56, AH = 66, PG = 92, drag = null, sending = false, gen = 0, ready = false;
  const delivered = new Set();

  /* ───────── 排版：按舞台的大小选排法和缩放 ───────── */
  function layout() {
    const w = root.clientWidth, h = root.clientHeight - HINT;
    if (w < 40 || h < 40) return;
    let mode, s;
    if (w >= 560 && w / (h + HINT) >= 1.15) { mode = "wide"; s = clamp(Math.min(w / 720, h / 400), 0.9, 1.45); }
    else if (h >= 410) { mode = "tall"; s = clamp(Math.min(w / 400, h / 540), 0.82, 1.25); }
    else { mode = "compact"; s = clamp(Math.min(w / 390, h / 250), 0.72, 1.1); }
    SCALE = s; W = w / s; H = h / s;
    root.dataset.mode = mode;
    si.style.width = W + "px"; si.style.height = H + "px"; si.style.transform = `scale(${s})`;
    // 小图多高、拿在手里多宽、附件和发出去的页多高：都跟着排法走
    const th = mode === "compact" ? 58 : mode === "tall" ? 84 : clamp(H * 0.3, 86, 124);
    const lift = mode === "compact" ? 104 : mode === "tall" ? 132 : clamp(H * 0.36, 120, 146);
    ATT = mode === "compact" ? 44 : 56; AH = ATT + 10; PG = mode === "compact" ? 68 : 92;
    si.style.setProperty("--th", th + "px"); si.style.setProperty("--att", ATT + "px"); si.style.setProperty("--pg", PG + "px");
    for (const f of files) f.w = lift * (f.stiff ? 1.04 : 1);
    if (atts.children.length) { atts.style.transition = "none"; atts.style.height = AH + "px"; void atts.offsetHeight; atts.style.transition = ""; }
    Paper?.resize(W, H, s * Math.min(2, devicePixelRatio || 1));
    clip();
  }
  const ro = new ResizeObserver(layout);
  ro.observe(root);

  function rectOf(node) {
    const r = node.getBoundingClientRect(), b = si.getBoundingClientRect();
    return { x: (r.left - b.left) / SCALE, y: (r.top - b.top) / SCALE, w: r.width / SCALE, h: r.height / SCALE };
  }
  function pt(e) { const b = si.getBoundingClientRect(); return [(e.clientX - b.left) / SCALE, (e.clientY - b.top) / SCALE]; }

  /* ───────── 桌上的文件 ───────── */
  for (const f of files) {
    const b = el("button", "file"); b.type = "button";
    b.innerHTML = `<span class="th${f.ear ? " ear" : ""}" style="--ar:${f.ar.toFixed(4)}"><img alt="">${f.ear ? '<i class="ea"></i><i class="es"></i>' : ""}<i class="dent"></i></span><span class="nm"><b>${f.name}</b><span>${f.meta}</span></span>`;
    b.setAttribute("aria-label", `Attach ${f.name}, ${f.meta}`); b.setAttribute("aria-pressed", "false");
    f.el = b; f.th = b.querySelector(".th"); f.img = b.querySelector("img"); f.state = "desk";
    filesEl.appendChild(b);
    on(b, "pointerdown", (e) => {
      if (e.button !== 0 || !ready || f.sheet || drag || sending) return;
      // 已经附上的：点桌上空着的那格，它从对话框里回来（跟键盘的 Enter 一样，是个开关）
      if (f.state === "att") { e.preventDefault(); autoRemove(f); return; }
      if (f.state !== "desk") return;
      e.preventDefault(); b.setPointerCapture(e.pointerId);
      const [x, y] = pt(e); grab(f, x, y, "desk", e.pointerId);
    });
    on(b, "keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault(); if (sending || !ready) return;
      if (f.state === "desk") autoAttach(f); else if (f.state === "att") autoRemove(f);
    });
  }
  on(window, "pointermove", (e) => { if (drag && drag.pid === e.pointerId) { const [x, y] = pt(e); move(x, y); } });
  on(window, "pointerup", (e) => { if (drag && drag.pid === e.pointerId) { const [x, y] = pt(e); drop(x, y); } });
  on(window, "pointercancel", (e) => { if (drag && drag.pid === e.pointerId) drop(-1e4, -1e4); });

  const spec = (f, from) => ({ tex: f.tex?.tex, w: f.w, ar: f.ar, gloss: f.gloss, shine: f.shine, stiff: f.stiff || 0, ear: from === "desk" && f.ear });

  /* ───────── 拿起、拖着走、放下 ───────── */
  function grab(f, x, y, from, pid) {
    if (f.sheet) return null;
    const node = from === "att" ? f.tile : f.th, r = rectOf(node);
    f.sheet = Paper ? Paper.lift(spec(f, from), r, x, y) : Flat.lift(f, r, x, y);
    if (Paper) Paper.draw();   // 纸在小图藏起来的同一帧出现
    if (from === "desk") f.el.classList.add("lifted"); else f.tile.classList.add("away");
    f.state = "held";
    drag = { f, from, x0: x, y0: y, moved: false, pid: pid ?? "auto" };
    updSend();
    return drag;
  }
  function move(x, y) {
    if (!drag) return;
    if (Math.hypot(x - drag.x0, y - drag.y0) > 5) drag.moved = true;
    const over = overField(x, y);
    drag.f.sheet.shrink?.(over);
    drag.f.sheet.hold(x, y);
    hot(over);
  }
  function drop(x, y) {
    const d = drag; if (!d) return; drag = null;
    const over = overField(x, y); hot(false);
    if (!d.moved) {
      // 点一下：桌上的自己飞进对话框；附件上的落回原处
      if (d.from === "desk") { const c = fieldPoint(d.f); fly(d.f, d.x0, d.y0, c[0], c[1], 520, () => attach(d.f)); }
      else attach(d.f);
    } else if (over) attach(d.f);
    else putBack(d.f);
  }
  function overField(x, y) { const r = rectOf(field); return x > r.x - 18 && x < r.x + r.w + 18 && y > r.y - 26 && y < r.y + r.h + 18; }
  function hot(v) {
    if (field.classList.contains("hot") === v) return;
    field.classList.toggle("hot", v); ph.set(v ? "Drop to attach" : "Message");
  }
  // 往对话框飞的纸瞄准它的附件小图会在的地方
  function fieldPoint(f) {
    const r = rectOf(field), others = [...atts.children].filter((t) => t !== f.tile);
    const x = others.reduce((s, t) => s + t._f.w0 + 10, r.x + 12) + ATT / f.ar / 2;
    return [x, r.y + r.h / 2 - 12];
  }

  function attach(f) {
    const tile = f.tile || makeTile(f), r = settleRect(tile);
    f.state = "landing";
    f.sheet.carry(r, false, () => { tile.classList.remove("pending", "away"); f.sheet = null; f.state = "att"; f.el.setAttribute("aria-pressed", "true"); updSend(); });
    updSend();
  }
  function putBack(f) {
    if (f.tile) { f.tile.remove(); f.tile = null; rowHeight(); }
    f.state = "landing";
    f.sheet.carry(rectOf(f.th), f.ear, () => { f.el.classList.remove("lifted"); f.sheet = null; f.state = "desk"; f.el.setAttribute("aria-pressed", "false"); updSend(); });
    updSend();
  }
  // 不用手、自己沿一条弧线飞（点一下、键盘、发送）
  function fly(f, x0, y0, x1, y1, ms, then) { f.flying = true; arc(f.sheet, x0, y0, x1, y1, ms, () => { f.flying = false; then(); }); }
  function arc(sh, x0, y0, x1, y1, ms, then) {
    const t0 = performance.now(), cx = (x0 + x1) / 2 + (x1 - x0) * 0.1, cy = Math.min(y0, y1) - 40, g = gen;
    const step = (now) => {
      if (dead || g !== gen) return;
      const u = clamp((now - t0) / ms), e = easeIO(u), a = 1 - e;
      sh.hold(a * a * x0 + 2 * a * e * cx + e * e * x1, a * a * y0 + 2 * a * e * cy + e * e * y1);
      if (u < 1) requestAnimationFrame(step); else then();
    };
    requestAnimationFrame(step);
  }
  function autoAttach(f) {
    if (f.sheet) return;
    const r = rectOf(f.th), x = r.x + r.w / 2, y = r.y + r.h * 0.42;
    grab(f, x, y, "desk"); drag = null;
    const c = fieldPoint(f); fly(f, x, y, c[0], c[1], 560, () => attach(f));
  }
  function autoRemove(f) {
    if (f.sheet || !f.tile) return;
    const r = rectOf(f.tile), x = r.x + r.w / 2, y = r.y + r.h / 2, d = rectOf(f.th);
    grab(f, x, y, "att"); drag = null;
    fly(f, x, y, d.x + d.w / 2, d.y + d.h * 0.45, 560, () => putBack(f));
  }

  /* ───────── 对话框里那一行附件 ───────── */
  function makeTile(f) {
    const t = el("button", "att pending"); t.type = "button"; t._f = f; f.w0 = ATT / f.ar;
    t.style.setProperty("--ar", f.ar.toFixed(4));
    t.innerHTML = `<img alt="" src="${f.url}"><span class="x" aria-hidden="true">${iconSvg("x", 9)}</span>`;
    t.setAttribute("aria-label", `${f.name}, attached. Delete removes it`);
    t.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || f.sheet || f.state !== "att" || drag || sending) return;
      e.preventDefault();
      if (e.target.closest(".x")) { autoRemove(f); return; }
      t.setPointerCapture(e.pointerId);
      const [x, y] = pt(e); grab(f, x, y, "att", e.pointerId);
    });
    t.addEventListener("keydown", (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault();
      const nx = t.nextElementSibling || t.previousElementSibling;
      autoRemove(f); (nx || f.el).focus({ preventScroll: true });
    });
    atts.appendChild(t); f.tile = t;
    return t;
  }
  // 这一行开或合；新附件最后的位置在行还没开完之前就量好
  function rowHeight() {
    const want = atts.children.length ? AH : 0;
    if (parseFloat(atts.style.height || 0) !== want) atts.style.height = want + "px";
  }
  function settleRect(tile) {
    const want = atts.children.length ? AH : 0, cur = atts.style.height;
    atts.style.transition = "none"; atts.style.height = want + "px";
    const r = rectOf(tile);
    clip(true);   // 行打开以后会被挤出顶的消息，趁这会儿量好，跟着行一起淡出去
    atts.style.height = cur || "0px"; void atts.offsetHeight;
    atts.style.transition = ""; atts.style.height = want + "px";
    return r;
  }
  function updSend() { sendB.disabled = sending || ![...atts.children].some((t) => t._f.state === "att"); }

  /* ───────── 发送：附件变回纸飞进对话里，原件回到桌上，Mia 回一句 ───────── */
  on(sendB, "click", () => send());
  async function send() {
    const items = [...atts.children].map((t) => t._f).filter((f) => f.state === "att");
    if (!items.length || sending || drag) return;
    // 发送按钮一禁用，焦点就掉到页面上了：用键盘发的，焦点交给桌上第一份发出去的文件
    const kb = document.activeElement === sendB;
    sending = true; updSend();
    if (kb) items[0].el.focus({ preventScroll: true });
    const my = gen;
    const kids = [...thread.children], before = kids.map((c) => c.getBoundingClientRect().top);
    const A = items.map((f) => rectOf(f.tile));   // 每页从它的附件小图起飞，趁行还没合上先量
    const g = el("div", "sent"), meta = el("div", "meta");
    for (const f of items) { const im = el("img", "pg"); im.src = f.url; im.alt = f.name; im.style.setProperty("--ar", f.ar.toFixed(4)); im.style.opacity = "0"; g.appendChild(im); }
    thread.appendChild(g); thread.appendChild(meta);
    later(clip, MOVE_MS + 40);
    // 每页落在对话框合上以后它该在的地方：先量出来，再让那一行跟对话用同一条曲线一起动，消息只朝一个方向走
    atts.style.transition = "none"; atts.style.height = "0px";
    const B = items.map((_, i) => rectOf(g.children[i]));
    clip(true);
    atts.style.height = AH + "px"; void atts.offsetHeight; atts.style.transition = "";
    kids.forEach((c, i) => { const d = before[i] - c.getBoundingClientRect().top; if (d) c.animate([{ transform: `translateY(${d / SCALE}px)` }, { transform: "none" }], { duration: motion.reduce ? 1 : MOVE_MS, easing: EASE }); });
    atts.style.height = "0px";
    // 几张一起从对话框上揭起来，再一张接一张飞进去
    const flights = items.map((f, i) => new Promise((res) => {
      const a = A[i], b = B[i], im = g.children[i];
      const show = () => { im.style.opacity = ""; res(); };
      f.tile.classList.add("away");
      if (Paper) {
        const sh = Paper.lift(spec(f, "att"), a, a.x + a.w / 2, a.y + a.h / 2, { hs: (b.w / f.w) * 1.18, lift: 30 });
        Paper.draw();
        later(() => { if (my !== gen) return res(); arc(sh, a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2, 520, () => sh.carry(b, false, show)); }, 60 + i * 120);
        return;
      }
      Flat.fly(f, a, b, i * 120, show);
    }));
    await Promise.all(flights);
    if (dead || my !== gen) return;
    // 附件小图拿掉，原件回到桌上
    for (const f of items) {
      f.tile?.remove(); f.tile = null; f.state = "desk"; f.el.setAttribute("aria-pressed", "false"); f.el.classList.remove("lifted");
      f.th.animate([{ opacity: 0, transform: "translateY(-5px) scale(1.03)" }, { opacity: 1, transform: "none" }], { duration: motion.reduce ? 1 : 500, easing: EASE });
    }
    rowHeight();
    const mr = new Roll(meta); mr.set("", true); later(() => mr.set("Delivered"), 120);
    sending = false; updSend();
    const text = reply(items.map((f) => f.key));
    await sleep(1100); if (my !== gen) return;
    const ty = el("div", "typing pop", "<i></i><i></i><i></i>");
    thread.appendChild(ty);
    await sleep(1500); ty.remove(); if (my !== gen) return;
    thread.appendChild(el("div", "msg them pop", text));
    trim();
  }
  // Mia 的回话看发了什么：她要的是提案和封面照
  function reply(keys) {
    const had = delivered.has("proposal") && delivered.has("cover");
    keys.forEach((k) => delivered.add(k));
    const has = delivered.has("proposal") && delivered.has("cover");
    if (has && !had) return keys.includes("cover") ? "Perfect, the cover is lovely. Thank you!" : "Perfect, that's everything. Thank you!";
    if (!has) return delivered.has("proposal") ? "Thanks! Is the cover shot coming too?" : "Lovely. Could you send the proposal as well?";
    return keys.length === 1 && keys[0] === "budget" ? "Thanks, I'll go through the numbers." : "Got it, thanks!";
  }
  // 对话太长了就把最上面看不见的删掉
  function trim() { while (thread.children.length > 18) thread.firstElementChild.remove(); clip(); }
  // 对话顶上只留整条的消息：顶到上边留白里的整条藏掉（淡出），不露半截。
  // 对话要往上让之前先量好终点、只藏不露（hideOnly），跟着移动一起淡出去；停稳以后再全量一遍，空出来的地方再露出来
  function clip(hideOnly) {
    const top = thread.getBoundingClientRect().top, pad = parseFloat(getComputedStyle(thread).paddingTop) || 0;
    for (const c of thread.children) {
      const cut = (c.getBoundingClientRect().top - top) / SCALE < pad - 1;
      if (cut || !hideOnly) c.classList.toggle("cut", cut);
    }
  }
  on(atts, "transitionend", (e) => { if (e.target === atts) clip(); });

  function reset() {
    Paper ? Paper.clear() : Flat.clear();
    gen++; drag = null; sending = false; hot(false); delivered.clear();
    thread.innerHTML = THREAD0; clip();
    for (const f of files) { f.tile?.remove(); f.tile = null; f.sheet = null; f.flying = false; f.state = "desk"; f.el.classList.remove("lifted"); f.el.setAttribute("aria-pressed", "false"); }
    atts.style.transition = "none"; atts.style.height = "0px"; void atts.offsetHeight; atts.style.transition = "";
    updSend();
  }

  /* ───────── 没有 WebGL2：同样的流程，纸换成一张扁平的卡片 ───────── */
  const Flat = {
    all: [],
    lift(f, r, x, y) {
      const node = el("img", "flat"); node.src = f.url;
      Object.assign(node.style, { width: r.w + "px", height: r.h + "px" });
      si.appendChild(node);
      const k0 = (f.w / r.w) * 0.8;
      // 跟显卡那张纸一样：不出舞台，拖到对话框上方缩小
      const o = { node, gu: (x - r.x) / r.w, gv: (y - r.y) / r.h, w: r.w, k: k0, x, y,
        hold(px, py) {
          const w = o.w * o.k, h = w * f.ar, m = 8;
          o.x = clamp(px, o.gu * w + m, Math.max(o.gu * w + m, W - (1 - o.gu) * w - m));
          o.y = clamp(py, o.gv * h + m, Math.max(o.gv * h + m, H - (1 - o.gv) * h - m));
          node.style.transform = `translate(${o.x - o.gu * w}px,${o.y - o.gv * h}px) scale(${o.k})`;
        },
        shrink(on) { const k = k0 * (on ? 0.62 : 1); if (k !== o.k) { o.k = k; o.hold(o.x, o.y); } },
        carry(rc, _fold, done) {
          const w = o.w * o.k;
          node.animate([{ transform: `translate(${o.x - o.gu * w}px,${o.y - o.gv * w * f.ar}px) scale(${o.k})` }, { transform: `translate(${rc.x}px,${rc.y}px) scale(${rc.w / o.w})` }], { duration: motion.reduce ? 1 : 420, easing: EASE, fill: "both" })
            .finished.then(() => { node.remove(); Flat.all = Flat.all.filter((q) => q !== o); if (!dead) done(); }, () => {});
        } };
      o.hold(x, y); Flat.all.push(o);
      return o;
    },
    fly(f, a, b, delay, done) {
      const node = el("img", "flat"); node.src = f.url;
      Object.assign(node.style, { width: b.w + "px", height: b.h + "px", transform: `translate(${b.x}px,${b.y}px)` });
      si.appendChild(node);
      node.animate([{ transform: `translate(${a.x}px,${a.y}px) scale(${a.w / b.w})` }, { transform: `translate(${b.x}px,${b.y}px)` }], { duration: motion.reduce ? 1 : 560, delay, easing: EASE, fill: "both" })
        .finished.then(() => { node.remove(); if (!dead) done(); }, () => {});
    },
    clear() { for (const o of Flat.all) o.node.remove(); Flat.all = []; },
  };

  /* ───────── 开始：等标题字体，画三页，交给页面和显卡 ───────── */
  layout();
  reset();
  fontsReady().then(() => {
    if (dead) return;
    for (const f of files) {
      f.canvas = f.paint(768);
      f.url = f.canvas.toDataURL("image/jpeg", 0.92);
      f.img.src = f.url;
      if (Paper) f.tex = Paper.texture(f.canvas);
    }
    ready = true;
    root.dataset.ready = "1";
  });

  return {
    theme(dark) { root.style.setProperty("--paper-dim", dark ? "0.9" : "1"); Paper?.theme(dark); },
    destroy() {
      dead = true; gen++;
      ac.abort(); ro.disconnect(); timers.forEach(clearTimeout); timers.clear();
      for (const f of files) f.tex?.dispose();
      Paper?.destroy(); Flat.clear();
    },
    // 测试用
    files, grab, move, drop, send, reset, rectOf, field, sendB, get paper() { return Paper; }, get scale() { return SCALE; }, get drag() { return drag; },
  };
}
