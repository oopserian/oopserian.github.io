import{t as e}from"./react.CvnImTBr.js";import{t}from"./jsx-runtime.Cr1s1OSH.js";import{a as n,i as r,n as i,o as a,r as o,t as s}from"./gl.B6Qi3-Xr.js";var c=e(),l=64,u=6,d=6,f=5;function ee(e){let t=0,n=1/0;for(let r=1;r<e.length-1;r++){if(e[r].start||e[r+1].start)continue;let i=e[r-1],a=e[r],o=e[r+1],s=Math.abs((a.x-i.x)*(o.y-i.y)-(a.y-i.y)*(o.x-i.x));s<n&&(n=s,t=r)}e.splice(t,1)}var p={dark:{sand:[[.3,.26,.5],[.72,.42,.45],[1,.66,.36],[1,.92,.7]],spray:[1,.95,.85],range:[.31,.62],dense:1.8,stroke:[4.5,3]},light:{sand:[[.72,.48,.24],[.57,.33,.15],[.39,.19,.09],[.21,.09,.06]],spray:[.5,.27,.11],range:[.31,.62],dense:1,stroke:[6.5,4.5]}},m=(()=>{let e=.25,t=Math.hypot(e,-1);return[e/t,-1/t]})(),h=2.3,g=.74,_=.42,v=.11,te=1.1,ne=.7,re=70,y=`
  const vec2 WD = vec2(${m[0]}, ${m[1]});     // 风往哪吹（地面上 x、z）
  const vec2 WC = vec2(${-m[1]}, ${m[0]});    // 横着风的方向
  const float LD = ${h}, FC = ${g}, AMP = ${_}, RW = ${v};
  float h21(vec2 p) {
    uvec2 q = uvec2(ivec2(floor(p))) * uvec2(1597334673u, 3812015801u);
    uint n = (q.x ^ q.y) * 1597334673u;
    return float(n) * (1.0 / 4294967295.0);
  }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // x 方向每 per 格首尾相接的噪声：扬起的沙顺风挪一个周期，正好回到原处
  float vnoiseP(vec2 x, float per) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    float i0 = mod(i.x, per), i1 = mod(i.x + 1.0, per);
    return mix(mix(h21(vec2(i0, i.y)), h21(vec2(i1, i.y)), f.x), mix(h21(vec2(i0, i.y + 1.0)), h21(vec2(i1, i.y + 1.0)), f.x), f.y);
  }
  // 一道沙丘（沙纹也一样）顺风切开的样子，0 到 1：迎风坡缓，到坡顶还带着坡度（是一道尖棱），背风坡陡，坡脚收平
  float profile(float f, float fc) {
    if (f < fc) { float x = f / fc; return x * x * (1.6 - 0.6 * x); }
    float y = (f - fc) / (1.0 - fc);
    return pow(1.0 - y, 1.4);
  }
  // 沙丘：顺风方向上走到第几道（小数部分是在一道沙丘的哪儿），棱横着弯弯曲曲
  float duneS(vec2 p) {
    float a = dot(p, WD), c = dot(p, WC);
    float off = 0.42 * sin(c * 0.7 + 0.6) + 0.14 * sin(c * 1.9 + 2.0) + 0.7 * (vnoise(vec2(c * 0.4, 3.7)) - 0.5);
    return (a + off) / LD;
  }
  float duneH(vec2 p) {
    float s = duneS(p), id = floor(s);
    float amp = AMP * (0.55 + 0.8 * vnoise(vec2(dot(p, WC) * 0.3, id * 1.7 + 11.0)));
    return amp * profile(s - id, FC) + 0.45 * vnoise(p * 0.09 + 5.0);   // 底下再垫一层很缓的起伏
  }
`,b=Math.imul;function x(e,t){return(b((b(Math.floor(e)|0,1597334673)>>>0^b(Math.floor(t)|0,-482951495)>>>0)>>>0,1597334673)>>>0)/4294967295}function S(e,t){let n=Math.floor(e),r=Math.floor(t),i=e-n,a=t-r;i=i*i*(3-2*i),a=a*a*(3-2*a);let o=x(n,r),s=x(n+1,r),c=x(n,r+1),l=x(n+1,r+1);return o+(s-o)*i+(c-o)*a+(o-s-c+l)*i*a}function C(e,t){if(e<t){let n=e/t;return n*n*(1.6-.6*n)}return(1-(e-t)/(1-t))**1.4}function ie(e,t){let n=e*m[0]+t*m[1],r=-e*m[1]+t*m[0],i=(n+(.42*Math.sin(r*.7+.6)+.14*Math.sin(r*1.9+2)+.7*(S(r*.4,3.7)-.5)))/h,a=Math.floor(i);return _*(.55+.8*S(r*.3,a*1.7+11))*C(i-a,g)+.45*S(e*.09+5,t*.09+5)}var w=[`-`,`~`,`=`,`.`,`:`,`*`],T=3,E=64;function D(e,t=[4.5,3]){let n=e.getContext(`2d`);e.width=E*w.length,e.height=E,n.clearRect(0,0,e.width,e.height),n.fillStyle=n.strokeStyle=`#fff`,n.lineJoin=`round`,n.textAlign=`left`,n.textBaseline=`alphabetic`,n.font=`500 50px "DM Mono", ui-monospace, monospace`,w.forEach((e,r)=>{let i=n.measureText(e),a=i.actualBoundingBoxLeft,o=i.actualBoundingBoxRight,s=i.actualBoundingBoxAscent,c=i.actualBoundingBoxDescent,l=r<T?t[0]:t[1],u=r<T?Math.max(1,E/(a+o+l)):1;n.save(),n.translate(r*E+E/2,E/2),n.scale(u,1);let d=-(o-a)/2,f=(s-c)/2;n.lineWidth=l,n.fillText(e,d,f),n.strokeText(e,d,f),n.restore()})}var O=`
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,ae=`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec3 uCamR, uCamU, uCamF;   // 镜头往右、往上、往前
  uniform vec2 uTan;                  // 画面右边沿、上边沿的 tan
  uniform float uU;                   // 一圈里走到哪（0 到 1）
  uniform float uFoot;                // 底稿一个像素，在 1 远的地方有多宽
  uniform vec3 uSun;                  // 太阳的方向
  uniform float uGroove, uPile;       // 沟多宽（一半）、沙堆多大（半径）
  uniform vec4 uTrail[${l}];      // 划过的点，由旧到新：x、z、过了几秒、是不是一笔的开头
  uniform float uTrailN;
  uniform vec4 uTap[${d}];         // 沙堆：x、z、过了几秒、随机数
  uniform float uTapN;
  uniform float uLight;               // 1：浅色主题，天的明暗反过来，越往上越亮（合成时浓淡也翻过来，就是越往上墨越淡）
  const vec3 RO = vec3(0.0, ${te}, 0.0);
  ${y}
  // 沙纹：顺风方向上第几道，弯一点，一圈往下风挪一道
  float rippleP(vec2 p) {
    float a = dot(p, WD) / RW, c = dot(p, WC) / RW;
    float w = 0.6 * sin(c * 0.33 + 1.3) + 1.4 * (vnoise(vec2(c * 0.15, a * 0.1)) - 0.5) + 0.35 * (vnoise(vec2(c * 0.45, a * 0.3) + 7.0) - 0.5);
    return a + w - uU;
  }
  // 沙纹长在哪儿：迎风坡和洼地里有，坡顶到背风坡没有（太陡，沙一直在往下滑）
  float rippleMask(vec2 p) {
    float f = fract(duneS(p));
    return (1.0 - smoothstep(FC - 0.06, FC - 0.01, f)) * smoothstep(0.0, 0.05, f);
  }
  // 沙堆：倒下去 0.45 秒堆起来，一秒后风开始吹，顺风挪、拉长、矮下去
  // h、g 是高度和坡度；blow 是被吹散了多少，cen 是现在的中心
  void pile(vec4 P, vec2 p, out float h, out vec2 g, out float blow, out vec2 cen) {
    float a = P.z, grow = smoothstep(0.0, 0.45, a);
    blow = smoothstep(1.0, ${f}.0, a);
    cen = P.xy + WD * uPile * 1.4 * blow;
    float sa = 1.0 + 1.3 * blow, R = uPile * (0.55 + 0.45 * grow), Hc = 0.62 * R * grow * (1.0 - blow);
    vec2 q = p - cen;
    float qa = dot(q, WD) / sa, qc = dot(q, WC), k = 0.12 * R;
    float rr = sqrt(qa * qa + qc * qc + k * k), r = rr - k;   // 顶上圆一点
    h = Hc * max(0.0, 1.0 - r / R);
    vec2 dr = (qa * WD / sa + qc * WC) / rr;
    g = r < R ? -Hc / R * dr : vec2(0.0);
  }
  float pilesH(vec2 p) {
    float h = 0.0, ph, bl; vec2 pg, cn;
    for (int i = 0; i < ${d}; i++) {
      if (float(i) >= uTapN) break;
      pile(uTap[i], p, ph, pg, bl, cn);
      h += ph;
    }
    return h;
  }
  float groundH(vec2 p) { return duneH(p) + (uTapN > 0.0 ? pilesH(p) : 0.0); }
  // 到一段线段的距离，t 是落在线段上哪儿（0 到 1）
  float seg(vec2 p, vec2 a, vec2 b, out float t) {
    vec2 ab = b - a; float l2 = dot(ab, ab);
    t = l2 > 1e-10 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
    return length(p - a - ab * t);
  }
  // 天：越往上越暗，地平线上一层亮的沙尘，太阳那边一团光
  float skyL(vec3 rd) {
    float up = max(rd.y, 0.0), s = max(dot(rd, uSun), 0.0);
    return 0.1 + 0.42 * exp(-up * 7.0) + 0.35 * pow(s, 10.0) + 0.5 * smoothstep(0.9993, 0.9997, s);
  }
  // 地面上一个方向 T（x、z）在 P 点投到画面上朝哪（y 朝下），存成二倍角
  vec2 screenDir(vec3 P, vec2 T) {
    vec3 d = P - RO, t3 = vec3(T.x, 0.0, T.y);
    float z = dot(d, uCamF), sx = dot(d, uCamR) / z, sy = dot(d, uCamU) / z;
    vec2 v = vec2((dot(t3, uCamR) - sx * dot(t3, uCamF)) / uTan.x, -(dot(t3, uCamU) - sy * dot(t3, uCamF)) / uTan.y);
    float m2 = dot(v, v);
    return m2 > 1e-14 ? vec2(v.x * v.x - v.y * v.y, 2.0 * v.x * v.y) / m2 : vec2(0.0);
  }
  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 rd = normalize(uCamF + ndc.x * uTan.x * uCamR + ndc.y * uTan.y * uCamU);
    // 往沙面走：每步走「离沙面还有多高」的一部分，越远步子可以越大
    float t = 0.3, hit = -1.0, lastT = t, lastD = 1.0;
    for (int i = 0; i < 140; i++) {
      vec3 q = RO + rd * t;
      float d = q.y - groundH(q.xz);
      if (d < 0.0) {
        // 碰上了：在上一步和这一步之间按高度差插一下
        hit = mix(lastT, t, lastD / (lastD - d));
        break;
      }
      lastT = t; lastD = d;
      t += max(0.4 * d, 0.0025 * t);
      if (t > ${re}.0) break;
    }
    if (hit < 0.0) {
      // 天：字横着放。浅色主题是白天的纸：地平线上那层沙尘跟雾接上，越往上越淡，不压成一道深色的边
      float sl = skyL(rd);
      if (uLight > 0.5) sl = 1.04 - sl;
      o = vec4(clamp(sl, 0.0, 1.0), 0.0, 0.5, 0.5);
      return;
    }
    vec3 P = RO + rd * hit;
    vec2 p = P.xz;
    float foot = hit * uFoot;   // 这里底稿一个像素在沙上有多宽

    // 沟：找对这一点影响最大的那一段（新的、近的），沟按噪声抖一抖，边是参差的
    vec2 pj = p + uGroove * 0.5 * (vec2(vnoise(p / uGroove * 0.6 + 1.7), vnoise(p / uGroove * 0.6 + 9.2)) - 0.5);
    float best = 0.0, gd = 1e3, gamp = 0.0, gw = uGroove, gage = 9.0;
    vec2 gc = p;
    for (int i = 0; i < ${l}; i++) {
      if (float(i) >= uTrailN) break;
      vec4 B = uTrail[i], A = (i == 0 || B.w > 0.5) ? B : uTrail[max(i - 1, 0)];
      float tt, d = seg(pj, A.xy, B.xy, tt), ag = mix(A.z, B.z, tt);
      float fill = smoothstep(0.8, ${u}.0, ag), amp = 1.0 - fill, w = uGroove * (1.0 + 0.6 * fill);
      float score = amp * exp(-d * d / (9.0 * w * w));
      if (score > best) { best = score; gd = d; gamp = amp; gw = w; gc = mix(A.xy, B.xy, tt); gage = ag; }
    }
    // 沟的横截面：中间凹下去，两边各堆起一道沙埂。高度连同坡度一起算
    float D = 0.9 * uGroove, Bh = 0.35 * D, db = 1.75 * gw, wb = 0.65 * gw;
    float e1 = exp(-gd * gd / (gw * gw)), x2 = (gd - db) / wb, e2 = exp(-x2 * x2);
    vec2 rdir = gd > 1e-6 ? (pj - gc) / gd : vec2(0.0);
    vec2 ggrad = gamp * (D * 2.0 * gd / (gw * gw) * e1 - Bh * 2.0 * x2 / wb * e2) * rdir;
    float erase = gamp * exp(-gd * gd / (4.0 * gw * gw));   // 沟和沙埂上没有沙纹，填平了再长回来

    // 刚犁过的那一截：翻起来的沙粒往两边溅，半秒里落下
    vec2 cid = floor(gl_FragCoord.xy * 0.5);   // 这一点落在屏幕上哪一格（底稿一格两个像素）：一格里取同一个随机数
    float spray = (1.0 - smoothstep(0.15, 0.7, gage)) * (1.0 - smoothstep(gw * 1.2, gw * 2.6, gd)) * step(0.55, h21(cid + floor(gage * 20.0) * 3.7));
    // 沙堆
    vec2 pg = vec2(0.0);
    for (int i = 0; i < ${d}; i++) {
      if (float(i) >= uTapN) break;
      vec4 Pt = uTap[i];
      float hh, bl; vec2 gg, cen;
      pile(Pt, p, hh, gg, bl, cen);
      pg += gg;
      erase = max(erase, clamp(hh / (0.05 * uPile), 0.0, 1.0));   // 沙堆盖住的地方没有沙纹
      float r = length(p - Pt.xy), ag = Pt.z;
      // 倒下来的沙粒：头 0.6 秒里落点一圈闪着亮的沙
      float fall = (1.0 - smoothstep(0.3, 0.7, ag)) * (1.0 - smoothstep(uPile * 0.6, uPile * 1.3, r));
      spray = max(spray, fall * step(0.6, h21(cid + floor(ag * 24.0) * 7.13 + Pt.w * 50.0)));
      // 被风吹散：顺风拖出一道沙尾，一缕一缕往下风走
      vec2 qc = p - cen;
      float down = dot(qc, WD), side = dot(qc, WC);
      float tail = smoothstep(-0.3 * uPile, 0.2 * uPile, down) * (1.0 - smoothstep(uPile, uPile * 4.0, down)) * exp(-side * side / (uPile * uPile * 0.5));
      float wisp = smoothstep(0.45, 0.8, vnoise(vec2(down / uPile * 1.5 - ag * 6.0, side / uPile * 4.0) + Pt.w * 13.0));
      spray = max(spray, tail * wisp * smoothstep(0.0, 0.25, bl) * (1.0 - smoothstep(0.6, 1.0, bl)));
    }

    // 沙面的坡度：沙丘用差分，沙纹也用差分（远到装不下的地方淡掉），沟、沙堆是算好的
    float e = max(foot, 0.002);
    vec2 gdn = vec2(duneH(p + vec2(e, 0.0)) - duneH(p - vec2(e, 0.0)), duneH(p + vec2(0.0, e)) - duneH(p - vec2(0.0, e))) / (2.0 * e);
    float rmask = rippleMask(p) * (1.0 - erase);
    float er = RW * 0.08;
    float rp = rippleP(p);
    vec2 rg = vec2(rippleP(p + vec2(er, 0.0)) - rp, rippleP(p + vec2(0.0, er)) - rp) / er;   // 沙纹相位的梯度
    float fr = fract(rp);
    float slope = fr < 0.68 ? 1.0 / 0.68 * (2.0 * (fr / 0.68) * (1.6 - 0.6 * fr / 0.68) - 0.6 * (fr / 0.68) * (fr / 0.68)) : -1.4 / 0.32 * pow(max(1.0 - (fr - 0.68) / 0.32, 0.0), 0.4);
    float keep = smoothstep(2.5, 6.0, RW / foot);   // 一道沙纹在底稿上至少几个像素才画明暗，不然只剩噪点
    vec2 grp = RW * 0.14 * slope * rg * rmask * keep;
    vec2 grad = gdn + grp + ggrad + 1.5 * pg;

    // 光：低低的太阳，漫射，加一点天光；往太阳那边走几步，看沙丘、沙堆挡没挡住（软一点的影子）
    vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
    float dif = max(dot(n, uSun), 0.0);
    float sh = 1.0, h0 = groundH(p) + 0.004;
    float st = 0.03;
    for (int i = 0; i < 22; i++) {
      vec3 q = vec3(p.x, h0, p.y) + uSun * st;
      float hq = groundH(q.xz);
      sh = min(sh, clamp((q.y - hq) * 12.0 / st + 0.5, 0.0, 1.0));
      st *= 1.28;
      if (sh < 0.01 || st > 6.0) break;
    }
    // 天光：背着太阳那一半天空照过来的蓝光，影子里的沙纹也看得出一点
    vec3 skyDir = normalize(vec3(-uSun.x, 1.2, -uSun.z));
    float L = 0.2 * (0.5 + 0.5 * dot(n, skyDir)) + dif * mix(0.12, 1.0, sh);
    // 沙尘的雾：越远越往地平线上那层亮的沙尘靠
    vec3 rh = normalize(vec3(rd.x, 0.0, rd.z));
    L = mix(L, skyL(rh), 1.0 - exp(-hit / 4.5));

    // 风从坡顶扬起一缕缕沙，顺着风往下飘，落在背风坡上
    float s = duneS(p), f = fract(s);
    float a = dot(p, WD), c = dot(p, WC);
    float crest = smoothstep(FC - 0.16, FC - 0.04, f) * (1.0 - smoothstep(FC - 0.005, FC + 0.01, f));
    float wn = vnoiseP(vec2(a * 6.0 - uU * 16.0, c * 18.0), 16.0);
    float gust = smoothstep(0.35, 0.7, vnoise(vec2(c * 0.6, floor(s) * 3.1)));
    spray = max(spray, crest * gust * smoothstep(0.55, 0.85, wn) * (1.0 - smoothstep(2.0, 3.5, hit)));

    // 字的方向：沟里顺着沟，有沙纹的地方顺着沙纹（远处装不下明暗了，走向还在），别处顺着沙丘的等高线
    vec2 t2 = screenDir(P, normalize(vec2(-gdn.y, gdn.x) + 1e-6)) * clamp(length(gdn) * 2.5, 0.0, 1.0);
    t2 = mix(t2, screenDir(P, normalize(vec2(-rg.y, rg.x))), rmask * smoothstep(0.6, 1.6, RW / foot));
    t2 = mix(t2, screenDir(P, normalize(vec2(-ggrad.y, ggrad.x) + 1e-6)), clamp(length(ggrad) * 3.0, 0.0, 1.0));
    o = vec4(clamp(L, 0.0, 1.0), clamp(spray, 0.0, 1.0), t2 * 0.5 + 0.5);
  }
`,oe=`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uSand, uAtlas;
  uniform vec2 uRes, uCells;        // 画布（设备像素）；底稿有几列几行格子（比画布多出不到一格）
  uniform float uCell, uN;          // 一格多少设备像素、图集里有几个字
  uniform vec2 uRange;              // 亮度从 x 到 y 铺满由淡到浓的字
  uniform float uDark;              // 深色主题：越亮越浓；浅色主题反过来
  uniform vec3 uC0, uC1, uC2, uC3;  // 沙的色带
  uniform vec3 uSpray;              // 扬起来的沙
  uniform float uDense;             // 字由细到粗怎么分：越大，越亮（浅色主题是越暗）的格子才用得上 =
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) / uCells, uv = vec2(c0.x, 1.0 - c0.y);
    vec4 s = textureLod(uSand, uv, 1.0);                          // 底稿一格两个像素，第 1 层 mipmap 正好一格一个
    float r1 = hash(cell), r2 = hash(cell + 17.31);
    float gi, a = 0.0;
    vec3 col;
    float sp = s.g + (r1 - 0.5) * 0.16;
    if (sp > 0.3 || r2 < (s.g - 0.1) * 1.5) {
      // 扬起来的沙：. : * 由少到多，换一个颜色，不转；边上零星撒几个点
      float k = clamp((sp - 0.3) / 0.55, 0.0, 0.999);
      gi = ${T}.0 + floor(k * (uN - ${T}.0));
      col = uSpray;
    } else {
      // 沙：亮度挑 - ~ =，字转到沙纹的走向上；方向取周围几格一起的，不跟着一格里的小起伏乱转
      vec2 t2 = textureLod(uSand, uv, 2.5).ba * 2.0 - 1.0;
      a = dot(t2, t2) > 1e-12 ? 0.5 * atan(t2.y, t2.x) * smoothstep(0.05, 0.25, length(t2)) : 0.0;   // atan(0, 0) 没定义，有的显卡算出 NaN
      float lv = clamp((s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.08, 0.0, 0.999);
      lv = mix(lv, lv * lv * (3.0 - 2.0 * lv), 0.6);   // 拉开一点反差
      if (uDark < 0.5) lv = 0.999 - lv;
      // 字：亮的才用 =，大部分是细的 - ~，一道道连成线；明暗主要靠颜色
      float lg = pow(lv, uDense);
      gi = min(floor(lg * ${T}.0), ${T}.0 - 1.0);
      col = ramp(lv);
    }
    vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
    vec2 q = vec2(cos(a) * loc.x + sin(a) * loc.y, -sin(a) * loc.x + cos(a) * loc.y);
    float ink = 0.0;
    if (abs(q.x) < 0.5 && abs(q.y) < 0.5) ink = texture(uAtlas, vec2((gi + q.x + 0.5) / uN, 0.5 - q.y)).r;
    o = vec4(col * ink, ink);   // 预乘过的透明度：字以外是透明的
  }
`;function k(e,{period:t=12e3,cell:c=5,fps:m=30}={}){let h=i(e),g=n(h),_=matchMedia(`(prefers-reduced-motion: reduce)`),v=_.matches||g,y=o(h),b=r(h,O,ae),x=r(h,O,oe),S=[],C=new Float32Array(256),T=[],E=new Float32Array(24),k=null,A=1,j=1,M=document.createElement(`canvas`);D(M);let N=s(h,M),P={R:[1,0,0],U:[0,1,0],F:[0,0,-1],tan:[1,1]};function se(e){let t=Math.tan(22*Math.PI/180),n=t*e,r=Math.tan(20*Math.PI/180);n<r&&(n=r,t=n/e);let i=Math.atan(ne*t);P.F=[0,-Math.sin(i),-Math.cos(i)],P.U=[0,Math.cos(i),-Math.sin(i)],P.tan=[n,t]}let ce=165*Math.PI/180,F=9*Math.PI/180,le=[Math.cos(F)*Math.cos(ce),Math.sin(F),Math.cos(F)*Math.sin(ce)],I=0,L=0,R=1,z=0,B=!0,V=-1e9,H=!1,U=!1,W=p.dark.stroke;function G(){U=getComputedStyle(e).colorScheme.includes(`dark`);let t=p[U?`dark`:`light`];t.stroke!==W&&(W=t.stroke,D(M,W),N.update())}function K(){I=e.clientWidth,L=e.clientHeight,I&&L&&(R=Math.min(2,window.devicePixelRatio||1),e.width=Math.round(I*R),e.height=Math.round(L*R),A=Math.ceil(I/c),j=Math.ceil(L/c),se(A*c/(j*c)),k?.dispose(),k=a(h,A*2,j*2,{mipmaps:!0}),G(),$(!0))}function q(e,t){let n=e/(A*c)*2-1,r=1-t/(j*c)*2,i=[0,1,2].map(e=>P.F[e]+n*P.tan[0]*P.R[e]+r*P.tan[1]*P.U[e]),a=Math.hypot(...i),o=i.map(e=>e/a),s=.3,l=s,u=1;for(let e=0;e<200&&s<re;e++){let e=o[0]*s,t=te+o[1]*s-ie(e,o[2]*s);if(t<0){let e=l+(s-l)*u/(u-t);return{x:o[0]*e,y:o[2]*e}}l=s,u=t,s+=Math.max(.4*t,.0025*s)}return null}let J=null,Y=0,X=0,Z=-1e9;function ue(e){S.push(e),S.length>l&&ee(S)}function de(e,t,n){let r=q(e,t);r?(!J||n-J.t>250?(J={x:r.x,y:r.y,t:n,start:!0},ue(J),Y=e,X=t,Z=n):Math.hypot(e-Y,t-X)>=28||n-Z>=90||S[S.length-1]!==J||J.start?(J={x:r.x,y:r.y,t:n,start:!1},ue(J),Y=e,X=t,Z=n):Object.assign(J,{x:r.x,y:r.y,t:n}),$(!0)):J=null}function fe(e,t,n){let r=q(e,t);return r?(J&&J.start&&S[S.length-1]===J&&S.pop(),T.push({x:r.x,y:r.y,t:n,seed:Math.random()}),T.length>d&&T.shift(),J=null,$(!0),!0):!1}let pe=t=>{let n=e.getBoundingClientRect();return[t.clientX-n.left,t.clientY-n.top]},me=e=>{if(v||!I)return;let[t,n]=pe(e);de(t,n,performance.now())},he=e=>{if(v||!I)return;let[t,n]=pe(e);fe(t,n,performance.now())},ge=()=>{J=null};e.addEventListener(`pointermove`,me),e.addEventListener(`pointerdown`,he),e.addEventListener(`pointerleave`,ge);function _e(n){if(z=0,H||!I||!k)return;for(;S.length&&(n-S[0].t)/1e3>=u;)S.shift();for(S.length||(J=null),S.forEach((e,t)=>C.set([e.x,e.y,Math.max(0,(n-e.t)/1e3),t===0||e.start?1:0],t*4));T.length&&(n-T[0].t)/1e3>=f;)T.shift();T.forEach((e,t)=>E.set([e.x,e.y,Math.max(0,(n-e.t)/1e3),e.seed],t*4));let r=S.length>0||T.length>0;if(!v&&!r&&n-V<1e3/m-2){Q();return}V=n;let i=v?0:(n%t+t)%t/t;k.bind(),b.use({uCamR:P.R,uCamU:P.U,uCamF:P.F,uTan:P.tan,uU:i,uFoot:2*P.tan[1]/k.h,uSun:le,uGroove:.05,uPile:.2,uTrail:C,uTrailN:S.length,uTap:E,uTapN:T.length,uLight:+!U}),y.draw(),k.mip(),h.bindFramebuffer(h.FRAMEBUFFER,null),h.viewport(0,0,e.width,e.height),h.clearColor(0,0,0,0),h.clear(h.COLOR_BUFFER_BIT);let a=p[U?`dark`:`light`];x.use({uSand:[k.tex,0],uAtlas:[N.tex,1],uRes:[e.width,e.height],uCells:[A,j],uCell:c*R,uN:w.length,uRange:a.range,uDark:+!!U,uC0:a.sand[0],uC1:a.sand[1],uC2:a.sand[2],uC3:a.sand[3],uSpray:a.spray,uDense:a.dense}),y.draw(),(!v||r)&&Q()}function Q(){!z&&!H&&B&&!document.hidden&&(z=requestAnimationFrame(_e))}function $(e=!1){e&&(V=-1e9),Q()}let ve=new IntersectionObserver(([e])=>{B=e.isIntersecting,B&&$(!0)});ve.observe(e);let ye=new ResizeObserver(()=>K());ye.observe(e);let be=()=>{document.hidden||$(!0)};document.addEventListener(`visibilitychange`,be);let xe=()=>{v=_.matches||g,$(!0)};return _.addEventListener(`change`,xe),document.fonts?.load(`500 50px "DM Mono"`).then(()=>{H||(D(M,W),N.update(),$(!0))},()=>{}),K(),{pour(){if(!v&&I){for(let e=0;e<8;e++)if(fe(I*(.2+Math.random()*.6),L*(.4+Math.random()*.45),performance.now()))return}},refresh(){G(),$(!0)},destroy(){H=!0,cancelAnimationFrame(z),z=0,ve.disconnect(),ye.disconnect(),e.removeEventListener(`pointermove`,me),e.removeEventListener(`pointerdown`,he),e.removeEventListener(`pointerleave`,ge),document.removeEventListener(`visibilitychange`,be),_.removeEventListener(`change`,xe),k?.dispose(),N.dispose(),y.dispose(),b.dispose(),x.dispose()}}}var A=t();function j(){let e=(0,c.useRef)(null),t=(0,c.useRef)(null),[n,r]=(0,c.useState)(!1);return(0,c.useEffect)(()=>{let n;try{n=k(e.current,{period:12e3})}catch{r(!0);return}t.current=n;let i=()=>n.refresh(),a=new MutationObserver(i);a.observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]});let o=matchMedia(`(prefers-color-scheme: dark)`);return o.addEventListener(`change`,i),()=>{a.disconnect(),o.removeEventListener(`change`,i),n.destroy(),t.current=null}},[]),(0,A.jsxs)(`div`,{className:`lab-root ascii-sand`,children:[(0,A.jsx)(`canvas`,{className:`wall`,ref:e,tabIndex:0,role:`img`,onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),t.current?.pour())},"aria-label":`Sand dunes with wind ripples running to the horizon, drawn entirely in ASCII characters. Press Enter to pour a handful of sand.`}),n&&(0,A.jsx)(`p`,{className:`fallback`,children:`This experiment needs WebGL 2`}),(0,A.jsxs)(`p`,{className:`lab-hint`,children:[(0,A.jsx)(`span`,{className:`for-mouse`,children:`Sweep across the sand to carve a groove`}),(0,A.jsx)(`span`,{className:`for-touch`,children:`Tap or swipe across the sand`})]})]})}export{j as default};