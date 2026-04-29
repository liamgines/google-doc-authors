import { useState } from "react";
import GoogleDocsPicker from "./GoogleDocsPicker";
import GoogleDocQuotes from "./GoogleDocQuotes";

function GoogleDocsList({ user, setUser }) {
    const [googleDoc, setGoogleDoc] = useState(null);

    return (<>
        <GoogleDocsPicker user={user} setUser={setUser} setGoogleDoc={setGoogleDoc} />
        <GoogleDocQuotes googleDoc={googleDoc} />
    </>);
}

export default GoogleDocsList;
