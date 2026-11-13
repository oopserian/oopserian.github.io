import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "../_kit/icons";
import { create } from "./canopy.js";
import "./style.css";

// 一天里挑四个时候，按钮挨个换；浅色主题是下午，深色主题是傍晚
const HOURS = [
    { h: 7.5, name: "Morning" },
    { h: 12.5, name: "Noon" },
    { h: 15.5, name: "Afternoon" },
    { h: 18.5, name: "Dusk" },
];
const AFTERNOON = 2, DUSK = 3;
const themeHour = (el: Element) => (getComputedStyle(el).colorScheme.includes("dark") ? DUSK : AFTERNOON);

export default function CrownShyness() {
    const root = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const forest = useRef<ReturnType<typeof create> | null>(null);
    const [when, setWhen] = useState(AFTERNOON);
    const [still, setStill] = useState(false); // 「减弱动态效果」：只有一帧静止的，摇不动

    // 引擎自己量舞台、自己画、自己限帧、滚出屏幕就停、自己接鼠标和手指；React 只管挂上、换时间、换主题、拆掉
    useEffect(() => {
        const start = themeHour(root.current!);
        setWhen(start);
        const f = create(canvas.current!, { hour: HOURS[start].h });
        forest.current = f;
        // 换主题：顶栏的按钮改 <html data-theme>，跟随系统时看 prefers-color-scheme。深色换成傍晚
        const retheme = () => { const i = themeHour(root.current!); setWhen(i); f.setHour(HOURS[i].h); };
        const mo = new MutationObserver(retheme);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        const dark = matchMedia("(prefers-color-scheme: dark)");
        dark.addEventListener("change", retheme);
        const motion = matchMedia("(prefers-reduced-motion: reduce)");
        const remotion = () => setStill(motion.matches);
        remotion();
        motion.addEventListener("change", remotion);
        return () => {
            mo.disconnect(); dark.removeEventListener("change", retheme); motion.removeEventListener("change", remotion);
            f.destroy(); forest.current = null;
        };
    }, []);

    const nextHour = () => {
        const i = (when + 1) % HOURS.length;
        setWhen(i);
        forest.current?.setHour(HOURS[i].h);
    };

    // 键盘：聚焦到画面上按回车或空格，整片林子摇一摇
    const key = (e: KeyboardEvent) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        forest.current?.shake();
    };

    return (
        <div className="lab-root crown-shyness" ref={root}>
            <canvas className="sky" ref={canvas} tabIndex={0} role="img" onKeyDown={key}
                aria-label="Looking up through a forest canopy in pixel art, where the treetops stop just short of each other and leave thin seams of sky. Press Enter to shake the trees." />
            <div className="tools">
                <button type="button" className="lab-btn" onClick={nextHour} aria-label={`Time of day: ${HOURS[when].name}. Change`}>
                    <Icon name="sun" size={14} />{HOURS[when].name}
                </button>
                <button type="button" className="lab-btn icon" onClick={() => forest.current?.shake()} disabled={still}
                    aria-label="Shake the trees" title="Shake the trees">
                    <Icon name="wind" size={14} />
                </button>
                <button type="button" className="lab-btn icon" onClick={() => forest.current?.reseed()}
                    aria-label="Another forest" title="Another forest">
                    <Icon name="arrows-clockwise" size={14} />
                </button>
            </div>
            <p className="lab-hint">
                <span className="for-mouse">Brush the leaves · drag a crown · click to shake</span>
                <span className="for-touch">Tap a tree to shake it · drag sideways to push</span>
            </p>
        </div>
    );
}
