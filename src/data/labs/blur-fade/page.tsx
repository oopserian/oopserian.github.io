import { useState } from "react";
import cover from "./assets/cover.webp";


export default function Blurfade() {
    const [isActive, setIsActive] = useState<boolean>(false);
    return (
        <div onClick={() => setIsActive(!isActive)} className="relative w-full h-full flex flex-col gap-2 p-2 items-center justify-center">
            <div className="relative cursor-pointer w-1/2 h-full overflow-hidden rounded-xl border-2 border-zinc-500/10">
                <div className="relative w-full h-full rounded-xl overflow-hidden">
                    <img src={cover} alt="placeholder" className="w-full h-full object-cover" />
                </div>
                <div className="absolute w-full h-full top-0 left-0 rounded-xl">
                    {
                        Array.from({ length: 10 }).map((_, index) => (
                            <div key={index} className="absolute top-0 left-0 w-full h-full" style={{
                                zIndex: index + 1,
                                backdropFilter: isActive ? `blur(${Math.pow(2, index)}px)` : "blur(0px)",
                                mask: `radial-gradient(circle, rgba(0, 0, 0, 0) ${21 + index * 8}%, rgba(0, 0, 0, 1) ${29 + index * 8}%)`,
                                WebkitMask: `radial-gradient(circle, rgba(0, 0, 0, 0) ${21 + index * 8}%, rgba(0, 0, 0, 1) ${29 + index * 8}%)`,
                                transition: "all 0.5s ease-in-out",
                                transitionProperty: "backdrop-filter",
                                willChange: "backdrop-filter",
                                borderRadius: "inherit",
                            }}></div>
                        ))
                    }
                </div>
            </div>
            <p>Click It</p>
        </div>
    )
}