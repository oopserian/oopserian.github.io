import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import card01 from "./assets/card-01.svg?url";
import card02 from "./assets/card-02.svg?url";
import card03 from "./assets/card-03.svg?url";
import card04 from "./assets/card-04.svg?url";
import "./style.css";

const CARDS = [card01, card02, card03, card04];
const MID = (CARDS.length - 1) / 2;

export default function HoverCard3d() {
    // 指着、摸着或者键盘停在哪张上。只在换牌的时候改一次，指针在牌上移动不重画 React
    const [active, setActive] = useState<number | null>(null);

    return (
        <div className="lab-root hover-card-3d" onPointerLeave={() => setActive(null)}>
            <div className="hand">
                {CARDS.map((src, i) => {
                    const o = i - MID; // 离手牌正中差几张，左负右正
                    // 拿起一张时，两边的牌各往外让一点
                    const push = active === null || active === i ? 0 : i < active ? -1 : 1;
                    return (
                        <Card key={i} src={src} on={active === i}
                            style={{ "--o": o, "--push": push, zIndex: active === i ? 10 : i } as CSSProperties}
                            onEnter={() => setActive(i)} onLeave={() => setActive(a => a === i ? null : a)} />
                    );
                })}
            </div>
            <p className="lab-hint"><span className="for-mouse">Hover a card</span><span className="for-touch">Touch a card</span></p>
        </div>
    );
}

function Card({ src, on, style, onEnter, onLeave }: {
    src: string; on: boolean; style: CSSProperties; onEnter: () => void; onLeave: () => void;
}) {
    const tilt = useRef<HTMLDivElement>(null);

    // 指针在牌上的位置直接写成 CSS 变量，倾斜和反光都由 CSS 算，不经过 React
    const track = (e: PointerEvent) => {
        const el = tilt.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) - 0.5;
        const y = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1) - 0.5;
        el.style.setProperty("--x", x.toFixed(3));
        el.style.setProperty("--y", y.toFixed(3));
    };
    const reset = () => {
        tilt.current?.style.setProperty("--x", "0");
        tilt.current?.style.setProperty("--y", "0");
    };

    return (
        // 外面这层只占着扇形里的位置、接指针，不动；动的是里面，所以牌抬起来不会从指针底下溜走、来回闪
        <div className={`slot${on ? " on" : ""}`} style={style} tabIndex={0}
            onPointerEnter={e => { onEnter(); track(e); }}
            onPointerDown={e => { onEnter(); track(e); }}
            onPointerMove={track}
            onPointerLeave={() => { onLeave(); reset(); }}
            onFocus={onEnter} onBlur={() => { onLeave(); reset(); }}>
            <div className="lift">
                <div className="tilt" ref={tilt}>
                    <img src={src} alt="" draggable={false} />
                    <span className="glare" />
                </div>
            </div>
        </div>
    );
}
