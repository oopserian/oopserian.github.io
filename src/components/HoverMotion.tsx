import { cn } from "@/lib/utils";
import React, { HtmlHTMLAttributes, RefObject, useContext, useEffect, useRef, useState } from "react";

interface HoverMotionProps extends HtmlHTMLAttributes<HTMLElement> {
    children: React.ReactNode;
}

const HoverMotionContext = React.createContext<{
    x: number;
    y: number;
}>({ x: 0, y: 0 });

export const Root: React.FC<HoverMotionProps> = ({ children, ...props }) => {
    const ref = useRef<HTMLDivElement>(null);
    let [x, y] = usePointerMove(ref);

    return (
        <HoverMotionContext.Provider value={{ x, y }}>
            <div ref={ref} {...props}>
                {children}
            </div>
        </HoverMotionContext.Provider>
    )
}

interface TiltProps extends HtmlHTMLAttributes<HTMLElement> {
    children: React.ReactNode;
    strength?: {
        x?: number;
        y?: number;
    };
}

export const Tilt: React.FC<TiltProps> = ({ children, strength, ...props }) => {
    const { x, y } = useContext(HoverMotionContext);

    const rotate = `rotateY(${x * (strength?.x || 1)}deg) rotateX(${-y * (strength?.y || 1)}deg)`;
    const scale = `scale3d(1.05, 1.05, 1.05)`;

    const style = {
        transform: `perspective(500px) ${rotate} ${(x || y) ? scale : ''}`,
        transition: 'transform .2s ease-out',
        willChange: 'transform',
        ...props.style
    };

    return (
        <div {...props}
            className={cn("relative", props.className)}
            style={style}>
            {children}
        </div>
    )
};

interface MagneticProps extends HtmlHTMLAttributes<HTMLElement> {
    children: React.ReactNode;
    strength?: {
        x?: number;
        y?: number;
    };
}

export const Magnetic: React.FC<MagneticProps> = ({ children, strength, ...props }) => {
    const { x, y } = useContext(HoverMotionContext);

    const translate = `perspective(500px) translate(${x * (strength?.x || 1)}px, ${y * (strength?.y || 1)}px)`;

    const style = {
        transform: `${translate}`,
        transition: 'transform .2s ease-out',
        willChange: 'transform',
        ...props.style
    };

    return (
        <div {...props}
            className={cn("relative", props.className)}
            style={style}>
            {children}
        </div>
    )
};

const usePointerMove = (ref: RefObject<HTMLElement>): [number, number] => {
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
};

export const HoverMotion = Object.assign(Root, {
    Root,
    Tilt,
    Magnetic
});