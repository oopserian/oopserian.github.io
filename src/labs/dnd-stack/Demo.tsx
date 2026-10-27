import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Icon, type IconName } from "../_kit/icons";
import "./style.css";

const W = 76; // 卡片的宽高
const H = 96;
const NEAR = 56; // 拖着的卡片中心离一叠的中心这么近，就算放进这一叠
const PAD = 10;  // 卡片离舞台边至少留这么多

const ITEMS: { icon: IconName; label: string }[] = [
    { icon: "image", label: "Photos" },
    { icon: "music-notes", label: "Music" },
    { icon: "note", label: "Notes" },
    { icon: "link", label: "Links" },
    { icon: "code", label: "Code" },
    { icon: "map-pin", label: "Places" },
];
const TILT = [-5, 4, -3, 6, -4, 3]; // 每张卡压在下面时歪的角度，叠起来不至于太整齐

// 一叠：中心在舞台上的位置（按宽高的比例记，舞台变大变小跟着走），cards 从下往上
interface Pile { id: number; x: number; y: number; cards: number[] }
const START: Pile[] = [
    { id: 0, x: 0.2, y: 0.47, cards: [0, 1] },
    { id: 1, x: 0.5, y: 0.47, cards: [2, 3, 4] },
    { id: 2, x: 0.8, y: 0.47, cards: [5] },
];

interface Drag { card: number; pile: number; sx: number; sy: number; cx: number; cy: number; moved: boolean; el: HTMLElement }

const clamp = (v: number, lo: number, hi: number) => lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi);

export default function DndStack() {
    const root = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<{ w: number; h: number } | null>(null);
    const [piles, setPiles] = useState(START);
    const [spread, setSpread] = useState<number | null>(null); // 摊开的那一叠
    const [dragging, setDragging] = useState<number | null>(null);
    const [target, setTarget] = useState<number | null>(null); // 拖着经过、松手就会放进去的那一叠
    const drag = useRef<Drag | null>(null);
    const dragged = useRef(false); // 刚拖完松手
    const settle = useRef<HTMLElement | null>(null);
    const nextId = useRef(START.length);
    const ringAt = useRef<CSSProperties>(undefined);

    useLayoutEffect(() => {
        const el = root.current!;
        const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // 松手以后：拖动时手写的偏移在这一帧清掉，跟新位置一起交给 CSS 过渡，卡片从松手的地方滑到该去的地方
    useLayoutEffect(() => {
        const el = settle.current;
        if (!el) return;
        el.style.removeProperty("--dx");
        el.style.removeProperty("--dy");
        settle.current = null;
    });

    if (!size) return <div className="lab-root dnd-stack" ref={root} />;

    // 摊开时相邻两张错开多少：尽量少压着，舞台窄就挤一挤
    const step = (n: number) => n < 2 ? 0 : Math.min(W * 0.9, (size.w - 2 * PAD - W) / (n - 1));
    // 每一叠的中心（像素）。摊开的那叠要是挨着边，往里挪到摊得下
    const centre = (p: Pile) => {
        let hw = W / 2 + PAD;
        if (p.id === spread) hw += ((p.cards.length - 1) / 2) * step(p.cards.length);
        return {
            x: clamp(p.x * size.w, hw, size.w - hw),
            y: clamp(p.y * size.h, H / 2 + PAD + 8, size.h - H / 2 - 36),
        };
    };

    // 每张卡该在哪：叠着时下面的往下错开 3px、歪一点，最上面那张摆正；摊开时排成一道弧
    const place = new Map<number, { x: number; y: number; r: number; z: number; pile: Pile; top: boolean }>();
    piles.forEach((p, order) => {
        const c = centre(p);
        const n = p.cards.length;
        p.cards.forEach((card, i) => {
            const top = i === n - 1;
            let dx = 0, dy = (n - 1 - i) * 3, r = top ? 0 : TILT[card];
            if (p.id === spread) {
                const k = i - (n - 1) / 2;
                dx = k * step(n);
                dy = k * k * 4;
                r = k * 5;
            }
            // 摊开的那叠压在所有叠上面，舞台窄、摊开压到旁边时也看得清
            place.set(card, { x: c.x + dx - W / 2, y: c.y + dy - H / 2, r, z: (p.id === spread ? 50 : order) * 10 + i, pile: p, top });
        });
    });

    const canDrag = (card: number) => {
        const at = place.get(card)!;
        return at.top || at.pile.id === spread;
    };

    const down = (e: PointerEvent<HTMLDivElement>, card: number) => {
        if (e.button !== 0 || !canDrag(card)) return;
        const at = place.get(card)!;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { card, pile: at.pile.id, sx: e.clientX, sy: e.clientY, cx: at.x + W / 2, cy: at.y + H / 2, moved: false, el: e.currentTarget };
    };

    const move = (e: PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
        if (!d.moved) {
            if (Math.hypot(dx, dy) < 4) return; // 手抖不算拖
            d.moved = true;
            setDragging(d.card);
        }
        d.el.style.setProperty("--dx", `${dx}px`);
        d.el.style.setProperty("--dy", `${dy}px`);
        // 找离卡片中心最近的一叠，够近就亮起来；最近的是它自己那叠，就是放回去
        const x = d.cx + dx, y = d.cy + dy;
        let best: number | null = null, dist = NEAR;
        for (const p of piles) {
            const c = centre(p);
            const k = Math.hypot(c.x - x, c.y - y);
            if (k < dist) { dist = k; best = p.id; }
        }
        const next = best === d.pile ? null : best;
        if (next !== target) setTarget(next);
    };

    const up = (e: PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        drag.current = null;
        if (!d.moved) return; // 没拖动，交给 click
        // 鼠标拖完松手紧跟着还有一个 click（触屏拖完没有），这一轮里别把它当成点击
        dragged.current = true;
        setTimeout(() => { dragged.current = false; });
        settle.current = d.el;
        setDragging(null);
        setTarget(null);
        setSpread(null);
        if (e.type === "pointercancel") return; // 被系统打断（比如来电），放回原处

        const x = d.cx + e.clientX - d.sx, y = d.cy + e.clientY - d.sy;
        const source = piles.find(p => p.id === d.pile)!;
        const into = target === null ? null : piles.find(p => p.id === target);
        const nearOwn = Math.hypot(centre(source).x - x, centre(source).y - y) < NEAR;
        if (!into && nearOwn) return; // 放回自己那叠

        const rest = piles
            .map(p => p.id === d.pile ? { ...p, cards: p.cards.filter(c => c !== d.card) } : p)
            .filter(p => p.cards.length > 0);
        if (into) {
            // 放进别的一叠：放在最上面，这一叠也挪到最上层
            const merged = { ...into, cards: [...into.cards, d.card] };
            setPiles([...rest.filter(p => p.id !== into.id), merged]);
        } else {
            // 放在空地上：自己成一叠。原来那叠只剩它一张的话，就是把那叠挪了个地方
            const id = source.cards.length === 1 ? source.id : nextId.current++;
            const fx = clamp(x, W / 2 + PAD, size.w - W / 2 - PAD) / size.w;
            const fy = clamp(y, H / 2 + PAD + 8, size.h - H / 2 - 36) / size.h;
            setPiles([...rest, { id, x: fx, y: fy, cards: [d.card] }]);
        }
    };

    const toggle = (card: number) => {
        if (dragged.current) return;
        const pile = place.get(card)!.pile;
        setSpread(s => s === pile.id || pile.cards.length < 2 ? null : pile.id);
    };
    const key = (e: KeyboardEvent, card: number) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        toggle(card);
    };

    const changed = JSON.stringify(piles) !== JSON.stringify(START);
    // 亮圈垫在目标那叠最底下一张的下面；不亮时停在上次的位置，下次亮起来不会从角落飞过来
    const ring = target === null ? null : piles.find(p => p.id === target);
    if (ring) {
        const at = place.get(ring.cards[ring.cards.length - 1])!;
        ringAt.current = { "--x": `${at.x}px`, "--y": `${at.y}px`, zIndex: piles.indexOf(ring) * 10 } as CSSProperties;
    }

    return (
        <div className="lab-root dnd-stack" ref={root} onPointerDown={e => { if (e.target === e.currentTarget) setSpread(null); }}>
            {/* 拖着经过的那一叠底下亮一圈，告诉人松手会放进去 */}
            <span className="ring" data-shown={ring ? true : undefined} style={ringAt.current} />

            {ITEMS.map((item, card) => {
                const at = place.get(card)!;
                const n = at.pile.cards.length;
                return (
                    <div key={card} className="card" role="button"
                        tabIndex={canDrag(card) ? 0 : -1}
                        aria-label={n > 1 ? `${item.label}, top of a pile of ${n}` : item.label}
                        data-drag={canDrag(card) || undefined}
                        data-dragging={dragging === card || undefined}
                        data-dim={(spread !== null && at.pile.id !== spread) || undefined}
                        style={{ "--x": `${at.x}px`, "--y": `${at.y}px`, "--r": `${at.r}deg`, zIndex: dragging === card ? 100 : at.z } as CSSProperties}
                        onPointerDown={e => down(e, card)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                        onClick={() => toggle(card)} onKeyDown={e => key(e, card)}>
                        <span className="art"><Icon name={item.icon} size={22} /></span>
                        <span className="label">{item.label}</span>
                    </div>
                );
            })}

            {/* 一叠两张以上，右上角标张数；拖走的那张不算 */}
            {piles.map((p, order) => {
                const count = p.cards.filter(c => c !== dragging).length;
                const top = place.get(p.cards[p.cards.length - 1])!;
                const show = count > 1 && p.id !== spread;
                return (
                    <span key={p.id} className="count" data-shown={show || undefined} data-dim={spread !== null || undefined} aria-hidden="true"
                        style={{ "--x": `${top.x + W - 10}px`, "--y": `${top.y - 8}px`, zIndex: order * 10 + 9 } as CSSProperties}>
                        {count}
                    </span>
                );
            })}

            <button className="lab-btn reset" onClick={() => { setPiles(START); setSpread(null); }} disabled={!changed}>
                <Icon name="arrow-counter-clockwise" size={14} />Reset
            </button>
            <p className="lab-hint"><span className="for-mouse">Drag cards between piles · click a pile to fan it out</span><span className="for-touch">Drag cards between piles · tap to fan out</span></p>
        </div>
    );
}
