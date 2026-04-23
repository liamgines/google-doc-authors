import { useState } from "react";

import { DrivePicker, DrivePickerDocsView } from "@googleworkspace/drive-picker-react";
// https://stackoverflow.com/a/21370109/32242805
// https://developers.google.com/workspace/drive/picker/guides/overview
// https://github.com/googleworkspace/drive-picker-element/tree/main/packages/drive-picker-element#event-details

let setRevisions = null;

function pick() {
    const picker = document.querySelector("drive-picker");
    if (picker) picker.visible = true;
}
async function userRequestDocAnalysis(event) {
    try {
        const docs = event.detail.docs;
        const docId = docs[0].id;

        const serverResponse = await fetch("/api/docId", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
                                                                                      body: new URLSearchParams({ docId: docId }) });
        if (!serverResponse.ok) return console.error("Document id could not be uploaded");

        const revisions = await serverResponse.json();
        if (setRevisions) setRevisions(revisions);
    }

    catch (error) {
        console.error("Document id upload error:", error);
    }
}


function GoogleDocsPicker({ user, revisionsSetter }) {
    const [render, setRender] = useState(false);
    setRevisions = revisionsSetter;

    if (!user) return (<></>);
    if (!render) return (<button onClick={() => setRender(true)}>Select Document</button>);
    return (<>
        <button onClick={pick}>Select Document</button>
        <DrivePicker client-id={import.meta.env.VITE_GOOGLE_CLIENT_ID} app-id={import.meta.env.VITE_GOOGLE_APP_ID} developer-key={import.meta.env.VITE_GOOGLE_PICKER_API_KEY} oauth-token={user.accessToken} 
                     prompt="none" max-items={1} onPicked={userRequestDocAnalysis}>
            <DrivePickerDocsView mime-types="application/vnd.google-apps.document" mode="DocsViewMode.LIST" select-folder-enabled="false" view-id="DOCUMENTS" />
        </DrivePicker>
    </>);

}

export default GoogleDocsPicker;
