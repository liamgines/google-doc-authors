// https://coreui.io/answers/how-to-use-google-login-in-react/

import { useEffect, useState } from "react";

const GOOGLE_SIGN_IN_BUTTON_ID = "google-signin-button";
const GOOGLE_SIGN_IN_BUTTON_STYLE = {
    theme: "outline",
    size: "large",
    text: "sign_in_with",
    width: 250
}

function GoogleSignIn() {
    return (<div id={GOOGLE_SIGN_IN_BUTTON_ID}></div>);
}

function scriptMake(url: string, async: boolean, defer: boolean, onLoad: () => void) {
    const script = document.createElement("script");
    script.src = url;
    script.async = async;
    script.defer = defer;
    script.onload = onLoad;
    return script;
}

// https://stackoverflow.com/a/71756049/32242805
const clientUser = await (await fetch("/api/auth/signed-in-google-user")).json();

function GoogleAuthentication() {
    const [user, setUser] = useState(clientUser);

    // handleCredentialResponse: (https://developers.google.com/identity/gsi/web/guides/display-google-one-tap)
    async function documentOnUserSignIn(googleResponse) {
        try {
            const serverResponse = await fetch("/api/auth/google-sign-in", { method: "POST", headers: { "Content-Type": "application/json" },
                                                                             body: JSON.stringify({ token: googleResponse.credential }) });
            if (!serverResponse.ok) return console.error("Google sign in failed");

            const user = await serverResponse.json();
            setUser(user);
        }
        catch (error) {
            console.error("Google sign in error:", error);
        }
    }

    function googleRenderSignInButton() {
        const googleSignInButton = document.getElementById(GOOGLE_SIGN_IN_BUTTON_ID);
        if (window.google && googleSignInButton) return window.google.accounts.id.renderButton(googleSignInButton, GOOGLE_SIGN_IN_BUTTON_STYLE);
    }

    function googleInitSignInClientAndButton() {
        window.google.accounts.id.initialize({ client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID, callback: documentOnUserSignIn });
        googleRenderSignInButton();
    }

    async function userSignOut() {
        const serverResponse = await fetch("/api/auth/google-logout");
        if (!serverResponse.ok) return console.error("Google sign out failed");

        setUser(null);
        window.google.accounts.id.disableAutoSelect();
    }

    useEffect(() => {
        const script = scriptMake("https://accounts.google.com/gsi/client", true, true, googleInitSignInClientAndButton);
        document.body.appendChild(script);
        return (() => { document.body.removeChild(script); });
    }, []);

    useEffect(() => {
        if (!user) return googleRenderSignInButton();
    }, [user]);

    // https://stackoverflow.com/a/67509739/32242805
    if (user) return (<button onClick={userSignOut}>Sign Out</button>);
    return (<GoogleSignIn />);
}

export default GoogleAuthentication;
