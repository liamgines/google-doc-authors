import { useState } from "react";
import { DrivePicker, DrivePickerDocsView } from "@googleworkspace/drive-picker-react";
// https://stackoverflow.com/a/21370109/32242805
// https://developers.google.com/workspace/drive/picker/guides/overview
// https://github.com/googleworkspace/drive-picker-element/tree/main/packages/drive-picker-element#event-details

function GoogleDocsPicker({ user, setUser, setGoogleDoc }) {
    const [renderPicker, setRenderPicker] = useState(false);

    async function userRequestDocAnalysis(event) {
        try {
            const docs = event.detail.docs;
            const docId = docs[0].id;

            const serverResponse = await fetch("/api/docId", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
                                                                                          body: new URLSearchParams({ docId: docId }) });
            if (!serverResponse.ok) return console.error("Document id could not be uploaded");

            const googleDoc = await serverResponse.json();
            if (setGoogleDoc) setGoogleDoc(googleDoc);
        }

        catch (error) {
            console.error("Document id upload error:", error);
        }
    }

    async function pick() {
        const picker = document.querySelector("drive-picker");
        if (!picker && renderPicker) return;

        const serverResponse = await fetch("/api/authorize/refresh-access-token");
        if (!serverResponse.ok) {
            if (picker) picker.visible = true;
            return;
        }
        const serverResponseJson = await serverResponse.json();
        const newAccessToken = serverResponseJson.accessToken;
        const userWithNewAccessToken = { id: user.id , accessToken: newAccessToken };
        setUser(userWithNewAccessToken);

        if (picker) picker.visible = true;
    }

    if (!renderPicker) return (<button onClick={async () => { await pick(); setRenderPicker(true); }}>Select Document</button>);
    return (<>
        <button onClick={pick}>Select Document</button>
        <DrivePicker client-id={import.meta.env.VITE_GOOGLE_CLIENT_ID} app-id={import.meta.env.VITE_GOOGLE_APP_ID} developer-key={import.meta.env.VITE_GOOGLE_PICKER_API_KEY} oauth-token={user.accessToken} 
                     prompt="none" max-items={1} onPicked={userRequestDocAnalysis}>
            <DrivePickerDocsView mime-types="application/vnd.google-apps.document" mode="DocsViewMode.LIST" select-folder-enabled="false" view-id="DOCUMENTS" />
        </DrivePicker>
    </>);
}

export default GoogleDocsPicker;
