import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { create } from "./grass.js";
import "./style.css";

type Mode = "blades" | "ascii";

const TABS: { id: Mode; label: string }[] = [
    { id: "blades", label: "Blades" },
    { id: "ascii", label: "ASCII" },
];
const COUNT = 160000;

export default function AsciiGrass() {
    const canvas = useRef<HTMLCanvasElement>(null);
    const grass = useRef<ReturnType<typeof create> | null>(null);
    const [mode, setMode] = useState<Mode>("ascii");
    const [own, setOwn] = useState(false);       // 拖进来过一张图
    const [over, setOver] = useState(false);
    const [failed, setFailed] = useState(false); // 浏览器没有 WebGL2

    // 引擎自己画、自己限帧、滚出屏幕就停、自己跟着鼠标；React 只管换模式的按钮和拖图
    useEffect(() => {
        let g: ReturnType<typeof create>;
        try { g = create(canvas.current!, { count: COUNT, period: 12000, cell: 9 }); }
        catch { setFailed(true); return; }
        grass.current = g;
        // 换主题：顶栏的按钮改 <html data-theme>，跟随系统时看 prefers-color-scheme
        const retheme = () => g.refresh();
        const mo = new MutationObserver(retheme);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        const mq = matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", retheme);
        return () => { mo.disconnect(); mq.removeEventListener("change", retheme); g.destroy(); grass.current = null; };
    }, []);

    const pick = (next: Mode) => { grass.current?.setMode(next); setMode(next); };

    const arrows = (e: KeyboardEvent) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const i = TABS.findIndex(t => t.id === mode);
        const j = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
        pick(TABS[j].id);
        (e.currentTarget.querySelectorAll("button")[j] as HTMLButtonElement).focus();
    };

    // 拖一张图进来：草叶的颜色换成这张图的
    const drop = (e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith("image/")) return;
        const img = new Image();
        img.onload = () => { grass.current?.setImage(img); setOwn(true); URL.revokeObjectURL(img.src); };
        img.src = URL.createObjectURL(file);
    };

    const what = own ? "Your image grown as 160,000 grass blades" : "A meadow of 160,000 grass blades flowing in the wind";
    const label = mode === "ascii" ? `${what}, drawn over with ASCII characters that turn with the blades` : what;

    return (
        <div className="lab-root ascii-grass">
            <div className="screen" data-over={over || undefined}
                onDragOver={e => { e.preventDefault(); setOver(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
                onDrop={drop}>
                <canvas className="field" ref={canvas} role="img" aria-label={label} />
                {failed && <p className="fallback">This experiment needs WebGL 2</p>}
                <div className="tabs" role="tablist" aria-label="Layer" onKeyDown={arrows}>
                    {TABS.map(t => (
                        <button key={t.id} role="tab" aria-selected={mode === t.id} tabIndex={mode === t.id ? 0 : -1}
                            onClick={() => pick(t.id)}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <span className="count">{COUNT.toLocaleString("en-US")} blades</span>
            </div>
            <p className="lab-hint">
                <span className="for-mouse">Brush the grass with your cursor</span>
                <span className="for-touch">Tap or swipe across the grass</span>
            </p>
        </div>
    );
}
