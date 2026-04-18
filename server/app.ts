import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
//https://expressjs.com/en/resources/middleware/session.html
import session, { type Session } from "express-session";
import connectPgSimple from "connect-pg-simple";
import pool from "./database/pool";
import * as usersTable from "./database/usersTable";

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());    // To parse application/json

interface User {
    id: number,
    google_account_id: string
}

// https://stackoverflow.com/a/73270492/32242805
interface ExtendedSession extends Session {
    user?: User | null;
}

function clientUserMake(id: number) {
    return { id: id };
}

function userToClientUser(user: User | null | undefined) {
    if (user) return clientUserMake(user.id);
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

async function googleVerifySignIn(token: string): Promise<string | null> {
    try {
        const ticket = await authenticationClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
        const payload: TokenPayload | undefined = ticket.getPayload();

        if (!payload) return null; 

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
        (request.session as ExtendedSession).user = user;
        return request.session.save(serverOnSessionSave);
    }
    return request.session.regenerate(serverOnSessionRegenerate);
});

app.get("/api/auth/google-logout", async (request: Request, response: Response, next: NextFunction) => {
    (request.session as ExtendedSession).user = null;

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
    if ((request.session as ExtendedSession).user) return next();
    return next("route");
}

app.get("/api/auth/signed-in-google-user", requestIsFromGoogleUser, async (request: Request, response: Response) => {
    const user: User | null | undefined = (request.session as ExtendedSession).user;
    return response.json(userToClientUser(user));
});

app.get("/api/auth/signed-in-google-user", async (request: Request, response: Response) => {
    return response.json(null);
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
