import { useState } from "react";
import GoogleAuthorization from "./GoogleAuthorization";
import GoogleDocsPicker from "./GoogleDocsPicker";
import QuotesDisplay from "./QuotesDisplay";

const clientUser = await (await fetch("/api/authorize/user-with-google-drive-access")).json();

function App() {
    const [user, setUser] = useState(clientUser);
    const [revisions, setRevisions] = useState(null);
    const [renderPicker, setRenderPicker] = useState(false);
    return (<>
        <GoogleAuthorization user={user} setUser={setUser} setRenderPicker={setRenderPicker} setRevisions={setRevisions} />
        <GoogleDocsPicker user={user} setUser={setUser} renderPicker={renderPicker} setRenderPicker={setRenderPicker} setRevisions={setRevisions} />
        <QuotesDisplay user={user} revisions={revisions} />
    </>);
}

export default App;
