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
            const rotation = (index - centerIndex) * 8;
            return {
                rotate: rotation,
                // 计算X轴偏移，让卡牌横向分开
                translateX: (index - centerIndex) * 25,
                // 计算Y轴偏移，使卡牌呈弧形排列
                translateY: Math.abs(rotation) * 0,
                // 计算Z轴偏移，使卡牌有前后层次
                translateZ: -Math.abs(rotation) * 2
            }
        },
        hover: {
            rotate: 0,
            scale: 1.1,
            translateY: "+=25",
            translateX: "-=10"
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
                        // whileHover="hover"
                        onClick={() => {
                            console.log(index);
                        }}
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
        <div {...props} ref={ref} className={cn('border border-zinc-700 rounded-xl overflow-hidden', props.className)}>
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