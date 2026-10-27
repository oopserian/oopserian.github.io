import { useRef, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "../_kit/icons";
import "./style.css";

interface Toast {
    id: number;
    icon: IconName;
    tone: "accent" | "success" | "danger";
    title: string;
    body: string;
}

// 轮流弹出来的几条
const MESSAGES: Omit<Toast, "id">[] = [
    { icon: "check-circle", tone: "success", title: "Changes saved", body: "Your profile is up to date." },
    { icon: "bell", tone: "accent", title: "New comment", body: "Mia replied to your post." },
    { icon: "calendar", tone: "accent", title: "Design review in 10 min", body: "Room 2 · with Leo and Ada" },
    { icon: "warning", tone: "danger", title: "Storage almost full", body: "4.6 of 5 GB used." },
    { icon: "link", tone: "accent", title: "Link copied", body: "eooo.me/lab/css-toast" },
];

const VISIBLE = 3; // 最多叠三张，第四张淡出去

export default function CssToast() {
    const next = useRef(3);
    const [toasts, setToasts] = useState<Toast[]>(() => MESSAGES.slice(0, 3).map((m, id) => ({ ...m, id })));
    // 触屏没有悬停，点一下列表展开、再点收起
    const [open, setOpen] = useState(false);

    const add = () => {
        const id = next.current++;
        // 淡出去的那张自己会删掉；连点很快时也别让数组越攒越长
        setToasts(prev => [...prev, { ...MESSAGES[id % MESSAGES.length], id }].slice(-(VISIBLE + 3)));
    };
    const drop = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    return (
        <div className="lab-root css-toast">
            <ol className="toasts" data-open={open || undefined} aria-live="polite" tabIndex={0}
                onPointerUp={e => { if (e.pointerType !== "mouse") setOpen(o => !o); }}>
                {toasts.map((t, k) => {
                    const index = toasts.length - 1 - k; // 0 是最新的、在最前面
                    const out = index >= VISIBLE;
                    return (
                        <li key={t.id} className={out ? "out" : undefined} style={{ "--i": index } as CSSProperties}
                            aria-hidden={out || undefined}
                            onTransitionEnd={e => { if (out && e.target === e.currentTarget && e.propertyName === "opacity") drop(t.id); }}>
                            <span className={`badge ${t.tone}`}><Icon name={t.icon} size={16} /></span>
                            <span className="text">
                                <b>{t.title}</b>
                                <span>{t.body}</span>
                            </span>
                            <time>now</time>
                        </li>
                    );
                })}
            </ol>
            <button className="lab-btn" onClick={add}><Icon name="bell" size={14} />Add toast</button>
            <p className="lab-hint"><span className="for-mouse">Hover the stack to spread it</span><span className="for-touch">Tap the stack to spread it</span></p>
        </div>
    );
}
