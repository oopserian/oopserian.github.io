import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { create } from "./waves.js";
import "./style.css";

export default function AsciiWaves() {
    const canvas = useRef<HTMLCanvasElement>(null);
    const sea = useRef<ReturnType<typeof create> | null>(null);
    const [failed, setFailed] = useState(false); // 浏览器没有 WebGL2

    // 引擎自己画、自己限帧、滚出屏幕就停、自己跟着鼠标起涟漪；React 只管挂上、换主题、拆掉
    useEffect(() => {
        let s: ReturnType<typeof create>;
        try { s = create(canvas.current!, { period: 12000 }); }
        catch { setFailed(true); return; }
        sea.current = s;
        // 换主题：顶栏的按钮改 <html data-theme>，跟随系统时看 prefers-color-scheme。浅色是白天，深色是月夜
        const retheme = () => s.refresh();
        const mo = new MutationObserver(retheme);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        const mq = matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", retheme);
        return () => { mo.disconnect(); mq.removeEventListener("change", retheme); s.destroy(); sea.current = null; };
    }, []);

    // 键盘：聚焦到海上按回车或空格，激起一圈涟漪
    const key = (e: KeyboardEvent) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        sea.current?.splash();
    };

    return (
        <div className="lab-root ascii-waves">
            <canvas className="sea" ref={canvas} tabIndex={0} role="img" onKeyDown={key}
                aria-label="Ocean waves rolling toward a low sun, or a moon in dark mode, drawn entirely in ASCII characters. Press Enter to send a ripple." />
            {failed && <p className="fallback">This experiment needs WebGL 2</p>}
            <p className="lab-hint">
                <span className="for-mouse">Move across the water to ripple it</span>
                <span className="for-touch">Tap or swipe across the water</span>
            </p>
        </div>
    );
}
