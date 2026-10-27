// 内容集合。
// projects：首页「Projects」里的一行一个，src/content/projects/<slug>.md，正文暂时不用（以后要给项目单独一页再用）。
// labs：实验，一个实验一个目录 src/labs/<slug>/，里面 index.md 是标题、标签和说明，Demo.tsx 是组件本身。
//       id 就是目录名，网址是 /lab/<slug>/。写法见 README 的「加一个实验」。
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    summary: z.string(),          // 一行说明
    kind: z.string(),             // App、Tool、Site 这种，显示在右边
    status: z.string().optional(),// 「Coming soon」这种，没有就不显示
    url: z.url(),
    icon: image(),
    order: z.number(),            // 越小越靠前
    hidden: z.boolean().default(false),
  }),
});

const labs = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/labs',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),              // 卡片和详情页标题下面的一句话
    tags: z.array(z.string()),
    date: z.coerce.date(),            // 做出来的日子
    inspiration: z.url().optional(), // 照着谁的设计做的
    wip: z.boolean().default(false),  // 还没做完：卡片上不放组件，也不生成详情页
    order: z.number(),
  }),
});

export const collections = { projects, labs };
