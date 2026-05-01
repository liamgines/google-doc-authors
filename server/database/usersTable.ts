import pool from "./pool";
import { databaseQueryOnlyRow } from "./helpers";

export async function getUserByGoogleAccountId(googleAccountId: string) {
    return await databaseQueryOnlyRow(pool, `SELECT * FROM users WHERE (google_account_id = $1);`, [googleAccountId]);
}

export async function createUser(googleAccountId: string): Promise<any> {
    try {
        // https://stackoverflow.com/q/34966841/32242805
        return await databaseQueryOnlyRow(pool, `INSERT INTO users (google_account_id) VALUES ($1) RETURNING *;`, [googleAccountId]);
    }
    catch (error) {
        console.error(error);
        return null;
    }
}

export async function createUserIfNotExists(googleAccountId: string): Promise<any> {
    let user = await getUserByGoogleAccountId(googleAccountId);
    if (!user) user = await createUser(googleAccountId);
    return user;
}
