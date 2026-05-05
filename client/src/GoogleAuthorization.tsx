// https://developers.google.com/identity/oauth2/web/guides/migration-to-gis#authorization_code_flow_examples 

import { useEffect, useState } from "react";

function scriptMake(url: string, async: boolean, defer: boolean, onLoad: () => void) {
    const script = document.createElement("script");
    script.src = url;
    script.async = async;
    script.defer = defer;
    script.onload = onLoad;
    return script;
}

function GoogleAuthorization({ setUser }) {
    const [googleAuthorizationCodeClient, setGoogleAuthorizationCodeClient] = useState(null);

    async function documentOnUserAuthorization(googleResponse) {
        try {
            // https://stackoverflow.com/a/53189376/32242805
            const serverResponse = await fetch("/api/authorize/google-drive-access", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
                                                                                       body: new URLSearchParams({ code: googleResponse.code }) });
            if (!serverResponse.ok) return console.error("Google authorization failed");

            const user = await serverResponse.json();
            setUser(user);
        }
        catch (error) {
            console.error("Google authorization error:", error);
        }
    }

    function googleInitAuthorizationCodeClient() {
        const clientOptions = { client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID, scope: "https://www.googleapis.com/auth/drive.file openid https://www.googleapis.com/auth/userinfo.email", ux_mode: "popup", callback: documentOnUserAuthorization };
        const client = google.accounts.oauth2.initCodeClient(clientOptions);
        setGoogleAuthorizationCodeClient(client);
    }

    function authorize() {
        googleAuthorizationCodeClient.requestCode();
    }

    useEffect(() => {
        const script = scriptMake("https://accounts.google.com/gsi/client", true, true, googleInitAuthorizationCodeClient);
        document.body.appendChild(script);
        return (() => { document.body.removeChild(script); });
    }, []);

    return (<button onClick={authorize}>Authorize</button>);
}

export default GoogleAuthorization;
