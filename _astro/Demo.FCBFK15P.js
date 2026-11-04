import{t as e}from"./react.CadLv9_P.js";import{t}from"./jsx-runtime.C2DLLpjJ.js";import{a as n,i as r,n as i,o as a,r as o,t as s}from"./gl.B6Qi3-Xr.js";var c=e(),l=Math.PI*2;function u(e){let t=e>>>0||1;return()=>(t=Math.imul(t,1664525)+1013904223>>>0)/4294967296}var d={dark:{water:[[.1,.26,.5],[.13,.42,.76],[.27,.65,.92],[.55,.84,1]],foam:[[.62,.86,1],[1,1,1]]},light:{water:[[.6,.7,.8],[.33,.52,.75],[.17,.37,.65],[.09,.23,.5]],foam:[[.1,.22,.42],[.02,.06,.17]]}};function ee(e){let t=u(20261104),n=e/1e3,r=e=>Math.max(1,Math.round(Math.sqrt(9.81*e)*n/l)),i=e=>l*r(e)/n,a=[],o=[];for(let e=0;e<10;e++){let n=9*.8**e,o=l/n,s=Math.PI/2+(e%3==1?.55:(t()-.5)*.5),c=n*(e<3?.05:.03),u=.9/(o*c*10);a.push([Math.cos(s),Math.sin(s),o,c,u,i(o),n,r(o)])}for(let e=0;e<8;e++){let n=1.1*.78**e,r=l/n,a=Math.PI/2+(t()-.5)*2.2;o.push([Math.cos(a),Math.sin(a),r,n*.035,i(r)])}return{big:a,small:o}}var f=[`-`,`~`,`=`,`.`,`:`,`*`,`o`,`@`],p=3,m=64;function te(e){let t=e.getContext(`2d`);e.width=m*f.length,e.height=m,t.fillStyle=t.strokeStyle=`#fff`,t.lineJoin=`round`,t.textAlign=`left`,t.textBaseline=`alphabetic`,t.font=`500 50px "DM Mono", ui-monospace, monospace`,f.forEach((e,n)=>{let r=t.measureText(e),i=r.actualBoundingBoxLeft,a=r.actualBoundingBoxRight,o=r.actualBoundingBoxAscent,s=r.actualBoundingBoxDescent,c=n<p?Math.max(1,Math.min(1.8,.84*m/(i+a))):1;t.save(),t.translate(n*m+m/2,m/2),t.scale(c,1);let l=-(a-i)/2,u=(o-s)/2;t.lineWidth=n<p?4.5:3,t.fillText(e,l,u),t.strokeText(e,l,u),t.restore()})}var ne=`
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,re=`
  precision highp float;
  in vec3 position;                 // 网格在海平面上的位置（y = 0）
  uniform mat4 projectionMatrix, viewMatrix;
  uniform vec3 cameraPosition;
  uniform vec4 uW[10];              // 方向 x、方向 z、波数 k、振幅 A
  uniform vec4 uWq[10];             // 尖的程度 Q、角频率 ω、波长
  uniform vec4 uRip[8];             // 涟漪：x、z、过了几秒、有没有
  uniform float uT, uAmax;
  out vec3 vPos, vN;
  out vec2 vP0;
  out float vJ, vRip;
  void main() {
    vec2 p = position.xz;
    float dist = length(p - cameraPosition.xz);
    vec3 P = vec3(p.x, 0.0, p.y);
    vec3 n = vec3(0.0, 1.0, 0.0);
    float jxx = 1.0, jzz = 1.0, jxz = 0.0;
    for (int i = 0; i < 10; i++) {
      vec2 D = uW[i].xy; float k = uW[i].z, Q = uWq[i].x, w = uWq[i].y;
      // 远处网格稀，短的波在那里会闪，按「网格间距和波长的比」淡掉
      float A = uW[i].w * smoothstep(0.0, 1.0, uWq[i].z / (0.06 * dist + 0.001) - 0.6);
      float th = k * dot(D, p) - w * uT, s = sin(th), c = cos(th), WA = k * A;
      P.x += Q * A * D.x * c; P.z += Q * A * D.y * c; P.y += A * s;
      n.x -= D.x * WA * c; n.z -= D.y * WA * c; n.y -= Q * WA * s;
      jxx -= Q * WA * D.x * D.x * s; jzz -= Q * WA * D.y * D.y * s; jxz -= Q * WA * D.x * D.y * s;
    }
    // 涟漪：一圈往外扩的环，边走边弱
    float rip = 0.0;
    for (int i = 0; i < 8; i++) {
      if (uRip[i].w < 0.5) continue;
      vec2 d = p - uRip[i].xy; float r = length(d) + 1e-4, age = uRip[i].z;
      float front = 0.6 + 3.2 * age, x = r - front;
      float env = exp(-x * x / 1.2) * exp(-age / 1.3) * smoothstep(0.0, 0.15, age);
      float h = 0.5 * env * cos(3.6 * x), dh = -0.5 * env * 3.6 * sin(3.6 * x);
      P.y += h; n.xz -= dh * d / r; rip += env * (0.5 + 0.5 * cos(3.6 * x));   // 只算环的浪顶，环和环中间留着暗的
    }
    vJ = jxx * jzz - jxz * jxz; vRip = rip;
    vPos = P; vN = n; vP0 = p;
    gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
  }
`,ie=`
  precision highp float;
  in vec3 vPos, vN;
  in vec2 vP0;
  in float vJ, vRip;
  out vec4 o;
  uniform mat4 projectionMatrix, viewMatrix;
  uniform vec3 cameraPosition, uSunDir;
  uniform vec2 uAspect;             // 画布的宽、高（只看比例）
  uniform vec4 uW[10];              // 大波：方向 x、方向 z、波数 k、振幅 A
  uniform vec4 uWq[10];             // 大波：尖的程度 Q、角频率 ω、波长、一圈走几个周期
  uniform vec4 uS[8];               // 小波：方向 x、方向 z、k、A
  uniform float uSw[8];             // 小波的角频率
  uniform float uT, uAmax, uPer;   // uPer：一圈多少秒
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec3 V = cameraPosition - vPos; float dist = length(V); V /= dist;
    vec3 N = normalize(vN);
    // 细碎的小波只改法线；一个像素盖住的海面随距离变大，比它短的小波淡掉，不然排成一道道闪的条纹
    vec2 g = vec2(0.0);
    float foot = 0.0009 * dist * dist + 0.01;
    for (int i = 0; i < 8; i++) {
      float th = uS[i].z * dot(uS[i].xy, vPos.xz) - uSw[i] * uT;
      float keep = smoothstep(1.0, 3.0, 6.2831853 / uS[i].z / foot);
      g += uS[i].xy * uS[i].z * uS[i].w * cos(th) * keep;
    }
    N = normalize(N - vec3(g.x, 0.0, g.y) * 0.8);
    float diff = max(dot(N, uSunDir), 0.0);
    float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    float spec = pow(max(dot(reflect(-V, N), uSunDir), 0.0), 40.0);
    float h = clamp(vPos.y / uAmax, -1.0, 1.0) * 0.5 + 0.5;
    float L = 0.04 + 0.6 * h + 0.2 * diff + 0.25 * F + 0.6 * spec;
    L = mix(L, 0.5, 1.0 - exp(-dist / 140.0));
    // 浪头的走向：海面上跟坡度垂直的方向（等高线），投到画面上。按坡度的平方算轻重：浪顶、浪谷是平的，方向说不准，几乎不算
    vec2 gh = -vN.xz;                                  // 高度对没推动前的位置的梯度：浪尖被挤尖的地方也不会被放大
    vec3 tw = vec3(-gh.y, 0.0, gh.x) / (length(gh) + 1e-6);
    vec4 p0 = projectionMatrix * viewMatrix * vec4(vPos, 1.0), p1 = projectionMatrix * viewMatrix * vec4(vPos + tw * 0.2, 1.0);
    vec2 sd = (p1.xy / p1.w - p0.xy / p0.w) * uAspect;   // 画面上的方向，左上角是原点
    sd.y = -sd.y;
    float m2 = dot(sd, sd);
    vec2 t2 = m2 > 1e-12 ? vec2(sd.x * sd.x - sd.y * sd.y, 2.0 * sd.x * sd.y) / m2 * min(dot(gh, gh) * 5.0, 1.0) : vec2(0.0);
    // 浪花：d 是这一点落在浪尖后面多远（相位，0 是浪尖），白沫从浪尖起、往后渐淡。
    // 哪几段浪尖起白沫看噪声，噪声跟着这道浪尖走（沿浪尖的位置、第几道浪尖），
    // 第几道浪尖按「一圈走几个周期」取余，一圈以后正好回到原样
    float foam = 0.0;
    for (int i = 0; i < 3; i++) {
      vec2 D = uW[i].xy; float k = uW[i].z;
      float th = k * dot(D, vP0) - uWq[i].y * uT;
      float d = mod(1.5707963 - th, 6.2831853);
      float id = mod(floor((th + d - 1.5707963) / 6.2831853 + 0.5), uWq[i].w);
      float u = dot(vec2(-D.y, D.x), vP0);
      float clump = smoothstep(0.32, 0.64, vnoise(vec2(u * 0.32, id * 7.31 + float(i) * 3.7)));
      // 每一簇自己起落：一圈里碎三次，各簇错开，浪花冒出来、散掉，不是一直挂在浪尖上
      clump *= smoothstep(0.05, 0.6, 0.5 + 0.5 * sin(6.2831853 * (3.0 * uT / uPer + vnoise(vec2(u * 0.15, id * 3.1 + float(i))))));
      float grain = vnoise(vec2(u, d / k) * 1.4 + id * 5.13 + float(i) * 1.9);
      float tail = exp(-d / 1.1);
      foam += clump * smoothstep(0.12, 0.7, tail * (0.4 + 1.0 * grain)) * (1.0 - 0.2 * float(i));
    }
    foam += (1.0 - smoothstep(0.08, 0.35, vJ)) * 0.4 * smoothstep(0.35, 0.7, vnoise(vP0 * 0.6));   // 浪尖挤到一起的地方，也是零零碎碎的
    foam += 1.4 * vRip;
    foam *= exp(-dist / 120.0);
    o = vec4(L, t2 * 0.5 + 0.5, clamp(foam, 0.0, 1.0));
  }
`,ae=`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uAtlas;
  uniform vec2 uRes;                // 画布，设备像素
  uniform float uCell, uLod, uN;    // 一格多少设备像素、取平均用的 mipmap 层、图集里有几个字
  uniform vec2 uRange;              // 水的亮度从 x 到 y 铺满由淡到浓的水的字
  uniform vec3 uC0, uC1, uC2, uC3;  // 水的色带
  uniform vec3 uF0, uF1;            // 浪花由淡到浓的颜色
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) * uCell / uRes;
    vec4 s = textureLod(uScene, vec2(c0.x, 1.0 - c0.y), uLod);
    float r1 = hash(cell), r2 = hash(cell + 17.31);
    float gi, a = 0.0;
    vec3 col;
    // 浪花：这一格的白沫够浓就画浪花的字（. : * o @），不转；边上淡的地方零星撒几个点当飞沫
    float fz = s.a + (r1 - 0.5) * 0.16;
    if (fz > 0.16 || r2 < (s.a - 0.04) * 3.0) {
      float fl = clamp((fz - 0.16) / 0.6, 0.0, 0.999);
      gi = ${p}.0 + floor(fl * (uN - ${p}.0));
      col = mix(uF0, uF1, fl);
    } else {
      // 水：亮度挑 - ~ =，字顺着浪头放；这一格的方向乱（二倍角平均下来很短）就横着放
      vec2 t2 = textureLod(uScene, vec2(c0.x, 1.0 - c0.y), uLod + 1.5).gb * 2.0 - 1.0;   // 方向取周围几格一起的，不跟着一格里的小起伏乱转
      a = 0.5 * atan(t2.y, t2.x) * smoothstep(0.05, 0.25, length(t2));
      float lv = clamp((s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.08, 0.0, 0.999);
      gi = floor(lv * ${p}.0);
      col = ramp(lv);
    }
    vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
    vec2 q = vec2(cos(a) * loc.x + sin(a) * loc.y, -sin(a) * loc.x + cos(a) * loc.y);
    float ink = 0.0;
    if (abs(q.x) < 0.5 && abs(q.y) < 0.5) ink = texture(uAtlas, vec2((gi + q.x + 0.5) / uN, 0.5 - q.y)).r;
    o = vec4(col * ink, ink);   // 预乘过的透明度：字以外是透明的
  }
`,h=(e,t)=>e.map((e,n)=>e-t[n]),g=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2],_=e=>{let t=Math.hypot(...e);return e.map(e=>e/t)},v=(e,t)=>[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]];function y(e,t,n,r){let i=1/Math.tan(e*Math.PI/360),a=1/(n-r);return new Float32Array([i/t,0,0,0,0,i,0,0,0,0,(r+n)*a,-1,0,0,2*r*n*a,0])}function oe(e,t){let n=_(h(e,t)),r=_(v([0,1,0],n)),i=v(n,r);return{x:r,y:i,z:n,view:new Float32Array([r[0],i[0],n[0],0,r[1],i[1],n[1],0,r[2],i[2],n[2],0,-g(r,e),-g(i,e),-g(n,e),1])}}function b(e,{period:t=12e3,cell:c=8,fps:l=30}={}){let u=i(e),p=n(u),m=matchMedia(`(prefers-reduced-motion: reduce)`),h=m.matches||p,g=o(u),v=r(u,re,ie),b=r(u,ne,ae),x=[0,11,6],S=oe(x,[0,0,6-11/Math.tan(40*Math.PI/180)]),C=y(50,2,.1,1e3),{big:w,small:T}=ee(t),E=e=>new Float32Array(e.flat()),se={uAmax:w.slice(0,3).reduce((e,t)=>e+t[3],0),uPer:t/1e3,uW:E(w.map(e=>e.slice(0,4))),uWq:E(w.map(e=>e.slice(4,8))),uS:E(T.map(e=>e.slice(0,4))),uSw:new Float32Array(T.map(e=>e[4])),uSunDir:_([.25,.75,-1]),viewMatrix:S.view,cameraPosition:x},D=new Float32Array(362103),O=new Uint32Array(72e4);for(let e=0;e<=400;e++){let t=6-1*260**(e/400)+3,n=Math.abs(6-t)*1.3+10;for(let r=0;r<=300;r++){let i=(e*301+r)*3;D[i]=(r/300*2-1)*n,D[i+1]=0,D[i+2]=t}}for(let e=0,t=0;e<400;e++)for(let n=0;n<300;n++,t+=6){let r=e*301+n,i=r+1,a=r+300+1,o=a+1;O[t]=r,O[t+1]=a,O[t+2]=i,O[t+3]=i,O[t+4]=a,O[t+5]=o}let k=u.createVertexArray(),A=u.createBuffer(),j=u.createBuffer();u.bindVertexArray(k),u.bindBuffer(u.ARRAY_BUFFER,A),u.bufferData(u.ARRAY_BUFFER,D,u.STATIC_DRAW),u.enableVertexAttribArray(0),u.vertexAttribPointer(0,3,u.FLOAT,!1,0,0),u.bindBuffer(u.ELEMENT_ARRAY_BUFFER,j),u.bufferData(u.ELEMENT_ARRAY_BUFFER,O,u.STATIC_DRAW),u.bindVertexArray(null);let ce=new Float32Array(32),M=Array(8).fill(-1e9),N=Array.from({length:8},()=>[0,0]),P=null,F=document.createElement(`canvas`);te(F);let I=s(u,F),L=0,R=0,z=1,B=0,V=!0,H=-1e9,U=!1,W=d.light;function G(){W=d[getComputedStyle(e).colorScheme.includes(`dark`)?`dark`:`light`]}function K(){L=e.clientWidth,R=e.clientHeight,L&&R&&(z=Math.min(2,window.devicePixelRatio||1),e.width=Math.round(L*z),e.height=Math.round(R*z),P?.dispose(),P=a(u,e.width,e.height,{mipmaps:!0,depth:!0}),C=y(50,L/R,.1,1e3),G(),$(!0))}let q=0,J=-1e9,Y=-1e9,X=-1e9;function Z(e,t){let n=Math.tan(50*Math.PI/360),r=(e/L*2-1)*n*(L/R),i=(1-t/R*2)*n,a=[0,1,2].map(e=>S.x[e]*r+S.y[e]*i-S.z[e]);if(a[1]>=0)return;let o=-x[1]/a[1];N[q]=[x[0]+a[0]*o,x[2]+a[2]*o],M[q]=performance.now(),q=(q+1)%M.length,$(!0)}let le=t=>{let n=e.getBoundingClientRect();return[t.clientX-n.left,t.clientY-n.top]},ue=e=>{if(h||!L)return;let[t,n]=le(e),r=performance.now(),i=Math.hypot(t-J,n-Y);i<6||i<40&&r-X<120||(J=t,Y=n,X=r,Z(t,n))},de=e=>{if(h||!L)return;let[t,n]=le(e);J=t,Y=n,X=performance.now(),Z(t,n)};e.addEventListener(`pointermove`,ue),e.addEventListener(`pointerdown`,de);function fe(n){if(B=0,U||!L||!P)return;let r=!1;for(let e=0;e<M.length;e++){let t=(n-M[e])/1e3,i=t>=0&&t<5;ce.set([N[e][0],N[e][1],t,+!!i],e*4),i&&(r=!0)}if(!h&&!r&&n-H<1e3/l-2){Q();return}H=n;let i=h?.05:(n%t+t)%t/t;P.bind(),u.enable(u.DEPTH_TEST),u.depthFunc(u.LEQUAL),u.clearColor(0,0,0,1),u.clear(u.COLOR_BUFFER_BIT|u.DEPTH_BUFFER_BIT),v.use({...se,projectionMatrix:C,uT:i*t/1e3,uRip:ce,uAspect:[L,R]}),u.bindVertexArray(k),u.drawElements(u.TRIANGLES,O.length,u.UNSIGNED_INT,0),u.bindVertexArray(null),u.disable(u.DEPTH_TEST),P.mip(),u.bindFramebuffer(u.FRAMEBUFFER,null),u.viewport(0,0,e.width,e.height),u.clearColor(0,0,0,0),u.clear(u.COLOR_BUFFER_BIT);let a=W;b.use({uScene:[P.tex,0],uAtlas:[I.tex,1],uRes:[e.width,e.height],uCell:c*z,uLod:Math.log2(c*z)-.5,uN:f.length,uRange:[.25,.8],uC0:a.water[0],uC1:a.water[1],uC2:a.water[2],uC3:a.water[3],uF0:a.foam[0],uF1:a.foam[1]}),g.draw(),(!h||r)&&Q()}function Q(){!B&&!U&&V&&!document.hidden&&(B=requestAnimationFrame(fe))}function $(e=!1){e&&(H=-1e9),Q()}let pe=new IntersectionObserver(([e])=>{V=e.isIntersecting,V&&$(!0)});pe.observe(e);let me=new ResizeObserver(()=>K());me.observe(e);let he=()=>{document.hidden||$(!0)};document.addEventListener(`visibilitychange`,he);let ge=()=>{h=m.matches||p,$(!0)};return m.addEventListener(`change`,ge),document.fonts?.load(`400 54px "DM Mono"`).then(()=>document.fonts.load(`500 54px "DM Mono"`)).then(()=>{U||(te(F),I.update(),$(!0))},()=>{}),K(),{splash(){!h&&L&&Z(L*(.3+Math.random()*.4),R*(.55+Math.random()*.3))},refresh(){G(),$(!0)},destroy(){U=!0,cancelAnimationFrame(B),B=0,pe.disconnect(),me.disconnect(),e.removeEventListener(`pointermove`,ue),e.removeEventListener(`pointerdown`,de),document.removeEventListener(`visibilitychange`,he),m.removeEventListener(`change`,ge),P?.dispose(),I.dispose(),g.dispose(),u.deleteVertexArray(k),u.deleteBuffer(A),u.deleteBuffer(j),v.dispose(),b.dispose()}}}var x=t();function S(){let e=(0,c.useRef)(null),t=(0,c.useRef)(null),[n,r]=(0,c.useState)(!1);return(0,c.useEffect)(()=>{let n;try{n=b(e.current,{period:12e3})}catch{r(!0);return}t.current=n;let i=()=>n.refresh(),a=new MutationObserver(i);a.observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]});let o=matchMedia(`(prefers-color-scheme: dark)`);return o.addEventListener(`change`,i),()=>{a.disconnect(),o.removeEventListener(`change`,i),n.destroy(),t.current=null}},[]),(0,x.jsxs)(`div`,{className:`lab-root ascii-waves`,children:[(0,x.jsx)(`canvas`,{className:`sea`,ref:e,tabIndex:0,role:`img`,onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),t.current?.splash())},"aria-label":`Ocean waves seen from above, drawn entirely in ASCII characters that turn along each crest. Press Enter to send a ripple.`}),n&&(0,x.jsx)(`p`,{className:`fallback`,children:`This experiment needs WebGL 2`}),(0,x.jsxs)(`p`,{className:`lab-hint`,children:[(0,x.jsx)(`span`,{className:`for-mouse`,children:`Move across the water to ripple it`}),(0,x.jsx)(`span`,{className:`for-touch`,children:`Tap or swipe across the water`})]})]})}export{S as default};