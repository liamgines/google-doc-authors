import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { OAuth2Client, type TokenPayload, type Credentials } from "google-auth-library";
//https://expressjs.com/en/resources/middleware/session.html
import session, { type Session } from "express-session";
import connectPgSimple from "connect-pg-simple";
import pool from "./database/pool";
import * as usersTable from "./database/usersTable";

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());    // To parse application/json
app.use(express.urlencoded({ extended: true }));  // To parse application/x-www-form-urlencoded

interface User {
    id: number,
    google_account_id: string
}

// https://stackoverflow.com/a/73270492/32242805
interface UserSession extends Session {
    user?: User | null,
    userTokens?: Credentials
}

// Including the access token here is used to access the Google Picker on the client
function clientUserMake(id: number, accessToken: string) {
    return { id: id, accessToken: accessToken};
}

function userToClientUser(user: User | null | undefined, accessToken: string = "") {
    if (user) return clientUserMake(user.id, accessToken);
    return null;
}

const DAYS_PER_SESSION = 30;
function daysToMilliseconds(days: number): number {
    const HOURS_PER_DAY = 24;
    const MINUTES_PER_HOUR = 60;
    const SECONDS_PER_MINUTE = 60;
    const MILLISECONDS_PER_SECOND = 1000;

    const milliseconds = days * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
    return milliseconds;
}
const MILLISECONDS_PER_SESSION = daysToMilliseconds(DAYS_PER_SESSION);

const connectPgSession = connectPgSimple(session);
const sessionStore = new connectPgSession({ pool: pool });

// https://stackoverflow.com/a/73207170/32242805
app.use(session({ secret: process.env.EXPRESS_SESSION_SECRET as string, resave: false, saveUninitialized: true, cookie: { maxAge: MILLISECONDS_PER_SESSION }, store: sessionStore }));

const authenticationClient = new OAuth2Client();
// https://blog.maffin.io/posts/client-side-google-authorization-code-model
const authorizationClientOptions = { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, redirectUri: "postmessage" };
const authorizationClient = new OAuth2Client(authorizationClientOptions);

async function googleVerifySignIn(token: string): Promise<string | null> {
    try {
        const ticket = await authenticationClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
        const payload: TokenPayload | undefined = ticket.getPayload();

        if (!payload) return null; 

        const emailVerified: boolean = payload.email_verified || false;
        if (!emailVerified) return null;

        const googleAccountId: string = payload["sub"];
        return googleAccountId;
    }
    catch (error) {
        return null;
    }
}

app.post("/api/auth/google-sign-in", async (request: Request, response: Response, next: NextFunction) => {
    const userSignInToken: string = request.body.token;
    const googleAccountId: string | null = await googleVerifySignIn(userSignInToken);

    if (!googleAccountId) return response.status(500).json({ message: "Google sign in failed" });

    const user = await usersTable.createUserIfNotExists(googleAccountId);
    if (!user) return response.status(500).json({ message: "Google sign in failed or account could not be created" });

    // Now that we've confirmed that there's an account in the database, create "a logged-in user session" (https://developers.google.com/identity/gsi/web/guides/verify-google-id-token#post).
    function serverOnSessionSave(error: any) {
        if (error) return next(error);
        return response.json(userToClientUser(user));
    }
    function serverOnSessionRegenerate(error: any) {
        if (error) return next(error);
        (request.session as UserSession).user = user;
        return request.session.save(serverOnSessionSave);
    }
    return request.session.regenerate(serverOnSessionRegenerate);
});

app.get("/api/auth/google-logout", async (request: Request, response: Response, next: NextFunction) => {
    (request.session as UserSession).user = null;

    function serverOnSessionRegenerate(error: any) {
        if (error) return next(error);
        return response.json({ message: "Google sign out succeeded" });
    }

    function serverOnSessionSave(error: any) {
        if (error) return next(error);
        return request.session.regenerate(serverOnSessionRegenerate);
    }
    return request.session.save(serverOnSessionSave);
});

function requestIsFromGoogleUser(request: Request, response: Response, next: NextFunction) {
    if ((request.session as UserSession).user) return next();
    return next("route");
}

app.get("/api/auth/signed-in-google-user", requestIsFromGoogleUser, async (request: Request, response: Response) => {
    const user: User | null | undefined = (request.session as UserSession).user;
    return response.json(userToClientUser(user));
});

app.get("/api/auth/signed-in-google-user", async (request: Request, response: Response) => {
    return response.json(null);
});

function requestIsAuthorizedWithGoogle(request: Request, response: Response, next: NextFunction) {
    const userSession = (request.session as UserSession);
    if (userSession.user && userSession.userTokens) return next();
    return next("route");
}

app.get("/api/authorize/user-with-google-drive-access", requestIsAuthorizedWithGoogle, async (request: Request, response: Response) => {
    const userSession = (request.session as UserSession);
    const user: User | null | undefined = userSession.user;
    const tokens: Credentials = userSession.userTokens || {};
    const accessToken = tokens.access_token || "";
    return response.json(userToClientUser(user, accessToken));
});

app.get("/api/authorize/user-with-google-drive-access", async (request: Request, response: Response) => {
    return response.json(null);
});

app.post("/api/authorize/google-drive-access", async (request: Request, response: Response, next: NextFunction) => {
    const authorizationCode = request.body.code as string;
    const googleResponse = await authorizationClient.getToken(authorizationCode);
    const tokens: Credentials = googleResponse.tokens;

    const idToken = tokens.id_token;
    const accessToken: string = tokens.access_token || "";
    if (!idToken || !accessToken) return response.json({ message: "Google authorization failed due to invalid id token or invalid access token" });

    const googleAccountId: string | null = await googleVerifySignIn(idToken);
    const scope: Array<string> = (tokens.scope) ? tokens.scope.split(" ") : [];
    const scopeIncludesDriveFiles = scope.includes("https://www.googleapis.com/auth/drive.file");

    if (!googleAccountId || !scopeIncludesDriveFiles) return response.status(500).json({ message: "Google authorization failed due to invalid id token or missing scope" });

    const user = await usersTable.createUserIfNotExists(googleAccountId);
    if (!user) return response.status(500).json({ message: "Account could not be created or located" });

    // Now that we've confirmed that there's an account in the database, create "a logged-in user session" (https://developers.google.com/identity/gsi/web/guides/verify-google-id-token#post).
    function serverOnSessionSave(error: any) {
        if (error) return next(error);
        return response.json(userToClientUser(user, accessToken));
    }
    function serverOnSessionRegenerate(error: any) {
        if (error) return next(error);
        (request.session as UserSession).user = user;
        (request.session as UserSession).userTokens = tokens;
        return request.session.save(serverOnSessionSave);
    }
    return request.session.regenerate(serverOnSessionRegenerate);
});

type RevisionKind = "drive#revision";
type RevisionListKind = "drive#revisionList";
type RevisionUserKind = "drive#user";

// https://developers.google.com/workspace/drive/api/reference/rest/v3/User
interface RevisionUser {
    displayName: string,
    kind: RevisionUserKind,
    me: boolean,
    permissionId?: string,
    emailAddress?: string,
    photoLink?: string
}

// Optional due to specifying custom fields in the url (except id)
// https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions
interface Revision {
    exportLinks?: object,
    id: string,
    mimeType?: string,
    kind?: RevisionKind,
    published?: boolean,
    keepForever?: boolean,
    md5Checksum?: string,
    modifiedTime?: string,
    publishAuto?: boolean,
    publishedOutsideDomain?: boolean,
    publishedLink?: string,
    size?: string,
    originalFilename?: string,
    lastModifyingUser?: RevisionUser
}

interface RevisionList {
    revisions: Array<Revision>,
    kind: RevisionListKind,
    nextPageToken?: string
}

// https://stackoverflow.com/a/78737793/32242805
// Defaults: "revisions/kind,revisions/id,revisions/mimeType,revisions/modifiedTime"
async function docRevisions(docId: string, accessToken: string): Promise<Array<Revision>> {
    const revisionFields = "revisions/id,revisions/lastModifyingUser";
    let revisions: Array<Revision> = [];

    let googleResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}/revisions?fields=${revisionFields}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!googleResponse.ok) return revisions;

    let revisionList: RevisionList = await googleResponse.json();
    revisions = revisions.concat(revisionList.revisions);

    // TODO: Check that this loop works as intended
    while (revisionList.nextPageToken) {
        googleResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}/revisions?pageToken=${revisionList.nextPageToken}&fields=${revisionFields}`, { headers: { Authorization: `Bearer ${accessToken}` } });

        /* "If the token is rejected for any reason, it should be discarded, and pagination should be restarted from the first page of results"
         * (https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list).
         */
        if (!googleResponse.ok) return await docRevisions(docId, accessToken);

        revisionList = await googleResponse.json();
        revisions = revisions.concat(revisionList.revisions);
    }
    return revisions;
}

// https://github.com/tidyverse/googledrive/issues/218
async function docRevisionContents(docId: string, revisions: Array<Revision>, accessToken: string): Promise<Array<string>> {
    let revisionContents: Array<string> = [];
    for (const revision of revisions) {
        let googleResponse = await fetch(`https://docs.google.com/feeds/download/documents/export/Export?id=${docId}&revision=${revision.id}&exportFormat=txt`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!googleResponse.ok) return [];

        let revisionContent: string = await googleResponse.text();
        revisionContents.push(revisionContent);
    }
    return revisionContents;
}

function revisionsToUsers(revisions: Array<Revision>) {
    return revisions.map(revision => revision.lastModifyingUser);
}

// https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list
app.post("/api/docId", requestIsAuthorizedWithGoogle, async (request: Request, response: Response, next: NextFunction) => {
    const docId = request.body.docId;

    const userSession = (request.session as UserSession);
    const tokens: Credentials = userSession.userTokens || {};
    const accessToken: string = tokens.access_token || "";

    const revisions = await docRevisions(docId, accessToken);
    const revisionContents: Array<string> = await docRevisionContents(docId, revisions, accessToken);
    if (!revisionContents) return next();

    const revisionUsers = revisionsToUsers(revisions);
    return response.json({ revisionContents: revisionContents, revisionUsers: revisionUsers });
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
