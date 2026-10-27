"""把头像插画做成网站用的几张图。

  python3 tools/portrait.py <插画.png>

生成：
  src/assets/portrait.webp    首屏字符画用的：人物抠出来（透明底），线条加粗、肩膀和下面渐隐
  src/assets/avatar.webp      顶栏的小头像：原图裁到肩膀
  public/favicon.png、public/apple-touch-icon.png  网站图标：原图裁头部

要先装：pip install "rembg[cpu]" scipy pillow numpy（第一次跑会下载 176 MB 的抠图模型）。
抠图为什么用 rembg 的 isnet-anime 模型见 README 的「字符画」。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent

src = Image.open(sys.argv[1]).convert('RGB')
W, H = src.size

# 抠图。模型对背景里的小怪物会给一半的不透明度，砍掉；只留最大的一块（人）
cut = np.array(remove(src, session=new_session('isnet-anime')))
a = np.clip((cut[..., 3] / 255 - 0.55) / 0.35, 0, 1)
lab, n = ndimage.label(a > 0.5)
sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
a *= ndimage.binary_dilation(lab == 1 + int(np.argmax(sizes)), iterations=3)

# 字符画一格大约是原图的 8 个像素，原图的线只有 5、6 个像素宽，缩下去就糊没了：
# 只留亮度，暗的线条往外扩几个像素，五官的线缩下去还在
rgb = np.array(src).astype(np.float32) / 255
lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
lum = ndimage.minimum_filter(lum, size=7)

# 以脸为中心往外渐隐：肩膀、胸口慢慢淡进四周的烟里，不留硬边
y, x = np.mgrid[0:H, 0:W] / np.float32(W)
cx, cy = 0.44, 0.36
d = np.sqrt(((x - cx) / 0.40) ** 2 + ((y - cy) / 0.50) ** 2)
t = np.clip((d - 0.7) / 0.32, 0, 1)
a *= 1 - t * t * (3 - 2 * t)

g = (lum * 255).astype(np.uint8)
im = Image.fromarray(np.dstack([g, g, g, (a * 255).astype(np.uint8)]), 'RGBA')
ys, xs = np.where(a > 0.03)
im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
im.thumbnail((720, 960), Image.LANCZOS)
im.save(ROOT / 'src/assets/portrait.webp', quality=90, method=6)
print('portrait.webp', im.size)

# 顶栏的小头像：裁到肩膀，人不要顶满整个圆
bust = src.crop((round(W * 0.08), 0, round(W * 0.86), round(H * 0.78)))
bust.resize((256, 256), Image.LANCZOS).save(ROOT / 'src/assets/avatar.webp', quality=88, method=6)

# 网站图标只有 16 到 64 像素，只裁头部，脸才认得出
head = src.crop((round(W * 0.163), round(H * 0.028), round(W * 0.717), round(H * 0.582)))
head.resize((180, 180), Image.LANCZOS).save(ROOT / 'public/apple-touch-icon.png', optimize=True)
head.resize((64, 64), Image.LANCZOS).save(ROOT / 'public/favicon.png', optimize=True)
print('avatar.webp, favicon.png, apple-touch-icon.png')
