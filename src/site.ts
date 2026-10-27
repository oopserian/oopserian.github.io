// 网站上到处用到的个人信息：名字、简介、联系方式。改一处，顶栏、页脚、首页、<head> 里的都跟着变。
export const SITE = {
  name: 'Erian',
  url: 'https://eooo.me',
  title: 'Erian · independent developer',
  description: 'Erian is a web and software developer working independently from Germany, currently building SOOTY, a local-first asset manager for Mac.',
  email: 'oopserian@gmail.com',
  github: 'https://github.com/oopserian',
  x: 'https://x.com/oopserian',
  repo: 'https://github.com/oopserian/oopserian.github.io',
};

// 实验源码在 GitHub 上的地址
export const labSource = (slug: string) => `${SITE.repo}/tree/main/src/labs/${slug}`;
