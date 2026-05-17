import { useState, useEffect } from "react";
import { useParams } from "react-router";
// https://sashamaps.net/docs/resources/20-colors/
const HEX_COLORS = ["#E6194B", "#3CB44B", "#FFE119", "#4363D8", "#F58231", "#911EB4", "#42D4F4", "#F032E6", "#BFEF45", "#FABED4", "#469990", "#DCBEFF", "#9A6324", "#FFFAC8", "#800000", "#AAFFC3", "#808000", "#FFD8B1", "#000075"];
const ANONYMOUS_HEX_COLOR = "#A9A9A9";
const ORIGINAL_DOC_HEX_COLOR = "#FFFFFF";
const STATUS_FAILED_DEPENDENCY = 424;
const STATUS_SERVICE_UNAVAILABLE = 503;

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
const ORIGINAL_DOC_PERMISSION_ID = "ORIGINAL_DOC";
const ORIGINAL_DOC_RGBA_COLOR = hexToRGB(ORIGINAL_DOC_HEX_COLOR, USER_COLOR_OPACITY);
const ANONYMOUS_PERMISSION_ID = "";
const ANONYMOUS_RGBA_COLOR = hexToRGB(ANONYMOUS_HEX_COLOR, USER_COLOR_OPACITY);

function permissionIdUsersToColorMap(permissionIdUsers: any): any {
    let i = 0;
    let permissionIdColors: any = {};
    permissionIdColors[ORIGINAL_DOC_PERMISSION_ID] = ORIGINAL_DOC_RGBA_COLOR;
    permissionIdColors[ANONYMOUS_PERMISSION_ID] = ANONYMOUS_RGBA_COLOR;

    const numColors = RGBA_COLORS.length;
    for (let permissionId in permissionIdUsers) {
        if (permissionId === ANONYMOUS_PERMISSION_ID || permissionId === ORIGINAL_DOC_PERMISSION_ID) continue;

        // https://stackoverflow.com/a/5135033/32242805
        permissionIdColors[permissionId] = RGBA_COLORS[i % numColors];
        i++;
    }
    return permissionIdColors;
}


function UserColorKey({ permissionIdUsers, permissionIdColors, permissionIdCharCounts, permissionIdCharPercentages }) {
    let userColorKey = [];
    let i = 0;
    for (let permissionId in permissionIdUsers) {
        let user = permissionIdUsers[permissionId];
        let userColor = permissionIdColors[permissionId];
        let userColorItem = (<li key={i++} style={{ color: userColor }}>
                             <span style={{ color: "black" }}>
                                {(user.photoLink && (<img src={user.photoLink} referrerPolicy="no-referrer" />)) || <img src="/api/public/placeholder_avatar.png" />}
                                {user.displayName} {user.emailAddress ? `(${user.emailAddress})` : ""} | {(permissionId in permissionIdCharCounts) ? permissionIdCharCounts[permissionId] : 0} characters | {(permissionId in permissionIdCharPercentages) ? permissionIdCharPercentages[permissionId] : 0}%
                             </span>
                             </li>);
        userColorKey.push(userColorItem);
    }
    return (<ul style={{ listStyleType: "square" }}>{userColorKey}</ul>);
}

function GoogleDocQuotes() {
    const [googleDoc, setGoogleDoc] = useState(null);
    const { id } = useParams();

    async function fetchAndSetGoogleDoc() {
        const serverResponse = await fetch(`/api/docId/${id}`);
        if (!serverResponse.ok && serverResponse.status !== STATUS_SERVICE_UNAVAILABLE && serverResponse.status !== STATUS_FAILED_DEPENDENCY) return console.error("Error: Document could not be retrieved");
        const googleDoc = await serverResponse.json();
        return setGoogleDoc(googleDoc);
    }

    useEffect(() => { fetchAndSetGoogleDoc() }, []);

    if (!googleDoc) return (<></>);

    const quotes = googleDoc.quotes;
    const permissionIdUsers = googleDoc.permissionIdUsers;

    const permissionIdColors: any = permissionIdUsersToColorMap(permissionIdUsers);
    const permissionIdCharCounts: any = googleDoc.permissionIdCharCounts;
    const permissionIdCharPercentages: any = googleDoc.permissionIdCharPercentages;

    let i = 0;
    const quoteSpans = quotes.map(quote => {
        let permissionId = quote.permissionId;
        let user = permissionIdUsers[permissionId];
        let userName = user.displayName;
        let userEmail = user.emailAddress;

        let userColor = permissionIdColors[permissionId];

        const hoverText = (userEmail) ? `${userName} (${userEmail})` : userName;
        // For displaying whitespace properly: https://stackoverflow.com/a/69436906/32242805
        return (<span key={i++} id={permissionId} title={hoverText} style={{ backgroundColor: userColor, whiteSpace: "pre-line" }}>{quote.text}</span>);
    });
    return (<>
        <p id="quotes">{quoteSpans}</p>
        <UserColorKey permissionIdUsers={permissionIdUsers} permissionIdColors={permissionIdColors} permissionIdCharCounts={permissionIdCharCounts} permissionIdCharPercentages={permissionIdCharPercentages} />
    </>);
}

export default GoogleDocQuotes;
