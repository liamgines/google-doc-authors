import { useState } from "react";
import { DrivePicker, DrivePickerDocsView } from "@googleworkspace/drive-picker-react";
// https://stackoverflow.com/a/21370109/32242805
// https://developers.google.com/workspace/drive/picker/guides/overview
// https://github.com/googleworkspace/drive-picker-element/tree/main/packages/drive-picker-element#event-details

export async function userRequestDocAnalysis(docId) {
    const serverResponse = await fetch("/api/docId", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ docId: docId }) });
    if (!serverResponse.ok) return console.error("Document id could not be uploaded");
    const serverGoogleDoc = await serverResponse.json();
    return serverGoogleDoc;
}

async function getNewAccessToken() {
    const serverResponse = await fetch("/api/authorize/refresh-access-token");
    if (!serverResponse.ok) return "";
    const serverResponseJson = await serverResponse.json();
    const newAccessToken = serverResponseJson.accessToken;
    return newAccessToken;
}

export async function userRefreshAccessToken(setUser): boolean {
    const newAccessToken = await getNewAccessToken();
    if (!newAccessToken) return false;

    // Need to wrap object in parentheses to return using a lambda (https://stackoverflow.com/a/28770578/32242805).
    setUser(user => ({ id: user.id, accessToken: newAccessToken }));
    return true;
}

function GoogleDocsPicker({ user, setUser, setGoogleDocs }) {
    const [renderPicker, setRenderPicker] = useState(false);

    async function listAddDoc(event) {
        try {
            const docs = event.detail.docs;
            const docId = docs[0].id;
            const serverGoogleDoc = await userRequestDocAnalysis(docId);
            if (!serverGoogleDoc) return console.error("Error: Google doc revisions could not be retrieved.");
            setGoogleDocs(googleDocs => googleDocs.filter(googleDoc => googleDoc.google_id !== serverGoogleDoc.google_id).concat([serverGoogleDoc]));
        }

        catch (error) {
            console.error("Document id upload error:", error);
        }
    }

    async function pick() {
        const picker = document.querySelector("drive-picker");
        if (!picker && renderPicker) return;

        await userRefreshAccessToken(setUser);

        if (picker) picker.visible = true;
    }

    if (!renderPicker) return (<button onClick={async () => { await pick(); setRenderPicker(true); }}>Select Document</button>);
    return (<>
        <button onClick={pick}>Select Document</button>
        <DrivePicker client-id={import.meta.env.VITE_GOOGLE_CLIENT_ID} app-id={import.meta.env.VITE_GOOGLE_APP_ID} developer-key={import.meta.env.VITE_GOOGLE_PICKER_API_KEY} oauth-token={user.accessToken} 
                     prompt="none" max-items={1} onPicked={listAddDoc}>
            <DrivePickerDocsView mime-types="application/vnd.google-apps.document" mode="DocsViewMode.LIST" select-folder-enabled="false" view-id="DOCUMENTS" />
        </DrivePicker>
    </>);
}

export default GoogleDocsPicker;
