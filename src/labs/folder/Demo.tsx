import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Icon } from "../_kit/icons";
import photo1 from "./assets/temp-01.webp?url";
import photo2 from "./assets/temp-02.webp?url";
import photo3 from "./assets/temp-03.webp?url";
import "./style.css";

const PHOTOS = [photo1, photo2, photo3];

export default function Folder() {
    const [open, setOpen] = useState(false);
    const [picked, setPicked] = useState<number | null>(null); // 触屏点中的那张，鼠标用 :hover
    const pointer = useRef("mouse");

    // 鼠标：指上去打开、移开合上；触屏和键盘：点一下开、再点合上
    const enter = (e: PointerEvent) => { if (e.pointerType === "mouse") setOpen(true); };
    const leave = (e: PointerEvent) => { if (e.pointerType === "mouse") { setOpen(false); setPicked(null); } };
    const toggle = () => {
        if (pointer.current === "mouse") return;
        setOpen(o => !o);
        setPicked(null);
    };
    const key = (e: KeyboardEvent) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        setOpen(o => !o);
    };

    return (
        <div className="lab-root folder-lab">
            <div className="folder" role="button" tabIndex={0} aria-expanded={open} aria-label="Photos folder"
                data-open={open || undefined}
                onPointerEnter={enter} onPointerLeave={leave}
                onPointerDown={e => { pointer.current = e.pointerType; }}
                onClick={toggle} onKeyDown={key}>
                {/* 后片：带耳朵的轮廓是一条路径，宽高一起缩放 */}
                <svg className="back" viewBox="0 0 332 256" aria-hidden="true">
                    <path d="M22,0 H100 C122,0 122,22 144,22 H310 A22,22 0 0 1 332,44 V234 A22,22 0 0 1 310,256 H22 A22,22 0 0 1 0,234 V22 A22,22 0 0 1 22,0" />
                </svg>
                <span className="photos">
                    {PHOTOS.map((src, i) => (
                        <img key={i} src={src} alt="" draggable={false} className={picked === i ? "picked" : undefined}
                            onClick={e => {
                                // 开着的时候，触屏点照片是拿起这张，不是合上文件夹
                                if (!open || pointer.current === "mouse") return;
                                e.stopPropagation();
                                setPicked(p => p === i ? null : i);
                            }} />
                    ))}
                </span>
                <span className="front"><Icon name="images" size={36} /></span>
            </div>
            <p className="lab-hint"><span className="for-mouse">Hover the folder, then a photo</span><span className="for-touch">Tap the folder, then a photo</span></p>
        </div>
    );
}
