import{t as e}from"./react.CadLv9_P.js";import{t}from"./jsx-runtime.C2DLLpjJ.js";import{a as n,i as r,n as i,o as a,r as o,t as s}from"./gl.B6Qi3-Xr.js";var c=e(),l=64,u=6,d=6,f=5;function p(e){let t=0,n=1/0;for(let r=1;r<e.length-1;r++){if(e[r].start||e[r+1].start)continue;let i=e[r-1],a=e[r],o=e[r+1],s=Math.abs((a.x-i.x)*(o.y-i.y)-(a.y-i.y)*(o.x-i.x));s<n&&(n=s,t=r)}e.splice(t,1)}var ee={dark:{sand:[[.33,.29,.43],[.58,.43,.42],[.84,.62,.4],[1,.87,.64]],spray:[1,.95,.84],range:[.05,.8]},light:{sand:[[.79,.69,.55],[.63,.48,.32],[.44,.3,.18],[.22,.13,.07]],spray:[.55,.38,.2],range:[.05,.85]}},m=[`~`,`\\`,`|`,`/`,`.`,`,`,`:`,`;`,`+`,`*`,`#`],h=4,g=64;function te(e){let t=e.getContext(`2d`);e.width=g*m.length,e.height=g,t.clearRect(0,0,e.width,e.height),t.fillStyle=t.strokeStyle=`#fff`,t.lineJoin=`round`,t.textAlign=`left`,t.textBaseline=`alphabetic`,t.font=`500 50px "DM Mono", ui-monospace, monospace`,m.forEach((e,n)=>{let r=t.measureText(e),i=r.actualBoundingBoxLeft,a=r.actualBoundingBoxRight,o=r.actualBoundingBoxAscent,s=r.actualBoundingBoxDescent,c=Math.max(1,i+a),l=Math.max(1,o+s),u=n===0||n===1||n===3?.98*g/c:1,d=n>=1&&n<=3?.98*g/l:n===0?1.6:1;t.save(),t.translate(n*g+g/2,g/2),t.scale(u,d);let f=-(a-i)/2,p=(o-s)/2;t.lineWidth=n<h?7/Math.sqrt(u*d):2,t.fillText(e,f,p),t.strokeText(e,f,p),t.restore()})}var _=`
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,ne=`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec2 uView;               // 画面盖住多大一片沙
  uniform float uU, uPx, uCellW;    // 一圈里走到哪（0 到 1）；一个像素、一格字在沙上多长
  uniform float uRip, uGroove, uPile;   // 沙纹多宽、沟多宽（一半）、沙堆多大（半径）
  uniform vec3 uSun;                // 太阳的方向
  uniform float uRelief;            // 打光时沙丘的坡度放大几倍
  uniform vec4 uTrail[${l}];    // 划过的点，由旧到新：x、y、过了几秒、是不是一笔的开头
  uniform float uTrailN;
  uniform vec4 uTap[${d}];       // 沙堆：x、y、过了几秒、随机数
  uniform float uTapN;
  const vec2 WD = vec2(0.14, -0.9902);    // 风往哪吹（往下，略偏右）
  const vec2 WC = vec2(0.9902, 0.14);    // 横着风的方向
  const float LD = 1.25, FC = 0.72;       // 一道沙丘多宽（顺风方向）；坡顶在一道沙丘的哪儿（前面是迎风坡，后面是背风坡）
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
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
    float off = 0.12 * sin(c * 1.5 + 0.6) + 0.05 * sin(c * 3.7 + 2.0) + 0.22 * (vnoise(vec2(c * 0.7, 3.7)) - 0.5);
    return (a + off) / LD;
  }
  float duneH(vec2 p, float s) {
    float amp = 0.13 * (0.7 + 0.6 * vnoise(vec2(dot(p, WC) * 0.8, s * 0.7 + 11.0)));
    return amp * profile(fract(s), FC);
  }
  // 沙纹：顺风方向上第几道，弯一点，一圈往下风挪一道
  float rippleP(vec2 p) {
    float a = dot(p, WD) / uRip, c = dot(p, WC) / uRip;
    float w = 0.6 * sin(c * 0.33 + 1.3) + 1.4 * (vnoise(vec2(c * 0.15, a * 0.1)) - 0.5) + 0.35 * (vnoise(vec2(c * 0.45, a * 0.3) + 7.0) - 0.5);
    return a + w - uU;
  }
  // 沙纹长在哪儿：迎风坡和洼地里有，坡顶到背风坡没有（太陡，沙一直在往下滑）；沟里被抹掉的地方也没有
  float rippleMask(float f, float erase) {
    return (1.0 - smoothstep(FC - 0.1, FC - 0.02, f)) * smoothstep(0.0, 0.08, f) * (1.0 - erase);
  }
  // 沙纹的高度
  float rippleH(vec2 p, float erase) {
    return uRip * 0.09 * profile(fract(rippleP(p)), 0.68) * rippleMask(fract(duneS(p)), erase);
  }
  // 沙堆：倒下去 0.45 秒堆起来，一秒后风开始吹，顺风挪、拉长、矮下去
  // h、g 是高度和坡度；edge 是离沙堆的底边多远（沿着坡往外量），tan 是底边在这儿的走向
  void pile(vec4 P, vec2 p, out float h, out vec2 g, out float blow, out vec2 cen, out float edge, out vec2 tan) {
    float a = P.z, grow = smoothstep(0.0, 0.45, a);
    blow = smoothstep(1.0, ${f}.0, a);
    cen = P.xy + WD * uPile * 1.4 * blow;
    float sa = 1.0 + 1.3 * blow, R = uPile * (0.55 + 0.45 * grow), Hc = 0.62 * R * grow * (1.0 - blow);
    vec2 q = p - cen;
    float qa = dot(q, WD) / sa, qc = dot(q, WC), k = 0.12 * R;
    float rr = sqrt(qa * qa + qc * qc + k * k), r = rr - k;   // 顶上圆一点
    h = Hc * max(0.0, 1.0 - r / R);
    vec2 dr = (qa * WD / sa + qc * WC) / rr;   // r 往哪个方向长得最快
    g = r < R ? -Hc / R * dr : vec2(0.0);
    edge = abs(r - R) / max(length(dr), 1e-3);
    tan = normalize(vec2(-dr.y, dr.x) + 1e-6);
  }
  float pilesH(vec2 p) {
    float h = 0.0, ph, bl, ed; vec2 pg, cn, tn;
    for (int i = 0; i < ${d}; i++) {
      if (float(i) >= uTapN) break;
      pile(uTap[i], p, ph, pg, bl, cn, ed, tn);
      h += ph;
    }
    return h;
  }
  // 到一段线段的距离，t 是落在线段上哪儿（0 到 1）
  float seg(vec2 p, vec2 a, vec2 b, out float t) {
    vec2 ab = b - a; float l2 = dot(ab, ab);
    t = l2 > 1e-10 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
    return length(p - a - ab * t);
  }
  void main() {
    vec2 p = (vUv - 0.5) * uView;
    float a = dot(p, WD), c = dot(p, WC);

    // 沟：找对这一点影响最大的那一段（新的、近的），沟按噪声抖一抖，边是参差的
    vec2 pj = p + uGroove * 0.5 * (vec2(vnoise(p / uGroove * 0.6 + 1.7), vnoise(p / uGroove * 0.6 + 9.2)) - 0.5);
    float best = 0.0, gd = 1e3, gamp = 0.0, gw = uGroove;
    vec2 gc = p, gdir = WC;
    for (int i = 0; i < ${l}; i++) {
      if (float(i) >= uTrailN) break;
      vec4 B = uTrail[i], A = (i == 0 || B.w > 0.5) ? B : uTrail[max(i - 1, 0)];
      float t, d = seg(pj, A.xy, B.xy, t), ag = mix(A.z, B.z, t);
      float fill = smoothstep(0.8, ${u}.0, ag), amp = 1.0 - fill, w = uGroove * (1.0 + 0.6 * fill);
      float score = amp * exp(-d * d / (9.0 * w * w));
      if (score > best) {
        best = score; gd = d; gamp = amp; gw = w; gc = mix(A.xy, B.xy, t);
        vec2 ab = B.xy - A.xy;
        if (dot(ab, ab) > 1e-10) gdir = normalize(ab);
      }
    }
    // 沟的横截面：中间凹下去，两边各堆起一道沙埂。高度连同坡度一起算
    float D = 0.9 * uGroove, Bh = 0.35 * D, db = 1.75 * gw, wb = 0.65 * gw;
    float e1 = exp(-gd * gd / (gw * gw)), x2 = (gd - db) / wb, e2 = exp(-x2 * x2);
    float gh = gamp * (-D * e1 + Bh * e2);
    vec2 rdir = gd > 1e-6 ? (pj - gc) / gd : vec2(0.0);
    vec2 ggrad = gamp * (D * 2.0 * gd / (gw * gw) * e1 - Bh * 2.0 * x2 / wb * e2) * rdir;
    float erase = gamp * exp(-gd * gd / (4.0 * gw * gw));   // 沟和沙埂上没有沙纹，填平了再长回来

    // 沙堆
    float ph = 0.0, spray = 0.0, rim = 0.0;
    vec2 pg = vec2(0.0), rimDir = WC;
    vec2 cid = floor(gl_FragCoord.xy * 0.5);   // 这一点落在屏幕上哪一格（底稿一格两个像素）：一格里取同一个随机数
    for (int i = 0; i < ${d}; i++) {
      if (float(i) >= uTapN) break;
      vec4 P = uTap[i];
      float hh, bl, ed; vec2 gg, cen, tn;
      pile(P, p, hh, gg, bl, cen, ed, tn);
      ph += hh; pg += gg;
      // 沙堆的底边描一圈线，风吹的时候跟着拉长、变淡
      float rm = smoothstep(0.1, 0.4, P.z) * (1.0 - smoothstep(0.3, 0.8, bl)) * (1.0 - smoothstep(uCellW * 0.3, uCellW * 0.65, ed));
      if (rm > rim) { rim = rm; rimDir = tn; }
      erase = max(erase, clamp(hh / (0.05 * uPile), 0.0, 1.0));   // 沙堆盖住的地方没有沙纹
      vec2 q = p - P.xy;
      float r = length(q), ag = P.z;
      // 倒下来的沙粒：头 0.6 秒里落点一圈闪着亮的沙
      float fall = (1.0 - smoothstep(0.3, 0.7, ag)) * (1.0 - smoothstep(uPile * 0.6, uPile * 1.3, r));
      spray = max(spray, fall * step(0.6, h21(cid + floor(ag * 24.0) * 7.13 + P.w * 50.0)));
      // 被风吹散：顺风拖出一道沙尾，一缕一缕往下风走
      vec2 qc = p - cen;
      float down = dot(qc, WD), side = dot(qc, WC);
      float tail = smoothstep(-0.3 * uPile, 0.2 * uPile, down) * (1.0 - smoothstep(uPile, uPile * 4.0, down)) * exp(-side * side / (uPile * uPile * 0.5));
      float wisp = smoothstep(0.45, 0.8, vnoise(vec2(down / uPile * 1.5 - ag * 6.0, side / uPile * 4.0) + P.w * 13.0));
      spray = max(spray, tail * wisp * smoothstep(0.0, 0.25, bl) * (1.0 - smoothstep(0.6, 1.0, bl)));
    }
    // 沙面：沙丘 + 沙纹，坡度用差分算。打光时沙丘的坡度放大一些，起伏才看得出来（影子还按真的高度算）
    float e = 2.0 * uPx;
    float hd = duneH(p, duneS(p)), hr = rippleH(p, erase);
    vec2 dx = p + vec2(e, 0.0), dy = p + vec2(0.0, e);
    vec2 grad = uRelief * vec2(duneH(dx, duneS(dx)) - hd, duneH(dy, duneS(dy)) - hd) / e
              + vec2(rippleH(dx, erase) - hr, rippleH(dy, erase) - hr) / e;
    float h0 = hd + hr;
    grad += ggrad + 1.5 * pg;   // 沙堆也放大一点坡度，明暗两面分得开

    // 光：低低的太阳，漫射，加一点天光；往太阳那边走几步，看沙丘、沙堆挡没挡住（软一点的影子）
    vec3 n = normalize(vec3(-grad, 1.0));
    float dif = max(dot(n, uSun), 0.0);
    vec2 sh2 = normalize(uSun.xy);
    float tanEl = uSun.z / length(uSun.xy), sh = 1.0;
    float hs0 = duneH(p, duneS(p)) + ph;
    for (int i = 1; i <= 14; i++) {
      float t = float(i) * 0.04;
      vec2 q = p + sh2 * t;
      float hq = duneH(q, duneS(q)) + (uTapN > 0.0 ? pilesH(q) : 0.0);
      sh = min(sh, clamp((hs0 + t * tanEl - hq) * 14.0 / t + 0.5, 0.0, 1.0));
    }
    float lum = 0.1 + 0.1 * n.z + 0.75 * dif * mix(0.25, 1.0, sh);

    // 风从坡顶扬起一缕缕沙，顺着风往下飘，落在背风坡上
    float s = duneS(p), f = fract(s);
    float crest = smoothstep(FC - 0.05, FC, f) * (1.0 - smoothstep(FC + 0.03, FC + 0.16, f));
    float wn = vnoiseP(vec2(a * 2.2 - uU * 8.0, c * 11.0), 8.0);
    spray = max(spray, crest * smoothstep(0.55, 0.85, wn) * 0.9);

    // 线：沙纹的脊、沙丘的棱、沟两边的沙埂，记下走向
    float er = 0.5 * uPx;
    float rp = rippleP(p);
    vec2 rg = vec2(rippleP(p + vec2(er, 0.0)) - rp, rippleP(p + vec2(0.0, er)) - rp) / er;
    float dr = abs(fract(rp - 0.68 + 0.5) - 0.5) / max(length(rg), 1e-3);
    // 沙纹的脊只在一片一片的地方画成线（全画上像一张横格纸，压过了沙丘的明暗），别处只靠明暗；线比旁边暗一点（脊后面那一小条背着光）
    float patchy = smoothstep(0.58, 0.72, vnoise(p / uRip * 0.22 + 4.1));
    float line = (1.0 - smoothstep(uCellW * 0.28, uCellW * 0.6, dr)) * rippleMask(f, erase) * patchy;
    vec2 dir = normalize(vec2(-rg.y, rg.x));
    lum *= 1.0 - 0.3 * line;   // 沙纹的脊画成比旁边暗一点的细线（脊后面那一小条背着光），不抢沙丘的明暗
    vec2 sg = vec2(duneS(p + vec2(er, 0.0)) - s, duneS(p + vec2(0.0, er)) - s) / er;
    float dbk = abs(f - FC) / max(length(sg), 1e-3);
    float brink = (1.0 - smoothstep(uCellW * 0.3, uCellW * 0.7, dbk)) * (1.0 - erase);
    if (brink > line) { line = brink; dir = normalize(vec2(-sg.y, sg.x)); }
    lum = max(lum, 0.92 * brink);   // 棱最先迎着光，最亮
    // 背风坡上一道道往下流的沙（顺着坡往下的细线），疏一点
    float slip = smoothstep(FC + 0.01, FC + 0.04, f) * (1.0 - smoothstep(0.9, 0.98, f)) * (1.0 - erase);
    float flow = slip * smoothstep(0.62, 0.8, vnoise(vec2(c / uCellW * 0.55, a * 3.0 + 5.0))) * 0.8;
    if (flow > line) { line = flow; dir = WD; }
    if (rim > line) { line = rim; dir = rimDir; }
    float berm = gamp * (1.0 - smoothstep(uCellW * 0.3, uCellW * 0.65, abs(gd - db)));
    if (berm > line) { line = berm; dir = gdir; }
    vec2 t2 = vec2(dir.x * dir.x - dir.y * dir.y, 2.0 * dir.x * dir.y) * line;
    o = vec4(clamp(lum, 0.0, 1.0), clamp(spray, 0.0, 1.0), t2 * 0.5 + 0.5);
  }
`,re=`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uSand, uAtlas;
  uniform vec2 uRes, uCells;        // 画布（设备像素）；底稿有几列几行格子（比画布多出不到一格）
  uniform float uCell, uLod, uN;    // 一格多少设备像素、取平均用的 mipmap 层（底稿一格两个像素，第 1 层正好一格一个）、图集里有几个字
  uniform vec2 uRange;              // 沙面的亮度从 x 到 y 铺满由淡到浓的字
  uniform float uDark;              // 深色主题：越亮越浓；浅色主题反过来
  uniform vec3 uC0, uC1, uC2, uC3;  // 沙面的色带
  uniform vec3 uSpray;              // 扬起来的沙
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) / uCells;
    vec4 s = textureLod(uSand, vec2(c0.x, 1.0 - c0.y), uLod);
    float r1 = hash(cell);
    vec2 t2 = s.ba * 2.0 - 1.0;
    float m = length(t2), spray = s.g;
    float nf = uN - ${h}.0;
    // 沙面的亮度换成由淡到浓：深色主题越亮越浓，浅色主题越暗越浓；抖一点，但不能抖出这一段（会挑到前面的线）
    float lv = clamp((s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.08, 0.0, 0.999);
    if (uDark < 0.5) lv = 0.999 - lv;
    float gi; vec3 col = ramp(lv);
    if (spray > 0.3 && m < 0.5) {
      // 扬起来的沙：. : * 由少到多，换一个颜色
      float k = clamp((spray - 0.3) / 0.6, 0.0, 0.999);
      gi = ${h}.0 + (k < 0.4 ? 0.0 : k < 0.75 ? 2.0 : 5.0);
      col = mix(col, uSpray, 0.55 + 0.45 * k);
    } else if (m > 0.3) {
      // 沙纹的脊、沙丘的棱、沙埂：按走向挑 ~ \\ | /（沙上 y 朝上：往右上走的是 /）；颜色跟着这里的明暗走，
      // 沙纹跟旁边的沙一样亮，只是换成顺着走向的字；棱在底稿里就是最亮的，自己会跳出来
      float phi = 0.5 * atan(t2.y, t2.x);
      gi = abs(phi) < 0.3927 ? 0.0 : abs(phi) > 1.1781 ? 2.0 : phi > 0.0 ? 3.0 : 1.0;
    } else {
      gi = ${h}.0 + floor(lv * nf);
    }
    vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
    float ink = 0.0;
    // 图集按一格的大小取 mipmap 层：自动挑层的话，格子交界处相邻两个像素取的字隔得老远，会挑到最糊的一层，每行之间多出一道灰线
    if (abs(loc.x) < 0.5 && abs(loc.y) < 0.5) ink = textureLod(uAtlas, vec2((gi + loc.x + 0.5) / uN, 0.5 - loc.y), log2(${g}.0 / uCell)).r;
    o = vec4(col * ink, ink);   // 预乘过的透明度：字以外是透明的
  }
`;function v(e,{period:t=12e3,cell:c=8,fps:h=30}={}){let g=i(e),v=n(g),y=matchMedia(`(prefers-reduced-motion: reduce)`),b=y.matches||v,x=o(g),ie=r(g,_,ne),S=r(g,_,re),C=[],ae=new Float32Array(256),w=[],T=new Float32Array(24),E=null,D=1,O=1,k=300,A=[1,1],j=document.createElement(`canvas`);te(j);let M=s(g,j),N=0,P=0,F=1,I=0,L=!0,R=-1e9,z=!1,B=!1;function V(){B=getComputedStyle(e).colorScheme.includes(`dark`)}function H(){N=e.clientWidth,P=e.clientHeight,N&&P&&(F=Math.min(2,window.devicePixelRatio||1),e.width=Math.round(N*F),e.height=Math.round(P*F),D=Math.ceil(N/c),O=Math.ceil(P/c),k=Math.min(300,Math.max(120,Math.min(N,P)*.42)),A=[D*c/k,O*c/k],E?.dispose(),E=a(g,D*2,O*2,{mipmaps:!0}),V(),$(!0))}let U=(e,t)=>[(e/(D*c)-.5)*A[0],(.5-t/(O*c))*A[1]],W=null,G=0,K=0,q=-1e9;function J(e){C.push(e),C.length>l&&p(C)}function oe(e,t,n){let[r,i]=U(e,t);!W||n-W.t>250?(W={x:r,y:i,t:n,start:!0},J(W),G=e,K=t,q=n):Math.hypot(e-G,t-K)>=28||n-q>=90||C[C.length-1]!==W||W.start?(W={x:r,y:i,t:n,start:!1},J(W),G=e,K=t,q=n):Object.assign(W,{x:r,y:i,t:n}),$(!0)}function Y(e,t,n){let[r,i]=U(e,t);W&&W.start&&C[C.length-1]===W&&C.pop(),w.push({x:r,y:i,t:n,seed:Math.random()}),w.length>d&&w.shift(),W=null,$(!0)}let X=t=>{let n=e.getBoundingClientRect();return[t.clientX-n.left,t.clientY-n.top]},se=e=>{if(b||!N)return;let[t,n]=X(e);oe(t,n,performance.now())},ce=e=>{if(b||!N)return;let[t,n]=X(e);Y(t,n,performance.now())},le=()=>{W=null};e.addEventListener(`pointermove`,se),e.addEventListener(`pointerdown`,ce),e.addEventListener(`pointerleave`,le);let Z=.36,ue=[Math.cos(Z)*Math.cos(2),Math.cos(Z)*Math.sin(2),Math.sin(Z)];function de(n){if(I=0,z||!N||!E)return;for(;C.length&&(n-C[0].t)/1e3>=u;)C.shift();for(C.length||(W=null),C.forEach((e,t)=>ae.set([e.x,e.y,Math.max(0,(n-e.t)/1e3),t===0||e.start?1:0],t*4));w.length&&(n-w[0].t)/1e3>=f;)w.shift();w.forEach((e,t)=>T.set([e.x,e.y,Math.max(0,(n-e.t)/1e3),e.seed],t*4));let r=C.length>0||w.length>0;if(!b&&!r&&n-R<1e3/h-2){Q();return}R=n;let i=b?0:(n%t+t)%t/t;E.bind(),ie.use({uView:A,uU:i,uPx:1/k,uCellW:c/k,uRip:40/k,uGroove:13/k,uPile:46/k,uSun:ue,uRelief:2.2,uTrail:ae,uTrailN:C.length,uTap:T,uTapN:w.length}),x.draw(),E.mip(),g.bindFramebuffer(g.FRAMEBUFFER,null),g.viewport(0,0,e.width,e.height),g.clearColor(0,0,0,0),g.clear(g.COLOR_BUFFER_BIT);let a=ee[B?`dark`:`light`];S.use({uSand:[E.tex,0],uAtlas:[M.tex,1],uRes:[e.width,e.height],uCells:[D,O],uCell:c*F,uLod:1,uN:m.length,uRange:a.range,uDark:+!!B,uC0:a.sand[0],uC1:a.sand[1],uC2:a.sand[2],uC3:a.sand[3],uSpray:a.spray}),x.draw(),(!b||r)&&Q()}function Q(){!I&&!z&&L&&!document.hidden&&(I=requestAnimationFrame(de))}function $(e=!1){e&&(R=-1e9),Q()}let fe=new IntersectionObserver(([e])=>{L=e.isIntersecting,L&&$(!0)});fe.observe(e);let pe=new ResizeObserver(()=>H());pe.observe(e);let me=()=>{document.hidden||$(!0)};document.addEventListener(`visibilitychange`,me);let he=()=>{b=y.matches||v,$(!0)};return y.addEventListener(`change`,he),document.fonts?.load(`500 50px "DM Mono"`).then(()=>{z||(te(j),M.update(),$(!0))},()=>{}),H(),{pour(){!b&&N&&Y(N*(.25+Math.random()*.5),P*(.25+Math.random()*.5),performance.now())},refresh(){V(),$(!0)},destroy(){z=!0,cancelAnimationFrame(I),I=0,fe.disconnect(),pe.disconnect(),e.removeEventListener(`pointermove`,se),e.removeEventListener(`pointerdown`,ce),e.removeEventListener(`pointerleave`,le),document.removeEventListener(`visibilitychange`,me),y.removeEventListener(`change`,he),E?.dispose(),M.dispose(),x.dispose(),ie.dispose(),S.dispose()}}}var y=t();function b(){let e=(0,c.useRef)(null),t=(0,c.useRef)(null),[n,r]=(0,c.useState)(!1);return(0,c.useEffect)(()=>{let n;try{n=v(e.current,{period:12e3})}catch{r(!0);return}t.current=n;let i=()=>n.refresh(),a=new MutationObserver(i);a.observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]});let o=matchMedia(`(prefers-color-scheme: dark)`);return o.addEventListener(`change`,i),()=>{a.disconnect(),o.removeEventListener(`change`,i),n.destroy(),t.current=null}},[]),(0,y.jsxs)(`div`,{className:`lab-root ascii-sand`,children:[(0,y.jsx)(`canvas`,{className:`wall`,ref:e,tabIndex:0,role:`img`,onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),t.current?.pour())},"aria-label":`Sand dunes with wind ripples, seen from above and drawn entirely in ASCII characters. Press Enter to pour a handful of sand.`}),n&&(0,y.jsx)(`p`,{className:`fallback`,children:`This experiment needs WebGL 2`}),(0,y.jsxs)(`p`,{className:`lab-hint`,children:[(0,y.jsx)(`span`,{className:`for-mouse`,children:`Sweep across the sand to carve a groove`}),(0,y.jsx)(`span`,{className:`for-touch`,children:`Tap or swipe across the sand`})]})]})}export{b as default};