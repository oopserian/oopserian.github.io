/* 几样小工具：数值、缓动、每帧推一步的弹簧。motion.reduce 跟着系统的「减弱动态效果」走，由 desk.js 挂监听更新 */

export const motion = { reduce: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches };

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 每帧推一步的弹簧：resp 是大约多久到位（秒），bounce 是冲过头多少（0 不冲过头）。开了「减弱动态效果」就不冲过头 */
export class Spring {
  constructor(x) { this.x = x; this.v = 0; this.t = x; }
  step(dt, resp, bounce) {
    if (motion.reduce) bounce = 0;
    const w = (2 * Math.PI) / Math.max(0.05, resp), k = w * w, c = 2 * (1 - clamp(bounce, 0, 0.95)) * w;
    const n = Math.max(1, Math.ceil(dt * 480)), hh = dt / n;
    for (let i = 0; i < n; i++) { const a = -k * (this.x - this.t) - c * this.v; this.v += a * hh; this.x += this.v * hh; }
    return this.x;
  }
  snap(x) { this.x = this.t = x; this.v = 0; }
  near(e = 0.5, ev = 4) { return Math.abs(this.x - this.t) < e && Math.abs(this.v) < ev; }
}
