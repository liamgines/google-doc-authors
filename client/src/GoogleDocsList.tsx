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

function GoogleDocsTable({ googleDocs, setUser, setGoogleDocs }) {
    if (!googleDocs.length) return (<p>No docs yet.</p>);

    async function userDocDelete(docId: string) {
        try {
            const serverResponse = await fetch("/api/docId", { method: "DELETE", headers: { "Content-Type": "application/x-www-form-urlencoded" },
                                                                                 body: new URLSearchParams({ docId: docId }) });
            if (!serverResponse.ok) return console.error("Doc deletion failed");
            setGoogleDocs(googleDocs => googleDocs.filter(googleDoc => googleDoc.google_id !== docId));
        }
        catch (error) {
            console.error("Doc deletion error: ", error);
        }
    }

    const rows = googleDocs.map(googleDoc => {
        const modifiedDate: Date = new Date(googleDoc.modified_time);
        const user = googleDoc.last_modifying_user;
        return (<tr key={googleDoc.google_id}>
                    <td><a href={`/docId/${googleDoc.google_id}`}>{googleDoc.name}</a></td>
                    <td>{dateToClientString(modifiedDate)}</td>
                    <td>{(user.photo_link && (<img src={user.photo_link} referrerPolicy="no-referrer" />)) || <img src="/api/public/placeholder_avatar.png" />} {user.name}</td>
                    <td>{googleDoc.analysis_status}</td>
                    <td><button onClick={async () => await userRefreshAccessAndRequestAnalysis(setUser, googleDoc.google_id) }>Reanalyze</button></td>
                    <td><button onClick={async () => await userDocDelete(googleDoc.google_id) }>Delete</button></td>
               </tr>);
    });

    return (
        <table>
            <thead>
                <tr><th>Google Doc</th><th>Date modified</th><th>Last modified by</th><th>Status</th><th></th><th></th></tr>
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
        <GoogleDocsTable googleDocs={googleDocs} setUser={setUser} setGoogleDocs={setGoogleDocs} />
    </>);
}

export default GoogleDocsList;
