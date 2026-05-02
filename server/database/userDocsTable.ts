import pool from "./pool";
import { databaseQueryOnlyRow } from "./helpers";
import { getUserByGoogleAccountId } from "./usersTable";
import { getDocByGoogleId } from "./docsTable";

export async function getUserDocByIds(userId: number, docId: number): Promise<any | null> {
    return await databaseQueryOnlyRow(pool, `SELECT * FROM userdocs WHERE (user_id = $1 AND doc_id = $2);`, [userId, docId]);
}

export async function getUserDocByGoogleIds(userGoogleId: string, docGoogleId: string): Promise<any | null> {
    const user = await getUserByGoogleAccountId(userGoogleId);
    const doc = await getDocByGoogleId(docGoogleId);
    return await getUserDocByIds(user.id, doc.id);
}

// https://blog.purestorage.com/purely-technical/sql-update-vs-insert-vs-upsert/
// NOTE: A path that is an empty string indicates that the contributions are in the process of being determined
export async function createUserDoc(userId: number, docId: number, revisionId: string, path: string = ""): Promise<any> {
    try {
        return await databaseQueryOnlyRow(pool, `INSERT INTO userdocs (user_id, doc_id, revision_id, path) VALUES ($1, $2, $3, $4) RETURNING *;`, [userId, docId, revisionId, path]);
    }
    catch (error) {
        console.error(error);
        return null;
    }
}

// NOTE: A path that is null indicates that the evaluation failed
export async function updateRevisionIdAndPath(userId: number, docId: number, revisionId: string, path: string | null = null) {
    return await databaseQueryOnlyRow(pool, "UPDATE userdocs SET revision_id = $1, path = $2 WHERE (user_id = $3 AND doc_id = $4) RETURNING *;", [revisionId, path, userId, docId]);
}

// NOTE: A path that is not null and not empty indicates that the contribution evaluation succeeded
export async function createOrUpdateUserDoc(userGoogleId: string, docGoogleId: string, revisionId: string, path: string | null = ""): Promise<any> {
    const user = await getUserByGoogleAccountId(userGoogleId);
    const doc = await getDocByGoogleId(docGoogleId);

    let userdoc = await getUserDocByIds(user.id, doc.id);
    // The typescript error reported below this line should not be a problem because if there is no user doc, we can assume that the doc will start out being analyzed (meaning the path should never be null to begin with)
    if (!userdoc) userdoc = await createUserDoc(user.id, doc.id, revisionId, path);
    else          userdoc = await updateRevisionIdAndPath(user.id, doc.id, revisionId, path);

    return userdoc;
}
