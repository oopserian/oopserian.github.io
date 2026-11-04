import{t as e}from"./react.CadLv9_P.js";import{t}from"./jsx-runtime.C2DLLpjJ.js";import{a as n,i as r,n as i,o as a,r as o,t as s}from"./gl.B6Qi3-Xr.js";var c=e();function l(e){let t=e>>>0||1;return()=>(t=Math.imul(t,1664525)+1013904223>>>0)/4294967296}var u={day:{sun:[-.45,.62,.65],sunCol:[1.6,1.55,1.45],disc:0,zenith:[.2,.42,.82],mid:[.42,.62,.9],horizon:[.72,.82,.94],glow:[0,0,0],ambTop:[.62,.74,.95],ambBot:[.38,.47,.66],ink:[[.62,.72,.84],[.36,.53,.78],[.16,.32,.62],[.05,.12,.3]]},dusk:{sun:[.75,-.03,-1],sunCol:[2.6,1.15,.55],disc:0,zenith:[.07,.07,.2],mid:[.42,.24,.42],horizon:[1,.5,.3],glow:[1,.62,.32],ambTop:[.24,.2,.42],ambBot:[.34,.17,.28],ink:null}};function d(e=32){let t=(e,t)=>{let n=l(t),r=new Float32Array(e*e*e*3);for(let e=0;e<r.length;e++)r[e]=n();let i=t=>(t%e+e)%e;return(t,n,a)=>{let o=t*e,s=n*e,c=a*e,l=Math.floor(o),u=Math.floor(s),d=Math.floor(c),f=9;for(let t=-1;t<=1;t++)for(let n=-1;n<=1;n++)for(let a=-1;a<=1;a++){let p=l+a,m=u+n,h=d+t,g=((i(h)*e+i(m))*e+i(p))*3,_=p+r[g]-o,v=m+r[g+1]-s,y=h+r[g+2]-c,b=_*_+v*v+y*y;b<f&&(f=b)}return Math.sqrt(f)}},n=t(3,11),r=t(6,23),i=t(12,37),a=new Float32Array(e*e*e),o=9,s=-9;for(let t=0,c=0;t<e;t++)for(let l=0;l<e;l++)for(let u=0;u<e;u++,c++){let d=u/e,f=l/e,p=t/e;a[c]=(1-n(d,f,p))*.6+(1-r(d,f,p))*.27+(1-i(d,f,p))*.13,o=Math.min(o,a[c]),s=Math.max(s,a[c])}let c=new Uint8Array(e*e*e);for(let e=0;e<a.length;e++)c[e]=Math.round((a[e]-o)/(s-o)*255);return{data:c,n:e}}var f=[`.`,`:`,`-`,`=`,`+`,`*`,`#`,`%`,`@`],p=64;function m(e){let t=e.getContext(`2d`);e.width=p*f.length,e.height=p,t.fillStyle=t.strokeStyle=`#fff`,t.lineJoin=`round`,t.lineWidth=3,t.textAlign=`left`,t.textBaseline=`alphabetic`,t.font=`500 50px "DM Mono", ui-monospace, monospace`,f.forEach((e,n)=>{let r=t.measureText(e),i=r.actualBoundingBoxLeft,a=r.actualBoundingBoxRight,o=r.actualBoundingBoxAscent,s=r.actualBoundingBoxDescent,c=e===`-`||e===`=`?Math.max(1,Math.min(1.5,.8*p/(i+a))):1;t.save(),t.translate(n*p+p/2,p/2),t.scale(c,1);let l=-(a-i)/2,u=(o-s)/2;t.fillText(e,l,u),t.strokeText(e,l,u),t.restore()})}var h=`
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,g=`
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`,_=`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform float uU;                 // 一圈走到哪了，0~1
  uniform vec2 uDrift;              // 一圈飘多远（公里）
  uniform vec4 uDomain;
  ${g}
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return s / 0.96875; }
  void main() {
    vec2 p = uDomain.xy + vUv * uDomain.zw;
    float a = fbm((p - uDrift * uU) * 0.32), b = fbm((p - uDrift * (uU - 1.0)) * 0.32);   // 一团云三公里上下
    float m = 0.5 + (mix(a, b, uU) - 0.5) / sqrt((1.0 - uU) * (1.0 - uU) + uU * uU);
    o = vec4(m, 0.0, 0.0, 1.0);
  }
`,v=`
  precision highp float;
  precision highp sampler3D;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uCov;
  uniform sampler3D uDetail;
  uniform vec4 uDomain;
  uniform vec3 uF, uR, uUp;         // 镜头往前、往右、往上
  uniform vec2 uTan;                // 画面右沿、上沿离中间多远（tan）
  uniform vec3 uSun, uSunCol, uZenith, uMid, uHorizon, uGlow, uAmbTop, uAmbBot;
  uniform float uDisc;
  uniform vec3 uDScale, uDOff;      // 细节噪声的缩放、这一刻的偏移（跟着风走，一圈正好整数个周期）
  uniform vec4 uHole[8];            // 拨开的洞：从镜头看过去的方向 xyz，过了几秒（< 0 是没有）
  uniform float uHoleR[8];          // 洞的半径（视线偏开多少弧度）
  const float BASE = 1.0, TOP = 2.6, TMAX = 70.0;
  ${g}
  vec3 sky(vec3 rd) {
    float e = clamp(rd.y, 0.0, 1.0);
    vec3 c = e < 0.12 ? mix(uHorizon, uMid, e / 0.12) : mix(uMid, uZenith, pow((e - 0.12) / 0.88, 0.6));
    float s = max(dot(rd, uSun), 0.0);
    return c + uGlow * (0.3 * pow(s, 6.0) + 0.6 * pow(s, 60.0)) + uSunCol * uDisc * smoothstep(0.9990, 0.9995, s);
  }
  float density(vec3 p, bool fine) {
    float h = (p.y - BASE) / (TOP - BASE);
    vec2 uv = (p.xz - uDomain.xy) / uDomain.zw;
    if (h <= 0.0 || h >= 1.0 || uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return 0.0;
    float c = smoothstep(0.44, 0.66, texture(uCov, uv).r);
    float d = c * smoothstep(0.0, 0.06, h) - h * h * 1.1 - 0.04;     // 云底平、云顶圆：云越厚顶越高
    if (fine) d -= (1.0 - texture(uDetail, p * uDScale + uDOff).r) * 0.34;
    d = clamp(d * 4.0, 0.0, 1.0);
    if (d <= 0.0) return 0.0;
    // 拨开的洞：从镜头看过去，那个方向附近一圈的云都推开，透出后面的天。洞的边按细一点的噪声咬得参差，不是正圆；
    // 半径先一下子张开、再慢慢缩回去（JS 里算好传进来），像云又流回来
    float cut = 0.0, rag = -1.0;
    vec3 pn = normalize(p);
    for (int i = 0; i < 8; i++) {
      float r = uHoleR[i];
      if (uHole[i].w < 0.0 || r < 0.002) continue;
      float th = sqrt(2.0 * max(1.0 - dot(pn, uHole[i].xyz), 0.0));
      if (th > r * 1.7) continue;
      if (rag < 0.0) rag = 0.6 + 0.8 * texture(uDetail, (p * uDScale + uDOff) * 3.0).r;   // 离洞近才取，平时不多花
      cut = max(cut, 1.0 - smoothstep(r * 0.5, r, th * rag));
    }
    return d * (1.0 - cut);
  }
  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 rd = normalize(uF + uR * ndc.x * uTan.x + uUp * ndc.y * uTan.y);
    vec3 col = vec3(0.0); float Tr = 1.0;
    if (rd.y > 0.002) {
      float t0 = BASE / rd.y, t1 = min(TOP / rd.y, TMAX);
      if (t0 < TMAX) {
        float dt = (t1 - t0) / 48.0, t = t0 + dt * h21(gl_FragCoord.xy);
        float cosA = dot(rd, uSun);
        float phase = 0.55 + 1.4 * pow(max(cosA, 0.0), 10.0);       // 背着太阳看是散开的光，迎着太阳看云边一圈亮
        for (int i = 0; i < 48; i++) {
          vec3 p = rd * t;
          float d = density(p, true);
          if (d > 0.002) {
            float od = density(p + uSun * 0.1, false) * 0.1 + density(p + uSun * 0.3, false) * 0.2 + density(p + uSun * 0.7, false) * 0.4;
            float h = (p.y - BASE) / (TOP - BASE);
            vec3 L = uSunCol * exp(-od * 3.0) * phase * (1.0 - exp(-d * 5.0)) + mix(uAmbBot, uAmbTop, h) * (0.45 + 0.55 * h);
            L = mix(L, uHorizon, 1.0 - exp(-t / 45.0));                 // 远处被雾抹成地平线的颜色
            float tr = exp(-d * 6.0 * dt);
            col += Tr * (1.0 - tr) * L;
            Tr *= tr;
            if (Tr < 0.03) break;
          }
          t += dt;
        }
      }
    }
    col += Tr * sky(rd);
    o = vec4(1.0 - exp(-col * 1.4), 1.0 - Tr);
  }
`,y=`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uAtlas;
  uniform vec2 uRes, uCells;        // 画布（设备像素）、一共多少格
  uniform float uCell, uN;          // 一格多少设备像素、字有几个
  uniform vec4 uRange;              // 天的亮度从 x 到 y、云的亮度从 z 到 w
  uniform float uInk;               // 1：浅色主题，按浓淡上墨；0：深色主题，用底稿的颜色
  uniform vec3 uC0, uC1, uC2, uC3;  // 浅色主题的墨
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  float lum(vec3 c) { return dot(c, vec3(0.3, 0.55, 0.15)); }
  vec4 at(vec2 cell, float lod) { return textureLod(uScene, vec2((cell.x + 0.5) / uCells.x, 1.0 - (cell.y + 0.5) / uCells.y), lod); }
  // 这一格该多浓（0~1）：天只用最淡的三个字 . : -，越亮越浓；云用后面的 = + * # % @，也是越亮越浓
  float level(vec4 s) {
    float L = lum(s.rgb);
    float sky = clamp((L - uRange.x) / (uRange.y - uRange.x), 0.0, 1.0) * 0.32;
    float cloud = 0.36 + 0.64 * clamp((L - uRange.z) / (uRange.w - uRange.z), 0.0, 1.0);
    return mix(sky, cloud, smoothstep(0.2, 0.65, s.a));
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell);
    vec4 s = at(cell, 1.0);                                       // 底稿一格两个像素，第 1 层 mipmap 正好一格一个
    // 字顺着浓淡的等高线放：左右、上下隔一格的浓淡差是变化最快的方向，字跟它垂直，云边一圈的字就绕着云走；
    // 变化很小（天的大部分、云的里面）就横着放
    vec2 g = vec2(level(at(cell + vec2(1.0, 0.0), 1.5)) - level(at(cell - vec2(1.0, 0.0), 1.5)), level(at(cell + vec2(0.0, 1.0), 1.5)) - level(at(cell - vec2(0.0, 1.0), 1.5)));
    float a = atan(g.x, -g.y);
    a = mod(a + 1.5707963, 3.1415926) - 1.5707963;
    a *= smoothstep(0.03, 0.12, length(g));
    float lv = clamp(level(s) + (hash(cell) - 0.5) * 0.06, 0.0, 0.999);
    float gi = floor(lv * uN);
    // 颜色：深色主题取底稿的色相，亮度跟着字的浓淡走，最淡的也看得见；浅色主题按浓淡上墨
    vec3 hue = s.rgb / max(max(s.r, s.g), max(s.b, 0.02));
    vec3 col = mix(hue * (0.4 + 0.65 * lv), ramp(lv), uInk);
    vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
    vec2 q = vec2(cos(a) * loc.x + sin(a) * loc.y, -sin(a) * loc.x + cos(a) * loc.y);
    float ink = 0.0;
    if (abs(q.x) < 0.5 && abs(q.y) < 0.5) ink = texture(uAtlas, vec2((gi + q.x + 0.5) / uN, 0.5 - q.y)).r;
    o = vec4(col * ink, ink);   // 预乘过的透明度：字以外是透明的
  }
`;function b(e,{period:t=12e3,cell:c=8,fps:l=30}={}){let p=i(e),g=n(p),b=matchMedia(`(prefers-reduced-motion: reduce)`),x=b.matches||g,S=o(p),ee=r(p,h,_),te=r(p,h,v),C=r(p,h,y),w=[1.5,4],ne=[-60,-62,120,64],T=[1/w[0],.7,3/w[1]],re=[w[0]/(t/1e3),w[1]/(t/1e3)],E=21*Math.PI/180,D=Math.tan(20*Math.PI/180),ie=[0,Math.sin(E),-Math.cos(E)],ae=[1,0,0],oe=[0,Math.cos(E),Math.sin(E)],O=a(p,512,256),{data:se,n:k}=d(),A=p.createTexture();p.bindTexture(p.TEXTURE_3D,A),p.pixelStorei(p.UNPACK_ALIGNMENT,1),p.texImage3D(p.TEXTURE_3D,0,p.R8,k,k,k,0,p.RED,p.UNSIGNED_BYTE,se),p.pixelStorei(p.UNPACK_ALIGNMENT,4);for(let e of[p.TEXTURE_WRAP_S,p.TEXTURE_WRAP_T,p.TEXTURE_WRAP_R])p.texParameteri(p.TEXTURE_3D,e,p.REPEAT);p.texParameteri(p.TEXTURE_3D,p.TEXTURE_MIN_FILTER,p.LINEAR),p.texParameteri(p.TEXTURE_3D,p.TEXTURE_MAG_FILTER,p.LINEAR);let j=new Float32Array(32).fill(-1),M=new Float32Array(8).fill(.1),ce=Array(8).fill(-1e9),le=Array.from({length:8},()=>[0,0,0]),N=null,P=1,F=1,I=document.createElement(`canvas`);m(I);let L=s(p,I),R=0,z=0,B=1,V=0,H=!0,U=-1e9,W=!1,G=u.day,K=!1;function ue(){K=getComputedStyle(e).colorScheme.includes(`dark`),G=u[K?`dusk`:`day`]}let de=()=>{let[e,t,n]=G.sun,r=Math.hypot(e,t,n);return[e/r,t/r,n/r]};function fe(){R=e.clientWidth,z=e.clientHeight,R&&z&&(B=Math.min(2,window.devicePixelRatio||1),e.width=Math.round(R*B),e.height=Math.round(z*B),P=Math.ceil(R/c),F=Math.ceil(z/c),N?.dispose(),N=a(p,P*2,F*2,{mipmaps:!0}),ue(),$(!0))}let pe=(e,t)=>{let n=(e/(P*c)*2-1)*D*(P/F),r=(1-t/(F*c)*2)*D,i=[0,1,2].map(e=>ie[e]+ae[e]*n+oe[e]*r),a=Math.hypot(...i);return i.map(e=>e/a)},q=0,J=-1e9,Y=-1e9,X=-1e9;function Z(e,t){let n=pe(e,t);if(n[1]<.01)return;let r=Math.min(1.8/n[1],65);le[q]=n.map(e=>e*r),ce[q]=performance.now(),q=(q+1)%8,$(!0)}let me=t=>{let n=e.getBoundingClientRect();return[t.clientX-n.left,t.clientY-n.top]},he=e=>{if(x||!R)return;let[t,n]=me(e),r=performance.now(),i=Math.hypot(t-J,n-Y);i<6||i<40&&r-X<120||(J=t,Y=n,X=r,Z(t,n))},ge=e=>{if(x||!R)return;let[t,n]=me(e);J=t,Y=n,X=performance.now(),Z(t,n)};e.addEventListener(`pointermove`,he),e.addEventListener(`pointerdown`,ge);function _e(n){if(V=0,W||!R||!N)return;let r=!1;for(let e=0;e<8;e++){let t=(n-ce[e])/1e3,i=t>=0&&t<3.6,a=le[e];if(i){let n=a[0]+re[0]*t,i=a[1],o=a[2]+re[1]*t,s=Math.hypot(n,i,o);j.set([n/s,i/s,o/s,t],e*4);let c=Math.min(1,t/.3)**.5,l=Math.min(1,Math.max(0,(t-1.1)/2.5));M[e]=.125*c*(1-l*l*(3-2*l)),r=!0}else j[e*4+3]=-1}if(!x&&!r&&n-U<1e3/l-2){Q();return}U=n;let i=x?.3:(n%t+t)%t/t;O.bind(),ee.use({uU:i,uDrift:w,uDomain:ne}),S.draw(),N.bind(),te.use({uCov:[O.tex,0],uDetail:[A,1],uDomain:ne,uF:ie,uR:ae,uUp:oe,uTan:[P/F*D,D],uSun:de(),uSunCol:G.sunCol,uZenith:G.zenith,uMid:G.mid,uHorizon:G.horizon,uGlow:G.glow,uAmbTop:G.ambTop,uAmbBot:G.ambBot,uDisc:G.disc,uDScale:T,uDOff:[-w[0]*i*T[0],0,-w[1]*i*T[2]],uHole:j,uHoleR:M}),S.draw(),N.mip(),p.bindFramebuffer(p.FRAMEBUFFER,null),p.viewport(0,0,e.width,e.height),p.clearColor(0,0,0,0),p.clear(p.COLOR_BUFFER_BIT);let a=G.ink||u.day.ink;C.use({uScene:[N.tex,0],uAtlas:[L.tex,1],uRes:[e.width,e.height],uCells:[P,F],uCell:c*B,uN:f.length,uRange:K?[.18,.4,.32,.56]:[.45,.56,.42,.72],uInk:+!!G.ink,uC0:a[0],uC1:a[1],uC2:a[2],uC3:a[3]}),S.draw(),(!x||r)&&Q()}function Q(){!V&&!W&&H&&!document.hidden&&(V=requestAnimationFrame(_e))}function $(e=!1){e&&(U=-1e9),Q()}let ve=new IntersectionObserver(([e])=>{H=e.isIntersecting,H&&$(!0)});ve.observe(e);let ye=new ResizeObserver(()=>fe());ye.observe(e);let be=()=>{document.hidden||$(!0)};document.addEventListener(`visibilitychange`,be);let xe=()=>{x=b.matches||g,$(!0)};return b.addEventListener(`change`,xe),document.fonts?.load(`500 50px "DM Mono"`).then(()=>{W||(m(I),L.update(),$(!0))},()=>{}),fe(),{splash(){!x&&R&&Z(R*(.25+Math.random()*.5),z*(.2+Math.random()*.5))},refresh(){ue(),$(!0)},destroy(){W=!0,cancelAnimationFrame(V),V=0,ve.disconnect(),ye.disconnect(),e.removeEventListener(`pointermove`,he),e.removeEventListener(`pointerdown`,ge),document.removeEventListener(`visibilitychange`,be),b.removeEventListener(`change`,xe),O.dispose(),N?.dispose(),p.deleteTexture(A),L.dispose(),S.dispose(),ee.dispose(),te.dispose(),C.dispose()}}}var x=t();function S(){let e=(0,c.useRef)(null),t=(0,c.useRef)(null),[n,r]=(0,c.useState)(!1);return(0,c.useEffect)(()=>{let n;try{n=b(e.current,{period:12e3})}catch{r(!0);return}t.current=n;let i=()=>n.refresh(),a=new MutationObserver(i);a.observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]});let o=matchMedia(`(prefers-color-scheme: dark)`);return o.addEventListener(`change`,i),()=>{a.disconnect(),o.removeEventListener(`change`,i),n.destroy(),t.current=null}},[]),(0,x.jsxs)(`div`,{className:`lab-root ascii-clouds`,children:[(0,x.jsx)(`canvas`,{className:`sky`,ref:e,tabIndex:0,role:`img`,onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),t.current?.splash())},"aria-label":`Cumulus clouds drifting across a blue sky, or lit gold and pink at dusk in dark mode, drawn entirely in ASCII characters. Press Enter to part them.`}),n&&(0,x.jsx)(`p`,{className:`fallback`,children:`This experiment needs WebGL 2`}),(0,x.jsxs)(`p`,{className:`lab-hint`,children:[(0,x.jsx)(`span`,{className:`for-mouse`,children:`Sweep through the clouds to part them`}),(0,x.jsx)(`span`,{className:`for-touch`,children:`Tap or swipe through the clouds`})]})]})}export{S as default};