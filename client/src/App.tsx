import { useState } from "react";
import GoogleAuthorization from "./GoogleAuthorization";
import GoogleDocsPicker from "./GoogleDocsPicker";
import GoogleDocQuotes from "./GoogleDocQuotes";

const clientUser = await (await fetch("/api/authorize/user-with-google-drive-access")).json();

function App() {
    const [user, setUser] = useState(clientUser);
    const [googleDoc, setGoogleDoc] = useState(null);
    const [renderPicker, setRenderPicker] = useState(false);
    return (<>
        <GoogleAuthorization user={user} setUser={setUser} setRenderPicker={setRenderPicker} setGoogleDoc={setGoogleDoc} />
        <GoogleDocsPicker user={user} setUser={setUser} renderPicker={renderPicker} setRenderPicker={setRenderPicker} setGoogleDoc={setGoogleDoc} />
        <GoogleDocQuotes user={user} googleDoc={googleDoc} />
    </>);
}

export default App;
