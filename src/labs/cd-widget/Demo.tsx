import { useState } from "react";
import { Icon } from "../_kit/icons";
import cover from "./assets/cover.webp?url";
import "./style.css";

export default function CdWidget() {
    const [playing, setPlaying] = useState(false);
    const toggle = () => setPlaying(p => !p);
    const label = playing ? "Pause" : "Play";

    return (
        <div className="lab-root cd-widget">
            <article className="player" data-playing={playing || undefined}>
                <img className="backdrop" src={cover} alt="" draggable={false} />
                {/* 光盘：封面裁成圆、往上推，只露下半张。转的只有这一层，暂停就停在原来的角度 */}
                <button className="disc" onClick={toggle} aria-label={label} tabIndex={-1}>
                    <span className="spin">
                        <img src={cover} alt="" draggable={false} />
                        <span className="hub" />
                    </span>
                    <span className="sheen" />
                </button>
                <div className="info">
                    <p className="meta"><b>Perfectionism</b><span>Jay Chou</span></p>
                    <button className="play" onClick={toggle} aria-label={label} aria-pressed={playing}>
                        <Icon name={playing ? "pause" : "play"} size={18} />
                    </button>
                </div>
                <div className="bar"><span /></div>
            </article>
            <p className="lab-hint">Press play</p>
        </div>
    );
}
