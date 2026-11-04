import{t as e}from"./react.CadLv9_P.js";import{t}from"./jsx-runtime.C2DLLpjJ.js";import{a as n,i as r,n as i,o as a,r as o,t as s}from"./gl.B6Qi3-Xr.js";var c=e(),l=Math.PI*2,u=48,d=4,f=`
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;function p(e){let t=e>>>0||1;return()=>(t=Math.imul(t,1664525)+1013904223>>>0)/4294967296}var ee={dark:{water:[[.1,.26,.5],[.13,.42,.76],[.27,.65,.92],[.55,.84,1]],foam:[[.62,.86,1],[1,1,1]]},light:{water:[[.6,.7,.8],[.33,.52,.75],[.17,.37,.65],[.09,.23,.5]],foam:[[.1,.22,.42],[.02,.06,.17]]}};function te(e){let t=p(20261104),n=e/1e3,r=e=>Math.max(1,Math.round(Math.sqrt(9.81*e)*n/l)),i=e=>l*r(e)/n,a=[],o=[];for(let e=0;e<10;e++){let n=9*.8**e,o=l/n,s=Math.PI/2+(e%3==1?.55:(t()-.5)*.5),c=n*(e<3?.05:.03),u=.9/(o*c*10);a.push([Math.cos(s),Math.sin(s),o,c,u,i(o),n,r(o)])}for(let e=0;e<8;e++){let n=1.1*.78**e,r=l/n,a=Math.PI/2+(t()-.5)*2.2;o.push([Math.cos(a),Math.sin(a),r,n*.035,i(r)])}return{big:a,small:o}}var m=[`-`,`~`,`=`,`.`,`:`,`*`,`o`,`@`],h=3,g=64;function ne(e){let t=e.getContext(`2d`);e.width=g*m.length,e.height=g,t.fillStyle=t.strokeStyle=`#fff`,t.lineJoin=`round`,t.textAlign=`left`,t.textBaseline=`alphabetic`,t.font=`500 50px "DM Mono", ui-monospace, monospace`,m.forEach((e,n)=>{let r=t.measureText(e),i=r.actualBoundingBoxLeft,a=r.actualBoundingBoxRight,o=r.actualBoundingBoxAscent,s=r.actualBoundingBoxDescent,c=n<h?Math.max(1,Math.min(1.8,.84*g/(i+a))):1;t.save(),t.translate(n*g+g/2,g/2),t.scale(c,1);let l=-(a-i)/2,u=(o-s)/2;t.lineWidth=n<h?4.5:3,t.fillText(e,l,u),t.strokeText(e,l,u),t.restore()})}var re=`
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,ie=`
  precision highp float;
  in vec3 position;                 // 网格在海平面上的位置（y = 0）
  uniform mat4 projectionMatrix, viewMatrix;
  uniform vec3 cameraPosition;
  uniform vec4 uW[10];              // 方向 x、方向 z、波数 k、振幅 A
  uniform vec4 uWq[10];             // 尖的程度 Q、角频率 ω、波长
  uniform vec4 uTrail[${u}];    // 尾迹：手划过海面的一串点，由旧到新。x、z、过了几秒、种类 × 100 + 那时划得多快（米/秒）
  uniform float uTrailN;            // 有几个点；种类：0 接着上一个点，1 一笔的开头，2 点了一下（溅起水花）
  uniform float uT, uAmax;
  out vec3 vPos, vN;
  out vec2 vP0;
  out float vJ;
  out vec4 vWake;                   // 离最近那一笔多远（米）、那一处过了几秒、浪尖上的白沫、是不是点出来的水花
  ${f}
  // 一笔的尾迹：离这一笔最近的点在 d 米外，那一点是 a 秒前划过的，浪从那里往外推，跑在最前面的一道浪到了 c·a 米。
  // 划得快，c 跟着大，最前面那道浪连起来就是一个 V（船尾的尾迹），夹角跟速度无关；点一下（没划）就是一圈。
  // x 是这一点在最前面那道浪后面多远，浪头陡、往回渐弱；浪头的位置按噪声抖一点，不是一道规整的线
  void wake(vec2 p, float d, float a, vec2 nd, vec2 ga, float c, float kind, float v, inout float H, inout vec2 G, inout float crest) {
    if (a > ${d}.0) return;
    float x = d - c * a + 0.5 * (vnoise(p * 0.45 + kind * 7.3) - 0.5) * min(a, 1.0) * c;
    float life = exp(-a / 1.3) * smoothstep(0.0, 0.08, a) * (1.0 - smoothstep(${d}.0 - 1.0, ${d}.0, a));
    float lead = exp(-max(x, 0.0) * max(x, 0.0) / 0.08), back = exp(min(x, 0.0) / 1.6);
    float A = (kind > 1.5 ? 0.5 : mix(0.28, 0.5, smoothstep(2.0, 14.0, v))) * life * lead * back;
    float k = 3.4, cs = cos(k * x), sn = sin(k * x);
    H += A * cs;
    G += -A * k * sn * (nd - c * ga);           // x 对位置的梯度：离这一笔的方向，减去「沿着这一笔越往后越老」
    // 最前面那道浪的浪尖上挂一线白沫（V 的两条边），一秒多淡掉；
    // 划得慢的地方几乎不挂（慢慢挪的船也没有白浪），点一下的水花挂一圈，到片元着色器里再按噪声打碎
    crest += exp(-a / 1.2) * smoothstep(0.0, 0.1, a) * exp(-x * x / 0.3) * (kind > 1.5 ? 1.2 : smoothstep(2.0, 10.0, v));
  }
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
    // 尾迹：一笔一笔地算，每笔只看离这一点最近的那一段（这一笔上的 V 才是连着的一道），几笔叠起来
    float H = 0.0, crest = 0.0, near = 1e4, nearA = 99.0, nearK = 0.0;
    vec2 G = vec2(0.0);
    float bd = 1e4, ba = 0.0, bc = 0.0, bv = 0.0, bk = 0.0;
    vec2 bn = vec2(0.0), bg = vec2(0.0);
    float kind = 0.0;
    for (int i = 0; i < ${u}; i++) {
      if (float(i) >= uTrailN) break;
      vec4 B = uTrail[i];
      float kb = floor(B.w / 100.0), sb = B.w - kb * 100.0;
      if (i > 0 && kb > 0.5) {               // 新的一笔：先把上一笔算完
        wake(p, bd, ba, bn, bg, bc, kind, bv, H, G, crest);
        if (bd < near) { near = bd; nearA = ba; nearK = kind; }
        bd = 1e4;
      }
      if (i == 0 || kb > 0.5) kind = max(kb, 1.0);
      vec4 Aa = (i == 0 || kb > 0.5) ? B : uTrail[max(i - 1, 0)];
      float sa = Aa.w - floor(Aa.w / 100.0) * 100.0;
      vec2 ab = B.xy - Aa.xy; float l2 = dot(ab, ab);
      float t = l2 > 1e-6 ? clamp(dot(p - Aa.xy, ab) / l2, 0.0, 1.0) : 0.0;
      vec2 q = Aa.xy + ab * t, dq = p - q; float dd = length(dq);
      if (dd < bd) {
        bd = dd; ba = mix(Aa.z, B.z, t); bn = dq / (dd + 1e-4);
        bg = (t > 0.0 && t < 1.0) ? (B.z - Aa.z) * ab / l2 : vec2(0.0);
        bv = mix(sa, sb, t); bc = kind > 1.5 ? 2.4 : clamp(0.36 * bv, 1.8, 7.0);
      }
    }
    if (bd < 1e3) {
      wake(p, bd, ba, bn, bg, bc, kind, bv, H, G, crest);
      if (bd < near) { near = bd; nearA = ba; nearK = kind; }
    }
    P.y += H; n.xz -= G;
    vJ = jxx * jzz - jxz * jxz;
    vWake = vec4(near, nearA, crest, nearK);
    vPos = P; vN = n; vP0 = p;
    gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
  }
`,ae=`
  precision highp float;
  in vec3 vPos, vN;
  in vec2 vP0;
  in float vJ;
  in vec4 vWake;
  out vec4 o;
  uniform mat4 projectionMatrix, viewMatrix;
  uniform vec3 cameraPosition, uSunDir;
  uniform vec2 uAspect;             // 画布的宽、高（只看比例）
  uniform vec4 uW[10];              // 大波：方向 x、方向 z、波数 k、振幅 A
  uniform vec4 uWq[10];             // 大波：尖的程度 Q、角频率 ω、波长、一圈走几个周期
  uniform vec4 uS[8];               // 小波：方向 x、方向 z、k、A
  uniform float uSw[8];             // 小波的角频率
  uniform float uT, uAmax, uPer;   // uPer：一圈多少秒
  ${f}
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
    // 尾迹上的白沫：划过的那一道翻着白，越往后越宽、越碎、越淡；点一下是溅开的一摊。浪尖上那道 V 也挂一点，碎成一簇一簇的
    if (vWake.y < ${d}.0) {
      float a = vWake.y, tap = step(1.5, vWake.w);
      float w = mix(0.5 + 0.7 * a, 0.7 + 1.4 * a, tap);
      float d = max(vWake.x + (vnoise(vP0 * 0.9 + 5.1) - 0.5) * mix(0.4, 1.6, tap) * min(a * 2.0, 1.0), 0.0);   // 边上按噪声进进出出，水花不是一个圆
      float churn = (1.0 - smoothstep(0.3 * w, w, d)) * exp(-a / mix(1.4, 0.9, tap)) * smoothstep(0.0, 0.05, a);
      float n = 0.6 * vnoise(vP0 * 1.6 + vec2(a * 0.7, -a * 0.5)) + 0.4 * vnoise(vP0 * 4.3 - a);
      float lo = mix(0.3, 0.44, tap) + 0.25 * min(a, 1.5);   // 越老越碎：噪声要越高的地方才留着白沫
      foam += 1.5 * churn * smoothstep(lo, lo + 0.2, n);
      foam += 1.1 * vWake.z * (mix(0.3, 0.0, tap) + mix(0.7, 1.0, tap) * smoothstep(0.3, 0.6, vnoise(vP0 * 2.2 + 3.7)));
    }
    foam *= exp(-dist / 120.0);
    o = vec4(L, t2 * 0.5 + 0.5, clamp(foam, 0.0, 1.0));
  }
`,oe=`
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
      gi = ${h}.0 + floor(fl * (uN - ${h}.0));
      col = mix(uF0, uF1, fl);
    } else {
      // 水：亮度挑 - ~ =，字顺着浪头放；这一格的方向乱（二倍角平均下来很短）就横着放
      vec2 t2 = textureLod(uScene, vec2(c0.x, 1.0 - c0.y), uLod + 1.5).gb * 2.0 - 1.0;   // 方向取周围几格一起的，不跟着一格里的小起伏乱转
      a = dot(t2, t2) > 1e-12 ? 0.5 * atan(t2.y, t2.x) * smoothstep(0.05, 0.25, length(t2)) : 0.0;   // atan(0, 0) 没定义，有的显卡算出 NaN
      float lv = clamp((s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.08, 0.0, 0.999);
      gi = floor(lv * ${h}.0);
      col = ramp(lv);
    }
    vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
    vec2 q = vec2(cos(a) * loc.x + sin(a) * loc.y, -sin(a) * loc.x + cos(a) * loc.y);
    float ink = 0.0;
    if (abs(q.x) < 0.5 && abs(q.y) < 0.5) ink = texture(uAtlas, vec2((gi + q.x + 0.5) / uN, 0.5 - q.y)).r;
    o = vec4(col * ink, ink);   // 预乘过的透明度：字以外是透明的
  }
`,_=(e,t)=>e.map((e,n)=>e-t[n]),v=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2],y=e=>{let t=Math.hypot(...e);return e.map(e=>e/t)},b=(e,t)=>[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]];function se(e,t,n,r){let i=1/Math.tan(e*Math.PI/360),a=1/(n-r);return new Float32Array([i/t,0,0,0,0,i,0,0,0,0,(r+n)*a,-1,0,0,2*r*n*a,0])}function ce(e,t){let n=y(_(e,t)),r=y(b([0,1,0],n)),i=b(n,r);return{x:r,y:i,z:n,view:new Float32Array([r[0],i[0],n[0],0,r[1],i[1],n[1],0,r[2],i[2],n[2],0,-v(r,e),-v(i,e),-v(n,e),1])}}function x(e,{period:t=12e3,cell:c=8,fps:l=30}={}){let f=i(e),p=n(f),h=matchMedia(`(prefers-reduced-motion: reduce)`),g=h.matches||p,_=o(f),v=r(f,ie,ae),b=r(f,re,oe),x=[0,11,6],S=ce(x,[0,0,6-11/Math.tan(40*Math.PI/180)]),C=se(50,2,.1,1e3),{big:w,small:T}=te(t),E=e=>new Float32Array(e.flat()),le={uAmax:w.slice(0,3).reduce((e,t)=>e+t[3],0),uPer:t/1e3,uW:E(w.map(e=>e.slice(0,4))),uWq:E(w.map(e=>e.slice(4,8))),uS:E(T.map(e=>e.slice(0,4))),uSw:new Float32Array(T.map(e=>e[4])),uSunDir:y([.25,.75,-1]),viewMatrix:S.view,cameraPosition:x},D=new Float32Array(362103),O=new Uint32Array(72e4);for(let e=0;e<=400;e++){let t=6-1*260**(e/400)+3,n=Math.abs(6-t)*1.3+10;for(let r=0;r<=300;r++){let i=(e*301+r)*3;D[i]=(r/300*2-1)*n,D[i+1]=0,D[i+2]=t}}for(let e=0,t=0;e<400;e++)for(let n=0;n<300;n++,t+=6){let r=e*301+n,i=r+1,a=r+300+1,o=a+1;O[t]=r,O[t+1]=a,O[t+2]=i,O[t+3]=i,O[t+4]=a,O[t+5]=o}let k=f.createVertexArray(),A=f.createBuffer(),j=f.createBuffer();f.bindVertexArray(k),f.bindBuffer(f.ARRAY_BUFFER,A),f.bufferData(f.ARRAY_BUFFER,D,f.STATIC_DRAW),f.enableVertexAttribArray(0),f.vertexAttribPointer(0,3,f.FLOAT,!1,0,0),f.bindBuffer(f.ELEMENT_ARRAY_BUFFER,j),f.bufferData(f.ELEMENT_ARRAY_BUFFER,O,f.STATIC_DRAW),f.bindVertexArray(null);let M=[],ue=new Float32Array(192),N=null,P=document.createElement(`canvas`);ne(P);let F=s(f,P),I=0,L=0,R=1,z=0,B=!0,V=-1e9,H=!1,U=ee.light;function W(){U=ee[getComputedStyle(e).colorScheme.includes(`dark`)?`dark`:`light`]}function de(){I=e.clientWidth,L=e.clientHeight,I&&L&&(R=Math.min(2,window.devicePixelRatio||1),e.width=Math.round(I*R),e.height=Math.round(L*R),N?.dispose(),N=a(f,e.width,e.height,{mipmaps:!0,depth:!0}),C=se(50,I/L,.1,1e3),W(),$(!0))}let fe=(e,t)=>{let n=Math.tan(50*Math.PI/360),r=(e/I*2-1)*n*(I/L),i=(1-t/L*2)*n,a=[0,1,2].map(e=>S.x[e]*r+S.y[e]*i-S.z[e]);if(a[1]>=0)return null;let o=-x[1]/a[1];return[x[0]+a[0]*o,x[2]+a[2]*o]},G=null,K=0,q=0,J=-1e9;function Y(e){M.push(e),M.length>u&&M.shift()}function X(e,t,n,r){let i=fe(e,t);if(!i)G=null;else if(r)Y({x:i[0],z:i[1],t:n,kind:2,v:0}),G=null,$(!0);else{if(!G||n-G.t>250)G={x:i[0],z:i[1],t:n,kind:1,v:0},Y(G),K=e,q=t,J=n;else{let r=Math.hypot(i[0]-G.x,i[1]-G.z)/Math.max((n-G.t)/1e3,.008),a=M.length>1&&M[M.length-1]===G?M[M.length-2]:null;Math.hypot(e-K,t-q)>=28||n-J>=90||!a?(G={x:i[0],z:i[1],t:n,kind:0,v:.6*Math.min(r,60)+.4*(a?G.v:0)},Y(G),K=e,q=t,J=n):Object.assign(G,{x:i[0],z:i[1],t:n,v:.6*Math.min(r,60)+.4*G.v})}$(!0)}}let pe=t=>{let n=e.getBoundingClientRect();return[t.clientX-n.left,t.clientY-n.top]},me=e=>{if(g||!I)return;let[t,n]=pe(e);X(t,n,performance.now(),!1)},Z=e=>{if(g||!I)return;let[t,n]=pe(e);X(t,n,performance.now(),!0)},he=()=>{G=null};e.addEventListener(`pointermove`,me),e.addEventListener(`pointerdown`,Z),e.addEventListener(`pointerleave`,he);function ge(n){if(z=0,H||!I||!N)return;for(;M.length&&(n-M[0].t)/1e3>=d;)M.shift();M.length||(G=null),M.forEach((e,t)=>ue.set([e.x,e.z,Math.max(0,(n-e.t)/1e3),(t===0?Math.max(e.kind,1):e.kind)*100+Math.min(e.v,99)],t*4));let r=M.length>0;if(!g&&!r&&n-V<1e3/l-2){Q();return}V=n;let i=g?.05:(n%t+t)%t/t;N.bind(),f.enable(f.DEPTH_TEST),f.depthFunc(f.LEQUAL),f.clearColor(0,0,0,1),f.clear(f.COLOR_BUFFER_BIT|f.DEPTH_BUFFER_BIT),v.use({...le,projectionMatrix:C,uT:i*t/1e3,uTrail:ue,uTrailN:M.length,uAspect:[I,L]}),f.bindVertexArray(k),f.drawElements(f.TRIANGLES,O.length,f.UNSIGNED_INT,0),f.bindVertexArray(null),f.disable(f.DEPTH_TEST),N.mip(),f.bindFramebuffer(f.FRAMEBUFFER,null),f.viewport(0,0,e.width,e.height),f.clearColor(0,0,0,0),f.clear(f.COLOR_BUFFER_BIT);let a=U;b.use({uScene:[N.tex,0],uAtlas:[F.tex,1],uRes:[e.width,e.height],uCell:c*R,uLod:Math.log2(c*R)-.5,uN:m.length,uRange:[.25,.8],uC0:a.water[0],uC1:a.water[1],uC2:a.water[2],uC3:a.water[3],uF0:a.foam[0],uF1:a.foam[1]}),_.draw(),(!g||r)&&Q()}function Q(){!z&&!H&&B&&!document.hidden&&(z=requestAnimationFrame(ge))}function $(e=!1){e&&(V=-1e9),Q()}let _e=new IntersectionObserver(([e])=>{B=e.isIntersecting,B&&$(!0)});_e.observe(e);let ve=new ResizeObserver(()=>de());ve.observe(e);let ye=()=>{document.hidden||$(!0)};document.addEventListener(`visibilitychange`,ye);let be=()=>{g=h.matches||p,$(!0)};return h.addEventListener(`change`,be),document.fonts?.load(`400 54px "DM Mono"`).then(()=>document.fonts.load(`500 54px "DM Mono"`)).then(()=>{H||(ne(P),F.update(),$(!0))},()=>{}),de(),{splash(){!g&&I&&X(I*(.3+Math.random()*.4),L*(.55+Math.random()*.3),performance.now(),!0)},refresh(){W(),$(!0)},destroy(){H=!0,cancelAnimationFrame(z),z=0,_e.disconnect(),ve.disconnect(),e.removeEventListener(`pointermove`,me),e.removeEventListener(`pointerdown`,Z),e.removeEventListener(`pointerleave`,he),document.removeEventListener(`visibilitychange`,ye),h.removeEventListener(`change`,be),N?.dispose(),F.dispose(),_.dispose(),f.deleteVertexArray(k),f.deleteBuffer(A),f.deleteBuffer(j),v.dispose(),b.dispose()}}}var S=t();function C(){let e=(0,c.useRef)(null),t=(0,c.useRef)(null),[n,r]=(0,c.useState)(!1);return(0,c.useEffect)(()=>{let n;try{n=x(e.current,{period:12e3})}catch{r(!0);return}t.current=n;let i=()=>n.refresh(),a=new MutationObserver(i);a.observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]});let o=matchMedia(`(prefers-color-scheme: dark)`);return o.addEventListener(`change`,i),()=>{a.disconnect(),o.removeEventListener(`change`,i),n.destroy(),t.current=null}},[]),(0,S.jsxs)(`div`,{className:`lab-root ascii-waves`,children:[(0,S.jsx)(`canvas`,{className:`sea`,ref:e,tabIndex:0,role:`img`,onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),t.current?.splash())},"aria-label":`Ocean waves seen from above, drawn entirely in ASCII characters that turn along each crest. Press Enter to splash it.`}),n&&(0,S.jsx)(`p`,{className:`fallback`,children:`This experiment needs WebGL 2`}),(0,S.jsxs)(`p`,{className:`lab-hint`,children:[(0,S.jsx)(`span`,{className:`for-mouse`,children:`Sweep across the water to leave a wake`}),(0,S.jsx)(`span`,{className:`for-touch`,children:`Tap or swipe across the water`})]})]})}export{C as default};