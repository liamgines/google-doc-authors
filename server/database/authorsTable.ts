import pool from "./pool";
import { databaseQueryOnlyRow } from "./helpers";

export async function getAuthorByPermissionId(permissionId: string) {
    return await databaseQueryOnlyRow(pool, `SELECT * FROM authors WHERE (permission_id = $1);`, [permissionId]);
}

export async function createAuthor(permissionId: string, name: string | null = null, email: string | null = null, photoLink: string | null = null): Promise<any> {
    return await databaseQueryOnlyRow(pool, `INSERT INTO authors (permission_id, name, email, photo_link) VALUES ($1, $2, $3, $4) RETURNING *;`, [permissionId, name, email, photoLink]);
}

async function updateAuthorInfoIfNotNull(permissionId: string, name: string | null = null, email: string | null = null, photoLink: string | null = null): Promise<any> {
    return await databaseQueryOnlyRow(pool, `UPDATE authors SET name = COALESCE($1::TEXT, name), email = COALESCE($2::TEXT, email), photo_link = COALESCE($3::TEXT, photo_link) WHERE (permission_id = $4) RETURNING *;`, [name, email, photoLink, permissionId]);
}

export async function createOrUpdateAuthor(permissionId: string, name: string | null = null, email: string | null = null, photoLink: string | null = null): Promise<any> {
    let author = await getAuthorByPermissionId(permissionId);

    if (!author) author = await createAuthor(permissionId, name, email, photoLink);
    else         author = await updateAuthorInfoIfNotNull(permissionId, name, email, photoLink);

    return author;
}
