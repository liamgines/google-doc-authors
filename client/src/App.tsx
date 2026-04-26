import { useState } from "react";
import GoogleAuthorization from "./GoogleAuthorization";
import GoogleDocsPicker from "./GoogleDocsPicker";

const clientUser = await (await fetch("/api/authorize/user-with-google-drive-access")).json();

function QuotesDisplay({ user, revisions }) {
    if (!user || !revisions) return (<></>);

    const quotes = revisions.quotes;
    const permissionIdUsers = revisions.permissionIdUsers;

    let i = 0;
    let permissionIdColors: any = {};
    for (let permissionId in permissionIdUsers) {
        permissionIdColors[permissionId] = (i % 2) ? "red" : "green";
        i++;
    }

    i = 0;
    const quoteSpans = quotes.map(quote => {
        let permissionId = quote.permissionId;
        let user = permissionIdUsers[permissionId];
        let userName = user.displayName;
        let userEmail = user.emailAddress;

        let userColor = permissionIdColors[permissionId];
        // For displaying whitespace properly: https://stackoverflow.com/a/69436906/32242805
        return (<span key={i++} id={permissionId} style={{ backgroundColor: userColor, whiteSpace: "pre-line" }}>{quote.text}</span>);
    });
    return (<p id="quotes">{quoteSpans}</p>);
}

function App() {
    const [user, setUser] = useState(clientUser);
    const [revisions, setRevisions] = useState(null);
    return (<>
        <GoogleAuthorization user={user} setUser={setUser} setRevisions={setRevisions} />
        <GoogleDocsPicker user={user} revisionsSetter={setRevisions} />
        <QuotesDisplay user={user} revisions={revisions} />
    </>);
}

export default App;
