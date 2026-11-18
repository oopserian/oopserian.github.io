"""从 SOOTY 的海报里拆出煤块，给首屏 SOOTY 那格的动画用（见 README 的「首屏」）。

  python3 tools/sooty-stone.py

读 src/assets/projects/sooty-og.jpg，写 src/assets/projects/sooty-stone.png：
海报上 770..1110 × 148..482 这一块（煤块在里面），放大 2 倍，三个通道各装一样东西：
  R  煤块的轮廓（1 是煤块，边上是平滑的过渡）
  G  裂缝里的光该亮在哪：沿着裂缝一道，只落在缝里暗的地方，亮面上不画
  B  沿着裂缝从上到下走到了哪（0..1，离裂缝 10px 以外是 0），着色器拿它让光顺着缝跑
煤块本身的颜色不存，着色器直接从海报上取。改了范围要同步改 src/scripts/sooty.ts 里的 MASK。

要先装：pip install pillow numpy scipy。
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src/assets/projects/sooty-og.jpg'
OUT = ROOT / 'src/assets/projects/sooty-stone.png'
X0, Y0, X1, Y1 = 770, 148, 1110, 482
S = 2

im = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
r = im[Y0:Y1, X0:X1]
L = r.mean(2)
chroma = r[..., 2] - r[..., 0]

# 轮廓：比底色（#0A0A0A）亮、又不发蓝（底下地平线的光是蓝的）的那一大块，补上洞、抹平边
m = (L > 17) & (chroma < 10)
m = ndi.binary_opening(m, iterations=1)
lab, n = ndi.label(m)
m = lab == (np.argmax(ndi.sum(m, lab, range(1, n + 1))) + 1)
m = ndi.binary_fill_holes(ndi.binary_closing(ndi.binary_fill_holes(m), iterations=3))
h, w = m.shape
# 先在 2 倍上插值再取阈值，边是平滑的曲线；阈值偏高一点，边往里缩半个像素，免得带一圈海报的黑底
soft = ndi.gaussian_filter(m.astype(float), 1.0)
big = np.asarray(Image.fromarray((soft * 255).astype(np.uint8)).resize((w * S, h * S), Image.BICUBIC)).astype(float) / 255
alpha = np.clip((big - 0.55) / 0.18, 0, 1)

# 裂缝的走向（海报坐标），对着放大五倍的海报一段段描的；第 21 个点（999, 392）是缝里那个蓝色的亮点
P = np.array([
    (828, 188), (840, 196), (853, 204), (864, 214), (872, 228), (877, 244), (882, 259), (888, 273), (895, 288),
    (904, 302), (915, 313), (927, 320), (940, 326), (952, 332), (963, 340), (972, 348), (979, 357), (985, 366),
    (990, 376), (995, 385), (999, 392), (1006, 398), (1017, 405), (1029, 413), (1040, 422), (1048, 430), (1054, 439),
], float)
seg = np.diff(P, axis=0)
sl = np.hypot(seg[:, 0], seg[:, 1])
cum = np.concatenate([[0], np.cumsum(sl)])
yy, xx = np.mgrid[0:h * S, 0:w * S]
px, py = X0 + (xx + 0.5) / S, Y0 + (yy + 0.5) / S
dist = np.full(px.shape, 1e9)
along = np.zeros(px.shape)
for i in range(len(seg)):
    t = np.clip(((px - P[i, 0]) * seg[i, 0] + (py - P[i, 1]) * seg[i, 1]) / sl[i] ** 2, 0, 1)
    d = np.hypot(px - (P[i, 0] + t * seg[i, 0]), py - (P[i, 1] + t * seg[i, 1]))
    closer = d < dist
    dist = np.where(closer, d, dist)
    along = np.where(closer, (cum[i] + t * sl[i]) / cum[-1], along)
print(f'亮点在缝上的位置：{cum[20] / cum[-1]:.3f}（src/scripts/sooty.ts 的 GLINT_AT）')

# 缝上面宽、往下收窄；只亮在暗处
width = np.interp(along, [0, 0.4, 0.75, 1], [4.5, 3.2, 2.4, 1.6])
Lb = np.asarray(Image.fromarray(L.astype(np.uint8)).resize((w * S, h * S), Image.BICUBIC)).astype(float)
light = np.exp(-(dist / width) ** 2) * np.clip((70 - Lb) / 45, 0, 1) * alpha
pos = np.where(dist < 10, along, 0)

out = np.stack([alpha, light, pos], -1)
Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGB').save(OUT, optimize=True)
print(f'写好 {OUT.relative_to(ROOT)}：{w * S}×{h * S}')
