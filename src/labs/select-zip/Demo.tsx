import { useEffect, useRef } from "react";
import { Icon } from "../_kit/icons";
import { create } from "./folder.js";
import "./style.css";

// React 只渲染一次骨架；框选、跟手的计数、操作栏、压缩和解压全在 folder.js 里，指针一动不经过 React
export default function SelectZip() {
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = root.current!;
        const folder = create(el);
        const host = el as HTMLDivElement & { __folder?: unknown; __og?: () => void };
        host.__folder = folder;     // 测试从这里拿
        host.__og = folder.pose;    // tools/og.mjs 截分享图前调：选中几个文件，栏出来
        return () => folder.destroy();
    }, []);

    return (
        <div className="lab-root sel-lab" data-fit="" ref={root}>
            <div className="si">
                <section className="win" aria-label="Above the Clouds folder">
                    <header className="hd">
                        <svg className="fd" width="22" height="18" viewBox="0 0 44 36" aria-hidden="true">
                            <path className="fdb" d="M4 2.5h11.2a3 3 0 0 1 2.2 1l2.6 2.8H40a3 3 0 0 1 3 3V31a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V5.5a3 3 0 0 1 3-3Z" />
                            <path className="fdf" d="M1 12.5a3 3 0 0 1 3-3h36a3 3 0 0 1 3 3V31a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3Z" />
                        </svg>
                        <b>Above the Clouds</b>
                        <span className="ct" aria-hidden="true" />
                    </header>
                    <div className="files" role="listbox" aria-multiselectable="true" aria-label="Files" />
                    <div className="mq" aria-hidden="true" />
                    <div className="empty" hidden>
                        <span>This folder is empty</span>
                        <button type="button" className="lab-btn put">Put Back</button>
                    </div>
                </section>
                <div className="bar" data-s="off">
                    <div className="bg">
                        <span className="cnt" aria-hidden="true"><span className="cn" /></span>
                        <div className="row main" role="toolbar" aria-label="Selection">
                            <button type="button" className="b x" aria-label="Clear selection"><Icon name="x" size={16} /></button>
                            <span className="tx" aria-hidden="true"><b className="t1" /><span className="t2"><span className="sz" /><i className="pc" /></span></span>
                            <button type="button" className="b share" aria-label="Copy link">
                                <span className="icm"><Icon name="link" size={18} className="a" /><Icon name="check" size={18} className="b2" /></span>
                            </button>
                            <button type="button" className="b zip" aria-label="Compress">
                                <svg className="prog" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.25" /></svg>
                                <span className="icm"><Icon name="file-zip" size={18} className="a" /><Icon name="box-arrow-up" size={18} className="b2" /></span>
                            </button>
                            <button type="button" className="b del" aria-label="Delete"><Icon name="trash" size={18} /></button>
                        </div>
                        <div className="row undo">
                            <span className="tx" aria-hidden="true"><b className="u1" /></span>
                            <button type="button" className="ub">Undo</button>
                        </div>
                    </div>
                </div>
            </div>
            <p className="sr" aria-live="polite" />
            <p className="lab-hint">
                <span className="for-mouse">Drag across the files to select them</span>
                <span className="for-touch">Swipe sideways across the files to select</span>
            </p>
        </div>
    );
}
