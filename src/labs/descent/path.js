// 镜头路线：进度 p ∈ [0,1] → 高度（米，水下为负）、俯仰、滚转、曝光、偏航；还有每一层的名字和自动播放时在哪儿放慢
// 俯仰：正数朝下看（90 = 垂直向下），负数朝上看
export const KEYS = [
  // p      高度(m)     俯仰  滚转  曝光EV  偏航（相对太阳方位）
  [0.000, 16000e3,   90,  -28,  1.55,   0],
  [0.080,  5200e3,   84,  -20,  1.70,   0],
  [0.150,  1500e3,   52,   -9,  2.10,   0],
  [0.215,   420e3,   33,   -3,  2.60,   0],
  [0.270,   130e3,   22,   -1,  3.10,   0],
  [0.320,    48e3,   30,    0,  3.70,  15],
  [0.375,    16e3,   10,    0,  4.10,  14],
  [0.430,   6.8e3,    9,    0,  4.20,  14],
  [0.470,   4.9e3,   15,    0,  4.20,  18],
  [0.500,   4.0e3,   24,    0,  4.15,  14],
  [0.527,   760,      7,    0,  4.35,   6],
  [0.585,    420,     8,    0,  4.55,   9],
  [0.630,    140,    13,    0,  4.70,   8],
  [0.665,     28,    20,    0,  4.80,   6],
  [0.690,      4,     9,    0,  4.85,   6],
  [0.705,    0.4,     3,    0,  4.90,   3],
  [0.722,   -0.4,     2,    0,  5.20,   0],
  [0.740,     -3,    -7,    0,  6.20,   0],
  [0.775,    -14,   -24,    0,  6.60,   0],
  [0.820,    -45,   -28,    0,  6.80,   0],
  [0.870,   -130,     8,    0,  7.00,   0],
  [0.925,   -380,    58,    0,  7.10,   0],
  [1.000,  -1000,    88,    0,  7.20,   0],
];

const slog = a => Math.sign(a) * Math.log1p(Math.abs(a));
const sexp = s => Math.sign(s) * Math.expm1(Math.abs(s));

// 单调三次插值（Fritsch–Carlson），不会过冲
function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]), w2 = (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1]); m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

const PX = KEYS.map(k => k[0]);
const fAlt = monotone(PX, KEYS.map(k => slog(k[1])));
const fPitch = monotone(PX, KEYS.map(k => k[2]));
const fRoll = monotone(PX, KEYS.map(k => k[3]));
const fEV = monotone(PX, KEYS.map(k => k[4]));
const fYaw = monotone(PX, KEYS.map(k => k[5]));

export function pathAt(p) {
  return { alt: sexp(fAlt(p)), pitch: fPitch(p), roll: fRoll(p), ev: fEV(p), yaw: fYaw(p) };
}

// 分层名称：高度（米）往下数，到了哪一档就叫哪个名字
/** @type {[number, string][]} */
const ZONES = [
  [700e3, 'Exosphere'],
  [80e3, 'Thermosphere'],
  [50e3, 'Mesosphere'],
  [12e3, 'Stratosphere'],
  [4.4e3, 'Troposphere'],
  [1.3e3, 'Cloud deck'],
  [0.5, 'Marine layer'],
  [-0.5, 'Sea surface'],
  [-200, 'Sunlight zone'],
  [-1000, 'Twilight zone'],
  [-1e9, 'Midnight zone'],
];
export function zoneAt(alt) {
  for (const z of ZONES) if (alt >= z[0]) return z[1];
  return ZONES[ZONES.length - 1][1];
}

// 自动播放时每段的停留权重（越大越慢）
export function dwell(p) {
  const bumps = [[0.0, 0.06, 1.8], [0.27, 0.05, 1.3], [0.47, 0.04, 1.6], [0.512, 0.012, -0.4], [0.59, 0.04, 1.4], [0.712, 0.01, 1.6], [0.79, 0.04, 1.4], [0.99, 0.03, 1.0]];
  let w = 1;
  for (const [c, s, a] of bumps) w += a * Math.exp(-Math.pow((p - c) / s, 2));
  return w;
}
