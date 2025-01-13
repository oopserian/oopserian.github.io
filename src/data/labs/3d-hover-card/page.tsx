import { RefObject, useEffect, useRef, useState } from "react";

export default function HoverCard3d() {
    const ref = useRef(null);
    let [x, y] = usePointer(ref);

    return (
        <div ref={ref} className="w-full h-full flex items-center justify-center p-6">
            <div style={{
                transform: `perspective(500px) rotateX(${-y}deg) rotateY(${x}deg) ${(x || y) ? 'scale3d(1.1, 1.1, 1)' : ''} `,
                transition: 'transform .2s ease-out',
                willChange: 'transform'
            }} className="relaative flex items-center justify-center w-48 h-48 bg-slate-300 rounded-2xl">
                <p className="text-blue-500 text-3xl font-bold select-none" style={{
                    transform: `perspective(500px) translate(${x * 3}px,${y * 3}px)`,
                    transition: 'transform .2s ease-out',
                    willChange: 'transform'
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
        const handlePointerMove = ({ clientX, clientY }: MouseEvent) => {
            const { width, height, top, left } = el.getBoundingClientRect();
            const offsetX = clientX - left;
            const offsetY = clientY - top;
            const x = (offsetX - width / 2) / 10 * 2;
            const y = (offsetY - height / 2) / 10 * 2;
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