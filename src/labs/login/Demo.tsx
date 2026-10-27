import { useEffect, useRef, useState, type ReactNode, type SubmitEvent } from "react";
import { Icon, type IconName } from "../_kit/icons";
import "./style.css";

type Phase = "idle" | "busy" | "done";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [wrong, setWrong] = useState({ email: false, password: false });
    const [peek, setPeek] = useState(false);
    const [phase, setPhase] = useState<Phase>("idle");
    const fields = useRef<HTMLDivElement>(null);

    // 假装去后台登录：转一会儿、打勾，过一会儿清空回到开头
    useEffect(() => {
        if (phase === "idle") return;
        const t = setTimeout(() => {
            if (phase === "busy") return setPhase("done");
            setPhase("idle");
            setEmail("");
            setPassword("");
            setPeek(false);
        }, phase === "busy" ? 900 : 1600);
        return () => clearTimeout(t);
    }, [phase]);

    const submit = (e: SubmitEvent) => {
        e.preventDefault();
        if (phase !== "idle") return;
        const bad = { email: !email.trim(), password: !password };
        setWrong(bad);
        if (!bad.email && !bad.password) return setPhase("busy");
        // 空着的格子变红，整块左右晃一下
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
            fields.current?.animate(
                [0, -6, 5, -3, 2, 0].map(x => ({ transform: `translateX(${x}px)` })),
                { duration: 360, easing: "ease-out" },
            );
        }
    };

    return (
        <div className="lab-root login">
            <form className="card" onSubmit={submit} noValidate>
                <div className="fields" ref={fields}>
                    <Field icon="at" wrong={wrong.email}>
                        <input type="email" placeholder="Email" autoComplete="off" value={email} aria-invalid={wrong.email}
                            onChange={e => { setEmail(e.target.value); setWrong(w => ({ ...w, email: false })); }} />
                    </Field>
                    <Field icon="key" wrong={wrong.password}>
                        <input type={peek ? "text" : "password"} placeholder="Password" autoComplete="off" value={password} aria-invalid={wrong.password}
                            onChange={e => { setPassword(e.target.value); setWrong(w => ({ ...w, password: false })); }} />
                        <button type="button" className="peek" onClick={() => setPeek(p => !p)}
                            aria-label={peek ? "Hide password" : "Show password"} aria-pressed={peek}>
                            <Icon name={peek ? "eye-slash" : "eye"} size={16} />
                        </button>
                    </Field>
                </div>
                <button type="submit" className="submit" data-phase={phase} aria-live="polite">
                    {phase === "idle" && "Sign in"}
                    {phase === "busy" && <span className="spinner" aria-label="Signing in" />}
                    {phase === "done" && <><Icon name="check" size={16} />Welcome back</>}
                </button>
            </form>
            <p className="lab-hint">Sign in with a field left empty</p>
        </div>
    );
}

function Field({ icon, wrong, children }: { icon: IconName; wrong: boolean; children: ReactNode }) {
    return (
        <label className="field" data-wrong={wrong || undefined}>
            <Icon name={icon} size={18} className="glyph" />
            {children}
        </label>
    );
}
