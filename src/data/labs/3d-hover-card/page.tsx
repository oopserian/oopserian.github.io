import React, { RefObject, useEffect, useRef, useState } from "react";
import { motion, Variants } from "motion/react";
import card01 from "./assets/card-01.svg";
import card02 from "./assets/card-02.svg";
import card03 from "./assets/card-03.svg";
import card04 from "./assets/card-04.svg";
import { cn } from "@/lib/utils";

export default function HoverCard3d() {
    const cards = [card01, card02, card03, card04];
    const centerIndex = (cards.length - 1) / 2;
    const variants: Variants = {
        initial: (index: number) => {
            // 计算旋转角度
            const rotation = (index - centerIndex) * 10;
            return {
                rotate: rotation,
                // 计算X轴偏移，让卡牌横向分开
                translateX: (index - centerIndex) * 30,
                // 计算Y轴偏移，使卡牌呈弧形排列
                translateY: Math.abs(rotation) * 0,
                // 计算Z轴偏移，使卡牌有前后层次
                translateZ: -Math.abs(rotation) * 2
            }
        },
        hover: (index: number) => {
            const rotation = (index - centerIndex) * 10;
            const translateY = Math.abs(rotation) * 0;
            const translateX = (index - centerIndex) * 30
            return {
                rotate: 0,
                scale: 1,
                translateY: translateY - 25,
                translateX: translateX - 15,
            }
        }
    }

    return (
        <div className="w-full h-full min-h-60 flex items-center justify-center p-6">
            {cards.map((src, index) => {
                return (
                    <motion.div
                        className="absolute w-20"
                        key={index}
                        custom={index}
                        variants={variants}
                        initial="initial"
                        whileHover="hover"
                    >
                        <Card src={src} />
                    </motion.div>
                );
            })}
        </div>
    );
}


interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    src: string
}

const Card: React.FC<CardProps> = ({ src, ...props }) => {
    const ref = useRef(null);
    let [x, y] = usePointer(ref);

    return (
        <div {...props} ref={ref} style={{
            transform: `perspective(500px) rotateX(${-y * 3}deg) rotateY(${x * 3}deg)`,
            transition: 'transform 0.2s ease-out',
            willChange: 'transform',
        }} className={cn('group border border-zinc-700 rounded-xl overflow-hidden', props.className)}>
            <div style={{
                transform: `translateX(${x * 4}px) translateY(${y * 4}px)`,
                transition: 'transform 0.1s ease-out',
                transitionProperty: 'transform,opacity',
                willChange: 'transform',
            }} className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-0 group-hover:opacity-100">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 inset-0 w-16 h-16 blur-lg bg-white/50 rounded-full"></div>
            </div>
            <img src={src} />
        </div>
    )
}


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