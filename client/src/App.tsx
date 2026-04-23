import { useState } from "react";
import "./App.css";
import GoogleAuthorization from "./GoogleAuthorization";
import GoogleDocsPicker from "./GoogleDocsPicker";

const clientUser = await (await fetch("/api/authorize/user-with-google-drive-access")).json();

function QuotesDisplay({ revisions }) {
    if (!revisions) return (<></>);

    const quotes = revisions.quotes;
    const permissionIdUsers = revisions.permissionIdUsers;

    const quoteParagraphs = quotes.map(quote => {
        let permissionId = quote.permissionId;
        let user = permissionIdUsers[permissionId];
        let userName = user.displayName;
        let userEmail = user.emailAddress;

        return (<p>{userName} ({userEmail}): {quote.text}</p>);
    });
    return (<><div className="quotes">{quoteParagraphs}</div></>);
}

function App() {
    const [user, setUser] = useState(clientUser);
    const [revisions, setRevisions] = useState(null);
    return (<>
        <GoogleAuthorization user={user} setUser={setUser} />
        <GoogleDocsPicker user={user} revisionsSetter={setRevisions} />
        <QuotesDisplay revisions={revisions} />
    </>);
}

export default App;
