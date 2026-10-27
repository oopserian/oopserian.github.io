import { useRef, useState, type FocusEvent, type PointerEvent } from "react";
import { Icon, type IconName } from "../_kit/icons";
import "./style.css";

type Kind = "search" | "refresh" | "alert" | "check";

const TILES: { kind: Kind; icon: IconName; label: string }[] = [
    { kind: "search", icon: "magnifying-glass", label: "Search" },
    { kind: "refresh", icon: "arrows-clockwise", label: "Refresh" },
    { kind: "alert", icon: "warning", label: "Delete" },
    { kind: "check", icon: "seal-check", label: "Verify" },
];

export default function HoverCursor() {
    const root = useRef<HTMLDivElement>(null);
    const cursor = useRef<HTMLDivElement>(null);
    const [kind, setKind] = useState<Kind | null>(null);
    const [shown, setShown] = useState(false);
    // 光标里的图标：最后一个是当前的，前面的正在飞出去，飞完自己删掉
    const seq = useRef(0);
    const [glyphs, setGlyphs] = useState<{ key: number; kind: Kind; out?: boolean }[]>([]);

    const become = (next: Kind | null) => {
        setKind(next);
        setGlyphs(prev => {
            const old = prev.map(g => ({ ...g, out: true }));
            return (next ? [...old, { key: seq.current++, kind: next }] : old).slice(-4);
        });
    };

    // 位置直接写到光标的 transform 上，指针动一下不重画 React
    const moveTo = (x: number, y: number) => {
        const r = root.current!.getBoundingClientRect();
        cursor.current!.style.transform = `translate3d(${x - r.left}px, ${y - r.top}px, 0)`;
    };
    const move = (e: PointerEvent) => {
        moveTo(e.clientX, e.clientY);
        if (!shown) setShown(true);
    };
    // 键盘移到哪块，光标就停到那块正中（鼠标点出来的焦点不算，不然一点光标就跳到正中）
    const keyboard = useRef(false);
    const focus = (e: FocusEvent<HTMLButtonElement>, k: Kind) => {
        keyboard.current = e.currentTarget.matches(":focus-visible");
        if (!keyboard.current) return;
        const r = e.currentTarget.getBoundingClientRect();
        moveTo(r.left + r.width / 2, r.top + r.height / 2);
        setShown(true);
        become(k);
    };

    return (
        <div className="lab-root hover-cursor" ref={root}
            onPointerMove={move} onPointerDown={move}
            onPointerLeave={() => { setShown(false); become(null); }}
            onPointerUp={e => { if (e.pointerType !== "mouse") { setShown(false); become(null); } }}>
            <div className="tiles">
                {TILES.map(t => (
                    <button key={t.kind} className="tile" data-kind={t.kind}
                        onPointerEnter={() => become(t.kind)} onPointerLeave={() => become(null)}
                        onFocus={e => focus(e, t.kind)}
                        onBlur={() => { if (keyboard.current) { keyboard.current = false; setShown(false); become(null); } }}>
                        <Icon name={t.icon} size={20} />
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>
            <div className="cursor" ref={cursor} data-shown={shown || undefined} aria-hidden="true">
                <div className="dot" data-kind={kind ?? undefined}>
                    {glyphs.map(g => (
                        <span key={g.key} className={`glyph${g.out ? " out" : ""}`}
                            onTransitionEnd={e => { if (g.out && e.target === e.currentTarget) setGlyphs(p => p.filter(x => x.key !== g.key)); }}>
                            <Icon name={TILES.find(t => t.kind === g.kind)!.icon} size={20} />
                        </span>
                    ))}
                </div>
            </div>
            <p className="lab-hint"><span className="for-mouse">Move over the tiles</span><span className="for-touch">Press a tile</span></p>
        </div>
    );
}
