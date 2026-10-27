// Astro 配置。输出纯静态页面到 dist/，推到 main 后由 .github/workflows/deploy.yml 构建、发到 gh-pages 分支。
// 页面本身不带框架：只有实验（src/labs/）是 React 组件，滚到它们跟前才加载（见 src/islands/LabDemo.tsx）。
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://eooo.me',
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // 压缩脚本时默认连 /*! 开头的许可证注释一起删掉。src/scripts/ascii.ts 开头 React Bits 的许可证要跟着代码发出去，留着
    build: { rolldownOptions: { output: { comments: { legal: true } } } },
  },
  devToolbar: { enabled: false },
});
