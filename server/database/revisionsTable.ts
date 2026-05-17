import pool from "./pool";
import { databaseQueryOnlyRow } from "./helpers";
import { getDocByGoogleId } from "./docsTable";

export async function getRevisionByGoogleIds(docGoogleId: string, id: string): Promise<any> {
    return await databaseQueryOnlyRow(pool, `SELECT * FROM revisions INNER JOIN docs ON revisions.doc_id = docs.id AND docs.google_id = $1 AND revisions.id = $2;`, [docGoogleId, id]);
}

export async function getRevisionTextByGoogleIds(docGoogleId: string, id: string): Promise<string | null> {
    const revision = await getRevisionByGoogleIds(docGoogleId, id);
    if (!revision) return null;
    return revision.text;
}

export async function createRevision(docGoogleId: string, id: string, text: string | null, authorId: number): Promise<any> {
    try {
        const doc = await getDocByGoogleId(docGoogleId);
        return await databaseQueryOnlyRow(pool, `INSERT INTO revisions (id, doc_id, text, author_id) VALUES ($1, $2, $3, $4) RETURNING *;`, [id, doc.id, text, authorId]);
    }
    catch (error) {
        console.error(error);
        return null;
    }
}

export async function createRevisionIfNotExists(docGoogleId: string, id: string, text: string | null, authorId: number): Promise<any> {
    let revision = await getRevisionByGoogleIds(docGoogleId, id);
    if (!revision) revision = await createRevision(docGoogleId, id, text, authorId);
    return revision;
}

export async function updateRevisionTextIfNull(docGoogleId: string, id: string, text: string | null) {
    let revision = await getRevisionByGoogleIds(docGoogleId, id);
    // Need to be careful here, getRevisionByGoogleIds joins revisions with the docs table. This means revision.id is not going to be the revision id... So use the id passed in to this function instead.
    if (revision.text === null) revision = await databaseQueryOnlyRow(pool, `UPDATE revisions SET text = $1 WHERE (doc_id = $2 AND id = $3) RETURNING *;`, [text, revision.doc_id, id]);
    return revision;
}
