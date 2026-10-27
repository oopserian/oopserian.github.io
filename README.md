# eooo.me

Erian 的个人网站：首屏是字符拼的头像，下面是正在做的 SOOTY、别的项目、一组能直接玩的界面小实验和联系方式。网站上的字是英文的，代码注释和文档用中文。

![首页](docs/home.png)

## 本地开发

要 Node 22.23.4 以上（Astro 7 的要求，CI 用的是 24）和 pnpm。

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # 生成 dist/
pnpm preview    # 看 dist/ 的样子
pnpm check      # 类型检查
```

改完用浏览器在 1440 和 390 两种宽度、浅色深色各看一遍：不能有横向滚动条，控制台不能有报错。

## 目录

| 位置 | 是什么 |
|---|---|
| `src/pages/` | 页面，一个文件一页：首页 `index.astro`、实验详情 `lab/[slug].astro`、`404.astro` |
| `src/layouts/Base.astro` | 每页共用的外壳：`<head>`（标题、描述、分享卡片）、顶栏、页脚 |
| `src/components/` | 顶栏 `Nav`、页脚 `Footer`、首屏 `Hero`，首页的几节（`Sooty`、`Projects`、`Labs`、`Contact`）和它们用的小组件 |
| `src/site.ts` | 名字、简介、邮箱、GitHub 和 X 的地址，改一处到处跟着变 |
| `src/content/projects/` | 「Projects」里的项目，一个一个 `.md`，字段见 `src/content.config.ts` |
| `src/labs/<slug>/` | 一个实验一个目录：`index.md` 是标题、标签和做法说明，`Demo.tsx` 是组件，样式和图片也放这里 |
| `src/islands/LabDemo.tsx` | 页面上唯一的 React 入口，把实验挂到舞台上 |
| `src/scripts/ascii.ts` | 首屏的字符画 |
| `src/styles/global.css` | 配色、字体、几个到处用的类；各组件的样式写在组件自己的 `<style>` 里 |
| `src/assets/` | 头像、项目图标这些要经过 Astro 压缩的图 |
| `public/` | 原样发布的文件：字体、favicon、分享卡片 `og.png`、`CNAME` |

## 加一个实验

1. 建目录 `src/labs/<slug>/`，`slug` 就是网址里那段（`/lab/<slug>/`），用小写和短横线。
2. 写 `Demo.tsx`，默认导出一个 React 组件。根元素撑满舞台（`w-full h-full`），舞台在卡片上高 280px、详情页上 320 到 480px，底色跟着主题走（浅色是浅灰，深色是深灰）。可以用 Tailwind 的类名和 Motion。图片放 `assets/`，引用写 `import cover from "./assets/cover.webp?url"`（带 `?url` 拿到的是地址；不带的话 Astro 给的是一个对象，`<img src>` 会变成 `[object Object]`）。
3. 写 `index.md`：

   ```md
   ---
   title: Folder
   summary: 卡片和详情页标题下的一句话
   tags: [CSS, SVG]
   date: 2025-01-08
   inspiration: https://…   # 照着谁的设计做的，没有就不写
   wip: true                # 还没做完：卡片上画斜条纹，不挂组件，不生成详情页
   order: 5                 # 越小越靠前
   ---

   正文是详情页上「怎么做的」那几段，用 Markdown。
   ```

卡片上的「源码」链接指向 GitHub 上的 `src/labs/<slug>/`，不用另外填。

## 加一个项目

在 `src/content/projects/` 加一个 `.md`，只要 frontmatter：`name`、`summary`（一行）、`kind`（App、Tool、Site 这种）、`status`（可不写）、`url`、`icon`（`src/assets/` 里的图，写相对路径）、`order`、`hidden`（可不写）。

## 设计约定

- 直角、不用阴影，区块之间用 1px 细线分开。首页每一节左边是等宽小字的节名，宽屏上跟着滚动停在顶上。
- 黑白灰为主，略带暖。强调色只有一个炭火的橙，只给链接、当前状态和字符画里被搅动的字：浅色主题 `#B93D0A`（在底色上对比度 5.2），深色主题 `#FF8A4C`（8.4）。灰的几档都过 4.5。值在 `global.css` 开头，深色写了两处（跟随系统、手动选了深色），改要一起改。
- 大标题 Instrument Serif（第二行斜体），标签、日期、导航这些小字 DM Mono，正文用系统字体。两款都是 SIL OFL 1.1，许可证在 `public/fonts/OFL.txt`，文件是从 sooty 官网拷来的拉丁字母子集。字体都放在本站，不从 Google Fonts 拿。
- 浅色、深色跟随系统，顶栏右边的按钮可以手动换，记在 `localStorage` 的 `theme` 里；`<head>` 最前面那段脚本在页面画出来之前就定好，不闪。
- 页面上只有淡入和短距离的位移（`.rise`），系统开了「减弱动态效果」就不动。一直在动的只有首屏的字符画。

## 字符画

首屏右边的头像是用等宽字符拼出来的，四周有一圈慢慢往上飘的字符的烟。打开页面时头像从乱码里一行行显出来；鼠标划过会把字搅成橙色的乱码，松开后慢慢落回去；点一下荡开一圈。

- 怎么画：`ascii.ts` 把头像（`src/assets/avatar.webp`，透明底）缩到「一格一个像素」，按亮度挑字。深色主题上原图越亮字越浓，浅色主题反过来，两种主题下看到的都是正片。挑哪些字是开场时量出来的：把候选的字画一遍，量每个字的墨量，由淡到浓均匀挑 14 档，所以换字体不用重新排。
- 为什么快：canvas 2D，不用 WebGL。所有字先画进一张小图（图集），之后每格只是 `drawImage` 一小块，而且只重画变了的格子。平时（只有烟在飘、偶尔闪一下）每秒画 8 帧，开场、被鼠标搅动、点了一下时才每秒 30 帧。滚出屏幕、切到别的标签页就停；系统开了「减弱动态效果」只画一帧静止的。脚本在浏览器空闲时才挂上，不跟首屏的文字抢。无头浏览器（没有显卡）里量过：静止时脚本占主线程 3% 左右。
- 调参数：常量都在 `ascii.ts` 开头（字号在 `Hero.astro` 的 `--ascii-size`，电脑 8px、手机 9px）。颜色是 `global.css` 的 `--ascii` 和 `--ascii-hot`。
- 选型：看过这几个，都不合适，所以自己写（四百多行带注释，没有依赖）：
  - sooty.app 的字符光（React Bits 的 GradientASCII，WebGL 着色器，MIT + Commons Clause）：画的是一片流动的光，不是一张图；而且个人网站和产品官网会长得一模一样。
  - aalib.js（2.0，MIT）：浏览器里把图片、视频转成字符，但只管「转」这一步，开场、鼠标交互、只重画变了的格子这些都还得自己写，转字符本身反而是最短的那段；2022 年以后没再更新，npm 包解开有 79 MB。
  - image-to-ascii（3.3，MIT）：只能在 Node 里跑（靠 GraphicsMagick），浏览器里用不了。ascii-art（2.8，MIT）是给终端用的，带 ANSI 颜色和 figlet 字体，870 KB。

## 选型

- **Astro**（静态生成）：比较过留在 Vite + React 单页、Next.js 静态导出、Eleventy。原来的单页把所有东西都放在一个 JS 里，HTML 是空的，搜索引擎和分享卡片都看不到内容，首屏要等 React 下载完；Next.js 静态导出每页都带着 React 的运行时；Eleventy 页面很轻，但实验是 React 组件，要另想办法挂。Astro 默认页面不带 JS，又能把 React 组件当「岛」按需挂，正好：首页本身只有主题按钮和字符画两段小脚本，React 和实验的代码等滚到实验那一节才下载，一个实验一个文件。sooty 的官网也是 Astro，用法一样。
- **React 只给实验用**：实验原来就是 React + Motion + Tailwind 写的，源码也公开给人看，照原样保留。网站本身（顶栏、首页、详情页）全是 Astro 组件和普通 CSS。
- **Tailwind 只扫 `src/labs/`**：实验的类名靠它生成，preflight 顺便当整站的样式重置。网站自己的样式不用 Tailwind，写在组件的 `<style>` 里。
- **图标**：Phosphor 的 regular 粗细，几个用到的直接写成内联 SVG（`components/Icon.astro`），不引图标库。实验里还用着原来的 Tabler 图标。

## 部署

推到 `main` 以后 `.github/workflows/deploy.yml` 用 Node 24 和 pnpm 构建，把 `dist/` 发到 `gh-pages` 分支，GitHub Pages 从那个分支发布到 eooo.me（`public/CNAME`）。`public/.nojekyll` 让 GitHub Pages 不走 Jekyll，不然 `_astro/` 这种下划线开头的目录会被丢掉。

## 分享卡片

`public/og.png` 是首页首屏深色主题 1200×630 的截图（`pnpm build && pnpm preview` 以后，用 Playwright 开 1200×630 的窗口、`colorScheme: 'dark'`，等字符画显出来再截）。改了首屏要重截一张。README 开头的 `docs/home.png` 也是这样截的整页。
