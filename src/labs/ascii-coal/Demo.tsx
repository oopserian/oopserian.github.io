import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { create } from "./coal.js";
import "./style.css";

export default function AsciiCoal() {
    const canvas = useRef<HTMLCanvasElement>(null);
    const wall = useRef<ReturnType<typeof create> | null>(null);
    const [failed, setFailed] = useState(false); // 浏览器没有 WebGL2

    // 引擎自己画、自己限帧、滚出屏幕就停、自己跟着鼠标亮起缝、裂开；React 只管挂上、换主题、拆掉
    useEffect(() => {
        let w: ReturnType<typeof create>;
        try { w = create(canvas.current!, { period: 12000 }); }
        catch { setFailed(true); return; }
        wall.current = w;
        // 换主题：顶栏的按钮改 <html data-theme>，跟随系统时看 prefers-color-scheme。深浅两种主题换一套字的颜色
        const retheme = () => w.refresh();
        const mo = new MutationObserver(retheme);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        const mq = matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", retheme);
        return () => { mo.disconnect(); mq.removeEventListener("change", retheme); w.destroy(); wall.current = null; };
    }, []);

    // 键盘：聚焦到煤壁上按回车或空格，随便一处裂开
    const key = (e: KeyboardEvent) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        wall.current?.crack();
    };

    return (
        <div className="lab-root ascii-coal">
            <canvas className="wall" ref={canvas} tabIndex={0} role="img" onKeyDown={key}
                aria-label="A wall of faceted coal with cold blue light in its seams, drawn entirely in ASCII characters. Press Enter to crack it." />
            {failed && <p className="fallback">This experiment needs WebGL 2</p>}
            <p className="lab-hint">
                <span className="for-mouse">Sweep across the coal to crack it</span>
                <span className="for-touch">Tap or swipe across the coal</span>
            </p>
        </div>
    );
}
