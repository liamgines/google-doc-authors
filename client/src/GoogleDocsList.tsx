import { useState, useEffect } from "react";
import GoogleDocsPicker, { userRequestDocAnalysis }  from "./GoogleDocsPicker";

function GoogleDocsTable({ googleDocs }) {
    const rows = googleDocs.map(googleDoc => <tr key={googleDoc.google_id}><td><a href={`/docId/${googleDoc.google_id}`}>{googleDoc.google_id}</a></td><td><button onClick={async () => await userRequestDocAnalysis(googleDoc.google_id)}>Reanalyze</button></td></tr>);
    return (
        <table>
            <thead>
                <tr><th>Google Doc ID</th><th></th></tr>
            </thead>

            <tbody>
                {rows}
            </tbody>
        </table>
    );
}
function GoogleDocsList({ user, setUser }) {
    const [googleDocs, setGoogleDocs] = useState([]);

    async function fetchAndSetGoogleDocs() {
        const serverResponse = await fetch("/api/docIds");
        let serverGoogleDocs = [];
        if (serverResponse.ok) serverGoogleDocs = await serverResponse.json();
        setGoogleDocs(serverGoogleDocs);
    }

    useEffect(() => { fetchAndSetGoogleDocs() }, []);

    return (<>
        <GoogleDocsPicker user={user} setUser={setUser} setGoogleDocs={setGoogleDocs} />
        <GoogleDocsTable googleDocs={googleDocs} />
    </>);
}

export default GoogleDocsList;
