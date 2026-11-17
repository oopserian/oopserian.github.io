"""把头像插画做成网站用的几张小图。

  python3 tools/portrait.py <插画.png>

生成：
  src/assets/avatar.webp      顶栏和项目列表里的小头像：原图裁到肩膀
  public/favicon.png、public/apple-touch-icon.png  网站图标：原图裁头部，浏览器标签上那个是圆的

要先装：pip install pillow。
（原来还生成首屏字符画用的 portrait.webp，2026-11-17 首屏改版时字符画头像去掉了，那一步也删了。）
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

src = Image.open(sys.argv[1]).convert('RGB')
W, H = src.size

# 顶栏的小头像：裁到肩膀，人不要顶满整个圆
bust = src.crop((round(W * 0.08), 0, round(W * 0.86), round(H * 0.78)))
bust.resize((256, 256), Image.LANCZOS).save(ROOT / 'src/assets/avatar.webp', quality=88, method=6)

# 网站图标只有 16 到 64 像素，只裁头部，脸才认得出。浏览器标签上的是圆的（圆外透明，按 4 倍画圆再缩小，边是顺的）；
# 苹果的主屏图标系统自己会切圆角，透明的地方会变黑，所以那张还是方的
head = src.crop((round(W * 0.163), round(H * 0.028), round(W * 0.717), round(H * 0.582)))
head.resize((180, 180), Image.LANCZOS).save(ROOT / 'public/apple-touch-icon.png', optimize=True)
mask = Image.new('L', (256, 256), 0)
ImageDraw.Draw(mask).ellipse((0, 0, 255, 255), fill=255)
icon = head.resize((64, 64), Image.LANCZOS).convert('RGBA')
icon.putalpha(mask.resize((64, 64), Image.LANCZOS))
icon.save(ROOT / 'public/favicon.png', optimize=True)
print('avatar.webp, favicon.png, apple-touch-icon.png')
