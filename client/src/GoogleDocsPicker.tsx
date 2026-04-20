import { useState } from "react";

import { DrivePicker, DrivePickerDocsView } from "@googleworkspace/drive-picker-react";
// https://stackoverflow.com/a/21370109/32242805
// https://developers.google.com/workspace/drive/picker/guides/overview
// https://github.com/googleworkspace/drive-picker-element/tree/main/packages/drive-picker-element#event-details

function pick() {
    const picker = document.querySelector("drive-picker");
    if (picker) picker.visible = true;
}

function GoogleDocsPicker({ user }) {
    const [render, setRender] = useState(false);

    if (!user) return (<></>);
    if (!render) return (<button onClick={() => setRender(true)}>Select Document</button>);
    return (<>
        <button onClick={pick}>Select Document</button>
        <DrivePicker client-id={import.meta.env.VITE_GOOGLE_CLIENT_ID} app-id={import.meta.env.VITE_GOOGLE_APP_ID} developer-key={import.meta.env.VITE_GOOGLE_PICKER_API_KEY} oauth-token={user.accessToken} 
                     prompt="none" max-items={1} onPicked={(e) => console.log("Selected:", e.detail)} onCanceled={() => console.log("Canceled selection")}>
            <DrivePickerDocsView mime-types="application/vnd.google-apps.document" mode="DocsViewMode.LIST" select-folder-enabled="false" view-id="DOCUMENTS" />
        </DrivePicker>
    </>);

}

export default GoogleDocsPicker;
