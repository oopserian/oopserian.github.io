import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { stage as makeStage } from "./engine.js";
import { setPicture } from "./scenes.js";
import "./style.css";

type Sky = "day" | "dusk" | "image";

const TABS: { id: Sky; label: string }[] = [
    { id: "day", label: "Day" },
    { id: "dusk", label: "Dusk" },
];
const LABEL: Record<Sky, string> = {
    day: "Summer clouds in a blue sky",
    dusk: "Clouds lit gold and pink by the setting sun",
    image: "Your image drifting gently",
};

// 底点的颜色：canvas 读不懂 light-dark()，所以按网站当前是浅色还是深色，在这里挑一套写进 CSS 变量，引擎从变量里读。
// 浅色的 --dot-fill 是点和点之间铺的一层淡底色：白底上白云的点看不出来，靠它把蓝天和白云分开。
const THEME = {
    dark: { "--dot": "rgb(255 255 255 / 0.07)", "--dot-fill": "0", "--subject": "#CDB8DA", "--subject-a": "0.6" },
    light: { "--dot": "rgb(20 20 20 / 0.06)", "--dot-fill": "0.3", "--subject": "#7E5F8C", "--subject-a": "0.62" },
};

export default function DotMatrix() {
    const screen = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const view = useRef<HTMLDivElement>(null);
    const stage = useRef<ReturnType<typeof makeStage> | null>(null);
    const [sky, setSky] = useState<Sky>("day");
    const [over, setOver] = useState(false);

    // 引擎自己画、自己限帧、滚出屏幕就停；React 只管换场景的按钮
    useEffect(() => {
        const el = screen.current!;
        const paint = () => {
            const dark = getComputedStyle(document.documentElement).colorScheme.includes("dark");
            for (const [k, v] of Object.entries(THEME[dark ? "dark" : "light"])) el.style.setProperty(k, v);
        };
        paint();
        const s = makeStage(canvas.current!, { scene: "day", box: view.current, pointer: el, cell: 7, dot: 0.45, fps: 30, period: 12000 });
        stage.current = s;
        // 换主题：顶栏的按钮改 <html data-theme>，跟随系统时看 prefers-color-scheme
        const retheme = () => { paint(); s.refresh(); };
        const mo = new MutationObserver(retheme);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        const mq = matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", retheme);
        return () => { mo.disconnect(); mq.removeEventListener("change", retheme); s.destroy(); stage.current = null; };
    }, []);

    const pick = (next: Sky) => { stage.current?.set(next); setSky(next); };

    const arrows = (e: KeyboardEvent) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const i = Math.max(0, TABS.findIndex(t => t.id === sky));
        const j = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
        pick(TABS[j].id);
        (e.currentTarget.querySelectorAll("button")[j] as HTMLButtonElement).focus();
    };

    // 拖一张图进来：主角换成这张图
    const drop = (e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith("image/")) return;
        const img = new Image();
        img.onload = () => {
            setPicture(img);
            if (sky === "image") stage.current?.rebuild();
            else pick("image");
        };
        img.src = URL.createObjectURL(file);
    };

    return (
        <div className="lab-root dot-matrix">
            <div className="screen" ref={screen} data-over={over || undefined}
                onDragOver={e => { e.preventDefault(); setOver(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
                onDrop={drop}>
                <canvas className="dots" ref={canvas} role="img" aria-label={`${LABEL[sky]}, drawn in dots`} />
                <div className="tabs" role="tablist" aria-label="Sky" onKeyDown={arrows}>
                    {TABS.map((t, i) => (
                        <button key={t.id} role="tab" aria-selected={sky === t.id}
                            tabIndex={sky === t.id || (sky === "image" && i === 0) ? 0 : -1}
                            onClick={() => pick(t.id)}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="view" ref={view} />
            </div>
            <p className="lab-hint">
                <span className="for-mouse">Sweep or click through the clouds</span>
                <span className="for-touch">Tap the clouds</span>
            </p>
        </div>
    );
}
