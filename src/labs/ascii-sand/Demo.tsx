import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { create } from "./sand.js";
import "./style.css";

export default function AsciiSand() {
    const canvas = useRef<HTMLCanvasElement>(null);
    const dunes = useRef<ReturnType<typeof create> | null>(null);
    const [failed, setFailed] = useState(false); // 浏览器没有 WebGL2

    // 引擎自己画、自己限帧、滚出屏幕就停、自己跟着鼠标犁沟、堆沙；React 只管挂上、换主题、拆掉
    useEffect(() => {
        let d: ReturnType<typeof create>;
        try { d = create(canvas.current!, { period: 12000 }); }
        catch { setFailed(true); return; }
        dunes.current = d;
        // 换主题：顶栏的按钮改 <html data-theme>，跟随系统时看 prefers-color-scheme。深浅两种主题换一套字的颜色
        const retheme = () => d.refresh();
        const mo = new MutationObserver(retheme);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        const mq = matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", retheme);
        return () => { mo.disconnect(); mq.removeEventListener("change", retheme); d.destroy(); dunes.current = null; };
    }, []);

    // 键盘：聚焦到沙上按回车或空格，随便一处倒一撮沙
    const key = (e: KeyboardEvent) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        dunes.current?.pour();
    };

    return (
        <div className="lab-root ascii-sand">
            <canvas className="wall" ref={canvas} tabIndex={0} role="img" onKeyDown={key}
                aria-label="Sand dunes with wind ripples running to the horizon, drawn entirely in ASCII characters. Press Enter to pour a handful of sand." />
            {failed && <p className="fallback">This experiment needs WebGL 2</p>}
            <p className="lab-hint">
                <span className="for-mouse">Sweep across the sand to carve a groove</span>
                <span className="for-touch">Tap or swipe across the sand</span>
            </p>
        </div>
    );
}
