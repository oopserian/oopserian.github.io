# CLAUDE.md

Erian（laken）的个人网站 eooo.me，Astro 生成的纯静态页面，发在 GitHub Pages。页面上的字是英文，代码注释、文档、提交说明用中文。怎么跑、目录、加实验和项目、设计约定、字符画、选型、部署都在 `README.md`；改了行为要同步改 README。

## 提交

- 格式：`type(scope): 描述`，描述用中文，说清楚改了什么。例：`feat(lab): 加一个拖放堆叠的实验`、`fix(ascii): 滚出屏幕再回来开场停在一半`。
- type：`feat` `fix` `perf` `refactor` `docs` `test` `build` `chore` `style`。
- scope：`site`（外壳、首页、共用组件、样式）、`lab`（`src/labs/` 里的实验和实验页）、`ascii`（首屏字符画）、`deploy`（构建和发布）；整个仓库的事写 `repo`，只改这份 CLAUDE.md 写 `agents`。
- 一个完整的改动一个提交，只 `git add` 自己改的文件。

## 约定

- 页面不带框架：只有实验是 React，经 `src/islands/LabDemo.tsx` 用 `client:visible` 按需挂。网站本身写 Astro 组件和普通 CSS，不写 Tailwind 类名（Tailwind 只扫 `src/labs/`）。
- `global.css` 里网站的样式不在层里，优先级比 Tailwind 高，所以不写 `p`、`button` 这种裸标签的规则，会盖掉实验里的类名。
- 直角、1px 细线、不用阴影，强调色只有一个钴蓝，值在 `global.css` 开头。字体、图标都放在仓库里，不从 CDN 拿。
- 实验是例外：留圆角和很轻的阴影，但颜色、圆角、阴影、动效曲线都用 `src/labs/_kit/kit.css` 的变量，图标用 `_kit/icons.tsx` 的 Phosphor，鼠标、触屏、键盘都要能玩（见 README 的「实验的样子」）。改了实验的做法，`index.md` 的标题和说明跟着改。
- 背景动画可以用字符（ASCII）风格，但一定要省：平时限帧，看不见就停，「减弱动态效果」和没有显卡（软件渲染）时只画一帧静止的。首屏的字符画照 React Bits 的 GradientASCII 写的，开头 `/*!` 的许可证别删，也别改成普通注释。
- 改完用浏览器在 1440 和 390 两种宽度、浅色深色各看一遍：不能有横向滚动条，控制台不能有报错。改了首屏要重截 `public/og.png`（见 README 的「分享卡片」）。
