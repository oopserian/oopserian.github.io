import { useEffect, useRef } from "react";
import { Icon } from "../_kit/icons";
import { create } from "./desk.js";
import "./style.css";

const isDark = (el: Element) => getComputedStyle(el).colorScheme.includes("dark");

// React 只渲染一次骨架；拿起、拖动、发送、纸的物理和 WebGL 全在 desk.js 和 paper.js 里，指针一动不经过 React
export default function PaperAttachments() {
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = root.current!;
        const desk = create(el);
        (el as HTMLDivElement & { __paper?: unknown }).__paper = desk; // 测试从这里拿
        // 换主题：顶栏的按钮改 <html data-theme>，跟随系统时看 prefers-color-scheme。纸在深色里压暗一点，影子更重
        const retheme = () => desk.theme(isDark(el));
        retheme();
        const mo = new MutationObserver(retheme);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        const dark = matchMedia("(prefers-color-scheme: dark)");
        dark.addEventListener("change", retheme);
        return () => { mo.disconnect(); dark.removeEventListener("change", retheme); desk.destroy(); };
    }, []);

    return (
        <div className="lab-root paper-lab" ref={root}>
            <div className="si">
                <section className="chat" aria-label="Conversation with Mia Chen">
                    <header className="ch-h">
                        <span className="av" aria-hidden="true">MC</span>
                        <span className="who"><b>Mia Chen</b><span>Northwind Studio</span></span>
                        <Icon name="phone" size={18} className="call" />
                    </header>
                    <div className="thread" aria-live="polite" />
                    <div className="cmp">
                        <div className="field">
                            <div className="atts" />
                            <div className="line">
                                <span className="ph" />
                                <button type="button" className="send" aria-label="Send" disabled>
                                    <Icon name="arrow-up" size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
                <section className="desk" aria-label="Files on the desk">
                    <div className="files" />
                </section>
                <canvas className="gl" aria-hidden="true" />
            </div>
            <p className="lab-hint">
                <span className="for-mouse">Drag a file into the chat · click to attach</span>
                <span className="for-touch">Drag a file into the chat · tap to attach</span>
            </p>
        </div>
    );
}
