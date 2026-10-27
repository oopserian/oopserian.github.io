// 页面上唯一的 React：把一个实验的组件挂到它的舞台上。
// 页面用 client:visible 挂它，所以 React 本身要等实验快滚进屏幕才下载；挂上以后再按 slug 去拿那个实验自己的那份代码，
// 每个实验单独打包，看哪个下哪个。舞台的大小由外面的 LabStage.astro 定好，组件出现时不挤动页面。
// 组件到之前先放一个撑满舞台的空 div：client:visible 是看岛里面的子元素有没有进屏幕，一个子元素都没有就永远不挂。
import { useEffect, useState, type ComponentType } from 'react';
import '../labs/_kit/kit.css'; // 实验共用的颜色、圆角、阴影这些

const demos = import.meta.glob<{ default: ComponentType }>('../labs/*/Demo.tsx');

export default function LabDemo({ slug }: { slug: string }) {
  const [Demo, setDemo] = useState<ComponentType | null>(null);

  useEffect(() => {
    const load = demos[`../labs/${slug}/Demo.tsx`];
    if (!load) return;
    let alive = true;
    load().then(m => { if (alive) setDemo(() => m.default); });
    return () => { alive = false; };
  }, [slug]);

  return Demo ? <Demo /> : <div style={{ width: '100%', height: '100%' }} />;
}
