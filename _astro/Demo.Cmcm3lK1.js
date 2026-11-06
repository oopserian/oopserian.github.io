import{t as e}from"./react.CadLv9_P.js";import{t}from"./jsx-runtime.C2DLLpjJ.js";import{a as n,i as r,n as i,o as a,r as o,t as s}from"./gl.B6Qi3-Xr.js";var c=e(),l=Math.PI*2,u=64,d=4,f=6,p=4;function m(e){let t=0,n=1/0;for(let r=1;r<e.length-1;r++){if(e[r].start||e[r+1].start)continue;let i=e[r-1],a=e[r],o=e[r+1],s=Math.abs((a.x-i.x)*(o.y-i.y)-(a.y-i.y)*(o.x-i.x));s<n&&(n=s,t=r)}e.splice(t,1)}var ee={dark:{stone:[[.12,.13,.17],[.28,.31,.39],[.56,.6,.7],[.88,.91,.97]],glow:[[.25,.5,.95],[.82,.94,1]],glint:[1,1,1],range:[.04,.5],gamma:.6,dense:1.4,fog:0},light:{stone:[[.62,.64,.69],[.4,.42,.48],[.19,.2,.24],[.04,.04,.06]],glow:[[.15,.25,.85],[.03,.07,.5]],glint:[.04,.04,.06],range:[.04,.5],gamma:.8,dense:1,fog:1}},te={S:.6,GAP:.03,RIM:4,HA:.6,HF:.16,CAM_H:3.4,PITCH:42,FOG0:7,FOGD:9,KEY_EL:.5,KEY_SWING:1.1,AMB:.04,FILL:.15,KD:.35,KE:.45,KS:1,KP:50,LAMP:.8,LAMP_H:1.3,LAMP_F:2.5,GA:1,GT:.64,GF:.55,GLOW_UP:.6,HOT:.92,GLINT:.8,FLAT0:.2,DIRLOD:2},h=40,g=80,_=e=>Number(e).toFixed(5),v=e=>`
  const float S = ${_(e.S)}, GAP = ${_(e.GAP)}, RIM = ${_(e.RIM)}, HA = ${_(e.HA)}, HF = ${_(e.HF)};
  const float YMAX = ${_(1.2*e.S+.5*e.HA+.02)}, YMIN = ${_(-.35*e.S-.5*e.HA-.05)};
  uint ih(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
  uint hu(vec2 c, uint k) { ivec2 i = ivec2(floor(c)); return ih(uint(i.x) * 1597334673u ^ uint(i.y) * 3812015801u ^ k * 2654435769u); }
  float hh(vec2 c, uint k) { return float(hu(c, k)) * (1.0 / 4294967295.0); }
  // 每块煤的中心在自己那一格里的位置：一个哈希拆成两半用
  vec2 site(vec2 c) { uint n = hu(c, 0u); return 0.14 + 0.72 * vec2(float(n & 0xffffu), float(n >> 16u)) / 65535.0; }
  // 值噪声，连同坡度一起算
  vec3 vnoised(vec2 x, uint k) {
    vec2 i = floor(x), fr = fract(x);
    vec2 u = fr * fr * (3.0 - 2.0 * fr), du = 6.0 * fr * (1.0 - fr);
    float a = hh(i, k), b = hh(i + vec2(1.0, 0.0), k), c = hh(i + vec2(0.0, 1.0), k), d = hh(i + vec2(1.0, 1.0), k);
    return vec3(a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y, du * (vec2(b - a, c - a) + (a - b - c + d) * u.yx));
  }
  // 整床的起伏
  vec3 heap(vec2 p) { vec3 n = vnoised(p * HF + 2.0, 1u); return vec3(HA * (n.x - 0.5), HA * HF * n.yz); }
  // 值和坡度一起算：x 是高度，yz 是坡度。平滑地取小（面和面之间是一道圆一点的棱，不是刀刃）
  vec3 smin3(vec3 a, vec3 b, float k) {
    float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
    return vec3(mix(b.x, a.x, h) - k * h * (1.0 - h), mix(b.yz, a.yz, h));
  }
  // 离这一点最近的那块煤：q 是这一点减块中心，id 是块的编号；ed 是离块边多远，en 是朝那条边的方向（Inigo Quilez 的两遍法）
  void voro(vec2 x, out vec2 q, out vec2 id, out float ed, out vec2 en) {
    vec2 n = floor(x), fr = fract(x), mg = vec2(0.0), mr = vec2(0.0);
    float md = 8.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j)), r = g + site(n + g) - fr;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
    ed = 8.0; en = vec2(1.0, 0.0);
    for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j)), r = g + site(n + g) - fr;
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
    vec3 h = vec3(1.0 + 0.2 * hh(id, 1u) - 0.5 * dot(q, q), -q);
    float a0 = hh(id, 2u) * 6.2831853;
    for (int k = 0; k < 5; k++) {
      uint uk = uint(k);
      float a = a0 + float(k) * 1.2566371 + (hh(id, 3u + uk) - 0.5) * 0.9;
      vec2 d = vec2(cos(a), sin(a));
      float sl = 0.75 + 0.7 * hh(id, 8u + uk);                // 这一面有多斜
      vec2 c = q - d * (0.1 + 0.2 * hh(id, 13u + uk));        // 凹下去的那个碗的中心
      float bowl = 1.5 + 1.1 * hh(id, 18u + uk);
      h = smin3(h, vec3(0.96 - sl * dot(q, d) + bowl * dot(c, c), -sl * d + 2.0 * bowl * c), 0.045);
    }
    return h;
  }
  // 煤床：块本身，边沿陡陡地落进缝里（缝底在 -0.35），再垫上整床的起伏。hr 是块本身的高度（没乘、没垫）
  vec3 bed(vec2 p, out vec2 id, out float ed, out vec2 en, out float hr) {
    vec2 q;
    voro(p, q, id, ed, en);
    vec3 h = chunk(q, id);
    float e = max(ed - GAP, 0.0);
    h = smin3(h, vec3(-0.35 + RIM * e, e > 0.0 ? -RIM * en : vec2(0.0)), 0.08);
    hr = h.x;
    return h * S + heap(p);
  }
  // 便宜的上界：只找最近、次近的两块，穹顶不削面，边沿按到这两块中线的距离算（不会比真的近）。光线先按它走
  float bound(vec2 p) {
    vec2 n = floor(p), fr = fract(p), r1 = vec2(0.0), r2 = vec2(1.0);
    float d1 = 8.0, d2 = 9.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j)), r = g + site(n + g) - fr;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; r2 = r1; d1 = d; r1 = r; } else if (d < d2) { d2 = d; r2 = r; }
    }
    float ed = (d2 - d1) / (2.0 * length(r2 - r1));
    return S * min(1.2 - 0.5 * d1, -0.35 + RIM * max(ed - GAP, 0.0)) + heap(p).x;
  }
`,y=[`-`,`=`,`.`,`:`,`*`,`o`,`@`],b=2,x=64;function ne(e){let t=e.getContext(`2d`);e.width=x*y.length,e.height=x,t.clearRect(0,0,e.width,e.height),t.fillStyle=t.strokeStyle=`#fff`,t.lineJoin=`round`,t.textAlign=`left`,t.textBaseline=`alphabetic`,t.font=`500 50px "DM Mono", ui-monospace, monospace`,y.forEach((e,n)=>{let r=t.measureText(e),i=r.actualBoundingBoxLeft,a=r.actualBoundingBoxRight,o=r.actualBoundingBoxAscent,s=r.actualBoundingBoxDescent,c=n<b?Math.max(1,Math.min(1.8,.84*x/(i+a))):1;t.save(),t.translate(n*x+x/2,x/2),t.scale(c,1);let l=-(a-i)/2,u=(o-s)/2;t.lineWidth=n<b?4.5:3,t.fillText(e,l,u),t.strokeText(e,l,u),t.restore()})}var S=`
  in vec2 position; out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,C=`
  uniform vec3 uCamR, uCamU, uCamF;   // 镜头往右、往上、往前
  uniform vec2 uTan;                  // 画面右边沿、上边沿的 tan
  uniform float uCamH;                // 镜头多高（窄的画面镜头抬高一点，煤块不至于太大）
  #define RO vec3(0.0, uCamH, 0.0)
`,re=e=>`
  precision highp float;
  in vec2 vUv; out vec4 o;
  ${C}
  ${v(e)}
  float fullH(vec2 p) { vec2 id, en; float ed, hr; return bed(p, id, ed, en, hr).x; }
  vec2 enc(float v) { float u = floor(clamp(v, 0.0, 1.0) * 65535.0 + 0.5), hi = floor(u / 256.0); return vec2(hi, u - hi * 256.0) / 255.0; }
  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 rd = normalize(uCamF + ndc.x * uTan.x * uCamR + ndc.y * uTan.y * uCamU);
    float dy = -rd.y, hz = length(rd.xz);
    if (dy < 0.01) { o = vec4(1.0); return; }
    // 从煤床最高处那层开始走；先按便宜的上界走到它跟前，再按真的高度走，最后在一上一下两点之间二分
    float t = (RO.y - YMAX) / dy, tEnd = (RO.y - YMIN) / dy, ta = t, tb = -1.0;
    float k1 = 0.9 / (dy + hz), k2 = 0.8 / (dy + 2.0 * hz);
    for (int i = 0; i < 64; i++) {
      vec3 q = RO + rd * t;
      float d = q.y - bound(q.xz);
      if (d < 0.0) break;
      ta = t;
      if (d < 0.003 || t > tEnd) break;
      t += max(d * k1, 0.004);
    }
    t = ta;
    for (int i = 0; i < 40; i++) {
      vec3 q = RO + rd * t;
      float d = q.y - fullH(q.xz);
      if (d < 0.0) { tb = t; break; }
      ta = t;
      if (t > tEnd) break;
      t += max(d * k2, 0.003);
    }
    if (tb < 0.0) tb = t;
    for (int i = 0; i < 6; i++) {
      float tm = 0.5 * (ta + tb);
      vec3 q = RO + rd * tm;
      if (q.y < fullH(q.xz)) tb = tm; else ta = tm;
    }
    vec3 P = RO + rd * (0.5 * (ta + tb));
    o = vec4(enc((P.x + ${h}.0) / 80.0), enc((P.z + ${g}.0) / ${g}.0));
  }
`,ie=e=>`
  precision highp float;
  in vec2 vUv; out vec4 o;
  ${C}
  uniform sampler2D uGeo;
  uniform float uU, uFoot, uFogL;     // 一圈里走到哪（0 到 1）；底稿一个像素在 1 远的地方有多宽；远处暗到哪个亮度
  uniform vec3 uKey;                  // 主光的方向
  uniform vec3 uPtr;                  // 鼠标那盏灯：x、z、亮度
  uniform vec4 uTrail[${u}];      // 划过的点，由旧到新：x、z、过了几秒、是不是一笔的开头
  uniform float uTrailN;
  uniform vec4 uTap[${f}];         // 裂开的地方：x、z、过了几秒、随机数
  uniform float uTapN;
  ${v(e)}
  float dec(vec2 hl) { vec2 b = floor(hl * 255.0 + 0.5); return (b.x * 256.0 + b.y) / 65535.0; }
  float h21(vec2 p) { return hh(p, 7u); }
  float vnoise(vec2 x) { return vnoised(x, 5u).x; }
  // 到一段线段的距离，t 是落在线段上哪儿（0 到 1）
  float seg(vec2 p, vec2 a, vec2 b, out float t) {
    vec2 ab = b - a; float l2 = dot(ab, ab);
    t = l2 > 1e-8 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
    return length(p - a - ab * t);
  }
  // 地面上一个方向 T（x、z）在 P 点投到画面上朝哪（y 朝下），存成二倍角
  vec2 screenDir(vec3 P, vec2 Tg) {
    vec3 d = P - RO, t3 = vec3(Tg.x, 0.0, Tg.y);
    float z = dot(d, uCamF), sx = dot(d, uCamR) / z, sy = dot(d, uCamU) / z;
    vec2 v = vec2((dot(t3, uCamR) - sx * dot(t3, uCamF)) / uTan.x, -(dot(t3, uCamU) - sy * dot(t3, uCamF)) / uTan.y);
    float m2 = dot(v, v);
    return m2 > 1e-14 ? vec2(v.x * v.x - v.y * v.y, 2.0 * v.x * v.y) / m2 : vec2(0.0);
  }
  void main() {
    vec4 g = texelFetch(uGeo, ivec2(gl_FragCoord.xy), 0);
    if (all(greaterThan(g, vec4(0.999)))) { o = vec4(uFogL, 0.0, 0.5, 0.5); return; }
    vec2 x = vec2(dec(g.xy) * 80.0 - ${h}.0, dec(g.zw) * ${g}.0 - ${g}.0);
    vec2 id, en; float ed, hr;
    vec3 h = bed(x, id, ed, en, hr);
    vec3 P = vec3(x.x, h.x, x.y), dv = P - RO;
    float dist = length(dv);
    vec3 rd = dv / dist;
    float cw = 2.0 * dist * uFoot;   // 一格字在这儿的煤上多宽（底稿一格两个像素）

    // 裂纹：每处裂开的地方往外裂 3 到 5 道，方向随机（不是均匀分开的星星），0.2 秒里裂到头；
    // 每道走三段、每段拐一下，越往外越细，第二段起头分一个小岔；裂纹再按噪声抖一抖，是参差的
    float crack = 0.0, cglow = 0.0, flash = 0.0;
    vec2 cdir = vec2(1.0, 0.0);
    for (int i = 0; i < ${f}; i++) {
      if (float(i) >= uTapN) break;
      vec4 Pt = uTap[i];
      vec2 r = x - Pt.xy;
      if (Pt.z > ${p}.0 || dot(r, r) > 3.0) continue;
      vec2 xr = r + 0.035 * (vec2(vnoise(x * 9.0 + Pt.w * 31.0), vnoise(x * 9.0 - Pt.w * 17.0 + 3.3)) - 0.5);
      float grow = smoothstep(0.0, 0.2, Pt.z), heal = 1.0 - smoothstep(${p}.0 - 1.6, ${p}.0, Pt.z);
      int K = 3 + int(h21(vec2(Pt.w * 97.0, 1.0)) * 2.99);
      float cm = 0.0;
      for (int k = 0; k < 6; k++) {
        if (k >= K) break;
        float fk = float(k);
        float an = Pt.w * 6.2831853 + (fk + 0.75 * (h21(vec2(Pt.w * 911.0, fk)) - 0.5)) * 6.2831853 / float(K);
        float Lk = 0.5 + 0.6 * h21(vec2(fk + 20.0, Pt.w * 313.0));
        vec2 a = vec2(0.0);
        for (int j = 0; j < 3; j++) {
          float fj = float(j), pj = clamp(grow * 3.0 - fj, 0.0, 1.0);   // 一段一段往外裂
          if (pj <= 0.0) break;
          float aj = an + (h21(vec2(fk * 3.0 + fj + 40.0, Pt.w * 531.0)) - 0.5) * 1.2;
          vec2 dj = vec2(cos(aj), sin(aj)), b = a + dj * Lk / 3.0 * (0.7 + 0.6 * h21(vec2(fj + 60.0, fk + Pt.w * 777.0))) * pj;
          float t, dd = seg(xr, a, b, t);
          float w = cw * mix(0.9, 0.4, (fj + t) / 3.0);
          float m = 1.0 - smoothstep(w, w + cw * 0.45, dd);
          if (m > cm) { cm = m; cdir = dj; }
          if (j == 1) {
            float sb = h21(vec2(fk + 80.0, Pt.w * 151.0)) > 0.5 ? 0.85 : -0.85;
            vec2 bd = vec2(cos(aj + sb), sin(aj + sb));
            float db = seg(xr, a, a + bd * Lk * 0.3 * pj, t);
            float mb = 1.0 - smoothstep(cw * 0.35, cw * 0.75, db);
            if (mb > cm) { cm = mb; cdir = bd; }
          }
          a = b;
        }
      }
      cm *= heal;
      crack = max(crack, cm);
      cglow += cm * (0.6 + 1.2 * exp(-Pt.z / 1.2));
      flash += exp(-dot(r, r) / (0.015 + 0.2 * Pt.z)) * exp(-Pt.z / 0.35);
    }
    // 划过：顺着划的路裂开一道参差的裂纹，里面亮着蓝光，四秒里从老的那头合上；
    // 附近的缝也亮起来，光顺着缝往外渗，越老渗得越远、越暗
    float seep = 0.0;
    vec2 xj = x + 0.07 * (vec2(vnoise(x * 5.0 + 1.7), vnoise(x * 5.0 + 9.2)) - 0.5);
    for (int i = 0; i < ${u}; i++) {
      if (float(i) >= uTrailN) break;
      vec4 B = uTrail[i], A = (i == 0 || B.w > 0.5) ? B : uTrail[max(i - 1, 0)];
      float t, d = seg(x, A.xy, B.xy, t), a = mix(A.z, B.z, t);
      float fade = 1.0 - smoothstep(${d}.0 - 1.5, ${d}.0, a);
      float reach = 0.2 + 0.55 * pow(a, 0.7);
      seep = max(seep, 0.8 * exp(-d * d / (reach * reach)) * exp(-a / 1.6) * smoothstep(0.0, 0.05, a) * fade);
      vec2 ab = B.xy - A.xy;
      if (dot(ab, ab) > 1e-6) {
        float tj, dj = seg(xj, A.xy, B.xy, tj), aj = mix(A.z, B.z, tj);
        float w = cw * 0.6;
        float m = (1.0 - smoothstep(w, w + cw * 0.5, dj)) * (1.0 - smoothstep(${d}.0 - 1.5, ${d}.0, aj));
        if (m > crack) { crack = m; cdir = normalize(ab); }
        cglow = max(cglow, m * (0.55 + 0.8 * exp(-aj / 1.0)));
      }
    }

    // 光：煤是黑的，漫射弱，主要靠反光。主光、鼠标那盏灯各一份漫射加反光，斜着的面映一点天光；
    // 缝里、块底下暗（遮蔽），裂纹里更暗
    vec3 n = normalize(vec3(-h.y, 1.0, -h.z)), V = -rd;
    float ao = mix(0.15, 1.0, smoothstep(-0.3, 0.7, hr)) * (1.0 - 0.85 * crack);
    float dif = max(dot(n, uKey), 0.0), spec = pow(max(dot(n, normalize(uKey + V)), 0.0), ${_(e.KP)});
    vec3 R = reflect(rd, n);
    float fres = 0.15 + 0.85 * pow(1.0 - max(dot(n, V), 0.0), 3.0);
    float env = smoothstep(-0.2, 0.8, R.y) * fres;
    vec3 Lp = vec3(uPtr.x, ${_(e.LAMP_H)}, uPtr.y) - P;
    float dp = length(Lp); Lp /= dp;
    float att = uPtr.z / (1.0 + dp * dp * ${_(e.LAMP_F)});
    float pdif = max(dot(n, Lp), 0.0) * att, pspec = pow(max(dot(n, normalize(Lp + V)), 0.0), 36.0) * att;
    float lum = ${_(e.AMB)} + ao * (${_(e.FILL)} * max(dot(n, V), 0.0) + ${_(e.KD)} * dif + ${_(e.KE)} * env + ${_(e.KS)} * spec + ${_(e.LAMP)} * (0.5 * pdif + 0.8 * pspec));
    // 越远越暗
    lum = mix(lum, uFogL, 1.0 - exp(-max(dist / uCamH * ${_(e.CAM_H)} - ${_(e.FOG0)}, 0.0) / ${_(e.FOGD)}));

    // 缝里的蓝光。平时：几处亮的沿着缝挪，是在噪声里绕一个圈取的，一圈以后回到原处
    vec2 lo = 1.3 * vec2(cos(6.2831853 * uU), sin(6.2831853 * uU));
    float L = ${_(e.GA)} * smoothstep(${_(e.GT)}, ${_(e.GT+.2)}, vnoise(x * ${_(e.GF)} + lo + 3.0)) * (0.75 + 0.25 * sin(6.2831853 * (3.0 * uU + hh(id, 30u))));
    L = max(L, seep);
    float low = 1.0 - smoothstep(-0.35, ${_(e.GLOW_UP)}, hr);           // 越往缝底越亮：缝两边的块底下也映着
    float glow = L * (low + 0.25 * exp(-ed / 0.1)) + cglow + 0.9 * flash;
    glow *= exp(-max(dist / uCamH * ${_(e.CAM_H)} - ${_(e.FOG0)}, 0.0) / (2.0 * ${_(e.FOGD)}));

    // 字的方向：顺着煤面的等高线（同一个面上朝一个方向），裂纹里顺着裂纹
    vec2 gr = h.yz;
    vec2 t2 = screenDir(P, normalize(vec2(-gr.y, gr.x) + 1e-6)) * clamp(length(gr) * 3.0, 0.0, 1.0);
    t2 = mix(t2, screenDir(P, cdir), crack);
    o = vec4(clamp(lum, 0.0, 1.0), clamp(glow, 0.0, 1.0), t2 * 0.5 + 0.5);
  }
`,ae=e=>`
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uShade, uAtlas;
  uniform vec2 uRes, uCells;        // 画布（设备像素）；底稿有几列几行格子（比画布多出不到一格）
  uniform float uCell, uN;          // 一格多少设备像素、图集里有几个字
  uniform vec2 uRange;              // 亮度从 x 到 y 铺满由淡到浓的字
  uniform float uDark;              // 深色主题：越亮越浓；浅色主题反过来
  uniform vec3 uC0, uC1, uC2, uC3;  // 煤面的色带
  uniform vec3 uG0, uG1, uGlint;    // 光由弱到强、闪亮的高光
  uniform float uGamma;             // 亮度先按这个次方拉一下：煤大半是暗的，暗部要拉开
  uniform float uDense;             // 字由细到粗怎么分：越大，越亮（浅色主题是越暗）的格子才用得上粗的
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    return t < 1.0 ? mix(uC0, uC1, t) : t < 2.0 ? mix(uC1, uC2, t - 1.0) : mix(uC2, uC3, t - 2.0);
  }
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // 左上角是原点
    vec2 cell = floor(fc / uCell), c0 = (cell + 0.5) / uCells, uv = vec2(c0.x, 1.0 - c0.y);
    vec4 s = textureLod(uShade, uv, 1.0);                         // 底稿一格两个像素，第 1 层 mipmap 正好一格一个
    float r1 = hash(cell), r2 = hash(cell + 17.31);
    float glow = s.g, gi, a = 0.0;
    vec3 col;
    float lv = clamp((s.r - uRange.x) / (uRange.y - uRange.x) + (r1 - 0.5) * 0.06, 0.0, 0.999);
    if (glow > ${_(e.HOT)} + (r2 - 0.5) * 0.12) {
      // 最亮的光：. : * o @ 由弱到强，不转
      float k = clamp((glow - ${_(e.HOT)}) / ${_(1-e.HOT)}, 0.0, 0.999);
      gi = ${b}.0 + floor(k * (uN - ${b}.0));
      col = mix(uG0, uG1, k);
    } else if (uDark > 0.5 && s.r > ${_(e.GLINT)} && r2 < 0.5) {
      // 闪亮的高光：零零星星几个 *，不转
      gi = ${b}.0 + 2.0;
      col = uGlint;
    } else {
      // 煤面：亮度挑 - = #，字转到等高线的走向上；方向取周围几格一起的，不跟着一格里的小起伏乱转
      vec2 t2 = textureLod(uShade, uv, ${_(e.DIRLOD)}).ba * 2.0 - 1.0;
      lv = pow(lv, uGamma);
      // 背光的暗处字都横着放，像版画里阴影的排线，亮的面才顺着面转
      a = dot(t2, t2) > 1e-12 ? 0.5 * atan(t2.y, t2.x) * smoothstep(0.05, 0.25, length(t2)) * smoothstep(${_(e.FLAT0)}, ${_(e.FLAT0+.2)}, lv) : 0.0;   // atan(0, 0) 没定义，有的显卡算出 NaN
      lv = mix(lv, lv * lv * (3.0 - 2.0 * lv), 0.3);   // 再拉开一点反差
      if (uDark < 0.5) lv = 0.999 - lv;
      float gl = clamp(glow * 1.6, 0.0, 1.0);
      float lg = max(pow(lv, uDense), gl);
      gi = min(floor(lg * ${b}.0), ${b}.0 - 1.0);
      col = mix(ramp(lv), mix(uG0, uG1, smoothstep(0.35, 0.9, glow)), smoothstep(0.03, 0.3, glow));
    }
    vec2 loc = (fc - (cell + 0.5) * uCell) / uCell;
    vec2 q = vec2(cos(a) * loc.x + sin(a) * loc.y, -sin(a) * loc.x + cos(a) * loc.y);
    float ink = 0.0;
    if (abs(q.x) < 0.5 && abs(q.y) < 0.5) ink = texture(uAtlas, vec2((gi + q.x + 0.5) / uN, 0.5 - q.y)).r;
    o = vec4(col * ink, ink);   // 预乘过的透明度：字以外是透明的
  }
`;function w(e,{period:t=12e3,cell:c=8,fps:_=30}={}){let v=te,b=i(e),x=n(b),C=matchMedia(`(prefers-reduced-motion: reduce)`),w=C.matches||x,T=o(b),E=r(b,S,re(v)),oe=r(b,S,ie(v)),se=r(b,S,ae(v)),D=[],ce=new Float32Array(256),O=[],le=new Float32Array(24),k=null,A=null,j=1,M=1,N=!0,P=null,F=document.createElement(`canvas`);ne(F);let I=s(b,F),L={R:[1,0,0],U:[0,1,0],F:[0,0,-1],tan:[1,1],h:v.CAM_H};function ue(e){let t=Math.tan(22*Math.PI/180),n=t*e,r=Math.tan(20*Math.PI/180);n<r&&(n=r,t=n/e);let i=Math.max(v.PITCH*Math.PI/180,Math.atan(t)+14*Math.PI/180);L.F=[0,-Math.sin(i),-Math.cos(i)],L.U=[0,Math.cos(i),-Math.sin(i)],L.tan=[n,t],L.h=v.CAM_H*Math.min(1.6,Math.max(1,1.2/e))}let R=0,z=0,B=1,V=0,H=!0,U=-1e9,W=-1,G=!1,K=!1,q={tx:0,ty:0,x:0,y:0,on:0,k:0};function de(){K=getComputedStyle(e).colorScheme.includes(`dark`)}function fe(){R=e.clientWidth,z=e.clientHeight,R&&z&&(B=Math.min(2,window.devicePixelRatio||1),e.width=Math.round(R*B),e.height=Math.round(z*B),j=Math.ceil(R/c),M=Math.ceil(z/c),ue(j/M),k?.dispose(),A?.dispose(),k=a(b,j*2,M*2),A=a(b,j*2,M*2,{mipmaps:!0}),N=!0,P=null,de(),$(!0))}function pe(e,t){if(!k||N)return null;let n=k.w,r=k.h;P||(P=new Uint8Array(n*r*4),k.bind(),b.readPixels(0,0,n,r,b.RGBA,b.UNSIGNED_BYTE,P),b.bindFramebuffer(b.FRAMEBUFFER,null));let i=Math.floor(e/(j*c)*n),a=Math.floor((1-t/(M*c))*r);if(i<0||a<0||i>=n||a>=r)return null;let o=(a*n+i)*4,s=P;return s[o]===255&&s[o+1]===255&&s[o+2]===255&&s[o+3]===255?null:{x:(s[o]*256+s[o+1])/65535*2*h-h,y:(s[o+2]*256+s[o+3])/65535*g-g}}let J=null,Y=0,X=0,Z=-1e9;function me(e){D.push(e),D.length>u&&m(D)}function he(e,t,n,r){!J||r-J.t>250?(J={x:e.x,y:e.y,t:r,start:!0},me(J),Y=t,X=n,Z=r):Math.hypot(t-Y,n-X)>=28||r-Z>=90||D[D.length-1]!==J||J.start?(J={x:e.x,y:e.y,t:r,start:!1},me(J),Y=t,X=n,Z=r):Object.assign(J,{x:e.x,y:e.y,t:r}),$(!0)}function ge(e,t,n){let r=pe(e,t);r&&(O.push({x:r.x,y:r.y,t:n,seed:Math.random()}),O.length>f&&O.shift(),me({x:r.x,y:r.y,t:n,start:!0}),J=null,$(!0))}let _e=t=>{let n=e.getBoundingClientRect();return[t.clientX-n.left,t.clientY-n.top]},ve=e=>{if(w||!R)return;let[t,n]=_e(e),r=pe(t,n);r&&(q.on||(q.x=r.x,q.y=r.y),q.tx=r.x,q.ty=r.y,q.on=1,he(r,t,n,performance.now()))},ye=e=>{if(w||!R)return;let[t,n]=_e(e);ge(t,n,performance.now())},be=()=>{J=null,q.on=0,$(!0)};e.addEventListener(`pointermove`,ve),e.addEventListener(`pointerdown`,ye),e.addEventListener(`pointerleave`,be);function xe(n){if(V=0,G||!R||!k)return;let r=W<0?0:Math.min(.1,(n-W)/1e3);for(W=n;D.length&&(n-D[0].t)/1e3>=d;)D.shift();for(D.length||(J=null),D.forEach((e,t)=>ce.set([e.x,e.y,Math.max(0,(n-e.t)/1e3),t===0||e.start?1:0],t*4));O.length&&(n-O[0].t)/1e3>=p;)O.shift();O.forEach((e,t)=>le.set([e.x,e.y,Math.max(0,(n-e.t)/1e3),e.seed],t*4));let i=1-Math.exp(-r*10);q.x+=(q.tx-q.x)*i,q.y+=(q.ty-q.y)*i,q.k+=((w?0:q.on)-q.k)*(1-Math.exp(-r*5));let a=Math.abs(q.tx-q.x)+Math.abs(q.ty-q.y)>.002||Math.abs(q.on-q.k)>.01,o=D.length>0||O.length>0||a;if(!w&&!o&&n-U<1e3/_-2){Q();return}U=n;let s=w?.15:(n%t+t)%t/t,u={uCamR:L.R,uCamU:L.U,uCamF:L.F,uTan:L.tan,uCamH:L.h};N&&=(k.bind(),E.use(u),T.draw(),!1);let f=v.KEY_SWING*Math.sin(l*s),m=v.KEY_EL,te=[Math.cos(m)*Math.sin(f),Math.sin(m),-Math.cos(m)*Math.cos(f)],h=ee[K?`dark`:`light`];A.bind(),oe.use({...u,uGeo:[k.tex,0],uU:s,uFoot:2*L.tan[1]/A.h,uFogL:h.fog,uKey:te,uPtr:[q.x,q.y,q.k],uTrail:ce,uTrailN:D.length,uTap:le,uTapN:O.length}),T.draw(),A.mip(),b.bindFramebuffer(b.FRAMEBUFFER,null),b.viewport(0,0,e.width,e.height),b.clearColor(0,0,0,0),b.clear(b.COLOR_BUFFER_BIT),se.use({uShade:[A.tex,0],uAtlas:[I.tex,1],uRes:[e.width,e.height],uCells:[j,M],uCell:c*B,uN:y.length,uRange:h.range,uDark:+!!K,uGamma:h.gamma,uDense:h.dense,uC0:h.stone[0],uC1:h.stone[1],uC2:h.stone[2],uC3:h.stone[3],uG0:h.glow[0],uG1:h.glow[1],uGlint:h.glint}),T.draw(),(!w||o)&&Q()}function Q(){!V&&!G&&H&&!document.hidden&&(V=requestAnimationFrame(xe))}function $(e=!1){e&&(U=-1e9),Q()}let Se=new IntersectionObserver(([e])=>{H=e.isIntersecting,H&&$(!0)});Se.observe(e);let Ce=new ResizeObserver(()=>fe());Ce.observe(e);let we=()=>{W=-1,document.hidden||$(!0)};document.addEventListener(`visibilitychange`,we);let Te=()=>{w=C.matches||x,$(!0)};return C.addEventListener(`change`,Te),document.fonts?.load(`500 50px "DM Mono"`).then(()=>{G||(ne(F),I.update(),$(!0))},()=>{}),fe(),{crack(){!w&&R&&ge(R*(.25+Math.random()*.5),z*(.4+Math.random()*.45),performance.now())},refresh(){de(),$(!0)},destroy(){G=!0,cancelAnimationFrame(V),V=0,Se.disconnect(),Ce.disconnect(),e.removeEventListener(`pointermove`,ve),e.removeEventListener(`pointerdown`,ye),e.removeEventListener(`pointerleave`,be),document.removeEventListener(`visibilitychange`,we),C.removeEventListener(`change`,Te),k?.dispose(),A?.dispose(),I.dispose(),T.dispose(),E.dispose(),oe.dispose(),se.dispose()}}}var T=t();function E(){let e=(0,c.useRef)(null),t=(0,c.useRef)(null),[n,r]=(0,c.useState)(!1);return(0,c.useEffect)(()=>{let n;try{n=w(e.current,{period:12e3})}catch{r(!0);return}t.current=n;let i=()=>n.refresh(),a=new MutationObserver(i);a.observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]});let o=matchMedia(`(prefers-color-scheme: dark)`);return o.addEventListener(`change`,i),()=>{a.disconnect(),o.removeEventListener(`change`,i),n.destroy(),t.current=null}},[]),(0,T.jsxs)(`div`,{className:`lab-root ascii-coal`,children:[(0,T.jsx)(`canvas`,{className:`wall`,ref:e,tabIndex:0,role:`img`,onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),t.current?.crack())},"aria-label":`A bed of faceted coal lumps seen at an angle, with cold blue light in the seams between them, drawn entirely in ASCII characters. Press Enter to crack it.`}),n&&(0,T.jsx)(`p`,{className:`fallback`,children:`This experiment needs WebGL 2`}),(0,T.jsxs)(`p`,{className:`lab-hint`,children:[(0,T.jsx)(`span`,{className:`for-mouse`,children:`Sweep across the coal to crack it`}),(0,T.jsx)(`span`,{className:`for-touch`,children:`Tap or swipe across the coal`})]})]})}export{E as default};