import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { OAuth2Client, type TokenPayload, type Credentials } from "google-auth-library";
//https://expressjs.com/en/resources/middleware/session.html
import session, { type Session } from "express-session";
import connectPgSimple from "connect-pg-simple";
import pool from "./database/pool";
import * as usersTable from "./database/usersTable";
import * as docsTable from "./database/docsTable";
import * as revisionsTable from "./database/revisionsTable";
import * as userDocsTable from "./database/userDocsTable";
import { diffChars } from "diff";
import fs from "node:fs";
import path from "node:path";

const STATUS_TOO_MANY_REQUESTS = 429;
const STATUS_NOT_FOUND = 404;
const STATUS_FAILED_DEPENDENCY = 424;
const STATUS_SERVICE_UNAVAILABLE = 503;

function secondsToMilliseconds(seconds: number) {
    const MILLISECONDS_PER_SECOND = 1000;
    const milliseconds = seconds * MILLISECONDS_PER_SECOND;
    return milliseconds;
}

// https://developers.google.com/workspace/drive/api/guides/limits
const SECONDS_PER_REQUEST = 60 / 12000;
const MILLISECONDS_PER_REQUEST = secondsToMilliseconds(SECONDS_PER_REQUEST);

const app = express();
const port = process.env.PUBLIC_SERVER_PORT;

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
app.use(session({ secret: process.env.PRIVATE_EXPRESS_SESSION_SECRET as string, resave: false, saveUninitialized: true, cookie: { maxAge: MILLISECONDS_PER_SESSION }, store: sessionStore }));

// https://blog.maffin.io/posts/client-side-google-authorization-code-model
const authorizationClientOptions = { clientId: process.env.PUBLIC_GOOGLE_CLIENT_ID, clientSecret: process.env.PRIVATE_GOOGLE_CLIENT_SECRET, redirectUri: "postmessage" };
const authorizationClient = new OAuth2Client(authorizationClientOptions);

async function googleVerifySignIn(token: string): Promise<string | null> {
    try {
        const ticket = await authorizationClient.verifyIdToken({ idToken: token, audience: process.env.PUBLIC_GOOGLE_CLIENT_ID });
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

app.get("/api/authenticate/google-logout", async (request: Request, response: Response, next: NextFunction) => {
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

app.get("/api/authorize/logout", async (request: Request, response: Response) => {
    (request.session as UserSession).userTokens = undefined;
    return response.redirect("/api/authenticate/google-logout");
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
    const scopeIncludesOpenId = scope.includes("openid");
    const scopeIncludesEmail = scope.includes("https://www.googleapis.com/auth/userinfo.email");

    if (!googleAccountId || !scopeIncludesDriveFiles || !scopeIncludesOpenId || !scopeIncludesEmail) return response.status(500).json({ message: "Google authorization failed due to invalid id token or missing scope" });

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

// https://blog.maffin.io/posts/client-side-google-authorization-code-model
app.get("/api/authorize/refresh-access-token", requestIsAuthorizedWithGoogle, async (request: Request, response: Response, next: NextFunction) => {
    const oldTokens = (request.session as UserSession).userTokens as Credentials;
    const oldAccessToken = oldTokens.access_token as string;

    const expiryTime = oldTokens.expiry_date as number;
    const tokenExpiryDate: Date = new Date(expiryTime);
    const currentDate: Date = new Date();
    if (currentDate < tokenExpiryDate) return response.json({ accessToken: oldAccessToken });

    const refreshToken = oldTokens.refresh_token as string;
    const refreshAuthorizationClient = new OAuth2Client(authorizationClientOptions);
    refreshAuthorizationClient.setCredentials({ refresh_token: refreshToken });
    const googleResponse = await refreshAuthorizationClient.refreshAccessToken();
    const newTokens: Credentials = googleResponse.credentials;
    const newAccessToken = newTokens.access_token as string;

    const sameUser = (request.session as UserSession).user;

    function serverOnSessionSave(error: any) {
        if (error) return next(error);
        response.json({ accessToken: newAccessToken });
    }
    function serverOnSessionRegenerate(error: any) {
        if (error) return next(error);
        (request.session as UserSession).userTokens = newTokens;
        (request.session as UserSession).user = sameUser;
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

// https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
async function sleepForMilliseconds(milliseconds: number): Promise<any> {
    return await new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function fetchSleep(url: string, requestHeaders?: any, milliseconds: number = MILLISECONDS_PER_REQUEST) {
    await sleepForMilliseconds(milliseconds);
    if (requestHeaders) return await fetch(url, requestHeaders);
    return await fetch(url);
}

async function fetchWithRetry(url: string, requestHeaders?: any, numRetries: number = 5) {
    if (numRetries <= 0) throw new Error("Number of retries must be positive");

    while (numRetries--) {
        const response = (requestHeaders) ? await fetchSleep(url, requestHeaders) : await fetchSleep(url);
        if (response.status !== 429) return response;

        const retryAfter = response.headers.get("Retry-After");
        const secondsTillRetry = (retryAfter) ? parseInt(retryAfter) : Math.pow(2, numRetries);
        const millisecondsTillRetry = secondsToMilliseconds(secondsTillRetry);

        await sleepForMilliseconds(millisecondsTillRetry);
    }
    console.error("Max retries exceeded");
    return new Response(null, { status: STATUS_TOO_MANY_REQUESTS, statusText: "Too Many Requests" });
}

function revisionsFilterByConsecutiveUser(revisions: Array<Revision>): Array<Revision> {
    if (!revisions.length) return [];

    let filteredRevisions = [revisions[0]];

    const numRevisions = revisions.length;
    for (let i = 1; i < numRevisions;) {
        let revision = revisions[i];
        let user = revision.lastModifyingUser as RevisionUser;

        while (++i < numRevisions && revisionUserEqual(user, revisions[i].lastModifyingUser as RevisionUser)) revision = revisions[i];

        filteredRevisions.push(revision);
    }

    return filteredRevisions;
}

function revisionUserEqual(a: RevisionUser, b: RevisionUser) {
    return a.permissionId === b.permissionId && a.emailAddress === b.emailAddress;
}

// https://stackoverflow.com/a/78737793/32242805
// Defaults: "revisions/kind,revisions/id,revisions/mimeType,revisions/modifiedTime"
async function docRevisions(docId: string, accessToken: string): Promise<Array<Revision>> {
    const revisionFields = "revisions/id,revisions/lastModifyingUser";
    let revisions: Array<Revision> = [];

    let googleResponse = await fetchSleep(`https://www.googleapis.com/drive/v3/files/${docId}/revisions?fields=${revisionFields}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!googleResponse.ok) return revisions;

    let revisionList: RevisionList = await googleResponse.json();
    revisions = revisions.concat(revisionList.revisions);

    revisions = revisionsFilterByConsecutiveUser(revisions);

    // TODO: Check that this loop works as intended
    while (revisionList.nextPageToken) {
        googleResponse = await fetchSleep(`https://www.googleapis.com/drive/v3/files/${docId}/revisions?pageToken=${revisionList.nextPageToken}&fields=${revisionFields}`, { headers: { Authorization: `Bearer ${accessToken}` } });

        /* "If the token is rejected for any reason, it should be discarded, and pagination should be restarted from the first page of results"
         * (https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list).
         */
        if (!googleResponse.ok) return await docRevisions(docId, accessToken);

        revisionList = await googleResponse.json();
        let newRevisions: Array<Revision> = revisionList.revisions;
        newRevisions = revisionsFilterByConsecutiveUser(newRevisions);
        revisions = revisions.concat(newRevisions);
    }
    return revisions;
}

// https://github.com/tidyverse/googledrive/issues/218
async function docRevisionTexts(docId: string, revisions: Array<Revision>, accessToken: string): Promise<Array<string>> {
    let revisionTexts: Array<string> = [];
    const requestHeaders = { headers: { Authorization: `Bearer ${accessToken}` } };
    for (const revision of revisions) {
        let revisionText: string | null = await revisionsTable.getRevisionTextByGoogleIds(docId, revision.id);
        if (revisionText === null) {
            let exportUrl = `https://docs.google.com/feeds/download/documents/export/Export?id=${docId}&revision=${revision.id}&exportFormat=txt`;
            // https://blog.postman.com/http-error-429/#preventing-429-errors
            let googleResponse = await fetchSleep(exportUrl, requestHeaders);
            if (googleResponse.status === STATUS_TOO_MANY_REQUESTS) googleResponse = await fetchWithRetry(exportUrl, requestHeaders);
            if (!googleResponse.ok) return [];

            revisionText = await googleResponse.text();
            let storedRevision = await revisionsTable.createRevisionIfNotExists(docId, revision.id, revisionText);
            if (!storedRevision) return [];
        }
        revisionTexts.push(revisionText);
    }
    return revisionTexts;
}

function revisionsToUsers(revisions: Array<Revision>) {
    return revisions.map(revision => revision.lastModifyingUser);
}

interface RevisionChar {
    permissionId: string,
    char: string
}

const ORIGINAL_DOC_PERMISSION_ID = "ORIGINAL_DOC";
const ANONYMOUS_PERMISSION_ID = "";
function revisionCharMake(permissionId: string | undefined, char: string): RevisionChar {
    return { permissionId: permissionId || ANONYMOUS_PERMISSION_ID, char: char };
}

// https://github.com/kpdecker/jsdiff#change-objects
function revisionUserTextsToChars(users: Array<RevisionUser>, texts: Array<string>): Array<RevisionChar> {
    let revisionChars: Array<RevisionChar> = [];
    let maxTextLength = 0;
    for (let text of texts) {
        if (maxTextLength < text.length) maxTextLength = text.length;
    }
    for (let i = 0; i < maxTextLength; i++) revisionChars.push(revisionCharMake(ANONYMOUS_PERMISSION_ID, "\0"));

    /* If the first text revision is not empty (e.g. when a copy of an existing document is made), these characters may not be accounted for in the return value.
     * Running the app without the code below before the main loop caused an incomplete document to be displayed where some characters were missing (i.e. where null values were included).
     * We could attribute these characters to the author who made the document copy (i.e. the first user), but for now, we'll just attribute these initial characters to an empty id instead.
     */
    const firstText = texts[0];
    for (let i = 0; i < firstText.length; i++) revisionChars[i] = revisionCharMake(ORIGINAL_DOC_PERMISSION_ID, firstText[i]); // Adjusted to give credit to original document

    // TODO: Double check this line
    const numTexts = texts.length;
    for (let i = 0; i < numTexts - 1; i++) {
        let prev = texts[i];
        let next = texts[i + 1];
        let diff = diffChars(prev, next);

        let j = 0;
        let k = 0;
        let revisionCharsCopy = revisionChars.map(revisionChar => revisionChar);
        diff.forEach(part => {
            let chars = part.value;
            if (part.removed) {
                k += chars.length;
                return;
            }
            for (let char of chars) {
                if (part.added) revisionChars[j++] = revisionCharMake(users[i + 1].permissionId, char);
                else            revisionChars[j++] = revisionCharsCopy[k++];
            }
        });
    }

    const finalText = texts[numTexts - 1];
    let endCharsToRemove = maxTextLength - finalText.length;
    while (endCharsToRemove--) revisionChars.pop();

    return revisionChars;
}

interface Quote {
    permissionId: string,
    text: string
}

function quoteMake(permissionId: string = ANONYMOUS_PERMISSION_ID, text: string = "") {
    return { permissionId: permissionId, text: text };
}

function revisionCharsToQuotes(revisionChars: Array<RevisionChar>): Array<Quote> {
    let quotes : Array<Quote> = [];
    const numChars = revisionChars.length;
    for (let i = 0; i < numChars; i++) {
        let numQuotes = quotes.length;

        let current = revisionChars[i];
        let authorChanged = (!numQuotes || current.permissionId !== revisionChars[i - 1].permissionId);
        if (authorChanged) quotes.push(quoteMake(current.permissionId, current.char));
        else               quotes[numQuotes - 1].text += current.char;
    }
    return quotes;
}

function revisionUsersByPermissionId(revisionUsers: Array<RevisionUser>): any {
    let permissionIdUsers: any = {};
    // Add a placeholder user for the original document (for when the document is a copy of another document)
    permissionIdUsers[ORIGINAL_DOC_PERMISSION_ID] = { displayName: "Original Document", emailAddress: "" };
    // Ensure there is always a placeholder user with no id
    permissionIdUsers[ANONYMOUS_PERMISSION_ID] = { displayName: "Anonymous User", emailAddress: "" };
    for (let user of revisionUsers) {
        if (user.permissionId !== undefined) permissionIdUsers[user.permissionId] = user;
    }
    return permissionIdUsers;
}

function quotesToPermissionIdCharCounts(quotes: Array<any>) {
    let permissionIdCharCounts: any = {};
    for (const quote of quotes) {
        let permissionId = quote["permissionId"];
        // https://stackoverflow.com/questions/10805125/how-to-remove-all-line-breaks-from-a-string#comment43300039_10805198
        let textWithoutNewlines = quote.text.replace(/[\r\n]/g, "");
        if (permissionId in permissionIdCharCounts) permissionIdCharCounts[permissionId] += textWithoutNewlines.length;
        else                                        permissionIdCharCounts[permissionId] = textWithoutNewlines.length;
    }
    return permissionIdCharCounts;
}

// https://stackoverflow.com/a/7343013
function numberRoundToOneDecimalPlace(x: number) {
    return Math.round(x * 10) / 10;
}

function fractionToPercent(numerator: number, denominator: number) {
    if (denominator === 0) return 0;
    return numberRoundToOneDecimalPlace((numerator / denominator) * 100);
}

function permissionIdCharCountsToPercentages(permissionIdCharCounts: any) {
    let permissionIdCharPercentages = {};

    let totalChars = 0;
    for (const permissionId in permissionIdCharCounts) {
        const userChars = permissionIdCharCounts[permissionId];
        totalChars += userChars;
    }

    for (const permissionId in permissionIdCharCounts) {
        const userChars = permissionIdCharCounts[permissionId];
        permissionIdCharPercentages[permissionId] = fractionToPercent(userChars, totalChars);
    }
    return permissionIdCharPercentages;
}


// https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list
app.post("/api/docId", requestIsAuthorizedWithGoogle, async (request: Request, response: Response, next: NextFunction) => {
    const docId = request.body.docId;

    const userSession = (request.session as UserSession);
    const tokens: Credentials = userSession.userTokens || {};
    const accessToken: string = tokens.access_token || "";

    const revisions = await docRevisions(docId, accessToken);
    if (!revisions.length) return next();

    const doc = await docsTable.createDocIfNotExists(docId);
    if (!doc) return next();

    const numRevisions = revisions.length;
    const newestRevision = revisions[numRevisions - 1];
    const user = userSession.user as User;

    // Check if the document is already being evaluated before updating and proceeding with the analysis
    // If it's currently being evaluated, return an early response
    let userdoc = await userDocsTable.getUserDocByGoogleIds(user.google_account_id, doc.google_id);
    if (userdoc && userdoc.path === "") return response.json(doc);

    userdoc = await userDocsTable.createOrUpdateUserDoc(user.google_account_id, doc.google_id, newestRevision.id, "");
    if (!userdoc) return next();

    response.json(doc);

    const revisionTexts: Array<string> = await docRevisionTexts(docId, revisions, accessToken);
    if (!revisionTexts.length) return await userDocsTable.createOrUpdateUserDoc(user.google_account_id, doc.google_id, newestRevision.id, null);

    const revisionUsers = revisionsToUsers(revisions);

    // @ts-ignore
    const revisionChars: Array<RevisionChar> = revisionUserTextsToChars(revisionUsers, revisionTexts);
    const quotes: Array<Quote> = revisionCharsToQuotes(revisionChars);
    // @ts-ignore
    const permissionIdUsers = revisionUsersByPermissionId(revisionUsers);

    const permissionIdCharCounts = quotesToPermissionIdCharCounts(quotes);
    const permissionIdCharPercentages = permissionIdCharCountsToPercentages(permissionIdCharCounts);

    const googleDoc = { quotes: quotes, permissionIdUsers: permissionIdUsers, permissionIdCharCounts: permissionIdCharCounts, permissionIdCharPercentages: permissionIdCharPercentages };
    const googleDocPath = path.join(__dirname, "user_docs", `${user.google_account_id}-${doc.google_id}.json`);
    fs.writeFileSync(googleDocPath, JSON.stringify(googleDoc));
    return await userDocsTable.createOrUpdateUserDoc(user.google_account_id, doc.google_id, newestRevision.id, googleDocPath);
});

app.get("/api/docId/:id", requestIsAuthorizedWithGoogle, async (request: Request, response: Response, next: NextFunction) => {
    const docId = request.params.id as string;
    const userSession = request.session as UserSession;
    const user = userSession.user as User;
    const tokens = userSession.userTokens as Credentials;

    const userdoc = await userDocsTable.getUserDocByGoogleIds(user.google_account_id, docId);
    if (!userdoc) return response.status(STATUS_NOT_FOUND).json({ message: "Specified document could not be found." });
    // !userdoc.path indicates null or ""
    else if (!userdoc.path) {
        // It doesn't matter who we credit this revision to, we attribute credit to an anonymous user when the quotes variable gets updated.
        // We are returning text corresponding to the revision id currently in the database.
        const placeholderUser = {} as RevisionUser;
        const revisionUsers: Array<RevisionUser> = [placeholderUser];
        const placeholderRevision = { id: userdoc.revision_id, lastModifyingUser: placeholderUser } as Revision;
        const revisions: Array<Revision> = [placeholderRevision];

        const revisionTexts: Array<string> = await docRevisionTexts(docId, revisions, tokens.access_token as string);
        if (!revisionTexts.length) return next();

        const revisionChars: Array<RevisionChar> = revisionUserTextsToChars(revisionUsers, revisionTexts);

        let quotes: Array<Quote> = revisionCharsToQuotes(revisionChars);
        // As of writing, credit is given to the original document by default, so we update this since we don't know what the final doc's contributions looks like yet.
        quotes[0].permissionId = ANONYMOUS_PERMISSION_ID;
        const permissionIdUsers = revisionUsersByPermissionId(revisionUsers);

        const permissionIdCharCounts = quotesToPermissionIdCharCounts(quotes);
        const permissionIdCharPercentages = permissionIdCharCountsToPercentages(permissionIdCharCounts);

        const googleDoc = { quotes: quotes, permissionIdUsers: permissionIdUsers, permissionIdCharCounts: permissionIdCharCounts, permissionIdCharPercentages: permissionIdCharPercentages };

        // Failed dependency indicates that the previous analysis request failed. Service unavailable indicates that the previous analysis request is still being processed.
        const errorCode = (userdoc.path === null) ? STATUS_FAILED_DEPENDENCY : STATUS_SERVICE_UNAVAILABLE;
        return response.status(errorCode).json(googleDoc);
    }

    const googleDoc = JSON.parse(fs.readFileSync(userdoc.path, { encoding: "utf-8", flag: "r" }));
    return response.json(googleDoc);
});

app.get("/api/docIds", requestIsAuthorizedWithGoogle, async (request: Request, response: Response, next: NextFunction) => {
    const userSession = request.session as UserSession;
    const user = userSession.user as User;
    const docs = await docsTable.getAllDocsSubmittedByUser(user.id);
    return response.json(docs);
});

interface Author {
    displayName: string,
    emailAddress: string,
    docGoogleIds: string[],
    totalChars: number
}

function authorMake(name: string, email: string, docGoogleIds: string[], totalChars: number): Author {
    return { displayName: name, emailAddress: email, docGoogleIds: docGoogleIds, totalChars: totalChars };
}

app.get("/api/authors", requestIsAuthorizedWithGoogle, async (request: Request, response: Response, next: NextFunction) => {
    const userSession = request.session as UserSession;
    const user = userSession.user as User;

    let permissionIdAuthors: any = {};

    const docs: Array<any> = await docsTable.getAllDocsSubmittedByUser(user.id);
    for (const doc of docs) {
        const userdoc = await userDocsTable.getUserDocByIds(user.id, doc.id);
        // If the path is empty, it is either null or an empty string. This means the previous analysis failed or we are still processing the doc.
        if (!userdoc || !userdoc.path) continue;

        const googleDoc = JSON.parse(fs.readFileSync(userdoc.path, { encoding: "utf-8", flag: "r" }));
        const quotes = googleDoc.quotes;
        const permissionIdUsers = googleDoc.permissionIdUsers;

        for (const permissionId in permissionIdUsers) {
            const docUser = permissionIdUsers[permissionId];
            if (permissionId in permissionIdAuthors) {
                const author = permissionIdAuthors[permissionId];
                permissionIdAuthors[permissionId] = authorMake(author.displayName, author.emailAddress || docUser.emailAddress, author.docGoogleIds.concat([doc.google_id]), author.totalChars);
            }
            else
                permissionIdAuthors[permissionId] = authorMake(docUser.displayName, docUser.emailAddress, [doc.google_id], 0);
        }

        for (const quote of quotes) {
            const permissionId = quote.permissionId;
            const text = quote.text;
            const textWithoutNewlines = text.replace(/[\r\n]/g, "");
            permissionIdAuthors[permissionId].totalChars += textWithoutNewlines.length;
        }
    }
    return response.json(permissionIdAuthors);
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
