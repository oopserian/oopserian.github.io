import{t as e}from"./react.CvnImTBr.js";import{a as t}from"./gl.B6Qi3-Xr.js";import{t as n}from"./jsx-runtime.Cr1s1OSH.js";import{t as r}from"./icons.CWdvVPj_.js";var i=e(),a=`#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
`,o=`
#define PI 3.14159265359
const float RG = 6371.0;
const float ATM_H = 100.0;
const float RT = RG + ATM_H;
// Hillaire 2020 的地球大气参数（每千米）
const vec3 RAY_S = vec3(5.802e-3, 13.558e-3, 33.1e-3);
const float MIE_S = 4.6e-3;
const float MIE_E = 5.1e-3;
const vec3 OZO_A = vec3(0.650e-3, 1.881e-3, 0.085e-3);
const vec2 TLUT = vec2(256.0, 64.0);
const vec2 MSLUT = vec2(32.0, 32.0);
const vec2 IRLUT = vec2(64.0, 16.0);

void medium(float h, out vec3 rayS, out float mieS, out vec3 ext) {
  h = max(h, 0.0);
  float rd = exp(-h * 0.125);
  float md = exp(-h * 0.8333);
  rayS = RAY_S * rd;
  mieS = MIE_S * md;
  float oz = max(0.0, 1.0 - abs(h - 25.0) / 15.0);
  ext = rayS + vec3(MIE_E * md) + OZO_A * oz;
}

float rayPhase(float c) { return 3.0 / (16.0 * PI) * (1.0 + c * c); }
float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * c, 1e-5), 1.5));
}
float miePhase(float c) {
  const float g = 0.8; float g2 = g * g;
  return 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + c * c)) / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * c, 1e-5), 1.5));
}

// 从海拔 h、天顶余弦 mu 的点出发，和海拔 a 的球面求交。返回 (近, 远)，在球内时近为 -1，不相交为 (-1,-1)
vec2 shellHits(float h, float mu, float a) {
  float r = RG + h;
  float b = r * mu;
  float c = (h - a) * (2.0 * RG + h + a);
  float disc = b * b - c;
  if (disc < 0.0) return vec2(-1.0);
  float s = sqrt(disc);
  if (c > 0.0) {
    if (b >= 0.0) return vec2(-1.0);
    return vec2(c / (-b + s), -b + s);
  }
  return vec2(-1.0, -b + s);
}

vec2 tlutUV(float h, float mu) {
  float H = sqrt(RT * RT - RG * RG);
  float rho = sqrt(max(h * (2.0 * RG + h), 0.0));
  float r = RG + h;
  float d = max(0.0, -r * mu + sqrt(max(r * r * (mu * mu - 1.0) + RT * RT, 0.0)));
  float dmin = RT - r, dmax = rho + H;
  float xm = clamp((d - dmin) / max(dmax - dmin, 1e-4), 0.0, 1.0);
  float xr = clamp(rho / H, 0.0, 1.0);
  return vec2(xm, xr) * (1.0 - 1.0 / TLUT) + 0.5 / TLUT;
}
vec2 msUV(float h, float muS) {
  vec2 x = vec2(muS * 0.5 + 0.5, clamp(h / ATM_H, 0.0, 1.0));
  return x * (1.0 - 1.0 / MSLUT) + 0.5 / MSLUT;
}
vec2 irUV(float h, float muS) {
  vec2 x = vec2(clamp(muS * 0.5 + 0.5, 0.0, 1.0), clamp(sqrt(max(h, 0.0) / ATM_H), 0.0, 1.0));
  return x * (1.0 - 1.0 / IRLUT) + 0.5 / IRLUT;
}

uniform sampler2D uTLUT;
uniform sampler2D uMSLUT;

// 到太阳的透射率，含地球本影（太阳圆盘大小的软边）
vec3 sunTrans(float h, float muS) {
  h = max(h, 0.0);
  float r = RG + h;
  float muHor = -sqrt(h * (2.0 * RG + h)) / r;
  float vis = smoothstep(-0.0050, 0.0050, muS - muHor);
  if (vis <= 0.0) return vec3(0.0);
  return texture(uTLUT, tlutUV(h, max(muS, muHor))).rgb * vis;
}
vec3 msLum(float h, float muS) { return texture(uMSLUT, msUV(h, muS)).rgb; }

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float remap(float v, float a, float b, float c, float d) { return c + (v - a) / (b - a) * (d - c); }
vec3 srgb2lin(vec3 c) { return pow(c, vec3(2.2)); }
`,s=a+`
out vec2 vUV;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,c=a+o+`
out vec4 o;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5) / (TLUT - 1.0);
  float H = sqrt(RT * RT - RG * RG);
  float rho = H * uv.y;
  float r = sqrt(rho * rho + RG * RG);
  float dmin = RT - r, dmax = rho + H;
  float d = dmin + uv.x * (dmax - dmin);
  float mu = d < 1e-4 ? 1.0 : clamp((H * H - rho * rho - d * d) / (2.0 * r * d), -1.0, 1.0);
  vec3 od = vec3(0.0);
  const int N = 80;
  float dt = d / float(N);
  for (int i = 0; i < N; i++) {
    float t = (float(i) + 0.5) * dt;
    float hs = sqrt(t * t + 2.0 * r * mu * t + r * r) - RG;
    vec3 rs; float ms; vec3 ext;
    medium(hs, rs, ms, ext);
    od += ext * dt;
  }
  o = vec4(exp(-od), 1.0);
}`,l=a+o+`
out vec4 o;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5) / (MSLUT - 1.0);
  float muS = uv.x * 2.0 - 1.0;
  float h = max(uv.y * ATM_H, 0.002);
  vec3 sunDir = vec3(sqrt(max(0.0, 1.0 - muS * muS)), muS, 0.0);
  vec3 lumT = vec3(0.0), fmsT = vec3(0.0);
  const int SQ = 8;
  const int N = 20;
  const float ALB = 0.12;
  for (int i = 0; i < SQ; i++) for (int j = 0; j < SQ; j++) {
    float th = 2.0 * PI * (float(i) + 0.5) / float(SQ);
    float ph = acos(1.0 - 2.0 * (float(j) + 0.5) / float(SQ));
    vec3 rd = vec3(sin(ph) * cos(th), cos(ph), sin(ph) * sin(th));
    float mu = rd.y;
    vec2 g = shellHits(h, mu, 0.0);
    float tG = g.x;
    float tT = shellHits(h, mu, ATM_H).y;
    float tMax = tG > 0.0 ? tG : tT;
    vec3 T = vec3(1.0), L = vec3(0.0), F = vec3(0.0);
    float dt = tMax / float(N);
    vec3 ro = vec3(0.0, RG + h, 0.0);
    for (int k = 0; k < N; k++) {
      float t = (float(k) + 0.3) * dt;
      vec3 p = ro + rd * t;
      float r = length(p);
      float hs = r - RG;
      float muSs = dot(p / r, sunDir);
      vec3 rs; float mS; vec3 ext;
      medium(hs, rs, mS, ext);
      vec3 sT = exp(-dt * ext);
      vec3 sc = rs + vec3(mS);
      F += T * (sc - sc * sT) / ext;
      vec3 inS = sc * sunTrans(hs, muSs) / (4.0 * PI);
      L += T * (inS - inS * sT) / ext;
      T *= sT;
    }
    if (tG > 0.0) {
      vec3 p = ro + rd * tG;
      float muG = dot(normalize(p), sunDir);
      if (muG > 0.0) L += T * ALB / PI * muG * sunTrans(0.0, muG);
    }
    lumT += L; fmsT += F;
  }
  float n = float(SQ * SQ);
  lumT /= n; fmsT /= n;
  o = vec4(lumT / (1.0 - fmsT), 1.0);
}`,u=a+o+`
out vec4 o;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5) / (IRLUT - 1.0);
  float muS = uv.x * 2.0 - 1.0;
  float h = uv.y * uv.y * ATM_H;
  vec3 sunDir = vec3(sqrt(max(0.0, 1.0 - muS * muS)), muS, 0.0);
  vec3 E = vec3(0.0);
  const int SQ = 8;
  const int N = 18;
  vec3 ro = vec3(0.0, RG + h, 0.0);
  for (int i = 0; i < SQ; i++) for (int j = 0; j < SQ; j++) {
    float th = 2.0 * PI * (float(i) + 0.5) / float(SQ);
    float ct = (float(j) + 0.5) / float(SQ); // 均匀半球
    float st = sqrt(1.0 - ct * ct);
    vec3 rd = vec3(st * cos(th), ct, st * sin(th));
    float tT = shellHits(h, ct, ATM_H).y;
    float dt = tT / float(N);
    float cs = dot(rd, sunDir);
    float pR = rayPhase(cs), pM = miePhase(cs);
    vec3 T = vec3(1.0), L = vec3(0.0);
    for (int k = 0; k < N; k++) {
      float t = (float(k) + 0.4) * dt;
      vec3 p = ro + rd * t;
      float r = length(p);
      float hs = r - RG;
      float muSs = dot(p / r, sunDir);
      vec3 rs; float mS; vec3 ext;
      medium(hs, rs, mS, ext);
      vec3 sT = exp(-dt * ext);
      vec3 st2 = sunTrans(hs, muSs);
      vec3 ms = msLum(hs, muSs);
      vec3 inS = rs * (pR * st2 + ms) + mS * (pM * st2 + ms);
      L += T * (inS - inS * sT) / ext;
      T *= sT;
    }
    E += L * ct;
  }
  E *= 2.0 * PI / float(SQ * SQ);
  o = vec4(E, 1.0);
}`,d=a+`
uniform float uZ;
uniform float uSize;
uniform int uKind;
out vec4 o;
vec3 h33(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float worley(vec3 p, float per) {
  vec3 id = floor(p), f = fract(p);
  float md = 1.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 off = vec3(float(x), float(y), float(z));
    vec3 c = mod(id + off, per);
    vec3 d = off + h33(c) - f;
    md = min(md, dot(d, d));
  }
  return 1.0 - sqrt(md);
}
vec3 grad(vec3 c, float per) { return normalize(h33(mod(c, per)) * 2.0 - 1.0); }
float perlin(vec3 p, float per) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(grad(i, per), f);
  float n100 = dot(grad(i + vec3(1,0,0), per), f - vec3(1,0,0));
  float n010 = dot(grad(i + vec3(0,1,0), per), f - vec3(0,1,0));
  float n110 = dot(grad(i + vec3(1,1,0), per), f - vec3(1,1,0));
  float n001 = dot(grad(i + vec3(0,0,1), per), f - vec3(0,0,1));
  float n101 = dot(grad(i + vec3(1,0,1), per), f - vec3(1,0,1));
  float n011 = dot(grad(i + vec3(0,1,1), per), f - vec3(0,1,1));
  float n111 = dot(grad(i + vec3(1,1,1), per), f - vec3(1,1,1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float pfbm(vec3 p, float per) {
  float a = 1.0, s = 0.0, n = 0.0;
  for (int i = 0; i < 6; i++) { s += a * perlin(p, per); n += a; a *= 0.5; p *= 2.0; per *= 2.0; }
  return s / n;
}
float wfbm(vec3 p, float per) {
  return worley(p, per) * 0.625 + worley(p * 2.0, per * 2.0) * 0.25 + worley(p * 4.0, per * 4.0) * 0.125;
}
float rmp(float v, float a, float b, float c, float d) { return c + (v - a) / (b - a) * (d - c); }
void main() {
  vec3 uvw = vec3(gl_FragCoord.xy, uZ + 0.5) / uSize;
  if (uKind == 0) {
    float f = 4.0;
    // R：Perlin 和反转 Worley 混合，均值约 0.5、分布够开；GBA：三个频率的 Worley
    float pn = clamp(0.5 + pfbm(uvw * f, f) * 1.6, 0.0, 1.0);
    float w1 = wfbm(uvw * f, f);
    float w2 = wfbm(uvw * f * 2.0, f * 2.0);
    float w3 = wfbm(uvw * f * 4.0, f * 4.0);
    float pw = clamp(mix(pn, w1, 0.42) * 1.1 - 0.03, 0.0, 1.0);
    o = vec4(pw, w1, w2, w3);
  } else {
    float f = 4.0;
    o = vec4(wfbm(uvw * f, f), wfbm(uvw * f * 2.0, f * 2.0), wfbm(uvw * f * 4.0, f * 4.0), 1.0);
  }
}`,f=`
uniform vec2 uRes;
uniform float uTime;
uniform float uFrame;
uniform float uCamH;       // 相机海拔（千米，水下时为 0）
uniform float uCamYm;      // 相机局部高度（米，水下为负）
uniform vec3 uTdir;        // 潜入点方向（单位向量），也是局部“上”
uniform vec3 uTP;          // uTdir * RG
uniform vec3 uE;           // 局部东
uniform vec3 uN;           // 局部北
uniform vec3 uFwd, uRight, uUpv;
uniform vec2 uTan;
uniform vec3 uSun;
uniform float uOcean;      // 0 = 行星贴图，1 = 近处海浪
uniform float uLocalCloud; // 近处云的细节开关
uniform vec3 uWind;        // 云随风平移（千米）
uniform float uSunE;       // 太阳辐照度
uniform float uLights;     // 城市灯光强度
uniform float uStars;
uniform float uNoiseN;
uniform float uUnderBoost;
uniform float uUnderGain;

uniform sampler2D uDem;     // 加那利群岛高程（平方根编码）
uniform sampler2D uDemMax;  // 16x16 一块的最大高度，往四周扩了一块
uniform vec3 uDemC;         // 群岛范围的中心（相对 T，海平面上）
uniform float uDemR;        // 群岛范围的外接球半径
uniform float uTerrain;     // 地形开关
uniform sampler2D uDay;
uniform sampler2D uAux;
uniform sampler2D uCloudMap;
uniform sampler2D uIRLUT;
uniform sampler2D uEnv;
uniform sampler2D uCaustic;
uniform sampler3D uShape;
uniform sampler3D uDetail;

#define NW 32
uniform vec4 uWA[NW];      // dir.x(东), dir.y(北), k, A
uniform vec4 uWB[NW];      // omega, phase, sharp, periodic

const float CB = 1.0;      // 云底（千米）
const float CT = 3.6;      // 云顶上限
const float CLOUD_DENS = 34.0;

vec3 irr(float h, float muS) { return texture(uIRLUT, irUV(h, muS)).rgb; }

// 相对 T 的位置 q（千米） -> 海拔（精确到米）和当地向上方向
float altOf(vec3 q, out vec3 up) {
  float dq = dot(uTdir, q);
  float qq = dot(q, q);
  float num = 2.0 * RG * dq + qq;
  float r = sqrt(RG * RG + num);
  up = (uTP + q) / r;
  return num / (r + RG);
}
vec2 dirUV(vec3 n) {
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float lon = atan(n.x, n.z);
  return vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI);
}
vec3 toLocal(vec3 v) { return vec3(dot(v, uE), dot(v, uTdir), dot(v, uN)); }
vec3 toWorld(vec3 l) { return uE * l.x + uTdir * l.y + uN * l.z; }

// ---------------- 海浪 ----------------
// 短浪是 24 米一格平铺的（给焦散用），用两层不成整数比的噪声调它们的振幅和相位，
// 从空中看不出格子，波峰也不再是笔直的长线
vec2 waveMod(vec2 x, float fp) {
  float l = clamp(log2(max(fp, 0.01) * uNoiseN / 57.0), 0.0, 6.0);
  return vec2(textureLod(uShape, vec3(x * (1.0 / 83.0), 0.71), l).r,
              textureLod(uShape, vec3(x * (1.0 / 57.0) + 0.37, 0.29), l).r);
}
void waveAP(int i, vec4 b, vec2 m, float k, out float amp, out float ph) {
  if (b.w < 0.5) { amp = 1.0; ph = 0.0; return; }
  float mw = (i % 2 == 0) ? m.x : m.y;
  amp = mix(1.0, 0.3 + 1.4 * smoothstep(0.2, 0.8, mw), k);
  ph = (mw - 0.5) * (6.0 + 4.0 * fract(float(i) * 0.618)) * k;
}
// 相机正下方几米不调制，好让 JS 里算的镜头起伏和画出来的水面一致
float waveK(vec2 x) { return smoothstep(2.0, 12.0, length(x)); }
float waveH(vec2 x, int n) {
  float h = 0.0;
  vec2 m = waveMod(x, 0.05); float k = waveK(x);
  for (int i = 0; i < NW; i++) {
    if (i >= n) break;
    vec4 a = uWA[i]; vec4 b = uWB[i];
    float amp, ph; waveAP(i, b, m, k, amp, ph);
    float th = a.z * dot(a.xy, x) - b.x * uTime + b.y + ph;
    float u = 0.5 + 0.5 * sin(th);
    h += amp * a.w * (2.0 * pow(u, b.z) - 1.0);
  }
  return h;
}
// 带 LOD 的法线：比像素小的浪不画，把它们的坡度方差折进粗糙度
void waveN(vec2 x, float fp, out vec3 n, out float var, out float hgt) {
  vec2 g = vec2(0.0); var = 0.0035; hgt = 0.0;
  vec2 m = waveMod(x, fp); float k = waveK(x);
  for (int i = 0; i < NW; i++) {
    vec4 a = uWA[i]; vec4 b = uWB[i];
    float amp, ph; waveAP(i, b, m, k, amp, ph);
    a.w *= amp;
    float lam = 6.2831853 / a.z;
    float w = smoothstep(2.0 * fp, 6.0 * fp, lam);
    float sv = 0.5 * a.z * a.z * a.w * a.w;
    var += sv * (1.0 - w);
    if (w <= 0.0) continue;
    float th = a.z * dot(a.xy, x) - b.x * uTime + b.y + ph;
    float s = sin(th), c = cos(th);
    float u = 0.5 + 0.5 * s;
    float pu = pow(u, b.z - 1.0);
    hgt += w * a.w * (2.0 * pu * u - 1.0);
    g += w * a.w * b.z * pu * c * a.z * a.xy;
  }
  // 风斑：几百米到几公里的范围里浪的陡度时强时弱，高处看反光一块亮一块暗，不显得整齐
  float gm = textureLod(uShape, vec3(x * (1.0 / 1730.0), 0.17), 1.5).r * 0.6 + textureLod(uShape, vec3(x * (1.0 / 610.0) + 0.41, 0.53), 1.5).r * 0.4;
  gm = 0.35 + 1.3 * smoothstep(0.25, 0.75, gm);
  g *= gm; var = 0.0035 + (var - 0.0035) * gm * gm;
  // 厘米级的风生涟漪：让近处的反光和水下的全反射碎开
  // 两层：45 厘米和 17 厘米，看不清时把坡度方差折进粗糙度
  float wr = smoothstep(0.09, 0.02, fp);
  var += 0.0045 * (1.0 - wr);
  if (wr > 0.0) {
    const float e = 0.03;
    vec3 c0 = vec3(x / 0.45, uTime * 0.21);
    float hx = textureLod(uDetail, c0 + vec3(e / 0.45, 0.0, 0.0), 0.0).r - textureLod(uDetail, c0 - vec3(e / 0.45, 0.0, 0.0), 0.0).r;
    float hz = textureLod(uDetail, c0 + vec3(0.0, e / 0.45, 0.0), 0.0).r - textureLod(uDetail, c0 - vec3(0.0, e / 0.45, 0.0), 0.0).r;
    g += wr * (vec2(hx, hz) / (2.0 * e)) * 0.016 * gm;
    float wr2 = smoothstep(0.035, 0.008, fp);
    var += 0.002 * (1.0 - wr2);
    if (wr2 > 0.0) {
      const float e2 = 0.012;
      vec3 c1 = vec3(x / 0.17 + 0.37, uTime * 0.43 + 0.5);
      float hx2 = textureLod(uDetail, c1 + vec3(e2 / 0.17, 0.0, 0.0), 0.0).g - textureLod(uDetail, c1 - vec3(e2 / 0.17, 0.0, 0.0), 0.0).g;
      float hz2 = textureLod(uDetail, c1 + vec3(0.0, e2 / 0.17, 0.0), 0.0).g - textureLod(uDetail, c1 - vec3(0.0, e2 / 0.17, 0.0), 0.0).g;
      g += wr2 * (vec2(hx2, hz2) / (2.0 * e2)) * 0.006 * gm;
    }
  }
  n = normalize(vec3(-g.x, 1.0, -g.y));
}

// ---------------- 云 ----------------
float cloudLod(float fpKm) { return clamp(log2(max(fpKm, 0.01) / 9.77), 0.0, 8.0); }

// 大尺度云量：卫星云图 + 潜入点附近的设计（西边太阳方向放晴，正上方一朵厚云）
float coverage(vec3 up, vec3 q, float fp) {
  float a = textureLod(uCloudMap, dirUV(up), cloudLod(fp)).r;
  // 远看直接用卫星云图的不透明度，近看把淡云放大成碎云
  float c = mix(smoothstep(0.02, 0.5, a), pow(a, 0.8), smoothstep(2.0, 12.0, fp));
  vec2 lq = vec2(dot(q, uE), dot(q, uN));
  float dist = length(lq);
  if (dist < 950.0) {
    // 潜入点附近一片层积云场，边界由大尺度噪声决定，不是圆
    float big = textureLod(uShape, vec3(lq * (1.0 / 900.0) + 0.13, 0.21), 2.0).r;
    float field = smoothstep(0.45, 0.62, big * 0.75 + 0.42 * (1.0 - smoothstep(60.0, 600.0, dist)));
    // 从很远看（像素比几公里大）交给卫星云图，近了才长出细节
    float w = field * (1.0 - smoothstep(550.0, 950.0, dist)) * (1.0 - smoothstep(6.0, 22.0, fp)) * (1.0 - smoothstep(380.0, 800.0, uCamH));
    vec2 sh = normalize(vec2(dot(uSun, uE), dot(uSun, uN)));
    float s = dot(lq, sh);
    float pr = dot(lq, vec2(-sh.y, sh.x));
    float wn = textureLod(uShape, vec3(lq * (1.0 / 260.0), 0.31), 2.5).r;
    float wn2 = textureLod(uShape, vec3(lq * (1.0 / 150.0) + 0.37, 0.67), 1.5).r;
    float loc = clamp(c * 1.2 + 0.5 + (wn - 0.5) * 0.9, 0.0, 1.0);
    // 十几到几十公里的云胞结构
    // 两个不成整数比的尺度加扭曲，避免看出噪声的平铺格子
    vec3 wq = q + uWind * 0.6;
    vec3 warp = (textureLod(uShape, wq * (1.0 / 170.0) + 0.21, 2.0).rgb - 0.5) * 46.0;
    float m1 = textureLod(uShape, (wq + warp) * (1.0 / 53.0), clamp(log2(fp * uNoiseN / 53.0), 0.0, 7.0)).g;
    float m2 = textureLod(uShape, (wq - warp * 0.6) * (1.0 / 21.0) + 0.37, clamp(log2(fp * uNoiseN / 21.0), 0.0, 7.0)).r;
    float mid = m1 * 0.55 + m2 * 0.45;
    loc = clamp(loc * mix(0.15, 1.7, smoothstep(0.22, 0.78, mid)), 0.0, 1.0);
    // 太阳方向留一块形状不规则的晴空，云下能看到海平线上的太阳
    float e = (wn2 - 0.5) * 70.0;
    // 这块晴空一直伸到特内里费岛：从海面上也看得见泰德峰
    // 高处看时晴空从二十公里外才开始，前景留着积云；穿过云层以后它挪到眼前（那时人在云里，看不见这一下）
    float g0 = mix(4.0, 20.0, smoothstep(1.2, 4.5, uCamH));
    float gap = smoothstep(g0, g0 + 9.0, s + e * 0.12) * (1.0 - smoothstep(100.0, 175.0, s + e)) * (1.0 - smoothstep(30.0, 85.0, abs(pr) + e));
    loc *= 1.0 - gap;
    // 正下坠的那一柱有一朵厚云，保证会穿云
    float col = 1.0 - smoothstep(1.8, 5.0, dist);
    loc = max(loc, 0.86 * col);
    c = mix(c, loc, max(w, col));
  }
  return c;
}

// 竖向轮廓：0 = 云底，1 = 该处云能长到的最高处；云量大的地方云更高
float profile(float h01, float cov) {
  float top = mix(0.5, 1.0, cov);
  return smoothstep(0.0, 0.06, h01) * (1.0 - smoothstep(top * 0.4, top, h01));
}

// 云密度（每千米）。fp：像素在该处的尺寸（千米），用来做细节淡出
float cloudD(vec3 q, float h, float cov, float fp, bool hi) {
  float h01 = (h - CB) / (CT - CB);
  if (h01 <= 0.0 || h01 >= 1.0 || cov < 0.015) return 0.0;
  float prof = profile(h01, cov);
  if (prof <= 0.0) return 0.0;
  float far = -log(1.0 - min(cov, 0.985)) / 1.3 * smoothstep(0.0, 0.3, prof);
  float lodS = smoothstep(2.2, 0.6, fp);
  // 远看时卫星云图太糊，用两层不成整数比的噪声给它一点纹理
  if (fp > 0.6 && far > 0.0) {
    float fl = clamp(log2(fp * uNoiseN / 41.0), 0.0, 7.0);
    float f1 = textureLod(uShape, (q + uWind) * (1.0 / 41.0) + 0.29, fl).r;
    float f2 = textureLod(uShape, (q - uWind) * (1.0 / 17.3) + 0.63, fl + 0.5).r;
    // 只在几百公里高度起作用；从一万多公里外看，这层噪声比像素还小，只会变成斑点
    far *= mix(1.0, 0.25 + 1.5 * smoothstep(0.3, 0.7, f1 * 0.6 + f2 * 0.4), 1.0 - smoothstep(3.0, 7.0, fp));
  }
  if (lodS <= 0.0) return far;
  // 低频扭曲：让 13 公里一格的噪声在大范围里不显出重复
  vec3 wv = (textureLod(uShape, q * (1.0 / 97.0) + 0.71, 3.0).gba - 0.5) * 22.0;
  vec3 sp = (q + uWind + wv) * (1.0 / 13.0);
  vec4 sn = textureLod(uShape, sp, clamp(log2(fp * uNoiseN / 13.0), 0.0, 7.0));
  float lf = sn.g * 0.625 + sn.b * 0.25 + sn.a * 0.125;
  float base = sn.r * 0.62 + lf * 0.38;
  // 公里级的花椰菜状鼓包
  if (fp < 0.5) {
    float bl = textureLod(uShape, (q + uWind) * (1.0 / 3.7) + 0.5, clamp(log2(fp * uNoiseN / 3.7), 0.0, 7.0)).g;
    base += (bl - 0.45) * 0.3 * smoothstep(0.5, 0.15, fp);
  }
  // 云量决定阈值；越往上阈值越高，云顶自然收成圆顶
  float thr = mix(0.74, 0.26, cov) + (1.0 - prof) * 0.4;
  // 细节噪声直接推动云的表面（而不是只削边缘），云顶才有一团团的花椰菜，云底才有絮
  if (hi && base > thr - 0.13 && base < thr + 0.24) {
    float lodD = smoothstep(1.0, 0.18, fp);
    if (lodD > 0.0) {
      vec3 dn = textureLod(uDetail, (q + uWind * 1.4) * (1.0 / 1.25), clamp(log2(fp * 32.0 / 1.25), 0.0, 5.0)).rgb;
      float df = dn.r * 0.625 + dn.g * 0.25 + dn.b * 0.125;
      df = mix(df, 1.0 - df, clamp(h01 * 3.0, 0.0, 1.0));
      base += (0.5 - df) * 0.22 * lodD;
    }
  }
  float d = smoothstep(thr, thr + 0.11, base);
  return mix(far, d * CLOUD_DENS, lodS);
}

// 沿太阳方向的云光学厚度（只用形状噪声）
float cloudLightOD(vec3 q, float cov, float fp) {
  float od = 0.0, t = 0.0, st = 0.07;
  for (int i = 0; i < 6; i++) {
    vec3 qs = q + uSun * (t + st * 0.5);
    vec3 up; float h = altOf(qs, up);
    od += cloudD(qs, h, cov, max(fp, st * 0.5), false) * st;
    t += st; st *= 1.9;
  }
  return od;
}

void marchClouds(float h0, vec3 rd, float tLimit, float jit, float pxA, int maxSteps,
                 out vec3 L, out float T, out float tMean) {
  L = vec3(0.0); T = 1.0; tMean = -1.0;
  float mu = dot(rd, uTdir);
  vec2 inner = shellHits(h0, mu, CB);
  vec2 outer = shellHits(h0, mu, CT);
  float t0, t1;
  if (h0 > CT) {
    if (outer.x < 0.0) return;
    t0 = outer.x;
    t1 = inner.x > 0.0 ? inner.x : outer.y;
  } else if (h0 >= CB) {
    t0 = 0.0;
    t1 = inner.x > 0.0 ? inner.x : outer.y;
  } else {
    if (inner.y < 0.0) return;
    t0 = inner.y; t1 = outer.y;
  }
  if (tLimit > 0.0) t1 = min(t1, tLimit);
  t1 = min(t1, t0 + (h0 < 60.0 ? 260.0 : 3000.0));
  if (t1 <= t0) return;
  float seg = t1 - t0;
  float cs = dot(rd, uSun);
  float wsum = 0.0, tw = 0.0;
  float t = t0;
  float segDiv = h0 > 60.0 ? 14.0 : 6.0;
  float dt0 = clamp(t0 * 0.012, 0.045, max(seg / segDiv, 0.045));
  t += dt0 * jit;
  for (int i = 0; i < 160; i++) {
    if (i >= maxSteps || t >= t1 || T < 0.015) break;
    float dt = clamp(t * 0.014, 0.045, max(seg / segDiv, 0.045));
    vec3 q = uTdir * h0 + rd * t;
    vec3 up; float h = altOf(q, up);
    float fp = max(t * pxA, 0.02);
    float cov = coverage(up, q, fp);
    if (cov < 0.015) { t += dt * 2.5; continue; }
    float d = cloudD(q, h, cov, fp, true);
    if (d > 0.002) {
      float muS = dot(up, uSun);
      vec3 sun = uSunE * sunTrans(h, muS);
      float od = cloudLightOD(q, cov, fp);
      // Wrenninge 多次散射近似：三个八度
      vec3 Ls = vec3(0.0);
      float a = 1.0, b = 1.0, c = 1.0;
      for (int k = 0; k < 4; k++) {
        float ph = mix(hg(cs, -0.15 * c), hg(cs, 0.75 * c), 0.72);
        Ls += a * exp(-od * b) * ph * sun;
        a *= 0.5; b *= 0.25; c *= 0.5;
      }
      float h01 = clamp((h - CB) / (CT - CB), 0.0, 1.0);
      vec3 amb = uSunE * irr(h, muS) / PI * mix(0.35, 1.0, h01) * 1.0;
      // 海面反光从下面照亮云底（很弱）
      amb += uSunE * sunTrans(0.0, muS) * max(muS, 0.0) * 0.04 / PI;
      vec3 S = Ls * 4.0 * PI * 0.25 + amb;
      float sT = exp(-d * dt);
      L += T * S * (1.0 - sT);
      float dT = T * (1.0 - sT);
      tw += dT * t; wsum += dT;
      T *= sT;
    }
    t += dt;
  }
  if (T < 0.02) T = 0.0;
  if (wsum > 0.0) tMean = tw / wsum;
}

// 沿太阳方向到云层中部，粗略算一下云的遮挡（给海面、大气、地面投影）
float cloudShadow(vec3 q, float fp) {
  vec3 up; float h = altOf(q, up);
  float muS = dot(up, uSun);
  if (muS < -0.05) return 1.0;
  float od = 0.0;
  for (int i = 0; i < 3; i++) {
    float ah = mix(CB + 0.25, CT - 1.2, (float(i) + 0.5) / 3.0);
    vec2 hit = shellHits(max(h, 0.0), muS, ah);
    float ts = hit.x > 0.0 ? hit.x : hit.y;
    if (ts <= 0.0) continue;
    vec3 qs = q + uSun * ts;
    vec3 u2; float hs = altOf(qs, u2);
    float cov = coverage(u2, qs, max(fp, 0.3));
    od += cloudD(qs, hs, cov, max(fp, 0.6), false) * (CT - CB) / 3.0 / max(muS, 0.08) * 0.35;
  }
  return exp(-od);
}

// ---------------- 大气 ----------------
void atmos(float h0, vec3 rd, float t0, float tEnd, float tSplit, float jit, int N, bool shadows,
           out vec3 L, out vec3 T, out vec3 Ls, out vec3 Ts) {
  L = vec3(0.0); T = vec3(1.0); Ls = vec3(0.0); Ts = vec3(1.0);
  float cs = dot(rd, uSun);
  float pR = rayPhase(cs), pM = miePhase(cs);
  float seg = tEnd - t0;
  if (seg <= 0.0) return;
  bool quad = h0 < ATM_H;
  bool split = tSplit < 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= N) break;
    float x0 = float(i) / float(N), x1 = float(i + 1) / float(N);
    if (quad) { x0 *= x0; x1 *= x1; }
    float ta = t0 + seg * x0, tb = t0 + seg * x1;
    float dt = tb - ta;
    float t = mix(ta, tb, jit);
    vec3 q = uTdir * h0 + rd * t;
    vec3 up; float h = altOf(q, up);
    float muS = dot(up, uSun);
    vec3 rs; float ms; vec3 ext;
    medium(h, rs, ms, ext);
    vec3 st = sunTrans(h, muS);
    if (shadows && h < CT + 0.5 && st.g > 0.0) st *= cloudShadow(q, 0.5);
    vec3 msl = msLum(h, muS);
    vec3 S = uSunE * (rs * (pR * st + msl) + ms * (pM * st + msl));
    vec3 sT = exp(-ext * dt);
    vec3 dL = T * (S - S * sT) / ext;
    if (!split && tSplit < tb) {
      float f = clamp((tSplit - ta) / dt, 0.0, 1.0);
      Ls = L + dL * f; Ts = T * exp(-ext * dt * f); split = true;
    }
    L += dL; T *= sT;
  }
  if (!split) { Ls = L; Ts = T; }
}

vec3 sunDisk(vec3 rd) {
  const float SR = 0.00465;
  float c = dot(rd, uSun);
  float a = acos(clamp(c, -1.0, 1.0));
  if (a > SR * 1.6) return vec3(0.0);
  float r = clamp(a / SR, 0.0, 1.0);
  float limb = 1.0 - 0.6 * (1.0 - sqrt(max(1.0 - r * r, 0.0)));
  float edge = 1.0 - smoothstep(0.92, 1.08, a / SR);
  return vec3(uSunE / (PI * SR * SR)) * limb * edge;
}

vec3 stars(vec3 rd) {
  vec3 p = rd * 260.0;
  vec3 id = floor(p);
  vec3 h = hash33(id);
  if (h.x > 0.12) return vec3(0.0);
  vec3 c = id + 0.2 + 0.6 * hash33(id + 17.0);
  float d = length(p - c);
  float mag = pow(h.y, 6.0);
  float s = exp(-d * d * 90.0) * mag;
  vec3 tint = mix(vec3(1.0, 0.82, 0.66), vec3(0.75, 0.85, 1.0), h.z);
  return tint * s * uStars;
}

// ---------------- 地形（加那利群岛的真实高程） ----------------
// 高程来自 AWS Terrain Tiles（SRTM 等），按经纬度等距重采样成 2048x768，灰度 v 对应高度 v² × 3.8 千米
const vec4 DEM_BOX = vec4(-18.4, 27.55, 5.2, 1.95);  // 西边经度、南边纬度、经度跨度、纬度跨度（度）
const float DEM_H = 3.8;
const float DEM_TEXEL = 0.28;                        // 一个像素大约多少千米

vec2 demUV(vec3 up) {
  float lat = degrees(asin(clamp(up.y, -1.0, 1.0)));
  float lon = degrees(atan(up.x, up.z));
  return vec2((lon - DEM_BOX.x) / DEM_BOX.z, (DEM_BOX.y + DEM_BOX.w - lat) / DEM_BOX.w);
}
bool demIn(vec2 uv) { return uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0; }
float demH(vec2 uv, float lod) {
  if (!demIn(uv)) return 0.0;
  float v = textureLod(uDem, uv, lod).r;
  return v * v * DEM_H;
}
float demMax(vec2 uv) {
  if (!demIn(uv)) return 0.0;
  float v = textureLod(uDemMax, uv, 0.0).r;
  return v * v * DEM_H + 0.015;
}
float demLod(float fp) { return clamp(log2(max(fp, 1e-4) / DEM_TEXEL), 0.0, 8.0); }

// 光线和地形求交，返回距离（千米），没碰到返回 -1
float terrainTrace(float h0, vec3 rd, float tEnd, float pxA) {
  if (uTerrain < 0.5) return -1.0;
  vec3 ro = uTdir * h0;
  // 先和群岛的外接球求交，不经过就不走
  vec3 oc = ro - uDemC;
  float b = dot(oc, rd), c = dot(oc, oc) - uDemR * uDemR;
  float disc = b * b - c;
  if (disc < 0.0) return -1.0;
  float sq = sqrt(disc);
  float t0 = max(-b - sq, 0.0), t1 = -b + sq;
  if (t1 <= 0.0) return -1.0;
  // 再限制在 0 到 3.8 千米这层壳里
  vec2 top = shellHits(h0, dot(rd, uTdir), DEM_H);
  if (h0 > DEM_H) { if (top.x < 0.0) return -1.0; t0 = max(t0, top.x); t1 = min(t1, top.y); }
  else t1 = min(t1, top.y);
  if (tEnd > 0.0) t1 = min(t1, tEnd);
  if (t1 <= t0) return -1.0;
  float t = t0, tPrev = t0;
  float d = 1.0;
  for (int i = 0; i < 110; i++) {
    if (t > t1) return -1.0;
    vec3 q = ro + rd * t;
    vec3 up; float h = altOf(q, up);
    vec2 uv = demUV(up);
    if (h > demMax(uv)) {
      // 这一块和四周的山都比光线低：横着跨一块（约 4 千米）不会穿过山
      tPrev = t; t += 3.6; continue;
    }
    d = h - demH(uv, demLod(t * pxA));
    if (d < 0.0) {
      // 二分细化
      float a = tPrev, bb = t;
      for (int k = 0; k < 6; k++) {
        float m = 0.5 * (a + bb);
        vec3 qm = ro + rd * m;
        vec3 um; float hm = altOf(qm, um);
        if (hm - demH(demUV(um), demLod(m * pxA)) < 0.0) bb = m; else a = m;
      }
      return bb;
    }
    tPrev = t;
    t += max(d * 0.55, 0.004 + t * 0.0022);
  }
  return d < 0.03 ? t : -1.0;
}

// 地形挡太阳：朝太阳走一段，越走步子越大（太阳只有一两度高，影子能拖几十公里）
float terrainShadow(vec3 q, float pxA) {
  float sh = 1.0, t = 0.08;
  for (int i = 0; i < 20; i++) {
    vec3 qs = q + uSun * t;
    vec3 up; float h = altOf(qs, up);
    if (h > DEM_H) break;
    vec2 uv = demUV(up);
    if (!demIn(uv)) break;
    float dh = h - demH(uv, demLod(t * 0.004 + 0.05));
    sh = min(sh, clamp(dh / (t * 0.012) + 0.5, 0.0, 1.0));
    if (sh <= 0.0) break;
    t *= 1.36;
  }
  return sh;
}

vec3 terrainShade(vec3 q, float t, float pxA) {
  vec3 up; altOf(q, up);
  vec2 uv = demUV(up);
  float fp = max(t * pxA, 0.02);
  float e = max(fp, DEM_TEXEL);
  float lod = demLod(e);
  float hk = demH(uv, lod);
  // 当地的东、北
  vec3 ex = normalize(cross(vec3(0.0, 1.0, 0.0), up));
  vec3 nx = cross(up, ex);
  float coslat = sqrt(max(1.0 - up.y * up.y, 1e-4));
  vec2 du = vec2(e / (DEM_BOX.z * 111.195 * coslat), 0.0);
  vec2 dv = vec2(0.0, e / (DEM_BOX.w * 111.195));
  float gx = (demH(uv + du, lod) - demH(uv - du, lod)) / (2.0 * e);
  float gz = (demH(uv - dv, lod) - demH(uv + dv, lod)) / (2.0 * e);
  vec3 n = normalize(up - ex * gx - nx * gz);
  float slope = 1.0 - dot(n, up);
  float northness = dot(normalize(n - up * dot(n, up) + 1e-5), nx);
  // 程序化的地表：低处干的赭色（北坡偏绿），一两千米是加那利松林，再往上是浮石和黑熔岩的火山口原，顶上是泰德峰的锥
  vec3 wq = vec3(uv * vec2(DEM_BOX.z * 111.195 * coslat, DEM_BOX.w * 111.195) / 2.3, 0.4);
  float nz = textureLod(uShape, wq, clamp(log2(fp * uNoiseN / 2.3), 0.0, 7.0)).r;
  vec3 low = mix(vec3(0.17, 0.125, 0.085), vec3(0.085, 0.095, 0.06), clamp(northness * 0.6 + 0.45, 0.0, 1.0));
  vec3 alb = low;
  float pine = smoothstep(0.55, 0.95, hk) * (1.0 - smoothstep(1.85, 2.15, hk)) * clamp(0.35 + 0.8 * northness + (nz - 0.5), 0.0, 1.0);
  alb = mix(alb, vec3(0.04, 0.06, 0.032), pine);
  vec3 caldera = mix(vec3(0.33, 0.27, 0.19), vec3(0.07, 0.06, 0.055), smoothstep(0.42, 0.6, nz));
  alb = mix(alb, caldera, smoothstep(1.9, 2.2, hk));
  alb = mix(alb, vec3(0.2, 0.15, 0.11), smoothstep(2.8, 3.3, hk));
  alb *= mix(1.0, 0.7, smoothstep(0.15, 0.5, slope));
  float muS = dot(up, uSun);
  float nl = max(dot(n, uSun), 0.0);
  vec3 sunC = uSunE * sunTrans(hk, muS);
  float sh = nl > 0.0 ? terrainShadow(q + up * 0.004, pxA) * cloudShadow(q, max(fp, 0.08)) : 0.0;
  vec3 sky = uSunE * irr(hk, muS);
  return alb / PI * (sunC * nl * sh + sky * (0.55 + 0.45 * dot(n, up)));
}

// ---------------- 行星表面（从太空看） ----------------
float ggxD(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
float smithG1(float nx, float a) { float a2 = a * a; return 2.0 * nx / (nx + sqrt(a2 + (1.0 - a2) * nx * nx)); }

vec3 planetSurface(vec3 q, vec3 rd, float fp) {
  vec3 n; altOf(q, n);
  vec2 uv = dirUV(n);
  float lod = clamp(log2(fp / 9.77), 0.0, 10.0);
  vec3 alb = srgb2lin(textureLod(uDay, uv, lod).rgb);
  vec3 aux = textureLod(uAux, uv, max(lod - 1.0, 0.0)).rgb;
  float water = smoothstep(0.3, 0.7, aux.g);
  // 群岛范围里海岸线以高程为准（全球贴图十公里一个像素，岛的边缘糊出去好几公里）
  vec2 duv = demUV(n);
  if (uTerrain > 0.5 && demIn(duv)) {
    float land = smoothstep(0.0, 0.02, demH(duv, demLod(fp)));
    water = 1.0 - land;
    alb = mix(vec3(0.012, 0.03, 0.06), alb, land);
  }
  float muS = dot(n, uSun);
  vec3 sunC = uSunE * sunTrans(0.0, muS);
  float sh = cloudShadow(q, fp);
  vec3 sky = uSunE * irr(0.0, muS);
  vec3 col = alb / PI * (sunC * max(muS, 0.0) * sh + sky);
  vec3 v = -rd;
  float nv = max(dot(n, v), 0.02);
  // 海面高光（Cox-Munk 斜率方差）
  vec3 hv = normalize(v + uSun);
  float nh = max(dot(n, hv), 0.0);
  float al = 0.28;
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(v, hv), 0.0), 5.0);
  float nl = max(muS, 0.0);
  float spec = ggxD(nh, al) * smithG1(nv, al) * smithG1(max(nl, 1e-3), al) * F / (4.0 * nv);
  float Fv = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  col += water * (sunC * spec * sh + sky / PI * Fv * 0.9);
  // 夜面城市灯光：太阳落下去以后才亮
  float lights = pow(aux.r, 2.0);
  float night = smoothstep(0.04, -0.14, muS);
  col += vec3(1.0, 0.70, 0.40) * lights * night * uLights * (0.35 + 0.65 * sh);
  return col;
}

// ---------------- 近处海面（从空中看） ----------------
vec2 envUV(vec3 d) {
  float mu = clamp(d.y, 0.0, 1.0);
  float v = 1.0 - sqrt(mu);
  float u = atan(d.z, d.x) / (2.0 * PI) + 0.5;
  return vec2(u, v);
}

vec3 sunLocal() { return toLocal(uSun); }

vec3 oceanSurface(vec3 p, vec3 rdl, float fpM, float distKm, float shadowQ) {
  vec3 n; float var; float hgt;
  waveN(p.xz, fpM, n, var, hgt);
  vec3 v = -rdl;
  // 远处法线朝向视线的部分被遮挡，往上收一点
  if (dot(n, v) < 0.02) n = normalize(n + v * (0.02 - dot(n, v)));
  float nv = max(dot(n, v), 1e-3);
  vec3 sl = sunLocal();
  float al = clamp(sqrt(2.0 * var), 0.03, 0.7);
  vec3 r = reflect(rdl, n);
  r.y = abs(r.y);
  float F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  float envLod = clamp(log2(al * 256.0) - 1.0, 0.0, 7.0);
  vec3 env = textureLod(uEnv, envUV(r), envLod).rgb;
  vec3 sunC = uSunE * sunTrans(0.0, sl.y) * shadowQ;
  vec3 hv = normalize(v + sl);
  float nh = max(dot(n, hv), 0.0);
  float Fh = 0.02 + 0.98 * pow(1.0 - max(dot(v, hv), 0.0), 5.0);
  float nl = max(dot(n, sl), 0.0);
  float alS = max(al, 0.012);
  float spec = ggxD(nh, alS) * smithG1(nv, alS) * smithG1(max(nl, 1e-3), alS) * Fh / (4.0 * nv);
  vec3 col = F * env + sunC * spec;
  // 水体向上的散射光（深海的蓝）
  vec3 skyE = uSunE * irr(0.0, sl.y);
  vec3 down = skyE + sunC * max(sl.y, 0.0);
  col += (1.0 - F) * down * vec3(0.0006, 0.0028, 0.0060);
  // 浪尖透光：低角度太阳从浪背后穿过薄浪尖
  vec3 slh = normalize(vec3(sl.x, 0.0, sl.z));
  float back = pow(max(dot(-slh, normalize(vec3(v.x, 0.0, v.z))), 0.0), 3.0);
  float sss = back * smoothstep(0.25, 1.2, hgt) * (1.0 - smoothstep(0.03, 0.25, distKm));
  col += (1.0 - F) * sunC * sss * vec3(0.0025, 0.011, 0.009);
  return col;
}

// 近处海面求交（米），二分法
float oceanTrace(vec3 ro, vec3 rd, out bool ok) {
  ok = false;
  const float HM = 1.6;
  if (rd.y >= -1e-4 && ro.y > HM) return -1.0;
  float ta = ro.y > HM ? (ro.y - HM) / -rd.y : 0.0;
  float tb = (ro.y + HM) / max(-rd.y, 1e-4);
  tb = min(tb, 3000.0);
  if (tb <= ta) return -1.0;
  float da = ro.y + rd.y * ta - waveH((ro + rd * ta).xz, 14);
  // 先粗走几步找到第一次穿过
  float tPrev = ta, dPrev = da;
  float t = ta;
  bool found = false;
  for (int i = 0; i < 40; i++) {
    float step = max(0.06 + t * 0.02, dPrev * 0.5 / max(-rd.y, 0.08));
    t = min(t + step, tb);
    vec3 p = ro + rd * t;
    float d = p.y - waveH(p.xz, 14);
    if (d < 0.0) { found = true; ta = tPrev; da = dPrev; tb = t; break; }
    tPrev = t; dPrev = d;
    if (t >= tb) break;
  }
  if (!found) return -1.0;
  float tm = tb;
  for (int i = 0; i < 7; i++) {
    tm = 0.5 * (ta + tb);
    vec3 p = ro + rd * tm;
    float d = p.y - waveH(p.xz, 14);
    if (d > 0.0) ta = tm; else tb = tm;
  }
  ok = true;
  return tm;
}

// ---------------- 水下 ----------------
const vec3 WA = vec3(0.26, 0.046, 0.017);
const vec3 WBM = vec3(0.0011, 0.0024, 0.0058);
const float WBP = 0.028;
const vec3 WC = WA + WBM + vec3(WBP);
const vec3 KD = WA * 1.12 + vec3(0.004);
const vec3 CBEAM = WA + WBM + vec3(WBP * 0.3);

vec3 lightDirW() {
  vec3 sl = sunLocal();
  vec3 r = refract(-sl, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
  if (dot(r, r) < 1e-6) r = normalize(vec3(-sl.x, -0.75, -sl.z));
  return r;
}
// 菲涅耳：从折射率 n1 进入 n2，ci 是入射角余弦
float fresnelExact(float ci, float n1, float n2) {
  float st2 = (n1 / n2) * (n1 / n2) * (1.0 - ci * ci);
  if (st2 >= 1.0) return 1.0;
  float ct = sqrt(1.0 - st2);
  float rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct);
  float rp = (n1 * ct - n2 * ci) / (n1 * ct + n2 * ci);
  return 0.5 * (rs * rs + rp * rp);
}

float caustic(vec2 xz, float depth) {
  float lod = clamp(log2(1.0 + depth / 9.0) * 1.3, 0.0, 8.0);
  float c = textureLod(uCaustic, xz / 24.0, lod).r;
  return mix(1.0, c, exp(-depth / 70.0));
}

// 水下光源（以表面为准）
void waterLight(out vec3 Eb0, out vec3 Ea0, out vec3 Lw) {
  vec3 sl = sunLocal();
  Lw = lightDirW();
  float ci = max(sl.y, 0.0);
  float Ft = 1.0 - fresnelExact(max(ci, 1e-3), 1.0, 1.333);
  vec3 sunC = uSunE * sunTrans(0.0, sl.y);
  float ct = -Lw.y;
  Eb0 = sunC * Ft * ci / max(ct, 0.2);
  Ea0 = uSunE * irr(0.0, sl.y) * 0.93 + Eb0 * ct * 0.2;
}

// 无限深水里，从深度 z 向 rd 看过去的散射亮度（解析式）
vec3 deepRadiance(float z, vec3 rd, vec3 Eb0, vec3 Ea0, vec3 Lw) {
  float cs = dot(Lw, -rd);
  vec3 Eb = Eb0 * exp(-CBEAM * z / max(-Lw.y, 0.2));
  vec3 Ea = Ea0 * exp(-KD * z);
  vec3 S = (WBP * hg(cs, 0.86) + WBM * rayPhase(cs)) * Eb + (WBM + vec3(WBP)) * Ea / (4.0 * PI);
  float down = -rd.y;
  vec3 kk = WC + max(down, 0.0) * mix(KD, CBEAM / max(-Lw.y, 0.2), 0.5);
  return S / max(kk, vec3(1e-4));
}

vec3 underwater(vec3 ro, vec3 rd, float jit) {
  vec3 Eb0, Ea0, Lw;
  waterLight(Eb0, Ea0, Lw);
  float cs = dot(Lw, -rd);
  float phP = hg(cs, 0.86), phM = rayPhase(cs);
  // 到水面的距离
  float tS = -1.0;
  if (rd.y > 1e-4) {
    tS = (0.0 - ro.y) / rd.y;
    for (int i = 0; i < 4; i++) {
      vec3 p = ro + rd * tS;
      float d = waveH(p.xz, 14) - p.y;
      tS += d / rd.y * 0.8;
    }
    tS = max(tS, 0.0);
  }
  float tMax = tS > 0.0 ? min(tS, 160.0) : 160.0;
  vec3 L = vec3(0.0), T = vec3(1.0);
  const int N = 44;
  for (int i = 0; i < N; i++) {
    float x0 = float(i) / float(N), x1 = float(i + 1) / float(N);
    x0 *= x0; x1 *= x1;
    float ta = tMax * x0, tb = tMax * x1;
    float dt = tb - ta;
    float t = mix(ta, tb, jit);
    vec3 p = ro + rd * t;
    float z = max(-p.y, 0.0);
    // 光沿 Lw 方向从水面打下来：找它在水面的入射点，取焦散
    vec2 s = p.xz - Lw.xz * (z / -Lw.y);
    float ca = caustic(s, z);
    vec3 Eb = Eb0 * exp(-CBEAM * z / -Lw.y);
    vec3 Ea = Ea0 * exp(-KD * z);
    vec3 S = (WBP * phP * 4.0 + WBM * phM) * Eb * ca + (WBM + vec3(WBP)) * Ea / (4.0 * PI);
    vec3 sT = exp(-WC * dt);
    L += T * S * (1.0 - sT) / WC;
    T *= sT;
  }
  vec3 bg;
  if (tS > 0.0 && tS <= 160.0) {
    vec3 p = ro + rd * tS;
    vec3 n; float var; float hgt;
    waveN(p.xz, max(tS * 0.002, 0.01), n, var, hgt);
    vec3 nI = -n;
    float ci = max(dot(-rd, nI), 1e-3);
    vec3 refr = refract(rd, nI, 1.333);
    // 一个像素里还有看不见的毛细波：临界角附近用一段平滑的过渡代替陡变，全反射的边缘才不会像剪出来的
    const float C0 = 0.6612;  // 临界角的余弦
    float sg = 0.03 + 0.6 * sqrt(var) + 0.05 * smoothstep(2.0, 40.0, tS);
    float F = mix(1.0, fresnelExact(max(ci, C0 + sg), 1.333, 1.0), smoothstep(C0 - sg, C0 + sg, ci));
    if (dot(refr, refr) < 1e-6) refr = normalize(vec3(rd.x, 0.02, rd.z));
    vec3 refl = reflect(rd, nI);
    refl.y = min(refl.y, -0.05);
    vec3 Lr = deepRadiance(0.5, normalize(refl), Eb0, Ea0, Lw);
    vec3 Lt = vec3(0.0);
    if (F < 1.0) {
      vec3 o = normalize(refr);
      float al = clamp(sqrt(2.0 * var), 0.03, 0.5);
      Lt = textureLod(uEnv, envUV(o), clamp(log2(al * 256.0) - 2.0, 0.0, 6.0)).rgb;
      // 太阳透过水面：用粗糙透射近似出闪烁的太阳像
      vec3 sl = sunLocal();
      float cd = max(dot(o, sl), 0.0);
      float aT = 0.035 + al * 0.25;
      Lt += uSunE * sunTrans(0.0, sl.y) * ggxD(cd, aT) * 0.12;
      Lt *= 1.333 * 1.333;
      // 黄昏的天空透过几米海水会偏成黄绿；稍微往青白拉一点，接近人眼在水下的感受
      Lt = mix(Lt, vec3(dot(Lt, vec3(0.3, 0.5, 0.2))) * vec3(0.85, 1.0, 1.12), 0.3);
    }
    bg = mix(Lt, Lr, F);
  } else {
    vec3 pe = ro + rd * tMax;
    bg = deepRadiance(max(-pe.y, 0.0), rd, Eb0, Ea0, Lw);
  }
  return L + T * bg;
}

// ---------------- 水面以上 ----------------
vec3 shadeAbove(vec3 rd, float h0, vec3 roL, float jit, float pxA) {
  float mu = dot(rd, uTdir);
  vec3 rdl = toLocal(rd);
  // 地面求交（千米）
  float tG = -1.0;
  bool nearOcean = false;
  float tNear = -1.0;
  if (uOcean > 0.0 && roL.y < 80.0) {
    bool ok;
    float tm = oceanTrace(roL, rdl, ok);
    if (ok) { tNear = tm; nearOcean = true; tG = tm * 0.001; }
  }
  if (!nearOcean) {
    vec2 g = shellHits(max(h0, 1e-5), mu, 0.0);
    tG = g.x;
  }
  // 群岛：比海面近就画山
  bool onLand = false;
  if (h0 < 3000.0) {
    float tT = terrainTrace(h0, rd, tG, pxA);
    if (tT > 0.0) { tG = tT; onLand = true; }
  }
  // 大气范围
  vec2 at = shellHits(h0, mu, ATM_H);
  float tA0 = h0 > ATM_H ? at.x : 0.0;
  float tA1 = tG > 0.0 ? tG : at.y;
  if (h0 > ATM_H && at.x < 0.0) {
    return sunDisk(rd) + stars(rd);
  }
  // 云
  vec3 Lc; float Tc; float tc;
  int cSteps = h0 < 12.0 ? 110 : (h0 < 120.0 ? 72 : 40);
  marchClouds(h0, rd, tG, jit, pxA, cSteps, Lc, Tc, tc);
  // 背景
  vec3 bg;
  if (onLand) {
    bg = terrainShade(uTdir * h0 + rd * tG, tG, pxA);
  } else if (tG > 0.0) {
    vec3 q = uTdir * h0 + rd * tG;
    float fpKm = max(tG * pxA, 1e-5);
    vec3 planet = vec3(0.0), ocean = vec3(0.0);
    float om = uOcean;
    if (om < 1.0) planet = planetSurface(q, rd, fpKm);
    if (om > 0.0) {
      vec3 p = nearOcean ? roL + rdl * tNear : roL + rdl * (tG * 1000.0);
      float shQ = cloudShadow(q, max(fpKm, 0.08));
      float fpM = max(fpKm * 1000.0, 0.004) / pow(max(abs(rdl.y), 0.035), 0.5);
      ocean = oceanSurface(p, rdl, fpM, tG, shQ);
    }
    bg = mix(planet, ocean, om);
  } else {
    bg = sunDisk(rd) + stars(rd);
  }
  vec3 L, T, Ls, Ts;
  int aN = h0 > ATM_H ? 28 : 36;
  atmos(h0, rd, tA0, tA1, tc, jit, aN, h0 < 14.0 && uLocalCloud > 0.5, L, T, Ls, Ts);
  if (tc < 0.0) return L + T * bg;
  return Ls + Ts * Lc + Tc * ((L - Ls) + T * bg);
}
`,ee=a+o+f+`
out vec4 o;
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 ndc = frag / uRes * 2.0 - 1.0;
  vec3 rd = normalize(uFwd + ndc.x * uTan.x * uRight + ndc.y * uTan.y * uUpv);
  float jit = fract(ign(frag) + uFrame * 0.61803398);
  float pxA = 2.0 * uTan.y / uRes.y;
  vec3 roL = vec3(0.0, uCamYm, 0.0);
  float lensD = uCamYm;
  if (abs(uCamYm) < 3.0) {
    vec3 lens = roL + toLocal(ndc.x * (uTan.x / uTan.y) * uRight + ndc.y * uUpv) * 0.11;
    lensD = lens.y - waveH(lens.xz, 14);
    roL = lens;
  }
  if (abs(uCamYm) < 3.0) lensD += 0.0022 * sin(ndc.x * 5.3 + uTime * 2.3) + 0.0014 * sin(ndc.x * 12.7 - uTime * 3.1 + 1.7) + 0.0008 * sin(ndc.x * 29.0 + uTime * 4.2);
  float fw = max(fwidth(lensD), 1e-4);
  vec3 col;
  if (lensD < 0.0) {
    col = underwater(roL, toLocal(rd), jit) * uUnderBoost * uUnderGain;
    // 白平衡：浅处像眼睛一样补回一点红，深处把纯蓝往青色拉一点
    float zc = max(-uCamYm, 0.0);
    col *= mix(vec3(1.15, 0.95, 1.0), vec3(1.0), smoothstep(2.0, 25.0, zc));
    col.g += col.b * 0.2 * smoothstep(15.0, 90.0, zc);
  } else {
    col = shadeAbove(rd, max(uCamH, roL.y * 0.001), roL, jit, pxA);
  }
  // 镜头上的水线：一条暗一点、略亮边的弯月面
  if (abs(uCamYm) < 3.0) {
    float m = exp(-pow(lensD / (fw * 2.2), 2.0));
    col *= 1.0 - 0.55 * m;
  }
  o = vec4(max(col, vec3(0.0)), 1.0);
}`,te=a+o+f+`
uniform vec2 uEnvRes;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uEnvRes;
  float mu = (1.0 - uv.y); mu *= mu;
  float ph = (uv.x - 0.5) * 2.0 * PI;
  float s = sqrt(max(0.0, 1.0 - mu * mu));
  vec3 dl = vec3(s * cos(ph), mu, s * sin(ph));
  vec3 rd = toWorld(dl);
  float h0 = max(uCamH, 0.002);
  float jit = fract(ign(gl_FragCoord.xy) + uFrame * 0.61803398);
  float pxA = 2.0 * PI / uEnvRes.x;
  // 低处的方向可能碰到岛：海面才倒映得出山
  float tT = mu < 0.12 ? terrainTrace(h0, rd, -1.0, pxA) : -1.0;
  vec3 Lc; float Tc; float tc;
  marchClouds(h0, rd, tT, jit, pxA * 2.0, 44, Lc, Tc, tc);
  vec2 at = shellHits(h0, dot(rd, uTdir), ATM_H);
  vec3 L, T, Ls, Ts;
  atmos(h0, rd, 0.0, tT > 0.0 ? tT : at.y, tc, jit, 24, false, L, T, Ls, Ts);
  vec3 bg = tT > 0.0 ? terrainShade(uTdir * h0 + rd * tT, tT, pxA) : vec3(0.0);
  vec3 col = tc < 0.0 ? L + T * bg : Ls + Ts * Lc + Tc * ((L - Ls) + T * bg);
  o = vec4(col, 1.0);
}`,ne=a+`
#define NW 32
uniform vec4 uWA[NW];
uniform vec4 uWB[NW];
uniform float uTime;

uniform vec3 uSl;
uniform float uGrid;
out vec2 vOld;
out float vW;
const float TILE = 24.0;
const float DEPTH = 4.0;
void main() {
  int G1 = int(uGrid) + 1;
  float ix = float(gl_VertexID % G1), iy = float(gl_VertexID / G1);
  vec2 s = vec2(ix, iy) / uGrid * TILE;
  vec2 g = vec2(0.0);
  for (int i = 0; i < NW; i++) {
    vec4 a = uWA[i]; vec4 b = uWB[i];
    if (b.w < 0.5 || a.z > 5.2) continue;
    float th = a.z * dot(a.xy, s) - b.x * uTime + b.y;
    float u = 0.5 + 0.5 * sin(th);
    g += a.w * b.z * pow(u, b.z - 1.0) * cos(th) * a.z * a.xy;
  }
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 r = refract(-uSl, n, 1.0 / 1.333);
  vec3 r0 = refract(-uSl, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
  vW = smoothstep(0.0, 0.06, dot(n, uSl));
  if (dot(r, r) < 1e-6 || r.y > -0.05) { r = r0; vW = 0.0; }
  vec2 hit = s + r.xz * (DEPTH / -r.y) - r0.xz * (DEPTH / -r0.y);
  vec2 off = vec2(float(gl_InstanceID % 3 - 1), float(gl_InstanceID / 3 - 1)) * TILE;
  vOld = s;
  gl_Position = vec4((hit + off) / TILE * 2.0 - 1.0, 0.0, 1.0);
}`,re=a+`
in vec2 vOld;
in float vW;
uniform float uTexRes;
out vec4 o;
void main() {
  vec2 dx = dFdx(vOld), dy = dFdy(vOld);
  float aOld = abs(dx.x * dy.y - dx.y * dy.x);
  float px = 24.0 / uTexRes;
  float I = aOld / (px * px);
  o = vec4(min(I, 24.0) * vW, 0.0, 0.0, 1.0);
}`,ie=a+`
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aP;
layout(location = 2) in vec4 aQ;
uniform int uKind;
uniform vec3 uCamL;
uniform vec3 uRightL, uUpL, uFwdL;
uniform vec2 uTan;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uVelL;
uniform float uBox;
uniform vec3 uEb0, uEa0, uLw;
uniform float uGain;
out vec2 vC;
out float vL;
out vec3 vCol;
out float vRing;
const vec3 WA = vec3(0.26, 0.046, 0.017);
const vec3 WC = WA + vec3(0.0011, 0.0024, 0.0058) + vec3(0.028);
const vec3 KD = WA * 1.12 + vec3(0.004);
const vec3 CBEAM = WA + vec3(0.0011, 0.0024, 0.0058) + vec3(0.012);
vec2 proj(vec3 rel, out float z) {
  z = dot(rel, uFwdL);
  return vec2(dot(rel, uRightL) / (uTan.x * z), dot(rel, uUpL) / (uTan.y * z));
}
void main() {
  vec3 world;
  float size, bright = 1.0;
  vec3 tint = vec3(1.0);
  vRing = 0.0;
  if (uKind == 0) {
    // 海雪：相机周围一个会循环的盒子
    vec3 base = aP.xyz * uBox;
    vec3 drift = vec3(sin(uTime * 0.13 + aP.w * 40.0), -0.35 - aQ.x * 0.25, cos(uTime * 0.11 + aP.w * 31.0)) * 0.05 * uTime;
    vec3 rel = mod(base + drift - uCamL, uBox) - uBox * 0.5;
    world = uCamL + rel;
    size = 0.0016 + aQ.y * aQ.y * 0.0055;
  } else if (uKind == 1) {
    // 气泡：留在入水点附近，慢慢往上冒
    float rise = mod(aP.y * 4.5 + uTime * (0.18 + aQ.x * 0.35), 4.5);
    float wob = uTime * (2.0 + aQ.y * 3.0) + aP.w * 20.0;
    world = vec3(aP.x * 1.6 + sin(wob) * 0.02, -4.6 + rise, aP.z * 1.6 + cos(wob) * 0.02);
    size = 0.0015 + aQ.y * aQ.y * aQ.y * 0.011;
    bright = smoothstep(0.0, 0.4, -world.y) * smoothstep(4.6, 3.6, -world.y);
    vRing = 1.0;
  } else {
    // 荧光：aP.xyz 世界位置，aP.w 年龄（0..1），aQ.x 强度
    world = aP.xyz;
    size = 0.012 + aQ.y * 0.02;
    float age = aP.w;
    bright = aQ.x * smoothstep(0.0, 0.06, age) * exp(-age * 3.2);
    tint = mix(vec3(0.15, 0.75, 1.0), vec3(0.25, 1.0, 0.75), aQ.z);
  }
  vec3 rel = world - uCamL;
  float z;
  vec2 c = proj(rel, z);
  if (z < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float dist = length(rel);
  float depth = max(-world.y, 0.0);
  // 屏幕上的半径（像素），太小就按 1.2 像素画并降低亮度，保持能量
  float rpx = size / (uTan.y * z) * uRes.y * 0.5;
  float energy = 1.0;
  float near = smoothstep(0.7, 0.18, z);
  float bokeh = rpx + near * (0.25 / z) * 6.0;
  if (bokeh < 1.2) { energy = (bokeh * bokeh) / 1.44; bokeh = 1.2; }
  else energy = (rpx * rpx) / (bokeh * bokeh) + 0.0;
  // 拖影：相机下坠很快时，粒子拉成竖线
  vec3 relPrev = rel + uVelL * 0.035;
  float z2; vec2 c2 = proj(relPrev, z2);
  vec2 dpx = (c2 - c) * uRes * 0.5;
  float len = length(dpx);
  vec2 dir = len > 0.5 ? dpx / len : vec2(0.0, 1.0);
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 pc = aCorner;
  vec2 off = perp * pc.x * bokeh + dir * (pc.y * bokeh + (pc.y > 0.0 ? len : 0.0));
  vec2 ndc = c + off / (uRes * 0.5);
  vL = len / bokeh;
  vC = vec2(pc.x, pc.y > 0.0 ? 1.0 + vL : -1.0);
  float streak = bokeh / (bokeh + len);
  // 光照
  vec3 col;
  if (uKind == 2) {
    col = tint * bright * 0.0009;
  } else {
    vec3 Eb = uEb0 * exp(-CBEAM * depth / max(-uLw.y, 0.2));
    vec3 Ea = uEa0 * exp(-KD * depth);
    float cs = dot(uLw, normalize(-rel));
    float g = 0.6;
    float ph = (1.0 - g * g) / (4.0 * 3.14159 * pow(1.0 + g * g - 2.0 * g * cs, 1.5));
    col = (Ea * 0.42 + Eb * ph * 1.4) * bright;
    if (uKind == 1) col = (Ea * 0.5 + Eb * 0.8) * bright * 1.2;
  }
  col *= exp(-WC * dist) * energy * streak * (uKind == 2 ? 1.0 : uGain);
  vCol = col;
  gl_Position = vec4(ndc, 0.0, 1.0);
}`,ae=a+`
in vec2 vC;
in vec3 vCol;
in float vRing;
in float vL;
out vec4 o;
void main() {
  // 胶囊形：拖影时中间拉长
  float yy = vC.y < 0.0 ? vC.y : max(vC.y - vL, 0.0);
  float r = length(vec2(vC.x, yy));
  if (r > 1.0) discard;
  float a;
  if (vRing > 0.5) {
    a = smoothstep(1.0, 0.82, r) * (0.18 + 0.82 * smoothstep(0.55, 0.9, r));
    a += smoothstep(0.32, 0.0, length(vC - vec2(-0.3, 0.35))) * 0.8;
  } else {
    a = exp(-r * r * 3.0) * 1.3;
  }
  o = vec4(vCol * a, 1.0);
}`,oe=a+`
in vec2 vUV;
uniform sampler2D uCur;
uniform sampler2D uHist;
uniform float uW;
out vec4 o;
void main() {
  vec3 c = texture(uCur, vUV).rgb;
  vec3 h = texture(uHist, vUV).rgb;
  o = vec4(mix(c, h, uW), 1.0);
}`,se=a+`
in vec2 vUV;
uniform sampler2D uSrc;
out vec4 o;
void main() { o = vec4(texture(uSrc, vUV).rgb, 1.0); }`,ce=a+`
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uFirst;
uniform float uClampV;
out vec4 o;
vec3 s(vec2 d) { vec3 c = texture(uSrc, vUV + d * uTexel).rgb; return uFirst > 0.5 ? min(c, vec3(uClampV)) : c; }
void main() {
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uFirst > 0.5) r = min(r, vec3(uClampV));
  o = vec4(r, 1.0);
}`,le=a+`
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uTexel;
out vec4 o;
vec3 s(vec2 d) { return texture(uSrc, vUV + d * uTexel).rgb; }
void main() {
  vec3 r = s(vec2(0)) * 4.0 + (s(vec2(1, 0)) + s(vec2(-1, 0)) + s(vec2(0, 1)) + s(vec2(0, -1))) * 2.0
         + s(vec2(1, 1)) + s(vec2(-1, 1)) + s(vec2(1, -1)) + s(vec2(-1, -1));
  o = vec4(r / 16.0, 1.0);
}`,ue=a+`
in vec2 vUV;
uniform sampler2D uSrc;
uniform sampler2D uBloom;
uniform float uExposure;
uniform float uBloomK;
uniform float uTime;
uniform vec2 uOutRes;
uniform float uGrain;
uniform float uVig;
out vec4 o;
// ACES 拟合（Stephen Hill）
vec3 rrt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) {
  const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  return clamp(O * rrt(I * c), 0.0, 1.0);
}
// AgX（Troy Sobotka 的默认参数，多项式拟合），比 ACES 少一点蓝紫偏色
vec3 agxCurve(vec3 x) {
  vec3 x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx(vec3 c) {
  const mat3 inM = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                        0.0784335999999992, 0.878468636469772, 0.0784336,
                        0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 outM = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                         -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                         -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  const float mn = -12.47393, mx = 4.026069;
  c = inM * max(c, vec3(1e-10));
  c = clamp((log2(c) - mn) / (mx - mn), 0.0, 1.0);
  c = agxCurve(c);
  // 略加一点对比和饱和（punchy）
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = pow(max(c, 0.0), vec3(1.08));
  c = l + (c - l) * 1.12;
  c = outM * c;
  return clamp(pow(max(c, 0.0), vec3(2.2)), 0.0, 1.0);
}
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec3 c = texture(uSrc, vUV).rgb;
  vec3 b = texture(uBloom, vUV).rgb;
  c = mix(c, b, uBloomK);
  c *= uExposure;
  c = agx(c);
  vec2 q = vUV - 0.5;
  c *= 1.0 - uVig * dot(q, q) * 1.6;
  c = pow(c, vec3(1.0 / 2.2));
  vec2 px = vUV * uOutRes;
  float n = h12(px + fract(uTime * 13.37) * 1000.0) + h12(px * 1.37 + fract(uTime * 7.1) * 500.0) - 1.0;
  c += n * uGrain * (0.35 + 0.65 * (1.0 - c));
  c += (h12(px + 0.5) - 0.5) / 255.0;
  o = vec4(c, 1.0);
}`,p=[[0,16e6,90,-28,1.55,0],[.08,52e5,84,-20,1.7,0],[.15,15e5,52,-9,2.1,0],[.215,42e4,33,-3,2.6,0],[.27,13e4,22,-1,3.1,0],[.32,48e3,30,0,3.7,15],[.375,16e3,10,0,4.1,14],[.43,6800,9,0,4.2,14],[.47,4900,15,0,4.2,18],[.5,4e3,24,0,4.15,14],[.527,760,7,0,4.35,6],[.585,420,8,0,4.55,9],[.63,140,13,0,4.7,8],[.665,28,20,0,4.8,6],[.69,4,9,0,4.85,6],[.705,.4,3,0,4.9,3],[.722,-.4,2,0,5.2,0],[.74,-3,-7,0,6.2,0],[.775,-14,-24,0,6.6,0],[.82,-45,-28,0,6.8,0],[.87,-130,8,0,7,0],[.925,-380,58,0,7.1,0],[1,-1e3,88,0,7.2,0]],m=e=>Math.sign(e)*Math.log1p(Math.abs(e)),h=e=>Math.sign(e)*Math.expm1(Math.abs(e));function g(e,t){let n=e.length,r=[],i=Array(n);for(let i=0;i<n-1;i++)r.push((t[i+1]-t[i])/(e[i+1]-e[i]));i[0]=r[0],i[n-1]=r[n-2];for(let t=1;t<n-1;t++)if(r[t-1]*r[t]<=0)i[t]=0;else{let n=2*(e[t+1]-e[t])+(e[t]-e[t-1]),a=e[t+1]-e[t]+2*(e[t]-e[t-1]);i[t]=(n+a)/(n/r[t-1]+a/r[t])}return r=>{if(r<=e[0])return t[0];if(r>=e[n-1])return t[n-1];let a=0;for(;r>e[a+1];)a++;let o=e[a+1]-e[a],s=(r-e[a])/o,c=s*s,l=c*s;return(2*l-3*c+1)*t[a]+(l-2*c+s)*o*i[a]+(-2*l+3*c)*t[a+1]+(l-c)*o*i[a+1]}}var _=p.map(e=>e[0]),v=g(_,p.map(e=>m(e[1]))),y=g(_,p.map(e=>e[2])),b=g(_,p.map(e=>e[3])),x=g(_,p.map(e=>e[4])),S=g(_,p.map(e=>e[5]));function C(e){return{alt:h(v(e)),pitch:y(e),roll:b(e),ev:x(e),yaw:S(e)}}var w=[[7e5,`Exosphere`],[8e4,`Thermosphere`],[5e4,`Mesosphere`],[12e3,`Stratosphere`],[4400,`Troposphere`],[1300,`Cloud deck`],[.5,`Marine layer`],[-.5,`Sea surface`],[-200,`Sunlight zone`],[-1e3,`Twilight zone`],[-1e9,`Midnight zone`]];function T(e){for(let t of w)if(e>=t[0])return t[1];return w[w.length-1][1]}function de(e){let t=[[0,.06,1.8],[.27,.05,1.3],[.47,.04,1.6],[.512,.012,-.4],[.59,.04,1.4],[.712,.01,1.6],[.79,.04,1.4],[.99,.03,1]],n=1;for(let[r,i,a]of t)n+=a*Math.exp(-(((e-r)/i)**2));return n}var fe=28.3*Math.PI/180,E=-16.1*Math.PI/180,pe=6371,D=(e,t)=>[e[0]+t[0],e[1]+t[1],e[2]+t[2]],O=(e,t)=>[e[0]*t,e[1]*t,e[2]*t],me=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2],he=(e,t)=>[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]],ge=e=>O(e,1/Math.hypot(e[0],e[1],e[2])),_e=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},ve=e=>Math.min(1,Math.max(0,e)),k=[Math.cos(fe)*Math.sin(E),Math.sin(fe),Math.cos(fe)*Math.cos(E)],A=[Math.cos(E),0,-Math.sin(E)],ye=he(k,A),be=250*Math.PI/180,j=1.7*Math.PI/180,xe=ge(D(O(D(O(ye,Math.cos(be)),O(A,Math.sin(be))),Math.cos(j)),O(k,Math.sin(j)))),M=e=>[me(e,A),me(e,k),me(e,ye)],Se=D(O(((e,t)=>(e*=Math.PI/180,t*=Math.PI/180,[Math.cos(e)*Math.sin(t),Math.sin(e),Math.cos(e)*Math.cos(t)]))(27.55+1.95/2,-18.4+5.2/2),pe),O(k,-6371)),Ce=290,N=(()=>{let e=9.81,t=[],n=7,r=()=>(n=n*16807%2147483647)/2147483647;for(let[n,i,a]of[[118,12,.02],[83,-22,.024],[61,38,.027],[47,-41,.028],[37,5,.029],[29,63,.026],[23,-9,.025]]){let o=2*Math.PI/n,s=i*Math.PI/180;t.push([Math.cos(s),Math.sin(s),o,a/o,Math.sqrt(e*o),r()*6.28,1.5,0])}for(let[n,i]of[[3,1],[2,-3],[4,2],[1,5],[6,-1],[5,4],[7,2],[-3,7],[8,-3],[9,4],[2,11],[12,-5],[13,3],[-6,14],[16,5],[11,-15],[19,6],[22,-7],[9,23],[27,4],[-14,26],[31,-11],[24,25],[37,8],[-19,38]]){let a=Math.hypot(n,i),o=2*Math.PI*a/24,s=.062*(a/4)**-.1;t.push([n/a,i/a,o,s/o,Math.sqrt(e*o),r()*6.28,1.5,1])}return t})(),we=new Float32Array(N.length*4),Te=new Float32Array(N.length*4);N.forEach((e,t)=>{we.set(e.slice(0,4),t*4),Te.set(e.slice(4,8),t*4)});function Ee(e,t,n){let r=0;for(let i of N){let a=.5+.5*Math.sin(i[2]*(i[0]*e+i[1]*t)-i[4]*n+i[5]);r+=i[3]*(2*a**+i[6]-1)}return r}var De=e=>Math.exp(Math.min(.78*.021*Math.max(0,-e),7.6)),Oe=(()=>{let e=M(xe),t=Math.max(e[1],.001),n=Math.sqrt(1-t*t)*(1/1.333),r=Math.sqrt(1-n*n),i=Math.hypot(e[0],e[2]),a=[-e[0]/i*n,-r,-e[2]/i*n],o=(t-1.333*r)/(t+1.333*r),s=(1.333*t-r)/(1.333*t+r),c=1-.5*(o*o+s*s),l=[.1,.035,.01].map(e=>e*c*t/r);return{Eb:l,Ea:[.01,.016,.026].map((e,t)=>e*.93+l[t]*r*.2),Lw:a}})();function ke(e,t,n,r={}){let i=e.createTexture();e.bindTexture(e.TEXTURE_2D,i);let a={rgba16f:[e.RGBA16F,e.RGBA,e.HALF_FLOAT],r16f:[e.R16F,e.RED,e.HALF_FLOAT]}[r.fmt||`rgba16f`];return e.texImage2D(e.TEXTURE_2D,0,a[0],t,n,0,a[1],a[2],null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,r.mip?e.LINEAR_MIPMAP_LINEAR:e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,r.repeat?e.REPEAT:e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,r.repeat?e.REPEAT:e.CLAMP_TO_EDGE),r.mip&&e.generateMipmap(e.TEXTURE_2D),i}function P(e,t,n,r={}){let i=ke(e,t,n,r),a=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,a),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,i,0),e.bindFramebuffer(e.FRAMEBUFFER,null),{tex:i,fb:a,w:t,h:n}}function Ae(e,t){t&&(e.deleteTexture(t.tex),e.deleteFramebuffer(t.fb))}function je(e,t,n){let r=e.createTexture();e.bindTexture(e.TEXTURE_2D,r),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.raw?e.NONE:e.BROWSER_DEFAULT_WEBGL),e.texImage2D(e.TEXTURE_2D,0,n.single?e.R8:e.RGB8,n.single?e.RED:e.RGB,e.UNSIGNED_BYTE,t),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),n.nearest||e.generateMipmap(e.TEXTURE_2D),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,n.nearest?e.NEAREST:e.LINEAR_MIPMAP_LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,n.nearest?e.NEAREST:e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,n.clamp?e.CLAMP_TO_EDGE:e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let i=e.getExtension(`EXT_texture_filter_anisotropic`);return i&&e.texParameterf(e.TEXTURE_2D,i.TEXTURE_MAX_ANISOTROPY_EXT,8),r}function F(e,t,n,r){let i=(t,n)=>{let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r},a=i(e.VERTEX_SHADER,t),o=i(e.FRAGMENT_SHADER,n),s=e.createProgram();return e.attachShader(s,a),e.attachShader(s,o),e.linkProgram(s),{p:s,v:a,f:o,name:r,u:{}}}function Me(e,t){if(!e.getProgramParameter(t.p,e.LINK_STATUS))throw Error(`着色器 ${t.name} 编不过：${e.getShaderInfoLog(t.v)||``}${e.getShaderInfoLog(t.f)||``}${e.getProgramInfoLog(t.p)||``}`);e.deleteShader(t.v),e.deleteShader(t.f);let n=e.getProgramParameter(t.p,e.ACTIVE_UNIFORMS);for(let r=0;r<n;r++){let n=e.getActiveUniform(t.p,r);t.u[n.name.replace(/\[0\]$/,``)]=e.getUniformLocation(t.p,n.name)}}var Ne=128,Pe=512,Fe=220,Ie=192,Le=96,Re=30,ze=24;function I(e,{textures:n,big:r=!1,still:i=!1,onFrame:a=()=>{},onStatus:o=()=>{}}){let f=e.parentElement,p=!1,m=!1,h=i,g=[],_=(e,t,n,r)=>{e.addEventListener(t,n,r),g.push(()=>e.removeEventListener(t,n,r))},v=e.getContext(`webgl2`,{antialias:!1,alpha:!1,depth:!1,stencil:!1,premultipliedAlpha:!1,powerPreference:`high-performance`}),y=e=>{p||(e&&console.warn(e),m=!1,p=!0,v?.getExtension(`WEBGL_lose_context`)?.loseContext(),o(`poster`))};if(!v||t(v))return queueMicrotask(()=>y()),{nudge(){},seek(){},play(){},setStill(){},get auto(){return!1},destroy(){p=!0}};v.getExtension(`EXT_color_buffer_float`),v.getExtension(`EXT_color_buffer_half_float`),v.getExtension(`OES_texture_float_linear`),_(e,`webglcontextlost`,e=>{e.preventDefault(),y()});let b=0,x=0,S=!1,w=[0,0],T=[0,0],fe=C(0).alt,E=0,me=0,j=0,N=performance.now(),ke=12,I,L,R,Be,Ve,He,Ue,We,Ge,z,B,V,Ke,H,U={},qe=0,Je=0,W=0,G=0,K=.72,Ye=!0,Xe,Ze,Qe,$e,q=[],J=[];function et(e,t){let n=v.createTexture();v.bindTexture(v.TEXTURE_3D,n),v.texStorage3D(v.TEXTURE_3D,Math.log2(e)+1,v.RGBA8,e,e,e);let r=v.createFramebuffer();v.bindFramebuffer(v.FRAMEBUFFER,r),v.useProgram(I.noise.p),v.uniform1f(I.noise.u.uSize,e),v.uniform1i(I.noise.u.uKind,t),v.viewport(0,0,e,e);for(let t=0;t<e;t++)v.framebufferTextureLayer(v.FRAMEBUFFER,v.COLOR_ATTACHMENT0,n,0,t),v.uniform1f(I.noise.u.uZ,t),v.drawArrays(v.TRIANGLES,0,3);v.bindFramebuffer(v.FRAMEBUFFER,null),v.deleteFramebuffer(r),v.bindTexture(v.TEXTURE_3D,n),v.generateMipmap(v.TEXTURE_3D),v.texParameteri(v.TEXTURE_3D,v.TEXTURE_MIN_FILTER,v.LINEAR_MIPMAP_LINEAR),v.texParameteri(v.TEXTURE_3D,v.TEXTURE_MAG_FILTER,v.LINEAR);for(let e of[v.TEXTURE_WRAP_S,v.TEXTURE_WRAP_T,v.TEXTURE_WRAP_R])v.texParameteri(v.TEXTURE_3D,e,v.REPEAT);return n}function tt(e,t,n){let r=v.createVertexArray();v.bindVertexArray(r);let i=v.createBuffer();v.bindBuffer(v.ARRAY_BUFFER,i),v.bufferData(v.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),v.STATIC_DRAW),v.enableVertexAttribArray(0),v.vertexAttribPointer(0,2,v.FLOAT,!1,0,0);let a=new Float32Array(e*8);for(let n=0;n<e;n++)t(a,n);let o=v.createBuffer();return v.bindBuffer(v.ARRAY_BUFFER,o),v.bufferData(v.ARRAY_BUFFER,a,n?v.DYNAMIC_DRAW:v.STATIC_DRAW),v.enableVertexAttribArray(1),v.vertexAttribPointer(1,4,v.FLOAT,!1,32,0),v.vertexAttribDivisor(1,1),v.enableVertexAttribArray(2),v.vertexAttribPointer(2,4,v.FLOAT,!1,32,16),v.vertexAttribDivisor(2,1),v.bindVertexArray(L),{va:r,buf:o,data:a,count:e}}let nt=()=>Promise.all([`day`,`aux`,`clouds`,`dem`,`demMax`].map(async e=>{let t=new Image;return t.decoding=`async`,t.src=n[e],await t.decode(),[e,t]}));async function rt(){let e=nt(),t=v.getExtension(`KHR_parallel_shader_compile`);if(I={tlut:F(v,s,c,`tlut`),ms:F(v,s,l,`ms`),ir:F(v,s,u,`ir`),noise:F(v,s,d,`noise`),main:F(v,s,ee,`main`),env:F(v,s,te,`env`),caustic:F(v,ne,re,`caustic`),part:F(v,ie,ae,`part`),accum:F(v,s,oe,`accum`),copy:F(v,s,se,`copy`),down:F(v,s,ce,`down`),up:F(v,s,le,`up`),final:F(v,s,ue,`final`)},t){let e=()=>Object.values(I).every(e=>v.getProgramParameter(e.p,t.COMPLETION_STATUS_KHR));for(;!e();)if(await new Promise(e=>setTimeout(e,50)),p)return}for(let e in I)Me(v,I[e]);if(L=v.createVertexArray(),v.bindVertexArray(L),v.disable(v.BLEND),R=P(v,256,64),v.bindFramebuffer(v.FRAMEBUFFER,R.fb),v.checkFramebufferStatus(v.FRAMEBUFFER)!==v.FRAMEBUFFER_COMPLETE)throw Error(`画不进半浮点的离屏图`);Be=P(v,32,32),Ve=P(v,64,16);let n=e=>{v.bindFramebuffer(v.FRAMEBUFFER,e.fb),v.viewport(0,0,e.w,e.h),v.drawArrays(v.TRIANGLES,0,3)};v.useProgram(I.tlut.p),n(R),v.useProgram(I.ms.p),Y(I.ms,`uTLUT`,R.tex,0),n(Be),v.useProgram(I.ir.p),Y(I.ir,`uTLUT`,R.tex,0),Y(I.ir,`uMSLUT`,Be.tex,1),n(Ve),He=et(Ne,0),Ue=et(32,1),We=P(v,Pe,Pe,{fmt:`r16f`,mip:!0,repeat:!0});{let e=new Uint32Array(290400),t=0;for(let n=0;n<Fe;n++)for(let r=0;r<Fe;r++){let i=n*221+r,a=i+1,o=i+221,s=o+1;e.set([i,a,o,a,s,o],t),t+=6}Ge=v.createVertexArray(),v.bindVertexArray(Ge),v.bindBuffer(v.ELEMENT_ARRAY_BUFFER,v.createBuffer()),v.bufferData(v.ELEMENT_ARRAY_BUFFER,e,v.STATIC_DRAW),z=e.length,v.bindVertexArray(L)}B=P(v,Ie,Le,{mip:!0,repeat:!0});let r=12345,i=()=>(r=r*16807%2147483647)/2147483647;V=tt(2600,(e,t)=>e.set([i(),i(),i(),i(),i(),i(),0,0],t*8)),Ke=tt(520,(e,t)=>{let n=Math.sqrt(i())*.9,r=i()*6.283;e.set([Math.cos(r)*n,i(),Math.sin(r)*n,i(),i(),i(),0,0],t*8)}),H=tt(160,(e,t)=>e.set([0,0,0,2,0,0,0,0],t*8),!0);let a=await e;if(!p){for(let[e,t]of a)U[e]=je(v,t,{single:e!==`day`&&e!==`aux`,raw:e===`dem`||e===`demMax`,nearest:e===`demMax`,clamp:e===`dem`||e===`demMax`});m=!0,o(`ready`),Q()}}function Y(e,t,n,r,i){let a=e.u[t];a!=null&&(v.activeTexture(v.TEXTURE0+r),v.bindTexture(i||v.TEXTURE_2D,n),v.uniform1i(a,r))}function it(e){e&&(v.bindFramebuffer(v.FRAMEBUFFER,e.fb),v.viewport(0,0,e.w,e.h)),v.drawArrays(v.TRIANGLES,0,3)}function at(){Ye=!1;let t=f.getBoundingClientRect();if(t.width<8||t.height<8)return!1;let n=Math.min(window.devicePixelRatio||1,2),r=Math.round(t.width*n),i=Math.round(t.height*n),a=Math.min(1,K*Math.min(1,1100/Math.sqrt(t.width*t.height))),o=Math.max(64,Math.round(t.width*a)),s=Math.max(48,Math.round(t.height*a));if((r!==qe||i!==Je)&&(qe=r,Je=i,e.width=r,e.height=i),o===W&&s===G)return!0;W=o,G=s,[Xe,Ze,Qe,$e,...q].forEach(e=>Ae(v,e)),Xe=P(v,W,G),Ze=P(v,W,G),Qe=P(v,W,G),$e=P(v,W,G),q=[];let c=W,l=G;for(let e=0;e<6;e++)c=Math.max(2,c>>1),l=Math.max(2,l>>1),q.push(P(v,c,l));return j=0,!0}function ot(e){let t=C(b),n=ve((3-Math.abs(t.alt))/2.5);n>0&&(t.alt+=Ee(0,0,e)*n*n*(3-2*n));let r=W/G,i=Math.max(Math.tan(26*Math.PI/180)*Math.sqrt(r),.4),a=i/r;a<.38&&(a=.38,i=a*r),i>1&&(i=1,a=1/r);let o=(t.pitch+w[1])*Math.PI/180,s=be+(w[0]+t.yaw)*Math.PI/180,c=D(O(ye,Math.cos(s)),O(A,Math.sin(s))),l=ge(D(O(c,Math.cos(o)),O(k,-Math.sin(o)))),u=ge(D(O(c,Math.sin(o)),O(k,Math.cos(o)))),d=he(l,u),f=t.roll*Math.PI/180;return{c:t,fwd:l,tanX:i,tanY:a,right:D(O(d,Math.cos(f)),O(u,Math.sin(f))),up:D(O(u,Math.cos(f)),O(d,-Math.sin(f)))}}function st(e,t,n){let r=e.u,i=t.c.alt,a=Math.max(i,0)/1e3;v.uniform2f(r.uRes,W,G),v.uniform1f(r.uTime,n),v.uniform1f(r.uFrame,me%64),v.uniform1f(r.uCamH,a),v.uniform1f(r.uCamYm,i),v.uniform3fv(r.uTdir,k),v.uniform3fv(r.uTP,O(k,pe)),v.uniform3fv(r.uDemC,Se),v.uniform1f(r.uDemR,Ce),v.uniform1f(r.uTerrain,1),v.uniform3fv(r.uE,A),v.uniform3fv(r.uN,ye),v.uniform3fv(r.uFwd,t.fwd),v.uniform3fv(r.uRight,t.right),v.uniform3fv(r.uUpv,t.up),v.uniform2f(r.uTan,t.tanX,t.tanY),v.uniform3fv(r.uSun,xe),v.uniform1f(r.uOcean,1-_e(22,70,a)),v.uniform1f(r.uLocalCloud,+(a<14)),v.uniform3fv(r.uWind,D(O(A,.011*n),O(ye,.004*n))),v.uniform1f(r.uSunE,1),v.uniform1f(r.uLights,.022),v.uniform1f(r.uStars,.05),v.uniform1f(r.uNoiseN,Ne),v.uniform1f(r.uUnderGain,De(i)),v.uniform1f(r.uUnderBoost,1+1.4*_e(-2.8,-.2,i)*(1-_e(1.5,3,i))),v.uniform4fv(r.uWA,we),v.uniform4fv(r.uWB,Te),Y(e,`uTLUT`,R.tex,0),Y(e,`uMSLUT`,Be.tex,1),Y(e,`uIRLUT`,Ve.tex,2),Y(e,`uDay`,U.day,3),Y(e,`uAux`,U.aux,4),Y(e,`uCloudMap`,U.clouds,5),Y(e,`uEnv`,B.tex,6),Y(e,`uCaustic`,We.tex,7),Y(e,`uShape`,He,8,v.TEXTURE_3D),Y(e,`uDetail`,Ue,9,v.TEXTURE_3D),Y(e,`uDem`,U.dem,10),Y(e,`uDemMax`,U.demMax,11)}function ct(e){for(let t=J.length-1;t>=0;t--){let n=J[t];n.age+=e/n.life,n.pos[1]+=e*.02,n.age>=1&&J.splice(t,1)}H.data.fill(0);for(let e=0;e<160;e++)H.data[e*8+3]=2;J.slice(0,160).forEach((e,t)=>H.data.set([e.pos[0],e.pos[1],e.pos[2],e.age,e.k,e.size,e.hue,0],t*8))}function lt(e,t,n){if(!m||h)return;let r=C(b);if(r.alt>-420)return;let i=ot(0);for(let a=0;a<n;a++){let n=ge(D(D(i.fwd,O(i.right,(e+(Math.random()-.5)*.05)*i.tanX)),O(i.up,(t+(Math.random()-.5)*.05)*i.tanY))),a=.9+Math.random()*2.6,o=M(n);J.push({pos:[o[0]*a,r.alt+o[1]*a,o[2]*a],age:0,life:1.6+Math.random()*1.8,k:.5+Math.random()*.9,size:Math.random(),hue:Math.random()}),J.length>160&&J.shift()}Q()}function ut(e,t){let n=ot(e),r=n.c.alt,i=Math.max(r,0)/1e3;if(E=E*.8+(r-fe)/Math.max(t,.001)*.2,fe=r,v.disable(v.BLEND),v.bindVertexArray(L),i<90&&(v.useProgram(I.env.p),st(I.env,n,e),v.uniform2f(I.env.u.uEnvRes,Ie,Le),it(B),v.bindTexture(v.TEXTURE_2D,B.tex),v.generateMipmap(v.TEXTURE_2D)),r<30){v.bindFramebuffer(v.FRAMEBUFFER,We.fb),v.viewport(0,0,Pe,Pe),v.clearColor(0,0,0,1),v.clear(v.COLOR_BUFFER_BIT),v.enable(v.BLEND),v.blendFunc(v.ONE,v.ONE);let t=I.caustic,n=t.u;v.useProgram(t.p),v.uniform4fv(n.uWA,we),v.uniform4fv(n.uWB,Te),v.uniform1f(n.uTime,e),v.uniform3fv(n.uSl,M(xe)),v.uniform1f(n.uGrid,Fe),v.uniform1f(n.uTexRes,Pe),v.bindVertexArray(Ge),v.drawElementsInstanced(v.TRIANGLES,z,v.UNSIGNED_INT,0,9),v.bindVertexArray(L),v.disable(v.BLEND),v.bindTexture(v.TEXTURE_2D,We.tex),v.generateMipmap(v.TEXTURE_2D)}v.useProgram(I.main.p),st(I.main,n,e),it(Xe);let a=j>2?Math.min(.85,j/(j+2)):0;if(v.useProgram(I.accum.p),Y(I.accum,`uCur`,Xe.tex,0),Y(I.accum,`uHist`,Ze.tex,1),v.uniform1f(I.accum.u.uW,a),it(Qe),[Ze,Qe]=[Qe,Ze],v.useProgram(I.copy.p),Y(I.copy,`uSrc`,Ze.tex,0),it($e),r<0){v.enable(v.BLEND),v.blendFunc(v.ONE,v.ONE);let i=I.part,a=i.u;v.useProgram(i.p),v.uniform3f(a.uCamL,0,r,0),v.uniform3fv(a.uRightL,M(n.right)),v.uniform3fv(a.uUpL,M(n.up)),v.uniform3fv(a.uFwdL,M(n.fwd)),v.uniform2f(a.uTan,n.tanX,n.tanY),v.uniform2f(a.uRes,W,G),v.uniform1f(a.uTime,e),v.uniform3f(a.uVelL,0,-Math.max(-60,Math.min(60,E)),0),v.uniform1f(a.uBox,7),v.uniform1f(a.uGain,De(r)*(1+3*ve((r+2.8)/2.6))),v.uniform3fv(a.uEb0,Oe.Eb),v.uniform3fv(a.uEa0,Oe.Ea),v.uniform3fv(a.uLw,Oe.Lw),v.uniform1i(a.uKind,0),v.bindVertexArray(V.va),v.drawArraysInstanced(v.TRIANGLE_STRIP,0,4,V.count),r>-40&&(v.uniform1i(a.uKind,1),v.bindVertexArray(Ke.va),v.drawArraysInstanced(v.TRIANGLE_STRIP,0,4,Ke.count)),J.length&&(ct(t),v.uniform1i(a.uKind,2),v.bindVertexArray(H.va),v.bindBuffer(v.ARRAY_BUFFER,H.buf),v.bufferSubData(v.ARRAY_BUFFER,0,H.data),v.drawArraysInstanced(v.TRIANGLE_STRIP,0,4,160)),v.bindVertexArray(L),v.disable(v.BLEND)}let o=$e;v.useProgram(I.down.p);for(let e=0;e<q.length;e++)Y(I.down,`uSrc`,o.tex,0),v.uniform2f(I.down.u.uTexel,1/o.w,1/o.h),v.uniform1f(I.down.u.uFirst,+(e===0)),v.uniform1f(I.down.u.uClampV,24/2**n.c.ev),it(q[e]),o=q[e];v.useProgram(I.up.p),v.enable(v.BLEND),v.blendFunc(v.ONE,v.ONE);for(let e=q.length-1;e>0;e--)Y(I.up,`uSrc`,q[e].tex,0),v.uniform2f(I.up.u.uTexel,1/q[e].w,1/q[e].h),it(q[e-1]);v.disable(v.BLEND),v.bindFramebuffer(v.FRAMEBUFFER,null),v.viewport(0,0,qe,Je);let s=I.final,c=s.u;return v.useProgram(s.p),Y(s,`uSrc`,$e.tex,0),Y(s,`uBloom`,q[0].tex,1),v.uniform1f(c.uExposure,2**n.c.ev),v.uniform1f(c.uBloomK,.045),v.uniform1f(c.uTime,e),v.uniform2f(c.uOutRes,qe,Je),v.uniform1f(c.uGrain,.022),v.uniform1f(c.uVig,.28),v.drawArrays(v.TRIANGLES,0,3),me++,n.c.alt}let X=0,dt=!0,Z=-1,ft=-1e9,pt=0,mt=0;function Q(){!X&&!p&&m&&dt&&!document.hidden&&(X=requestAnimationFrame(ht))}function ht(e){if(X=0,p||!m||!dt||document.hidden)return;let t=Z<0?1/60:Math.min(.1,(e-Z)/1e3);if(Z=e,Ye&&!at())return;S&&(x=Math.min(1,x+t/78/de(x)*1.55),x>=1&&(S=!1));let n=b;h?b=x:(b+=(x-b)*(1-Math.exp(-t*2.6)),Math.abs(x-b)<1e-6&&(b=x)),w[0]+=(T[0]-w[0])*(1-Math.exp(-t*3)),w[1]+=(T[1]-w[1])*(1-Math.exp(-t*3));let r=S||b!==n||Math.abs(x-b)>2e-5||Math.abs(T[0]-w[0])>.01||Math.abs(T[1]-w[1])>.01,i=!h&&(C(b).alt<2e4||J.length>0);if(r)j=0;else if(!i&&j>=ze){Z=-1;return}else if(i&&j>=ze&&e-ft<1e3/Re-2){X=requestAnimationFrame(ht);return}let o=(e-ft)/1e3;if(r&&o<.1&&(pt+=o,mt++,mt>=30)){let e=pt/mt;pt=0,mt=0,e>1/40&&K>.42?(K=Math.max(.42,K*.86),Ye=!0):e<1/58&&K<1&&(K=Math.min(1,K*1.08),Ye=!0)}ft=e,r||j++;let s=ut(h?ke:(e-N)/1e3,t);a({p:b,alt:s,auto:S}),X=requestAnimationFrame(ht)}function gt(e){x=ve(x+e),S=!1,Q()}function _t(t){let n=e.getBoundingClientRect();return[(t.clientX-n.left)/n.width*2-1,1-(t.clientY-n.top)/n.height*2,n]}let $=null,vt=0;_(e,`pointerdown`,t=>{if(!m||t.pointerType===`mouse`&&t.button!==0)return;$={id:t.pointerId,y:t.clientY},t.pointerType===`mouse`&&(e.setPointerCapture(t.pointerId),e.style.cursor=`grabbing`);let[n,r]=_t(t);lt(n,r,3)}),_(e,`pointermove`,e=>{if(!m)return;let[t,n,r]=_t(e);$&&$.id===e.pointerId&&(gt(($.y-e.clientY)/(r.height*9)/Math.sqrt(de(x))),$.y=e.clientY),e.pointerType===`mouse`&&!h&&(T=[t*2.5,-n*1.6],Q());let i=performance.now();i-vt>28&&(lt(t,n,e.pointerType===`mouse`?1:2),vt=i)});let yt=t=>{$&&$.id===t.pointerId&&($=null,e.style.cursor=``)};_(e,`pointerup`,yt),_(e,`pointercancel`,yt),_(e,`pointerleave`,e=>{e.pointerType===`mouse`&&(T=[0,0],Q())}),r&&_(f,`wheel`,e=>{if(!m)return;let t=e.deltaMode===1?e.deltaY*32:e.deltaMode===2?e.deltaY*600:e.deltaY;t<0&&x<=0||t>0&&x>=1||(e.preventDefault(),gt(t/14e3/Math.sqrt(de(x))))},{passive:!1});let bt=new IntersectionObserver(([e])=>{dt=e.isIntersecting,dt&&(Z=-1,Q())});bt.observe(f);let xt=new ResizeObserver(()=>{Ye=!0,j=0,Q()});return xt.observe(f),_(document,`visibilitychange`,()=>{document.hidden||(Z=-1,Q())}),rt().catch(e=>y(e.message)),{nudge:gt,seek(e){x=ve(e),S=!1,Q()},play(e){h||(S=e,S&&x>=.999&&(x=0,b=0),j=0,Q())},setStill(e){h=e,h&&(ke=(performance.now()-N)/1e3,S=!1,T=[0,0],J.length=0),j=0,Z=-1,Q()},get auto(){return S},destroy(){p=!0,m=!1,cancelAnimationFrame(X),X=0,bt.disconnect(),xt.disconnect(),g.forEach(e=>e()),v.getExtension(`WEBGL_lose_context`)?.loseContext()}}}var L=`/_astro/earth-day-4k.DlOKD6JD.webp`,R=`/_astro/earth-day-2k.B0KsE42w.webp`,Be=`/_astro/clouds-4k.Bk9ePbO_.webp`,Ve=`/_astro/clouds-2k.3NE7smOM.webp`,He=`/_astro/lights-land.DwBdlSrA.webp`,Ue=`/_astro/canary-dem.DS8lX-48.webp`,We=`data:image/webp;base64,UklGRqoDAABXRUJQVlA4TJ4DAAAvf8ALADVQum3btPXsz/b3bNu2bdu28dm2bdu2WQvqqaXlF6R+7/fuwT0tKc4Z0f8JEFo9l4SmR0SR0/7XC4oATLQtpgSYpWWeNXWAs3ZNnh5YD2iXiX0EmtsBrTJPZSapk+6kSQ6xOfkFFdRJW6xJXmllQC1ZzuJYjcorq2EtWYg4B02y8G8kdbLjfEyEgTMCSN8ZpJELog7z0vzMhcFVa9cBK0fLtKAs0NVUGF65/vbzl+TFMXdjVwlECknrdj7/Bnx6sb/GeM1cYO5OOlmaTNeq2Xa+UWSw5SKhVZbxZDTpKRVWXn/2Gniyp1i+aYBYDKjANSG1DEC8ZKWrzz4gbw0sksvUvKCBg0CPu/J8ixrJirJ4IXn68APypmzW8Z0rN5DLx/rTFRcUK1ukMio7BtSyKCWjSifJVTp03wOu1QoZ59GkfsNOUh1mGW1kI1meZCWD/35ym5U0NgAFPEMHd18GTq8ZQktJcoTCQlq7yNZ6FMeYy4AWIENI6UaWVaFvzQ7gEXDjNNuqIgGh8Dg91SwMWiCH5K0rt+w+ePjYrWf4AODG6TW1Me6kwuJz9RQxUyUHjt5899ff5I9v+HBjX5ODUPy8gtqGDqCxiLlB01Vy69M//wJ/fsOH481OQgVFTUAdSOY6CsX6d5Nlfjp23RN6c6zBEDPARGAWSTl8dMrzc0nOU4zJsjWbgOFudwGUDx/+xZePN3dWi4nPc/ACPGfbBQPSLYimTr5OtFBs3Mb9h4Dt69vMBFC8/vzbn7/9QX6+vbPF0ZDCsiqgKCs+TiJTMrmCzMpBPhAfRivlJG3cf5Lcu77NSgBOlbvufP9Bfri6qSXOwQDnttXkqnFUpYRLMiUqu76PRFIM4Oo0VyjZAKQuO3TmPHB2c1uRmwGxA8d5lty7srsyZooUs34VZiGUnrRcz4pSPRZRyzeSHGlI9RITj23dcJw3gEvbV9Ql2MsRv0Aov3QdgKEeCr2OBUUVZE6S//SJBYyv3H+cNx6S9/b1FrpIsti/EMhPshBqjGsgc5yEfrsQIDiM9BCGrD15lnqODxVJYlRnAcJwfdeMhG8OkCiLtDbDOlfuAbeODxV5qmqe94ptZKPi0D40smvP/kPA9jWNKSqa20aWHATU4Fs2sGIzsB1oivNWkcfg4dPAiSNqQHJhXRP6h4ASXythBCpVAPfENABxsJ0qjMAaoUoTM0cnF0Co2qakb+VWcoOdagBhBIuKSfwnBw==`,Ge=`/_astro/poster.DZhSMxpz.webp`,z=n(),B=4900;function V(e){return e>=0?.62*(1-Math.log10(Math.max(e,1))/Math.log10(16e6)):.62+.38*Math.log10(1-e)/Math.log10(1001)}function Ke(e){let t=0,n=1;for(let r=0;r<28;r++){let r=(t+n)/2;V(C(r).alt)<e?t=r:n=r}return(t+n)/2}var H=[[16e6,`16,000 km`,!0],[1e6,`1,000 km`,!1],[1e5,`100 km`,!1],[1e4,`10 km`,!1],[1e3,`1 km`,!1],[0,`0 m`,!0],[-10,`−10 m`,!1],[-100,`−100 m`,!1],[-1e3,`−1,000 m`,!0]],U=e=>Math.round(e).toLocaleString(`en-US`);function qe(e){return e>=1e3?[e>=1e5?U(e/1e3):(e/1e3).toFixed(e>=1e4?0:1),`km`]:e>=0?[U(e),`m`]:[Math.round(-e)===0?`0`:`−`+U(-e),`m`]}function Je(){let e=(0,i.useRef)(null),t=(0,i.useRef)(null),n=(0,i.useRef)(null),a=(0,i.useRef)(null),o=(0,i.useRef)(null),s=(0,i.useRef)(null),c=(0,i.useRef)(null),l=(0,i.useRef)(null),u=(0,i.useRef)({auto:!1,started:!1,ended:!1}),[d,f]=(0,i.useState)(`loading`),[ee,te]=(0,i.useState)(!1),[ne,re]=(0,i.useState)(!1),[ie,ae]=(0,i.useState)(!1),[oe,se]=(0,i.useState)(!1),[ce,le]=(0,i.useState)(!1),ue=(e,t)=>{let[r,i]=qe(e),l=T(e);n.current.textContent!==r&&(n.current.textContent=r),a.current.textContent!==i&&(a.current.textContent=i),o.current.textContent!==l&&(o.current.textContent=l),s.current.style.transform=`translateY(${(V(e)*100).toFixed(3)}%)`;let u=c.current,d=String(Math.round((1-t)*100));u.getAttribute(`aria-valuenow`)!==d&&u.setAttribute(`aria-valuenow`,d),u.setAttribute(`aria-valuetext`,`${r} ${i}, ${l}`)};(0,i.useEffect)(()=>{let n=e.current,r=!!n.closest(`.stage.page`);te(r);let i=matchMedia(`(prefers-reduced-motion: reduce)`);re(i.matches),ue(C(0).alt,0);let a=n.getBoundingClientRect().width>=700,o=I(t.current,{big:r,still:i.matches,textures:{day:a?L:R,clouds:a?Be:Ve,aux:He,dem:Ue,demMax:We},onStatus:e=>{f(e),e===`poster`&&ue(B,Ke(V(B)))},onFrame:({p:e,alt:t,auto:n})=>{ue(t,e);let r=u.current,i=e>.008||n,a=e>.985;r.auto!==n&&(r.auto=n,ae(n)),r.started!==i&&(r.started=i,se(i)),r.ended!==a&&(r.ended=a,le(a))}});l.current=o;let s=()=>{re(i.matches),o.setStill(i.matches)};return i.addEventListener(`change`,s),()=>{i.removeEventListener(`change`,s),o.destroy(),l.current=null}},[]);let p=d===`ready`,m=()=>{let e=l.current;e&&p&&!ne&&(e.play(!e.auto),u.current.auto=e.auto,ae(e.auto))},h=(0,i.useRef)(!1),g=e=>{let t=c.current.getBoundingClientRect();l.current?.seek(Ke(Math.min(1,Math.max(0,(e.clientY-t.top)/t.height))))},_=e=>{p&&(h.current=!0,e.currentTarget.setPointerCapture(e.pointerId),g(e))},v=e=>{h.current&&g(e)},y=()=>{h.current=!1};return(0,z.jsxs)(`div`,{ref:e,className:`lab-root descent ${d}${ee?` big`:``}${oe?` started`:``}`,children:[d===`poster`&&(0,z.jsx)(`img`,{className:`poster`,src:Ge,alt:``}),(0,z.jsx)(`canvas`,{ref:t,role:`img`,"aria-label":`A single continuous shot that falls from orbit through the atmosphere and the clouds into the sea off the Canary Islands at sunset, then sinks a thousand metres down. Mount Teide stands on the horizon.`}),(0,z.jsxs)(`div`,{className:`hud`,children:[(0,z.jsx)(`p`,{className:`geo`,children:`28.3°N 16.1°W · Sunset`}),(0,z.jsxs)(`div`,{className:`readout`,children:[(0,z.jsxs)(`p`,{className:`alt`,children:[(0,z.jsx)(`span`,{className:`num`,ref:n}),(0,z.jsx)(`span`,{className:`unit`,ref:a})]}),(0,z.jsx)(`p`,{className:`zone`,children:(0,z.jsx)(`span`,{ref:o})})]}),(0,z.jsx)(`div`,{className:`gauge`,ref:c,tabIndex:p?0:-1,role:`slider`,"aria-label":`Altitude`,"aria-orientation":`vertical`,"aria-valuemin":0,"aria-valuemax":100,"aria-disabled":!p,onPointerDown:_,onPointerMove:v,onPointerUp:y,onPointerCancel:y,onKeyDown:e=>{let t=l.current;if(!t||!p)return;let n={ArrowDown:.012,ArrowRight:.012,ArrowUp:-.012,ArrowLeft:-.012,PageDown:.06,PageUp:-.06};if(e.key in n)t.nudge(n[e.key]);else if(e.key===`Home`)t.seek(0);else if(e.key===`End`)t.seek(1);else if(e.key===` `||e.key===`Enter`)m();else return;e.preventDefault()},children:(0,z.jsxs)(`div`,{className:`track`,children:[H.map(([e,t,n])=>(0,z.jsx)(`div`,{className:`tick${e===0?` sea`:``}${n?` key`:``}`,style:{top:`${V(e)*100}%`},children:(0,z.jsx)(`span`,{children:t})},e)),(0,z.jsx)(`div`,{className:`mark`,ref:s})]})}),(0,z.jsx)(`div`,{className:`tools`,children:(0,z.jsxs)(`button`,{type:`button`,className:`lab-btn play`,onClick:m,disabled:!p||ne,"aria-pressed":ie,"aria-label":ie?`Pause the fall`:`Play the fall`,title:ne?`Off while reduced motion is on`:void 0,children:[(0,z.jsx)(r,{name:ie?`pause`:`play`,size:12}),(0,z.jsx)(`span`,{children:ie?`Pause`:`Play`})]})}),(0,z.jsxs)(`div`,{className:`end${ce&&p?` show`:``}`,children:[(0,z.jsx)(`p`,{children:`A thousand metres down, sunlight gives out.`}),(0,z.jsx)(`small`,{className:`for-mouse`,children:`Move the pointer to wake the plankton`}),(0,z.jsx)(`small`,{className:`for-touch`,children:`Touch the water to wake the plankton`}),(0,z.jsxs)(`button`,{type:`button`,className:`lab-btn`,onClick:()=>l.current?.seek(0),tabIndex:ce?0:-1,children:[(0,z.jsx)(r,{name:`arrow-counter-clockwise`,size:13}),`Back to orbit`]})]})]}),(0,z.jsx)(`p`,{className:`lab-hint`,children:d===`loading`?(0,z.jsx)(`span`,{children:`Loading the planet…`}):(0,z.jsxs)(z.Fragment,{children:[(0,z.jsx)(`span`,{className:`for-mouse`,children:ee?`Scroll or drag to fall`:`Drag to fall`}),(0,z.jsx)(`span`,{className:`for-touch`,children:ee?`Swipe up to fall`:`Drag the scale to fall`})]})})]})}export{Je as default};