import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { create } from "./waves.js";
import "./style.css";

type Mode = "waves" | "ascii";

const TABS: { id: Mode; label: string }[] = [
    { id: "waves", label: "Waves" },
    { id: "ascii", label: "ASCII" },
];
const LABEL: Record<Mode, string> = {
    waves: "Open sea rolling toward you under a low sun, or a moon in dark mode",
    ascii: "Open sea rolling toward you under a low sun, with ASCII characters laid over the water",
};

export default function AsciiWaves() {
    const canvas = useRef<HTMLCanvasElement>(null);
    const sea = useRef<ReturnType<typeof create> | null>(null);
    const [mode, setMode] = useState<Mode>("ascii");
    const [failed, setFailed] = useState(false); // 浏览器没有 WebGL2

    // 引擎自己画、自己限帧、滚出屏幕就停、自己跟着鼠标起涟漪；React 只管换模式的按钮
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

    const pick = (next: Mode) => { sea.current?.setMode(next); setMode(next); };

    const arrows = (e: KeyboardEvent) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const i = TABS.findIndex(t => t.id === mode);
        const j = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
        pick(TABS[j].id);
        (e.currentTarget.querySelectorAll("button")[j] as HTMLButtonElement).focus();
    };

    return (
        <div className="lab-root ascii-waves">
            <div className="screen">
                <canvas className="sea" ref={canvas} role="img" aria-label={LABEL[mode]} />
                {failed && <p className="fallback">This experiment needs WebGL 2</p>}
                <div className="tabs" role="tablist" aria-label="Layer" onKeyDown={arrows}>
                    {TABS.map(t => (
                        <button key={t.id} role="tab" aria-selected={mode === t.id} tabIndex={mode === t.id ? 0 : -1}
                            onClick={() => pick(t.id)}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>
            <p className="lab-hint">
                <span className="for-mouse">Move across the water to ripple it</span>
                <span className="for-touch">Tap or swipe across the water</span>
            </p>
        </div>
    );
}
