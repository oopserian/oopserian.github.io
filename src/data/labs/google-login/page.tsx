import "./style.css";
import { IconAt,IconKey } from "@tabler/icons-react";

export default function GoogleLogin() {
    return (
        <div className="google-login-wrap">
            <div className="sign-wrap">
                <form>
                    <div className="field-wrap">
                        <div className="input-wrap">
                            <input id="account" placeholder="account" type="text" />
                            <IconAt/>
                        </div>
                        <span className="split-line"></span>
                        <div className="input-wrap">
                            <input id="password" placeholder="password" type="password" />
                            <IconKey/>
                        </div>
                    </div>
                    <button type="button">Sign in</button>
                </form>
            </div>
        </div>
    )
}