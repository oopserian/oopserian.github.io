import{t as e}from"./react.CadLv9_P.js";import{t}from"./jsx-runtime.C2DLLpjJ.js";import{a as n,i as r,n as i,o as a,r as o,t as s}from"./gl.B6Qi3-Xr.js";var c=e(),l=Math.PI*2,u=64,d=4,f=6,p=4;function m(e){let t=0,n=1/0;for(let r=1;r<e.length-1;r++){if(e[r].start||e[r+1].start)continue;let i=e[r-1],a=e[r],o=e[r+1],s=Math.abs((a.x-i.x)*(o.y-i.y)-(a.y-i.y)*(o.x-i.x));s<n&&(n=s,t=r)}e.splice(t,1)}var ee={dark:{stone:[[.19,.2,.23],[.36,.38,.43],[.6,.62,.67],[.88,.89,.92]],seam:[.44,.46,.52],glow:[[.33,.6,.96],[.86,.95,1]],range:[.06,.62]},light:{stone:[[.55,.57,.62],[.33,.35,.4],[.15,.16,.2],[.03,.03,.05]],seam:[.02,.02,.04],glow:[[.3,.42,.96],[.1,.17,.82]],range:[.06,.75]}},h=[`-`,`\\`,`|`,`/`,`.`,`:`,`+`,`*`,`#`,`%`,`@`],g=4,_=64;function v(e){let t=e.getContext(`2d`);e.width=_*h.length,e.height=_,t.clearRect(0,0,e.width,e.height),t.fillStyle=t.strokeStyle=`#fff`,t.lineJoin=`round`,t.textAlign=`left`,t.textBaseline=`alphabetic`,t.font=`500 50px "DM Mono", ui-monospace, monospace`,h.forEach((e,n)=>{let r=t.measureText(e),i=r.actualBoundingBoxLeft,a=r.actualBoundingBoxRight,o=r.actualBoundingBoxAscent,s=r.actualBoundingBoxDescent,c=Math.max(1,i+a),l=Math.max(1,o+s),u=n===0||n===1||n===3?.98*_/c:1,d=n>=1&&n<=3?.98*_/l:1;t.save(),t.translate(n*_+_/2,_/2),t.scale(u,d);let f=-(a-i)/2,p=(o-s)/2;t.lineWidth=n<g?5/Math.sqrt(u*d):4,t.fillText(e,f,p),t.strokeText(e,f,p),t.restore()})}var y=`
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,te=`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec2 uView;               // 画面盖住的煤壁有多大，以「一块煤」为单位
  uniform float uU, uCellW;         // 一圈里走到哪（0 到 1）；一格字在煤壁上多宽
  uniform vec3 uKey;                // 主光的方向
  uniform vec3 uPtr;                // 鼠标那盏灯：x、y、亮度
  uniform vec4 uTrail[${u}];    // 划过的点，由旧到新：x、y、过了几秒、是不是一笔的开头
  uniform float uTrailN;
  uniform vec4 uTap[${f}];       // 裂开的地方：x、y、过了几秒、随机数
  uniform float uTapN;
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  vec2 h22(vec2 p) { return vec2(h21(p), h21(p + 17.17)); }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // 值和坡度一起算：x 是高度，yz 是坡度。平滑地取小（面和面之间是一道圆一点的棱，跟原图一样不是刀刃）
  vec3 smin3(vec3 a, vec3 b, float k) {
    float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
    return vec3(mix(b.x, a.x, h) - k * h * (1.0 - h), mix(b.yz, a.yz, h));
  }
  vec2 site(vec2 c) { return 0.14 + 0.72 * h22(c); }   // 每块煤的中心在自己那一格里的位置
  // 离这一点最近的那块煤：q 是这一点减块中心，id 是块的编号；ed 是离块边多远，en 是朝那条边的方向（Inigo Quilez 的两遍法）
  void voro(vec2 x, out vec2 q, out vec2 id, out float ed, out vec2 en) {
    vec2 n = floor(x), f = fract(x), mg = vec2(0.0), mr = vec2(0.0);
    float md = 8.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j)), r = g + site(n + g) - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
    ed = 8.0; en = vec2(1.0, 0.0);
    for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j)), r = g + site(n + g) - f;
      vec2 dr = r - mr;
      if (dot(dr, dr) > 1e-5) {
        vec2 nn = normalize(dr);
        float d = dot(0.5 * (mr + r), nn);
        if (d < ed) { ed = d; en = nn; }
      }
    }
    q = -mr; id = n + mg;
  }
  // 一块煤的高度和坡度：一个矮穹顶，被五个往外斜、又往里凹的面削过（凿出来的那种凹面），面和面之间是棱
  vec3 chunk(vec2 q, vec2 id) {
    vec3 h = vec3(1.0 + 0.2 * h21(id + 0.37) - 0.5 * dot(q, q), -q);
    float a0 = h21(id + 3.1) * 6.2831853;
    for (int k = 0; k < 5; k++) {
      float fk = float(k);
      float a = a0 + fk * 1.2566371 + (h21(id + fk * 4.7) - 0.5) * 0.9;
      vec2 d = vec2(cos(a), sin(a));
      float sl = 0.75 + 0.7 * h21(id * 2.3 + fk);       // 这一面有多斜
      vec2 c = q - d * (0.1 + 0.2 * h21(id * 5.1 + fk));   // 凹下去的那个碗的中心
      float bowl = 1.5 + 1.1 * h21(id * 7.9 + fk);
      h = smin3(h, vec3(0.96 - sl * dot(q, d) + bowl * dot(c, c), -sl * d + 2.0 * bowl * c), 0.045);
    }
    return h;
  }
  // 到一段线段的距离，t 是落在线段上哪儿（0 到 1）
  float seg(vec2 p, vec2 a, vec2 b, out float t) {
    vec2 ab = b - a; float l2 = dot(ab, ab);
    t = l2 > 1e-8 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
    return length(p - a - ab * t);
  }
  void main() {
    vec2 x = (vUv - 0.5) * uView;
    vec2 q, id, en; float ed;
    voro(x, q, id, ed, en);
    // 高度：块本身，边沿斜着落进缝里（缝底在 -0.35）
    vec3 h = chunk(q, id);
    h = smin3(h, vec3(-0.35 + 7.0 * ed, -7.0 * en), 0.08);

    // 裂纹：每处裂开的地方往外裂 3 到 5 道，方向随机（不是均匀分开的星星），0.2 秒里裂到头；
    // 每道走三段、每段拐一下，越往外越细，第二段起头分一个小岔；裂纹再按噪声抖一抖，是参差的
    float crack = 0.0, cglow = 0.0, flash = 0.0;
    vec2 cdir = vec2(1.0, 0.0);
    for (int i = 0; i < ${f}; i++) {
      if (float(i) >= uTapN) break;
      vec4 P = uTap[i];
      vec2 r = x - P.xy;
      if (P.z > ${p}.0 || dot(r, r) > 3.0) continue;
      vec2 xr = r + 0.035 * (vec2(vnoise(x * 9.0 + P.w * 31.0), vnoise(x * 9.0 - P.w * 17.0 + 3.3)) - 0.5);
      float grow = smoothstep(0.0, 0.2, P.z), heal = 1.0 - smoothstep(${p}.0 - 1.6, ${p}.0, P.z);
      int K = 3 + int(h21(vec2(P.w, 1.7)) * 2.99);
      float cm = 0.0;
      for (int k = 0; k < 6; k++) {
        if (k >= K) break;
        float fk = float(k);
        float an = P.w * 6.2831853 + (fk + 0.75 * (h21(vec2(P.w * 9.1, fk)) - 0.5)) * 6.2831853 / float(K);
        float Lk = 0.5 + 0.6 * h21(vec2(fk, P.w * 3.1));
        vec2 a = vec2(0.0);
        for (int j = 0; j < 3; j++) {
          float fj = float(j), pj = clamp(grow * 3.0 - fj, 0.0, 1.0);   // 一段一段往外裂
          if (pj <= 0.0) break;
          float aj = an + (h21(vec2(fk * 3.0 + fj, P.w * 5.3)) - 0.5) * 1.2;
          vec2 dj = vec2(cos(aj), sin(aj)), b = a + dj * Lk / 3.0 * (0.7 + 0.6 * h21(vec2(fj, fk + P.w))) * pj;
          float t, dd = seg(xr, a, b, t);
          float w = uCellW * mix(0.7, 0.25, (fj + t) / 3.0);
          float m = 1.0 - smoothstep(w, w + uCellW * 0.45, dd);
          if (m > cm) { cm = m; cdir = dj; }
          if (j == 1) {
            float sb = h21(vec2(fk + 5.0, P.w)) > 0.5 ? 0.85 : -0.85;
            vec2 bd = vec2(cos(aj + sb), sin(aj + sb));
            float db = seg(xr, a, a + bd * Lk * 0.3 * pj, t);
            float mb = 1.0 - smoothstep(uCellW * 0.2, uCellW * 0.6, db);
            if (mb > cm) { cm = mb; cdir = bd; }
          }
          a = b;
        }
      }
      cm *= heal;
      crack = max(crack, cm);
      cglow += cm * (0.6 + 1.2 * exp(-P.z / 1.2));
      flash += exp(-dot(r, r) / (0.015 + 0.2 * P.z)) * exp(-P.z / 0.35);
    }
    // 划过：顺着划的路裂开一道参差的裂纹（按噪声抖一抖，不是一条顺滑的线），里面亮着蓝光，四秒里从老的那头合上；
    // 附近的缝也亮起来，光顺着缝往外渗，越老渗得越远、越暗
    float seep = 0.0;
    vec2 xj = x + 0.07 * (vec2(vnoise(x * 5.0 + 1.7), vnoise(x * 5.0 + 9.2)) - 0.5);
    for (int i = 0; i < ${u}; i++) {
      if (float(i) >= uTrailN) break;
      vec4 B = uTrail[i], A = (i == 0 || B.w > 0.5) ? B : uTrail[max(i - 1, 0)];
      float t, d = seg(x, A.xy, B.xy, t), a = mix(A.z, B.z, t);
      float fade = 1.0 - smoothstep(${d}.0 - 1.5, ${d}.0, a);
      float reach = 0.2 + 0.55 * pow(a, 0.7);
      seep = max(seep, 1.2 * exp(-d * d / (reach * reach)) * exp(-a / 1.6) * smoothstep(0.0, 0.05, a) * fade);
      vec2 ab = B.xy - A.xy;
      if (dot(ab, ab) > 1e-6) {
        float tj, dj = seg(xj, A.xy, B.xy, tj), aj = mix(A.z, B.z, tj);
        float w = uCellW * 0.45;
        float m = (1.0 - smoothstep(w, w + uCellW * 0.5, dj)) * (1.0 - smoothstep(${d}.0 - 1.5, ${d}.0, aj));
        if (m > crack) { crack = m; cdir = normalize(ab); }
        cglow = max(cglow, m * (0.55 + 0.8 * exp(-aj / 1.0)));
      }
    }
    h.x -= 0.4 * crack;

    // 光照：主光、鼠标那盏灯，漫射 + 高光；缝里、裂纹里低的地方暗（遮蔽）
    vec3 n = normalize(vec3(-0.6 * h.yz, 1.0)), V = vec3(0.0, 0.0, 1.0);
    float ao = mix(0.2, 1.0, smoothstep(-0.35, 0.8, h.x));
    float dif = max(dot(n, uKey), 0.0), spec = pow(max(dot(n, normalize(uKey + V)), 0.0), 60.0);
    vec3 Lp = vec3(uPtr.xy - x, 0.9 - 0.45 * h.x);
    float dp = length(Lp); Lp /= dp;
    float att = uPtr.z / (1.0 + dp * dp * 2.5);
    float pdif = max(dot(n, Lp), 0.0) * att, pspec = pow(max(dot(n, normalize(Lp + V)), 0.0), 36.0) * att;
    float lum = 0.04 + (0.52 * dif + 0.85 * pdif) * ao + (0.5 * spec + 0.6 * pspec) * ao;

    // 缝里的蓝光。平时：几处亮的沿着缝挪，是在噪声里绕一个圈取的，一圈以后回到原处
    vec2 lo = 1.3 * vec2(cos(6.2831853 * uU), sin(6.2831853 * uU));
    float L = 0.85 * smoothstep(0.74, 0.9, vnoise(x * 0.55 + lo + 3.0)) * (0.75 + 0.25 * sin(6.2831853 * (3.0 * uU + h21(id))));
    L = max(L, seep);
    float seam = 1.0 - smoothstep(0.0, 0.045, ed), lip = exp(-ed / 0.12);   // 缝里最亮，边沿上也漏一点
    float glow = L * (seam + 0.45 * lip) + cglow + 0.9 * flash;

    // 线：缝（块和块之间）、裂纹，记下走向
    float line = 1.0 - smoothstep(uCellW * 0.3, uCellW * 0.6, ed);
    vec2 dir = vec2(-en.y, en.x);
    if (crack > line) { line = crack; dir = cdir; }
    vec2 t2 = vec2(dir.x * dir.x - dir.y * dir.y, 2.0 * dir.x * dir.y) * line;
    o = vec4(clamp(lum, 0.0, 1.0), clamp(glow, 0.0, 1.0), t2 * 0.5 + 0.5);
  }
`,ne=`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uWall, uAtlas;
  uniform vec2 uRes, uCells;        // 画布（设备像素）；底稿有几列几行格子（比画布多出不到一格）
  uniform float uCell, uLod, uN;    // 一格多少设备像素、取平均用的 mipmap 层（底稿一格两个像素，第 1 层正好一格一个）、图集里有几个字
  uniform vec2 uRange;              // 煤面的亮度从 x 到 y 铺满由淡到浓的字
  uniform float uDark;              // 深色主题：越亮越浓；浅色主题反过来
  uniform vec3 uC0, uC1, uC2, uC3;  // 煤面的色带
  uniform vec3 uSeam, uG0, uG1;     // 缝、光由弱到强
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) / uCells;
    vec4 s = textureLod(uWall, vec2(c0.x, 1.0 - c0.y), uLod);
    float r1 = hash(cell);
    vec2 t2 = s.ba * 2.0 - 1.0;
    float m = length(t2), glow = max(s.g + (r1 - 0.5) * 0.04, 0.0);   // 抖一点，但不能抖成负的：最暗的格子会挑到前一个字（/）
    float gi; vec3 col;
    float nf = uN - ${g}.0;
    if (m > 0.3) {
      // 缝、裂纹：按走向挑 - \\ | /（煤壁上 y 朝上：往右上走的是 /）
      float phi = 0.5 * atan(t2.y, t2.x);
      gi = abs(phi) < 0.3927 ? 0.0 : abs(phi) > 1.1781 ? 2.0 : phi > 0.0 ? 3.0 : 1.0;
      col = glow > 0.1 ? mix(uG0, uG1, clamp((glow - 0.1) / 0.6, 0.0, 1.0)) : uSeam;
    } else if (glow > 0.4) {
      // 光：缝的交叉处、裂开时炸开的那一下，按亮度挑字，蓝的
      float gl = clamp((glow - 0.4) / 0.5, 0.0, 0.999);
      gi = ${g}.0 + 1.0 + floor(gl * (nf - 1.0));
      col = mix(uG0, uG1, gl);
    } else {
      // 煤面：按亮度挑字。深色主题越亮越浓，浅色主题越暗越浓
      // 缝里的光漏到边上：深色主题字跟着亮一点，两种主题都染上蓝
      float lv = clamp((s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.08, 0.0, 0.999);
      if (uDark < 0.5) lv = pow(0.999 - lv, 0.65);   // 浅色主题反过来，再往浓里推一点：煤是黑的，亮面也不该是一片空白
      else lv = clamp(lv + 0.6 * glow, 0.0, 0.999);
      gi = ${g}.0 + floor(lv * nf);
      col = mix(ramp(lv), mix(uG0, uG1, clamp(glow * 1.5, 0.0, 1.0)), smoothstep(0.04, 0.3, glow));
    }
    vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
    float ink = 0.0;
    // 图集按一格的大小取 mipmap 层：自动挑层的话，格子交界处相邻两个像素取的字隔得老远，会挑到最糊的一层，每行之间多出一道灰线
    if (abs(loc.x) < 0.5 && abs(loc.y) < 0.5) ink = textureLod(uAtlas, vec2((gi + loc.x + 0.5) / uN, 0.5 - loc.y), log2(${_}.0 / uCell)).r;
    o = vec4(col * ink, ink);   // 预乘过的透明度：字以外是透明的
  }
`;function b(e,{period:t=12e3,cell:c=8,fps:g=30}={}){let _=i(e),b=n(_),x=matchMedia(`(prefers-reduced-motion: reduce)`),S=x.matches||b,C=o(_),re=r(_,y,te),ie=r(_,y,ne),w=[],ae=new Float32Array(256),T=[],E=new Float32Array(24),D=null,O=1,k=1,A=160,j=[1,1],M=document.createElement(`canvas`);v(M);let N=s(_,M),P=0,F=0,I=1,L=0,R=!0,z=-1e9,B=-1,V=!1,H=!1,U={tx:0,ty:0,x:0,y:0,on:0,k:0};function W(){H=getComputedStyle(e).colorScheme.includes(`dark`)}function G(){P=e.clientWidth,F=e.clientHeight,P&&F&&(I=Math.min(2,window.devicePixelRatio||1),e.width=Math.round(P*I),e.height=Math.round(F*I),O=Math.ceil(P/c),k=Math.ceil(F/c),A=Math.min(190,Math.max(110,Math.min(P,F)*.32)),j=[O*c/A,k*c/A],D?.dispose(),D=a(_,O*2,k*2,{mipmaps:!0}),W(),$(!0))}let K=(e,t)=>[(e/(O*c)-.5)*j[0],(.5-t/(k*c))*j[1]],q=null,J=0,Y=0,X=-1e9;function Z(e){w.push(e),w.length>u&&m(w)}function oe(e,t,n){let[r,i]=K(e,t);!q||n-q.t>250?(q={x:r,y:i,t:n,start:!0},Z(q),J=e,Y=t,X=n):Math.hypot(e-J,t-Y)>=28||n-X>=90||w[w.length-1]!==q||q.start?(q={x:r,y:i,t:n,start:!1},Z(q),J=e,Y=t,X=n):Object.assign(q,{x:r,y:i,t:n}),$(!0)}function se(e,t,n){let[r,i]=K(e,t);T.push({x:r,y:i,t:n,seed:Math.random()}),T.length>f&&T.shift(),Z({x:r,y:i,t:n,start:!0}),q=null,$(!0)}let ce=t=>{let n=e.getBoundingClientRect();return[t.clientX-n.left,t.clientY-n.top]},le=e=>{if(S||!P)return;let[t,n]=ce(e),[r,i]=K(t,n);U.on||(U.x=r,U.y=i),U.tx=r,U.ty=i,U.on=1,oe(t,n,performance.now())},ue=e=>{if(S||!P)return;let[t,n]=ce(e);se(t,n,performance.now())},de=()=>{q=null,U.on=0,$(!0)};e.addEventListener(`pointermove`,le),e.addEventListener(`pointerdown`,ue),e.addEventListener(`pointerleave`,de);function fe(n){if(L=0,V||!P||!D)return;let r=B<0?0:Math.min(.1,(n-B)/1e3);for(B=n;w.length&&(n-w[0].t)/1e3>=d;)w.shift();for(w.length||(q=null),w.forEach((e,t)=>ae.set([e.x,e.y,Math.max(0,(n-e.t)/1e3),t===0||e.start?1:0],t*4));T.length&&(n-T[0].t)/1e3>=p;)T.shift();T.forEach((e,t)=>E.set([e.x,e.y,Math.max(0,(n-e.t)/1e3),e.seed],t*4));let i=1-Math.exp(-r*10);U.x+=(U.tx-U.x)*i,U.y+=(U.ty-U.y)*i,U.k+=((S?0:U.on)-U.k)*(1-Math.exp(-r*5));let a=Math.abs(U.tx-U.x)+Math.abs(U.ty-U.y)>.002||Math.abs(U.on-U.k)>.01,o=w.length>0||T.length>0||a;if(!S&&!o&&n-z<1e3/g-2){Q();return}z=n;let s=S?.2:(n%t+t)%t/t,u=Math.PI/2+1*Math.sin(l*s),f=.62,m=[Math.cos(f)*Math.cos(u),Math.cos(f)*Math.sin(u),Math.sin(f)];D.bind(),re.use({uView:j,uU:s,uCellW:c/A,uKey:m,uPtr:[U.x,U.y,U.k],uTrail:ae,uTrailN:w.length,uTap:E,uTapN:T.length}),C.draw(),D.mip(),_.bindFramebuffer(_.FRAMEBUFFER,null),_.viewport(0,0,e.width,e.height),_.clearColor(0,0,0,0),_.clear(_.COLOR_BUFFER_BIT);let v=ee[H?`dark`:`light`];ie.use({uWall:[D.tex,0],uAtlas:[N.tex,1],uRes:[e.width,e.height],uCells:[O,k],uCell:c*I,uLod:1,uN:h.length,uRange:v.range,uDark:+!!H,uC0:v.stone[0],uC1:v.stone[1],uC2:v.stone[2],uC3:v.stone[3],uSeam:v.seam,uG0:v.glow[0],uG1:v.glow[1]}),C.draw(),(!S||o)&&Q()}function Q(){!L&&!V&&R&&!document.hidden&&(L=requestAnimationFrame(fe))}function $(e=!1){e&&(z=-1e9),Q()}let pe=new IntersectionObserver(([e])=>{R=e.isIntersecting,R&&$(!0)});pe.observe(e);let me=new ResizeObserver(()=>G());me.observe(e);let he=()=>{B=-1,document.hidden||$(!0)};document.addEventListener(`visibilitychange`,he);let ge=()=>{S=x.matches||b,$(!0)};return x.addEventListener(`change`,ge),document.fonts?.load(`500 50px "DM Mono"`).then(()=>{V||(v(M),N.update(),$(!0))},()=>{}),G(),{crack(){!S&&P&&se(P*(.25+Math.random()*.5),F*(.25+Math.random()*.5),performance.now())},refresh(){W(),$(!0)},destroy(){V=!0,cancelAnimationFrame(L),L=0,pe.disconnect(),me.disconnect(),e.removeEventListener(`pointermove`,le),e.removeEventListener(`pointerdown`,ue),e.removeEventListener(`pointerleave`,de),document.removeEventListener(`visibilitychange`,he),x.removeEventListener(`change`,ge),D?.dispose(),N.dispose(),C.dispose(),re.dispose(),ie.dispose()}}}var x=t();function S(){let e=(0,c.useRef)(null),t=(0,c.useRef)(null),[n,r]=(0,c.useState)(!1);return(0,c.useEffect)(()=>{let n;try{n=b(e.current,{period:12e3})}catch{r(!0);return}t.current=n;let i=()=>n.refresh(),a=new MutationObserver(i);a.observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]});let o=matchMedia(`(prefers-color-scheme: dark)`);return o.addEventListener(`change`,i),()=>{a.disconnect(),o.removeEventListener(`change`,i),n.destroy(),t.current=null}},[]),(0,x.jsxs)(`div`,{className:`lab-root ascii-coal`,children:[(0,x.jsx)(`canvas`,{className:`wall`,ref:e,tabIndex:0,role:`img`,onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),t.current?.crack())},"aria-label":`A wall of faceted coal with cold blue light in its seams, drawn entirely in ASCII characters. Press Enter to crack it.`}),n&&(0,x.jsx)(`p`,{className:`fallback`,children:`This experiment needs WebGL 2`}),(0,x.jsxs)(`p`,{className:`lab-hint`,children:[(0,x.jsx)(`span`,{className:`for-mouse`,children:`Sweep across the coal to crack it`}),(0,x.jsx)(`span`,{className:`for-touch`,children:`Tap or swipe across the coal`})]})]})}export{S as default};