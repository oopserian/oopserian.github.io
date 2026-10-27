import { useState } from "react";
import cover from "./assets/cover.webp?url";
import "./style.css";

// 一层层叠起来的模糊：第 i 层模糊 2^(i+1) 像素，遮罩中间清楚的一圈每层往外扩 12%，越往边上叠得越厚
const LAYERS = 6;
const layers = Array.from({ length: LAYERS }, (_, i) => {
    const mask = `radial-gradient(circle, transparent ${20 + i * 12}%, black ${32 + i * 12}%)`;
    return { backdropFilter: `blur(${2 ** (i + 1)}px)`, WebkitBackdropFilter: `blur(${2 ** (i + 1)}px)`, mask, WebkitMask: mask };
});

export default function BlurFade() {
    const [on, setOn] = useState(false);
    // 模糊层很贵（每层都要把底下重新模糊一遍），所以只在开着、正在淡出的时候挂着；关上以后一层都不留
    const [mounted, setMounted] = useState(false);

    const toggle = () => {
        if (on) return setOn(false);
        setMounted(true);
        requestAnimationFrame(() => requestAnimationFrame(() => setOn(true))); // 先挂上透明的，下一帧再淡入
    };

    return (
        <div className="lab-root blur-fade">
            <button className={`photo${on ? " on" : ""}`} onClick={toggle} aria-pressed={on} aria-label="Toggle the blur">
                <img src={cover} alt="" draggable={false} />
                {mounted && (
                    <span className="layers" onTransitionEnd={e => { if (!on && e.target === e.currentTarget.lastChild) setMounted(false); }}>
                        {layers.map((style, i) => <span key={i} style={style} />)}
                    </span>
                )}
            </button>
            <p className="lab-hint">{on ? "Click to clear" : "Click the photo"}</p>
        </div>
    );
}
