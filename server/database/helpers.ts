import { type DbPool, type DbResult } from "./pool";
import fs from "node:fs";

export async function databaseQueryWithFile(pool: DbPool, filePath: string): Promise<DbResult> {
    const sql = fs.readFileSync(filePath, { encoding: "utf-8", flag: "r" });
    return await pool.query(sql);
}

export function databaseGetOnlyRow(rows: Array<any>): any {
    if (rows.length === 1) {
        return rows[0];
    }
    else if (rows.length === 0) {
        return null;
    }
    throw new Error("More than one matching row was found in the database. Please review and update the uniqueness constraints or re-evaluate calling this function.");
}

export async function databaseQueryRows(pool: DbPool, formattedQuery: string, values: Array<any> = []): Promise<Array<any>> {
    const { rows } = await pool.query(formattedQuery, values);
    return rows;
}

export async function databaseQueryOnlyRow(pool: DbPool, formattedQuery: string, values: Array<any> = []): Promise<any> {
    const rows = await databaseQueryRows(pool, formattedQuery, values);
    return databaseGetOnlyRow(rows);
}
