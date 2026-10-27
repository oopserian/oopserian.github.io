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
var e=9,t={dark:.35,light:.08},n={dark:.07,light:.035},r=.04,i=24,a=2.2,o=24,s=.7,c=6,l=34,u=4,d=1.2,f=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,p=`
float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
`,ee=`#version 300 es
precision highp float;
uniform vec2 uSize;
uniform vec2 uGrid;
uniform vec2 uCellCss;
uniform float uLod;
uniform vec4 uRect;
uniform vec2 uCenter;
uniform float uReach;
uniform sampler2D uPortrait;
uniform float uTime;
uniform float uIntro;
uniform float uLight;
uniform vec4 uTrail[${o}];
uniform vec4 uClicks[${u}];
in vec2 vUv;
layout(location = 0) out vec4 outField;
layout(location = 1) out vec4 outAux;
${p}
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
  float k = clamp(1.0 - length(px - uCenter) / uReach, 0.0, 1.0);
  float smoke = smoothstep(0.46, 0.72, n) * k * k * 0.24;

  // 开场：从上往下、带点参差地显出来
  float order = clamp(px.y / uSize.y * 0.85 + noise(px / 60.0) * 0.3 - 0.1, 0.0, 1.0);
  float reveal = clamp((uIntro * 1.45 - order) / 0.45, 0.0, 1.0);
  reveal = reveal * reveal * (3.0 - 2.0 * reveal);

  // 鼠标拖过的一串点、点一下荡开的圈
  float scramble = 0.0;
  for (int i = 0; i < ${o}; i++) {
    vec4 p = uTrail[i];
    if (p.z <= 0.0) continue;
    vec2 d = px - p.xy;
    scramble = max(scramble, p.z * exp(-dot(d, d) / (${l}.0 * ${l}.0)));
  }
  for (int i = 0; i < ${u}; i++) {
    vec4 c = uClicks[i];
    if (c.w <= 0.0) continue;
    float d = length(px - c.xy) / uSize.y;
    scramble = max(scramble, exp(-pow((d - c.z * 0.75) / 0.05, 2.0)) * c.w);
  }

  outField = vec4(max(dens, smoke) * reveal, k, 0.0, 1.0);
  outAux = vec4(reveal, scramble, 0.0, 1.0);
}`,m=`
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
${p}
float sampleGlyph(float index, vec2 local, vec2 coord) {
  float column = mod(index, uAtlasGrid.x);
  float row = floor(index / uAtlasGrid.x);
  vec2 atlasUv = vec2((column + local.x) / uAtlasGrid.x, (row + local.y) / uAtlasGrid.y);
  vec2 continuous = coord / uAtlasGrid;
  return textureGrad(uAtlas, atlasUv, dFdx(continuous), dFdy(continuous)).a;
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
  ivec2 texel = clamp(ivec2(cell.x, uGrid.y - 1.0 - cell.y), ivec2(0), ivec2(uGrid) - 1);
  vec4 field = texelFetch(uField, texel, 0);
  vec4 aux = texelFetch(uAux, texel, 0);
  float value = field.r;
  float pick = hash12(cell + 7.31);
  float level = hash12(cell * 1.73 + 4.1);
  float tick = floor(uGlyphTime * ${e}.0 + level * ${e}.0);
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
  float coverage = sampleGlyph(index, local, coord);
  float alpha = present * shown * coverage * mix(1.0, 0.35 + 0.65 * level, 0.3);
  vec3 color = mix(uInk, uHot, smoothstep(0.15, 0.5, hot));
  return vec4(color * alpha, alpha);
}
`,te=`#version 300 es
precision highp float;
uniform float uDownscale;
in vec2 vUv;
out vec4 outColor;
${m}
void main() {
  outColor = glyphAt(gl_FragCoord.xy * uDownscale);
}`,ne=`#version 300 es
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
}`,re=`#version 300 es
precision highp float;
uniform sampler2D uHalo;
uniform float uGlow;
uniform float uGhost;
uniform float uGrain;
uniform float uFrame;
in vec2 vUv;
out vec4 outColor;
${m}
void main() {
  vec4 glyph = glyphAt(gl_FragCoord.xy);
  vec4 under = texture(uHalo, vUv) * uGlow + vec4(uInk, 1.0) * texture(uField, fieldUv(gl_FragCoord.xy)).r * uGhost;
  vec4 color = glyph + under * (1.0 - glyph.a);
  float grain = (hash12(gl_FragCoord.xy + uFrame * vec2(17.0, 59.0)) + hash12(gl_FragCoord.xy * 1.31 + uFrame * 7.0) - 1.0) * uGrain;
  color.rgb += grain * (0.25 + color.a) * 0.5;
  color.a = clamp(color.a, 0.0, 1.0);
  color.rgb = clamp(color.rgb, 0.0, color.a);
  outColor = color;
}`;function h(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(console.warn(e.getShaderInfoLog(r)),e.deleteShader(r),null)}function g(e,t){let n=h(e,e.VERTEX_SHADER,f),r=h(e,e.FRAGMENT_SHADER,t);if(!n||!r)return null;let i=e.createProgram();if(e.attachShader(i,n),e.attachShader(i,r),e.linkProgram(i),e.deleteShader(n),e.deleteShader(r),!e.getProgramParameter(i,e.LINK_STATUS))return null;let a={},o=e.getProgramParameter(i,e.ACTIVE_UNIFORMS);for(let t=0;t<o;t++){let n=e.getActiveUniform(i,t).name.replace(/\[0\]$/,``);a[n]=e.getUniformLocation(i,n)}return{program:i,u:a}}function _(e,t){return{textures:Array.from({length:t},()=>{let t=e.createTexture();return e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),t}),framebuffer:e.createFramebuffer(),width:0,height:0}}function v(e,t,n,r){(t.width!==n||t.height!==r)&&(t.width=n,t.height=r,e.bindFramebuffer(e.FRAMEBUFFER,t.framebuffer),t.textures.forEach((t,i)=>{e.bindTexture(e.TEXTURE_2D,t),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,n,r,0,e.RGBA,e.UNSIGNED_BYTE,null),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+i,e.TEXTURE_2D,t,0)}),e.bindFramebuffer(e.FRAMEBUFFER,null))}function ie(e,t){let n=`400 78px ${t}`,r=(e,t)=>{let r=document.createElement(`canvas`);r.width=60*t,r.height=100*Math.ceil(e.length/t);let i=r.getContext(`2d`,{willReadFrequently:!0});return i.font=n,i.textAlign=`center`,i.textBaseline=`middle`,i.fillStyle=`#fff`,e.forEach((e,n)=>i.fillText(e,n%t*60+30,Math.floor(n/t)*100+50+3)),{c:r,x:i}},i=Array.from(new Set(` .'\`,:;-~"^=+<>!/\\|()?ivxzo*%#&$@8B`)),{x:a}=r(i,i.length),o=a.getImageData(0,0,60*i.length,100).data,s=i.map((e,t)=>{let n=0;for(let e=0;e<100;e++)for(let r=0;r<60;r++)n+=o[(e*60*i.length+t*60+r)*4+3];return n}),c=i.map((e,t)=>t).sort((e,t)=>s[e]-s[t]),l=s[c[c.length-1]],u=[` `];for(let e=1;e<14;e++){let t=(e/13)**1.15*l,n=c[1];for(let e of c)i[e]!==` `&&Math.abs(s[e]-t)<Math.abs(s[n]-t)&&(n=e);u.push(i[n])}let d=[...u,...`!?/\\|()[]{}<>=+*#%&$@0123456789`],{c:f}=r(d,16),p=e.createTexture();return e.bindTexture(e.TEXTURE_2D,p),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,e.RGBA,e.UNSIGNED_BYTE,f),e.generateMipmap(e.TEXTURE_2D),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),{texture:p,grid:[16,Math.ceil(d.length/16)]}}function ae(e){let t=String(e.getParameter(e.RENDERER));if(/^webkit webgl$/i.test(t)){let n=e.getExtension(`WEBGL_debug_renderer_info`);n&&(t=String(e.getParameter(n.UNMASKED_RENDERER_WEBGL)))}return/swiftshader|llvmpipe|softpipe|software|basic render/i.test(t)}function oe(e){let t=document.createElement(`canvas`).getContext(`2d`,{willReadFrequently:!0});t.fillStyle=e,t.fillRect(0,0,1,1);let n=t.getImageData(0,0,1,1).data;return[n[0]/255,n[1]/255,n[2]/255]}function y({host:e,canvas:l,anchor:f,src:p}){let m=l.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});if(!m)return;let h=g(m,ee),y=g(m,te),b=g(m,ne),x=g(m,re);if(!h||!y||!b||!x)return;let se=m.createVertexArray(),S=_(m,2),C=_(m,1),w=_(m,1),T=matchMedia(`(prefers-reduced-motion: reduce)`),E=ae(m),D=T.matches||E,O={width:1,height:1,ratio:1,cellW:4.8,cellH:8,cols:1,rows:1,lod:0},k=new Float32Array(4),A=new Float32Array(2),j=1,M=[],N=[],P=new Float32Array(96),F=new Float32Array(16),I={ink:[1,1,1],hot:[1,.5,.2],light:!1},L=null,R=null,z=1,B=1,V=0,H=0,U=+!!D,W=0,G=0,K=0,q=0,J=0,Y=!0;function X(){let e=getComputedStyle(l),t=getComputedStyle(document.documentElement).colorScheme;I={ink:oe(e.getPropertyValue(`--ascii`).trim()||`#888`),hot:oe(e.getPropertyValue(`--ascii-hot`).trim()||`#f80`),light:!t.includes(`dark`)}}function ce(){let t=e.getBoundingClientRect(),n=f.getBoundingClientRect();O.width=Math.max(1,t.width),O.height=Math.max(1,t.height),O.ratio=Math.min(devicePixelRatio||1,2);let r=parseFloat(getComputedStyle(l).getPropertyValue(`--ascii-cell`))||8;l.width=Math.round(O.width*O.ratio),l.height=Math.round(O.height*O.ratio),O.cellH=r*O.ratio,O.cellW=O.cellH*(60/100),O.cols=Math.ceil(l.width/O.cellW),O.rows=Math.ceil(l.height/O.cellH);let i=Math.min(n.width/z,n.height/B),a=z*i,o=B*i;k.set([n.left-t.left+(n.width-a)/2,n.top-t.top+(n.height-o)/2,a,o]),A.set([k[0]+a/2,k[1]+o/2]),j=Math.max(n.width,n.height)*1.15,O.lod=Math.max(0,Math.log2(Math.sqrt(r*r*(60/100)/12)/i)),v(m,S,O.cols,O.rows);let s=Math.max(1,Math.round(l.width/4)),c=Math.max(1,Math.round(l.height/4));v(m,C,s,c),v(m,w,s,c)}function le(e){let t=m,n=e.u;t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,S.textures[0]),t.uniform1i(n.uField,0),t.activeTexture(t.TEXTURE1),t.bindTexture(t.TEXTURE_2D,S.textures[1]),t.uniform1i(n.uAux,1),t.activeTexture(t.TEXTURE2),t.bindTexture(t.TEXTURE_2D,L.texture),t.uniform1i(n.uAtlas,2),t.uniform2f(n.uRes,l.width,l.height),t.uniform2f(n.uCellPx,O.cellW,O.cellH),t.uniform2f(n.uGrid,O.cols,O.rows),t.uniform2f(n.uAtlasGrid,L.grid[0],L.grid[1]),t.uniform1f(n.uLevels,14),t.uniform1f(n.uNoise,31),t.uniform1f(n.uFlicker,D?0:.5),t.uniform1f(n.uGlyphTime,H),t.uniform3fv(n.uInk,I.ink),t.uniform3fv(n.uHot,I.hot)}function Z(){if(!L||!R)return;let e=m;e.bindVertexArray(se),e.disable(e.BLEND),e.bindFramebuffer(e.FRAMEBUFFER,S.framebuffer),e.drawBuffers([e.COLOR_ATTACHMENT0,e.COLOR_ATTACHMENT1]),e.viewport(0,0,S.width,S.height),e.useProgram(h.program);let i=h.u;e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,R),e.uniform1i(i.uPortrait,0),e.uniform2f(i.uSize,O.width,O.height),e.uniform2f(i.uGrid,O.cols,O.rows),e.uniform2f(i.uCellCss,O.cellW/O.ratio,O.cellH/O.ratio),e.uniform1f(i.uLod,O.lod),e.uniform4fv(i.uRect,k),e.uniform2fv(i.uCenter,A),e.uniform1f(i.uReach,j),e.uniform1f(i.uTime,V),e.uniform1f(i.uIntro,U),e.uniform1f(i.uLight,+!!I.light),e.uniform4fv(i.uTrail,P),e.uniform4fv(i.uClicks,F),e.drawArrays(e.TRIANGLES,0,3),e.bindFramebuffer(e.FRAMEBUFFER,C.framebuffer),e.drawBuffers([e.COLOR_ATTACHMENT0]),e.viewport(0,0,C.width,C.height),e.useProgram(y.program),le(y),e.uniform1f(y.u.uDownscale,l.width/C.width),e.drawArrays(e.TRIANGLES,0,3),e.useProgram(b.program),e.activeTexture(e.TEXTURE0),e.uniform1i(b.u.uSource,0),e.bindFramebuffer(e.FRAMEBUFFER,w.framebuffer),e.bindTexture(e.TEXTURE_2D,C.textures[0]),e.uniform2f(b.u.uStep,1/C.width,0),e.drawArrays(e.TRIANGLES,0,3),e.bindFramebuffer(e.FRAMEBUFFER,C.framebuffer),e.bindTexture(e.TEXTURE_2D,w.textures[0]),e.uniform2f(b.u.uStep,0,1/C.height),e.drawArrays(e.TRIANGLES,0,3),e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,l.width,l.height),e.useProgram(x.program),le(x);let a=x.u;e.activeTexture(e.TEXTURE3),e.bindTexture(e.TEXTURE_2D,C.textures[0]),e.uniform1i(a.uHalo,3),e.uniform1f(a.uGlow,I.light?t.light:t.dark),e.uniform1f(a.uGhost,I.light?n.light:n.dark),e.uniform1f(a.uGrain,D?0:r),e.uniform1f(a.uFrame,W),e.drawArrays(e.TRIANGLES,0,3)}function ue(e){for(let t of M)t.age+=e;for(;M.length&&M[M.length-1].age>s;)M.pop();for(let e=0;e<o;e++){let t=M[e];if(!t){P[e*4+2]=0;continue}let n=1-t.age/s;P.set([t.x,t.y,n*n,0],e*4)}for(let t of N)t.age+=e;for(;N.length&&N[N.length-1].age>d;)N.pop();for(let e=0;e<u;e++){let t=N[e];if(!t){F[e*4+3]=0;continue}let n=t.age/d;F.set([t.x,t.y,t.age,Math.min(1,t.age/.08)*(1-n)*(1-n)],e*4)}}function de(e){if(K=0,!Y||D)return;if(!(U<1||M.length>0||N.length>0)&&e-J<1e3/i-2){Q();return}let t=q?Math.min(.1,Math.max(.001,(e-q)/1e3)):1/60;q=e,J=e,V+=t*.5,H+=t,U<1&&(U=Math.min(1,U+t/a)),G+=t,G>1/24&&(G=0,W=(W+1)%97),ue(t),Z(),Q()}function Q(){!K&&Y&&!D&&(K=requestAnimationFrame(de))}let fe=t=>{let n=e.getBoundingClientRect();return{x:t.clientX-n.left,y:t.clientY-n.top}};e.addEventListener(`pointermove`,e=>{if(D)return;let t=fe(e),n=M[0],r=n?Math.hypot(t.x-n.x,t.y-n.y):1/0;if(!(r<c)){if(n&&n.age<.1){let e=Math.min(6,Math.floor(r/12));for(let r=1;r<=e;r++){let i=r/(e+1);M.unshift({x:n.x+(t.x-n.x)*i,y:n.y+(t.y-n.y)*i,age:0})}}M.unshift({...t,age:0}),M.length=Math.min(M.length,o),Q()}},{passive:!0}),e.addEventListener(`pointerdown`,e=>{D||e.target.closest(`a, button`)||(N.unshift({...fe(e),age:0}),N.length>u&&N.pop(),Q())},{passive:!0}),new IntersectionObserver(([e])=>{Y=e.isIntersecting&&!document.hidden,q=0,Q()}).observe(e),document.addEventListener(`visibilitychange`,()=>{Y=!document.hidden,q=0,Q()});let pe=()=>{X(),Z()};new MutationObserver(pe).observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]}),matchMedia(`(prefers-color-scheme: dark)`).addEventListener(`change`,pe),T.addEventListener(`change`,()=>{D=T.matches||E,D&&(U=1),Z(),Q()}),new ResizeObserver(()=>{ce(),Z()}).observe(e);let $=new Image;$.decoding=`async`,$.src=p;let me=getComputedStyle(document.documentElement).getPropertyValue(`--mono`).trim()||`monospace`,he=document.fonts?.load(`400 64px ${me}`).catch(()=>{})??Promise.resolve();Promise.all([$.decode(),he]).then(()=>{z=$.naturalWidth,B=$.naturalHeight,R=m.createTexture(),m.bindTexture(m.TEXTURE_2D,R),m.pixelStorei(m.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),m.texImage2D(m.TEXTURE_2D,0,m.RGBA8,m.RGBA,m.UNSIGNED_BYTE,$),m.pixelStorei(m.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),m.generateMipmap(m.TEXTURE_2D),m.texParameteri(m.TEXTURE_2D,m.TEXTURE_MIN_FILTER,m.LINEAR_MIPMAP_LINEAR),m.texParameteri(m.TEXTURE_2D,m.TEXTURE_MAG_FILTER,m.LINEAR),m.texParameteri(m.TEXTURE_2D,m.TEXTURE_WRAP_S,m.CLAMP_TO_EDGE),m.texParameteri(m.TEXTURE_2D,m.TEXTURE_WRAP_T,m.CLAMP_TO_EDGE),L=ie(m,me),X(),ce(),Z(),Q()},()=>{})}var b=document.querySelector(`[data-hero]`),x=()=>y({host:b,canvas:b.querySelector(`canvas`),anchor:b.querySelector(`[data-anchor]`),src:b.dataset.src});`requestIdleCallback`in window?requestIdleCallback(x,{timeout:600}):setTimeout(x,200);