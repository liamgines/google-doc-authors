import { useState, useEffect } from "react";
import GoogleDocsPicker, { userRefreshAccessToken, userRequestDocAnalysis }  from "./GoogleDocsPicker";

async function userRefreshAccessAndRequestAnalysis(setUser, docId) {
    await userRefreshAccessToken(setUser);
    await userRequestDocAnalysis(docId);
}

function dateToClientString(date: Date) {
    const currentDate: Date = new Date();
    const currentYear: string = currentDate.toLocaleString("default", { year: "numeric" });

    const month: string = date.toLocaleString("default", { month: "short" });
    const day: string = date.toLocaleString("default", { day: "numeric" });
    const year: string = date.toLocaleString("default", { year: "numeric" });
    return `${month} ${day}${(year === currentYear) ? "" : `, ${year}`}`;
}

function GoogleDocsTable({ googleDocs, setUser }) {
    const rows = googleDocs.map(googleDoc => {
        const modifiedDate: Date = new Date(googleDoc.modified_time);
        return (<tr key={googleDoc.google_id}>
                    <td><a href={`/docId/${googleDoc.google_id}`}>{googleDoc.name}</a></td>
                    <td>{dateToClientString(modifiedDate)}</td>
                    <td>{googleDoc.last_modifying_user.name}</td>
                    <td><button onClick={async () => await userRefreshAccessAndRequestAnalysis(setUser, googleDoc.google_id) }>Reanalyze</button></td>
               </tr>);
    });

    return (
        <table>
            <thead>
                <tr><th>Google Doc</th><th>Date modified</th><th>Last modified by</th><th></th></tr>
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
        <GoogleDocsTable googleDocs={googleDocs} setUser={setUser} />
    </>);
}

export default GoogleDocsList;
