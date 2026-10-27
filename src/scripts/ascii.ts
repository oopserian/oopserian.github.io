/*! 首屏的字符画：头像用等宽字符拼出来，四周一圈字符的烟。
   做法照 React Bits 的 GradientASCII 组件（sooty.app 首屏的字符光也是它）：WebGL2 着色器分几遍画，
   先按格子算一张「场」（一格一个像素：该多浓、开场显出来没有、被鼠标搅动了多少），再按格子从一张字的图集里取字。
   字按节拍跳、开场从乱码里解出来、鼠标拖出一串乱码、点一下荡开一圈、字的光晕和颗粒，都照它的写法。
   原组件的场是几种程序生成的光（地平线、日食这些），这里换成头像图和往上飘的烟；颜色只有墨色和强调色。
   原组件 https://reactbits.dev ，许可证原文如下（只许作为网站的一部分用，不许单独转售、再分发这个组件）：

   MIT + Commons Clause License Condition v1.0

   Copyright (c) 2026 David Haz

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   Commons Clause Restriction: You may use this Software, including for any commercial purpose, **so long as you do not
   sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE. */

// 用法：mount({ host, canvas, anchor, src })。host 是首屏，canvas 是它里面绝对定位的画布（位置大小由这里按头像定），
// anchor 是头像要放的位置（一个空元素，由 CSS 排版），src 是头像图（透明底、灰度，tools/portrait.py 生成）。
// 浏览器没有 WebGL2 时什么都不画，首屏只有文字。

interface Options {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  anchor: HTMLElement;
  src: string;
}

// 候选的字，按在这款字体里的墨量排好序后挑出一串由淡到浓的（见 buildAtlas）
const CANDIDATES = ` .'\`,:;-~"^=+<>!/\\|()?ivxzo*%#&$@8B`;
const LEVELS = 14;                 // 浓淡分几档
const NOISE = '!?/\\|()[]{}<>=+*#%&$@0123456789'; // 解码、被搅乱时出现的字
const ATLAS_W = 60, ATLAS_H = 100, ATLAS_COLUMNS = 16, FONT_SCALE = 0.78; // 图集里一格多大（字号是格高的 0.78），格子宽高比也照它
const GLYPH_HZ = 4;                // 每格的字每秒换几次（各格错开节拍；9 次 laken 嫌太快）
const FLICKER = 0.5;               // 换的时候浓淡上下晃多少，晃过档就换成邻档的字
const GLOW = { dark: 0.35, light: 0.08 }; // 字的光晕（浅色主题上是一圈淡淡的灰，少一点）
const GHOST = { dark: 0.07, light: 0.035 }; // 字底下淡淡的一层头像，远看更像人
const GRAIN = 0.04;                // 颗粒
const IDLE_FPS = 15;               // 平时（烟在飘、字在跳）的帧率；开场、被鼠标搅动时跟着屏幕刷新
const INTRO_SECONDS = 2.2;
const MAX_TRAIL = 24, TRAIL_LIFE = 0.7, TRAIL_STEP = 6; // 鼠标拖过留下的一串点（间距按 CSS 像素）
const SCRAMBLE_RADIUS = 34;        // 每个点搅乱多大一片（CSS 像素）
const MAX_CLICKS = 4, CLICK_LIFE = 1.2;
const MARGIN = 0.3;                // 画布比头像四周各宽出头像长边的几成（烟就在这一圈里）

const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const COMMON = `
float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
`;

// 场：一格一个像素。r 浓淡，g 头像四周能出字的范围（被搅动时空白处也冒乱码）；aux 的 r 开场显出来多少，g 被搅动多少
const FIELD = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform vec2 uGrid;
uniform vec2 uCellCss;
uniform float uLod;
uniform vec4 uRect;
uniform vec2 uCenter;
uniform vec2 uReach;
uniform sampler2D uPortrait;
uniform float uTime;
uniform float uIntro;
uniform float uLight;
uniform vec4 uTrail[${MAX_TRAIL}];
uniform vec4 uClicks[${MAX_CLICKS}];
in vec2 vUv;
layout(location = 0) out vec4 outField;
layout(location = 1) out vec4 outAux;
${COMMON}
vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy) * 2.0 - 1.0;
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash22(i), f);
  float b = dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return 0.5 + 0.5 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// 原图一处的亮度换成字该多浓。深色背景上越亮越浓，浅色背景上反过来，两种主题看到的都是正片。
// 深色把头发、衣服这些暗处提起来一点，跟最黑的线条分得开；浅色把头发、衣服压到一半，皮肤几乎留白，
// 不然头发和描边一样黑，脸上的线就淹在里面了
float ink(vec4 s) {
  float lum = clamp(s.r / max(s.a, 0.001), 0.0, 1.0);
  float v = uLight > 0.5
    ? mix(1.0, 0.5, smoothstep(0.03, 0.14, lum)) * (1.0 - smoothstep(0.25, 0.9, lum))
    : pow(lum, 0.75);
  return s.a * (0.1 + 0.9 * v);
}
void main() {
  vec2 cell = vec2(floor(gl_FragCoord.x), uGrid.y - 1.0 - floor(gl_FragCoord.y)); // 第几列、从上往下第几行
  vec2 px = (cell + 0.5) * uCellCss; // 格子中心，CSS 像素，从左上角算
  float t = uTime;

  // 头像：在格子里取 3×4 个点，各自换成浓淡再平均。只取格子中心的话，跟格子差不多粗的线时有时无
  float dens = 0.0;
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 3; i++) {
      vec2 iuv = ((cell + vec2((float(i) + 0.5) / 3.0, (float(j) + 0.5) / 4.0)) * uCellCss - uRect.xy) / uRect.zw;
      if (iuv.x < 0.0 || iuv.y < 0.0 || iuv.x > 1.0 || iuv.y > 1.0) continue;
      dens += ink(textureLod(uPortrait, iuv, uLod));
    }
  }
  dens /= 12.0;

  // 四周的烟：三层噪声一起往上飘，离头像越远越淡，只用最淡的几档字
  vec2 q = px / 105.0;
  float n = noise(q + vec2(t * 0.05, t * 0.32)) * 0.55
    + noise(q * 2.2 + vec2(-t * 0.08, t * 0.5)) * 0.3
    + noise(q * 5.0 + vec2(0.0, t * 0.8)) * 0.15;
  float k = clamp(1.0 - length((px - uCenter) / uReach), 0.0, 1.0);
  float smoke = smoothstep(0.46, 0.72, n) * k * k * 0.24;

  // 开场：从上往下、带点参差地显出来
  float order = clamp(px.y / uSize.y * 0.85 + noise(px / 60.0) * 0.3 - 0.1, 0.0, 1.0);
  float reveal = clamp((uIntro * 1.45 - order) / 0.45, 0.0, 1.0);
  reveal = reveal * reveal * (3.0 - 2.0 * reveal);

  // 鼠标拖过的一串点、点一下荡开的圈
  float scramble = 0.0;
  for (int i = 0; i < ${MAX_TRAIL}; i++) {
    vec4 p = uTrail[i];
    if (p.z <= 0.0) continue;
    vec2 d = px - p.xy;
    scramble = max(scramble, p.z * exp(-dot(d, d) / (${SCRAMBLE_RADIUS}.0 * ${SCRAMBLE_RADIUS}.0)));
  }
  for (int i = 0; i < ${MAX_CLICKS}; i++) {
    vec4 c = uClicks[i];
    if (c.w <= 0.0) continue;
    float d = length(px - c.xy) / uSize.y;
    scramble = max(scramble, exp(-pow((d - c.z * 0.75) / 0.05, 2.0)) * c.w);
  }

  outField = vec4(max(dens, smoke) * reveal, k, 0.0, 1.0);
  outAux = vec4(reveal, scramble, 0.0, 1.0);
}`;

// 按格子取字：每格看场在格子中心的浓淡挑一档，再按节拍上下晃一下（跳）；开场没显完、被搅动的格子换成乱码
const GLYPHS = `
uniform sampler2D uField;
uniform sampler2D uAux;
uniform sampler2D uAtlas;
uniform vec2 uRes;
uniform vec2 uCellPx;
uniform vec2 uGrid;
uniform vec2 uAtlasGrid;
uniform float uLevels;
uniform float uNoise;
uniform float uFlicker;
uniform float uGlyphTime;
uniform vec3 uInk;
uniform vec3 uHot;
${COMMON}
float sampleGlyph(float index, vec2 local, vec2 gradX, vec2 gradY) {
  float column = mod(index, uAtlasGrid.x);
  float row = floor(index / uAtlasGrid.x);
  vec2 atlasUv = vec2((column + local.x) / uAtlasGrid.x, (row + local.y) / uAtlasGrid.y);
  return textureGrad(uAtlas, atlasUv, gradX, gradY).a;
}
// 场在这一处的纹理坐标（连续的，给垫在字底下的那层头像用）
vec2 fieldUv(vec2 frag) {
  vec2 coord = vec2(frag.x, uRes.y - frag.y) / uCellPx;
  return vec2(coord.x / uGrid.x, 1.0 - coord.y / uGrid.y);
}
vec4 glyphAt(vec2 frag) {
  vec2 px = vec2(frag.x, uRes.y - frag.y);
  vec2 coord = px / uCellPx;
  vec2 cell = floor(coord);
  vec2 local = coord - cell;
  vec2 gradX = dFdx(coord / uAtlasGrid), gradY = dFdy(coord / uAtlasGrid);
  ivec2 texel = clamp(ivec2(cell.x, uGrid.y - 1.0 - cell.y), ivec2(0), ivec2(uGrid) - 1);
  vec4 field = texelFetch(uField, texel, 0);
  vec4 aux = texelFetch(uAux, texel, 0);
  float value = field.r;
  // 空格子（大半个画布）不出字，后面取字、算节拍都省了
  if (value < 0.03 && aux.g * field.g <= 0.05) return vec4(0.0);
  float pick = hash12(cell + 7.31);
  float level = hash12(cell * 1.73 + 4.1);
  float tick = floor(uGlyphTime * ${GLYPH_HZ}.0 + level * ${GLYPH_HZ}.0);
  float wobble = (hash12(cell * 2.31 + tick * 17.7) - 0.5) * uFlicker * 0.4 + (level - 0.5) * 0.06;
  float tone = clamp(value + wobble * step(0.03, value), 0.0, 1.0);
  float index = floor(tone * (uLevels - 1.0) + 0.5);
  float shown = smoothstep(0.03, 0.1, value);
  float hot = 0.0;
  float decode = max(aux.g, 1.0 - aux.r);
  if (decode > 0.02 && (value > 0.03 || aux.g * field.g > 0.05)) {
    float frame = floor(uGlyphTime * 20.0);
    if (hash12(cell * 3.7 + frame * 5.3) < decode * 1.25) {
      index = uLevels + floor(hash12(cell + frame * 1.37) * uNoise);
      hot = aux.g;
      shown = max(shown, smoothstep(0.05, 0.3, aux.g * field.g));
    }
  }
  float present = step(pick, mix(1.0, 0.3 + tone * 1.1, 0.55));
  float coverage = sampleGlyph(index, local, gradX, gradY);
  float alpha = present * shown * coverage * mix(1.0, 0.35 + 0.65 * level, 0.3);
  vec3 color = mix(uInk, uHot, smoothstep(0.15, 0.5, hot));
  return vec4(color * alpha, alpha);
}
`;

// 光晕：在四分之一分辨率上再画一遍字，模糊后垫在字底下
const HALO = `#version 300 es
precision highp float;
uniform float uDownscale;
in vec2 vUv;
out vec4 outColor;
${GLYPHS}
void main() {
  outColor = glyphAt(gl_FragCoord.xy * uDownscale);
}`;

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uStep;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 sum = texture(uSource, vUv) * 0.2270270270;
  sum += texture(uSource, vUv + uStep * 1.3846153846) * 0.3162162162;
  sum += texture(uSource, vUv - uStep * 1.3846153846) * 0.3162162162;
  sum += texture(uSource, vUv + uStep * 3.2307692308) * 0.0702702703;
  sum += texture(uSource, vUv - uStep * 3.2307692308) * 0.0702702703;
  outColor = sum;
}`;

const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uHalo;
uniform float uGlow;
uniform float uGhost;
uniform float uGrain;
uniform float uFrame;
in vec2 vUv;
out vec4 outColor;
${GLYPHS}
void main() {
  vec4 glyph = glyphAt(gl_FragCoord.xy);
  vec4 under = texture(uHalo, vUv) * uGlow + vec4(uInk, 1.0) * texture(uField, fieldUv(gl_FragCoord.xy)).r * uGhost;
  vec4 color = glyph + under * (1.0 - glyph.a);
  float grain = (hash12(gl_FragCoord.xy + uFrame * vec2(17.0, 59.0)) + hash12(gl_FragCoord.xy * 1.31 + uFrame * 7.0) - 1.0) * uGrain;
  color.rgb += grain * (0.25 + color.a) * 0.5;
  color.a = clamp(color.a, 0.0, 1.0);
  color.rgb = clamp(color.rgb, 0.0, color.a);
  outColor = color;
}`;

type Program = { program: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
type Target = { textures: WebGLTexture[]; framebuffer: WebGLFramebuffer; width: number; height: number };

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function link(gl: WebGL2RenderingContext, fragment: string): Program | null {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX), fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return null;
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  const u: Program['u'] = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const name = gl.getActiveUniform(program, i)!.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(program, name);
  }
  return { program, u };
}

function createTarget(gl: WebGL2RenderingContext, count: number): Target {
  const textures = Array.from({ length: count }, () => {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  });
  return { textures, framebuffer: gl.createFramebuffer()!, width: 0, height: 0 };
}

function sizeTarget(gl: WebGL2RenderingContext, target: Target, width: number, height: number) {
  if (target.width === width && target.height === height) return;
  target.width = width;
  target.height = height;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  target.textures.forEach((texture, i) => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texture, 0);
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// 图集：先量每个候选字的墨量，由淡到浓均匀挑 LEVELS 档（换字体不用重新排），后面接着放解码、搅乱用的字
function buildAtlas(gl: WebGL2RenderingContext, family: string) {
  const font = `400 ${Math.round(ATLAS_H * FONT_SCALE)}px ${family}`;
  const draw = (chars: string[], columns: number) => {
    const c = document.createElement('canvas');
    c.width = ATLAS_W * columns;
    c.height = ATLAS_H * Math.ceil(chars.length / columns);
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.font = font;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    chars.forEach((ch, i) => x.fillText(ch, (i % columns) * ATLAS_W + ATLAS_W / 2, Math.floor(i / columns) * ATLAS_H + ATLAS_H / 2 + 3));
    return { c, x };
  };
  const cand = Array.from(new Set(CANDIDATES));
  const { x } = draw(cand, cand.length);
  const data = x.getImageData(0, 0, ATLAS_W * cand.length, ATLAS_H).data;
  const ink = cand.map((_, i) => {
    let sum = 0;
    for (let y = 0; y < ATLAS_H; y++) for (let px = 0; px < ATLAS_W; px++) sum += data[(y * ATLAS_W * cand.length + i * ATLAS_W + px) * 4 + 3];
    return sum;
  });
  const order = cand.map((_, i) => i).sort((p, q) => ink[p] - ink[q]);
  const max = ink[order[order.length - 1]];
  const ramp = [' '];
  for (let l = 1; l < LEVELS; l++) {
    const target = (l / (LEVELS - 1)) ** 1.15 * max;
    let best = order[1];
    for (const i of order) if (cand[i] !== ' ' && Math.abs(ink[i] - target) < Math.abs(ink[best] - target)) best = i;
    ramp.push(cand[best]);
  }
  const list = [...ramp, ...NOISE];
  const { c } = draw(list, ATLAS_COLUMNS);
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { texture, grid: [ATLAS_COLUMNS, Math.ceil(list.length / ATLAS_COLUMNS)] };
}

// 显卡是不是 CPU 在模拟（没有能用的显卡、无头浏览器）：这时画一帧要几十毫秒，一直动会占满主线程，只画静止的
function softwareGL(gl: WebGL2RenderingContext) {
  let name = String(gl.getParameter(gl.RENDERER));
  if (/^webkit webgl$/i.test(name)) {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (info) name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  }
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

function toRGB(color: string) {
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  c.fillStyle = color;
  c.fillRect(0, 0, 1, 1);
  const d = c.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}

export function mount({ host, canvas, anchor, src }: Options) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return;
  const field = link(gl, FIELD), halo = link(gl, HALO), blur = link(gl, BLUR), composite = link(gl, COMPOSITE);
  if (!field || !halo || !blur || !composite) return;
  const vao = gl.createVertexArray();
  const fieldTarget = createTarget(gl, 2), haloA = createTarget(gl, 1), haloB = createTarget(gl, 1);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const software = softwareGL(gl);
  let still = motion.matches || software;

  // 画布在首屏里的位置和大小按 CSS 像素；格子 cellW、cellH 按画布的像素，cols、rows 是铺满画布要几列几行；lod 是在头像图上取点用的 mipmap 级别
  const view = { x: 0, y: 0, width: 1, height: 1, ratio: 1, cellW: 4.8, cellH: 8, cols: 1, rows: 1, lod: 0 };
  const rect = new Float32Array(4), center = new Float32Array(2);
  const reach = new Float32Array(2);
  const trail: { x: number; y: number; age: number }[] = [];
  const clicks: { x: number; y: number; age: number }[] = [];
  const trailData = new Float32Array(MAX_TRAIL * 4), clickData = new Float32Array(MAX_CLICKS * 4);
  let theme = { ink: [1, 1, 1], hot: [1, 0.5, 0.2], light: false };
  let atlas: ReturnType<typeof buildAtlas> | null = null;
  let portrait: WebGLTexture | null = null;
  let imageW = 1, imageH = 1;    // 头像图多大
  let time = 0, glyphTime = 0, intro = still ? 1 : 0, frameSeed = 0, grainClock = 0;
  let raf = 0, last = 0, lastDraw = 0, visible = true;

  function readTheme() {
    const s = getComputedStyle(canvas);
    const scheme = getComputedStyle(document.documentElement).colorScheme;
    theme = {
      ink: toRGB(s.getPropertyValue('--ascii').trim() || '#888'),
      hot: toRGB(s.getPropertyValue('--ascii-hot').trim() || '#f80'),
      light: !scheme.includes('dark'),
    };
  }

  // 尺寸、头像的位置（按 contain 放进 anchor）、烟的范围。
  // 画布只盖头像四周一圈（头像长边的 MARGIN 倍），不盖整个首屏：左边那一大片文字底下本来就没有字，不用逐像素算
  function resize() {
    const r = host.getBoundingClientRect(), a = anchor.getBoundingClientRect();
    const m = Math.max(a.width, a.height) * MARGIN;
    const left = Math.max(0, a.left - r.left - m), top = Math.max(0, a.top - r.top - m);
    const right = Math.min(r.width, a.right - r.left + m), bottom = Math.min(r.height, a.bottom - r.top + m);
    view.x = left;
    view.y = top;
    view.width = Math.max(1, right - left);
    view.height = Math.max(1, bottom - top);
    Object.assign(canvas.style, { left: `${left}px`, top: `${top}px`, width: `${view.width}px`, height: `${view.height}px` });
    view.ratio = Math.min(devicePixelRatio || 1, 2);
    const cell = parseFloat(getComputedStyle(canvas).getPropertyValue('--ascii-cell')) || 8;
    canvas.width = Math.round(view.width * view.ratio);
    canvas.height = Math.round(view.height * view.ratio);
    view.cellH = cell * view.ratio;
    view.cellW = view.cellH * (ATLAS_W / ATLAS_H);
    view.cols = Math.ceil(canvas.width / view.cellW);
    view.rows = Math.ceil(canvas.height / view.cellH);
    const s = Math.min(a.width / imageW, a.height / imageH);
    const w = imageW * s, h = imageH * s;
    rect.set([a.left - r.left - left + (a.width - w) / 2, a.top - r.top - top + (a.height - h) / 2, w, h]);
    center.set([rect[0] + w / 2, rect[1] + h / 2]);
    reach.set([a.width / 2 + m, a.height / 2 + m]); // 烟到画布边上正好淡完
    // 每格取 3×4 个点，一个点管原图上多大一片，就取那么模糊的一级
    view.lod = Math.max(0, Math.log2(Math.sqrt((cell * cell * (ATLAS_W / ATLAS_H)) / 12) / s));
    sizeTarget(gl!, fieldTarget, view.cols, view.rows);
    const hw = Math.max(1, Math.round(canvas.width / 4)), hh = Math.max(1, Math.round(canvas.height / 4));
    sizeTarget(gl!, haloA, hw, hh);
    sizeTarget(gl!, haloB, hw, hh);
  }

  function bindGlyphs(p: Program) {
    const g = gl!, u = p.u;
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, fieldTarget.textures[0]);
    g.uniform1i(u.uField, 0);
    g.activeTexture(g.TEXTURE1);
    g.bindTexture(g.TEXTURE_2D, fieldTarget.textures[1]);
    g.uniform1i(u.uAux, 1);
    g.activeTexture(g.TEXTURE2);
    g.bindTexture(g.TEXTURE_2D, atlas!.texture);
    g.uniform1i(u.uAtlas, 2);
    g.uniform2f(u.uRes, canvas.width, canvas.height);
    g.uniform2f(u.uCellPx, view.cellW, view.cellH);
    g.uniform2f(u.uGrid, view.cols, view.rows);
    g.uniform2f(u.uAtlasGrid, atlas!.grid[0], atlas!.grid[1]);
    g.uniform1f(u.uLevels, LEVELS);
    g.uniform1f(u.uNoise, NOISE.length);
    g.uniform1f(u.uFlicker, still ? 0 : FLICKER);
    g.uniform1f(u.uGlyphTime, glyphTime);
    g.uniform3fv(u.uInk, theme.ink);
    g.uniform3fv(u.uHot, theme.hot);
  }

  function draw() {
    if (!atlas || !portrait) return;
    const g = gl!;
    g.bindVertexArray(vao);
    g.disable(g.BLEND);

    // 场（一格一个像素）
    g.bindFramebuffer(g.FRAMEBUFFER, fieldTarget.framebuffer);
    g.drawBuffers([g.COLOR_ATTACHMENT0, g.COLOR_ATTACHMENT1]);
    g.viewport(0, 0, fieldTarget.width, fieldTarget.height);
    g.useProgram(field!.program);
    const fu = field!.u;
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, portrait);
    g.uniform1i(fu.uPortrait, 0);
    g.uniform2f(fu.uSize, view.width, view.height);
    g.uniform2f(fu.uGrid, view.cols, view.rows);
    g.uniform2f(fu.uCellCss, view.cellW / view.ratio, view.cellH / view.ratio);
    g.uniform1f(fu.uLod, view.lod);
    g.uniform4fv(fu.uRect, rect);
    g.uniform2fv(fu.uCenter, center);
    g.uniform2fv(fu.uReach, reach);
    g.uniform1f(fu.uTime, time);
    g.uniform1f(fu.uIntro, intro);
    g.uniform1f(fu.uLight, theme.light ? 1 : 0);
    g.uniform4fv(fu.uTrail, trailData);
    g.uniform4fv(fu.uClicks, clickData);
    g.drawArrays(g.TRIANGLES, 0, 3);

    // 光晕（四分之一分辨率，横竖各模糊一遍）
    g.bindFramebuffer(g.FRAMEBUFFER, haloA.framebuffer);
    g.drawBuffers([g.COLOR_ATTACHMENT0]);
    g.viewport(0, 0, haloA.width, haloA.height);
    g.useProgram(halo!.program);
    bindGlyphs(halo!);
    g.uniform1f(halo!.u.uDownscale, canvas.width / haloA.width);
    g.drawArrays(g.TRIANGLES, 0, 3);
    g.useProgram(blur!.program);
    g.activeTexture(g.TEXTURE0);
    g.uniform1i(blur!.u.uSource, 0);
    g.bindFramebuffer(g.FRAMEBUFFER, haloB.framebuffer);
    g.bindTexture(g.TEXTURE_2D, haloA.textures[0]);
    g.uniform2f(blur!.u.uStep, 1 / haloA.width, 0);
    g.drawArrays(g.TRIANGLES, 0, 3);
    g.bindFramebuffer(g.FRAMEBUFFER, haloA.framebuffer);
    g.bindTexture(g.TEXTURE_2D, haloB.textures[0]);
    g.uniform2f(blur!.u.uStep, 0, 1 / haloA.height);
    g.drawArrays(g.TRIANGLES, 0, 3);

    // 字、光晕、底下淡淡的头像、颗粒合起来画到屏幕上
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.viewport(0, 0, canvas.width, canvas.height);
    g.useProgram(composite!.program);
    bindGlyphs(composite!);
    const cu = composite!.u;
    g.activeTexture(g.TEXTURE3);
    g.bindTexture(g.TEXTURE_2D, haloA.textures[0]);
    g.uniform1i(cu.uHalo, 3);
    g.uniform1f(cu.uGlow, theme.light ? GLOW.light : GLOW.dark);
    g.uniform1f(cu.uGhost, theme.light ? GHOST.light : GHOST.dark);
    g.uniform1f(cu.uGrain, still ? 0 : GRAIN);
    g.uniform1f(cu.uFrame, frameSeed);
    g.drawArrays(g.TRIANGLES, 0, 3);
  }

  function updateInput(dt: number) {
    for (const p of trail) p.age += dt;
    while (trail.length && trail[trail.length - 1].age > TRAIL_LIFE) trail.pop();
    for (let i = 0; i < MAX_TRAIL; i++) {
      const p = trail[i];
      if (!p) { trailData[i * 4 + 2] = 0; continue; }
      const k = 1 - p.age / TRAIL_LIFE;
      trailData.set([p.x, p.y, k * k, 0], i * 4);
    }
    for (const c of clicks) c.age += dt;
    while (clicks.length && clicks[clicks.length - 1].age > CLICK_LIFE) clicks.pop();
    for (let i = 0; i < MAX_CLICKS; i++) {
      const c = clicks[i];
      if (!c) { clickData[i * 4 + 3] = 0; continue; }
      const k = c.age / CLICK_LIFE;
      clickData.set([c.x, c.y, c.age, Math.min(1, c.age / 0.08) * (1 - k) * (1 - k)], i * 4);
    }
  }

  // 开场、被搅动时每次刷新都画；平时（烟在飘、字在跳）只画 IDLE_FPS 帧，省电
  function frame(now: number) {
    raf = 0;
    if (!visible || still) return;
    const active = intro < 1 || trail.length > 0 || clicks.length > 0;
    if (!active && now - lastDraw < 1000 / IDLE_FPS - 2) { schedule(); return; }
    const dt = last ? Math.min(0.1, Math.max(0.001, (now - last) / 1000)) : 1 / 60;
    last = now;
    lastDraw = now;
    time += dt * 0.5;
    glyphTime += dt;
    if (intro < 1) intro = Math.min(1, intro + dt / INTRO_SECONDS);
    grainClock += dt;
    if (grainClock > 1 / IDLE_FPS) { grainClock = 0; frameSeed = (frameSeed + 1) % 97; }
    updateInput(dt);
    draw();
    schedule();
  }
  function schedule() {
    if (!raf && visible && !still) raf = requestAnimationFrame(frame);
  }

  // 鼠标、手指（坐标按 CSS 像素，从画布左上角算；画布外头、首屏里头也算，拖进来是连着的）
  const locate = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    return { x: e.clientX - r.left - view.x, y: e.clientY - r.top - view.y };
  };
  host.addEventListener('pointermove', e => {
    if (still) return;
    const p = locate(e);
    const head = trail[0];
    const gap = head ? Math.hypot(p.x - head.x, p.y - head.y) : Infinity;
    if (gap < TRAIL_STEP) return;
    // 鼠标动得快时在两点之间补几个，拖出来是连着的一条
    if (head && head.age < 0.1) {
      const steps = Math.min(6, Math.floor(gap / (TRAIL_STEP * 2)));
      for (let i = 1; i <= steps; i++) {
        const k = i / (steps + 1);
        trail.unshift({ x: head.x + (p.x - head.x) * k, y: head.y + (p.y - head.y) * k, age: 0 });
      }
    }
    trail.unshift({ ...p, age: 0 });
    trail.length = Math.min(trail.length, MAX_TRAIL);
    schedule();
  }, { passive: true });
  host.addEventListener('pointerdown', e => {
    if (still || (e.target as Element).closest('a, button')) return;
    clicks.unshift({ ...locate(e), age: 0 });
    if (clicks.length > MAX_CLICKS) clicks.pop();
    schedule();
  }, { passive: true });

  // 只在看得见时动
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && !document.hidden;
    last = 0;
    schedule();
  }).observe(host);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    last = 0;
    schedule();
  });

  // 换主题只换颜色；「减弱动态效果」打开就停在静止的一帧
  const refresh = () => { readTheme(); draw(); };
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh);
  motion.addEventListener('change', () => {
    still = motion.matches || software;
    if (still) intro = 1;
    draw();
    schedule();
  });
  new ResizeObserver(() => { resize(); draw(); }).observe(host);

  // 头像图和字体都到了再开始
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  const family = getComputedStyle(document.documentElement).getPropertyValue('--mono').trim() || 'monospace';
  const fontReady = document.fonts?.load(`400 64px ${family}`).catch(() => {}) ?? Promise.resolve();
  Promise.all([img.decode(), fontReady]).then(() => {
    imageW = img.naturalWidth;
    imageH = img.naturalHeight;
    portrait = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, portrait);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    atlas = buildAtlas(gl, family);
    readTheme();
    resize();
    draw();
    schedule();
  }, () => {});
}
