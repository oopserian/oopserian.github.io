/* 几样小工具：数值、缓动、每帧推一步的弹簧、一个字一个字换的数字、沿弧线飞的东西。
   motion.reduce 跟着系统的「减弱动态效果」走，由 folder.js 挂监听更新 */

export const motion = { reduce: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches };

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** 往里吸：前面慢、后面猛，像被按钮拽进去 */
export const easeSuck = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2.4) / 2);
/** 冲过头一点再回来，k 越大冲得越多 */
export const easeOutBack = (t, k = 0.9) => 1 + (k + 1) * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2);

const el = (tag, cls) => { const e = document.createElement(tag); e.className = cls; return e; };

/** 每帧推一步的弹簧：resp 是大约多久到位（秒），bounce 是冲过头多少（0 不冲过头）。开了「减弱动态效果」就不冲过头 */
export class Spring {
  constructor(x) { this.x = x; this.v = 0; this.t = x; }
  step(dt, resp, bounce) {
    if (motion.reduce) { bounce = 0; resp = Math.min(resp, 0.12); }
    const w = (2 * Math.PI) / Math.max(0.05, resp), k = w * w, c = 2 * (1 - clamp(bounce, 0, 0.95)) * w;
    const n = Math.max(1, Math.ceil(dt * 480)), hh = dt / n;
    for (let i = 0; i < n; i++) { const a = -k * (this.x - this.t) - c * this.v; this.v += a * hh; this.x += this.v * hh; }
    return this.x;
  }
  snap(x) { this.x = this.t = x; this.v = 0; }
  near(e = 0.3, ev = 3) { return Math.abs(this.x - this.t) < e && Math.abs(this.v) < ev; }
}

/** 这一帧离上一帧多少秒，60 Hz、120 Hz、卡了一下都按真实时间走；歇过一阵后的第一帧按 1/60 算 */
export const dtOf = (o, now) => { const d = o.lt ? Math.min(0.05, (now - o.lt) / 1000) : 1 / 60; o.lt = now; return d; };

/** 滚动的字：一个字一格。数字按变大变小往上或往下滑，别的字带一点模糊交叉淡入淡出；
    两个词共有的那一头不动（「4 selected」→「5 selected」只动 4，「32.0 MB」→「11.2 MB」从右边对齐） */
export class Roll {
  constructor(node, opts = {}) { this.el = node; this.s = null; this.cells = []; this.o = opts; node.classList.add("roll"); }
  set(s, instant) {
    s = String(s); if (s === this.s) return;
    const old = this.s; this.s = s;
    if (old === null || instant || motion.reduce) { this.el.textContent = ""; this.cells = [...s].map((ch) => this.cell(ch)); this.cells.forEach((c) => this.el.appendChild(c)); return; }
    const a = parseFloat(old.replace(/[^\d.]/g, "")), b = parseFloat(s.replace(/[^\d.]/g, ""));
    const dir = isFinite(a) && isFinite(b) && a !== b ? (b > a ? 1 : -1) : 0;
    const A = [...old], B = [...s];
    // 带数字的从右边对齐（个位对个位）；纯文字看哪一头相同的字多
    let right = /\d/.test(s) && !this.o.left;
    if (!/\d/.test(s)) {
      const d = B.length - A.length; let l = 0, r = 0;
      for (let i = 0; i < B.length; i++) { if (A[i] === B[i]) l++; if (A[i - d] === B[i]) r++; }
      right = r > l;
    }
    const off = right ? B.length - A.length : 0, next = [], ow = new Map(this.cells.map((c) => [c, c.offsetWidth]));
    for (let i = 0; i < B.length; i++) {
      const j = i - off, c = j >= 0 && j < A.length ? this.cells[j] : null;
      if (c) { if (A[j] !== B[i]) this.swap(c, B[i], /\d/.test(A[j]) && /\d/.test(B[i]) ? dir : 0); next.push(c); }
      else { const n = this.cell(""); this.swap(n, B[i], 0); next.push(n); }
    }
    const used = new Set(next), leaving = this.cells.filter((c) => !used.has(c));
    for (const c of leaving) { c.classList.add("gone"); setTimeout(() => c.remove(), 520); }
    const order = right ? [...leaving, ...next] : [...next, ...leaving];
    for (const c of order) this.el.appendChild(c);
    this.cells = next;
    // 每一格从旧宽度过渡到新宽度，后面的字跟着滑，不跳
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
  swap(c, ch, dir) {
    const og = c._g, ng = el("span", "rg"); ng.textContent = ch;
    og.classList.add("old"); og.style.setProperty("--dy", `${-dir * 0.42}em`);
    ng.classList.add("new"); ng.style.setProperty("--dy", `${dir * 0.42}em`);
    c.appendChild(ng); c._g = ng;
    void ng.offsetWidth; ng.classList.remove("new");
    setTimeout(() => og.remove(), 480);
  }
}

/** 让 node 的中心从 a 沿一条二次贝塞尔弧飞到 b（设计像素），路上缩放、淡入淡出。
    o: ms、delay、lift（弧顶比两头高多少）、s0/s1（起止缩放）、ease、o0/o1/oe（起止不透明度和它自己的进度曲线）。
    alive() 返回 false 时（组件卸了）提前停 */
export function fly(node, a, b, o = {}, alive = () => true) {
  const w = node.offsetWidth, h = node.offsetHeight, ms = motion.reduce ? 1 : o.ms || 600, ease = o.ease || easeIO;
  const cx = (a[0] + b[0]) / 2, cy = Math.min(a[1], b[1]) - (o.lift ?? 60);
  const put = (u) => {
    const e = ease(u), q = 1 - e;
    const x = q * q * a[0] + 2 * q * e * cx + e * e * b[0], y = q * q * a[1] + 2 * q * e * cy + e * e * b[1];
    const s = lerp(o.s0 ?? 1, o.s1 ?? 1, e);
    node.style.transform = `translate(${(x - w / 2).toFixed(2)}px,${(y - h / 2).toFixed(2)}px) scale(${s.toFixed(4)})`;
    if (o.o0 !== undefined) node.style.opacity = lerp(o.o0, o.o1 ?? 1, o.oe ? o.oe(u) : u).toFixed(3);
  };
  put(0);
  return new Promise((res) => {
    const t0 = performance.now() + (motion.reduce ? 0 : o.delay || 0);
    const f = (now) => {
      if (!alive()) return res();
      const u = clamp((now - t0) / ms); put(u);
      if (u < 1) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  });
}
