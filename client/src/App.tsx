import { useState } from "react";
import GoogleAuthorization from "./GoogleAuthorization";
import GoogleDocsPicker from "./GoogleDocsPicker";

const clientUser = await (await fetch("/api/authorize/user-with-google-drive-access")).json();

// https://sashamaps.net/docs/resources/20-colors/
const HEX_COLORS = ["#E6194B", "#3CB44B", "#FFE119", "#4363D8", "#F58231", "#911EB4", "#42D4F4", "#F032E6", "#BFEF45", "#FABED4", "#469990", "#DCBEFF", "#9A6324", "#FFFAC8", "#800000", "#AAFFC3", "#808000", "#FFD8B1", "#000075"];
const ANONYMOUS_HEX_COLOR = "#A9A9A9";

// https://stackoverflow.com/a/47201559/32242805
function hexToRGB(hex: string, alpha: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  if (alpha) return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  return `rgb(${r}, ${g}, ${b})`;
}

const USER_COLOR_OPACITY = "0.25";
const RGBA_COLORS = HEX_COLORS.map(hex => hexToRGB(hex, USER_COLOR_OPACITY));
const ANONYMOUS_PERMISSION_ID = "";
const ANONYMOUS_RGBA_COLOR = hexToRGB(ANONYMOUS_HEX_COLOR, USER_COLOR_OPACITY);

function permissionIdUsersToColorMap(permissionIdUsers: any): any {
    let i = 0;
    let permissionIdColors: any = {};
    permissionIdColors[ANONYMOUS_PERMISSION_ID] = ANONYMOUS_RGBA_COLOR;

    const numColors = RGBA_COLORS.length;
    for (let permissionId in permissionIdUsers) {
        if (permissionId === ANONYMOUS_PERMISSION_ID) continue;

        // https://stackoverflow.com/a/5135033/32242805
        permissionIdColors[permissionId] = RGBA_COLORS[i % numColors];
        i++;
    }
    return permissionIdColors;
}

function QuotesDisplay({ user, revisions }) {
    if (!user || !revisions) return (<></>);

    const quotes = revisions.quotes;
    const permissionIdUsers = revisions.permissionIdUsers;

    const permissionIdColors: any = permissionIdUsersToColorMap(permissionIdUsers);

    let i = 0;
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
    const [renderPicker, setRenderPicker] = useState(false);
    return (<>
        <GoogleAuthorization user={user} setUser={setUser} setRenderPicker={setRenderPicker} setRevisions={setRevisions} />
        <GoogleDocsPicker clientUser={user} userSetter={setUser} renderPicker={renderPicker} setRenderPicker={setRenderPicker} revisionsSetter={setRevisions} />
        <QuotesDisplay user={user} revisions={revisions} />
    </>);
}

export default App;
