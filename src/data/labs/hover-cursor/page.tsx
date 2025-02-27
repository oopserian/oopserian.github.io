import { cn } from "@/lib/utils";
import { createContext, ReactNode, RefObject, useContext, useEffect, useRef, useState } from "react";
import { IconSearch, IconRefresh, IconAlertTriangle, IconRosetteDiscountCheck } from "@tabler/icons-react";
import { AnimatePresence, motion, Variants } from "motion/react";

type CursorType = "default" | "link" | "button" | "alert" | "check";

interface CursorTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
    type: CursorType;
    children: ReactNode;
}

interface CursorPosition {
    relativeX: number;
    relativeY: number;
    offsetX: number;
    offsetY: number;
}


interface CursorContextType extends CursorPosition {
    relativeX: number;
    relativeY: number;
    offsetX: number;
    offsetY: number;
    cursorType: CursorType
    ref: RefObject<HTMLDivElement> | null;
    setCursorType: (type: CursorType) => void;
}

const CursorContext = createContext<CursorContextType>({
    relativeX: 0,
    relativeY: 0,
    offsetX: 0,
    offsetY: 0,
    ref: null,
    cursorType: "default",
    setCursorType: () => { }
});

export default function HoverCursor() {
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            .cursor-wrapper, .cursor-wrapper * {
                cursor: none !important;
            }
        `;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, []);

    return (
        <CursorProvider>
            <div className="cursor-wrapper relative overflow-hidden flex items-center justify-center py-4">
                <div className="grid grid-cols-2 gap-3 items-center justify-center w-1/2 h-1/2 aspect-square">
                    <CursorTrigger type="button" className="w-full h-full bg-blue-300 rounded-lg p-5 transition-transform hover:scale-110">
                        <button></button>
                    </CursorTrigger>
                    <CursorTrigger type="link" className="w-full h-full bg-blue-400 rounded-lg p-5 transition-transform hover:scale-110">
                        <button></button>
                    </CursorTrigger>
                    <CursorTrigger type="alert" className="w-full h-full bg-blue-500 rounded-lg p-5 transition-transform hover:scale-110">
                        <button></button>
                    </CursorTrigger>
                    <CursorTrigger type="check" className="w-full h-full bg-blue-600 rounded-lg p-5 transition-transform hover:scale-110">
                        <button></button>
                    </CursorTrigger>
                </div>
            </div>
        </CursorProvider>
    )
}


export function CursorProvider({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const cursorLocation = usePointerMove(ref);
    const [cursorType, setCursorType] = useState<CursorType>("default");

    return (
        <CursorContext.Provider value={{ ...cursorLocation, ref, cursorType, setCursorType }}>
            <Cursor />
            <div ref={ref} className="relative w-full h-full">
                {children}
            </div>
        </CursorContext.Provider>
    )
}

const Cursor = () => {
    const { relativeX, relativeY, cursorType } = useContext(CursorContext);
    const [index, setIndex] = useState<number>(0);
    const [currentNode, setCurrentNode] = useState<ReactNode>(null);

    useEffect(() => {
        setIndex(index + 1);
        // keep the last node
        if (cursorType !== 'default') {
            setCurrentNode(cursorConfig[cursorType]);
        };
    }, [cursorType]);

    const cursorConfig: Record<CursorType, ReactNode> = {
        'default': '',
        'link': <IconSearch className="w-full h-full" />,
        'button': <IconRefresh className="w-full h-full" />,
        'alert': <IconAlertTriangle className="w-full h-full" />,
        'check': <IconRosetteDiscountCheck className="w-full h-full" />
    };

    const variants: Variants = {
        default: {
            borderRadius: 50,
            width: 16,
            height: 16,
            background: "#18181b",
            color: "#18181b"
        },
        link: {
            borderRadius: 50,
            width: 48,
            height: 48,
            background: "#3b82f6",
            color: "#fafafa"
        },
        button: {
            borderRadius: 50,
            width: 48,
            height: 48,
            background: "#666",
            color: "#fafafa"
        },
        alert: {
            borderRadius: 50,
            width: 48,
            height: 48,
            background: "#f43f5e",
            color: "#fafafa"
        },
        check: {
            borderRadius: 50,
            width: 48,
            height: 48,
            background: "#22c55e",
        }
    };

    const contentVariants: Variants = {
        initial: {
            x: '-100%',
            y: '100%',
            opacity: 0
        },
        active: {
            x: 0,
            y: 0,
            opacity: 1
        },
        exit: {
            x: '100%',
            y: '-100%',
            opacity: 0
        }
    };

    return (
        <motion.div
            className={cn("w-4 h-4 absolute shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)] z-50 top-0 left-0 overflow-hidden pointer-events-none")}
            variants={variants}
            animate={cursorType}
            style={{
                transform: `translate(${relativeX}px, ${relativeY}px) translate(-50%, -50%)`
            }}>
            <div className={cn("w-full h-full flex items-center justify-center")}>
                <AnimatePresence initial={true} mode="popLayout">
                    <motion.div
                        key={index}
                        variants={contentVariants}
                        initial="initial"
                        animate="active"
                        exit="exit"
                        className="w-1/2 h-1/2">
                        {currentNode}
                    </motion.div>
                </AnimatePresence>
            </div>
        </motion.div>
    )
}

const CursorTrigger = ({ type, children, ...props }: CursorTriggerProps) => {
    const { setCursorType } = useContext(CursorContext);
    return (
        <div
            {...props}
            className={cn(props.className)}
            onMouseEnter={() => setCursorType(type)}
            onMouseLeave={() => setCursorType("default")}
        >
            {children}
        </div>
    )
}

const usePointerMove = (ref: RefObject<HTMLElement>): CursorPosition => {
    const [location, setLocation] = useState<CursorPosition>({
        relativeX: 0,
        relativeY: 0,
        offsetX: 0,
        offsetY: 0
    });

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const handlePointerMove = ({ clientX, clientY }: MouseEvent) => {
            const rect = el.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // 相对于元素左上角的坐标
            const relativeX = clientX - rect.left;
            const relativeY = clientY - rect.top;

            // 相对于元素中心点的偏移量（可选，如果需要的话）
            const offsetX = (relativeX - centerX) / 10 * 2;
            const offsetY = (relativeY - centerY) / 10 * 2;

            setLocation({
                relativeX,
                relativeY,
                offsetX,
                offsetY
            });
        };
        const handlePointerLeave = () => {
            setLocation(prev => {
                return {
                    ...prev,
                    offsetX: 0,
                    offsetY: 0
                }
            })
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