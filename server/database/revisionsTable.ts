import pool from "./pool";
import { databaseQueryOnlyRow } from "./helpers";
import { getDocByGoogleId } from "./docsTable";
import path from "node:path";
import fs from "node:fs";

export async function getRevisionByGoogleIds(docGoogleId: string, id: string): Promise<any> {
    return await databaseQueryOnlyRow(pool, `SELECT * FROM revisions INNER JOIN docs ON revisions.doc_id = docs.id AND docs.google_id = $1 AND revisions.id = $2;`, [docGoogleId, id]);
}

export async function getRevisionTextByGoogleIds(docGoogleId: string, id: string): Promise<string | null> {
    const revision = await getRevisionByGoogleIds(docGoogleId, id);
    if (!revision) return null;

    const text = fs.readFileSync(revision.path, { encoding: "utf8", flag: "r" });
    return text;
}

export async function createRevision(docGoogleId: string, id: string, text: string): Promise<any> {
    try {
        const doc = await getDocByGoogleId(docGoogleId);
        const revisionsPath = path.join(__dirname, "../doc_revisions");
        if (!fs.existsSync(revisionsPath)) fs.mkdirSync(revisionsPath);

        const revisionPath = path.join(revisionsPath, `${docGoogleId}-${id}.txt`);
        fs.writeFileSync(revisionPath, text);

        return await databaseQueryOnlyRow(pool, `INSERT INTO revisions (id, doc_id, path) VALUES ($1, $2, $3) RETURNING *;`, [id, doc.id, revisionPath]);
    }
    catch (error) {
        console.error(error);
        return null;
    }
}

export async function createRevisionIfNotExists(docGoogleId: string, id: string, text: string): Promise<any> {
    let revision = await getRevisionByGoogleIds(docGoogleId, id);
    if (!revision) revision = await createRevision(docGoogleId, id, text);
    return revision;
}
