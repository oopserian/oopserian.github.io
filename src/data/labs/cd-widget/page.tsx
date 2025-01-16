import { useState } from "react";
import cover from "./assets/cover.webp";
import { motion } from "motion/react";
import { IconPlayerPlayFilled, IconPlayerPauseFilled } from "@tabler/icons-react";

export default function CdWidget() {
    const [isPlay, setIsPlay] = useState<boolean>(false);
    return (
        <div className="flex items-center justify-center p-6">
            <div className="relative flex flex-col w-48 h-48 overflow-hidden bg-zinc-300 rounded-3xl shadow-lg">
                <div className="absolute pointer-events-none rounded-[inherit] z-10 top-0 left-0 w-full h-full border border-neutral-400/40"></div>
                <div className="absolute w-full h-full blur-md opacity-30">
                    <img className="w-full h-full object-cover" src={cover} alt="jaychou" />
                </div>
                <motion.div initial={{
                    rotate: -90
                }} whileHover={{
                    scale: 1.1
                }} animate={{
                    rotate: isPlay ? [-90, 270] : -90
                }} transition={isPlay ? {
                    duration: 10,
                    ease: 'linear',
                    repeat: Infinity
                } : {}} className="relative -mt-20 w-full rounded-full overflow-hidden shadow-lg">
                    <img className="w-full h-full object-cover" src={cover} alt="jaychou" />
                    <div className="absolute w-full h-full top-0 left-0 border border-zinc-50/60 rounded-full"></div>
                    <div className="absolute w-[30%] h-[30%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-50/20 border-dashed">
                        <div className="absolute w-[90%] h-[90%] bg-zinc-400/50 backdrop-blur-sm border border-zinc-50/70 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
                        <div className="absolute w-[50%] h-[50%] bg-zinc-300/60 border-[0.5px] border-zinc-50/20 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
                        <div className="absolute w-[35%] h-[35%] bg-zinc-100 border-[0.5px] border-zinc-50/20 shadow-[inset_0px_0px_2px_1px_rgba(0,0,0,0.1)] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
                    </div>
                </motion.div>
                <div className="relative flex-1 flex flex-col justify-end p-4">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                            <p className="text-zinc-700 text-xs leading-none">Perfectionism</p>
                            <p className="text-zinc-500 text-xs leading-none">Jay Chou</p>
                        </div>
                        <motion.div className="cursor-pointer"
                            whileTap={{
                                scale: 0.8
                            }} onClick={() => isPlay ? setIsPlay(false) : setIsPlay(true)}>
                            {
                                isPlay ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />
                            }
                        </motion.div>
                    </div>
                    <div className="relative mt-2 w-full h-1 bg-zinc-50/50 rounded-full overflow-hidden transition-transform hover:scale-y-150">
                        <motion.div animate={{
                            translateX: isPlay ? ['-100%', '0%'] : '-100%'
                        }} transition={isPlay ? {
                            duration: 60,
                            ease: 'linear'
                        } : {}} className="absolute top-0 left-0 w-full h-full bg-white rounded-full"></motion.div>
                    </div>
                </div>
            </div>
        </div>
    )
}