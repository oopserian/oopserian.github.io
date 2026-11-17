import { useEffect, useRef, useState } from "react";
import { Icon } from "../_kit/icons";
import { create } from "./engine.js";
import rowLight from "./assets/poster-row-light.webp?url";
import rowDark from "./assets/poster-row-dark.webp?url";
import gridLight from "./assets/poster-grid-light.webp?url";
import gridDark from "./assets/poster-grid-dark.webp?url";
import "./style.css";

type Engine = ReturnType<typeof create>;
type Status = "loading" | "ready" | "poster";

// 换主题：顶栏的按钮改 <html data-theme>，跟随系统时看 prefers-color-scheme；舞台读到的 color-scheme 就是当前主题
const isDark = (el: Element) => getComputedStyle(el).colorScheme.includes("dark");

// 没有显卡时的静帧：五张卡摊开的样子，透明底（桌面就是舞台的底色）。
// 宽舞台排成一行，窄的排成上三下二，和引擎里摊开的排法一样；浅色深色的灯光不一样，各一张
const POSTERS = { row: [rowLight, rowDark], grid: [gridLight, gridDark] };

export default function Unbox() {
    const root = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const hint = useRef<HTMLParagraphElement>(null);
    const eng = useRef<Engine | null>(null);
    const [status, setStatus] = useState<Status>("loading");
    const [started, setStarted] = useState(false);   // 撕开封条以后才露出「重来」
    const [dark, setDark] = useState(false);
    const [wide, setWide] = useState(true);

    useEffect(() => {
        const el = root.current!;
        const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const r = el.getBoundingClientRect();
        setWide(r.width >= r.height * 1.45);
        setDark(isDark(el));
        const u = create(el, {
            canvas: canvas.current!,
            hint: hint.current!,
            dark: isDark(el),
            still,
            onStatus: (s: Status) => setStatus(s),
            onPhase: (p: string) => setStarted(p !== "zip"),
        });
        eng.current = u;
        const retheme = () => { const d = isDark(el); setDark(d); u.setDark(d); };
        const mo = new MutationObserver(retheme);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        const mq = matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", retheme);
        return () => { mo.disconnect(); mq.removeEventListener("change", retheme); u.destroy(); eng.current = null; };
    }, []);

    return (
        <div ref={root} className={`lab-root unbox ${status}`} tabIndex={status === "ready" ? 0 : -1}
            aria-label="A gift box on a desk. Pull the tab, lift the lid, take out the card pack, tear it open and look through five cards. With the keyboard, Enter takes one step at a time, the arrow keys swipe or switch cards, Escape puts a card back, and R starts over.">
            {status === "poster" && <img className="poster" src={POSTERS[wide ? "row" : "grid"][dark ? 1 : 0]} alt="Five star-chart cards laid out on a desk: a waxing gibbous moon, a long-period comet, a black holographic card of a total solar eclipse, a ringed planet, and the constellation Lyra." />}
            <canvas ref={canvas} aria-hidden="true" />
            {status === "ready" && started && (
                <button type="button" className="lab-btn again" aria-label="New box" onClick={() => { eng.current?.restart(); root.current?.focus({ preventScroll: true }); }}>
                    <Icon name="arrow-counter-clockwise" size={13} /><span>New box</span>
                </button>
            )}
            <p className="lab-hint" ref={hint} aria-live="polite" hidden={status !== "ready"} />
        </div>
    );
}
