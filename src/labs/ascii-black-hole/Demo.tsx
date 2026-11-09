import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { create } from "./hole.js";
import "./style.css";

export default function AsciiBlackHole() {
    const canvas = useRef<HTMLCanvasElement>(null);
    const hole = useRef<ReturnType<typeof create> | null>(null);
    const [failed, setFailed] = useState(false); // 浏览器没有 WebGL2

    // 引擎自己画、自己限帧、滚出屏幕就停、自己跟着鼠标撒气体、扔星；React 只管挂上、换主题、拆掉
    useEffect(() => {
        let h: ReturnType<typeof create>;
        try { h = create(canvas.current!, { period: 12000 }); }
        catch { setFailed(true); return; }
        hole.current = h;
        // 换主题：顶栏的按钮改 <html data-theme>，跟随系统时看 prefers-color-scheme。深浅两种主题换一套字的颜色
        const retheme = () => h.refresh();
        const mo = new MutationObserver(retheme);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        const mq = matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", retheme);
        return () => { mo.disconnect(); mq.removeEventListener("change", retheme); h.destroy(); hole.current = null; };
    }, []);

    // 键盘：聚焦到画面上按回车或空格，往盘上随便一处扔一颗星
    const key = (e: KeyboardEvent) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        hole.current?.drop();
    };

    return (
        <div className="lab-root ascii-black-hole">
            <canvas className="wall" ref={canvas} tabIndex={0} role="img" onKeyDown={key}
                aria-label="A black hole ringed by a glowing accretion disk whose far side is bent up over the shadow, drawn entirely in ASCII characters. Press Enter to drop a star in." />
            {failed && <p className="fallback">This experiment needs WebGL 2</p>}
            <p className="lab-hint">
                <span className="for-mouse">Sweep across the disk to feed it</span>
                <span className="for-touch">Tap or swipe across the disk</span>
            </p>
        </div>
    );
}
