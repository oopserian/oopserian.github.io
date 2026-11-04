import{t as e}from"./react.CadLv9_P.js";import{t}from"./jsx-runtime.C2DLLpjJ.js";import{a as n,i as r,n as i,o as a,r as o,t as s}from"./gl.B6Qi3-Xr.js";var c=e();function l(e,t,n){let r=0,i=1/0;for(let a=1;a<e.length-1;a++){if(n(e[a])||n(e[a+1]))continue;let o=t(e[a-1]),s=t(e[a]),c=t(e[a+1]),l=[s[0]-o[0],s[1]-o[1],s[2]-o[2]],u=[c[0]-o[0],c[1]-o[1],c[2]-o[2]],d=Math.hypot(l[1]*u[2]-l[2]*u[1],l[2]*u[0]-l[0]*u[2],l[0]*u[1]-l[1]*u[0]);d<i&&(i=d,r=a)}e.splice(r,1)}function u(e){let t=e>>>0||1;return()=>(t=Math.imul(t,1664525)+1013904223>>>0)/4294967296}var d={day:{sun:[-.45,.62,.65],sunCol:[1.6,1.55,1.45],disc:0,zenith:[.2,.42,.82],mid:[.42,.62,.9],horizon:[.72,.82,.94],glow:[0,0,0],ambTop:[.62,.74,.95],ambBot:[.38,.47,.66],ink:[[.62,.72,.84],[.36,.53,.78],[.16,.32,.62],[.05,.12,.3]]},dusk:{sun:[.75,-.03,-1],sunCol:[2.6,1.15,.55],disc:0,zenith:[.07,.07,.2],mid:[.42,.24,.42],horizon:[1,.5,.3],glow:[1,.62,.32],ambTop:[.24,.2,.42],ambBot:[.34,.17,.28],ink:null}};function f(e=32){let t=(e,t)=>{let n=u(t),r=new Float32Array(e*e*e*3);for(let e=0;e<r.length;e++)r[e]=n();let i=t=>(t%e+e)%e;return(t,n,a)=>{let o=t*e,s=n*e,c=a*e,l=Math.floor(o),u=Math.floor(s),d=Math.floor(c),f=9;for(let t=-1;t<=1;t++)for(let n=-1;n<=1;n++)for(let a=-1;a<=1;a++){let p=l+a,m=u+n,h=d+t,g=((i(h)*e+i(m))*e+i(p))*3,_=p+r[g]-o,v=m+r[g+1]-s,y=h+r[g+2]-c,b=_*_+v*v+y*y;b<f&&(f=b)}return Math.sqrt(f)}},n=t(3,11),r=t(6,23),i=t(12,37),a=new Float32Array(e*e*e),o=9,s=-9;for(let t=0,c=0;t<e;t++)for(let l=0;l<e;l++)for(let u=0;u<e;u++,c++){let d=u/e,f=l/e,p=t/e;a[c]=(1-n(d,f,p))*.6+(1-r(d,f,p))*.27+(1-i(d,f,p))*.13,o=Math.min(o,a[c]),s=Math.max(s,a[c])}let c=new Uint8Array(e*e*e);for(let e=0;e<a.length;e++)c[e]=Math.round((a[e]-o)/(s-o)*255);return{data:c,n:e}}var p=[`.`,`:`,`-`,`=`,`+`,`*`,`#`,`%`,`@`],m=64,h=4,g=64;function _(e){let t=e.getContext(`2d`);e.width=g*p.length,e.height=g,t.fillStyle=t.strokeStyle=`#fff`,t.lineJoin=`round`,t.lineWidth=3,t.textAlign=`left`,t.textBaseline=`alphabetic`,t.font=`500 50px "DM Mono", ui-monospace, monospace`,p.forEach((e,n)=>{let r=t.measureText(e),i=r.actualBoundingBoxLeft,a=r.actualBoundingBoxRight,o=r.actualBoundingBoxAscent,s=r.actualBoundingBoxDescent,c=e===`-`||e===`=`?Math.max(1,Math.min(1.5,.8*g/(i+a))):1;t.save(),t.translate(n*g+g/2,g/2),t.scale(c,1);let l=-(a-i)/2,u=(o-s)/2;t.fillText(e,l,u),t.strokeText(e,l,u),t.restore()})}var v=`
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,y=`
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`,b=`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform float uU;                 // 一圈走到哪了，0~1
  uniform vec2 uDrift;              // 一圈飘多远（公里）
  uniform vec4 uDomain;
  ${y}
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return s / 0.96875; }
  void main() {
    vec2 p = uDomain.xy + vUv * uDomain.zw;
    float a = fbm((p - uDrift * uU) * 0.32), b = fbm((p - uDrift * (uU - 1.0)) * 0.32);   // 一团云三公里上下
    float m = 0.5 + (mix(a, b, uU) - 0.5) / sqrt((1.0 - uU) * (1.0 - uU) + uU * uU);
    o = vec4(m, 0.0, 0.0, 1.0);
  }
`,ee=`
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
  uniform vec4 uGroove[${m}];  // 拨开的沟：手划过的一串点，由旧到新。从镜头看过去的方向 xyz、过了几秒
  uniform float uGrooveR[${m}]; // 那一点沟有多宽（视线偏开多少弧度）；负的是一笔的开头
  uniform float uGrooveN;           // 有几个点
  const float BASE = 1.0, TOP = 2.6, TMAX = 70.0;
  float gCut = 0.0, gRim = 0.0;     // 这条视线上的云被拨掉多少、沟边堆起来多少
  ${y}
  vec3 sky(vec3 rd) {
    float e = clamp(rd.y, 0.0, 1.0);
    vec3 c = e < 0.12 ? mix(uHorizon, uMid, e / 0.12) : mix(uMid, uZenith, pow(max(e - 0.12, 0.0) / 0.88, 0.6));   // pow 的底不能是负的
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
    // 拨开的沟：每个像素算好一次（gCut、gRim，见 main），一条视线上处处一样
    d *= (1.0 - gCut) * (1.0 + 0.9 * gRim);
    return d;
  }
  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 rd = normalize(uF + uR * ndc.x * uTan.x + uUp * ndc.y * uTan.y);
    // 离最近那道沟多远：每一笔是一串点连成的折线（方向球面上），看这条视线离哪一段最近，按那里的宽度算（gRho，1 是沟边）
    float gRho = 1e3, gAge = 0.0;
    for (int i = 0; i < ${m}; i++) {
      if (float(i) >= uGrooveN) break;
      vec4 B = uGroove[i]; float rb = uGrooveR[i];
      bool start = i == 0 || rb < 0.0;
      vec4 A = start ? B : uGroove[max(i - 1, 0)];
      float ra = abs(start ? rb : uGrooveR[max(i - 1, 0)]); rb = abs(rb);
      vec3 ab = B.xyz - A.xyz; float l2 = dot(ab, ab);
      float t = l2 > 1e-9 ? clamp(dot(rd - A.xyz, ab) / l2, 0.0, 1.0) : 0.0;
      float r = mix(ra, rb, t);
      if (r < 0.002) continue;
      float rho = length(rd - normalize(A.xyz + ab * t)) / r;
      if (rho < gRho) { gRho = rho; gAge = mix(A.w, B.w, t); }
    }
    // 沟边按两层噪声（大团的 nb、细碎的 nf）咬得参差，沟里靠边的地方留几块被打散的碎云；沟边外面一圈的云更浓，像被推到两边堆起来。
    // 合上时不是沟边整齐地往里收，而是噪声高的（鼓起来的那一团团）先长回来，一缕一缕地填满。
    // 噪声取视线穿过云层中间（1.8 公里高）那一点的，跟着风走；沿着视线取的话一条线上几十公里一平均，沟边就又是光滑的了
    if (gRho < 2.2) {
      vec3 dp = rd * min(1.8 / max(rd.y, 0.01), 65.0) * uDScale + uDOff;
      float nb = texture(uDetail, dp * 0.7).r, nf = texture(uDetail, dp * 2.2).r, n = 0.55 * nb + 0.45 * nf;
      float q = gRho * (0.45 + 0.8 * nb + 0.3 * nf);
      float fill = 1.25 * smoothstep(0.8, ${h}.0, gAge);
      gCut = (1.0 - smoothstep(0.7, 1.0, q)) * (1.0 - smoothstep(1.0 - fill, 1.25 - fill, n));
      gCut *= 1.0 - 0.9 * smoothstep(0.68, 0.82, nf) * smoothstep(0.35, 0.8, q);   // 碎云
      gRim = exp(-(q - 1.12) * (q - 1.12) / 0.04) * (1.0 - fill / 1.25) * smoothstep(0.0, 0.3, gAge);
    }
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
`,te=`
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
    // 变化很小（天的大部分、云的里面）就横着放。浓淡卡在头上（最亮的云）时四周一样，g 正好是 0：
    // atan(0, 0) 规范里没定义，有的显卡算出 NaN，整格就没字了，所以先换成一个横着的方向
    vec2 g = vec2(level(at(cell + vec2(1.0, 0.0), 1.5)) - level(at(cell - vec2(1.0, 0.0), 1.5)), level(at(cell + vec2(0.0, 1.0), 1.5)) - level(at(cell - vec2(0.0, 1.0), 1.5)));
    vec2 gs = dot(g, g) > 1e-12 ? g : vec2(0.0, -1.0);
    float a = atan(gs.x, -gs.y);
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
`;function x(e,{period:t=12e3,cell:c=8,fps:u=30}={}){let g=i(e),y=n(g),x=matchMedia(`(prefers-reduced-motion: reduce)`),S=x.matches||y,C=o(g),ne=r(g,v,b),re=r(g,v,ee),ie=r(g,v,te),w=[1.5,4],ae=[-60,-62,120,64],T=[1/w[0],.7,3/w[1]],oe=[w[0]/(t/1e3),w[1]/(t/1e3)],E=21*Math.PI/180,D=Math.tan(20*Math.PI/180),se=[0,Math.sin(E),-Math.cos(E)],ce=[1,0,0],le=[0,Math.cos(E),Math.sin(E)],O=a(g,512,256),{data:ue,n:k}=f(),A=g.createTexture();g.bindTexture(g.TEXTURE_3D,A),g.pixelStorei(g.UNPACK_ALIGNMENT,1),g.texImage3D(g.TEXTURE_3D,0,g.R8,k,k,k,0,g.RED,g.UNSIGNED_BYTE,ue),g.pixelStorei(g.UNPACK_ALIGNMENT,4);for(let e of[g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T,g.TEXTURE_WRAP_R])g.texParameteri(g.TEXTURE_3D,e,g.REPEAT);g.texParameteri(g.TEXTURE_3D,g.TEXTURE_MIN_FILTER,g.LINEAR),g.texParameteri(g.TEXTURE_3D,g.TEXTURE_MAG_FILTER,g.LINEAR);let j=[],de=new Float32Array(256),fe=new Float32Array(m),M=null,N=1,P=1,F=document.createElement(`canvas`);_(F);let I=s(g,F),L=0,R=0,z=1,B=0,V=!0,H=-1e9,U=!1,W=d.day,G=!1;function pe(){G=getComputedStyle(e).colorScheme.includes(`dark`),W=d[G?`dusk`:`day`]}let me=()=>{let[e,t,n]=W.sun,r=Math.hypot(e,t,n);return[e/r,t/r,n/r]};function he(){L=e.clientWidth,R=e.clientHeight,L&&R&&(z=Math.min(2,window.devicePixelRatio||1),e.width=Math.round(L*z),e.height=Math.round(R*z),N=Math.ceil(L/c),P=Math.ceil(R/c),M?.dispose(),M=a(g,N*2,P*2,{mipmaps:!0}),pe(),$(!0))}let ge=(e,t)=>{let n=(e/(N*c)*2-1)*D*(N/P),r=(1-t/(P*c)*2)*D,i=[0,1,2].map(e=>se[e]+ce[e]*n+le[e]*r),a=Math.hypot(...i);return i.map(e=>e/a)},K=null,q=0,J=0,Y=-1e9,_e=(e,t)=>{let n=ge(e,t);if(n[1]<.01)return null;let r=Math.min(1.8/n[1],65);return n.map(e=>e*r)},ve=e=>{let t=Math.hypot(...e);return e.map(e=>e/t)};function X(e){j.push(e),j.length>m&&l(j,e=>ve(e.p),e=>e.start)}function Z(e,t,n,r){let i=_e(e,t);if(!i){K=null;return}let a=(r?.13:.085)*(.85+.3*Math.random());r?(X({p:i,t:n,r0:a,start:!0}),K=null):!K||n-K.t>250?(K={p:i,t:n,r0:a,start:!0},X(K),q=e,J=t,Y=n):Math.hypot(e-q,t-J)>=40||n-Y>=120||j[j.length-1]!==K||K.start?(K={p:i,t:n,r0:a,start:!1},X(K),q=e,J=t,Y=n):Object.assign(K,{p:i,t:n}),$(!0)}let ye=t=>{let n=e.getBoundingClientRect();return[t.clientX-n.left,t.clientY-n.top]},be=e=>{if(S||!L)return;let[t,n]=ye(e);Z(t,n,performance.now(),!1)},xe=e=>{if(S||!L)return;let[t,n]=ye(e);Z(t,n,performance.now(),!0)},Se=()=>{K=null};e.addEventListener(`pointermove`,be),e.addEventListener(`pointerdown`,xe),e.addEventListener(`pointerleave`,Se);function Ce(n){if(B=0,U||!L||!M)return;for(;j.length&&(n-j[0].t)/1e3>=h;)j.shift();j.length||(K=null),j.forEach((e,t)=>{let r=Math.max(0,(n-e.t)/1e3),i=e.p[0]+oe[0]*r,a=e.p[1],o=e.p[2]+oe[1]*r,s=Math.hypot(i,a,o),c=Math.min(1,Math.max(0,(r-1.2)/2.8)),l=e.r0*Math.min(1,r/.2)**.5*(1-.3*c*c*(3-2*c));de.set([i/s,a/s,o/s,r],t*4),fe[t]=t===0||e.start?-Math.max(l,1e-4):l});let r=j.length>0;if(!S&&!r&&n-H<1e3/u-2){Q();return}H=n;let i=S?.3:(n%t+t)%t/t;O.bind(),ne.use({uU:i,uDrift:w,uDomain:ae}),C.draw(),M.bind(),re.use({uCov:[O.tex,0],uDetail:[A,1],uDomain:ae,uF:se,uR:ce,uUp:le,uTan:[N/P*D,D],uSun:me(),uSunCol:W.sunCol,uZenith:W.zenith,uMid:W.mid,uHorizon:W.horizon,uGlow:W.glow,uAmbTop:W.ambTop,uAmbBot:W.ambBot,uDisc:W.disc,uDScale:T,uDOff:[-w[0]*i*T[0],0,-w[1]*i*T[2]],uGroove:de,uGrooveR:fe,uGrooveN:j.length}),C.draw(),M.mip(),g.bindFramebuffer(g.FRAMEBUFFER,null),g.viewport(0,0,e.width,e.height),g.clearColor(0,0,0,0),g.clear(g.COLOR_BUFFER_BIT);let a=W.ink||d.day.ink;ie.use({uScene:[M.tex,0],uAtlas:[I.tex,1],uRes:[e.width,e.height],uCells:[N,P],uCell:c*z,uN:p.length,uRange:G?[.18,.4,.32,.56]:[.45,.56,.42,.72],uInk:+!!W.ink,uC0:a[0],uC1:a[1],uC2:a[2],uC3:a[3]}),C.draw(),(!S||r)&&Q()}function Q(){!B&&!U&&V&&!document.hidden&&(B=requestAnimationFrame(Ce))}function $(e=!1){e&&(H=-1e9),Q()}let we=new IntersectionObserver(([e])=>{V=e.isIntersecting,V&&$(!0)});we.observe(e);let Te=new ResizeObserver(()=>he());Te.observe(e);let Ee=()=>{document.hidden||$(!0)};document.addEventListener(`visibilitychange`,Ee);let De=()=>{S=x.matches||y,$(!0)};return x.addEventListener(`change`,De),document.fonts?.load(`500 50px "DM Mono"`).then(()=>{U||(_(F),I.update(),$(!0))},()=>{}),he(),{splash(){!S&&L&&Z(L*(.25+Math.random()*.5),R*(.2+Math.random()*.5),performance.now(),!0)},refresh(){pe(),$(!0)},destroy(){U=!0,cancelAnimationFrame(B),B=0,we.disconnect(),Te.disconnect(),e.removeEventListener(`pointermove`,be),e.removeEventListener(`pointerdown`,xe),e.removeEventListener(`pointerleave`,Se),document.removeEventListener(`visibilitychange`,Ee),x.removeEventListener(`change`,De),O.dispose(),M?.dispose(),g.deleteTexture(A),I.dispose(),C.dispose(),ne.dispose(),re.dispose(),ie.dispose()}}}var S=t();function C(){let e=(0,c.useRef)(null),t=(0,c.useRef)(null),[n,r]=(0,c.useState)(!1);return(0,c.useEffect)(()=>{let n;try{n=x(e.current,{period:12e3})}catch{r(!0);return}t.current=n;let i=()=>n.refresh(),a=new MutationObserver(i);a.observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]});let o=matchMedia(`(prefers-color-scheme: dark)`);return o.addEventListener(`change`,i),()=>{a.disconnect(),o.removeEventListener(`change`,i),n.destroy(),t.current=null}},[]),(0,S.jsxs)(`div`,{className:`lab-root ascii-clouds`,children:[(0,S.jsx)(`canvas`,{className:`sky`,ref:e,tabIndex:0,role:`img`,onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),t.current?.splash())},"aria-label":`Cumulus clouds drifting across a blue sky, or lit gold and pink at dusk in dark mode, drawn entirely in ASCII characters. Press Enter to part them.`}),n&&(0,S.jsx)(`p`,{className:`fallback`,children:`This experiment needs WebGL 2`}),(0,S.jsxs)(`p`,{className:`lab-hint`,children:[(0,S.jsx)(`span`,{className:`for-mouse`,children:`Sweep through the clouds to part them`}),(0,S.jsx)(`span`,{className:`for-touch`,children:`Tap or swipe through the clouds`})]})]})}export{C as default};