/* Descent 的引擎：建 WebGL2 上下文，编着色器，先画好三张大气查找表和两块 3D 噪声，读进地表、云图、高程这些贴图，
   然后每帧画一遍：环境图（给海面倒影）→ 焦散 → 主场景（一个全屏片元着色器）→ 时间累积抗锯齿 → 水下粒子 → 泛光 → 色调映射。
   画面全在 shaders.js 里，这里管镜头、太阳、海浪的参数，接指针和滚轮，还有省电的规矩：
   - 镜头在动（拖、滚轮、键盘、自动下坠、看向指针）时每帧都画，太慢就降渲染分辨率（最低 0.42 倍）。
   - 停下来以后：低处浪、云、海雪一直在动，每秒画 30 帧；高处看不出东西在动，抗锯齿收敛了（24 帧）就不画了。
   - 滚出屏幕、切到别的标签页就停。
   - 「减弱动态效果」：时间停在一处，浪和云不动，进度直接跳到位，不自动下坠，也不起荧光。
   - 没有 WebGL2、显卡是 CPU 模拟的（无头浏览器、没有能用的显卡）、着色器编不过、上下文丢了：不画，onStatus('poster') 交给组件放一张静帧。

     const d = create(canvas, { textures, big, still, onFrame, onStatus });
     d.nudge(0.01); d.seek(0.5); d.play(true); d.destroy();

   textures 是五张图的地址（day、aux、clouds、dem、demMax）；big 是详情页的大舞台，滚轮和手指上下划才拿来下坠，
   卡片上留给页面滚动。onFrame({ p, alt, auto }) 每画一帧调一次，组件拿去更新读数。 */
import { softwareGL } from "../_kit/gl.js";
import * as S from "./shaders.js";
import { pathAt, dwell } from "./path.js";

// ---------- 地理与太阳 ----------
// 特内里费岛东边外海，离岸约 26 公里；泰德峰在正西偏北 53 公里，太阳落在西南偏西，高 1.7°
const LAT = (28.3 * Math.PI) / 180, LON = (-16.1 * Math.PI) / 180;
const RG = 6371.0;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const U = [Math.cos(LAT) * Math.sin(LON), Math.sin(LAT), Math.cos(LAT) * Math.cos(LON)];   // 这里的「上」
const E = [Math.cos(LON), 0, -Math.sin(LON)];                                              // 东
const N = cross(U, E);                                                                      // 北
const SUN_AZ = (250 * Math.PI) / 180, SUN_EL = (1.7 * Math.PI) / 180;
const SUN = norm(add(mul(add(mul(N, Math.cos(SUN_AZ)), mul(E, Math.sin(SUN_AZ))), Math.cos(SUN_EL)), mul(U, Math.sin(SUN_EL))));
const toL = (v) => [dot(v, E), dot(v, U), dot(v, N)];   // 世界方向 → 海面局部（东、上、北）
// 群岛高程图的范围（跟着色器里的 DEM_BOX 一样），外接球给光线求交先粗判一下
const dirLL = (la, lo) => { la *= Math.PI / 180; lo *= Math.PI / 180; return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]; };
const DEM_C = add(mul(dirLL(27.55 + 1.95 / 2, -18.4 + 5.2 / 2), RG), mul(U, -RG));
const DEM_R = 290;

// ---------- 海浪 ----------
// 7 组方向散开、波长互不成整数比的涌浪，从高处看不出整齐的条纹；25 组在 24 米上平铺的短浪，焦散图按这个周期画
const WAVES = (() => {
  const g = 9.81, out = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const swell = [[118, 12, 0.02], [83, -22, 0.024], [61, 38, 0.027], [47, -41, 0.028], [37, 5, 0.029], [29, 63, 0.026], [23, -9, 0.025]];
  for (const [lam, deg, st] of swell) {
    const k = (2 * Math.PI) / lam, a = (deg * Math.PI) / 180;
    out.push([Math.cos(a), Math.sin(a), k, st / k, Math.sqrt(g * k), rnd() * 6.28, 1.5, 0]);
  }
  const pairs = [[3, 1], [2, -3], [4, 2], [1, 5], [6, -1], [5, 4], [7, 2], [-3, 7], [8, -3], [9, 4], [2, 11], [12, -5], [13, 3], [-6, 14], [16, 5], [11, -15], [19, 6],
    [22, -7], [9, 23], [27, 4], [-14, 26], [31, -11], [24, 25], [37, 8], [-19, 38]];
  for (const [m, n] of pairs) {
    const len = Math.hypot(m, n), k = (2 * Math.PI * len) / 24;
    const st = 0.062 * Math.pow(len / 4, -0.1);
    out.push([m / len, n / len, k, st / k, Math.sqrt(g * k), rnd() * 6.28, 1.5, 1]);
  }
  return out;
})();
const WA = new Float32Array(WAVES.length * 4), WB = new Float32Array(WAVES.length * 4);
WAVES.forEach((w, i) => { WA.set(w.slice(0, 4), i * 4); WB.set(w.slice(4, 8), i * 4); });
// 镜头那一点的浪高：贴近海面时镜头跟着浪起伏，水线才会真的从镜头上扫过
function waveH(x, z, t) {
  let h = 0;
  for (const w of WAVES) {
    const u = 0.5 + 0.5 * Math.sin(w[2] * (w[0] * x + w[1] * z) - w[4] * t + w[5]);
    h += w[3] * (2 * Math.pow(u, w[6]) - 1);
  }
  return h;
}

// 眼睛在水下慢慢适应：补偿一大半蓝光的衰减，越深仍然越暗，到一千米接近全黑。0.021 跟着着色器里 WA 的蓝光走
const underGain = (alt) => Math.exp(Math.min(0.78 * 0.021 * Math.max(0, -alt), 7.6));

// 水下光照的简化版（跟着色器里的 waterLight 同一个量级），给粒子用
const WATER_LIGHT = (() => {
  const sl = toL(SUN);
  const ci = Math.max(sl[1], 1e-3), eta = 1 / 1.333;
  const st = Math.sqrt(1 - ci * ci) * eta, ct = Math.sqrt(1 - st * st);
  const hl = Math.hypot(sl[0], sl[2]);
  const Lw = [(-sl[0] / hl) * st, -ct, (-sl[2] / hl) * st];
  const rs = (ci - 1.333 * ct) / (ci + 1.333 * ct), rp = (1.333 * ci - ct) / (1.333 * ci + ct);
  const Ft = 1 - 0.5 * (rs * rs + rp * rp);
  const Eb = [0.1, 0.035, 0.01].map((v) => (v * Ft * ci) / ct);
  const Ea = [0.01, 0.016, 0.026].map((v, i) => v * 0.93 + Eb[i] * ct * 0.2);
  return { Eb, Ea, Lw };
})();

// ---------- WebGL 小工具 ----------
// 这个实验要半浮点的离屏图、3D 贴图、单通道的数据图，_kit/gl.js 的 RGBA8 离屏图不够用，自己写几行
function makeTex(gl, w, h, o = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  const F = { rgba16f: [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT], r16f: [gl.R16F, gl.RED, gl.HALF_FLOAT] }[o.fmt || "rgba16f"];
  gl.texImage2D(gl.TEXTURE_2D, 0, F[0], w, h, 0, F[1], F[2], null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, o.mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, o.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, o.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  if (o.mip) gl.generateMipmap(gl.TEXTURE_2D);
  return t;
}
function makeTarget(gl, w, h, o = {}) {
  const tex = makeTex(gl, w, h, o), fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h };
}
function freeTarget(gl, t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } }
function imageTex(gl, img, o) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  // 高程这种数据图不能让浏览器做色彩转换
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, o.raw ? gl.NONE : gl.BROWSER_DEFAULT_WEBGL);
  gl.texImage2D(gl.TEXTURE_2D, 0, o.single ? gl.R8 : gl.RGB8, o.single ? gl.RED : gl.RGB, gl.UNSIGNED_BYTE, img);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
  if (!o.nearest) gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, o.nearest ? gl.NEAREST : gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, o.nearest ? gl.NEAREST : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, o.clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const af = gl.getExtension("EXT_texture_filter_anisotropic");
  if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  return t;
}
// 先把所有程序都交出去编（有 KHR_parallel_shader_compile 时驱动在后台编，主线程不卡），编完再一起检查
function submit(gl, vs, fs, name) {
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const v = mk(gl.VERTEX_SHADER, vs), f = mk(gl.FRAGMENT_SHADER, fs), p = gl.createProgram();
  gl.attachShader(p, v); gl.attachShader(p, f);
  gl.linkProgram(p);
  return { p, v, f, name, u: {} };
}
function check(gl, prog) {
  if (!gl.getProgramParameter(prog.p, gl.LINK_STATUS)) {
    throw new Error(`着色器 ${prog.name} 编不过：${gl.getShaderInfoLog(prog.v) || ""}${gl.getShaderInfoLog(prog.f) || ""}${gl.getProgramInfoLog(prog.p) || ""}`);
  }
  gl.deleteShader(prog.v); gl.deleteShader(prog.f);
  const n = gl.getProgramParameter(prog.p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog.p, i);
    prog.u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(prog.p, info.name);
  }
}

const NOISE_N = 128;          // 云的形状噪声 128³，细节噪声 32³
const CAUS_RES = 512, CAUS_GRID = 220;
const ENV_W = 192, ENV_H = 96;
const IDLE_FPS = 30;          // 停下来以后低处还在动的画面，每秒几帧
const SETTLE = 24;            // 抗锯齿收敛要的帧数，高处停下来画够这么多就不画了

/**
 * @param {HTMLCanvasElement} canvas 画布，它的父元素就是舞台
 * @param {{ textures: { day: string, aux: string, clouds: string, dem: string, demMax: string }, big?: boolean, still?: boolean,
 *   onFrame?: (f: { p: number, alt: number, auto: boolean }) => void, onStatus?: (s: "ready" | "poster") => void }} opts
 */
export function create(canvas, { textures, big = false, still: stillAtStart = false, onFrame = () => {}, onStatus = () => {} }) {
  const host = canvas.parentElement;
  let dead = false, ready = false, still = stillAtStart;
  const off = [];   // 拆掉时要撤的监听
  const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); off.push(() => el.removeEventListener(ev, fn, opt)); };

  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: "high-performance" });
  const poster = (why) => {
    if (dead) return;
    if (why) console.warn(why);
    ready = false; dead = true;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    onStatus("poster");
  };
  // 没有 WebGL2，或者显卡是 CPU 模拟的：这个着色器在 CPU 上画一帧要几分钟，直接放静帧
  if (!gl || softwareGL(gl)) {
    queueMicrotask(() => poster());
    return { nudge() {}, seek() {}, play() {}, setStill() {}, get auto() { return false; }, destroy() { dead = true; } };
  }
  gl.getExtension("EXT_color_buffer_float");
  gl.getExtension("EXT_color_buffer_half_float");
  gl.getExtension("OES_texture_float_linear");
  on(canvas, "webglcontextlost", (e) => { e.preventDefault(); poster(); });

  // ---------- 状态 ----------
  let p = 0, target = 0, auto = false;
  let look = [0, 0], lookT = [0, 0];
  let prevAlt = pathAt(0).alt, velAlt = 0;
  let frame = 0, frameStill = 0;
  const t0 = performance.now();
  let stillTime = 12;            // 「减弱动态效果」时停住的那一刻（浪、云的相位）

  // ---------- 资源，ready 以后才有 ----------
  let progs, vao, tlut, mslut, irlut, shapeTex, detailTex, caus, causVao, causCount, env, snow, bubbles, glow;
  const texs = {};
  let W = 0, H = 0, RW = 0, RH = 0, scale = 0.72, sizeDirty = true;
  let cur, histA, histB, partT, blooms = [];
  const GLOW_N = 160, sparks = [];

  function noise3D(size, kind) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, t);
    gl.texStorage3D(gl.TEXTURE_3D, Math.log2(size) + 1, gl.RGBA8, size, size, size);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.useProgram(progs.noise.p);
    gl.uniform1f(progs.noise.u.uSize, size);
    gl.uniform1i(progs.noise.u.uKind, kind);
    gl.viewport(0, 0, size, size);
    for (let z = 0; z < size; z++) {
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, t, 0, z);
      gl.uniform1f(progs.noise.u.uZ, z);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    gl.bindTexture(gl.TEXTURE_3D, t);
    gl.generateMipmap(gl.TEXTURE_3D);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.REPEAT);
    return t;
  }

  function partBuffers(count, fill, dynamic) {
    const va = gl.createVertexArray();
    gl.bindVertexArray(va);
    const corner = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, corner);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const data = new Float32Array(count * 8);
    for (let i = 0; i < count; i++) fill(data, i);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(vao);
    return { va, buf, data, count };
  }

  // 五张图都解码好才开画，不然地球先黑一下
  const loadTextures = () => Promise.all(["day", "aux", "clouds", "dem", "demMax"].map(async (name) => {
    const img = new Image();
    img.decoding = "async";
    img.src = textures[name];
    await img.decode();
    return [name, img];
  }));

  async function init() {
    const texP = loadTextures();
    const par = gl.getExtension("KHR_parallel_shader_compile");
    progs = {
      tlut: submit(gl, S.VS_FULL, S.FS_TLUT, "tlut"),
      ms: submit(gl, S.VS_FULL, S.FS_MSLUT, "ms"),
      ir: submit(gl, S.VS_FULL, S.FS_IRLUT, "ir"),
      noise: submit(gl, S.VS_FULL, S.FS_NOISE3D, "noise"),
      main: submit(gl, S.VS_FULL, S.FS_MAIN, "main"),
      env: submit(gl, S.VS_FULL, S.FS_ENV, "env"),
      caustic: submit(gl, S.VS_CAUSTIC, S.FS_CAUSTIC, "caustic"),
      part: submit(gl, S.VS_PART, S.FS_PART, "part"),
      accum: submit(gl, S.VS_FULL, S.FS_ACCUM, "accum"),
      copy: submit(gl, S.VS_FULL, S.FS_COPY, "copy"),
      down: submit(gl, S.VS_FULL, S.FS_DOWN, "down"),
      up: submit(gl, S.VS_FULL, S.FS_UP, "up"),
      final: submit(gl, S.VS_FULL, S.FS_FINAL, "final"),
    };
    if (par) {
      const done = () => Object.values(progs).every((pr) => gl.getProgramParameter(pr.p, par.COMPLETION_STATUS_KHR));
      while (!done()) { await new Promise((r) => setTimeout(r, 50)); if (dead) return; }
    }
    for (const k in progs) check(gl, progs[k]);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND);
    // 大气：透射率、多次散射、天空辐照度三张查找表，开头画一次
    tlut = makeTarget(gl, 256, 64);
    // 画不进半浮点的离屏图（没有 EXT_color_buffer_half_float 这类扩展）就整个画不出来，直接放静帧
    gl.bindFramebuffer(gl.FRAMEBUFFER, tlut.fb);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("画不进半浮点的离屏图");
    mslut = makeTarget(gl, 32, 32);
    irlut = makeTarget(gl, 64, 16);
    const full = (t) => { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    gl.useProgram(progs.tlut.p); full(tlut);
    gl.useProgram(progs.ms.p); bind(progs.ms, "uTLUT", tlut.tex, 0); full(mslut);
    gl.useProgram(progs.ir.p); bind(progs.ir, "uTLUT", tlut.tex, 0); bind(progs.ir, "uMSLUT", mslut.tex, 1); full(irlut);
    // 云：可以平铺的 Perlin-Worley 3D 噪声
    shapeTex = noise3D(NOISE_N, 0);
    detailTex = noise3D(32, 1);
    // 焦散：一张 24 米见方、可以平铺的图，用折射后的网格面积比算亮度
    caus = makeTarget(gl, CAUS_RES, CAUS_RES, { fmt: "r16f", mip: true, repeat: true });
    {
      const G1 = CAUS_GRID + 1, idx = new Uint32Array(CAUS_GRID * CAUS_GRID * 6);
      let k = 0;
      for (let y = 0; y < CAUS_GRID; y++) for (let x = 0; x < CAUS_GRID; x++) {
        const a = y * G1 + x, b = a + 1, c = a + G1, d = c + 1;
        idx.set([a, b, c, b, d, c], k); k += 6;
      }
      causVao = gl.createVertexArray();
      gl.bindVertexArray(causVao);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      causCount = idx.length;
      gl.bindVertexArray(vao);
    }
    env = makeTarget(gl, ENV_W, ENV_H, { mip: true, repeat: true });
    // 水下：海雪、气泡、指针划过时亮起的荧光
    let ps = 12345;
    const prand = () => (ps = (ps * 16807) % 2147483647) / 2147483647;
    snow = partBuffers(2600, (d, i) => d.set([prand(), prand(), prand(), prand(), prand(), prand(), 0, 0], i * 8));
    bubbles = partBuffers(520, (d, i) => {
      const r = Math.sqrt(prand()) * 0.9, a = prand() * 6.283;
      d.set([Math.cos(a) * r, prand(), Math.sin(a) * r, prand(), prand(), prand(), 0, 0], i * 8);
    });
    glow = partBuffers(GLOW_N, (d, i) => d.set([0, 0, 0, 2, 0, 0, 0, 0], i * 8), true);

    const imgs = await texP;
    if (dead) return;
    for (const [name, img] of imgs) {
      texs[name] = imageTex(gl, img, { single: name !== "day" && name !== "aux", raw: name === "dem" || name === "demMax", nearest: name === "demMax", clamp: name === "dem" || name === "demMax" });
    }
    ready = true;
    onStatus("ready");
    wake();
  }

  function bind(pr, name, tex, unit, kind) {
    const loc = pr.u[name];
    if (loc == null) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(kind || gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }
  function drawFull(t) {
    if (t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---------- 尺寸 ----------
  // 画布按舞台的大小乘屏幕像素比（最多 2）；场景先画在一张小一点的离屏图上，边长大约是舞台 CSS 像素的 scale 倍，
  // 舞台很大时再按面积压一点（边长超过 1100 就按比例缩）
  function resize() {
    sizeDirty = false;
    const r = host.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    const rs = Math.min(1, scale * Math.min(1, 1100 / Math.sqrt(r.width * r.height)));
    const rw = Math.max(64, Math.round(r.width * rs)), rh = Math.max(48, Math.round(r.height * rs));
    if (w !== W || h !== H) { W = w; H = h; canvas.width = w; canvas.height = h; }
    if (rw === RW && rh === RH) return true;
    RW = rw; RH = rh;
    [cur, histA, histB, partT, ...blooms].forEach((t) => freeTarget(gl, t));
    cur = makeTarget(gl, RW, RH); histA = makeTarget(gl, RW, RH); histB = makeTarget(gl, RW, RH); partT = makeTarget(gl, RW, RH);
    blooms = [];
    let bw = RW, bh = RH;
    for (let i = 0; i < 6; i++) { bw = Math.max(2, bw >> 1); bh = Math.max(2, bh >> 1); blooms.push(makeTarget(gl, bw, bh)); }
    frameStill = 0;
    return true;
  }

  // ---------- 镜头 ----------
  function camera(time) {
    const c = pathAt(p);
    const near = clamp01((3 - Math.abs(c.alt)) / 2.5);
    if (near > 0) c.alt += waveH(0, 0, time) * near * near * (3 - 2 * near);
    const aspect = RW / RH;
    // 竖着的舞台保证横向视野不太窄，不然从太空看地球会被切掉；又宽又矮的舞台保证纵向视野不比 16:10 的窄，
    // 镜头路线的俯仰是按 16:10 的画面定的，地平线、泰德峰才落在原来的位置
    let tanX = Math.max(Math.tan((26 * Math.PI) / 180) * Math.sqrt(aspect), 0.4), tanY = tanX / aspect;
    if (tanY < 0.38) { tanY = 0.38; tanX = tanY * aspect; }
    if (tanX > 1) { tanX = 1; tanY = 1 / aspect; }   // 横向最多 90°，再宽边上就拉变形了
    const pitch = ((c.pitch + look[1]) * Math.PI) / 180;
    const az = SUN_AZ + ((look[0] + c.yaw) * Math.PI) / 180;
    const Hd = add(mul(N, Math.cos(az)), mul(E, Math.sin(az)));
    const fwd = norm(add(mul(Hd, Math.cos(pitch)), mul(U, -Math.sin(pitch))));
    const up = norm(add(mul(Hd, Math.sin(pitch)), mul(U, Math.cos(pitch))));
    const right = cross(fwd, up);
    const r = (c.roll * Math.PI) / 180;
    return {
      c, fwd, tanX, tanY,
      right: add(mul(right, Math.cos(r)), mul(up, Math.sin(r))),
      up: add(mul(up, Math.cos(r)), mul(right, -Math.sin(r))),
    };
  }

  function setScene(pr, cam, time) {
    const u = pr.u, alt = cam.c.alt, hkm = Math.max(alt, 0) / 1000;
    gl.uniform2f(u.uRes, RW, RH);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uFrame, frame % 64);
    gl.uniform1f(u.uCamH, hkm);
    gl.uniform1f(u.uCamYm, alt);
    gl.uniform3fv(u.uTdir, U);
    gl.uniform3fv(u.uTP, mul(U, RG));
    gl.uniform3fv(u.uDemC, DEM_C);
    gl.uniform1f(u.uDemR, DEM_R);
    gl.uniform1f(u.uTerrain, 1);
    gl.uniform3fv(u.uE, E);
    gl.uniform3fv(u.uN, N);
    gl.uniform3fv(u.uFwd, cam.fwd);
    gl.uniform3fv(u.uRight, cam.right);
    gl.uniform3fv(u.uUpv, cam.up);
    gl.uniform2f(u.uTan, cam.tanX, cam.tanY);
    gl.uniform3fv(u.uSun, SUN);
    gl.uniform1f(u.uOcean, 1 - smooth(22, 70, hkm));
    gl.uniform1f(u.uLocalCloud, hkm < 14 ? 1 : 0);
    gl.uniform3fv(u.uWind, add(mul(E, 0.011 * time), mul(N, 0.004 * time)));
    gl.uniform1f(u.uSunE, 1.0);
    gl.uniform1f(u.uLights, 0.022);
    gl.uniform1f(u.uStars, 0.05);
    gl.uniform1f(u.uNoiseN, NOISE_N);
    gl.uniform1f(u.uUnderGain, underGain(alt));
    // 半水半天时给水下那一半提亮，相当于摄影里的渐变减光镜
    gl.uniform1f(u.uUnderBoost, 1 + 1.4 * smooth(-2.8, -0.2, alt) * (1 - smooth(1.5, 3, alt)));
    gl.uniform4fv(u.uWA, WA);
    gl.uniform4fv(u.uWB, WB);
    bind(pr, "uTLUT", tlut.tex, 0);
    bind(pr, "uMSLUT", mslut.tex, 1);
    bind(pr, "uIRLUT", irlut.tex, 2);
    bind(pr, "uDay", texs.day, 3);
    bind(pr, "uAux", texs.aux, 4);
    bind(pr, "uCloudMap", texs.clouds, 5);
    bind(pr, "uEnv", env.tex, 6);
    bind(pr, "uCaustic", caus.tex, 7);
    bind(pr, "uShape", shapeTex, 8, gl.TEXTURE_3D);
    bind(pr, "uDetail", detailTex, 9, gl.TEXTURE_3D);
    bind(pr, "uDem", texs.dem, 10);
    bind(pr, "uDemMax", texs.demMax, 11);
  }

  // ---------- 深海的荧光 ----------
  function updateSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt / s.life;
      s.pos[1] += dt * 0.02;
      if (s.age >= 1) sparks.splice(i, 1);
    }
    glow.data.fill(0);
    for (let i = 0; i < GLOW_N; i++) glow.data[i * 8 + 3] = 2;
    sparks.slice(0, GLOW_N).forEach((s, i) => glow.data.set([s.pos[0], s.pos[1], s.pos[2], s.age, s.k, s.size, s.hue, 0], i * 8));
  }
  // nx、ny：舞台上的位置，-1 到 1
  function spawnSparks(nx, ny, n) {
    if (!ready || still) return;
    const c = pathAt(p);
    if (c.alt > -420) return;
    const cam = camera(0);
    for (let i = 0; i < n; i++) {
      const dir = norm(add(add(cam.fwd, mul(cam.right, (nx + (Math.random() - 0.5) * 0.05) * cam.tanX)), mul(cam.up, (ny + (Math.random() - 0.5) * 0.05) * cam.tanY)));
      const d = 0.9 + Math.random() * 2.6, l = toL(dir);
      sparks.push({ pos: [l[0] * d, c.alt + l[1] * d, l[2] * d], age: 0, life: 1.6 + Math.random() * 1.8, k: 0.5 + Math.random() * 0.9, size: Math.random(), hue: Math.random() });
      if (sparks.length > GLOW_N) sparks.shift();
    }
    wake();
  }

  // ---------- 一帧 ----------
  function draw(time, dt) {
    const cam = camera(time);
    const alt = cam.c.alt, hkm = Math.max(alt, 0) / 1000;
    velAlt = velAlt * 0.8 + ((alt - prevAlt) / Math.max(dt, 1e-3)) * 0.2;
    prevAlt = alt;
    gl.disable(gl.BLEND);
    gl.bindVertexArray(vao);

    // 环境图：低处的海面拿它取倒影
    if (hkm < 90) {
      gl.useProgram(progs.env.p);
      setScene(progs.env, cam, time);
      gl.uniform2f(progs.env.u.uEnvRes, ENV_W, ENV_H);
      drawFull(env);
      gl.bindTexture(gl.TEXTURE_2D, env.tex);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    // 焦散
    if (alt < 30) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, caus.fb);
      gl.viewport(0, 0, CAUS_RES, CAUS_RES);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      const cp = progs.caustic, cu = cp.u;
      gl.useProgram(cp.p);
      gl.uniform4fv(cu.uWA, WA); gl.uniform4fv(cu.uWB, WB);
      gl.uniform1f(cu.uTime, time);
      gl.uniform3fv(cu.uSl, toL(SUN));
      gl.uniform1f(cu.uGrid, CAUS_GRID);
      gl.uniform1f(cu.uTexRes, CAUS_RES);
      gl.bindVertexArray(causVao);
      gl.drawElementsInstanced(gl.TRIANGLES, causCount, gl.UNSIGNED_INT, 0, 9);
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      gl.bindTexture(gl.TEXTURE_2D, caus.tex);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    // 主场景
    gl.useProgram(progs.main.p);
    setScene(progs.main, cam, time);
    drawFull(cur);

    // 时间累积：镜头停了几帧以后才开始叠，动的时候不拖影
    const w = frameStill > 2 ? Math.min(0.85, frameStill / (frameStill + 2)) : 0;
    gl.useProgram(progs.accum.p);
    bind(progs.accum, "uCur", cur.tex, 0);
    bind(progs.accum, "uHist", histA.tex, 1);
    gl.uniform1f(progs.accum.u.uW, w);
    drawFull(histB);
    [histA, histB] = [histB, histA];

    // 粒子画在累积之后，不跟着拖影
    gl.useProgram(progs.copy.p);
    bind(progs.copy, "uSrc", histA.tex, 0);
    drawFull(partT);
    if (alt < 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      const pp = progs.part, pu = pp.u;
      gl.useProgram(pp.p);
      gl.uniform3f(pu.uCamL, 0, alt, 0);
      gl.uniform3fv(pu.uRightL, toL(cam.right));
      gl.uniform3fv(pu.uUpL, toL(cam.up));
      gl.uniform3fv(pu.uFwdL, toL(cam.fwd));
      gl.uniform2f(pu.uTan, cam.tanX, cam.tanY);
      gl.uniform2f(pu.uRes, RW, RH);
      gl.uniform1f(pu.uTime, time);
      gl.uniform3f(pu.uVelL, 0, -Math.max(-60, Math.min(60, velAlt)), 0);
      gl.uniform1f(pu.uBox, 7.0);
      gl.uniform1f(pu.uGain, underGain(alt) * (1 + 3 * clamp01((alt + 2.8) / 2.6)));
      gl.uniform3fv(pu.uEb0, WATER_LIGHT.Eb); gl.uniform3fv(pu.uEa0, WATER_LIGHT.Ea); gl.uniform3fv(pu.uLw, WATER_LIGHT.Lw);
      gl.uniform1i(pu.uKind, 0);
      gl.bindVertexArray(snow.va);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, snow.count);
      if (alt > -40) {
        gl.uniform1i(pu.uKind, 1);
        gl.bindVertexArray(bubbles.va);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, bubbles.count);
      }
      if (sparks.length) {
        updateSparks(dt);
        gl.uniform1i(pu.uKind, 2);
        gl.bindVertexArray(glow.va);
        gl.bindBuffer(gl.ARRAY_BUFFER, glow.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, glow.data);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, GLOW_N);
      }
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
    }

    // 泛光：六级往下缩，再一级级加回来
    let src = partT;
    gl.useProgram(progs.down.p);
    for (let i = 0; i < blooms.length; i++) {
      bind(progs.down, "uSrc", src.tex, 0);
      gl.uniform2f(progs.down.u.uTexel, 1 / src.w, 1 / src.h);
      gl.uniform1f(progs.down.u.uFirst, i === 0 ? 1 : 0);
      gl.uniform1f(progs.down.u.uClampV, 24 / Math.pow(2, cam.c.ev));
      drawFull(blooms[i]);
      src = blooms[i];
    }
    gl.useProgram(progs.up.p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = blooms.length - 1; i > 0; i--) {
      bind(progs.up, "uSrc", blooms[i].tex, 0);
      gl.uniform2f(progs.up.u.uTexel, 1 / blooms[i].w, 1 / blooms[i].h);
      drawFull(blooms[i - 1]);
    }
    gl.disable(gl.BLEND);

    // 输出：曝光、AgX、颗粒、暗角
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    const fp = progs.final, fu = fp.u;
    gl.useProgram(fp.p);
    bind(fp, "uSrc", partT.tex, 0);
    bind(fp, "uBloom", blooms[0].tex, 1);
    gl.uniform1f(fu.uExposure, Math.pow(2, cam.c.ev));
    gl.uniform1f(fu.uBloomK, 0.045);
    gl.uniform1f(fu.uTime, time);
    gl.uniform2f(fu.uOutRes, W, H);
    gl.uniform1f(fu.uGrain, 0.022);
    gl.uniform1f(fu.uVig, 0.28);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    frame++;
    return cam.c.alt;
  }

  // ---------- 什么时候画 ----------
  let raf = 0, visible = true, prevNow = -1, lastDraw = -1e9, perfAcc = 0, perfN = 0;
  function wake() { if (!raf && !dead && ready && visible && !document.hidden) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (dead || !ready || !visible || document.hidden) return;
    const dt = prevNow < 0 ? 1 / 60 : Math.min(0.1, (now - prevNow) / 1000);
    prevNow = now;
    if (sizeDirty && !resize()) return;

    if (auto) {
      target = Math.min(1, target + (dt / 78 / dwell(target)) * 1.55);
      if (target >= 1) auto = false;
    }
    const pPrev = p;
    if (still) p = target;   // 「减弱动态效果」：直接跳到位
    else {
      p += (target - p) * (1 - Math.exp(-dt * 2.6));
      if (Math.abs(target - p) < 1e-6) p = target;
    }
    look[0] += (lookT[0] - look[0]) * (1 - Math.exp(-dt * 3));
    look[1] += (lookT[1] - look[1]) * (1 - Math.exp(-dt * 3));
    const moving = auto || p !== pPrev || Math.abs(target - p) > 2e-5 || Math.abs(lookT[0] - look[0]) > 0.01 || Math.abs(lookT[1] - look[1]) > 0.01;
    // 低处浪、云、海雪一直在动；荧光亮着时也算
    const lively = !still && (pathAt(p).alt < 20000 || sparks.length > 0);
    if (moving) frameStill = 0;
    else if (!lively && frameStill >= SETTLE) { prevNow = -1; return; }          // 高处停稳了：不画，等下一次输入
    else if (lively && frameStill >= SETTLE && now - lastDraw < 1000 / IDLE_FPS - 2) { raf = requestAnimationFrame(tick); return; }

    // 动态分辨率：连着每帧都画的时候才量，平均慢过 25 毫秒就降，快过 17 毫秒就慢慢升回去
    const gap = (now - lastDraw) / 1000;
    if (moving && gap < 0.1) {
      perfAcc += gap; perfN++;
      if (perfN >= 30) {
        const avg = perfAcc / perfN;
        perfAcc = 0; perfN = 0;
        if (avg > 1 / 40 && scale > 0.42) { scale = Math.max(0.42, scale * 0.86); sizeDirty = true; }
        else if (avg < 1 / 58 && scale < 1) { scale = Math.min(1, scale * 1.08); sizeDirty = true; }
      }
    }
    lastDraw = now;
    if (!moving) frameStill++;
    const time = still ? stillTime : (now - t0) / 1000;
    const alt = draw(time, dt);
    onFrame({ p, alt, auto });
    raf = requestAnimationFrame(tick);
  }

  // ---------- 输入 ----------
  function nudge(d) { target = clamp01(target + d); auto = false; wake(); }
  function stagePos(e) {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2, r];
  }
  // 拖：手往上推是往下坠（跟手指滑页面一个方向），拖满整个舞台的高走九分之一的路；停留久的那几段走得慢一点
  let drag = null, lastSpark = 0;
  on(canvas, "pointerdown", (e) => {
    if (!ready || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag = { id: e.pointerId, y: e.clientY };
    if (e.pointerType === "mouse") { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; }
    const [nx, ny] = stagePos(e);
    spawnSparks(nx, ny, 3);
  });
  on(canvas, "pointermove", (e) => {
    if (!ready) return;
    const [nx, ny, r] = stagePos(e);
    if (drag && drag.id === e.pointerId) {
      nudge((drag.y - e.clientY) / (r.height * 9) / Math.sqrt(dwell(target)));
      drag.y = e.clientY;
    }
    // 鼠标在舞台上挪，镜头稍微看过去一点
    if (e.pointerType === "mouse" && !still) { lookT = [nx * 2.5, -ny * 1.6]; wake(); }
    const now = performance.now();
    if (now - lastSpark > 28) { spawnSparks(nx, ny, e.pointerType === "mouse" ? 1 : 2); lastSpark = now; }
  });
  const up = (e) => { if (drag && drag.id === e.pointerId) { drag = null; canvas.style.cursor = ""; } };
  on(canvas, "pointerup", up);
  on(canvas, "pointercancel", up);
  on(canvas, "pointerleave", (e) => { if (e.pointerType === "mouse") { lookT = [0, 0]; wake(); } });
  // 滚轮只在详情页的大舞台上拿来下坠；到了两头再往外滚，就让页面滚
  if (big) {
    on(host, "wheel", (e) => {
      if (!ready) return;
      const d = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * 600 : e.deltaY;
      if ((d < 0 && target <= 0) || (d > 0 && target >= 1)) return;
      e.preventDefault();
      nudge(d / 14000 / Math.sqrt(dwell(target)));
    }, { passive: false });
  }

  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { prevNow = -1; wake(); } });
  io.observe(host);
  const ro = new ResizeObserver(() => { sizeDirty = true; frameStill = 0; wake(); });
  ro.observe(host);
  on(document, "visibilitychange", () => { if (!document.hidden) { prevNow = -1; wake(); } });

  init().catch((e) => poster(e.message));

  return {
    nudge,
    seek(v) { target = clamp01(v); auto = false; wake(); },
    // 自动下坠：从当前位置往下走，到底了再按就从轨道重新开始
    play(v) {
      if (still) return;
      auto = v;
      if (auto && target >= 0.999) { target = 0; p = 0; }
      frameStill = 0;
      wake();
    },
    setStill(v) {
      still = v;
      if (still) { stillTime = (performance.now() - t0) / 1000; auto = false; lookT = [0, 0]; sparks.length = 0; }
      frameStill = 0; prevNow = -1; wake();
    },
    get auto() { return auto; },
    destroy() {
      dead = true; ready = false;
      cancelAnimationFrame(raf); raf = 0;
      io.disconnect(); ro.disconnect();
      off.forEach((f) => f());
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
