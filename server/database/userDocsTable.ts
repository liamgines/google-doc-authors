import pool from "./pool";
import { databaseQueryOnlyRow, databaseQueryRows } from "./helpers";
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
export async function createUserDoc(userId: number, docId: number, revisionId: string, modifiedTime: string, path: string = ""): Promise<any> {
    try {
        return await databaseQueryOnlyRow(pool, `INSERT INTO userdocs (user_id, doc_id, revision_id, modified_time, path, analysis_start_time) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *;`, [userId, docId, revisionId, modifiedTime, path]);
    }
    catch (error) {
        console.error(error);
        return null;
    }
}

function millisecondsToSeconds(milliseconds: number): number {
    const MILLISECONDS_PER_SECOND = 1000;
    const SECONDS_PER_MILLISECOND = 1 / MILLISECONDS_PER_SECOND;
    return milliseconds * SECONDS_PER_MILLISECOND;
}

export async function setNullPathAfterEnoughTimeSinceLastAnalysis(userId: number, docId: number, secondsToWait: number = 150) {
    const oldUserdoc = await getUserDocByIds(userId, docId);
    const currentDate = new Date();
    const analysisStartDate = new Date(oldUserdoc.analysis_start_time);
    const millisecondsAnalyzed: number = currentDate - analysisStartDate;
    const secondsAnalyzed: number = millisecondsToSeconds(millisecondsAnalyzed);

    // This will allow a new analysis request to start if enough time has passed
    const allowNullPath: boolean = (secondsAnalyzed >= secondsToWait);
    const newPath: string = (allowNullPath ? null : oldUserdoc.path);
    return await databaseQueryOnlyRow(pool, `UPDATE userdocs SET path = $1 WHERE (user_id = $2 AND doc_id = $3) RETURNING *;`, [newPath, userId, docId]);
}

// NOTE: A path that is null indicates that the evaluation failed
export async function updateRevisionIdTimeAndPath(userId: number, docId: number, revisionId: string, modifiedTime: string, path: string | null = null) {
    const startNewAnalysis = (path === "");
    const analysisCompleted: boolean = (path !== null && path !== "");
    return await databaseQueryOnlyRow(pool, `UPDATE userdocs SET revision_id = $1, modified_time = $2, path = $3,
                                             analysis_start_time = CASE WHEN $4 THEN NOW() ELSE analysis_start_time END,
                                             last_analysis_time = CASE WHEN $5 THEN NOW() ELSE last_analysis_time END
                                             WHERE (user_id = $6 AND doc_id = $7) RETURNING *;`, [revisionId, modifiedTime, path, startNewAnalysis, analysisCompleted, userId, docId]);
}

// NOTE: A path that is not null and not empty indicates that the contribution evaluation succeeded
export async function createOrUpdateUserDoc(userGoogleId: string, docGoogleId: string, revisionId: string, modifiedTime: string, path: string | null = ""): Promise<any> {
    const user = await getUserByGoogleAccountId(userGoogleId);
    const doc = await getDocByGoogleId(docGoogleId);

    let userdoc = await getUserDocByIds(user.id, doc.id);
    // The typescript error reported below this line should not be a problem because if there is no user doc, we can assume that the doc will start out being analyzed (meaning the path should never be null to begin with)
    if (!userdoc) userdoc = await createUserDoc(user.id, doc.id, revisionId, modifiedTime, path);
    else          userdoc = await updateRevisionIdTimeAndPath(user.id, doc.id, revisionId, modifiedTime, path);

    return userdoc;
}

/*
export async function getClientUserDocByIds(userId: number, docId: number): Promise<any> {
    return await databaseQueryOnlyRow(pool, `SELECT docs.id, docs.google_id, docs.name, userdocs.modified_time FROM docs INNER JOIN userdocs ON docs.id = userdocs.doc_id AND userdocs.user_id = $1 AND docs.id = $2;`, [userId, docId]);
}
*/

// https://stackoverflow.com/a/38754674
export async function getAllSubmittedByUser(userId: number): Promise<any> {
    return await databaseQueryRows(pool, `SELECT docs.id, docs.google_id, docs.name, userdocs.modified_time, row_to_json(authors) as last_modifying_user FROM docs
                                          INNER JOIN userdocs ON docs.id = userdocs.doc_id AND userdocs.user_id = $1
                                          INNER JOIN revisions ON userdocs.revision_id = revisions.id
                                          INNER JOIN authors ON revisions.author_id = authors.id;`, [userId]);
}
