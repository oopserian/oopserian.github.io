import{t as e}from"./react.CadLv9_P.js";import{t}from"./jsx-runtime.C2DLLpjJ.js";import{a as n,i as r,n as i,o as a,r as o,t as s}from"./gl.B6Qi3-Xr.js";var c=e(),l={CD:24,EL:12,ROLL:-5,LOOKY:.5,TY:.245,TXMIN:.3,RIN:3,ROUT:11,SPIN:6,BEAM:2.5,EXPO:3,TEXC:1.3,BMAX:.5,DIRLOD:1.5},u=48,d=6,f=4,p=3.2,ee=5,m=e=>Number(e).toFixed(5),te={dark:{disk:[[.5,.14,.1],[.95,.4,.14],[1,.72,.32],[1,.96,.86]],star:[.82,.88,1],hot:[.62,.84,1],range:[.06,.85],dense:1.4},light:{disk:[[.78,.6,.46],[.62,.34,.18],[.42,.17,.07],[.16,.05,.02]],star:[.3,.32,.42],hot:[.1,.2,.62],range:[.06,.85],dense:1.2}},h=[`-`,`~`,`=`,`.`,`+`,`*`],g=3,_=64;function ne(e){let t=e.getContext(`2d`);e.width=_*h.length,e.height=_,t.clearRect(0,0,e.width,e.height),t.fillStyle=t.strokeStyle=`#fff`,t.lineJoin=`round`,t.textAlign=`left`,t.textBaseline=`alphabetic`,t.font=`500 50px "DM Mono", ui-monospace, monospace`,h.forEach((e,n)=>{let r=t.measureText(e),i=r.actualBoundingBoxLeft,a=r.actualBoundingBoxRight,o=r.actualBoundingBoxAscent,s=r.actualBoundingBoxDescent,c=n<g?Math.max(1,Math.min(1.8,.84*_/(i+a))):1;t.save(),t.translate(n*_+_/2,_/2),t.scale(c,1);let l=-(a-i)/2,u=(o-s)/2;t.lineWidth=n<g?4.5:3,t.fillText(e,l,u),t.strokeText(e,l,u),t.restore()})}var v=170,re=e=>.07*e+.01,y=`
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,ie=()=>`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec3 uCamP, uCamR, uCamU, uCamF;   // 镜头在哪；往右、往上、往前
  uniform vec2 uTan;                          // 画面右边沿、上边沿的 tan
  uniform float uU;                           // 一圈里走到哪（0 到 1）
  uniform vec4 uClump[${u}];             // 气体：现在在盘上的半径、角度，被扯斜了多少，多亮
  uniform float uClumpN;
  uniform vec4 uStar[${f}];               // 扔进去的星：半径、角度、扯斜了多少、撕开的亮带多亮
  uniform vec4 uBody[${f}];               // 还没撕开的星本身：在哪（x、y、z），多大
  uniform float uStarN, uFlare;               // 掉到内沿时整圈亮一下
  const float TAU = 6.2831853, RIN = ${m(l.RIN)}, ROUT = ${m(l.ROUT)}, BW = 0.3;

  float h21(vec2 p) {
    uvec2 q = uvec2(ivec2(floor(p))) * uvec2(1597334673u, 3812015801u);
    uint n = (q.x ^ q.y) * 1597334673u;
    return float(n) * (1.0 / 4294967295.0);
  }
  vec3 h33(vec3 p) {
    uvec3 q = uvec3(ivec3(floor(p))) * uvec3(1597334673u, 3812015801u, 2798796415u);
    uint n = q.x ^ q.y ^ q.z;
    return vec3(uvec3(n * 1597334673u, n * 3812015801u, n * 2798796415u)) * (1.0 / 4294967295.0);
  }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // x 方向每 per 格首尾相接的噪声：绕盘一圈正好接上
  float vnoiseP(vec2 x, float per) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    float i0 = mod(i.x, per), i1 = mod(i.x + 1.0, per);
    return mix(mix(h21(vec2(i0, i.y)), h21(vec2(i1, i.y)), f.x), mix(h21(vec2(i0, i.y + 1.0)), h21(vec2(i1, i.y + 1.0)), f.x), f.y);
  }
  float wrapPi(float a) { return a - TAU * floor(a / TAU + 0.5); }

  // 盘上的气流：按半径切成一圈圈窄带，每圈按开普勒的转速取一个整数（一圈 period 转几圈），
  // 相邻两圈转速一样就是同一份花纹，不一样就渐变过去。花纹顺着转的方向拉得很长
  float band(float b, float r, float a) {
    float rb = (b + 0.5) * BW;
    float n = max(1.0, floor(${m(l.SPIN)} * pow(rb / RIN, -1.5) + 0.5));
    float q = a - n * uU;
    return 0.6 * vnoiseP(vec2(q * 14.0, r * 3.2), 14.0) + 0.4 * vnoiseP(vec2(q * 42.0, r * 8.0 + 3.0), 42.0);
  }
  float diskTex(float r, float a) {
    float bc = r / BW, b0 = floor(bc), k = smoothstep(0.0, 1.0, fract(bc));
    return mix(band(b0, r, a), band(b0 + 1.0, r, a), k);
  }
  // 内沿最亮，往外暗下去
  float prof(float r) {
    return smoothstep(RIN * 0.97, RIN + 0.5, r) * pow(RIN / r, 1.8) * (1.0 - smoothstep(ROUT * 0.55, ROUT, r));
  }

  // 背后的星星：方向切成小格，少数格子里有一颗，一圈闪整数次
  float stars(vec3 d) {
    vec3 q = d * 110.0, c = floor(q), h = h33(c);
    if (h.x < 0.9) return 0.0;
    vec3 hp = h33(c + 17.0);
    float dd = length(q - c - 0.5 - 0.5 * (hp - 0.5));
    float tw = 0.75 + 0.25 * sin(TAU * (uU * floor(1.0 + 3.0 * h.z) + h.y));   // 闪：一圈整数次
    return smoothstep(0.4, 0.05, dd) * (0.35 + 0.65 * h.y) * tw;
  }

  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 rd = normalize(uCamF + ndc.x * uTan.x * uCamR + ndc.y * uTan.y * uCamU);
    vec3 x = uCamP, v = rd;
    vec3 cr = cross(x, v);
    float h2 = dot(cr, cr);
    float L = 0.0, Lh = 0.0, Tr = 1.0, sp = 0.0, wBest = 0.0, flow = 0.0, kind = 0.0;
    bool esc = false;
    for (int i = 0; i < ${v}; i++) {
      float r = length(x);
      if (r < 1.0) break;                                  // 掉进视界
      if (r > ${m(l.CD*1.3)} && dot(x, v) > 0.0) { esc = true; break; }
      float dt = 0.07 * r + 0.01;
      vec3 a = -1.5 * h2 * x / pow(r, 5.0);
      vec3 xn = x + v * dt + 0.5 * a * dt * dt;
      float rn = length(xn);
      vec3 an = -1.5 * h2 * xn / pow(rn, 5.0);
      vec3 vn = v + 0.5 * (a + an) * dt;
      // 穿过盘面：在这一步里按高度插出穿过的那一点
      if (x.y * xn.y <= 0.0 && x.y != xn.y) {
        vec3 Pt = mix(x, xn, x.y / (x.y - xn.y));
        float rp = length(Pt.xz);
        if (rp > RIN * 0.9 && rp < ROUT + 3.0) {
          float phi = atan(Pt.z, Pt.x);
          float tex = diskTex(rp, phi / TAU);
          float dens = prof(rp) * (0.15 + ${m(l.TEXC)} * smoothstep(0.2, 0.85, tex)), ex = 0.0;
          // 撒进去的气体：沿着各自的轨道被扯成一道弧（ex：撒进去、扔进去的东西发的光，合成时换一个更热的颜色）
          for (int j = 0; j < ${u}; j++) {
            if (float(j) >= uClumpN) break;
            vec4 C = uClump[j];
            float dr = rp - C.x, dp = wrapPi(phi - C.y - C.z * dr) * rp;
            ex += C.w * exp(-dr * dr / 0.06 - dp * dp / 0.2) * (0.25 + 1.1 * tex);
          }
          // 扔进去的星：先是一颗亮点，再被撕成一条细长的亮带
          for (int j = 0; j < ${f}; j++) {
            if (float(j) >= uStarN) break;
            vec4 S = uStar[j];
            float dr = rp - S.x, dp = wrapPi(phi - S.y - S.z * dr) * rp;
            ex += S.w * exp(-dr * dr / 0.15 - dp * dp / 0.3) * (0.5 + 0.8 * tex);
          }
          ex += uFlare * exp(-pow((rp - RIN - 0.25) / 0.4, 2.0)) * (0.5 + 0.8 * tex);
          dens += ex;
          // 朝镜头转过来的那边亮（多普勒增亮），越靠里被引力红移得越暗
          vec3 od = vec3(-Pt.z, 0.0, Pt.x) / max(rp, 1e-3);
          float beta = min(sqrt(0.5 / max(rp - 1.0, 0.5)), ${m(l.BMAX)});
          float D = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(od, -normalize(vn)));
          float e = dens * pow(D, ${m(l.BEAM)}) * sqrt(max(1.0 - 1.0 / rp, 0.0));
          L += Tr * e; Lh += Tr * e * ex / max(dens, 1e-4);
          if (Tr * e > wBest) { wBest = Tr * e; flow = rp; kind = 1.0; }
          Tr *= 1.0 - clamp(dens * 1.4, 0.0, 0.9);
        }
      }
      // 还没撕开的星：一个发亮的小球，光线从它旁边擦过（这一步的线段离球心够近）就算碰上
      for (int j = 0; j < ${f}; j++) {
        if (float(j) >= uStarN) break;
        vec4 B = uBody[j];
        if (B.w <= 0.0) continue;
        vec3 sg = xn - x;
        float tt = clamp(dot(B.xyz - x, sg) / dot(sg, sg), 0.0, 1.0), d = length(x + sg * tt - B.xyz);
        if (d < B.w) { float e = 3.0 * sqrt(1.0 - d / B.w); L += Tr * e; Lh += Tr * e; Tr *= 0.1; }
      }
      x = xn; v = vn;
      if (Tr < 0.03) break;
    }
    if (esc) {
      vec3 d = normalize(v);
      sp = max(sp, Tr * stars(d));
    }
    // 字的方向：顺着盘上半径的等值线，就是一圈圈轨道。按屏幕算，光环上的字也跟着绕
    vec2 g = vec2(dFdx(flow), -dFdy(flow));
    float kd = abs(dFdx(kind)) + abs(dFdy(kind));
    vec2 t = vec2(-g.y, g.x);
    float m2 = dot(t, t);
    vec2 dir = (m2 > 1e-14 && kd < 0.5) ? vec2(t.x * t.x - t.y * t.y, 2.0 * t.x * t.y) / m2 : vec2(0.0);
    // g：盘上是这一点的光里有几成是撒进去、扔进去的东西发的，空的天上是星星有多亮（合成时看这一格有没有盘来分）
    float Lt = 1.0 - exp(-${m(l.EXPO)} * L);
    o = vec4(Lt, Lt > 0.02 ? clamp(1.5 * Lh / max(L, 1e-4), 0.0, 1.0) : clamp(sp, 0.0, 1.0), dir * 0.5 + 0.5);
  }
`,ae=()=>`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uImg, uAtlas;
  uniform vec2 uRes, uCells;        // 画布（设备像素）；底稿有几列几行格子（比画布多出不到一格）
  uniform float uCell, uN;          // 一格多少设备像素、图集里有几个字
  uniform vec2 uRange;              // 亮度从 x 到 y 铺满由淡到浓的字；比 x 暗的不画
  uniform vec3 uC0, uC1, uC2, uC3;  // 盘的色带
  uniform vec3 uStar, uHot;         // 星星；撒进去的气体、扔进去的星（更热，偏蓝白）
  uniform float uDense;             // 字由细到粗怎么分：越大，越亮的格子才用得上 =
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) / uCells, uv = vec2(c0.x, 1.0 - c0.y);
    vec4 s = textureLod(uImg, uv, 1.0);                           // 底稿一格两个像素，第 1 层 mipmap 正好一格一个
    float r1 = hash(cell);
    float gi = -1.0, a = 0.0;
    vec3 col = vec3(0.0);
    float lv = (s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.06;
    vec2 t2 = textureLod(uImg, uv, ${m(l.DIRLOD)}).ba * 2.0 - 1.0;
    float ang = dot(t2, t2) > 1e-12 ? 0.5 * atan(t2.y, t2.x) * smoothstep(0.05, 0.25, length(t2)) : 0.0;   // atan(0, 0) 没定义，有的显卡算出 NaN
    if (lv > 0.0) {
      // 盘：亮度挑 - ~ =，字转到气体的流向上；撒进去的气体往热的颜色上靠
      a = ang;
      lv = clamp(lv, 0.0, 0.999);
      lv = mix(lv, lv * lv * (3.0 - 2.0 * lv), 0.5);   // 拉开一点反差
      float hot = smoothstep(0.1, 0.8, s.g);
      lv = max(lv, 0.6 * hot);
      gi = min(floor(pow(lv, uDense) * ${g}.0), ${g}.0 - 1.0);
      col = mix(ramp(lv), uHot, 0.85 * hot);
    } else if (s.r < 0.003 && s.g > 0.1 + 0.08 * r1) {
      // 星星：. + * 由暗到亮，不转
      float k = clamp((s.g - 0.1) / 0.4, 0.0, 0.999);
      gi = ${g}.0 + floor(k * (uN - ${g}.0));
      col = uStar;
    }
    float ink = 0.0;
    if (gi >= 0.0) {
      vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
      vec2 q = vec2(cos(a) * loc.x + sin(a) * loc.y, -sin(a) * loc.x + cos(a) * loc.y);
      if (abs(q.x) < 0.5 && abs(q.y) < 0.5) ink = texture(uAtlas, vec2((gi + q.x + 0.5) / uN, 0.5 - q.y)).r;
    }
    o = vec4(col * ink, ink);   // 预乘过的透明度：字以外是透明的
  }
`;function b(e,{period:t=12e3,cell:c=8,fps:m=30}={}){let g=i(e),_=n(g),b=matchMedia(`(prefers-reduced-motion: reduce)`),x=b.matches||_,S=o(g),oe=r(g,y,ie()),C=r(g,y,ae()),w=[],T=new Float32Array(192),E=[],D=new Float32Array(16),O=new Float32Array(16),k=null,A=1,j=1,M=document.createElement(`canvas`);ne(M);let N=s(g,M),se=l.EL*Math.PI/180,P=l.ROLL*Math.PI/180,F=[0,l.CD*Math.sin(se),l.CD*Math.cos(se)],ce=Math.hypot(F[1]-l.LOOKY,F[2]),I=[0,(l.LOOKY-F[1])/ce,-F[2]/ce],L=[1,0,0],R=[0,-I[2],I[1]],z={R:L.map((e,t)=>e*Math.cos(P)+R[t]*Math.sin(P)),U:R.map((e,t)=>e*Math.cos(P)-L[t]*Math.sin(P)),tan:[1,1]};function le(e){let t=l.TY,n=t*e;n<l.TXMIN&&(n=l.TXMIN,t=n/e),z.tan=[n,t]}let B=0,V=0,H=1,U=0,W=!0,G=-1e9,K=-1,q=!1,J=!1;function Y(){J=getComputedStyle(e).colorScheme.includes(`dark`)}function ue(){B=e.clientWidth,V=e.clientHeight,B&&V&&(H=Math.min(2,window.devicePixelRatio||1),e.width=Math.round(B*H),e.height=Math.round(V*H),A=Math.ceil(B/c),j=Math.ceil(V/c),le(A/j),k?.dispose(),k=a(g,A*2,j*2,{mipmaps:!0}),Y(),Q(!0))}function de(e,t){let n=e/(A*c)*2-1,r=1-t/(j*c)*2,i=[0,1,2].map(e=>I[e]+n*z.tan[0]*z.R[e]+r*z.tan[1]*z.U[e]),a=Math.hypot(...i),o=F.slice(),s=i.map(e=>e/a),u=[o[1]*s[2]-o[2]*s[1],o[2]*s[0]-o[0]*s[2],o[0]*s[1]-o[1]*s[0]],d=u[0]*u[0]+u[1]*u[1]+u[2]*u[2];for(let e=0;e<v;e++){let e=Math.hypot(...o);if(e<1||e>l.CD*1.3&&o[0]*s[0]+o[1]*s[1]+o[2]*s[2]>0)return null;let t=re(e),n=-1.5*d/e**5,r=o.map(e=>e*n),i=o.map((e,n)=>e+s[n]*t+.5*r[n]*t*t),a=-1.5*d/Math.hypot(...i)**5,c=s.map((e,n)=>e+.5*(r[n]+i[n]*a)*t);if(o[1]*i[1]<=0&&o[1]!==i[1]){let e=o[1]/(o[1]-i[1]),t=o[0]+(i[0]-o[0])*e,n=o[2]+(i[2]-o[2])*e,r=Math.hypot(t,n);if(r>l.RIN*.9&&r<l.ROUT+3)return{r:Math.max(r,l.RIN+.2),phi:Math.atan2(n,t)}}o=i,s=c}return null}let fe=e=>l.SPIN*2*Math.PI/(t/1e3)*(e/l.RIN)**-1.5,pe=-1e9,me=-1e9,he=-1e9;function ge(e,t,n){if(Math.hypot(e-pe,t-me)<24&&n-he<80)return;let r=de(e,t);r&&(pe=e,me=t,he=n,w.push({r0:r.r,r:r.r,phi:r.phi,k:0,age:0}),w.length>u&&w.shift(),Q(!0))}function _e(e,t){let n=de(e,t);return n?(E.push({r0:n.r,r:n.r,phi:n.phi,k:0,age:0}),E.length>f&&E.shift(),Q(!0),!0):!1}let ve=t=>{let n=e.getBoundingClientRect();return[t.clientX-n.left,t.clientY-n.top]},ye=e=>{if(x||!B)return;let[t,n]=ve(e);ge(t,n,performance.now())},be=e=>{if(x||!B)return;let[t,n]=ve(e);_e(t,n)};e.addEventListener(`pointermove`,ye),e.addEventListener(`pointerdown`,be);let X=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};function xe(e){for(let t of w){t.age+=e;let n=Math.min(t.age/d,1);t.r=t.r0-(t.r0-l.RIN+.15)*n**1.6;let r=fe(t.r);t.phi+=r*e,t.k+=-1.5*r/t.r*e}for(;w.length&&w[0].age>=d;)w.shift();for(let t of E){t.age+=e;let n=Math.min(t.age/p,1);t.r=t.r0-(t.r0-l.RIN+.1)*n*n;let r=fe(t.r);t.phi+=r*e,t.k+=-1.5*r/t.r*e*3*X(.4,1,t.age)}for(;E.length&&E[0].age>=ee;)E.shift()}function Se(n){if(U=0,q||!B||!k)return;let r=K<0?0:Math.min(.1,(n-K)/1e3),i=w.length>0||E.length>0;if(!x&&!i&&n-G<1e3/m-2){K=n,Z();return}G=n,xe(x?0:r),K=n,w.forEach((e,t)=>{let n=e.age/d;T.set([e.r,e.phi,e.k,.6*X(0,.2,e.age)*(1-X(.7,1,n))*(1+1.5*n)],t*4)});let a=0;E.forEach((e,t)=>{D.set([e.r,e.phi,e.k,2.5*X(.4,1,e.age)*(1-X(2.9000000000000004,3.4000000000000004,e.age))],t*4),O.set([e.r*Math.cos(e.phi),.12,e.r*Math.sin(e.phi),.55*(1-X(.5,1.3,e.age))],t*4),e.age>2.9000000000000004&&(a+=1.4*X(2.9000000000000004,p,e.age)*Math.exp(-Math.max(0,e.age-p)*1.6))});let o=x?0:(n%t+t)%t/t;k.bind(),oe.use({uCamP:F,uCamR:z.R,uCamU:z.U,uCamF:I,uTan:z.tan,uU:o,uClump:T,uClumpN:w.length,uStar:D,uBody:O,uStarN:E.length,uFlare:a}),S.draw(),k.mip(),g.bindFramebuffer(g.FRAMEBUFFER,null),g.viewport(0,0,e.width,e.height),g.clearColor(0,0,0,0),g.clear(g.COLOR_BUFFER_BIT);let s=te[J?`dark`:`light`];C.use({uImg:[k.tex,0],uAtlas:[N.tex,1],uRes:[e.width,e.height],uCells:[A,j],uCell:c*H,uN:h.length,uRange:s.range,uC0:s.disk[0],uC1:s.disk[1],uC2:s.disk[2],uC3:s.disk[3],uStar:s.star,uHot:s.hot,uDense:s.dense}),S.draw(),x||Z()}function Z(){!U&&!q&&W&&!document.hidden&&(U=requestAnimationFrame(Se))}function Q(e=!1){e&&(G=-1e9),Z()}let Ce=new IntersectionObserver(([e])=>{W=e.isIntersecting,W&&(K=-1,Q(!0))});Ce.observe(e);let $=new ResizeObserver(()=>ue());$.observe(e);let we=()=>{document.hidden||(K=-1,Q(!0))};document.addEventListener(`visibilitychange`,we);let Te=()=>{x=b.matches||_,Q(!0)};return b.addEventListener(`change`,Te),document.fonts?.load(`500 50px "DM Mono"`).then(()=>{q||(ne(M),N.update(),Q(!0))},()=>{}),ue(),{drop(){if(!x&&B){for(let e=0;e<12;e++)if(_e(B*(.15+Math.random()*.7),V*(.35+Math.random()*.4)))return}},refresh(){Y(),Q(!0)},destroy(){q=!0,cancelAnimationFrame(U),U=0,Ce.disconnect(),$.disconnect(),e.removeEventListener(`pointermove`,ye),e.removeEventListener(`pointerdown`,be),document.removeEventListener(`visibilitychange`,we),b.removeEventListener(`change`,Te),k?.dispose(),N.dispose(),S.dispose(),oe.dispose(),C.dispose()}}}var x=t();function S(){let e=(0,c.useRef)(null),t=(0,c.useRef)(null),[n,r]=(0,c.useState)(!1);return(0,c.useEffect)(()=>{let n;try{n=b(e.current,{period:12e3})}catch{r(!0);return}t.current=n;let i=()=>n.refresh(),a=new MutationObserver(i);a.observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]});let o=matchMedia(`(prefers-color-scheme: dark)`);return o.addEventListener(`change`,i),()=>{a.disconnect(),o.removeEventListener(`change`,i),n.destroy(),t.current=null}},[]),(0,x.jsxs)(`div`,{className:`lab-root ascii-black-hole`,children:[(0,x.jsx)(`canvas`,{className:`wall`,ref:e,tabIndex:0,role:`img`,onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),t.current?.drop())},"aria-label":`A black hole ringed by a glowing accretion disk whose far side is bent up over the shadow, drawn entirely in ASCII characters. Press Enter to drop a star in.`}),n&&(0,x.jsx)(`p`,{className:`fallback`,children:`This experiment needs WebGL 2`}),(0,x.jsxs)(`p`,{className:`lab-hint`,children:[(0,x.jsx)(`span`,{className:`for-mouse`,children:`Sweep across the disk to feed it`}),(0,x.jsx)(`span`,{className:`for-touch`,children:`Tap or swipe across the disk`})]})]})}export{S as default};