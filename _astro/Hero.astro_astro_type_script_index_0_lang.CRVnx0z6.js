import{a as e,i as t,n,r}from"./gl.B6Qi3-Xr.js";var i=`/_astro/sooty-stone.UqcIJ375.png`,a=1200,o=630,s=.42,c=10.8,l=18,u=` +xX0S8#@`,d=[770,148,340,334],f=[999,392],p=.791,m=[938,314],h=30,g=2.6,_=-40,v=[[-34,10,10,10],[-26,12,13,17],[-20,11,16,38],[-14,14,22,58],[-8,16,28,88],[-2,18,35,105],[4,20,39,133],[10,23,44,159],[16,25,50,169],[22,27,57,189],[28,35,69,205],[34,49,85,205],[40,67,107,218],[46,91,129,226],[52,117,147,222],[58,152,175,227],[64,200,208,224],[70,214,221,227],[76,214,223,228],[82,196,219,235],[88,178,206,228],[100,157,196,227],[112,125,190,228],[124,98,179,226],[136,81,179,224],[148,62,178,228],[175,45,168,228],[200,40,160,226]],y=`
  in vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
`,b=`
  precision highp float;
  precision highp int;
  uniform sampler2D uPoster, uStone, uAtlas, uLut;
  uniform vec2 uRes, uOrg;      // 画布多少像素；海报左上角落在画布哪（设备像素）
  uniform float uS;             // 海报 1 像素 = 多少设备像素
  uniform float uT, uStep;      // 秒；字换一次的节拍（一秒 12 拍）
  uniform float uHov;           // 鼠标在上面，0 到 1
  uniform vec2 uPtr, uPar;      // 鼠标在海报上的位置；跟着鼠标挪的量（-1 到 1）
  uniform vec2 uSun;            // 地平线上最亮的那一段：在哪（海报 x）、抬起来多高
  uniform float uRing;          // 开场那一下走了几秒，没有就是负的
  uniform float uRingAmp;       // 那一下多重：开场是 1，鼠标移进来时再来一下轻的
  uniform float uWarm;          // 鼠标离缝里的亮点多近（0 到 1）：越近缝里越亮
  uniform vec2 uStoneOff, uGlint;
  uniform float uStoneAng;
  out vec4 outColor;

  const vec2 CELL = vec2(${c}, ${l});
  const float N = 9.0;
  const float RR = 2760.0;                    // 星球的半径：弧线顶在 (600, 474)，两头在 540 上下，跟海报一样
  const vec2 STONE_C = vec2(${m[0]}.0, ${m[1]}.0);
  const vec2 GLINT = vec2(${f[0]}.0, ${f[1]}.0);
  const vec4 MASK = vec4(${d.join(`.0, `)}.0);
  const vec2 POSTER = vec2(${a}.0, ${o}.0);

  uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
  float rnd(vec3 v) { uvec3 u = uvec3(ivec3(floor(v)) + 100000); return float(pcg(u.x ^ pcg(u.y ^ pcg(u.z)))) / 4294967295.0; }
  float h1(float i) { return float(pcg(uint(int(i) + 1000000))) / 4294967295.0; }
  float vnoise(float x) { float i = floor(x), f = x - i, u = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), u); }
  float sq(float x) { return x * x; }

  vec3 glowCol(float d) { return texture(uLut, vec2((d - ${_}.0) / 240.0, 0.5)).rgb; }

  // 光沿着弧慢慢流：几道慢慢走的起伏叠在一起
  float flow(float x) {
    return 0.5 * sin(x * 0.0045 - uT * 0.23) + 0.3 * sin(x * 0.011 + uT * 0.31 + 1.7) + 0.2 * sin(x * 0.023 - uT * 0.47 + 4.1);
  }

  // 开场那一下：缝里的光跑到缝的下头（0.3 秒）以后，地平线从煤块底下鼓起一道浪，往左右两头跑开
  float wave(float x) {
    float t = uRing - 0.3;
    if (t < 0.0) return 0.0;
    return uRingAmp * exp(-sq((abs(x - uGlint.x) - t * 620.0) / 120.0)) * smoothstep(0.0, 0.25, t) * (1.0 - smoothstep(0.7, ${g} - 0.3, t));
  }

  // 最亮的那一段：平时沿着地平线慢慢来回漂，鼠标在上面就跟着鼠标
  float sun(float x) { return exp(-sq((x - uSun.x) / 190.0)); }

  // 在弧线下面多深（负的是弧线以上）：弧线跟着光流起伏几像素，最亮的那一段抬起来
  float depth(vec2 p) {
    vec2 c = vec2(600.0 + uPar.x * 3.0, 474.0 + RR + uPar.y * 2.0);
    float d = RR - length(p - c);
    float dx = (p.x - 600.0) / 600.0;
    d *= 1.0 - 0.1 * dx * dx;
    d += 5.0 * flow(p.x);
    d += uSun.y * sun(p.x);
    d += 16.0 * wave(p.x);
    return d;
  }

  float glyph(float g, vec2 local) { return texture(uAtlas, vec2((g + local.x) / N, local.y)).a; }

  void main() {
    vec2 dev = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 p = (dev - uOrg) / uS;

    // 1. 天和星球边缘的光
    float d = depth(p);
    float ring = wave(p.x);
    float glowAmt = smoothstep(-30.0, 10.0, d);
    vec3 col = glowCol(d) * (1.0 + 0.05 * flow(p.x + 300.0) + 0.12 * sun(p.x) * glowAmt);
    col += ring * 0.35 * glowCol(d + 30.0) * glowAmt;

    // 2. 字：一行一行往左走，越往下越快（星球近处转得快）；每格按格子中心那里的亮度挑字
    float row = floor(p.y / CELL.y);
    float rowY = (row + 0.5) * CELL.y;
    float off = uT * (0.12 + 0.0045 * max(rowY - 450.0, 0.0)) * CELL.x;
    off = floor(off * uS + 0.5) / uS;   // 按整个设备像素走，字不会一会儿清楚一会儿糊
    float cx = floor((p.x + off) / CELL.x);
    vec2 cell = vec2(cx, row);
    vec2 pc = vec2((cx + 0.5) * CELL.x - off, rowY);
    float dc = depth(pc);
    if (dc > -8.0) {
      // 亮度：弧线上是 0，那道白最亮，往里（青的地方）暗一点，跟海报上用的字一样
      float e = dc < 72.0 ? smoothstep(-4.0, 72.0, dc) : mix(1.0, 0.66, smoothstep(72.0, 150.0, dc));
      float seed = h1(row * 13.0 + 7.0);
      // 一个个「词」：中间空几格，越暗的地方空得越多
      float gap = vnoise(cx * 0.55 + seed * 40.0);
      // 每格隔一阵子换一个字，各有各的节奏
      float n = rnd(vec3(cell, floor(uStep * 0.03 * (0.5 + seed) + h1(cx * 7.0 + row * 131.0) * 10.0)));
      float rc = wave(pc.x) * smoothstep(-8.0, 20.0, dc);
      float stir = uHov * smoothstep(64.0, 16.0, length(pc - uPtr));
      float lv = e * 0.94 + (n - 0.5) * 0.2 + rc * 0.5 + stir * 0.3 + 0.1 * sun(pc.x) * smoothstep(-8.0, 30.0, dc);
      float gi = gap > mix(0.72, 0.18, e) - rc * 0.4 ? 1.0 + floor(clamp(lv, 0.0, 0.999) * (N - 1.0)) : 0.0;
      // 被光圈扫过、在鼠标底下的：乱跳
      if (max(rc, stir) > 0.25 && rnd(vec3(cell, uStep + 77.0)) < max(rc, stir) * 0.9) gi = 1.0 + floor(rnd(vec3(cell, uStep + 191.0)) * (N - 1.0));
      if (gi > 0.0) {
        float a = glyph(gi, vec2((p.x + off) / CELL.x - cx, p.y / CELL.y - row));
        // 字的颜色是它底下的光再亮一截（海报上量的），扫过的、鼠标底下的再亮一点
        vec3 gc = clamp(glowCol(dc) * 1.25 + vec3(0.05, 0.07, 0.08) + rc * 0.35 + stir * vec3(0.2, 0.24, 0.28), 0.0, 1.0);
        col = mix(col, gc, a * 0.92);
      }
    }

    // 3. 左上的 SOOTY 和那句话：直接取海报
    if (p.x < 770.0 && p.y < 430.0) col = max(col, texture(uPoster, p / POSTER).rgb);

    // 4. 煤块：浮着、轻轻转、跟着鼠标挪
    vec2 q = p - STONE_C - uStoneOff;
    q = mat2(cos(uStoneAng), sin(uStoneAng), -sin(uStoneAng), cos(uStoneAng)) * q + STONE_C;
    vec2 muv = (q - MASK.xy) / MASK.zw;
    float onStone = 0.0;
    if (all(greaterThan(muv, vec2(0.0))) && all(lessThan(muv, vec2(1.0)))) {
      vec3 m = texture(uStone, muv).rgb;   // r 轮廓，g 缝里的光，b 在缝上走到哪
      if (m.r > 0.0) {
        vec3 sc = texture(uPoster, q / POSTER).rgb;
        // 底下的光照上来：轮廓朝下的边亮一道细蓝，底下一点点泛蓝；鼠标、光圈过来时更亮
        vec2 e2 = 3.0 / MASK.zw;
        vec2 gr = vec2(texture(uStone, muv + vec2(e2.x, 0.0)).r - texture(uStone, muv - vec2(e2.x, 0.0)).r,
                       texture(uStone, muv + vec2(0.0, e2.y)).r - texture(uStone, muv - vec2(0.0, e2.y)).r);
        float edge = clamp(length(gr), 0.0, 1.0);
        float down = smoothstep(0.2, 0.9, dot(-gr / max(length(gr), 1e-4), vec2(0.0, 1.0)));
        float lift = 0.5 + (0.6 + 0.9 * uHov) * sun(q.x) + ring * 2.5;
        sc += vec3(0.16, 0.28, 0.85) * edge * down * 0.22 * lift;
        sc += vec3(0.015, 0.03, 0.09) * smoothstep(380.0, 475.0, q.y) * lift;
        // 缝里的光：亮点那一段最亮，慢慢一明一暗；开场那一下先顺着缝往两头跑；鼠标凑近了整条缝慢慢亮起来
        float breathe = 0.5 + 0.5 * sin(uT * 1.1);
        float near = exp(-sq((m.b - ${p}) / 0.07));
        float run = uRing >= 0.0 ? uRingAmp * exp(-sq((abs(m.b - ${p}) - uRing * 0.55) / 0.05)) * (1.0 - smoothstep(0.8, 1.6, uRing)) : 0.0;
        float warm = uWarm * exp(-sq((m.b - ${p}) / 0.3));
        sc += vec3(0.35, 0.6, 1.0) * m.g * (0.06 + near * 0.4 * breathe + run * 1.2 + warm * 0.5);
        float r = length(q - GLINT);
        float flash = uRing >= 0.0 ? uRingAmp * exp(-uRing * 3.0) : 0.0;
        sc += vec3(0.55, 0.75, 1.0) * (exp(-sq(r / 5.0)) * 0.3 + exp(-sq(r / 16.0)) * 0.08) * (0.5 + 0.7 * breathe + run * 2.0 + flash * 3.0 + uWarm * 1.2);
        col = mix(col, sc, m.r);
        onStone = m.r;
      }
    }

    // 5. 颗粒：主要在光晕上，跟海报一样有一层细细的噪点
    float g = rnd(vec3(dev, floor(uT * 24.0))) - 0.5;
    col += g * (0.06 * dot(col, vec3(0.299, 0.587, 0.114)) + 0.012) * glowAmt * (1.0 - onStone);
    outColor = vec4(col, 1.0);
  }
`;function x(){let e=new Uint8Array(1024);for(let t=0;t<256;t++){let n=_+t/255*240,r=v.findIndex(e=>e[0]>n),i;if(r<=0)i=(r===0?v[0]:v[v.length-1]).slice(1);else{let e=v[r-1],t=v[r],a=(n-e[0])/(t[0]-e[0]);i=[1,2,3].map(n=>e[n]+(t[n]-e[n])*a)}e.set([...i,255],t*4)}return e}function S(e,t,n){let r=document.createElement(`canvas`);r.width=e*9,r.height=t;let i=r.getContext(`2d`);i.fillStyle=`#fff`,i.font=`${n}px "DM Mono", ui-monospace, monospace`,i.textAlign=`center`,i.textBaseline=`middle`;for(let n=1;n<9;n++)i.fillText(u[n],(n+.5)*e,t*.52);return r}var C=e=>new Promise(t=>setTimeout(t,e));async function w(u,d,p){let m=document.createElement(`canvas`);m.className=`sooty-gl`,m.setAttribute(`aria-hidden`,`true`);let _;try{_=n(m)}catch{return null}let v=()=>_.getExtension(`WEBGL_lose_context`)?.loseContext();if(e(_)&&!window.__sootySoftwareOk)return v(),null;let w=new Image;w.src=i;try{await Promise.all([d.complete&&d.naturalWidth?null:d.decode(),w.decode(),Promise.race([document.fonts.load(`400 18px "DM Mono"`),C(1500)])])}catch{return v(),null}let T;try{T=t(_,y,b)}catch{return v(),null}let E=r(_),D=(e,t=0,n=0,r=_.createTexture())=>(_.bindTexture(_.TEXTURE_2D,r),e instanceof Uint8Array?_.texImage2D(_.TEXTURE_2D,0,_.RGBA,t,n,0,_.RGBA,_.UNSIGNED_BYTE,e):_.texImage2D(_.TEXTURE_2D,0,_.RGBA,_.RGBA,_.UNSIGNED_BYTE,e),_.texParameteri(_.TEXTURE_2D,_.TEXTURE_MIN_FILTER,_.LINEAR),_.texParameteri(_.TEXTURE_2D,_.TEXTURE_MAG_FILTER,_.LINEAR),_.texParameteri(_.TEXTURE_2D,_.TEXTURE_WRAP_S,_.CLAMP_TO_EDGE),_.texParameteri(_.TEXTURE_2D,_.TEXTURE_WRAP_T,_.CLAMP_TO_EDGE),r),O=D(d),ee=D(w),te=D(x(),256,1),k=_.createTexture(),A=()=>{U||(D(d,0,0,O),K(!0))};d.addEventListener(`load`,A);let j=0,M=0,N=1,P=1,F=[0,0],I=``;function L(){if(j=u.clientWidth,M=u.clientHeight,!j||!M)return;N=Math.min(2,devicePixelRatio||1),m.width=Math.round(j*N),m.height=Math.round(M*N),P=Math.max(j/a,M/o),F=[(j-a*P)*.5,(M-o*P)*s];let e=P*N,t=Math.max(3,Math.round(c*e)),n=Math.max(5,Math.round(l*e));`${t}x${n}`!==I&&(I=`${t}x${n}`,D(S(t,n,l*e),0,0,k)),K(!0)}let R={hov:0,hovTo:0,ptr:[f[0],520],ptrTo:[f[0],520],par:[0,0],parTo:[0,0],ringAt:-1e9,ringAmp:1,seen:!1,moved:-1e9},ne=performance.now()-2e4*Math.random(),z=0,B=-1e9,V=performance.now(),H=!1,U=!1,W=!1;function re(){z=0;let e=performance.now();if(U||!j)return;let t=Math.min(.1,(e-V)/1e3);V=e;let n=e=>1-Math.exp(-t*e);R.hov+=(R.hovTo-R.hov)*n(R.hovTo>R.hov?6:2.5);for(let e=0;e<2;e++)R.ptr[e]+=(R.ptrTo[e]-R.ptr[e])*n(9),R.par[e]+=(R.parTo[e]-R.par[e])*n(3.5);let r=(e-R.ringAt)/1e3;if(!(r<g||Math.abs(R.hovTo-R.hov)>.003||e-R.moved<600||Math.hypot(R.par[0]-R.parTo[0],R.par[1]-R.parTo[1])>.003)&&e-B<1e3/h-2){G();return}B=e;let i=(e-ne)/1e3%1e5,a=i*.8,o=600+520*Math.sin(i*.09)+120*Math.sin(i*.23+1),s=[o+(R.ptr[0]-o)*R.hov,10+16*R.hov],c=[R.par[0]*6,Math.sin(a)*3.2+R.par[1]*4],l=1+.025*R.hov,u=P*N*l,d=[j/2,M/2],p=[(d[0]-(d[0]-F[0])*l)*N,(d[1]-(d[1]-F[1])*l)*N];_.viewport(0,0,m.width,m.height),T.use({uPoster:[O,0],uStone:[ee,1],uAtlas:[k,2],uLut:[te,3],uRes:[m.width,m.height],uOrg:p,uS:u,uT:i,uStep:Math.floor(i*12),uHov:R.hov,uPtr:R.ptr,uPar:R.par,uSun:s,uRing:r<g?r:-1,uRingAmp:R.ringAmp,uWarm:R.hov*Math.min(1,Math.max(0,(260-Math.hypot(R.ptr[0]-f[0]-c[0],R.ptr[1]-f[1]-c[1]))/200)),uStoneOff:c,uStoneAng:Math.sin(a*.71+1.3)*.009,uGlint:[f[0]+c[0],f[1]+c[1]]}),E.draw(),W||(W=!0,requestAnimationFrame(()=>m.classList.add(`on`))),G()}function G(){!z&&!U&&H&&!document.hidden&&(z=requestAnimationFrame(re))}function K(e=!1){e&&(B=-1e9),G()}let ie=e=>{let t=u.getBoundingClientRect(),n=e.clientX-t.left,r=e.clientY-t.top;return{p:[(n-F[0])/P,(r-F[1])/P],f:[n/t.width-.5,r/t.height-.5]}},q=e=>{if(e.pointerType===`touch`)return;let{p:t,f:n}=ie(e);if(R.hovTo===0){R.ptr=[...t];let e=performance.now();R.seen&&e-R.ringAt>7600&&(R.ringAt=e,R.ringAmp=.55)}R.ptrTo=t,R.parTo=[n[0]*2,n[1]*2],R.hovTo=1,R.moved=performance.now(),K()},J=()=>{R.hovTo=0,R.parTo=[0,0],K()},Y=()=>{p.matches(`:focus-visible`)&&(R.ptr=[f[0],520],R.ptrTo=[f[0],520],R.hovTo=1,K())};p.addEventListener(`pointermove`,q),p.addEventListener(`pointerleave`,J),p.addEventListener(`focus`,Y),p.addEventListener(`blur`,J);let X=new IntersectionObserver(([e])=>{H=e.isIntersecting,H&&!R.seen&&(R.seen=!0,R.ringAt=performance.now()+700,R.ringAmp=1),H&&(V=performance.now(),K(!0))}),Z=new ResizeObserver(()=>L()),Q=()=>{document.hidden||(V=performance.now(),K(!0))};document.addEventListener(`visibilitychange`,Q);function $(){U||(U=!0,cancelAnimationFrame(z),X.disconnect(),Z.disconnect(),p.removeEventListener(`pointermove`,q),p.removeEventListener(`pointerleave`,J),p.removeEventListener(`focus`,Y),p.removeEventListener(`blur`,J),d.removeEventListener(`load`,A),document.removeEventListener(`visibilitychange`,Q),m.remove(),v())}return m.addEventListener(`webglcontextlost`,$),m.__sooty=R,d.after(m),L(),X.observe(u),Z.observe(u),{destroy:$}}function T(e,t,n){let r=matchMedia(`(prefers-reduced-motion: reduce)`),i=null,a=!1,o=()=>{i||a||r.matches||(a=!0,w(e,t,n).then(e=>{a=!1,e&&r.matches?e.destroy():i=e},()=>{a=!1}))};r.addEventListener(`change`,()=>{r.matches?(i?.destroy(),i=null):o()}),o()}var E=document.querySelector(`[data-hero]`),D=E?.querySelector(`[data-sooty]`),O=D?.querySelector(`img`);D&&O&&T(D,O,D);for(let e of E?.querySelectorAll(`[data-copy]`)??[]){let t=0;e.addEventListener(`click`,async()=>{try{await navigator.clipboard.writeText(e.dataset.copy)}catch{location.href=`mailto:${e.dataset.copy}`;return}e.dataset.done=``,clearTimeout(t),t=window.setTimeout(()=>delete e.dataset.done,2e3)})}