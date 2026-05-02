import pool from "./pool";
import { databaseQueryOnlyRow, databaseQueryRows } from "./helpers";

export async function getDocByGoogleId(googleId: string) {
    return await databaseQueryOnlyRow(pool, `SELECT * FROM docs WHERE (google_id = $1);`, [googleId]);
}

export async function createDoc(googleId: string): Promise<any> {
    try {
        return await databaseQueryOnlyRow(pool, `INSERT INTO docs (google_id) VALUES ($1) RETURNING *;`, [googleId]);
    }
    catch (error) {
        console.error(error);
        return null;
    }
}

export async function createDocIfNotExists(googleId: string): Promise<any> {
    let doc = await getDocByGoogleId(googleId);
    if (!doc) doc = await createDoc(googleId);
    return doc;
}

export async function getAllDocsSubmittedByUser(userId: number): Promise<any> {
    return await databaseQueryRows(pool, `SELECT docs.id, docs.google_id FROM docs INNER JOIN userdocs ON docs.id = userdocs.doc_id AND userdocs.user_id = $1;`, [userId]);
}
