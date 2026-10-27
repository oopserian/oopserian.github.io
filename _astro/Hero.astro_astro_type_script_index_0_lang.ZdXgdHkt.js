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
var e=4,t={dark:.35,light:.08},n={dark:.07,light:.035},r=.04,i=15,a=2.2,o=24,s=.7,c=6,l=34,u=4,d=1.2,ee=.3,f=`#version 300 es
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
`,m=`#version 300 es
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
  float k = clamp(1.0 - length((px - uCenter) / uReach), 0.0, 1.0);
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
}`,h=`
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
  float coverage = sampleGlyph(index, local, gradX, gradY);
  float alpha = present * shown * coverage * mix(1.0, 0.35 + 0.65 * level, 0.3);
  vec3 color = mix(uInk, uHot, smoothstep(0.15, 0.5, hot));
  return vec4(color * alpha, alpha);
}
`,g=`#version 300 es
precision highp float;
uniform float uDownscale;
in vec2 vUv;
out vec4 outColor;
${h}
void main() {
  outColor = glyphAt(gl_FragCoord.xy * uDownscale);
}`,te=`#version 300 es
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
}`,ne=`#version 300 es
precision highp float;
uniform sampler2D uHalo;
uniform float uGlow;
uniform float uGhost;
uniform float uGrain;
uniform float uFrame;
in vec2 vUv;
out vec4 outColor;
${h}
void main() {
  vec4 glyph = glyphAt(gl_FragCoord.xy);
  vec4 under = texture(uHalo, vUv) * uGlow + vec4(uInk, 1.0) * texture(uField, fieldUv(gl_FragCoord.xy)).r * uGhost;
  vec4 color = glyph + under * (1.0 - glyph.a);
  float grain = (hash12(gl_FragCoord.xy + uFrame * vec2(17.0, 59.0)) + hash12(gl_FragCoord.xy * 1.31 + uFrame * 7.0) - 1.0) * uGrain;
  color.rgb += grain * (0.25 + color.a) * 0.5;
  color.a = clamp(color.a, 0.0, 1.0);
  color.rgb = clamp(color.rgb, 0.0, color.a);
  outColor = color;
}`;function _(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(console.warn(e.getShaderInfoLog(r)),e.deleteShader(r),null)}function v(e,t){let n=_(e,e.VERTEX_SHADER,f),r=_(e,e.FRAGMENT_SHADER,t);if(!n||!r)return null;let i=e.createProgram();if(e.attachShader(i,n),e.attachShader(i,r),e.linkProgram(i),e.deleteShader(n),e.deleteShader(r),!e.getProgramParameter(i,e.LINK_STATUS))return null;let a={},o=e.getProgramParameter(i,e.ACTIVE_UNIFORMS);for(let t=0;t<o;t++){let n=e.getActiveUniform(i,t).name.replace(/\[0\]$/,``);a[n]=e.getUniformLocation(i,n)}return{program:i,u:a}}function y(e,t){return{textures:Array.from({length:t},()=>{let t=e.createTexture();return e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),t}),framebuffer:e.createFramebuffer(),width:0,height:0}}function b(e,t,n,r){(t.width!==n||t.height!==r)&&(t.width=n,t.height=r,e.bindFramebuffer(e.FRAMEBUFFER,t.framebuffer),t.textures.forEach((t,i)=>{e.bindTexture(e.TEXTURE_2D,t),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,n,r,0,e.RGBA,e.UNSIGNED_BYTE,null),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+i,e.TEXTURE_2D,t,0)}),e.bindFramebuffer(e.FRAMEBUFFER,null))}function re(e,t){let n=`400 78px ${t}`,r=(e,t)=>{let r=document.createElement(`canvas`);r.width=60*t,r.height=100*Math.ceil(e.length/t);let i=r.getContext(`2d`,{willReadFrequently:!0});return i.font=n,i.textAlign=`center`,i.textBaseline=`middle`,i.fillStyle=`#fff`,e.forEach((e,n)=>i.fillText(e,n%t*60+30,Math.floor(n/t)*100+50+3)),{c:r,x:i}},i=Array.from(new Set(` .'\`,:;-~"^=+<>!/\\|()?ivxzo*%#&$@8B`)),{x:a}=r(i,i.length),o=a.getImageData(0,0,60*i.length,100).data,s=i.map((e,t)=>{let n=0;for(let e=0;e<100;e++)for(let r=0;r<60;r++)n+=o[(e*60*i.length+t*60+r)*4+3];return n}),c=i.map((e,t)=>t).sort((e,t)=>s[e]-s[t]),l=s[c[c.length-1]],u=[` `];for(let e=1;e<14;e++){let t=(e/13)**1.15*l,n=c[1];for(let e of c)i[e]!==` `&&Math.abs(s[e]-t)<Math.abs(s[n]-t)&&(n=e);u.push(i[n])}let d=[...u,...`!?/\\|()[]{}<>=+*#%&$@0123456789`],{c:ee}=r(d,16),f=e.createTexture();return e.bindTexture(e.TEXTURE_2D,f),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,e.RGBA,e.UNSIGNED_BYTE,ee),e.generateMipmap(e.TEXTURE_2D),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),{texture:f,grid:[16,Math.ceil(d.length/16)]}}function ie(e){let t=String(e.getParameter(e.RENDERER));if(/^webkit webgl$/i.test(t)){let n=e.getExtension(`WEBGL_debug_renderer_info`);n&&(t=String(e.getParameter(n.UNMASKED_RENDERER_WEBGL)))}return/swiftshader|llvmpipe|softpipe|software|basic render/i.test(t)}function ae(e){let t=document.createElement(`canvas`).getContext(`2d`,{willReadFrequently:!0});t.fillStyle=e,t.fillRect(0,0,1,1);let n=t.getImageData(0,0,1,1).data;return[n[0]/255,n[1]/255,n[2]/255]}function x({host:e,canvas:l,anchor:f,src:p}){let h=l.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});if(!h)return;let _=v(h,m),x=v(h,g),S=v(h,te),C=v(h,ne);if(!_||!x||!S||!C)return;let oe=h.createVertexArray(),w=y(h,2),T=y(h,1),E=y(h,1),D=matchMedia(`(prefers-reduced-motion: reduce)`),O=ie(h),k=D.matches||O,A={x:0,y:0,width:1,height:1,ratio:1,cellW:4.8,cellH:8,cols:1,rows:1,lod:0},j=new Float32Array(4),M=new Float32Array(2),N=new Float32Array(2),P=[],F=[],I=new Float32Array(96),L=new Float32Array(16),R={ink:[1,1,1],hot:[1,.5,.2],light:!1},z=null,B=null,V=1,H=1,U=0,W=0,G=+!!k,K=0,q=0,J=0,Y=0,se=0,X=!0;function ce(){let e=getComputedStyle(l),t=getComputedStyle(document.documentElement).colorScheme;R={ink:ae(e.getPropertyValue(`--ascii`).trim()||`#888`),hot:ae(e.getPropertyValue(`--ascii-hot`).trim()||`#f80`),light:!t.includes(`dark`)}}function le(){let t=e.getBoundingClientRect(),n=f.getBoundingClientRect(),r=Math.max(n.width,n.height)*ee,i=Math.max(0,n.left-t.left-r),a=Math.max(0,n.top-t.top-r),o=Math.min(t.width,n.right-t.left+r),s=Math.min(t.height,n.bottom-t.top+r);A.x=i,A.y=a,A.width=Math.max(1,o-i),A.height=Math.max(1,s-a),Object.assign(l.style,{left:`${i}px`,top:`${a}px`,width:`${A.width}px`,height:`${A.height}px`}),A.ratio=Math.min(devicePixelRatio||1,2);let c=parseFloat(getComputedStyle(l).getPropertyValue(`--ascii-cell`))||8;l.width=Math.round(A.width*A.ratio),l.height=Math.round(A.height*A.ratio),A.cellH=c*A.ratio,A.cellW=A.cellH*(60/100),A.cols=Math.ceil(l.width/A.cellW),A.rows=Math.ceil(l.height/A.cellH);let u=Math.min(n.width/V,n.height/H),d=V*u,p=H*u;j.set([n.left-t.left-i+(n.width-d)/2,n.top-t.top-a+(n.height-p)/2,d,p]),M.set([j[0]+d/2,j[1]+p/2]),N.set([n.width/2+r,n.height/2+r]),A.lod=Math.max(0,Math.log2(Math.sqrt(c*c*(60/100)/12)/u)),b(h,w,A.cols,A.rows);let m=Math.max(1,Math.round(l.width/4)),g=Math.max(1,Math.round(l.height/4));b(h,T,m,g),b(h,E,m,g)}function ue(e){let t=h,n=e.u;t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,w.textures[0]),t.uniform1i(n.uField,0),t.activeTexture(t.TEXTURE1),t.bindTexture(t.TEXTURE_2D,w.textures[1]),t.uniform1i(n.uAux,1),t.activeTexture(t.TEXTURE2),t.bindTexture(t.TEXTURE_2D,z.texture),t.uniform1i(n.uAtlas,2),t.uniform2f(n.uRes,l.width,l.height),t.uniform2f(n.uCellPx,A.cellW,A.cellH),t.uniform2f(n.uGrid,A.cols,A.rows),t.uniform2f(n.uAtlasGrid,z.grid[0],z.grid[1]),t.uniform1f(n.uLevels,14),t.uniform1f(n.uNoise,31),t.uniform1f(n.uFlicker,k?0:.5),t.uniform1f(n.uGlyphTime,W),t.uniform3fv(n.uInk,R.ink),t.uniform3fv(n.uHot,R.hot)}function Z(){if(!z||!B)return;let e=h;e.bindVertexArray(oe),e.disable(e.BLEND),e.bindFramebuffer(e.FRAMEBUFFER,w.framebuffer),e.drawBuffers([e.COLOR_ATTACHMENT0,e.COLOR_ATTACHMENT1]),e.viewport(0,0,w.width,w.height),e.useProgram(_.program);let i=_.u;e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,B),e.uniform1i(i.uPortrait,0),e.uniform2f(i.uSize,A.width,A.height),e.uniform2f(i.uGrid,A.cols,A.rows),e.uniform2f(i.uCellCss,A.cellW/A.ratio,A.cellH/A.ratio),e.uniform1f(i.uLod,A.lod),e.uniform4fv(i.uRect,j),e.uniform2fv(i.uCenter,M),e.uniform2fv(i.uReach,N),e.uniform1f(i.uTime,U),e.uniform1f(i.uIntro,G),e.uniform1f(i.uLight,+!!R.light),e.uniform4fv(i.uTrail,I),e.uniform4fv(i.uClicks,L),e.drawArrays(e.TRIANGLES,0,3),e.bindFramebuffer(e.FRAMEBUFFER,T.framebuffer),e.drawBuffers([e.COLOR_ATTACHMENT0]),e.viewport(0,0,T.width,T.height),e.useProgram(x.program),ue(x),e.uniform1f(x.u.uDownscale,l.width/T.width),e.drawArrays(e.TRIANGLES,0,3),e.useProgram(S.program),e.activeTexture(e.TEXTURE0),e.uniform1i(S.u.uSource,0),e.bindFramebuffer(e.FRAMEBUFFER,E.framebuffer),e.bindTexture(e.TEXTURE_2D,T.textures[0]),e.uniform2f(S.u.uStep,1/T.width,0),e.drawArrays(e.TRIANGLES,0,3),e.bindFramebuffer(e.FRAMEBUFFER,T.framebuffer),e.bindTexture(e.TEXTURE_2D,E.textures[0]),e.uniform2f(S.u.uStep,0,1/T.height),e.drawArrays(e.TRIANGLES,0,3),e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,l.width,l.height),e.useProgram(C.program),ue(C);let a=C.u;e.activeTexture(e.TEXTURE3),e.bindTexture(e.TEXTURE_2D,T.textures[0]),e.uniform1i(a.uHalo,3),e.uniform1f(a.uGlow,R.light?t.light:t.dark),e.uniform1f(a.uGhost,R.light?n.light:n.dark),e.uniform1f(a.uGrain,k?0:r),e.uniform1f(a.uFrame,K),e.drawArrays(e.TRIANGLES,0,3)}function de(e){for(let t of P)t.age+=e;for(;P.length&&P[P.length-1].age>s;)P.pop();for(let e=0;e<o;e++){let t=P[e];if(!t){I[e*4+2]=0;continue}let n=1-t.age/s;I.set([t.x,t.y,n*n,0],e*4)}for(let t of F)t.age+=e;for(;F.length&&F[F.length-1].age>d;)F.pop();for(let e=0;e<u;e++){let t=F[e];if(!t){L[e*4+3]=0;continue}let n=t.age/d;L.set([t.x,t.y,t.age,Math.min(1,t.age/.08)*(1-n)*(1-n)],e*4)}}function fe(e){if(J=0,!X||k)return;if(!(G<1||P.length>0||F.length>0)&&e-se<1e3/i-2){Q();return}let t=Y?Math.min(.1,Math.max(.001,(e-Y)/1e3)):1/60;Y=e,se=e,U+=t*.5,W+=t,G<1&&(G=Math.min(1,G+t/a)),q+=t,q>1/i&&(q=0,K=(K+1)%97),de(t),Z(),Q()}function Q(){!J&&X&&!k&&(J=requestAnimationFrame(fe))}let pe=t=>{let n=e.getBoundingClientRect();return{x:t.clientX-n.left-A.x,y:t.clientY-n.top-A.y}};e.addEventListener(`pointermove`,e=>{if(k)return;let t=pe(e),n=P[0],r=n?Math.hypot(t.x-n.x,t.y-n.y):1/0;if(!(r<c)){if(n&&n.age<.1){let e=Math.min(6,Math.floor(r/12));for(let r=1;r<=e;r++){let i=r/(e+1);P.unshift({x:n.x+(t.x-n.x)*i,y:n.y+(t.y-n.y)*i,age:0})}}P.unshift({...t,age:0}),P.length=Math.min(P.length,o),Q()}},{passive:!0}),e.addEventListener(`pointerdown`,e=>{k||e.target.closest(`a, button`)||(F.unshift({...pe(e),age:0}),F.length>u&&F.pop(),Q())},{passive:!0}),new IntersectionObserver(([e])=>{X=e.isIntersecting&&!document.hidden,Y=0,Q()}).observe(e),document.addEventListener(`visibilitychange`,()=>{X=!document.hidden,Y=0,Q()});let me=()=>{ce(),Z()};new MutationObserver(me).observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]}),matchMedia(`(prefers-color-scheme: dark)`).addEventListener(`change`,me),D.addEventListener(`change`,()=>{k=D.matches||O,k&&(G=1),Z(),Q()}),new ResizeObserver(()=>{le(),Z()}).observe(e);let $=new Image;$.decoding=`async`,$.src=p;let he=getComputedStyle(document.documentElement).getPropertyValue(`--mono`).trim()||`monospace`,ge=document.fonts?.load(`400 64px ${he}`).catch(()=>{})??Promise.resolve();Promise.all([$.decode(),ge]).then(()=>{V=$.naturalWidth,H=$.naturalHeight,B=h.createTexture(),h.bindTexture(h.TEXTURE_2D,B),h.pixelStorei(h.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),h.texImage2D(h.TEXTURE_2D,0,h.RGBA8,h.RGBA,h.UNSIGNED_BYTE,$),h.pixelStorei(h.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),h.generateMipmap(h.TEXTURE_2D),h.texParameteri(h.TEXTURE_2D,h.TEXTURE_MIN_FILTER,h.LINEAR_MIPMAP_LINEAR),h.texParameteri(h.TEXTURE_2D,h.TEXTURE_MAG_FILTER,h.LINEAR),h.texParameteri(h.TEXTURE_2D,h.TEXTURE_WRAP_S,h.CLAMP_TO_EDGE),h.texParameteri(h.TEXTURE_2D,h.TEXTURE_WRAP_T,h.CLAMP_TO_EDGE),z=re(h,he),ce(),le(),Z(),Q()},()=>{})}var S=document.querySelector(`[data-hero]`),C=()=>x({host:S,canvas:S.querySelector(`canvas`),anchor:S.querySelector(`[data-anchor]`),src:S.dataset.src});`requestIdleCallback`in window?requestIdleCallback(C,{timeout:600}):setTimeout(C,200);