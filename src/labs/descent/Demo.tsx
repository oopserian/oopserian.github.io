import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Icon } from "../_kit/icons";
import { create } from "./engine.js";
import { pathAt, zoneAt } from "./path.js";
import day4k from "./assets/earth-day-4k.webp?url";
import day2k from "./assets/earth-day-2k.webp?url";
import clouds4k from "./assets/clouds-4k.webp?url";
import clouds2k from "./assets/clouds-2k.webp?url";
import aux from "./assets/lights-land.webp?url";
import dem from "./assets/canary-dem.webp?url";
import demMax from "./assets/canary-dem-max.webp?url";
import posterUrl from "./assets/poster.webp?url";
import "./style.css";

type Engine = ReturnType<typeof create>;
type Status = "loading" | "ready" | "poster";

// 静帧（没有显卡时放的那张）停在 4.9 千米的积云上，泰德峰在正前方
const POSTER_ALT = 4900;

// 高度尺：海面以上按对数占上面六成二，海面以下到一千米占下面三成八
function gaugeY(a: number) {
    if (a >= 0) return 0.62 * (1 - Math.log10(Math.max(a, 1)) / Math.log10(16000e3));
    return 0.62 + (0.38 * Math.log10(1 - a)) / Math.log10(1001);
}
// 从尺上的位置反推进度：高度跟着进度一路往下，二分就行
function pAtY(y: number) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 28; i++) {
        const mid = (lo + hi) / 2;
        if (gaugeY(pathAt(mid).alt) < y) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}
const TICKS: [number, string, boolean][] = [
    [16000e3, "16,000 km", true], [1000e3, "1,000 km", false], [100e3, "100 km", false], [10e3, "10 km", false], [1e3, "1 km", false],
    [0, "0 m", true], [-10, "−10 m", false], [-100, "−100 m", false], [-1000, "−1,000 m", true],
];
const group = (n: number) => Math.round(n).toLocaleString("en-US");
function readout(a: number): [string, string] {
    if (a >= 1000) return [a >= 100e3 ? group(a / 1000) : (a / 1000).toFixed(a >= 10e3 ? 0 : 1), "km"];
    if (a >= 0) return [group(a), "m"];
    return [Math.round(-a) === 0 ? "0" : "−" + group(-a), "m"];
}

export default function Descent() {
    const root = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const num = useRef<HTMLSpanElement>(null);
    const unit = useRef<HTMLSpanElement>(null);
    const zone = useRef<HTMLSpanElement>(null);
    const mark = useRef<HTMLDivElement>(null);
    const gauge = useRef<HTMLDivElement>(null);
    const eng = useRef<Engine | null>(null);
    const flags = useRef({ auto: false, started: false, ended: false });
    const [status, setStatus] = useState<Status>("loading");
    const [big, setBig] = useState(false);       // 详情页的大舞台：滚轮、手指上下划都拿来下坠
    const [still, setStill] = useState(false);   // 「减弱动态效果」：不自动下坠
    const [playing, setPlaying] = useState(false);
    const [started, setStarted] = useState(false);
    const [ended, setEnded] = useState(false);

    // 读数每帧都变，直接改 DOM，不走 React 的渲染；只有播放、开始、到底这几个开关进 state
    const show = (alt: number, p: number) => {
        const [n, u] = readout(alt), z = zoneAt(alt);
        if (num.current!.textContent !== n) num.current!.textContent = n;
        if (unit.current!.textContent !== u) unit.current!.textContent = u;
        if (zone.current!.textContent !== z) zone.current!.textContent = z;
        mark.current!.style.transform = `translateY(${(gaugeY(alt) * 100).toFixed(3)}%)`;
        const g = gauge.current!, v = String(Math.round((1 - p) * 100));
        if (g.getAttribute("aria-valuenow") !== v) g.setAttribute("aria-valuenow", v);
        g.setAttribute("aria-valuetext", `${n} ${u}, ${z}`);
    };

    useEffect(() => {
        const el = root.current!;
        const isBig = !!el.closest(".stage.page");
        setBig(isBig);
        const motion = matchMedia("(prefers-reduced-motion: reduce)");
        setStill(motion.matches);
        show(pathAt(0).alt, 0);
        // 舞台宽过 700px 才下 4096 宽的地表和云图，卡片和手机上 2048 宽就够
        const hires = el.getBoundingClientRect().width >= 700;
        const d = create(canvas.current!, {
            big: isBig,
            still: motion.matches,
            textures: { day: hires ? day4k : day2k, clouds: hires ? clouds4k : clouds2k, aux, dem, demMax },
            onStatus: (s: Status) => { setStatus(s); if (s === "poster") show(POSTER_ALT, pAtY(gaugeY(POSTER_ALT))); },
            onFrame: ({ p, alt, auto }: { p: number; alt: number; auto: boolean }) => {
                show(alt, p);
                // 三个开关变了才进 React，平时每帧只改上面那几处 DOM
                const f = flags.current, st = p > 0.008 || auto, en = p > 0.985;
                if (f.auto !== auto) { f.auto = auto; setPlaying(auto); }
                if (f.started !== st) { f.started = st; setStarted(st); }
                if (f.ended !== en) { f.ended = en; setEnded(en); }
            },
        });
        eng.current = d;
        const remotion = () => { setStill(motion.matches); d.setStill(motion.matches); };
        motion.addEventListener("change", remotion);
        return () => { motion.removeEventListener("change", remotion); d.destroy(); eng.current = null; };
    }, []);

    const live = status === "ready";
    const toggle = () => { const d = eng.current; if (!d || !live || still) return; d.play(!d.auto); flags.current.auto = d.auto; setPlaying(d.auto); };

    // 高度尺可以拖、可以点；聚焦以后方向键、翻页键、Home/End 走，空格自动下坠
    const scrub = useRef(false);
    const seekAt = (e: PointerEvent) => {
        const r = gauge.current!.getBoundingClientRect();
        eng.current?.seek(pAtY(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))));
    };
    const down = (e: PointerEvent<HTMLDivElement>) => {
        if (!live) return;
        scrub.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekAt(e);
    };
    const move = (e: PointerEvent) => { if (scrub.current) seekAt(e); };
    const up = () => { scrub.current = false; };
    const key = (e: KeyboardEvent) => {
        const d = eng.current;
        if (!d || !live) return;
        const step: Record<string, number> = { ArrowDown: 0.012, ArrowRight: 0.012, ArrowUp: -0.012, ArrowLeft: -0.012, PageDown: 0.06, PageUp: -0.06 };
        if (e.key in step) d.nudge(step[e.key]);
        else if (e.key === "Home") d.seek(0);
        else if (e.key === "End") d.seek(1);
        else if (e.key === " " || e.key === "Enter") toggle();
        else return;
        e.preventDefault();
    };

    return (
        <div ref={root} className={`lab-root descent ${status}${big ? " big" : ""}${started ? " started" : ""}`}>
            {status === "poster" && <img className="poster" src={posterUrl} alt="" />}
            <canvas ref={canvas} role="img"
                aria-label="A single continuous shot that falls from orbit through the atmosphere and the clouds into the sea off the Canary Islands at sunset, then sinks a thousand metres down. Mount Teide stands on the horizon." />
            <div className="hud">
                <p className="geo">28.3°N 16.1°W · Sunset</p>
                <div className="readout">
                    <p className="alt"><span className="num" ref={num} /><span className="unit" ref={unit} /></p>
                    <p className="zone"><span ref={zone} /></p>
                </div>
                <div className="gauge" ref={gauge} tabIndex={live ? 0 : -1} role="slider" aria-label="Altitude" aria-orientation="vertical"
                    aria-valuemin={0} aria-valuemax={100} aria-disabled={!live}
                    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
                    <div className="track">
                        {TICKS.map(([a, label, key]) => (
                            <div key={a} className={`tick${a === 0 ? " sea" : ""}${key ? " key" : ""}`} style={{ top: `${gaugeY(a) * 100}%` }}><span>{label}</span></div>
                        ))}
                        <div className="mark" ref={mark} />
                    </div>
                </div>
                <div className="tools">
                    <button type="button" className="lab-btn play" onClick={toggle} disabled={!live || still} aria-pressed={playing}
                        aria-label={playing ? "Pause the fall" : "Play the fall"} title={still ? "Off while reduced motion is on" : undefined}>
                        <Icon name={playing ? "pause" : "play"} size={12} /><span>{playing ? "Pause" : "Play"}</span>
                    </button>
                </div>
                <div className={`end${ended && live ? " show" : ""}`}>
                    <p>A thousand metres down, sunlight gives out.</p>
                    <small className="for-mouse">Move the pointer to wake the plankton</small>
                    <small className="for-touch">Touch the water to wake the plankton</small>
                    <button type="button" className="lab-btn" onClick={() => eng.current?.seek(0)} tabIndex={ended ? 0 : -1}>
                        <Icon name="arrow-counter-clockwise" size={13} />Back to orbit
                    </button>
                </div>
            </div>
            <p className="lab-hint">
                {status === "loading" ? <span>Loading the planet…</span> : <>
                    <span className="for-mouse">{big ? "Scroll or drag to fall" : "Drag to fall"}</span>
                    <span className="for-touch">{big ? "Swipe up to fall" : "Drag the scale to fall"}</span>
                </>}
            </p>
        </div>
    );
}
