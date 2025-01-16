import { useEffect, useState } from "react";
import "./style.css";

interface Toast {
    id: number;
    title: string;
    content: string;
}

const MAX_TOAST = 4;
const INITIAL_TOASTS: Toast[] = Array.from({ length: 4 }, (_, i) => ({
    id: i,
    title: `toast - ${i}`,
    content: "here is the content"
}));


export default function CssToast() {
    const [toastList, setToastList] = useState<Toast[]>(INITIAL_TOASTS);
    const [index, setIndex] = useState(4);

    const addToast = () => {
        setIndex(index => index + 1);
        const toast: Toast = {
            id: index,
            title: "toast - " + index,
            content: "here is the content"
        };
        setToastList(prev => [...prev, toast]);
        if (toastList.length > MAX_TOAST) {
            setToastList(prev => prev.slice(1));
        };
    };

    return (
        <div className="css-toast-wrap">
            <ul className="toast-list">
                {
                    toastList.map((toast, index) => (
                        <Toast key={toast.id} index={toastList.length - index - 1} toast={toast} />
                    ))
                }
            </ul>
            <button onClick={addToast}>Add toast</button>
        </div>
    )
}

const Toast = ({ index, toast }: { index: number, toast: Toast }) => {
    const [show, setShow] = useState(false);

    const style = {
        ["--index" as string]: index
    };

    useEffect(() => {
        setShow(true);
    }, []);

    return (
        <li style={style} className={`${show ? "show" : ""} ${index >= MAX_TOAST ? "hide" : ""}`}>
            <p>{toast.title}</p>
            <span>{toast.content}</span>
        </li>
    )
}