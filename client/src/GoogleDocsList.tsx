import { useState, useEffect } from "react";
import GoogleDocsPicker, { userRefreshAccessToken, userRequestDocAnalysis }  from "./GoogleDocsPicker";

const MILLISECONDS_PER_POLL = 5000;

async function userRefreshAccessAndRequestAnalysis(setUser, docId, setGoogleDocs) {
    await userRefreshAccessToken(setUser);
    const serverGoogleDoc = await userRequestDocAnalysis(docId);
    setGoogleDocs(googleDocs => googleDocs.map(doc => (doc.google_id === docId) ? serverGoogleDoc : doc));
}

function dateToComponents(date: Date) {
    const month: string = date.toLocaleString("default", { month: "short" });
    const day: string = date.toLocaleString("default", { day: "numeric" });
    const year: string = date.toLocaleString("default", { year: "numeric" });

    const hour: string = date.toLocaleString("default", { hour: "numeric" });
    const minute: string = date.toLocaleString("default", { minute: "2-digit" });

    const hourClock = hour.split(" ");
    const clock = hourClock[1];
    return { month: month, day: day, year: year, hour: hourClock[0], minute: minute, clock: clock };
}

function dateToClientString(date: Date) {
    const input = dateToComponents(date);

    const currentDate: Date = new Date();
    const current = dateToComponents(currentDate);

    if (input.month === current.month && input.day === current.day && input.year === current.year) return `${input.hour}:${input.minute} ${input.clock}`;
    return `${input.month} ${input.day}${(input.year === current.year) ? "" : `, ${input.year}`}`;
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
        const user = googleDoc.creator;

        const userEmailPrefix = user.email ? user.email.split("@")[0] : "";
        const userDisplayName = userEmailPrefix ? userEmailPrefix : user.name;

        let userHoverInfo = "";
        if (userEmailPrefix === user.name) userHoverInfo = user.email;
        else if (user.email && user.name)  userHoverInfo = `${user.name}\n${user.email}`;
        else if (user.email)               userHoverInfo = `${user.email}`
        else                               userHoverInfo = `${user.name}`

        return (<tr key={googleDoc.google_id}>
                    <td><a href={`/docId/${googleDoc.google_id}`}><p>{googleDoc.name}</p></a></td>
                    <td>{dateToClientString(modifiedDate)}</td>
                    <td><span title={userHoverInfo}><div className="documents-list-photo-name">{(user.photo_link && (<img src={user.photo_link} referrerPolicy="no-referrer" />)) || <img src="/api/public/placeholder_avatar.png" />} {userDisplayName}</div></span></td>
                    <td className="status-cell">{googleDoc.analysis_status}</td>
                    <td><button onClick={async () => await userRefreshAccessAndRequestAnalysis(setUser, googleDoc.google_id, setGoogleDocs) }>Retry</button></td>
                    <td><button onClick={async () => await userDocDelete(googleDoc.google_id) }>Delete</button></td>
               </tr>);
    });

    return (
        <table>
            <thead>
                <tr><th>Name</th><th>Date modified</th><th>Owner</th><th className="status-cell">Status</th><th></th><th></th></tr>
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

    let analyzingDocs = googleDocs.some(googleDoc => googleDoc.analysis_status === "Processing");
    useEffect(() => {
        if (!analyzingDocs) return;

        const intervalId = setInterval(() => fetchAndSetGoogleDocs(), MILLISECONDS_PER_POLL);
        return () => clearInterval(intervalId);
    }, [analyzingDocs]);

    return (<>
    <div className="documents-list">
        <GoogleDocsPicker user={user} setUser={setUser} setGoogleDocs={setGoogleDocs} />
        <GoogleDocsTable googleDocs={googleDocs} setUser={setUser} setGoogleDocs={setGoogleDocs} />
    </div>
    </>);
}

export default GoogleDocsList;
