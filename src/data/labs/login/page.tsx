import { useState } from "react";
import "./style.css";
import { IconAt, IconKey } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export default function GoogleLogin() {
    const [error, setError] = useState(false);
    return (
        <div className="google-login-wrap">
            <div className="sign-wrap">
                <form>
                    <div className="field-wrap">
                        <div className="input-wrap">
                            <input autoComplete="off" id="account" placeholder="account" type="text" />
                            <IconAt />
                        </div>
                        <span className="split-line"></span>
                        <div className={cn(
                            'input-wrap',
                            { 'error': error }
                        )}>
                            <input autoComplete="off" onInput={() => setError(false)} id="password" placeholder="password" type="password" />
                            <IconKey />
                        </div>
                    </div>
                    <button onClick={() => setError(true)} type="button">Sign in</button>
                </form>
            </div>
        </div>
    )
}