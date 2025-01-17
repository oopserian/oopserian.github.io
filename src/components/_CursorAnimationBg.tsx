import { useEffect, useState } from "react";

export const CursorAnimationBg = () => {
    const [x, y] = usePointerMove();

    return (
        <div className="fixed top-0 left-0 w-full h-full">
            <div style={{
                transform: `translate(${x - 40}px, ${y - 40}px)`,
                transition: 'transform .3s ease-out'
            }} className="blur-2xl bg-gradient-to-br from-slate-200 to-sky-400/2 absolute top-0 left-0 w-20 h-20 rounded-full pointer-events-none"></div>
            <div style={{
                transform: `translate(${x - 20}px, ${y - 20}px)`,
                transition: 'transform 1s ease-out'
            }} className="blur-3xl bg-gradient-to-br from-sky-300 to-sky-400/2 absolute top-0 left-0 w-28 h-28 rounded-full pointer-events-none"></div>
        </div>
    )
}

const usePointerMove = (): [number, number] => {
    const [location, setLocation] = useState<[number, number]>([0, 0]);

    useEffect(() => {
        const handlePointerMove = ({ pageX, pageY }: MouseEvent) => {
            setLocation([pageX, pageY]);
        };
        const handlePointerLeave = () => {
            setLocation([0, 0]);
        };
        const destroyListener = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerleave", handlePointerLeave);
        };

        window.addEventListener("pointerleave", handlePointerLeave);
        window.addEventListener("pointermove", handlePointerMove);

        return destroyListener;
    }, []);

    return location
};