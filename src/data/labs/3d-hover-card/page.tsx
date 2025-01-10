import { RefObject, useEffect, useRef, useState } from "react";

export default function HoverCard3d() {
    const ref = useRef(null);
    let [x, y] = usePointer(ref);

    return (
        <div className="w-full h-full flex items-center justify-center">
            <div ref={ref} style={{
                transform: `perspective(500px) rotateX(${-y}deg) rotateY(${x}deg) scale3d(1, 1, 1)`
            }} className="flex items-center justify-center w-1/2 h-1/2 bg-slate-300 rounded-2xl">
                <p className="text-blue-500 text-3xl pointer-events-none font-bold" style={{
                    transform: `translate(${x * 3}px,${y * 3}px)`
                }}>
                    content
                </p>
            </div>
        </div>
    )
};


const usePointer = (ref: RefObject<HTMLElement>): [number, number] => {
    const [location, setLocation] = useState<[number, number]>([0, 0]);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const handlePointerMove = ({ offsetX, offsetY }: MouseEvent) => {
            const { clientWidth, clientHeight } = el;
            const x = (offsetX - clientWidth / 2) / 10 * 2;
            const y = (offsetY - clientHeight / 2) / 10 * 2;
            setLocation([x, y]);
        };
        const handlePointerLeave = () => {
            setLocation([0, 0]);
        };
        const destroyListener = () => {
            el.removeEventListener("pointermove", handlePointerMove);
            el.removeEventListener("pointerleave", handlePointerLeave);
        };

        el.addEventListener("pointerleave", handlePointerLeave);
        el.addEventListener("pointermove", handlePointerMove);

        return destroyListener;
    }, []);

    return location
}