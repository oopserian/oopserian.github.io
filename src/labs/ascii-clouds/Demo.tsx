import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { create } from "./clouds.js";
import "./style.css";

export default function AsciiClouds() {
    const canvas = useRef<HTMLCanvasElement>(null);
    const sky = useRef<ReturnType<typeof create> | null>(null);
    const [failed, setFailed] = useState(false); // 浏览器没有 WebGL2

    // 引擎自己画、自己限帧、滚出屏幕就停、自己跟着鼠标拨开云；React 只管挂上、换主题、拆掉
    useEffect(() => {
        let s: ReturnType<typeof create>;
        try { s = create(canvas.current!, { period: 12000 }); }
        catch { setFailed(true); return; }
        sky.current = s;
        // 换主题：顶栏的按钮改 <html data-theme>，跟随系统时看 prefers-color-scheme。浅色是白天，深色是黄昏
        const retheme = () => s.refresh();
        const mo = new MutationObserver(retheme);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        const mq = matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", retheme);
        return () => { mo.disconnect(); mq.removeEventListener("change", retheme); s.destroy(); sky.current = null; };
    }, []);

    // 键盘：聚焦到天上按回车或空格，拨开一块云
    const key = (e: KeyboardEvent) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        sky.current?.splash();
    };

    return (
        <div className="lab-root ascii-clouds">
            <canvas className="sky" ref={canvas} tabIndex={0} role="img" onKeyDown={key}
                aria-label="Cumulus clouds drifting across a blue sky, or lit gold and pink at dusk in dark mode, drawn entirely in ASCII characters. Press Enter to part them." />
            {failed && <p className="fallback">This experiment needs WebGL 2</p>}
            <p className="lab-hint">
                <span className="for-mouse">Sweep through the clouds to part them</span>
                <span className="for-touch">Tap or swipe through the clouds</span>
            </p>
        </div>
    );
}
