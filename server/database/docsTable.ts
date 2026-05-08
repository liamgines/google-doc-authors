import pool from "./pool";
import { databaseQueryOnlyRow, databaseQueryRows } from "./helpers";

const DEFAULT_DOC_NAME = "Untitled document";

export async function getDocByGoogleId(googleId: string) {
    return await databaseQueryOnlyRow(pool, `SELECT * FROM docs WHERE (google_id = $1);`, [googleId]);
}

async function createDoc(googleId: string, name: string): Promise<any> {
    try {
        return await databaseQueryOnlyRow(pool, `INSERT INTO docs (google_id, name) VALUES ($1, $2) RETURNING *;`, [googleId, name]);
    }
    catch (error) {
        console.error(error);
        return null;
    }
}

async function updateDocName(googleId: string, name: string) {
    return await databaseQueryOnlyRow(pool, `UPDATE docs SET name = $1 WHERE (google_id = $2) RETURNING *;`, [name, googleId]);
}

export async function createDocIfNotExistsOrUpdate(googleId: string, name: string = DEFAULT_DOC_NAME): Promise<any> {
    let doc = await getDocByGoogleId(googleId);
    if (!doc) doc = await createDoc(googleId, name);
    else      doc = await updateDocName(googleId, name);

    return doc;
}

export async function getAllDocsSubmittedByUser(userId: number): Promise<any> {
    return await databaseQueryRows(pool, `SELECT docs.id, docs.google_id, docs.name FROM docs INNER JOIN userdocs ON docs.id = userdocs.doc_id AND userdocs.user_id = $1;`, [userId]);
}
