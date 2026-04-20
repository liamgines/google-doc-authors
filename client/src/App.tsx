import { useState } from "react";
import "./App.css";
import GoogleAuthorization from "./GoogleAuthorization";
import GoogleDocsPicker from "./GoogleDocsPicker";

const clientUser = await (await fetch("/api/authorize/user-with-google-drive-access")).json();

function App() {
    const [user, setUser] = useState(clientUser);
    return (<>
        <GoogleAuthorization user={user} setUser={setUser} />
        <GoogleDocsPicker user={user} />
    </>);
}

export default App;
